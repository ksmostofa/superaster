import { readFile, writeFile, stat, realpath, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { NativeEngine } from '../../engines/src/native.js';
import { Processor, type RuntimeOptions, type ProcessResult } from '../../core/src/index.js';
import { SuperasterError } from '../../contract/src/index.js';
export { SuperasterError, RecipeSchema, OperationSchema, parseRecipe } from '../../contract/src/index.js';
export type { Recipe, Operation, ExecutionRecord, ImageInfo, Progress } from '../../contract/src/index.js';
export { Processor, runBatch } from '../../core/src/index.js';
export { listPresets, resolvePreset, validate, planPreset, preparePreset, presetHistory, monitorSources, monitorCatalogSources, createCatalog, resolvePresetStatus } from '../../catalog/src/index.js';
export { fileBatch as batchFiles } from './files.js';
export { NativeEngine } from '../../engines/src/native.js';
export function createProcessor(options:{modelDir?:string}={}) { return new Processor(new NativeEngine(options)); }
export async function readInput(path:string,maxBytes=64*1024*1024):Promise<Uint8Array> {
  const info=await stat(path); if(!info.isFile()) throw new SuperasterError('INVALID_INPUT','Input must be a regular file');
  if(info.size>maxBytes) throw new SuperasterError('LIMIT_EXCEEDED',`Input exceeds ${maxBytes} bytes`);
  return readFile(path);
}
export async function assertAllowedPath(path:string,roots:string[],mode:'read'|'write'='read') {
  const permitted=await Promise.all(roots.map(root=>realpath(root)));
  let candidate:string;
  if(mode==='read') candidate=await realpath(path);
  else {
    // Resolve existing ancestors so a symlink cannot escape the configured root.
    let ancestor=resolve(path), suffix:string[]=[];
    for(;;) {try {candidate=resolve(await realpath(ancestor),...suffix.reverse());break;}catch(error){if(!(error instanceof Error) || !('code' in error) || error.code!=='ENOENT') throw error;const parent=dirname(ancestor);if(parent===ancestor)throw error;suffix.push(ancestor.slice(parent.length+1));ancestor=parent;}}
  }
  if(!permitted.some(root=>candidate===root||candidate.startsWith(root+'/'))) throw new SuperasterError('ACCESS_DENIED','Path is outside configured roots',{path});
  return candidate;
}
export async function writeResult(result:ProcessResult,path:string,options:{overwrite?:boolean;inputPath?:string;recordPath?:string}={}) {
  const target=resolve(path);
  if(options.inputPath && resolve(options.inputPath)===target && !options.overwrite) throw new SuperasterError('ACCESS_DENIED','Original input is protected; choose a different output');
  await mkdir(dirname(target),{recursive:true});
  // Exclusive file creation protects pre-existing originals and detects collisions.
  await writeFile(target,result.bytes,{flag:options.overwrite?'w':'wx'});
  try { await writeFile(options.recordPath??target+'.json',JSON.stringify(result.record,null,2)+'\n',{flag:options.overwrite?'w':'wx'}); }
  catch(error) {throw new SuperasterError('PROCESSING_FAILED','Image was saved but execution-record write failed',{output:target,reason:error instanceof Error?error.message:String(error)});}
}
export async function transformFile(processor:Processor,input:string,recipe:unknown,output:string,options:RuntimeOptions & {overwrite?:boolean}={}) {
  const result=await processor.transform(await readInput(input,processor.adapter.capabilities().limits.max_bytes),recipe,options);
  await writeResult(result,output,{inputPath:input,overwrite:options.overwrite});return result.record;
}
