#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createProcessor, readInput, transformFile } from '../../sdk/src/index.js';
import { installModel, listModels } from '../../engines/src/native.js';
import { processingError } from '../../core/src/index.js';
import { SuperasterError, type Recipe } from '../../contract/src/index.js';
import { fileBatch } from './batch.js';

const abort=new AbortController();process.once('SIGINT',()=>abort.abort());
const options={signal:abort.signal,onProgress:(progress:unknown)=>process.stderr.write(JSON.stringify(progress)+'\n')};
const help=`Superaster local alpha\n\n  superaster inspect INPUT\n  superaster remove INPUT --output cutout.png --quality quality|fast [--model-dir DIR]\n  superaster run RECIPE.json --input INPUT --output OUTPUT [--bind reference=PATH]\n  superaster batch INPUT_DIR --recipe RECIPE.json --output OUTPUT_DIR [--resume|--retry]\n  superaster models list\n  superaster models install ID [--model-dir DIR]\n  superaster capabilities --json\n  superaster validate INPUT --preset ID --preset-version VERSION\n  superaster resolve REQUEST [--preset-version VERSION]\n  superaster mcp --roots DIR[,DIR]\n\nModels are separate verified downloads. Images stay local; outputs do not overwrite existing files unless --overwrite is explicit. JSON uses stdout; progress uses stderr.\n`;
async function recipeFile(path:string) {
 try{return JSON.parse(await readFile(path,'utf8')) as unknown;}catch(error){if(error instanceof SyntaxError)throw new SuperasterError('INVALID_RECIPE','Recipe file is not valid JSON');throw error;}
}
let processor:ReturnType<typeof createProcessor>|undefined;
try {
 const {values,positionals}=parseArgs({allowPositionals:true,strict:true,options:{output:{type:'string'},input:{type:'string'},recipe:{type:'string'},bind:{type:'string',multiple:true},quality:{type:'string',default:'quality'},engine:{type:'string',default:'auto'},'model-dir':{type:'string'},resume:{type:'boolean'},retry:{type:'boolean'},overwrite:{type:'boolean'},json:{type:'boolean'},preset:{type:'string'},'preset-version':{type:'string'},roots:{type:'string'},help:{type:'boolean'}}});
 const bindings:Record<string,Uint8Array>={};for(const binding of values.bind??[]){const separator=binding.indexOf('=');if(separator<1||separator===binding.length-1)throw new SuperasterError('INVALID_INPUT','Use --bind reference=/absolute/path');const reference=binding.slice(0,separator);if(reference in bindings)throw new SuperasterError('INVALID_INPUT','Duplicate input binding');bindings[reference]=await readInput(binding.slice(separator+1));}
 const runOptions={...options,bindings};
 const [command,arg]=positionals;
 const emit=(value:unknown)=>process.stdout.write(JSON.stringify(value,null,2)+'\n');
 const required=(value:string|undefined,name:string)=>{if(!value)throw new SuperasterError('INVALID_INPUT',`Missing ${name}`);return value;};
 if(values.help||!command){process.stdout.write(help);}
 else if(command==='models'){
  if(arg==='list')emit(listModels());else if(arg==='install')emit({path:await installModel(required(positionals[2],'model ID'),{...options,modelDir:values['model-dir']})});else throw new SuperasterError('INVALID_INPUT','Use models list or models install ID');
 }else if(command==='mcp'){
  const {startMcp}=await import('../../mcp/src/index.js');await startMcp(required(values.roots,'--roots').split(','),values['model-dir']);
 }else {
  processor=createProcessor({modelDir:values['model-dir']});
  if(command==='capabilities')emit(processor.capabilities());
  else if(command==='inspect')emit(await processor.inspect(await readInput(required(arg,'input')),options));
  else if(command==='remove'){
   if(values.quality!=='quality'&&values.quality!=='fast')throw new SuperasterError('INVALID_RECIPE','quality must be quality or fast');
   const recipe:Recipe={spec_version:'1.0',input:{ref:'input-0'},engine:values.engine,quality:values.quality,operations:[{op:'remove_background',edge_cleanup:'none'}],output:{format:'png'}};
   emit(await transformFile(processor,required(arg,'input'),recipe,required(values.output,'--output'),{...runOptions,overwrite:values.overwrite}));
  }else if(command==='run')emit(await transformFile(processor,required(values.input,'--input'),await recipeFile(required(arg,'recipe')),required(values.output,'--output'),{...runOptions,overwrite:values.overwrite}));
  else if(command==='batch'){
   const manifest=await fileBatch(processor,required(arg,'input directory'),required(values.output,'--output'),await recipeFile(required(values.recipe,'--recipe')),{...runOptions,resume:values.resume,retry:values.retry});emit(manifest);if(manifest.entries.some(e=>e.status!=='completed'))process.exitCode=5;
  }else if(command==='resolve'||command==='validate'){
   const {resolvePreset,validate}=await import('../../catalog/src/index.js');
   if(command==='resolve')emit(resolvePreset(required(arg,'request'),values['preset-version']));
   else {const preset=resolvePreset(required(values.preset,'--preset'),values['preset-version']);emit(validate(await processor.inspect(await readInput(required(arg,'input')),options),preset));}
  }else throw new SuperasterError('UNSUPPORTED',`Unknown command ${command}`);
 }
} catch(error) {
 const failure=processingError(error);process.stderr.write(JSON.stringify({error:failure.toJSON()})+'\n');
 process.exitCode=failure.code==='CANCELLED'?130:['INVALID_INPUT','INVALID_RECIPE','ACCESS_DENIED','AMBIGUOUS_PRESET','PRESET_NOT_FOUND'].includes(failure.code)?2:failure.code==='UNSUPPORTED'?3:4;
} finally {await processor?.dispose();}
