import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createProcessor, assertAllowedPath, readInput, writeResult } from '../../sdk/src/index.js';
import { parseRecipe, type Recipe } from '../../contract/src/index.js';
import { processingError } from '../../core/src/index.js';
import { fileBatch } from '../../cli/src/batch.js';
import { resolvePreset, validate } from '../../catalog/src/index.js';

export async function createMcpServer(roots:string[],modelDir?:string) {
 const processor=createProcessor({modelDir});
 const server=new McpServer({name:'superaster',version:'0.1.0-alpha.1'});
 const guarded=async(action:()=>Promise<unknown>|unknown)=>{try{const value=await action();const structuredContent=value as Record<string,unknown>;return{content:[{type:'text' as const,text:JSON.stringify(value)}],structuredContent};}catch(error){return{isError:true,content:[{type:'text' as const,text:JSON.stringify({error:processingError(error).toJSON()})}]};}};
 const read=async(path:string)=>readInput(await assertAllowedPath(path,roots),processor.adapter.capabilities().limits.max_bytes);
 server.registerTool('capabilities',{description:'Discover supported operations, exact model profiles, schema version and limits',inputSchema:z.object({}).strict(),annotations:{readOnlyHint:true,openWorldHint:false}},()=>guarded(()=>processor.capabilities()));
 server.registerTool('inspect',{description:'Inspect a local single-frame image within configured roots',inputSchema:z.object({input:z.string()}).strict(),annotations:{readOnlyHint:true,openWorldHint:false}},({input},extra)=>guarded(async()=>({image:await processor.inspect(await read(input),{signal:extra.signal})})));
 const perform=async(input:string,output:string,recipe:Recipe,signal:AbortSignal,boundPaths:Record<string,string>={})=>{
  const source=await assertAllowedPath(input,roots),target=await assertAllowedPath(output,roots,'write');
  const bindings:Record<string,Uint8Array>={};for(const [ref,path] of Object.entries(boundPaths))bindings[ref]=await read(path);
  await assertAllowedPath(target+'.json',roots,'write');
  const result=await processor.transform(await readInput(source),recipe,{signal,bindings});await writeResult(result,target,{inputPath:source});
  return{file:target,resource_uri:new URL('file://'+target).href,record_file:target+'.json',record:result.record};
 };
 server.registerTool('remove',{description:'Remove background using local verified weights and export PNG, preserve original; model download may be required',inputSchema:z.object({input:z.string(),output:z.string(),quality:z.enum(['quality','fast']).default('quality'),engine:z.string().default('auto')}).strict(),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},({input,output,quality,engine},extra)=>guarded(()=>perform(input,output,{spec_version:'1.0',input:{ref:'input-0'},engine,quality,operations:[{op:'remove_background',edge_cleanup:'none'}],output:{format:'png'}},extra.signal)));
 server.registerTool('transform',{description:'Run the shared ordered operation contract on a local file; no hosted inference',inputSchema:z.object({input:z.string(),output:z.string(),recipe:z.record(z.string(),z.unknown()),bindings:z.record(z.string(),z.string()).optional()}).strict(),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},({input,output,recipe,bindings},extra)=>guarded(()=>perform(input,output,parseRecipe(recipe),extra.signal,bindings)));
 server.registerTool('batch',{description:'Run a warmed serial local directory batch with verified identity resume and attributable failures',inputSchema:z.object({input_directory:z.string(),output_directory:z.string(),recipe:z.record(z.string(),z.unknown()),resume:z.boolean().default(false)}).strict(),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},({input_directory,output_directory,recipe,resume},extra)=>guarded(async()=>({manifest:await fileBatch(processor,await assertAllowedPath(input_directory,roots),await assertAllowedPath(output_directory,roots,'write'),parseRecipe(recipe),{signal:extra.signal,resume,allowedRoots:roots})})));
 server.registerTool('resolve_preset',{description:'Resolve an exact immutable preset or return material ambiguity before editing',inputSchema:z.object({request:z.string(),version:z.string().optional()}).strict(),annotations:{readOnlyHint:true,openWorldHint:false}},({request,version})=>guarded(()=>({preset:resolvePreset(request,version)})));
 server.registerTool('validate',{description:'Check supported pixel/file rules, mark visual judgments and user confirmations separately',inputSchema:z.object({input:z.string(),preset:z.string(),version:z.string().optional()}).strict(),annotations:{readOnlyHint:true,openWorldHint:false}},({input,preset,version},extra)=>guarded(async()=>({preset:resolvePreset(preset,version),rules:validate(await processor.inspect(await read(input),{signal:extra.signal}),resolvePreset(preset,version))})));
 const dispose=()=>processor.dispose();
 return {server,processor,dispose};
}
export async function startMcp(roots:string[],modelDir?:string) {
 const {server,dispose}=await createMcpServer(roots,modelDir);await server.connect(new StdioServerTransport());
 process.once('SIGINT',()=>{void server.close().finally(dispose);});
 process.once('SIGTERM',()=>{void server.close().finally(dispose);});
}
