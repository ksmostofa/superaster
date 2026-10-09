import type * as Ort from 'onnxruntime-web/wasm';
import { SuperasterError, operationDefinitions, type Recipe, type ImageInfo, type Progress } from '../../contract/src/index.js';
import { cancelled, sha256, type EngineAdapter, type RuntimeOptions, type ProcessResult } from '../../core/src/index.js';
import { BrowserKernel } from './browser-kernel.js';
import { executePipeline, type InferenceResult } from './pipeline.js';
import { createGpuSession, probeWebGpu } from './gpu-runtime.js';
import { chooseModel, MODELS, modelInput, modelAlpha, type ModelDefinition } from './models.js';
import type { Raster } from './raster.js';

const cacheName='superaster-models-v1';
const modelUrl=(model:ModelDefinition)=>import.meta.env.DEV?'/models/'+model.id+'.onnx':model.url;
export async function browserModelStatus() {const cache=await caches.open(cacheName);return Promise.all(MODELS.map(async model=>({id:model.id,cached:!!await cache.match(model.url),bytes:model.bytes,sha256:model.sha256})));}
export async function installBrowserModel(model:ModelDefinition,options:RuntimeOptions={}):Promise<Uint8Array> {
 const cache=await caches.open(cacheName);const existing=await cache.match(model.url);
 if(existing){const bytes=new Uint8Array(await existing.arrayBuffer());options.onProgress?.({stage:'verify',message:'Verifying cached model'});if(bytes.length===model.bytes&&await sha256(bytes)===model.sha256)return bytes;await cache.delete(model.url);throw new SuperasterError('MODEL_INTEGRITY','Cached model failed verification; install it again');}
 options.onProgress?.({stage:'download',completed:0,total:model.bytes,message:'Downloading model, images stay on this device'});
 let response:Response;try{response=await fetch(modelUrl(model),{signal:options.signal,mode:'cors'});}catch(error){cancelled(options.signal);throw new SuperasterError('MODEL_MISSING','Model is not cached and download failed; connect and prepare it before offline use');}
 if(!response.ok||!response.body)throw new SuperasterError('MODEL_MISSING',`Model download failed (${response.status})`);
 const bytes=new Uint8Array(model.bytes),reader=response.body.getReader();let count=0;
 try {for(;;){cancelled(options.signal);const {done,value}=await reader.read();if(done)break;if(count+value.length>model.bytes)throw new SuperasterError('MODEL_INTEGRITY','Model exceeds declared artifact size');bytes.set(value,count);count+=value.length;options.onProgress?.({stage:'download',completed:count,total:model.bytes});}}
 catch(error){cancelled(options.signal);if(error instanceof SuperasterError)throw error;throw new SuperasterError('MODEL_MISSING',`Model download stopped after ${(count/1024/1024).toFixed(1)} MiB. Retry online or import the exact approved local artifact.`,{received_bytes:count,expected_bytes:model.bytes});}
 finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
 options.onProgress?.({stage:'verify',message:'Verifying model SHA-256'});if(count!==model.bytes||await sha256(bytes)!==model.sha256)throw new SuperasterError('MODEL_INTEGRITY','Downloaded model failed artifact verification');
 try {await cache.put(model.url,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));}catch{throw new SuperasterError('LIMIT_EXCEEDED','Model cache is full or unavailable; clear unused storage and retry');}
 return bytes;
}
export async function importBrowserModel(model:ModelDefinition,bytes:Uint8Array,options:RuntimeOptions={}) {
 cancelled(options.signal);options.onProgress?.({stage:'verify',message:'Verifying local approved artifact'});
 if(bytes.length!==model.bytes||await sha256(bytes)!==model.sha256)throw new SuperasterError('MODEL_INTEGRITY','Local file does not match this approved model size and SHA-256');
 cancelled(options.signal);try{const cache=await caches.open(cacheName);await cache.put(model.url,new Response(Uint8Array.from(bytes),{headers:{'Content-Type':'application/octet-stream'}}));}catch{throw new SuperasterError('LIMIT_EXCEEDED','Model cache is full or unavailable');}cancelled(options.signal);return {id:model.id,cached:true};
}
export class BrowserEngine implements EngineAdapter {
 readonly id='browser-local';private kernel=new BrowserKernel();private session?:Ort.InferenceSession;private runtime?:typeof Ort;private modelId?:string;private backend?:'wasm'|'webgpu';private realmBackend?:'wasm'|'webgpu';private gpuMetadata?:Record<string,unknown>;
 private cached?:{key:string;result:InferenceResult};
 constructor(private readonly preferredBackend:'auto'|'wasm'|'webgpu'='auto'){}
 capabilities(){return{operations:operationDefinitions.map(op=>op.id),formats:['png','jpeg','webp'],engines:MODELS.flatMap(model=>['wasm','webgpu'].map(backend=>({...model,id:model.id+':'+backend,status:'candidate',backend}))),limits:{max_pixels:8_000_000,max_bytes:64*1024*1024,max_concurrency:1},offline:true};}
 inspect(input:Uint8Array,_options:RuntimeOptions={}):Promise<ImageInfo>{return this.kernel.inspect(input);}
 async execute(input:Uint8Array,recipe:Recipe,options:RuntimeOptions={}):Promise<ProcessResult>{
  return executePipeline(input,recipe,{kernel:this.kernel,infer:this.infer.bind(this),limits:this.capabilities().limits,...options});
 }
 private async infer(raster:Raster,recipe:Recipe,options:RuntimeOptions={}) {
  const parts=(recipe.engine??'auto').split(':'),model=chooseModel(parts[0],recipe.quality),requested=parts[1]??this.preferredBackend;
  if(!['auto','wasm','webgpu'].includes(requested)||parts.length>2)throw new SuperasterError('UNSUPPORTED','Unknown browser inference backend');
  const backend=requested==='auto'?((await probeWebGpu(options.signal)).supported?'webgpu':'wasm'):requested as 'wasm'|'webgpu';
  if(this.realmBackend&&this.realmBackend!==backend)throw new SuperasterError('UNSUPPORTED','Changing ORT backend requires a fresh worker',{restart_backend:backend});
  const timings:Record<string,number>={},lookup=performance.now(),key=model.sha256+':'+backend+':'+raster.width+':'+raster.height+':'+await sha256(raster.data);
  if(this.cached?.key===key)return{...this.cached.result,alpha:this.cached.result.alpha.slice(),cacheHit:true,timings_ms:{alpha_cache_lookup:performance.now()-lookup}};
  cancelled(options.signal);
  if(!this.session||this.modelId!==model.id){await this.dispose();const setup=performance.now(),bytes=await installBrowserModel(model,options);timings.model_setup=performance.now()-setup;this.realmBackend=backend;
   try{
    const initialize=performance.now();
    if(backend==='webgpu'){const result=await createGpuSession(bytes,model,options);this.runtime=result.runtime;this.session=result.session;this.gpuMetadata=result.metadata;Object.assign(timings,result.metadata.timings_ms);}
    else{const runtime=await import('onnxruntime-web/wasm');this.runtime=runtime;runtime.env.wasm.numThreads=1;runtime.env.wasm.proxy=false;runtime.env.wasm.wasmPaths={mjs:new URL('/runtime/ort-wasm-simd-threaded.mjs',globalThis.location.href),wasm:new URL('/runtime/ort-wasm-simd-threaded.wasm',globalThis.location.href)};options.onProgress?.({stage:'initialize',message:'Initializing the approved model with WASM'});this.session=await runtime.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});}
    timings.initialize_total=performance.now()-initialize;this.modelId=model.id;this.backend=backend;
    const tensor=this.session.inputMetadata[0],output=this.session.outputMetadata[0];
    if(!tensor?.isTensor||tensor.name!==model.inputName||tensor.type!=='float32'||tensor.shape.join(',')!==[1,3,model.height,model.width].join(',')||!output?.isTensor||output.name!==model.outputName||output.type!==model.outputType||output.shape.join(',')!==[1,1,model.height,model.width].join(','))throw new SuperasterError('MODEL_INTEGRITY','Browser model tensor contract differs from its approved profile');
   }catch(error){await this.dispose();if(error instanceof SuperasterError&&error.code==='MODEL_INTEGRITY')throw error;throw new SuperasterError('UNSUPPORTED','The approved model could not initialize on this browser backend',{model:model.id,backend,allow_same_model_wasm:backend==='webgpu'&&requested==='auto',reason:error instanceof Error?error.message:String(error)});}
  }
  cancelled(options.signal);const preprocess=performance.now();options.onProgress?.({stage:'preprocess'});const resized=await this.kernel.resize(raster,model.width,model.height,'linear');
  const pixels=model.width*model.height,tensorData=modelInput(resized,model);
  timings.preprocess=performance.now()-preprocess;const tensor=new this.runtime!.Tensor('float32',tensorData,[1,3,model.height,model.width]);let outputs:Ort.InferenceSession.ReturnType|undefined;
  try{
   options.onProgress?.({stage:'inference',message:`Running local ${backend} inference`});const infer=performance.now();outputs=await this.session!.run({[model.inputName]:tensor});timings.inference_kernel=performance.now()-infer;cancelled(options.signal);const output=outputs[model.outputName];
   if(!output||output.type!==model.outputType||output.dims.join(',')!==[1,1,model.height,model.width].join(',')||output.data.length!==pixels)throw new SuperasterError('PROCESSING_FAILED','Unexpected model tensor output');
   const decode=performance.now(),alpha=modelAlpha(output.data,model);timings.alpha_decode=performance.now()-decode;
   const result:InferenceResult={alpha,width:model.width,height:model.height,engine:{id:model.id,version:model.revision,model_hash:model.sha256,precision:model.precision,inference_dimensions:[model.width,model.height],runtime:'onnxruntime-web@1.30.0',backend,refinement:'none',...(this.gpuMetadata?{runtime_details:this.gpuMetadata}:{})},timings_ms:timings};this.cached={key,result};return {...result,alpha:alpha.slice()};
  }finally{for(const result of Object.values(outputs??{}))result.dispose();tensor.dispose();}
 }
 async dispose(){await this.session?.release();this.session=undefined;this.modelId=undefined;this.cached=undefined;this.gpuMetadata=undefined;}
}
