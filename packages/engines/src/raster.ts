import { SuperasterError, type ImageInfo, type Recipe } from '../../contract/src/index.js';
import { cancelled } from '../../core/src/index.js';
export interface Raster {width:number;height:number;data:Uint8Array}
export type KernelName='nearest'|'lanczos3'|'linear';
export interface EncodeOptions {format:Recipe['output']['format'];quality?:number;metadata?:'strip'|'preserve';dpi?:number;source?:Uint8Array}
export interface ImagingKernel {
 inspect(bytes:Uint8Array):Promise<ImageInfo>;
 decode(bytes:Uint8Array):Promise<Raster>;
 resize(raster:Raster,width:number,height:number,kernel:KernelName):Promise<Raster>;
 rotate(raster:Raster,angle:number,background:string):Promise<Raster>;
 encode(raster:Raster,options:EncodeOptions):Promise<Uint8Array>;
}
export const DEFAULT_LIMITS={max_pixels:16777216,max_bytes:40000000,max_concurrency:1} as const;
export function checkDimensions(width:number,height:number,maxPixels:number=DEFAULT_LIMITS.max_pixels):void {
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new SuperasterError('INVALID_INPUT','Invalid raster dimensions');
 if(width*height>maxPixels)throw new SuperasterError('LIMIT_EXCEEDED',`Decoded image exceeds ${maxPixels} pixels`,{width,height,max_pixels:maxPixels});
}
export function assertRaster(raster:Raster):void {checkDimensions(raster.width,raster.height);if(raster.data.length!==raster.width*raster.height*4)throw new SuperasterError('PROCESSING_FAILED','RGBA buffer length does not match dimensions');}
export function colorBytes(color='#00000000'):[number,number,number,number] {return [parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16),color.length===9?parseInt(color.slice(7,9),16):255];}
export function blank(width:number,height:number,color='#00000000'):Raster {checkDimensions(width,height);const data=new Uint8Array(width*height*4);const c=colorBytes(color);for(let i=0;i<data.length;i+=4)data.set(c,i);return {width,height,data};}
export function cloneRaster(raster:Raster):Raster {return {...raster,data:raster.data.slice()};}
export function cropRaster(raster:Raster,x:number,y:number,width:number,height:number):Raster {
 assertRaster(raster);checkDimensions(width,height);if(x<0||y<0||x+width>raster.width||y+height>raster.height)throw new SuperasterError('INVALID_RECIPE','Crop rectangle exceeds current image');
 const out=blank(width,height);for(let row=0;row<height;row++){const start=((row+y)*raster.width+x)*4;out.data.set(raster.data.subarray(start,start+width*4),row*width*4);}return out;
}
export function flipRaster(raster:Raster,axis:'horizontal'|'vertical'):Raster {assertRaster(raster);const out=blank(raster.width,raster.height);for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++){const sx=axis==='horizontal'?raster.width-1-x:x,sy=axis==='vertical'?raster.height-1-y:y;const offset=(sy*raster.width+sx)*4;out.data.set(raster.data.subarray(offset,offset+4),(y*raster.width+x)*4);}return out;}
export function compositeAt(background:Raster,foreground:Raster,left:number,top:number):Raster {
 assertRaster(background);assertRaster(foreground);const out=cloneRaster(background);
 for(let y=0;y<foreground.height;y++){const dy=top+y;if(dy<0||dy>=out.height)continue;for(let x=0;x<foreground.width;x++){const dx=left+x;if(dx<0||dx>=out.width)continue;const f=(y*foreground.width+x)*4,b=(dy*out.width+dx)*4;const fa=foreground.data[f+3]!/255,ba=out.data[b+3]!/255,a=fa+ba*(1-fa);for(let c=0;c<3;c++)out.data[b+c]=a?Math.round((foreground.data[f+c]!*fa+out.data[b+c]!*ba*(1-fa))/a):0;out.data[b+3]=Math.round(a*255);}}
 return out;
}
export function bilinearAlpha(alpha:Float32Array,width:number,height:number,outWidth:number,outHeight:number,signal?:AbortSignal):Float32Array {
 if(alpha.length!==width*height)throw new SuperasterError('PROCESSING_FAILED','Model alpha shape does not match its buffer');checkDimensions(outWidth,outHeight);
 const out=new Float32Array(outWidth*outHeight);
 for(let y=0;y<outHeight;y++){if(y%32===0)cancelled(signal);const sy=Math.max(0,Math.min(height-1,(y+.5)*height/outHeight-.5)),y0=Math.floor(sy),y1=Math.min(height-1,y0+1),fy=sy-y0;for(let x=0;x<outWidth;x++){const sx=Math.max(0,Math.min(width-1,(x+.5)*width/outWidth-.5)),x0=Math.floor(sx),x1=Math.min(width-1,x0+1),fx=sx-x0;const value=(alpha[y0*width+x0]!*(1-fx)+alpha[y0*width+x1]!*fx)*(1-fy)+(alpha[y1*width+x0]!*(1-fx)+alpha[y1*width+x1]!*fx)*fy;if(!Number.isFinite(value)||value<0||value>1)throw new SuperasterError('PROCESSING_FAILED','Model alpha must be finite coverage in [0,1]');out[y*outWidth+x]=value;}}
 return out;
}
export function applyAlpha(source:Raster,alpha:Float32Array):Raster {assertRaster(source);if(alpha.length!==source.width*source.height)throw new SuperasterError('PROCESSING_FAILED','Alpha dimensions differ from source');const out=cloneRaster(source);for(let i=0;i<alpha.length;i++)out.data[i*4+3]=Math.round(source.data[i*4+3]!*alpha[i]!);return out;}
export function extractAlpha(raster:Raster):Float32Array {assertRaster(raster);const alpha=new Float32Array(raster.width*raster.height);for(let i=0;i<alpha.length;i++)alpha[i]=raster.data[i*4+3]!/255;return alpha;}
export function maskRaster(raster:Raster):Raster {const out=blank(raster.width,raster.height,'#000000');for(let i=0;i<raster.width*raster.height;i++){const a=raster.data[i*4+3]!;out.data[i*4]=a;out.data[i*4+1]=a;out.data[i*4+2]=a;}return out;}
/** Estimate nearby captured background color, then undo its contribution at soft alpha edges. Opaque pixels are unchanged. */
export function cleanEdgeRgb(source:Raster,cutout:Raster,signal?:AbortSignal):{raster:Raster;changed:number} {
 assertRaster(source);assertRaster(cutout);if(source.width!==cutout.width||source.height!==cutout.height)throw new SuperasterError('PROCESSING_FAILED','Edge cleanup source dimensions differ');
 const out=cloneRaster(cutout);let changed=0;const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
 for(let y=0;y<out.height;y++){if(y%32===0)cancelled(signal);for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4,a=cutout.data[i+3]!/255;if(a<.05||a>=.995)continue;let sum=[0,0,0],count=0;
  for(const radius of [1,2,4,8,16]){for(const [dx,dy] of directions){const xx=x+dx!*radius,yy=y+dy!*radius;if(xx<0||yy<0||xx>=out.width||yy>=out.height)continue;const j=(yy*out.width+xx)*4;if(cutout.data[j+3]!>8)continue;for(let c=0;c<3;c++)sum[c]=sum[c]!+source.data[j+c]!;count++;}if(count)break;}
  if(!count)continue;for(let c=0;c<3;c++)out.data[i+c]=Math.max(0,Math.min(255,Math.round((source.data[i+c]!-(1-a)*sum[c]!/count)/a)));if(out.data[i]!==cutout.data[i]||out.data[i+1]!==cutout.data[i+1]||out.data[i+2]!==cutout.data[i+2])changed++;
 }}return {raster:out,changed};
}
