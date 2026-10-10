import {readFile,writeFile,mkdir,symlink,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {createProcessor,readInput,writeResult,listPresets,resolvePreset,planPreset,presetHistory,monitorSources} from 'superaster-local';
import {parseRecipe} from 'superaster-local/contract';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const evidence=resolve(process.argv[2]);
const skipSourceMonitor=process.argv.includes('--skip-source-monitor');
const root=resolve('scratch');
const outside=resolve('outside');
const cli=resolve('node_modules/superaster-local/dist/native/cli/src/index.js');
const results=[];
const transcripts=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(root,{recursive:true});await mkdir(outside,{recursive:true});
const record=(id,pass,details)=>{const value={id,status:pass?'PASS':'FAIL',details};results.push(value);console.log(JSON.stringify(value));};
async function attempt(id,fn){try{await fn();}catch(error){record(id,false,{error:error.message,code:error.code,stack:error.stack});}}
function runCli(id,args){const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000});const value={id,command:[process.execPath,cli,...args],exit:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr,error:r.error?.message};transcripts.push(value);return value;}
function parseStdout(value){return JSON.parse(value.stdout);}
const data=Buffer.alloc(48*32*4);
for(let y=0;y<32;y++)for(let x=0;x<48;x++){const i=(y*48+x)*4;data[i]=180;data[i+1]=40;data[i+2]=80;data[i+3]=x>=4&&x<44&&y>=4&&y<28?255:0;}
const input=join(root,'input.png');await sharp(data,{raw:{width:48,height:32,channels:4}}).png().toFile(input);
await writeFile(join(outside,'outside.png'),await readFile(input));await writeFile(join(root,'corrupt.png'),'not an image');
await symlink(outside,join(root,'escape-directory'));await symlink(join(outside,'outside.png'),join(root,'escape-input.png'));
const sourceBefore=hash(await readFile(input));
const recipe={spec_version:'1.0',input:{ref:'input-0'},engine:'auto',quality:'quality',operations:[{op:'canvas',width:1200,height:1200,fit:'contain',background:'#ffffff',position:'center'}],output:{format:'webp',quality:90,metadata:'strip'}};
const recipePath=join(root,'recipe.json');await writeFile(recipePath,JSON.stringify(recipe));
const help=runCli('cli-help',['--help']);record('cli-help',help.exit===0&&help.stdout.includes('superaster mcp'),{exit:help.exit});
const binPath=resolve('node_modules/.bin/superaster');const binResult=spawnSync(binPath,['capabilities','--json'],{encoding:'utf8',timeout:30000});transcripts.push({id:'installed-bin-entrypoint',command:[binPath,'capabilities','--json'],exit:binResult.status,stdout:binResult.stdout,stderr:binResult.stderr,error:binResult.error?.message});record('installed-bin-entrypoint',binResult.status===0&&JSON.parse(binResult.stdout).adapter==='native',{exit:binResult.status,mode:(await stat(binPath)).mode.toString(8)});
const caps=runCli('cli-capabilities',['capabilities','--json']);record('cli-capabilities',caps.exit===0&&parseStdout(caps).adapter==='native',{exit:caps.exit,capabilities:parseStdout(caps)});
const inspect=runCli('cli-inspect',['inspect',input]);record('cli-inspect',inspect.exit===0&&parseStdout(inspect).width===48&&parseStdout(inspect).height===32,{exit:inspect.exit,image:parseStdout(inspect)});
await attempt('cli-geometry',async()=>{const output=join(root,'cli.webp');const r=runCli('cli-geometry',['run',recipePath,'--input',input,'--output',output]);const metadata=await sharp(output).metadata();const pixel=await sharp(output).ensureAlpha().raw().toBuffer();record('cli-geometry',r.exit===0&&metadata.width===1200&&metadata.height===1200&&metadata.format==='webp'&&pixel.subarray(0,4).every(v=>v===255)&&metadata.space==='srgb'&&!metadata.exif&&!metadata.xmp&&!metadata.iptc,{exit:r.exit,metadata,output_sha256:hash(await readFile(output)),record:JSON.parse(await readFile(output+'.json','utf8')),corner_pixel:Array.from(pixel.subarray(0,4))});});
const unknown=runCli('cli-unknown-option',['capabilities','--definitely-unknown']);record('cli-unknown-option',unknown.exit===2&&JSON.parse(unknown.stderr).error.code==='INVALID_INPUT',{exit:unknown.exit,stderr:unknown.stderr,expected:'INVALID_INPUT and exit 2'});
const extra=runCli('cli-extra-positional',['inspect',input,'ignored.png']);record('cli-extra-positional',extra.exit===2,{exit:extra.exit,expected:'Reject unexpected positional rather than ignore it'});
const ignored=runCli('cli-inapplicable-parameter',['inspect',input,'--quality','not-a-quality']);record('cli-inapplicable-parameter',ignored.exit===2,{exit:ignored.exit,expected:'Reject inapplicable or invalid parameter rather than ignore it'});
const unsupported={...recipe,operations:[{op:'warp',amount:12}]};const unsupportedPath=join(root,'unsupported.json');await writeFile(unsupportedPath,JSON.stringify(unsupported));
const unsupportedRun=runCli('cli-unsupported-operation',['run',unsupportedPath,'--input',input,'--output',join(root,'unsupported.webp')]);record('cli-unsupported-operation',unsupportedRun.exit===2&&JSON.parse(unsupportedRun.stderr).error.code==='INVALID_RECIPE',{exit:unsupportedRun.exit});
const unknownEnginePath=join(root,'unknown-engine.json');await writeFile(unknownEnginePath,JSON.stringify({...recipe,engine:'unsupported-engine-id',operations:[]}));
const unknownEngineRun=runCli('cli-unsupported-engine',['run',unknownEnginePath,'--input',input,'--output',join(root,'unknown-engine.webp')]);record('cli-unsupported-engine',unknownEngineRun.exit===3&&JSON.parse(unknownEngineRun.stderr).error.code==='UNSUPPORTED',{exit:unknownEngineRun.exit,stderr:unknownEngineRun.stderr,expected:'Unsupported engine rejected before processing'});
const corruption=runCli('cli-corrupt-input',['inspect',join(root,'corrupt.png')]);record('cli-corrupt-input',corruption.exit!==0&&corruption.stderr.includes('error'),{exit:corruption.exit,stderr:corruption.stderr});
const collision=runCli('cli-existing-output',['run',recipePath,'--input',input,'--output',join(root,'cli.webp')]);record('cli-existing-output',collision.exit!==0,{exit:collision.exit,stderr:collision.stderr});
const processor=createProcessor({modelDir:join(root,'empty-model-cache')});
try{
 await attempt('sdk-geometry',async()=>{const output=join(root,'sdk.webp');const result=await processor.transform(await readInput(input),recipe);await writeResult(result,output,{inputPath:input});const m=await sharp(output).metadata();record('sdk-geometry',m.width===1200&&m.height===1200&&m.format==='webp'&&hash(result.bytes)===hash(await readFile(join(root,'cli.webp'))),{metadata:m,output_sha256:hash(result.bytes),engine:result.record.engine,record_sha256:hash(await readFile(output+'.json'))});});
 await attempt('sdk-correction',async()=>{const result=await processor.transform(await readInput(input),{...recipe,operations:[{op:'correct',regions:[{x:4,y:4,width:10,height:10,mode:'erase'},{x:4,y:4,width:2,height:2,mode:'restore'}]}],output:{format:'png',metadata:'strip'}});const {data:d,info}=await sharp(result.bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});const erased=d[(8*48+8)*4+3],restored=d[(4*48+4)*4+3];record('sdk-correction',info.width===48&&info.height===32&&erased===0&&restored===255,{width:info.width,height:info.height,erased_alpha:erased,restored_alpha:restored,mask_returned:!!result.mask,engine:result.record.engine});});
 await attempt('sdk-cancel',async()=>{const abort=new AbortController();abort.abort();try{await processor.transform(await readInput(input),recipe,{signal:abort.signal});record('sdk-cancel',false,{unexpected:'success'});}catch(e){record('sdk-cancel',e.code==='CANCELLED',{code:e.code});}});
 await attempt('sdk-unknown-parameter',async()=>{try{parseRecipe({...recipe,operations:[{op:'resize',width:24,unknown_parameter:true}]});record('sdk-unknown-parameter',false,{unexpected:'success'});}catch(e){record('sdk-unknown-parameter',e.code==='INVALID_RECIPE',{code:e.code});}});
 await attempt('sdk-unsupported-engine',async()=>{try{await processor.transform(await readInput(input),{...recipe,engine:'unsupported-engine-id',operations:[]});record('sdk-unsupported-engine',false,{unexpected:'success'});}catch(e){record('sdk-unsupported-engine',e.code==='UNSUPPORTED',{code:e.code});}});
 await attempt('catalog-installed-data',async()=>{const catalog=listPresets({history:true});const p=resolvePreset('jp-residence-status-paper','2026-10-08.1');record('catalog-installed-data',new Set(catalog.map(x=>x.id)).size>=20&&p.id==='jp-residence-status-paper',{immutable_records:catalog.length,destination_ids:new Set(catalog.map(x=>x.id)).size,chooser_records:listPresets().length,pin:p.id+'@'+p.version,history:presetHistory(p.id)});});
 await attempt('catalog-ambiguity',async()=>{try{resolvePreset('japan visa');record('catalog-ambiguity',false,{unexpected:'success'});}catch(e){record('catalog-ambiguity',e.code==='AMBIGUOUS_PRESET',{code:e.code,details:e.details});}});
 await attempt('catalog-edit-policy',async()=>{try{planPreset(resolvePreset('uk-passport-digital-own-device'),{...recipe,operations:[]});record('catalog-edit-policy',false,{unexpected:'success'});}catch(e){record('catalog-edit-policy',e.code==='EDIT_FORBIDDEN',{code:e.code,details:e.details});}});
}finally{await processor.dispose();}
const transport=new StdioClientTransport({command:process.execPath,args:[cli,'mcp','--roots',root,'--model-dir',join(root,'empty-model-cache')],stderr:'pipe'});
let serverStderr='';transport.stderr?.on('data',chunk=>serverStderr+=chunk.toString());
const client=new Client({name:'superaster-clean-install-verifier',version:'1.0.0'});
async function call(name,args){const result=await client.callTool({name,arguments:args},undefined,{timeout:30000});transcripts.push({mcp_request:{name,arguments:args},mcp_result:result});return result;}
function content(result){return result.structuredContent??JSON.parse(result.content.find(x=>x.type==='text').text);}
try{
 await client.connect(transport);
 const tools=await client.listTools();transcripts.push({mcp_tools:tools});record('mcp-tool-discovery',['capabilities','inspect','remove','transform','batch','resolve_preset','validate'].every(name=>tools.tools.some(t=>t.name===name)),{tools:tools.tools.map(t=>t.name)});
 await attempt('mcp-capabilities',async()=>{const r=await call('capabilities',{});record('mcp-capabilities',!r.isError&&content(r).adapter==='native',{adapter:content(r).adapter});});
 await attempt('mcp-inspect',async()=>{const r=await call('inspect',{input});record('mcp-inspect',!r.isError&&content(r).image.width===48,{image:content(r).image});});
 await attempt('mcp-geometry',async()=>{const output=join(root,'mcp.webp');const r=await call('transform',{input,output,recipe});const v=content(r);const m=await sharp(output).metadata();record('mcp-geometry',!r.isError&&v.file===output&&v.resource_uri===new URL('file://'+output).href&&m.width===1200&&m.height===1200&&m.format==='webp'&&hash(await readFile(output))===hash(await readFile(join(root,'cli.webp'))),{file:v.file,resource_uri:v.resource_uri,record_file:v.record_file,metadata:m,output_sha256:hash(await readFile(output)),engine:v.record.engine});});
 await attempt('mcp-validate',async()=>{const r=await call('validate',{input:join(root,'mcp.webp'),preset:'shopify-product-square',version:'2026-10-08.1'});const v=content(r);record('mcp-validate',!r.isError&&Array.isArray(v.rules),v);});
 for(const [id,args]of [['mcp-outside-read',{input:join(outside,'outside.png')}],['mcp-symlink-read',{input:join(root,'escape-input.png')}]])await attempt(id,async()=>{const r=await call('inspect',args);record(id,r.isError===true&&content(r).error.code==='ACCESS_DENIED',{error:content(r).error});});
 for(const [id,output]of [['mcp-outside-write',join(outside,'out.webp')],['mcp-symlink-write',join(root,'escape-directory','out.webp')]])await attempt(id,async()=>{const r=await call('transform',{input,output,recipe});record(id,r.isError===true&&content(r).error.code==='ACCESS_DENIED',{error:content(r).error});});
 await attempt('mcp-binding-roots',async()=>{const r=await call('transform',{input,output:join(root,'binding.webp'),recipe:{...recipe,operations:[{op:'composite',image_ref:'outside'}]},bindings:{outside:join(outside,'outside.png')}});record('mcp-binding-roots',r.isError===true&&content(r).error.code==='ACCESS_DENIED',{error:content(r).error});});
 await attempt('mcp-unsupported-operation',async()=>{const r=await call('transform',{input,output:join(root,'warp.webp'),recipe:unsupported});record('mcp-unsupported-operation',r.isError===true&&content(r).error.code==='INVALID_RECIPE',{error:content(r).error});});
 await attempt('mcp-unsupported-engine',async()=>{const r=await call('transform',{input,output:join(root,'unknown-engine-mcp.webp'),recipe:{...recipe,engine:'unsupported-engine-id',operations:[]}});record('mcp-unsupported-engine',r.isError===true&&content(r).error.code==='UNSUPPORTED',{error:content(r).error});});
 await attempt('mcp-unknown-parameter',async()=>{const r=await call('inspect',{input,unknown_parameter:true});record('mcp-unknown-parameter',r.isError===true,{result:r});});
}finally{await client.close();await transport.close();}

