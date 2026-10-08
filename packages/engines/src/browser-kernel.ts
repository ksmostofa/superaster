import type Vips from 'wasm-vips';
import { SuperasterError, type ImageInfo } from '../../contract/src/index.js';
import type { Raster, ImagingKernel } from './raster.js';

type VipsModule = Awaited<ReturnType<typeof Vips>>;
let modulePromise:Promise<VipsModule>|undefined;
export async function vipsModule():Promise<VipsModule> {
 if(!globalThis.crossOriginIsolated)throw new SuperasterError('UNSUPPORTED','Image processing requires cross-origin isolation; serve the documented COOP/COEP headers');
 modulePromise??=(async()=>{
  const {default:factory}=await import(/* @vite-ignore */ new URL('/runtime/vips-es6.js',globalThis.location.href).href) as {default:typeof Vips};
  return factory({dynamicLibraries:[],locateFile:(file:string)=>'/runtime/'+file,printErr:(message:string)=>console.warn(message)});
 })();
 try{return await modulePromise;}catch(error){modulePromise=undefined;throw error;}
}
function fileFormat(bytes:Uint8Array) {
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'jpeg';
 if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'png';
 if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'webp';
 throw new SuperasterError('UNSUPPORTED','Use a single-frame JPEG, PNG or WebP image');
}
function checkBounds(width:number,height:number) {if(width<1||height<1||width>16384||height>16384||width*height>8_000_000)throw new SuperasterError('LIMIT_EXCEEDED','Browser image limit is 8 million pixels and 16,384 pixels per side');}
function load(vips:VipsModule,bytes:Uint8Array) {
 if(bytes.byteLength>64*1024*1024)throw new SuperasterError('LIMIT_EXCEEDED','Input exceeds 64 MiB');
 fileFormat(bytes);let image:Vips.Image;
 try {image=vips.Image.newFromBuffer(bytes,'',{fail_on:'error'});}catch(error){throw new SuperasterError('INVALID_INPUT',error instanceof Error?error.message:'Image cannot be decoded');}
 try{checkBounds(image.width,image.height);if(image.getTypeof('n-pages')&&image.getInt('n-pages')!==1)throw new SuperasterError('UNSUPPORTED','Animated/multiple-frame images are unsupported');return image;}catch(error){image.delete();throw error;}
}
function rawRaster(image:Vips.Image):Raster {
 const memory=image.writeToMemory();const data=Uint8Array.from(new Uint8Array(memory.buffer,memory.byteOffset,memory.byteLength));
 if(image.bands!==4||data.length!==image.width*image.height*4)throw new SuperasterError('PROCESSING_FAILED','Unexpected RGBA kernel layout');
 return{width:image.width,height:image.height,data};
}
function fromRaster(vips:VipsModule,raster:Raster) {
 const raw=vips.Image.newFromMemory(raster.data,raster.width,raster.height,4,vips.BandFormat.uchar);
 try{return raw.copy({interpretation:'srgb'});}finally{raw.delete();}
}
export class BrowserKernel implements ImagingKernel {
 constructor(private readonly loadModule:()=>Promise<VipsModule>=vipsModule) {}
 async inspect(bytes:Uint8Array):Promise<ImageInfo> {
  const vips=await this.loadModule(),image=load(vips,bytes);
  try {
   const hasAlpha=image.hasAlpha(),metadata={icc:!!image.getTypeof('icc-profile-data'),exif:!!image.getTypeof('exif-data'),density:Math.round(image.xres*25.4)};
   const raster=hasAlpha?await this.decode(bytes):undefined;
   let opaque=true;if(raster)for(let i=3;i<raster.data.length;i+=4)if(raster.data[i]!==255){opaque=false;break;}
   return {width:image.width,height:image.height,format:fileFormat(bytes),channels:image.bands,has_alpha:hasAlpha,is_opaque:opaque,bytes:bytes.length,orientation:image.getTypeof('orientation')?image.getInt('orientation'):undefined,color_space:image.interpretation,pages:1,metadata};
  }finally{image.delete();}
 }
 async decode(bytes:Uint8Array):Promise<Raster> {
  const vips=await this.loadModule(),objects:Vips.Image[]=[];const keep=(im:Vips.Image)=>{objects.push(im);return im;};
  try {
   let image=keep(load(vips,bytes));image=keep(image.autorot());
   if(image.getTypeof('icc-profile-data'))image=keep(image.iccTransform('srgb',{embedded:true}));
   image=keep(image.colourspace('srgb'));if(!image.hasAlpha())image=keep(image.addalpha());image=keep(image.cast('uchar'));return rawRaster(image);
  }finally{objects.reverse().forEach(im=>im.delete());}
 }
 async resize(raster:Raster,width:number,height:number,kernel:'nearest'|'lanczos3'|'linear'):Promise<Raster> {
  checkBounds(width,height);const vips=await this.loadModule(),image=fromRaster(vips,raster);let resized:Vips.Image|undefined;
  try {resized=image.resize(width/raster.width,{vscale:height/raster.height,kernel});return rawRaster(resized);}finally{resized?.delete();image.delete();}
 }
 async rotate(raster:Raster,angle:number,background:string):Promise<Raster> {
  const vips=await this.loadModule(),image=fromRaster(vips,raster);let output:Vips.Image|undefined;
  const color=background.replace('#',''),values=[0,2,4,6].map((pos,i)=>i===3&&color.length===6?0:parseInt(color.slice(pos,pos+2),16));
  try {output=image.rotate(angle,{background:values});checkBounds(output.width,output.height);return rawRaster(output);}finally{output?.delete();image.delete();}
 }
 async encode(raster:Raster,options:{format:'png'|'jpeg'|'webp';quality?:number;metadata?:'strip'|'preserve';dpi?:number;source?:Uint8Array}):Promise<Uint8Array> {
  const vips=await this.loadModule(),objects:Vips.Image[]=[];const keep=(image:Vips.Image)=>{objects.push(image);return image;};
  try {
   let target=keep(fromRaster(vips,raster));
   if(options.metadata==='preserve'){
    if(!options.source)throw new SuperasterError('INVALID_INPUT','Metadata preservation requires the original source');
    let base=keep(load(vips,options.source));base=keep(base.autorot());base=keep(base.colourspace('srgb'));if(!base.hasAlpha())base=keep(base.addalpha());base=keep(base.resize(raster.width/base.width,{vscale:raster.height/base.height,kernel:'nearest'}));target=keep(base.composite2(target,'source'));target.setInt('orientation',1);
    if(target.getTypeof('exif-ifd0-Orientation'))target.setString('exif-ifd0-Orientation','1');
   }
   target=keep(target.copy({xres:(options.dpi??72)/25.4,yres:(options.dpi??72)/25.4}));
   const settings:Record<string,unknown>={keep:options.metadata==='preserve'?31:0,profile:'srgb'};if(options.format!=='png')settings.Q=options.quality??90;
   const bytes=target.writeToBuffer(options.format==='jpeg'?'.jpg':'.'+options.format,settings);return Uint8Array.from(bytes);
  }finally{objects.reverse().forEach(image=>image.delete());}
 }
}
