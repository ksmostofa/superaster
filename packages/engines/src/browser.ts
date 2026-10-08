import * as ort from 'onnxruntime-web/wasm';
import { SuperasterError, operationDefinitions, type Recipe, type ImageInfo, type Progress } from '../../contract/src/index.js';
import { cancelled, sha256, type EngineAdapter, type RuntimeOptions, type ProcessResult } from '../../core/src/index.js';
import { BrowserKernel } from './browser-kernel.js';
import { executePipeline } from './pipeline.js';
import { chooseModel, MODELS, type ModelDefinition } from './models.js';
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
 finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
 options.onProgress?.({stage:'verify',message:'Verifying model SHA-256'});if(count!==model.bytes||await sha256(bytes)!==model.sha256)throw new SuperasterError('MODEL_INTEGRITY','Downloaded model failed artifact verification');
 try {await cache.put(model.url,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));}catch{throw new SuperasterError('LIMIT_EXCEEDED','Model cache is full or unavailable; clear unused storage and retry');}
 return bytes;
}
export class BrowserEngine implements EngineAdapter {
 readonly id='browser-wasm';private kernel=new BrowserKernel();private session?:ort.InferenceSession;private modelId?:string;
 capabilities(){return{operations:operationDefinitions.map(op=>op.id),formats:['png','jpeg','webp'],engines:MODELS.map(model=>({...model,status:'candidate',backend:'wasm'})),limits:{max_pixels:8_000_000,max_bytes:64*1024*1024,max_concurrency:1},offline:true};}
 inspect(input:Uint8Array,_options:RuntimeOptions={}):Promise<ImageInfo>{return this.kernel.inspect(input);}
 async execute(input:Uint8Array,recipe:Recipe,options:RuntimeOptions={}):Promise<ProcessResult>{
  return executePipeline(input,recipe,{kernel:this.kernel,infer:this.infer.bind(this),limits:this.capabilities().limits,...options});
 }
 private async infer(raster:Raster,recipe:Recipe,options:RuntimeOptions={}) {
  const model=chooseModel(recipe.engine,recipe.quality);cancelled(options.signal);
  if(!this.session||this.modelId!==model.id){await this.dispose();const bytes=await installBrowserModel(model,options);options.onProgress?.({stage:'initialize',message:'Initializing local WASM model'});
   ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths={mjs:new URL('/runtime/ort-wasm-simd-threaded.mjs',globalThis.location.href),wasm:new URL('/runtime/ort-wasm-simd-threaded.wasm',globalThis.location.href)};ort.env.wasm.proxy=false;
   try{this.session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});this.modelId=model.id;}
   catch(error){throw new SuperasterError('UNSUPPORTED','This model cannot initialize on this browser/runtime; no lower quality profile was substituted',{model:model.id,reason:error instanceof Error?error.message:String(error)});}
  }
  cancelled(options.signal);options.onProgress?.({stage:'preprocess'});const resized=await this.kernel.resize(raster,model.width,model.height,'linear');
  const pixels=model.width*model.height,tensorData=new Float32Array(pixels*3),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let channel=0;channel<3;channel++)for(let i=0;i<pixels;i++)tensorData[channel*pixels+i]=(resized.data[i*4+channel]!/255-mean[channel]!)/std[channel]!;
  const tensor=new ort.Tensor('float32',tensorData,[1,3,model.height,model.width]);options.onProgress?.({stage:'inference',message:'Running local inference'});
  const outputs=await this.session.run({[model.inputName]:tensor});cancelled(options.signal);const output=outputs[model.outputName];
  if(!output||output.type!=='float32'||output.data.length!==pixels)throw new SuperasterError('PROCESSING_FAILED','Unexpected model tensor output');
  const alpha=new Float32Array(pixels);for(let i=0;i<pixels;i++){const value=(output.data as Float32Array)[i]!;if(!Number.isFinite(value))throw new SuperasterError('PROCESSING_FAILED','Model produced nonfinite alpha');alpha[i]=1/(1+Math.exp(-value));}
  for(const result of Object.values(outputs))result.dispose();tensor.dispose();
  return{alpha,width:model.width,height:model.height,engine:{id:model.id,version:model.revision,model_hash:model.sha256,precision:model.precision,inference_dimensions:[model.width,model.height],runtime:'onnxruntime-web@1.30.0',backend:'wasm',refinement:'none'}};
 }
 async dispose(){await this.session?.release();this.session=undefined;this.modelId=undefined;}
}