await attempt('exact-png-all-pixels-and-metadata',async()=>{
 const metadataInput=join(root,'source-metadata.png');
 await sharp(data,{raw:{width:48,height:32,channels:4}}).withMetadata({density:72}).withExif({IFD0:{Artist:'SUPERASTER_PRIVATE_SENTINEL',Copyright:'SUPERASTER_PRIVATE_SENTINEL'}}).png().toFile(metadataInput);
 const before=await readFile(metadataInput);const sourceMetadata=await sharp(before).metadata();
 const exactRecipe={spec_version:'1.0',input:{ref:'metadata-fixture'},operations:[{op:'canvas',width:48,height:48,fit:'contain',background:'#ffffff'}],output:{format:'png',metadata:'strip'}};
 const p=createProcessor();
 try{
  const transformed=await p.transform(before,exactRecipe);const output=join(root,'exact-sdk.png');await writeResult(transformed,output,{inputPath:metadataInput});
  const exactPath=join(root,'exact-recipe.json');await writeFile(exactPath,JSON.stringify(exactRecipe));
  const c=runCli('exact-cli',['run',exactPath,'--input',metadataInput,'--output',join(root,'exact-cli.png')]);
  const bytes=await readFile(output),metadata=await sharp(bytes).metadata();const decoded=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const expected=Buffer.alloc(48*48*4,255);
  for(let y=12;y<36;y++)for(let x=4;x<44;x++){const i=(y*48+x)*4;expected[i]=180;expected[i+1]=40;expected[i+2]=80;}
  let mismatches=0;for(let i=0;i<expected.length;i++)if(expected[i]!==decoded.data[i])mismatches++;
  const cliBytes=await readFile(join(root,'exact-cli.png'));
  const result={width:decoded.info.width,height:decoded.info.height,channels:decoded.info.channels,checked_decoded_bytes:expected.length,mismatched_bytes:mismatches,source_exif_present:!!sourceMetadata.exif,source_has_sensitive_marker:sourceMetadata.exif?.includes(Buffer.from('SUPERASTER_PRIVATE_SENTINEL'))??false,output_exif_present:!!metadata.exif,output_xmp_present:!!metadata.xmp,output_iptc_present:!!metadata.iptc,source_hash:hash(before),output_hash:hash(bytes),cli_hash:hash(cliBytes),record:transformed.record};
  record('exact-png-all-pixels-and-metadata',c.exit===0&&decoded.info.width===48&&decoded.info.height===48&&mismatches===0&&result.source_has_sensitive_marker&&!metadata.exif&&!metadata.xmp&&!metadata.iptc&&hash(bytes)===hash(cliBytes)&&transformed.record.input_hash===hash(before)&&transformed.record.output.hash===hash(bytes)&&hash(await readFile(metadataInput))===hash(before),result);
 }finally{await p.dispose();}
});
record('original-preserved',hash(await readFile(input))===sourceBefore,{before:sourceBefore,after:hash(await readFile(input))});
const seen=new Set(),monitorResults=[];
if(!skipSourceMonitor){for(const preset of listPresets({history:true}))for(const source of preset.sources){if(seen.has(source.url))continue;seen.add(source.url);console.log(JSON.stringify({monitoring:source.url}));const result=await monitorSources({...preset,sources:[source]},{timeout_ms:5000,max_source_bytes:8*1024*1024});monitorResults.push({baseline_preset_id:preset.id,baseline_preset_version:preset.version,source_baseline_sha256:source.sha256??null,result});}
await writeFile(join(evidence,'source-monitor.json'),JSON.stringify({scope:'Actual installed SDK monitorSources, unique sources checked separately, no pin mutation or approval',checked_at_utc:new Date().toISOString(),checks:monitorResults},null,2)+'\n');}
await writeFile(join(evidence,'consumer-results.json'),JSON.stringify({checked_at_utc:new Date().toISOString(),consumer:resolve('.'),root,source_sha256:sourceBefore,results,source_monitor_repeated:!skipSourceMonitor,not_run:['Model first download, cache reuse and offline inference from this installed package','T11 full removal workflow; previous source-checkout evidence was not repeated','Physical phone, other OS/Node/browser configurations','Heldout or human quality evaluation','Source rebuild, modified library test or served-browser runtime replacement']},null,2)+'\n');
await writeFile(join(evidence,'consumer-transcripts.json'),JSON.stringify(transcripts,null,2)+'\n');
await writeFile(join(evidence,'mcp-server.stderr'),serverStderr);
console.log(JSON.stringify({finished:true,pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,monitor_statuses:monitorResults.map(x=>({url:x.result.checks[0].url,status:x.result.status}))}));

process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
