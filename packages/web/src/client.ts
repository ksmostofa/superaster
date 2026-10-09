import { operationDefinitions, SuperasterError, type Recipe, type ImageInfo } from '../../contract/src/index.js';
import type { EngineAdapter, RuntimeOptions, ProcessResult } from '../../core/src/index.js';
import { MODELS } from '../../engines/src/models.js';
export class BrowserWorkerEngine implements EngineAdapter {
 readonly id='browser-worker-local';private worker?:Worker;private nextId=0;private backend:'auto'|'wasm'|'webgpu'='auto';
 private pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:unknown)=>void;cleanup:()=>void;options:RuntimeOptions}>();
 capabilities(){return {operations:operationDefinitions.map(op=>op.id),formats:['png','jpeg','webp'],engines:MODELS.flatMap(model=>['wasm','webgpu'].map(backend=>({...model,id:model.id+':'+backend,status:'candidate',backend}))),limits:{max_pixels:8_000_000,max_bytes:64*1024*1024,max_concurrency:1},offline:true};}
 private ensureWorker(){if(this.worker)return this.worker;const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});this.worker=worker;
  worker.addEventListener('message',(event:MessageEvent<{id:number;value?:unknown;error?:{code:SuperasterError['code'];message:string;details:Record<string,unknown>};progress?:unknown}>)=>{const message=event.data,item=this.pending.get(message.id);if(!item)return;if(message.progress){item.options.onProgress?.(message.progress as Parameters<NonNullable<RuntimeOptions['onProgress']>>[0]);return;}item.cleanup();this.pending.delete(message.id);if(message.error)item.reject(new SuperasterError(message.error.code,message.error.message,message.error.details));else item.resolve(message.value);});
  worker.addEventListener('error',()=>{this.rejectAll(new SuperasterError('PROCESSING_FAILED','Image worker failed; retry after checking device limits'));});return worker;
 }
 private rejectAll(error:SuperasterError){this.worker?.terminate();this.worker=undefined;for(const item of this.pending.values()){item.cleanup();item.reject(error);}this.pending.clear();}
 async request<T>(kind:string,payload:Record<string,unknown>={},options:RuntimeOptions={}):Promise<T>{if(options.signal?.aborted)throw new SuperasterError('CANCELLED','Operation cancelled');const worker=this.ensureWorker(),id=++this.nextId;
  return new Promise<T>((resolve,reject)=>{const onAbort=()=>this.rejectAll(new SuperasterError('CANCELLED','Operation cancelled; completed outputs are retained'));const cleanup=()=>options.signal?.removeEventListener('abort',onAbort);this.pending.set(id,{resolve:value=>resolve(value as T),reject,cleanup,options});options.signal?.addEventListener('abort',onAbort,{once:true});worker.postMessage({id,kind,backend:this.backend,...payload});});
 }
 inspect(input:Uint8Array,options:RuntimeOptions={}){return this.request<ImageInfo>('inspect',{input},options);}
 async execute(input:Uint8Array,recipe:Recipe,options:RuntimeOptions={}):Promise<ProcessResult>{
  try{return await this.request<ProcessResult>('execute',{input,recipe,bindings:options.bindings},options);}
  catch(error){
   if(!(error instanceof SuperasterError))throw error;
   const restart=error.details.restart_backend,sameModelFallback=error.details.allow_same_model_wasm===true;
   if(!sameModelFallback&&restart!=='wasm'&&restart!=='webgpu')throw error;
   this.rejectAll(new SuperasterError('CANCELLED','Worker restarted to initialize the selected backend'));this.backend=sameModelFallback?'wasm':restart as 'wasm'|'webgpu';
   options.onProgress?.({stage:'initialize',message:sameModelFallback?'WebGPU initialization failed; preparing the same approved model with WASM':'Preparing selected backend in a fresh worker'});
   const result=await this.request<ProcessResult>('execute',{input,recipe,bindings:options.bindings},options);
   if(sameModelFallback)result.record.warnings.push(`WebGPU initialization failed (${String(error.details.reason)}); the identical approved model ran with WASM`);
   return result;
  }
 }
 async dispose(){this.rejectAll(new SuperasterError('CANCELLED','Processor closed'));}
}
