import {resolvePreset,resolvePresetStatus,planPreset,validate as validatePreset} from '../../catalog/src/index.js';
import { Effect, Semaphore } from 'effect';
import { parseRecipe, parseImageInfo, parseExecutionRecord, SuperasterError, operationDefinitions, type Recipe, type Operation, type ImageInfo, type ExecutionRecord, type Progress } from '../../contract/src/index.js';

export interface RuntimeOptions { signal?: AbortSignal; onProgress?: (progress: Progress)=>void; bindings?:Record<string, Uint8Array>; modelDir?:string }
export interface ProcessResult { bytes: Uint8Array; record: ExecutionRecord; mask?:Uint8Array }
export interface EngineAdapter {
  readonly id:string;
  capabilities(): { operations:string[]; formats:string[]; engines:Record<string,unknown>[]; limits: {max_pixels:number;max_bytes:number;max_concurrency:number}; offline:boolean };
  inspect(input:Uint8Array, options?:RuntimeOptions):Promise<ImageInfo>;
  execute(input:Uint8Array, recipe:Recipe, options?:RuntimeOptions):Promise<ProcessResult>;
  dispose():Promise<void>;
}
export function cancelled(signal?:AbortSignal) { if (signal?.aborted) throw new SuperasterError('CANCELLED','Operation cancelled; completed outputs are retained'); }
export function processingError(error:unknown):SuperasterError {
  if(error instanceof SuperasterError) return error;
  if(error instanceof Error && error.name==='AbortError') return new SuperasterError('CANCELLED','Operation cancelled');
  return new SuperasterError('PROCESSING_FAILED', error instanceof Error?error.message:String(error));
}
export function canonicalJson(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonicalJson).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().filter(key=>(value as Record<string,unknown>)[key]!==undefined).map(key=>JSON.stringify(key)+':'+canonicalJson((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export async function sha256(bytes:Uint8Array):Promise<string> { const copied=Uint8Array.from(bytes); const digest=await globalThis.crypto.subtle.digest('SHA-256',copied); return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''); }
export async function recipeHash(recipe:Recipe,bindingHashes?:Record<string,string>):Promise<string> { return sha256(new TextEncoder().encode(canonicalJson(bindingHashes && Object.keys(bindingHashes).length ? {recipe,binding_hashes:bindingHashes} : recipe))); }
export async function bindingHashes(recipe:Recipe,bindings:RuntimeOptions['bindings']={}) {
 const refs=new Set(recipe.operations.flatMap(op=>op.op==='composite'&&op.image_ref?[op.image_ref]:op.op==='correct'&&op.mask_ref?[op.mask_ref]:[]));
 const hashes:Record<string,string>={};for(const ref of refs){const bytes=bindings[ref];if(!bytes)throw new SuperasterError('INVALID_INPUT',`Missing bound input ${ref}`);hashes[ref]=await sha256(bytes);}return hashes;
}
export function plan(value:unknown, adapter:EngineAdapter):Recipe {
  const recipe=parseRecipe(value), caps=adapter.capabilities();
  const available=new Set<string>();for(const profile of caps.engines){if(typeof profile.id!=='string')continue;available.add(profile.id);if(profile.id.includes(':')){available.add(profile.id.split(':')[0]!);available.add(profile.id.split(':')[0]!+':auto');}}
  if(recipe.engine&&recipe.engine!=='auto'&&!available.has(recipe.engine))throw new SuperasterError('UNSUPPORTED',`Engine ${recipe.engine} is unavailable on ${adapter.id}`,{available:[...available]});
  for(const op of recipe.operations) if(!caps.operations.includes(op.op)) throw new SuperasterError('UNSUPPORTED',`Operation ${op.op} is unavailable on ${adapter.id}`,{operation:op.op});
  if(!caps.formats.includes(recipe.output.format)) throw new SuperasterError('UNSUPPORTED',`Format ${recipe.output.format} is unavailable`);
  return {...recipe, engine:recipe.engine??'auto', quality:recipe.quality??'quality', output:{...recipe.output,metadata:recipe.output.metadata??'strip'}};
}
export class Processor {
  private readonly semaphore:Semaphore.Semaphore;
  constructor(readonly adapter:EngineAdapter) { this.semaphore=Semaphore.makeUnsafe(adapter.capabilities().limits.max_concurrency); }
  capabilities() { return {contract_version:'1.0',implementation_version:'0.1.0-alpha.1',adapter:this.adapter.id, operation_definitions:operationDefinitions, ...this.adapter.capabilities()}; }
  async inspect(input:Uint8Array, options:RuntimeOptions={}) { cancelled(options.signal); return parseImageInfo(await this.adapter.inspect(input,options)); }
  async transform(input:Uint8Array,value:unknown,options:RuntimeOptions={}):Promise<ProcessResult> {
    let recipe=plan(value,this.adapter);if(recipe.preset)recipe=planPreset(resolvePreset(recipe.preset.id,recipe.preset.version),recipe);
    const task=this.semaphore.withPermit(Effect.tryPromise({try: async signal=>{cancelled(options.signal); return this.adapter.execute(input,recipe,{...options,signal:options.signal??signal});},catch:processingError}));
    // runPromiseExit preserves the typed public error instead of exposing runtime wrappers.
    const exit=await Effect.runPromiseExit(task);
    if(exit._tag==='Success'){const result=exit.value;if(!(result.bytes instanceof Uint8Array)||!result.bytes.length||(result.mask!==undefined&&!(result.mask instanceof Uint8Array)))throw new SuperasterError('PROCESSING_FAILED','Invalid processor output bytes');parseExecutionRecord(result.record);if(recipe.preset){const destination=resolvePresetStatus(recipe.preset.id,recipe.preset.version);result.record.rules=validatePreset(result.record.output,destination.preset);for(const notice of destination.notices)if(!result.record.warnings.includes(notice.message))result.record.warnings.push(notice.message);}return result;}
    const failure=exit.cause.reasons.find(reason=>reason._tag==='Fail');
    if(failure && failure._tag==='Fail') throw failure.error;
    throw new SuperasterError('CANCELLED','Operation interrupted');
  }
  async dispose() { await this.adapter.dispose(); }
}
export interface BatchItem { id:string; input:Uint8Array; name:string }
export interface BatchEntry { id:string; name:string; input_hash:string; recipe_hash:string; status:'completed'|'failed'|'cancelled'; output_hash?:string; error?:ReturnType<SuperasterError['toJSON']> }
export async function runBatch(processor:Processor, items:BatchItem[], recipe:unknown, options:RuntimeOptions & { onItem?:(entry:BatchEntry,result?:ProcessResult)=>Promise<void>|void }={}) {
  const parsed=plan(recipe,processor.adapter); const hash=await recipeHash(parsed,await bindingHashes(parsed,options.bindings)); const entries:BatchEntry[]=[];
  // Serial scheduling shares the warmed model; additional concurrency requires measurements.
  for(const item of items) {
    const entry:BatchEntry={id:item.id,name:item.name,input_hash:await sha256(item.input),recipe_hash:hash,status:'cancelled'};
    if(!options.signal?.aborted) {
      try {const result=await processor.transform(item.input,parsed,options); entry.status='completed';entry.output_hash=result.record.output.hash;await options.onItem?.(entry,result);}
      catch(error) {const e=processingError(error);entry.status=e.code==='CANCELLED'?'cancelled':'failed';entry.error=e.toJSON();await options.onItem?.(entry);}
    } else {entry.error=new SuperasterError('CANCELLED','Not scheduled after cancellation').toJSON();await options.onItem?.(entry);}
    entries.push(entry);
  }
  return {version:'1.0',recipe_hash:hash,entries};
}
