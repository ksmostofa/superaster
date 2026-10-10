import { SuperasterError, type ImageInfo, type Recipe } from '../../contract/src/index.js';
import { cancelled } from '../../core/src/index.js';
export interface Raster {width:number;height:number;data:Uint8Array}
export type KernelName='nearest'|'lanczos3'|'linear';
export interface EncodeOptions {format:Recipe['output']['format'];quality?:number;metadata?:'strip'|'preserve';dpi?:number;source?:Uint8Array;grayscale?:boolean}
export interface ImagingKernel {
 inspect(bytes:Uint8Array):Promise<ImageInfo>;
 decode(bytes:Uint8Array):Promise<Raster>;
 resize(raster:Raster,width:number,height:number,kernel:KernelName):Promise<Raster>;
 rotate(raster:Raster,angle:number,background:string):Promise<Raster>;
 encode(raster:Raster,options:EncodeOptions):Promise<Uint8Array>;
}
/** Physical density declared in the encoded file, never a decoder's implicit default.
 * PNG pHYs: W3C PNG3 §11.3.4.3; JPEG APP0: JFIF1.02; EXIF uses TIFF IFD0
 * X/YResolution and ResolutionUnit. Reads are bounded, no recursive IFD traversal.
 * Codecs validate image/container integrity separately before calling this helper.
 */
export function readDeclaredDensity(bytes:Uint8Array,format:string):number|undefined {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const name=(offset:number,length:number)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
 const dpi=(value:number)=>Number.isFinite(value)&&value>0&&Math.round(value)>0?Math.round(value):undefined;
 const exif=(data:Uint8Array):number|undefined=>{
  if(data.length>=6&&String.fromCharCode(...data.subarray(0,6))==='Exif\0\0')data=data.subarray(6);
  if(data.length<8)return undefined;const v=new DataView(data.buffer,data.byteOffset,data.byteLength),little=data[0]===73&&data[1]===73;
  if(!little&&!(data[0]===77&&data[1]===77)||v.getUint16(2,little)!==42)return undefined;
  const offset=v.getUint32(4,little);if(offset+2>data.length)return undefined;const count=v.getUint16(offset,little);if(offset+2+count*12+4>data.length)return undefined;
  let x:number|undefined,y:number|undefined,unit:number|undefined;
  for(let i=0;i<count;i++){const entry=offset+2+i*12,tag=v.getUint16(entry,little),type=v.getUint16(entry+2,little),items=v.getUint32(entry+4,little);
   if(tag===296&&type===3&&items===1)unit=v.getUint16(entry+8,little);
   if((tag===282||tag===283)&&type===5&&items===1){const position=v.getUint32(entry+8,little);if(position+8>data.length)continue;const denominator=v.getUint32(position+4,little);if(!denominator)continue;const value=v.getUint32(position,little)/denominator;if(tag===282)x=value;else y=value;}
  }
  return x&&y&&(unit===2||unit===3)?dpi(x*(unit===3?2.54:1)):undefined;
 };
 if(format==='png'){
  if(bytes.length<8||name(0,8)!=='\x89PNG\r\n\x1a\n')return undefined;let exifDensity:number|undefined;
  for(let offset=8;offset+12<=bytes.length;){const size=view.getUint32(offset);if(offset+12+size>bytes.length)return undefined;const type=name(offset+4,4);
   if(type==='pHYs'&&size===9&&bytes[offset+16]===1){const value=dpi(view.getUint32(offset+8)*.0254);if(value)return value;}
   if(type==='eXIf')exifDensity=exif(bytes.subarray(offset+8,offset+8+size));offset+=size+12;
  }return exifDensity;
 }
 if(format==='jpeg'){
  if(bytes[0]!==255||bytes[1]!==216)return undefined;let jfifDensity:number|undefined;
  for(let offset=2;offset+2<=bytes.length;){if(bytes[offset++]!==255)return undefined;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)break;if(marker===1||marker!==undefined&&marker>=208&&marker<=215)continue;
   if(offset+2>bytes.length)return undefined;const size=view.getUint16(offset);if(size<2||offset+size>bytes.length)return undefined;const payload=offset+2;
   if(marker===225&&size>=16&&name(payload,6)==='Exif\0\0'){const value=exif(bytes.subarray(payload,offset+size));if(value)return value;}
   if(marker===224&&size>=16&&name(payload,5)==='JFIF\0'){const unit=bytes[payload+7],x=view.getUint16(payload+8),y=view.getUint16(payload+10);if(x&&y&&(unit===1||unit===2))jfifDensity=dpi(x*(unit===2?2.54:1));}
   offset+=size;
  }return jfifDensity;
 }
 if(format==='webp'){
  if(bytes.length<12||name(0,4)!=='RIFF'||name(8,4)!=='WEBP')return undefined;const end=view.getUint32(4,true)+8;if(end>bytes.length)return undefined;
  for(let offset=12;offset+8<=end;){const size=view.getUint32(offset+4,true);if(offset+8+size>end)return undefined;if(name(offset,4)==='EXIF')return exif(bytes.subarray(offset+8,offset+8+size));offset+=8+size+(size%2);}
 }
 return undefined;
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
/** Recover captured opaque-source edges. Existing transparent-source RGB is unassociated and must not be unblended. */
export function cleanEdgeRgb(source:Raster,cutout:Raster,signal?:AbortSignal):{raster:Raster;changed:number} {
 assertRaster(source);assertRaster(cutout);if(source.width!==cutout.width||source.height!==cutout.height)throw new SuperasterError('PROCESSING_FAILED','Edge cleanup source dimensions differ');
 const out=cloneRaster(cutout);let changed=0;const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
 for(let y=0;y<out.height;y++){if(y%32===0)cancelled(signal);for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4,a=cutout.data[i+3]!/255;if(source.data[i+3]!==255||a<.05||a>=.995)continue;let sum=[0,0,0],count=0;
  for(const radius of [1,2,4,8,16]){for(const [dx,dy] of directions){const xx=x+dx!*radius,yy=y+dy!*radius;if(xx<0||yy<0||xx>=out.width||yy>=out.height)continue;const j=(yy*out.width+xx)*4;if(source.data[j+3]!==255||cutout.data[j+3]!>8)continue;for(let c=0;c<3;c++)sum[c]=sum[c]!+source.data[j+c]!;count++;}if(count)break;}
  if(!count)continue;for(let c=0;c<3;c++)out.data[i+c]=Math.max(0,Math.min(255,Math.round((source.data[i+c]!-(1-a)*sum[c]!/count)/a)));if(out.data[i]!==cutout.data[i]||out.data[i+1]!==cutout.data[i+1]||out.data[i+2]!==cutout.data[i+2])changed++;
 }}return {raster:out,changed};
}
