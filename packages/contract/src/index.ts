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
const hash=Type.String({pattern:'^[a-f0-9]{64}$'});
export const ImageInfoSchema=Type.Object({width:px,height:px,format:Type.String({minLength:1}),channels:Type.Integer({minimum:1,maximum:16}),has_alpha:Type.Boolean(),is_opaque:Type.Optional(Type.Boolean()),bytes:Type.Integer({minimum:1}),orientation:Type.Optional(Type.Integer({minimum:1,maximum:8})),color_space:Type.String({minLength:1}),pages:Type.Integer({minimum:1}),metadata:Type.Object({icc:Type.Boolean(),exif:Type.Boolean(),density:Type.Optional(Type.Number({exclusiveMinimum:0}))},exact)},exact);
export type ImageInfo=Static<typeof ImageInfoSchema>;
export const ErrorSchema=Type.Object({code:Type.Union(ErrorCodes.map(value=>Type.Literal(value))),message:Type.String(),details:Type.Record(Type.String(),Type.Unknown())},exact);
export const BatchEntrySchema=Type.Object({id:Type.String(),name:Type.String(),input_hash:Type.Union([hash,Type.Literal('')]),recipe_hash:hash,status:Type.Union(['completed','failed','cancelled'].map(value=>Type.Literal(value))),output_hash:Type.Optional(hash),error:Type.Optional(ErrorSchema)},exact);
export const FileBatchManifestSchema=Type.Object({version:Type.Literal('1.0'),recipe_hash:hash,entries:Type.Array(Type.Object({...BatchEntrySchema.properties,source:Type.String(),output:Type.String(),record:Type.String(),record_hash:Type.Optional(hash)},exact))},{$id:'https://superaster.local/schema/file-batch-1.0.json',...exact});
export type FileBatchManifest=Static<typeof FileBatchManifestSchema>;
const checkManifest=ajv.compile<FileBatchManifest>(FileBatchManifestSchema),checkImage=ajv.compile<ImageInfo>(ImageInfoSchema);
export function parseFileBatchManifest(value:unknown):FileBatchManifest{if(!checkManifest(value))throw new SuperasterError('INVALID_INPUT','Unsupported resume manifest',{errors:checkManifest.errors});return value;}
export function parseImageInfo(value:unknown):ImageInfo{if(!checkImage(value))throw new SuperasterError('PROCESSING_FAILED','Invalid image inspection result',{errors:checkImage.errors});return value;}
export const RuleOutcomeSchema=Type.Object({id:Type.String({minLength:1}),state:Type.Union(['pass','fail','needs_review','not_checked'].map(value=>Type.Literal(value))),message:Type.String(),source:Type.Optional(Type.String()),user_confirmation:Type.Optional(Type.Boolean())},exact);
export type RuleOutcome=Static<typeof RuleOutcomeSchema>;
export type RuleState=RuleOutcome['state'];
const embeddedRecipe=Type.Object(RecipeSchema.properties,exact);
export const ExecutionRecordSchema=Type.Object({
 contract_version:Type.Literal('1.0'),implementation_version:Type.String({minLength:1}),input_hash:hash,recipe_hash:hash,resolved_recipe:embeddedRecipe,
 binding_hashes:Type.Optional(Type.Record(Type.String(),hash)),
 engine:Type.Object({id:Type.String({minLength:1}),version:Type.String(),model_hash:Type.Union([hash,Type.Null()]),precision:Type.String(),inference_dimensions:Type.Array(Type.Integer({minimum:1})),runtime:Type.String(),backend:Type.String(),refinement:Type.String(),runtime_details:Type.Optional(Type.Record(Type.String(),Type.Unknown()))},exact),
 encoder:Type.Record(Type.String(),Type.Unknown()),applied_operations:Type.Array(OperationSchema),output:Type.Object({...ImageInfoSchema.properties,hash},exact),
 timings_ms:Type.Record(Type.String(),Type.Number({minimum:0})),warnings:Type.Array(Type.String()),rules:Type.Array(RuleOutcomeSchema),preset:Type.Optional(Type.Object({id:Type.String({minLength:1}),version:Type.String({minLength:1})},exact))
},{$id:'https://superaster.local/schema/execution-record-1.0.json',...exact});
export type ExecutionRecord=Static<typeof ExecutionRecordSchema>;
const checkRecord=ajv.compile<ExecutionRecord>(ExecutionRecordSchema);
export function parseExecutionRecord(value:unknown):ExecutionRecord {
 if(!checkRecord(value))throw new SuperasterError('PROCESSING_FAILED','Invalid execution record',{errors:checkRecord.errors});
 parseRecipe(value.resolved_recipe);return value;
}
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
