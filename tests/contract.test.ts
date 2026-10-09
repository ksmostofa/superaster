import { describe,it,expect } from 'vitest';
import { parseRecipe, parseExecutionRecord, SuperasterError } from '../packages/contract/src/index.js';
import { Processor, canonicalJson, recipeHash,plan,type EngineAdapter } from '../packages/core/src/index.js';
const recipe={spec_version:'1.0',input:{ref:'a'},operations:[],output:{format:'png'}};
describe('external recipe boundary',()=>{
  it('rejects explicit unknown engine and backend even without inference',()=>{
    const adapter:EngineAdapter={id:'browser-boundary',capabilities:()=>({operations:[],formats:['png'],engines:[{id:'approved:wasm'},{id:'approved:webgpu'}],limits:{max_pixels:1,max_bytes:1,max_concurrency:1},offline:true}),inspect:async()=>{throw new Error('No I/O expected');},execute:async()=>{throw new Error('No I/O expected');},dispose:async()=>{}};
    expect(()=>plan({...recipe,engine:'unsupported-engine-id'},adapter)).toThrow('unavailable');
    expect(()=>plan({...recipe,engine:'approved:unknown'},adapter)).toThrow('unavailable');
    for(const engine of ['auto','approved','approved:auto','approved:wasm','approved:webgpu'])expect(plan({...recipe,engine},adapter).engine).toBe(engine);
  });
  it('rejects unknown operations and parameters before execution',()=>{
    expect(()=>parseRecipe({...recipe,operations:[{op:'generate'}]})).toThrow(SuperasterError);
    expect(()=>parseRecipe({...recipe,output:{format:'png',silent_resize:true}})).toThrow(SuperasterError);
    expect(()=>parseRecipe({...recipe,operations:[{op:'resize'}]})).toThrow('Resize requires');
  });
  it('requires an explicit composition source',()=>{expect(()=>parseRecipe({...recipe,operations:[{op:'composite'}]})).toThrow('exactly one');});
  it('keeps operation ordering in immutable hashes',async()=>{
    const one=parseRecipe({...recipe,operations:[{op:'flip',axis:'horizontal'},{op:'crop',x:0,y:0,width:2,height:2}]});
    expect(await recipeHash(one)).not.toBe(await recipeHash({...one,operations:[...one.operations].reverse()}));
    expect(canonicalJson({b:2,a:1})).toBe(canonicalJson({a:1,b:2}));
  });
});

describe('execution record boundary',()=>{
 const digest='a'.repeat(64);
 const record={contract_version:'1.0',implementation_version:'test',input_hash:digest,recipe_hash:digest,resolved_recipe:recipe,engine:{id:'imaging-kernel',version:'1',model_hash:null,precision:'uint8',inference_dimensions:[],runtime:'compiled',backend:'cpu',refinement:'none'},encoder:{},applied_operations:[],output:{width:48,height:32,format:'png',channels:4,has_alpha:true,bytes:123,color_space:'srgb',pages:1,metadata:{icc:true,exif:false},hash:digest},timings_ms:{encode:1},warnings:[],rules:[]};
 it('accepts geometry-only records and rejects malformed external provenance',()=>{
  expect(parseExecutionRecord(record).output.width).toBe(48);
  for(const invalid of [{...record,output:{...record.output,width:0}},{...record,recipe_hash:'unverified'},{...record,timings_ms:{encode:NaN}},{...record,resolved_recipe:{...recipe,operations:[{op:'resize'}]}},{...record,extra:true}])expect(()=>parseExecutionRecord(invalid)).toThrow(SuperasterError);
 });
});
