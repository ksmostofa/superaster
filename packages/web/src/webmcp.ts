import { Ajv } from 'ajv';
import { Type, type TSchema } from '@sinclair/typebox';
import { RecipeSchema, parseRecipe, SuperasterError, type Recipe, type ImageInfo } from '../../contract/src/index.js';
import { processingError } from '../../core/src/index.js';
import { resolvePreset, resolvePresetStatus, validate } from '../../catalog/src/index.js';

// Progressive enhancement, current Chrome imperative API (2026-09-21).
// Registrations are page-scoped; input refs name files the user selected here.
interface ModelContext {
 registerTool(tool:{name:string;description:string;inputSchema:TSchema;annotations:{readOnlyHint:boolean;consequentialHint:boolean;untrustedContentHint:boolean};execute:(input:unknown,options:{signal:AbortSignal})=>Promise<string>},options:{signal:AbortSignal}):Promise<void>;
}
interface InputRef {ref:string;name:string;info?:ImageInfo;status:string}
export interface WebTools {
 capabilities:()=>unknown;
 inputs:()=>InputRef[];
 inspect:(ref:string,signal:AbortSignal)=>Promise<ImageInfo>;
 transform:(ref:string,recipe:Recipe,signal:AbortSignal)=>Promise<unknown>;
}
const exact={additionalProperties:false},ref=Type.String({minLength:1}),optionalVersion=Type.Optional(Type.String({minLength:1}));
const { $id: _id, ...inlineRecipe }=RecipeSchema;

export function registerWebTools(actions:()=>WebTools,onError:(message:string)=>void):()=>void {
 const context=(document as Document & {modelContext?:ModelContext}).modelContext;
 if(!context)return()=>{};
 const lifetime=new AbortController(),ajv=new Ajv({strict:true,allErrors:true});
 const register=(name:string,description:string,schema:TSchema,readOnly:boolean,perform:(input:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>|unknown)=>{
  const check=ajv.compile<Record<string,unknown>>(schema);
  void context.registerTool({name:'superaster_'+name,description,inputSchema:schema,annotations:{readOnlyHint:readOnly,consequentialHint:false,untrustedContentHint:true},execute:async(input,{signal})=>{
   try {if(!check(input))throw new SuperasterError('INVALID_INPUT','Tool input does not match its schema',{errors:check.errors});return JSON.stringify(await perform(input,signal));}
   catch(error){return JSON.stringify({error:processingError(error).toJSON()});}
  }},{signal:lifetime.signal}).catch(error=>{if(!lifetime.signal.aborted)onError('WebMCP registration failed: '+processingError(error).message);});
 };
 register('capabilities','Discover this local processor, contract schema and user-selected image refs; no images leave this page',Type.Object({},exact),true,()=>({capabilities:actions().capabilities(),recipe_schema:RecipeSchema,inputs:actions().inputs()}));
 register('inspect','Inspect a user-selected image ref on this page',Type.Object({input_ref:ref},exact),true,(input,signal)=>actions().inspect(String(input.input_ref),signal));
 register('remove','Run the approved local model on a selected image. Model setup may download pinned artifacts; image bytes stay local. Results appear in the ordinary image workspace.',Type.Object({input_ref:ref,quality:Type.Optional(Type.Union([Type.Literal('quality'),Type.Literal('fast')])),engine:Type.Optional(ref)},exact),false,(input,signal)=>actions().transform(String(input.input_ref),parseRecipe({spec_version:'1.0',input:{ref:input.input_ref},quality:input.quality??'quality',engine:input.engine??'auto',operations:[{op:'remove_background',edge_cleanup:'none'}],output:{format:'png',metadata:'strip'}}),signal));
 register('transform','Execute the shared recipe on a selected image; bound images must be selected with ordinary page controls. Returns a local blob URL and compact execution record.',Type.Object({input_ref:ref,recipe:inlineRecipe},exact),false,(input,signal)=>actions().transform(String(input.input_ref),parseRecipe(input.recipe),signal));
 register('batch','Process selected image refs serially with the same shared recipe. Returns per-item results/errors; completed outputs remain in the page.',Type.Object({input_refs:Type.Array(ref,{minItems:1,maxItems:100}),recipe:inlineRecipe},exact),false,async(input,signal)=>{
  const recipe=parseRecipe(input.recipe),results=[];
  for(const selected of input.input_refs as string[]){if(signal.aborted){results.push({input_ref:selected,error:new SuperasterError('CANCELLED','Not scheduled after cancellation').toJSON()});continue;}try{results.push({input_ref:selected,result:await actions().transform(selected,recipe,signal)});}catch(error){results.push({input_ref:selected,error:processingError(error).toJSON()});}}
  return {results};
 });
 register('resolve_preset','Resolve an immutable reviewed destination pin; ambiguous requests require an authority/channel choice before editing',Type.Object({request:ref,version:optionalVersion},exact),true,input=>resolvePresetStatus(String(input.request),input.version as string|undefined));
 register('validate','Check a selected image against the reviewed destination. Visual rules and user confirmations remain separate from file properties.',Type.Object({input_ref:ref,preset:ref,version:optionalVersion},exact),true,async(input,signal)=>{const preset=resolvePreset(String(input.preset),input.version as string|undefined);return {preset:{id:preset.id,version:preset.version},rules:validate(await actions().inspect(String(input.input_ref),signal),preset)};});
 return()=>lifetime.abort();
}
