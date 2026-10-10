import { describe,it,expect } from 'vitest';
import { MODELS,modelAlpha,modelInput } from '../packages/engines/src/models.js';
import { blank } from '../packages/engines/src/raster.js';
describe('audited model tensor contracts',()=>{
 it('keeps BEN2 unit normalization distinct from BiRefNet ImageNet normalization',()=>{
  const raster=blank(1,1,'#ffffff'),ben={...MODELS.find(model=>model.id==='ben2-base-1024')!,width:1,height:1},biref={...MODELS[0]!,width:1,height:1};
  expect([...modelInput(raster,ben)]).toEqual([1,1,1]);expect(modelInput(raster,biref)[0]).toBeCloseTo((1-.485)/.229,6);
 });
 it('decodes known float16 coverage without applying a second sigmoid',()=>{
  const model={...MODELS.find(model=>model.id==='ben2-base-1024')!,width:3,height:1};
  expect([...modelAlpha(Uint16Array.from([0,0x3800,0x3c00]),model)]).toEqual([0,.5,1]);
  expect(()=>modelAlpha(Uint16Array.from([0,0x7c00,0x3c00]),model)).toThrow('nonfinite');
  expect(()=>modelAlpha(Uint16Array.from([0,0x4000,0x3c00]),model)).toThrow('outside');
 });
 it('treats BiRefNet output as logits and rejects mismatched/nonfinite vectors',()=>{
  const model={...MODELS[0]!,width:1,height:1};expect([...modelAlpha(Float32Array.from([0]),model)]).toEqual([.5]);
  expect(()=>modelAlpha(Float32Array.from([NaN]),model)).toThrow('nonfinite');expect(()=>modelAlpha([],model)).toThrow('length');
 });
});
