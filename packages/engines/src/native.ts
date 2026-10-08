import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as ort from 'onnxruntime-node';
import sharp, { type Sharp } from 'sharp';
import { SuperasterError, type Progress, type Recipe, type ImageInfo, type ExecutionRecord } from '../../contract/src/index.js';
import { cancelled, sha256, processingError, type EngineAdapter, type RuntimeOptions, type ProcessResult } from '../../core/src/index.js';
import { MODELS, chooseModel, listModels, type ModelDefinition } from './models.js';
import { assertRaster, checkDimensions, DEFAULT_LIMITS, bilinearAlpha, type Raster, type ImagingKernel, type EncodeOptions, type KernelName } from './raster.js';
import { executePipeline, type InferenceResult } from './pipeline.js';
export { MODELS, chooseModel, listModels } from './models.js';
export function defaultModelDir():string { return join(homedir(),'.cache','superaster','models'); }
export interface InstallOptions {modelDir?:string;signal?:AbortSignal;onProgress?:(progress:Progress)=>void}
const installs=new Map<string,Promise<string>>();
export async function verifyModel(path:string,definition:ModelDefinition,signal?:AbortSignal):Promise<void> {
 cancelled(signal);
 const info=await stat(path).catch(()=>undefined);
 if(!info) throw new SuperasterError('MODEL_MISSING',`Install ${definition.id} before offline use`,{model:definition.id,path});
 if(info.size!==definition.bytes) throw new SuperasterError('MODEL_INTEGRITY',`Model ${definition.id} has an invalid size`,{expected:definition.bytes,actual:info.size});
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(path)){cancelled(signal);hash.update(chunk);}
 if(hash.digest('hex')!==definition.sha256) throw new SuperasterError('MODEL_INTEGRITY',`Model ${definition.id} failed SHA-256 verification`,{model:definition.id});
}
export async function installModel(id:string,options:InstallOptions={}):Promise<string> {
 const definition=chooseModel(id); const modelDir=options.modelDir??defaultModelDir();const path=join(modelDir,definition.id+'.onnx');
 cancelled(options.signal);
 if(await stat(path).then(()=>true,()=>false)){options.onProgress?.({stage:'verify',message:'Verifying cached model'});await verifyModel(path,definition,options.signal);return path;}
 const key=path;
 if(installs.has(key)){await installs.get(key);cancelled(options.signal);return path;}
 const task=(async()=>{
  await mkdir(modelDir,{recursive:true});const temporary=path+'.part-'+randomUUID();let handle:Awaited<ReturnType<typeof open>>|undefined;
  try {
   const response=await fetch(definition.url,{signal:options.signal});
   if(!response.ok||!response.body) throw new SuperasterError('PROCESSING_FAILED',`Model download failed with HTTP ${response.status}`,{model:id});
   const advertised=response.headers.get('content-length');
   if(advertised && Number(advertised)!==definition.bytes) throw new SuperasterError('MODEL_INTEGRITY','Model download size does not match approved artifact');
   handle=await open(temporary,'wx');const hash=createHash('sha256');let downloaded=0;const reader=response.body.getReader();
   try {for(;;){cancelled(options.signal);const chunk=await reader.read();if(chunk.done)break;downloaded+=chunk.value.byteLength;if(downloaded>definition.bytes)throw new SuperasterError('MODEL_INTEGRITY','Model exceeds approved artifact size');await handle.write(chunk.value);hash.update(chunk.value);options.onProgress?.({stage:'download',completed:downloaded,total:definition.bytes,message:`Downloading ${definition.name}`});}}
   finally {await reader.cancel().catch(()=>undefined);reader.releaseLock();}
   cancelled(options.signal);options.onProgress?.({stage:'verify',message:'Checking model SHA-256'});
   if(downloaded!==definition.bytes || hash.digest('hex')!==definition.sha256)throw new SuperasterError('MODEL_INTEGRITY','Downloaded model does not match approved artifact');
   await handle.close();handle=undefined;await rename(temporary,path);return path;
  } catch(error) {if(options.signal?.aborted)throw new SuperasterError('CANCELLED','Model download cancelled');throw error;}
  finally {await handle?.close();await unlink(temporary).catch(()=>undefined);}
 })(); installs.set(key,task);
 try{return await task;}finally{installs.delete(key);}
}

