#!/usr/bin/env node
// Deterministic physical-sheet check. No inference or image upload.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {createProcessor} from '../packages/sdk/src/index.ts';
const {values}=parseArgs({options:{output:{type:'string'}}});
if(!values.output)throw new Error('Use node --import tsx benchmarks/print-check.mjs --output NEW_DIRECTORY');
const output=path.resolve(values.output);await fs.mkdir(output,{recursive:false});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const width=413,height=531,raw=Buffer.alloc(width*height*4);
for(let i=0;i<width*height;i++)raw.set([32,64,128,255],i*4);
for(let y=0;y<2;y++)for(let x=0;x<2;x++)raw.set([200,80,40,255],(y*width+x)*4);
const input=await sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer();
await fs.writeFile(path.join(output,'item.png'),input);
const operation={op:'print_sheet',sheet_width_mm:210,sheet_height_mm:297,item_width_mm:35,item_height_mm:45,dpi:300,rows:5,columns:4,margin_mm:10,spacing_mm:5,background:'#ffffff'};
const recipe={spec_version:'1.0',input:{ref:'prepared-item'},operations:[operation],output:{format:'png',metadata:'strip'}};
const sources={};for(const file of ['packages/engines/src/pipeline.ts','packages/engines/src/native.ts','packages/core/src/index.ts','packages/contract/src/index.ts'])sources[file]=hash(await fs.readFile(file));
const report={scope:'Actual native A4 synthetic correctness output; no physical printer, official-photo, phone or inference claim',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,observed_at:new Date().toISOString(),source_hashes:sources,input_hash:hash(input),status:'IN PROGRESS'};
const processor=createProcessor();
try{
 const result=await processor.transform(input,recipe);await fs.writeFile(path.join(output,'a4.png'),result.bytes);await fs.writeFile(path.join(output,'a4-record.json'),JSON.stringify(result.record,null,2));
 const decoded=await sharp(result.bytes).ensureAlpha().raw().toBuffer(),expected=Buffer.alloc(2480*3508*4,255),placements=[];
 for(let row=0;row<5;row++)for(let col=0;col<4;col++){
  const x=118+col*(413+59),y=118+row*(531+59);placements.push({x,y});
  for(let dy=0;dy<height;dy++)raw.copy(expected,((y+dy)*2480+x)*4,dy*width*4,(dy+1)*width*4);
 }
 const metadata=await sharp(result.bytes).metadata();
 Object.assign(report,{input_preserved:hash(await fs.readFile(path.join(output,'item.png')))===hash(input),output_hash_matches:hash(result.bytes)===result.record.output.hash,width:metadata.width,height:metadata.height,density:metadata.density,exact_decoded_pixels:decoded.equals(expected),decoded_bytes:decoded.length,placements});
 assert.deepEqual([metadata.width,metadata.height,metadata.density],[2480,3508,300]);assert.equal(report.exact_decoded_pixels,true);assert.equal(report.input_preserved,true);assert.equal(report.output_hash_matches,true);
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error);throw error;}
finally{await processor.dispose();await fs.writeFile(path.join(output,'properties.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
