import { readdir, lstat, readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, relative, join, dirname } from 'node:path';
import type { Processor, RuntimeOptions, BatchEntry } from '../../core/src/index.js';
import { recipeHash, sha256, plan, processingError, bindingHashes } from '../../core/src/index.js';
import { SuperasterError, parseFileBatchManifest, parseExecutionRecord, type FileBatchManifest } from '../../contract/src/index.js';
import { readInput, assertAllowedPath } from './index.js';
export interface FileBatchEntry extends BatchEntry {source:string;output:string;record:string;record_hash?:string}
type Manifest=FileBatchManifest;
async function files(root:string):Promise<string[]> {
  const entries=await readdir(root,{withFileTypes:true});const all:string[]=[];
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    const path=join(root,entry.name);if(entry.isSymbolicLink()) throw new SuperasterError('ACCESS_DENIED','Batch symlinks require explicit individual inputs',{path});
    if(entry.isDirectory())all.push(...await files(path));else if(entry.isFile())all.push(path);
  }return all;
}
export async function fileBatch(processor:Processor,source:string,output:string,value:unknown,options:RuntimeOptions & {resume?:boolean;retry?:boolean;allowedRoots?:string[]}={}) {
  const root=resolve(source),out=resolve(output);if(out===root||out.startsWith(root+'/'))throw new SuperasterError('ACCESS_DENIED','Batch output must be outside input directory');
  const recipe=plan(value,processor.adapter),hash=await recipeHash(recipe,await bindingHashes(recipe,options.bindings)),inputFiles=await files(root),manifestPath=join(out,'manifest.json');
  const extension=recipe.output.format==='jpeg'?'jpg':recipe.output.format;
  const planned=inputFiles.map(path=>({source:path,output:join(out,relative(root,path)+'.'+extension)}));
  const names=new Set<string>();for(const item of planned){const key=item.output.normalize('NFC').toLowerCase();if(names.has(key))throw new SuperasterError('INVALID_INPUT','Output filename collision',{output:item.output});names.add(key);}
  let old:Manifest|undefined;
  if(options.resume||options.retry){try{old=parseFileBatchManifest(JSON.parse(await readFile(manifestPath,'utf8')));}catch(error){if(error instanceof SuperasterError)throw error;if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw new SuperasterError('INVALID_INPUT','Cannot read resume manifest');}}
  const guardedPath=async(path:string)=>{
    if(options.allowedRoots)await assertAllowedPath(path,options.allowedRoots,'write');
    // Reject symlinks in existing output ancestry for every caller, including CLI.
    let ancestor=resolve(path);for(;;){try{if((await lstat(ancestor)).isSymbolicLink())throw new SuperasterError('ACCESS_DENIED','Batch output symlink is not allowed',{path:ancestor});}catch(error){if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;}const parent=dirname(ancestor);if(parent===ancestor)break;ancestor=parent;}
  };
  for(const item of planned){await guardedPath(item.output);await guardedPath(item.output+'.json');}
  await guardedPath(manifestPath);await guardedPath(manifestPath+'.tmp');
  await mkdir(out,{recursive:true});const manifest:Manifest={version:'1.0',recipe_hash:hash,entries:[]};
  const persist=async()=>{const temp=manifestPath+'.tmp';await guardedPath(manifestPath);await guardedPath(temp);await writeFile(temp,JSON.stringify(manifest,null,2)+'\n');await rename(temp,manifestPath);};
  for(const item of planned){
    const id=relative(root,item.source),recordPath=item.output+'.json';let input:Uint8Array|undefined;
    const entry:FileBatchEntry={id,name:id,source:item.source,output:item.output,record:recordPath,input_hash:'',recipe_hash:hash,status:'cancelled'};
    try {
      input=await readInput(item.source,processor.adapter.capabilities().limits.max_bytes);entry.input_hash=await sha256(input);
      const previous=old?.entries.find(e=>e.id===id);
      if(previous?.status==='completed'&&previous.input_hash===entry.input_hash&&previous.recipe_hash===hash&&previous.output===item.output) {
        try {const bytes=await readFile(item.output);const record=parseExecutionRecord(JSON.parse(await readFile(recordPath,'utf8')));
          if(await sha256(bytes)===previous.output_hash&&record.input_hash===entry.input_hash&&record.recipe_hash===hash&&record.output?.hash===previous.output_hash){manifest.entries.push(previous);await persist();continue;}
        }catch{/* stale work is rerun only when it belongs to this prior manifest */}
      }
      if(options.signal?.aborted)throw new SuperasterError('CANCELLED','Not scheduled after cancellation');
      // Existing files may be replaced only if this manifest owns that path.
      let owned=false,recordOwned=false;
      if(previous?.output===item.output&&previous.output_hash){
        try {owned=await sha256(await readFile(item.output))===previous.output_hash;}catch{/* missing output is recreated exclusively */}
        if(previous.record_hash){try{recordOwned=await sha256(await readFile(recordPath))===previous.record_hash;}catch{/* missing record is recreated exclusively */}}
        // Only a previously completed record establishes provenance for replacing stale output.
        if(previous.status==='completed'){try{const previousRecord=parseExecutionRecord(JSON.parse(await readFile(recordPath,'utf8')));if(previousRecord.input_hash===previous.input_hash&&previousRecord.recipe_hash===previous.recipe_hash&&previousRecord.output?.hash===previous.output_hash){owned=true;recordOwned=true;}}catch{/* unverified ownership cannot overwrite */}}
      }
      const result=await processor.transform(input,recipe,options);await mkdir(dirname(item.output),{recursive:true});
      await guardedPath(item.output);await guardedPath(recordPath);
      await writeFile(item.output,result.bytes,{flag:owned?'w':'wx'});
      entry.output_hash=result.record.output.hash;
      const recordBytes=new TextEncoder().encode(JSON.stringify(result.record,null,2)+'\n');
      await writeFile(recordPath,recordBytes,{flag:recordOwned?'w':'wx'});entry.record_hash=await sha256(recordBytes);
      entry.status='completed';
    }catch(error){const failure=processingError(error);entry.status=failure.code==='CANCELLED'?'cancelled':'failed';entry.error=failure.toJSON();}
    manifest.entries.push(entry);await persist();
  }
  return manifest;
}
