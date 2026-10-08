import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {NativeEngine,NativeImagingKernel} from '../packages/engines/src/native.js';
import {Processor} from '../packages/core/src/index.js';
import {bilinearAlpha,cleanEdgeRgb,maskRaster,blank,assertRaster} from '../packages/engines/src/raster.js';
import {executePipeline} from '../packages/engines/src/pipeline.js';
import {parseRecipe,type Operation,type Recipe} from '../packages/contract/src/index.js';
const kernel=new NativeImagingKernel();
const recipe=(operations:Operation[],output:Recipe['output']={format:'png'}):Recipe=>parseRecipe({spec_version:'1.0',input:{ref:'fixture'},operations,output});
async function rgba(width:number,height:number,pixels:number[]):Promise<Uint8Array>{return new Uint8Array(await sharp(Buffer.from(pixels),{raw:{width,height,channels:4}}).png().toBuffer());}
async function decode(bytes:Uint8Array){return kernel.decode(bytes);}
async function run(input:Uint8Array,operations:Operation[],output:Recipe['output']={format:'png'}){const processor=new Processor(new NativeEngine());try{return await processor.transform(input,recipe(operations,output));}finally{await processor.dispose();}}

describe('native observable processing contracts',()=>{
 it('contain canvas preserves proportions and writes exact opaque pixels',async()=>{
  const input=await rgba(2,1,[255,0,0,255,0,0,255,255]);const result=await run(input,[{op:'canvas',width:4,height:4,fit:'contain',background:'#ffffff'}]);const output=await decode(result.bytes);expect([output.width,output.height]).toEqual([4,4]);expect([...output.data.subarray(0,4)]).toEqual([255,255,255,255]);expect(output.data[4*4+3]).toBe(255);expect(result.record.output.has_alpha).toBe(true);expect((await kernel.inspect(result.bytes)).is_opaque).toBe(true);
 });
 it('two-bound contain resize pads to exact requested dimensions',async()=>{
  const input=await rgba(3,2,Array(6).fill([255,0,0,255]).flat());const result=await run(input,[{op:'resize',width:6,height:6,fit:'contain',allow_upscale:true,resampling:'nearest'}]);const output=await decode(result.bytes);expect([output.width,output.height]).toEqual([6,6]);expect(output.data[3]).toBe(0);expect([...output.data.subarray((1*6)*4,(1*6)*4+4)]).toEqual([255,0,0,255]);expect(output.data[(5*6)*4+3]).toBe(0);
 });
 it('flip and crop use current integer coordinates',async()=>{
  const input=await rgba(3,1,[255,0,0,255,0,255,0,255,0,0,255,255]);const result=await run(input,[{op:'flip',axis:'horizontal'},{op:'crop',x:0,y:0,width:1,height:1}]);expect([...(await decode(result.bytes)).data]).toEqual([0,0,255,255]);
 });
 it('rejects unauthorized upscaling and out-of-bounds crops',async()=>{
  const input=await rgba(1,1,[1,2,3,255]);await expect(run(input,[{op:'resize',width:2}])).rejects.toMatchObject({code:'INVALID_RECIPE'});await expect(run(input,[{op:'crop',x:1,y:0,width:1,height:1}])).rejects.toMatchObject({code:'INVALID_RECIPE'});
 });
 it('JPEG requires explicit opaque composition',async()=>{
  const input=await rgba(1,1,[255,0,0,64]);await expect(run(input,[],{format:'jpeg'})).rejects.toMatchObject({code:'INVALID_RECIPE'});const result=await run(input,[{op:'composite',background:'#ffffff'}],{format:'jpeg'});expect(result.record.output.format).toBe('jpeg');expect(result.record.output.has_alpha).toBe(false);
 });
 it('byte constraints inspect actual encoded bytes and fail impossible geometry',async()=>{
  const input=await rgba(20,20,Array.from({length:1600},(_,i)=>i%4===3?255:(i*37)%256));const normal=await run(input,[],{format:'jpeg',quality:95});const target=normal.bytes.length-30;const result=await run(input,[],{format:'jpeg',quality:95,max_bytes:target});expect(result.bytes.length).toBeLessThanOrEqual(target);expect([result.record.output.width,result.record.output.height]).toEqual([20,20]);await expect(run(input,[],{format:'jpeg',max_bytes:1})).rejects.toMatchObject({code:'CONSTRAINT_UNSATISFIABLE'});await expect(run(input,[],{format:'png',max_bytes:1})).rejects.toMatchObject({code:'CONSTRAINT_UNSATISFIABLE'});
 });
 it('EXIF orientation is applied exactly once and export strips source metadata',async()=>{
  const input=new Uint8Array(await sharp({create:{width:2,height:3,channels:3,background:'#ff0000'}}).jpeg().withMetadata({orientation:6}).toBuffer());const before=await kernel.inspect(input);expect(before.orientation).toBe(6);const first=await run(input,[{op:'normalize',color_space:'srgb'}]);expect([first.record.output.width,first.record.output.height]).toEqual([3,2]);expect(first.record.output.orientation).toBeUndefined();expect(first.record.output.metadata.exif).toBe(false);expect(first.record.output.metadata.icc).toBe(true);const second=await run(first.bytes,[{op:'normalize',color_space:'srgb'}]);expect([second.record.output.width,second.record.output.height]).toEqual([3,2]);
 });
 it('orientation transforms known pixels once, including nonuniform EXIF PNG',async()=>{
  const input=new Uint8Array(await sharp(Buffer.from([255,0,0,0,255,0,0,0,255,255,255,0,255,0,255,0,255,255]),{raw:{width:2,height:3,channels:3}}).png().withMetadata({orientation:6}).toBuffer());const result=await run(input,[{op:'normalize',color_space:'srgb'}]);const normalized=await decode(result.bytes);expect([normalized.width,normalized.height]).toEqual([3,2]);expect([...normalized.data]).toEqual([255,0,255,255,0,0,255,255,255,0,0,255,0,255,255,255,255,255,0,255,0,255,0,255]);const again=await run(result.bytes,[]);expect([...(await decode(again.bytes)).data]).toEqual([...normalized.data]);
 });
 it('print sheet records density and fixed placements',async()=>{
  const input=await rgba(1,1,[255,0,0,255]);const result=await run(input,[{op:'print_sheet',sheet_width_mm:25.4,sheet_height_mm:25.4,item_width_mm:5.08,item_height_mm:5.08,dpi:100,rows:2,columns:2,margin_mm:2.54,spacing_mm:2.54}]);const output=await decode(result.bytes);expect([output.width,output.height]).toEqual([100,100]);expect(result.record.output.metadata.density).toBe(100);expect([...output.data.subarray((10*100+10)*4,(10*100+10)*4+4)]).toEqual([255,0,0,255]);expect([...output.data.subarray(0,4)]).toEqual([255,255,255,255]);
 });
 it('cancellation and unsupported requests produce explicit errors',async()=>{
  const input=await rgba(1,1,[1,2,3,255]);const processor=new Processor(new NativeEngine());const controller=new AbortController();controller.abort();await expect(processor.transform(input,recipe([]),{signal:controller.signal})).rejects.toMatchObject({code:'CANCELLED'});await expect(processor.transform(new Uint8Array([1,2,3]),recipe([]))).rejects.toMatchObject({code:'INVALID_INPUT'});await processor.dispose();
 });
 it('explicit preserve keeps EXIF and XMP while normalizing orientation and output pixels',async()=>{
  const input=new Uint8Array(await sharp({create:{width:2,height:3,channels:3,background:'#ff0000'}}).jpeg().withMetadata({orientation:6}).withExifMerge({IFD0:{Artist:'fixture rights holder'}}).withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">fixture</x:xmpmeta>').toBuffer());
  for(const format of ['png','jpeg','webp'] as const){const result=await run(input,[{op:'canvas',width:6,height:4,background:'#ffffff'}],{format,metadata:'preserve',quality:100});const metadata=await sharp(result.bytes).metadata();expect([metadata.width,metadata.height,metadata.orientation]).toEqual([6,4,1]);expect(metadata.exif?.includes('fixture rights holder')).toBe(true);expect(metadata.xmp?.toString()).toContain('fixture');expect(metadata.icc).toBeDefined();const pixels=await decode(result.bytes);expect(pixels.data[0]).toBeGreaterThanOrEqual(250);expect(pixels.data[1]).toBeLessThanOrEqual(5);expect(pixels.data[2]).toBeLessThanOrEqual(5);}
 });
 it('erase and restore use original source, grayscale mask remains one channel',async()=>{
  const input=await rgba(2,1,[200,20,30,255,40,50,220,255]);const result=await run(input,[{op:'correct',regions:[{x:0,y:0,width:2,height:1,mode:'erase'},{x:0,y:0,width:1,height:1,mode:'restore'}]}]);expect([...(await decode(result.bytes)).data]).toEqual([200,20,30,255,40,50,220,0]);expect(result.mask).toBeDefined();const maskInfo=await kernel.inspect(result.mask!);expect(maskInfo.channels).toBe(1);const mask=await decode(result.mask!);expect([...mask.data]).toEqual([255,255,255,255,0,0,0,255]);
 });
 it('binding content changes recipe identity and preflight rejects missing refs before inference',async()=>{
  const input=await rgba(1,1,[200,20,30,255]);const one=await rgba(1,1,[128,128,128,255]),two=await rgba(1,1,[64,64,64,255]);const r=recipe([{op:'correct',mask_ref:'m'}]);const infer=async()=>{throw new Error('Fixture must not call inference');};const a=await executePipeline(input,r,{kernel,bindings:{m:one},infer}),b=await executePipeline(input,r,{kernel,bindings:{m:two},infer});expect(a.record.recipe_hash).not.toBe(b.record.recipe_hash);expect(a.record.binding_hashes?.m).toBeDefined();await expect(executePipeline(input,recipe([{op:'remove_background'},{op:'correct',mask_ref:'missing'}]),{kernel,infer})).rejects.toMatchObject({code:'INVALID_INPUT'});
 });
 it('foreground mask remains coverage after an opaque composition',async()=>{
  const input=await rgba(2,1,[200,20,30,255,40,50,220,255]);const result=await run(input,[{op:'correct',regions:[{x:1,y:0,width:1,height:1,mode:'erase'}]},{op:'composite',background:'#ffffff'}]);expect((await kernel.inspect(result.bytes)).is_opaque).toBe(true);expect([...((await decode(result.mask!)).data)]).toEqual([255,255,255,255,0,0,0,255]);const direct=await run(input,[{op:'correct',regions:[{x:1,y:0,width:1,height:1,mode:'erase'}]},{op:'canvas',width:4,height:2,background:'#ffffff'},{op:'mask'}]);const pixels=await decode(direct.bytes);expect(pixels.data[0]).toBe(255);expect(pixels.data[12]).toBe(0);
 });
 it('increased programmatic coverage restores original RGB after edge recovery',async()=>{
  // This deterministic unit fixture substitutes known alpha only inside the test; production infer remains ORT.
  const input=await rgba(3,1,[255,255,255,255,255,128,128,255,255,0,0,255]);const coverage=await rgba(3,1,[0,0,0,255,255,255,255,255,255,255,255,255]);
  const infer=async()=>({alpha:new Float32Array([0,.5,1]),width:3,height:1,engine:{id:'test-fixture',version:'1',model_hash:null,precision:'float32',inference_dimensions:[3,1],runtime:'deterministic unit fixture',backend:'test',refinement:'none'}});
  const result=await executePipeline(input,recipe([{op:'remove_background',edge_cleanup:'auto'},{op:'correct',mask_ref:'coverage'}]),{kernel,bindings:{coverage},infer});const output=await decode(result.bytes);expect([...output.data.subarray(4,8)]).toEqual([255,128,128,255]);expect(result.record.warnings[0]).toContain('changed 1 soft-edge pixels');
 });
 it('programmatic mask coverage and region restoration compose with the same source',async()=>{
  const input=await rgba(2,1,[200,20,30,255,40,50,220,255]);const mask=await rgba(2,1,[128,128,128,255,0,0,0,255]);const result=await executePipeline(input,recipe([{op:'correct',mask_ref:'m',regions:[{x:1,y:0,width:1,height:1,mode:'restore'}]}]),{kernel,bindings:{m:mask},infer:async()=>{throw new Error('Fixture must not call inference');}});expect([...(await decode(result.bytes)).data]).toEqual([200,20,30,128,40,50,220,255]);
 });
});
describe('shared alpha and boundary RGB fixtures',()=>{
 it('uses half-pixel bilinear alpha with clamped edges',()=>{expect([...bilinearAlpha(new Float32Array([0,1]),2,1,4,1)]).toEqual([0,.25,.75,1]);expect(()=>bilinearAlpha(new Float32Array([0]),2,1,4,1)).toThrow();});
 it('recovers a known composited edge without changing opaque foreground',()=>{
  const source={width:3,height:1,data:new Uint8Array([255,255,255,255,255,128,128,255,255,0,0,255])};const cutout={...source,data:new Uint8Array([255,255,255,0,255,128,128,128,255,0,0,255])};const result=cleanEdgeRgb(source,cutout);expect(result.changed).toBe(1);expect([...result.raster.data.subarray(4,8)]).toEqual([255,2,2,128]);expect([...result.raster.data.subarray(8,12)]).toEqual([255,0,0,255]);
 });
 it('rejects malformed RGBA buffers and retains explicit grayscale coverage',()=>{expect(()=>assertRaster({width:2,height:2,data:new Uint8Array(12)})).toThrow();const raster=blank(1,1);raster.data[3]=127;expect([...maskRaster(raster).data]).toEqual([127,127,127,255]);});
});
