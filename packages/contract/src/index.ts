import { Type, type Static } from '@sinclair/typebox';
import { Ajv } from 'ajv';

const exact = { additionalProperties: false } as const;
const px = Type.Integer({ minimum: 1, maximum: 16384 });
const coord = Type.Integer({ minimum: 0, maximum: 16384 });
const color = Type.String({ pattern: '^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$' });
const fit = Type.Union([Type.Literal('contain'), Type.Literal('cover'), Type.Literal('fill')]);
const format = Type.Union([Type.Literal('png'), Type.Literal('jpeg'), Type.Literal('webp')]);
const region = Type.Object({ x: coord, y: coord, width: px, height: px, mode: Type.Union([Type.Literal('erase'), Type.Literal('restore')]) }, exact);
export const OperationSchema = Type.Union([
  Type.Object({ op: Type.Literal('remove_background'), edge_cleanup: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('auto')])) }, exact),
  Type.Object({ op: Type.Literal('resize'), width: Type.Optional(px), height: Type.Optional(px), fit: Type.Optional(fit), allow_upscale: Type.Optional(Type.Boolean()), resampling: Type.Optional(Type.Union([Type.Literal('nearest'), Type.Literal('lanczos3')])) }, exact),
  Type.Object({ op: Type.Literal('crop'), x: coord, y: coord, width: px, height: px }, exact),
  Type.Object({ op: Type.Literal('subject_crop'), margin: coord }, exact),
  Type.Object({ op: Type.Literal('canvas'), width: px, height: px, fit: Type.Optional(fit), background: Type.Optional(color), position: Type.Optional(Type.Union([Type.Literal('center'), Type.Literal('top'), Type.Literal('bottom'), Type.Literal('left'), Type.Literal('right')])) }, exact),
  Type.Object({ op: Type.Literal('composite'), background: Type.Optional(color), image_ref: Type.Optional(Type.String({minLength:1})), fit: Type.Optional(fit), position: Type.Optional(Type.Union([Type.Literal('center'), Type.Literal('top'), Type.Literal('bottom'), Type.Literal('left'), Type.Literal('right')])) }, exact),
  Type.Object({ op: Type.Literal('rotate'), angle: Type.Number({minimum:-360, maximum:360}), background: Type.Optional(color) }, exact),
  Type.Object({ op: Type.Literal('flip'), axis: Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')]) }, exact),
  Type.Object({ op: Type.Literal('correct'), regions: Type.Optional(Type.Array(region, { maxItems: 10000 })), mask_ref: Type.Optional(Type.String({minLength:1})) }, exact),
  Type.Object({ op: Type.Literal('mask') }, exact),
  Type.Object({ op: Type.Literal('normalize'), color_space: Type.Literal('srgb') }, exact),
  Type.Object({ op: Type.Literal('print_sheet'), sheet_width_mm: Type.Number({exclusiveMinimum:0, maximum:2000}), sheet_height_mm: Type.Number({exclusiveMinimum:0, maximum:2000}), item_width_mm: Type.Number({exclusiveMinimum:0, maximum:2000}), item_height_mm: Type.Number({exclusiveMinimum:0, maximum:2000}), dpi: Type.Integer({minimum:72,maximum:1200}), rows: Type.Integer({minimum:1,maximum:100}), columns: Type.Integer({minimum:1,maximum:100}), margin_mm: Type.Number({minimum:0,maximum:1000}), spacing_mm: Type.Number({minimum:0,maximum:1000}), background: Type.Optional(color) }, exact)
]);
export const RecipeSchema = Type.Object({
  spec_version: Type.Literal('1.0'), input: Type.Object({ ref: Type.String({minLength:1}) },exact),
  engine: Type.Optional(Type.String({minLength:1})), quality: Type.Optional(Type.Union([Type.Literal('quality'),Type.Literal('fast')])),
  operations: Type.Array(OperationSchema, { maxItems: 100 }),
  output: Type.Object({ format, quality: Type.Optional(Type.Integer({minimum:1,maximum:100})), max_bytes: Type.Optional(Type.Integer({minimum:1,maximum:1000000000})), metadata: Type.Optional(Type.Union([Type.Literal('strip'),Type.Literal('preserve')])), dpi: Type.Optional(Type.Integer({minimum:1,maximum:1200})) }, exact),
  preset: Type.Optional(Type.Object({id:Type.String({minLength:1}),version:Type.String({minLength:1})}, exact))
}, {$id:'https://superaster.local/schema/recipe-1.0.json', ...exact});
export type Operation = Static<typeof OperationSchema>;
export type Recipe = Static<typeof RecipeSchema>;
export const ErrorCodes = ['INVALID_INPUT','INVALID_RECIPE','UNSUPPORTED','MODEL_MISSING','MODEL_INTEGRITY','CANCELLED','LIMIT_EXCEEDED','PROCESSING_FAILED','CONSTRAINT_UNSATISFIABLE','ACCESS_DENIED','AMBIGUOUS_PRESET','PRESET_NOT_FOUND','EDIT_FORBIDDEN'] as const;
export type ErrorCode = typeof ErrorCodes[number];
export class SuperasterError extends Error {
  readonly name = 'SuperasterError';
  constructor(readonly code: ErrorCode, message: string, readonly details: Record<string, unknown> = {}) { super(message); }
  toJSON() { return { code: this.code, message: this.message, details: this.details }; }
}
const ajv = new Ajv({allErrors:true,strict:true});
const checkRecipe = ajv.compile<Recipe>(RecipeSchema);
export function parseRecipe(value: unknown): Recipe {
  if (!checkRecipe(value)) throw new SuperasterError('INVALID_RECIPE', ajv.errorsText(checkRecipe.errors), {errors: checkRecipe.errors});
  for (const op of value.operations) {
    if (op.op==='resize' && !op.width && !op.height) throw new SuperasterError('INVALID_RECIPE','Resize requires width or height');
    if (op.op==='composite' && Number(Boolean(op.background))+Number(Boolean(op.image_ref))!==1) throw new SuperasterError('INVALID_RECIPE','Composite requires exactly one background or image_ref');
    if (op.op==='correct' && !op.regions?.length && !op.mask_ref) throw new SuperasterError('INVALID_RECIPE','Correction requires regions or mask_ref');
  }
  return value;
}
export type Stage = 'download'|'verify'|'decode'|'initialize'|'preprocess'|'inference'|'refine'|'render'|'encode'|'validate'|'complete';
export interface Progress { stage: Stage; completed?: number; total?: number; message?: string }
export interface ImageInfo { width:number; height:number; format:string; channels:number; has_alpha:boolean; is_opaque?:boolean; bytes:number; orientation?:number; color_space:string; pages:number; metadata: {icc:boolean;exif:boolean;density?:number} }
export interface ExecutionRecord { contract_version:'1.0'; implementation_version:string; input_hash:string; recipe_hash:string; resolved_recipe:Recipe; binding_hashes?:Record<string,string>; engine: {id:string;version:string;model_hash:string|null;precision:string;inference_dimensions:number[];runtime:string;backend:string;refinement:string}; encoder:Record<string,unknown>; applied_operations:Operation[]; output: ImageInfo & {hash:string}; timings_ms:Record<string,number>; warnings:string[]; rules:RuleOutcome[]; preset?:{id:string;version:string} }
export type RuleState = 'pass'|'fail'|'needs_review'|'not_checked';
export interface RuleOutcome { id:string; state:RuleState; message:string; source?:string; user_confirmation?:boolean }
export const operationDefinitions = [
  {id:'remove_background',features:['F001','F002','F003','F004'],description:'Continuous foreground alpha from approved local model'},
  {id:'resize',features:['F027'],description:'Exact resampling with explicit upscaling permission'},
  {id:'crop',features:['F028'],description:'Integer rectangle in current oriented pixels'},
  {id:'subject_crop',features:['F029'],description:'Alpha bounds plus explicit pixel margin'},
  {id:'canvas',features:['F030','F031'],description:'Fit and place on exact canvas'},
  {id:'composite',features:['F025','F026'],description:'Explicit solid or supplied background'},
  {id:'rotate',features:['F032'],description:'Clockwise degrees, expanded bounds'},
  {id:'flip',features:['F033'],description:'Horizontal or vertical reflection'},
  {id:'correct',features:['F013','F014','F015'],description:'Erase/restore from normalized original'},
  {id:'mask',features:['F037'],description:'Grayscale foreground coverage'},
  {id:'normalize',features:['F038','F039','F040','F041'],description:'Orient once and convert to sRGB'},
  {id:'print_sheet',features:['F084','F085'],description:'Fixed grid, round mm*dpi/25.4 to nearest pixel'}
] as const;
