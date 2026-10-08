import { SuperasterError, type Recipe, type ExecutionRecord, type Progress } from '../../contract/src/index.js';
import { cancelled, recipeHash, sha256, type RuntimeOptions, type ProcessResult } from '../../core/src/index.js';
import { DEFAULT_LIMITS, assertRaster, checkDimensions, blank, cloneRaster, cropRaster, flipRaster, compositeAt, bilinearAlpha, applyAlpha, maskRaster, cleanEdgeRgb, type Raster, type ImagingKernel, type EncodeOptions } from './raster.js';
export interface InferenceResult {alpha:Float32Array;width:number;height:number;engine:ExecutionRecord['engine'];cacheHit?:boolean;timings_ms?:Record<string,number>}
export interface PipelineOptions extends RuntimeOptions {kernel:ImagingKernel;infer:(raster:Raster,recipe:Recipe,options:RuntimeOptions)=>Promise<InferenceResult>;limits?:{max_pixels:number;max_bytes:number;max_concurrency:number}}
function placement(canvasW:number,canvasH:number,w:number,h:number,position='center'):{left:number;top:number}{return {left:position==='left'?0:position==='right'?canvasW-w:Math.floor((canvasW-w)/2),top:position==='top'?0:position==='bottom'?canvasH-h:Math.floor((canvasH-h)/2)};}
export async function fitRaster(raster:Raster,width:number,height:number,fit:'contain'|'cover'|'fill',kernel:ImagingKernel,resampling:'nearest'|'lanczos3'='lanczos3',allowUpscale=true):Promise<Raster>{
 checkDimensions(width,height);let w=width,h=height;
 if(fit!=='fill'){const scale=fit==='cover'?Math.max(width/raster.width,height/raster.height):Math.min(width/raster.width,height/raster.height);w=Math.max(1,Math.round(raster.width*scale));h=Math.max(1,Math.round(raster.height*scale));}
 if(!allowUpscale&&(w>raster.width||h>raster.height))throw new SuperasterError('INVALID_RECIPE','Upscaling requires allow_upscale:true');
 let result=w===raster.width&&h===raster.height?cloneRaster(raster):await kernel.resize(raster,w,h,resampling);assertRaster(result);
 if(fit==='cover')result=cropRaster(result,Math.floor((w-width)/2),Math.floor((h-height)/2),width,height);return result;
}
async function onCanvas(raster:Raster,width:number,height:number,fit:'contain'|'cover'|'fill',background:string,position:string,kernel:ImagingKernel):Promise<Raster>{const fitted=await fitRaster(raster,width,height,fit,kernel);const {left,top}=placement(width,height,fitted.width,fitted.height,position);return compositeAt(blank(width,height,background),fitted,left,top);}
function alphaBounds(raster:Raster):{x:number;y:number;width:number;height:number}{let minX=raster.width,minY=raster.height,maxX=-1,maxY=-1;for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++)if(raster.data[(y*raster.width+x)*4+3]!>0){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}if(maxX<0)throw new SuperasterError('CONSTRAINT_UNSATISFIABLE','The alpha contains no foreground');return {x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};}
function opaque(raster:Raster):boolean{for(let i=3;i<raster.data.length;i+=4)if(raster.data[i]!==255)return false;return true;}
export async function executePipeline(input:Uint8Array,recipe:Recipe,options:PipelineOptions):Promise<ProcessResult>{
 const {kernel}=options,limits=options.limits??DEFAULT_LIMITS,signal=options.signal;cancelled(signal);const timings:Record<string,number>={};const warnings:string[]=[];
 const stage=async<T>(name:Progress['stage'],work:()=>Promise<T>):Promise<T>=>{cancelled(signal);options.onProgress?.({stage:name,message:name});const start=performance.now();try{return await work();}finally{timings[name]=(timings[name]??0)+performance.now()-start;cancelled(signal);}};
 const bindingHashes:Record<string,string>={};const requiredRefs=new Set(recipe.operations.flatMap(op=>op.op==='composite'&&op.image_ref?[op.image_ref]:op.op==='correct'&&op.mask_ref?[op.mask_ref]:[]));
 for(const ref of requiredRefs){const bytes=options.bindings?.[ref];if(!bytes)throw new SuperasterError('INVALID_INPUT',`Missing bound input ${ref}`);if(bytes.length>limits.max_bytes)throw new SuperasterError('LIMIT_EXCEEDED',`Bound input ${ref} exceeds compressed byte limit`);const info=await kernel.inspect(bytes);checkDimensions(info.width,info.height,limits.max_pixels);if(info.pages!==1||!['png','jpeg','webp'].includes(info.format))throw new SuperasterError('UNSUPPORTED',`Bound input ${ref} must be a supported single-frame image`);bindingHashes[ref]=await sha256(bytes);}
 if(input.length>limits.max_bytes)throw new SuperasterError('LIMIT_EXCEEDED','Input exceeds compressed byte limit',{max_bytes:limits.max_bytes});
 const inputInfo=await kernel.inspect(input);checkDimensions(inputInfo.width,inputInfo.height,limits.max_pixels);
 if(!['png','jpeg','webp'].includes(inputInfo.format)||inputInfo.pages!==1)throw new SuperasterError('UNSUPPORTED','Only single-frame JPEG, PNG and WebP inputs are supported');
 let current=await stage('decode',()=>kernel.decode(input));assertRaster(current);let original=cloneRaster(current);let hasMask=false;let foregroundMask:Raster|undefined;let dpi=recipe.output.dpi;
 let engine:ExecutionRecord['engine']={id:'imaging',version:'1.0',model_hash:null,precision:'uint8',inference_dimensions:[],runtime:'imaging-kernel',backend:'local',refinement:'none'};
 for(const operation of recipe.operations){cancelled(signal);
  switch(operation.op){
   case 'normalize':break; // Every decode normalizes orientation once and converts to sRGB.
   case 'remove_background':{
    const result=await stage('inference',()=>options.infer(current,recipe,options));engine=result.engine;for(const [name,ms] of Object.entries(result.timings_ms??{}))timings[name]=(timings[name]??0)+ms;
    const alpha=bilinearAlpha(result.alpha,result.width,result.height,current.width,current.height,signal);current=applyAlpha(current,alpha);hasMask=true;
    if(result.cacheHit)warnings.push('Inference alpha reused from the identical input and pinned model');
    if((operation.edge_cleanup??'auto')==='auto'){const cleanup=await stage('refine',async()=>cleanEdgeRgb(original,current,signal));current=cleanup.raster;engine={...engine,refinement:'local-edge-rgb-v1'};warnings.push(`Local edge RGB recovery changed ${cleanup.changed} soft-edge pixels; quality screening remains specific to the recorded profile`);}foregroundMask=cloneRaster(current);break;
   }
   case 'resize':{
    const width=operation.width??Math.max(1,Math.round(current.width*operation.height!/current.height)),height=operation.height??Math.max(1,Math.round(current.height*operation.width!/current.width));
    const fit=operation.fit??'contain';const resize=async(raster:Raster)=>{const fitted=await fitRaster(raster,width,height,fit,kernel,operation.resampling??'lanczos3',operation.allow_upscale??false);if(operation.width&&operation.height&&fit==='contain'){const {left,top}=placement(width,height,fitted.width,fitted.height);return compositeAt(blank(width,height),fitted,left,top);}return fitted;};current=await stage('render',()=>resize(current));original=await resize(original);if(foregroundMask)foregroundMask=await resize(foregroundMask);break;
   }
   case 'crop':current=cropRaster(current,operation.x,operation.y,operation.width,operation.height);original=cropRaster(original,operation.x,operation.y,operation.width,operation.height);if(foregroundMask)foregroundMask=cropRaster(foregroundMask,operation.x,operation.y,operation.width,operation.height);break;
   case 'subject_crop':{
    if(!hasMask)throw new SuperasterError('INVALID_RECIPE','Subject crop requires a removal or correction mask');const bounds=alphaBounds(foregroundMask??current),x=Math.max(0,bounds.x-operation.margin),y=Math.max(0,bounds.y-operation.margin),right=Math.min(current.width,bounds.x+bounds.width+operation.margin),bottom=Math.min(current.height,bounds.y+bounds.height+operation.margin);current=cropRaster(current,x,y,right-x,bottom-y);original=cropRaster(original,x,y,right-x,bottom-y);if(foregroundMask)foregroundMask=cropRaster(foregroundMask,x,y,right-x,bottom-y);break;
   }
   case 'canvas':{const fit=operation.fit??'contain',position=operation.position??'center';current=await stage('render',()=>onCanvas(current,operation.width,operation.height,fit,operation.background??'#00000000',position,kernel));original=await onCanvas(original,operation.width,operation.height,fit,'#00000000',position,kernel);if(foregroundMask)foregroundMask=await onCanvas(foregroundMask,operation.width,operation.height,fit,'#00000000',position,kernel);break;}
   case 'composite':{
    let background=operation.background?blank(current.width,current.height,operation.background):undefined;
    if(operation.image_ref){const bytes=options.bindings?.[operation.image_ref];if(!bytes)throw new SuperasterError('INVALID_INPUT',`Missing bound image ${operation.image_ref}`);const info=await kernel.inspect(bytes);checkDimensions(info.width,info.height,limits.max_pixels);if(info.pages!==1)throw new SuperasterError('UNSUPPORTED','Composite background must be single-frame');background=await onCanvas(await kernel.decode(bytes),current.width,current.height,operation.fit??'cover','#00000000',operation.position??'center',kernel);}
    if(!background)throw new SuperasterError('INVALID_RECIPE','Missing composite background');current=compositeAt(background,current,0,0);break;
   }
   case 'rotate':current=await stage('render',()=>kernel.rotate(current,operation.angle,operation.background??'#00000000'));original=await kernel.rotate(original,operation.angle,'#00000000');if(foregroundMask)foregroundMask=await kernel.rotate(foregroundMask,operation.angle,'#00000000');break;
   case 'flip':current=flipRaster(current,operation.axis);original=flipRaster(original,operation.axis);if(foregroundMask)foregroundMask=flipRaster(foregroundMask,operation.axis);break;
   case 'correct':{
    if(operation.mask_ref){const bytes=options.bindings?.[operation.mask_ref];if(!bytes)throw new SuperasterError('INVALID_INPUT',`Missing correction mask ${operation.mask_ref}`);const info=await kernel.inspect(bytes);if(info.width!==current.width||info.height!==current.height||info.pages!==1)throw new SuperasterError('INVALID_INPUT','Correction mask dimensions must match current image');const mask=await kernel.decode(bytes);assertRaster(mask);for(let i=0;i<current.width*current.height;i++){if(mask.data[i*4]!==mask.data[i*4+1]||mask.data[i*4]!==mask.data[i*4+2])throw new SuperasterError('INVALID_INPUT','Correction mask must contain grayscale coverage');const coverage=Math.round(mask.data[i*4]!*original.data[i*4+3]!/255);if(coverage>(foregroundMask??current).data[i*4+3]!)current.data.set(original.data.subarray(i*4,i*4+3),i*4);current.data[i*4+3]=coverage;if(foregroundMask)foregroundMask.data[i*4+3]=coverage;}}
    for(const region of operation.regions??[]){if(region.x+region.width>current.width||region.y+region.height>current.height)throw new SuperasterError('INVALID_RECIPE','Correction region exceeds current image');for(let y=region.y;y<region.y+region.height;y++)for(let x=region.x;x<region.x+region.width;x++){const i=(y*current.width+x)*4;if(region.mode==='erase'){current.data[i+3]=0;if(foregroundMask)foregroundMask.data[i+3]=0;}else {current.data.set(original.data.subarray(i,i+4),i);if(foregroundMask)foregroundMask.data.set(original.data.subarray(i,i+4),i);}}}
    hasMask=true;foregroundMask??=cloneRaster(current);break;
   }
   case 'mask':current=maskRaster(foregroundMask??current);original=cloneRaster(current);hasMask=false;foregroundMask=undefined;break;
   case 'print_sheet':{
    const px=(mm:number)=>Math.round(mm*operation.dpi/25.4),width=px(operation.sheet_width_mm),height=px(operation.sheet_height_mm),itemW=px(operation.item_width_mm),itemH=px(operation.item_height_mm),margin=px(operation.margin_mm),spacing=px(operation.spacing_mm);checkDimensions(width,height,limits.max_pixels);checkDimensions(itemW,itemH,limits.max_pixels);
    if(2*margin+operation.columns*itemW+(operation.columns-1)*spacing>width||2*margin+operation.rows*itemH+(operation.rows-1)*spacing>height)throw new SuperasterError('CONSTRAINT_UNSATISFIABLE','Fixed print grid exceeds sheet bounds');
    const item=await onCanvas(current,itemW,itemH,'contain',operation.background??'#ffffff','center',kernel);let sheet=blank(width,height,operation.background??'#ffffff');
    for(let row=0;row<operation.rows;row++)for(let col=0;col<operation.columns;col++){cancelled(signal);sheet=compositeAt(sheet,item,margin+col*(itemW+spacing),margin+row*(itemH+spacing));}if(foregroundMask){const maskItem=await onCanvas(foregroundMask,itemW,itemH,'contain','#00000000','center',kernel);let maskSheet=blank(width,height);for(let row=0;row<operation.rows;row++)for(let col=0;col<operation.columns;col++)maskSheet=compositeAt(maskSheet,maskItem,margin+col*(itemW+spacing),margin+row*(itemH+spacing));foregroundMask=maskSheet;}current=sheet;original=cloneRaster(sheet);dpi=operation.dpi;break;
   }
  }
  assertRaster(current);checkDimensions(current.width,current.height,limits.max_pixels);
 }
 if(recipe.output.format==='jpeg'&&!opaque(current))throw new SuperasterError('INVALID_RECIPE','JPEG output requires an explicit opaque background composition');
 let mask:Uint8Array|undefined;if(hasMask)mask=await kernel.encode(maskRaster(foregroundMask??current),{format:'png',metadata:'strip'});
 const settings:EncodeOptions={format:recipe.output.format,quality:recipe.output.quality??90,metadata:recipe.output.metadata??'strip',dpi,source:input};let actualQuality=settings.quality;
 let bytes=await stage('encode',()=>kernel.encode(current,settings));
 if(recipe.output.max_bytes&&bytes.length>recipe.output.max_bytes){
  if(recipe.output.format==='png')throw new SuperasterError('CONSTRAINT_UNSATISFIABLE','Lossless PNG exceeds byte target at fixed dimensions',{actual_bytes:bytes.length,max_bytes:recipe.output.max_bytes});
  let low=1,high=(settings.quality??90)-1;let best:Uint8Array|undefined,bestQ:number|undefined;
  while(low<=high){cancelled(signal);const q=Math.floor((low+high)/2),candidate=await stage('encode',()=>kernel.encode(current,{...settings,quality:q}));if(candidate.length<=recipe.output.max_bytes){best=candidate;bestQ=q;low=q+1;}else high=q-1;}
  if(!best)throw new SuperasterError('CONSTRAINT_UNSATISFIABLE','Byte target cannot be met within the permitted format and geometry',{max_bytes:recipe.output.max_bytes});bytes=best;actualQuality=bestQ;
 }
 const output=await stage('validate',()=>kernel.inspect(bytes));if(output.width!==current.width||output.height!==current.height||output.format!==recipe.output.format)throw new SuperasterError('PROCESSING_FAILED','Encoder output does not match requested image properties');
 if(recipe.output.max_bytes&&bytes.length>recipe.output.max_bytes)throw new SuperasterError('CONSTRAINT_UNSATISFIABLE','Encoded output exceeds requested byte target');
 cancelled(signal);const record:ExecutionRecord={contract_version:'1.0',implementation_version:'0.1.0-alpha.1',input_hash:await sha256(input),recipe_hash:await recipeHash(recipe,bindingHashes),binding_hashes:bindingHashes,resolved_recipe:recipe,engine,encoder:{format:settings.format,quality:actualQuality,metadata:settings.metadata,dpi,kernel:'declared imaging adapter'},applied_operations:recipe.operations,output:{...output,hash:await sha256(bytes)},timings_ms:timings,warnings,rules:[],...(recipe.preset?{preset:recipe.preset}:{})};
 options.onProgress?.({stage:'complete',message:'Export complete'});return {bytes,record,...(mask?{mask}:{})};
}
