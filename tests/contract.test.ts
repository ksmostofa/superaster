import { describe,it,expect } from 'vitest';
import { parseRecipe, SuperasterError } from '../packages/contract/src/index.js';
import { Processor, canonicalJson, recipeHash } from '../packages/core/src/index.js';
const recipe={spec_version:'1.0',input:{ref:'a'},operations:[],output:{format:'png'}};
describe('external recipe boundary',()=>{
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