function sharpInput(bytes:Uint8Array):Sharp {return sharp(Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength),{limitInputPixels:DEFAULT_LIMITS.max_pixels,failOn:'error',animated:true});}
function rawInput(raster:Raster):Sharp {assertRaster(raster);return sharp(Buffer.from(raster.data.buffer,raster.data.byteOffset,raster.data.byteLength),{raw:{width:raster.width,height:raster.height,channels:4}});}
async function toRaster(pipeline:Sharp):Promise<Raster>{const {data,info}=await pipeline.toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});if(info.channels!==4)throw new SuperasterError('PROCESSING_FAILED','Decoder returned non-RGBA pixels');const raster={data:new Uint8Array(data.buffer,data.byteOffset,data.byteLength),width:info.width,height:info.height};assertRaster(raster);return raster;}
export class NativeImagingKernel implements ImagingKernel {
 async inspect(bytes:Uint8Array):Promise<ImageInfo & {is_opaque:boolean}>{
  if(!bytes.length)throw new SuperasterError('INVALID_INPUT','Input file is empty');
  if(bytes.length>DEFAULT_LIMITS.max_bytes)throw new SuperasterError('LIMIT_EXCEEDED','Input exceeds compressed byte limit');
  try {const metadata=await sharpInput(bytes).metadata();checkDimensions(metadata.width,metadata.pageHeight??metadata.height);const pages=metadata.pages??1;if(!['png','jpeg','webp'].includes(metadata.format))throw new SuperasterError('UNSUPPORTED','Only JPEG, PNG and WebP files are supported');if(pages!==1)throw new SuperasterError('UNSUPPORTED','Animated and multi-frame inputs are unavailable');
   const isOpaque=metadata.hasAlpha?(await sharpInput(bytes).stats()).isOpaque:true;
   return {width:metadata.width,height:metadata.height,format:metadata.format,channels:metadata.channels,has_alpha:metadata.hasAlpha,is_opaque:isOpaque,bytes:bytes.length,...(metadata.orientation?{orientation:metadata.orientation}:{}),color_space:metadata.space,pages,metadata:{icc:Boolean(metadata.icc),exif:Boolean(metadata.exif),...(metadata.density?{density:metadata.density}:{})}};
  }catch(error){if(error instanceof SuperasterError)throw error;throw new SuperasterError('INVALID_INPUT',error instanceof Error?error.message:'Image could not be decoded');}
 }
 async decode(bytes:Uint8Array):Promise<Raster>{await this.inspect(bytes);return toRaster(sharpInput(bytes).autoOrient());}
 async resize(raster:Raster,width:number,height:number,kernel:KernelName):Promise<Raster>{checkDimensions(width,height);return toRaster(rawInput(raster).resize(width,height,{fit:'fill',kernel}));}
 async rotate(raster:Raster,angle:number,background:string):Promise<Raster>{return toRaster(rawInput(raster).rotate(angle,{background}));}
 async encode(raster:Raster,options:EncodeOptions):Promise<Uint8Array>{
  assertRaster(raster);if(options.metadata==='preserve')throw new SuperasterError('UNSUPPORTED','Preserving arbitrary source metadata is not yet supported by the native encoder');
  let pipeline=rawInput(raster);let gray=true,opaque=true;for(let i=0;i<raster.data.length;i+=4){if(raster.data[i]!==raster.data[i+1]||raster.data[i]!==raster.data[i+2])gray=false;if(raster.data[i+3]!==255)opaque=false;if(!gray&&!opaque)break;}
  if(gray&&opaque)pipeline=pipeline.removeAlpha().greyscale().toColourspace('b-w');else pipeline=pipeline.withIccProfile('srgb');
  if(options.dpi)pipeline=pipeline.withMetadata({density:options.dpi});
  if(options.format==='png')pipeline=pipeline.png({compressionLevel:Math.round((options.quality??90)*9/100)});
  else if(options.format==='jpeg')pipeline=pipeline.jpeg({quality:options.quality??90,chromaSubsampling:'4:4:4'});
  else pipeline=pipeline.webp({quality:options.quality??90,alphaQuality:100});
  return new Uint8Array(await pipeline.toBuffer());
 }
}
export class NativeEngine implements EngineAdapter {
 readonly id='native';readonly kernel=new NativeImagingKernel();private readonly modelDir:string;
 private session:ort.InferenceSession|undefined;private sessionModel:ModelDefinition|undefined;
 private cached:{key:string;result:InferenceResult}|undefined;
 private tail:Promise<unknown>=Promise.resolve();
 constructor(options:{modelDir?:string}={}){this.modelDir=options.modelDir??defaultModelDir();}
 capabilities(){return {operations:['remove_background','resize','crop','subject_crop','canvas','composite','rotate','flip','correct','mask','normalize','print_sheet'],formats:['png','jpeg','webp'],engines:MODELS.map(model=>({...model,runtime:'onnxruntime-node 1.30.0',backend:'cpu',validated:'feasibility; quality screening pending'})),limits:{...DEFAULT_LIMITS},offline:true};}
 async inspect(input:Uint8Array,options:RuntimeOptions={}):Promise<ImageInfo>{cancelled(options.signal);return this.kernel.inspect(input);}
 private async infer(raster:Raster,recipe:Recipe,options:RuntimeOptions):Promise<InferenceResult>{
  cancelled(options.signal);const definition=chooseModel(recipe.engine,recipe.quality);const key=definition.sha256+':'+raster.width+':'+raster.height+':'+await sha256(raster.data);
  if(this.cached?.key===key)return {...this.cached.result,alpha:this.cached.result.alpha.slice(),cacheHit:true};
  if(this.sessionModel?.id!==definition.id){await this.session?.release();this.session=undefined;this.sessionModel=undefined;this.cached=undefined;
   const path=await installModel(definition.id,{modelDir:options.modelDir??this.modelDir,signal:options.signal,onProgress:options.onProgress});cancelled(options.signal);options.onProgress?.({stage:'initialize',message:`Initializing ${definition.name}`});
   this.session=await ort.InferenceSession.create(path,{executionProviders:['cpu'],logSeverityLevel:3});this.sessionModel=definition;
   const input=this.session.inputMetadata[0],output=this.session.outputMetadata[0];
   if(!input?.isTensor||input.name!==definition.inputName||input.type!=='float32'||input.shape.join(',')!=='1,3,512,512'||!output?.isTensor||output.name!==definition.outputName||output.type!=='float32'||output.shape.join(',')!=='1,1,512,512'){await this.session.release();this.session=undefined;this.sessionModel=undefined;throw new SuperasterError('MODEL_INTEGRITY','Loaded ONNX tensor contract differs from approved profile');}
  }
  cancelled(options.signal);options.onProgress?.({stage:'preprocess',message:'Preparing 512px local inference input'});
  const small=await this.kernel.resize(raster,512,512,'linear'),data=new Float32Array(3*512*512),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let c=0;c<3;c++)for(let i=0;i<512*512;i++)data[c*512*512+i]=(small.data[i*4+c]!/255-mean[c]!)/std[c]!;
  cancelled(options.signal);options.onProgress?.({stage:'inference',message:`Running ${definition.name} locally`});
  const output=await this.session!.run({[definition.inputName]:new ort.Tensor('float32',data,[1,3,512,512])});cancelled(options.signal);const tensor=output[definition.outputName];
  if(!tensor||tensor.type!=='float32'||tensor.dims.join(',')!=='1,1,512,512'||!(tensor.data instanceof Float32Array))throw new SuperasterError('PROCESSING_FAILED','Inference returned an invalid tensor');
  const alpha=new Float32Array(tensor.data.length);for(let i=0;i<alpha.length;i++){const value=tensor.data[i]!;if(!Number.isFinite(value))throw new SuperasterError('PROCESSING_FAILED','Inference returned non-finite alpha logits');alpha[i]=1/(1+Math.exp(-value));}
  const engine:ExecutionRecord['engine']={id:definition.id,version:definition.revision,model_hash:definition.sha256,precision:'fp16 weights / float32 I/O',inference_dimensions:[512,512],runtime:'onnxruntime-node 1.30.0',backend:'cpu',refinement:'none'};
  const result={alpha,width:512,height:512,engine};this.cached={key,result};return {...result,alpha:alpha.slice()};
 }
 async execute(input:Uint8Array,recipe:Recipe,options:RuntimeOptions={}):Promise<ProcessResult>{const run=async()=>{try{cancelled(options.signal);return await executePipeline(input,recipe,{...options,kernel:this.kernel,infer:(r,p,o)=>this.infer(r,p,o)});}catch(error){throw processingError(error);}};const task=this.tail.then(run,run);this.tail=task.then(()=>undefined,()=>undefined);return task;}
 async dispose():Promise<void>{await this.tail;await this.session?.release();this.session=undefined;this.sessionModel=undefined;this.cached=undefined;}
}
