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
const help=`Superaster local alpha\n\n  superaster inspect INPUT\n  superaster remove INPUT --output cutout.png [--quality quality|fast] [--engine ID] [--model-dir DIR] [--overwrite]\n  superaster run RECIPE.json --input INPUT --output OUTPUT [--bind reference=PATH] [--model-dir DIR] [--overwrite]\n  superaster batch INPUT_DIR --recipe RECIPE.json --output OUTPUT_DIR [--bind reference=PATH] [--model-dir DIR] [--resume|--retry]\n  superaster models list\n  superaster models install ID [--model-dir DIR]\n  superaster capabilities --json\n  superaster validate INPUT --preset ID [--preset-version VERSION]\n  superaster resolve REQUEST [--preset-version VERSION]\n  superaster mcp --roots DIR[,DIR] [--model-dir DIR]\n\nModels are separate verified downloads. Images stay local; outputs do not overwrite existing files unless --overwrite is explicit. JSON uses stdout; progress uses stderr.\n`;
const argumentOptions = {
 output: { type: 'string' }, input: { type: 'string' }, recipe: { type: 'string' },
 bind: { type: 'string', multiple: true }, quality: { type: 'string' }, engine: { type: 'string' },
 'model-dir': { type: 'string' }, resume: { type: 'boolean' }, retry: { type: 'boolean' },
 overwrite: { type: 'boolean' }, json: { type: 'boolean' }, preset: { type: 'string' },
 'preset-version': { type: 'string' }, roots: { type: 'string' }, help: { type: 'boolean' }
} as const;
type OptionName = keyof typeof argumentOptions;
interface CommandArguments { arity: number; flags: readonly OptionName[]; required?: readonly OptionName[] }
const commands: Record<string, CommandArguments> = {
 inspect: { arity: 2, flags: [] },
 remove: { arity: 2, flags: ['output', 'quality', 'engine', 'model-dir', 'overwrite'], required: ['output'] },
 run: { arity: 2, flags: ['input', 'output', 'bind', 'model-dir', 'overwrite'], required: ['input', 'output'] },
 batch: { arity: 2, flags: ['recipe', 'output', 'bind', 'model-dir', 'resume', 'retry'], required: ['recipe', 'output'] },
 capabilities: { arity: 1, flags: ['json'] },
 validate: { arity: 2, flags: ['preset', 'preset-version'], required: ['preset'] },
 resolve: { arity: 2, flags: ['preset-version'] },
 mcp: { arity: 1, flags: ['roots', 'model-dir'], required: ['roots'] }
};
function parseArguments() {
 let parsed;
 try { parsed = parseArgs({ allowPositionals: true, strict: true, tokens: true, options: argumentOptions }); }
 catch (error) { throw new SuperasterError('INVALID_INPUT', error instanceof Error ? error.message : String(error)); }
 const { values, positionals, tokens } = parsed;
 const [command, subcommand] = positionals;
 let rules: CommandArguments | undefined = command ? Object.hasOwn(commands, command) ? commands[command] : undefined : { arity: 0, flags: [] };
 if (command === 'models') {
  if (subcommand === 'list') rules = { arity: 2, flags: [] };
  else if (subcommand === 'install') rules = { arity: 3, flags: ['model-dir'] };
  else if (!subcommand && values.help) rules = { arity: 2, flags: [] };
  else throw new SuperasterError('INVALID_INPUT', 'Use models list or models install ID');
 }
 if (!rules) throw new SuperasterError('INVALID_INPUT', `Unknown command ${command}`);
 const seen = new Set<OptionName>();
 for (const token of tokens) {
  if (token.kind !== 'option') continue;
  if (token.name !== 'help' && !rules.flags.includes(token.name)) throw new SuperasterError('INVALID_INPUT', `--${token.name} is not valid for ${command ?? 'help'}`);
  if (seen.has(token.name) && token.name !== 'bind') throw new SuperasterError('INVALID_INPUT', `Duplicate --${token.name} option`);
  seen.add(token.name);
 }
 if (positionals.length > rules.arity) throw new SuperasterError('INVALID_INPUT', `Too many positional arguments for ${command}`);
 if (!values.help && positionals.length < rules.arity) throw new SuperasterError('INVALID_INPUT', `Missing positional argument for ${command}`);
 if (positionals.some(value => !value.trim())) throw new SuperasterError('INVALID_INPUT', 'Positional arguments must be nonempty strings');
 for (const [name, value] of Object.entries(values)) {
  if (typeof value === 'string' && !value.trim()) throw new SuperasterError('INVALID_INPUT', `--${name} must be a nonempty string`);
 }
 if (!values.help) for (const name of rules.required ?? []) {
  if (!values[name]) throw new SuperasterError('INVALID_INPUT', `Missing --${name}`);
 }
 if (values.quality !== undefined && values.quality !== 'quality' && values.quality !== 'fast') throw new SuperasterError('INVALID_INPUT', 'quality must be quality or fast');
 if (values.resume && values.retry) throw new SuperasterError('INVALID_INPUT', 'Choose --resume or --retry');
 if (values.roots !== undefined && values.roots.split(',').some(root => !root.trim())) throw new SuperasterError('INVALID_INPUT', '--roots must contain nonempty directories');
 const bindingPaths: Array<[string, string]> = [];
 const references = new Set<string>();
 for (const binding of values.bind ?? []) {
  const separator = binding.indexOf('=');
  if (separator < 1 || separator === binding.length - 1) throw new SuperasterError('INVALID_INPUT', 'Use --bind reference=/absolute/path');
  const reference = binding.slice(0, separator);
  if (references.has(reference)) throw new SuperasterError('INVALID_INPUT', 'Duplicate input binding');
  references.add(reference); bindingPaths.push([reference, binding.slice(separator + 1)]);
 }
 return { values, positionals, bindingPaths };
}
async function recipeFile(path:string) {
 try{return JSON.parse(await readFile(path,'utf8')) as unknown;}catch(error){if(error instanceof SyntaxError)throw new SuperasterError('INVALID_RECIPE','Recipe file is not valid JSON');throw error;}
}
let processor:ReturnType<typeof createProcessor>|undefined;
try {
 const {values,positionals,bindingPaths}=parseArguments();
 const bindings:Record<string,Uint8Array>=Object.create(null);
 if(!values.help)for(const [reference,path] of bindingPaths)bindings[reference]=await readInput(path);
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
   const recipe:Recipe={spec_version:'1.0',input:{ref:'input-0'},engine:values.engine??'auto',quality:values.quality==='fast'?'fast':'quality',operations:[{op:'remove_background',edge_cleanup:'none'}],output:{format:'png'}};
   emit(await transformFile(processor,required(arg,'input'),recipe,required(values.output,'--output'),{...runOptions,overwrite:values.overwrite}));
  }else if(command==='run')emit(await transformFile(processor,required(values.input,'--input'),await recipeFile(required(arg,'recipe')),required(values.output,'--output'),{...runOptions,overwrite:values.overwrite}));
  else if(command==='batch'){
   const manifest=await fileBatch(processor,required(arg,'input directory'),required(values.output,'--output'),await recipeFile(required(values.recipe,'--recipe')),{...runOptions,resume:values.resume,retry:values.retry});emit(manifest);if(manifest.entries.some(e=>e.status!=='completed'))process.exitCode=5;
  }else if(command==='resolve'||command==='validate'){
   const {resolvePreset,resolvePresetStatus,validate}=await import('../../catalog/src/index.js');
   if(command==='resolve')emit(resolvePresetStatus(required(arg,'request'),values['preset-version']));
   else {const preset=resolvePreset(required(values.preset,'--preset'),values['preset-version']);emit(validate(await processor.inspect(await readInput(required(arg,'input')),options),preset));}
  }else throw new SuperasterError('UNSUPPORTED',`Unknown command ${command}`);
 }
} catch(error) {
 const failure=processingError(error);process.stderr.write(JSON.stringify({error:failure.toJSON()})+'\n');
 process.exitCode=failure.code==='CANCELLED'?130:['INVALID_INPUT','INVALID_RECIPE','ACCESS_DENIED','AMBIGUOUS_PRESET','PRESET_NOT_FOUND'].includes(failure.code)?2:failure.code==='UNSUPPORTED'?3:4;
} finally {await processor?.dispose();}
