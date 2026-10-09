// Read-only decoded-artifact verification. This file imports imaging and hashing only.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=dirname(fileURLToPath(import.meta.url));
const repo=resolve(root,'../../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=JSON.parse(await readFile(join(root,'results.json'),'utf8'));
const manifest=JSON.parse(await readFile(join(root,'targeted-manifest.json'),'utf8'));
const findings=[];
assert.equal(results.records.length,2);
for(const record of results.records){
 const item=manifest.cases.find(x=>x.id===record.id);assert(item);
 const dir=join(root,`${record.id}--1`);
 const input=await readFile(join(dir,'input.png')),output=await readFile(join(dir,'cutout.png')),mask=await readFile(join(dir,'alpha.png'));
 assert.equal(sha(input),item.evaluation.sha256);assert.equal(sha(output),record.output_sha256);assert.equal(sha(mask),record.mask_sha256);
 const original=await readFile(join(repo,item.original.path));assert.equal(sha(original),item.original.sha256);
 const rgba=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const source=await sharp(input).autoOrient().toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const maskMetadata=await sharp(mask).metadata();assert.equal(maskMetadata.channels,1);
 const alpha=await sharp(mask).toColourspace('b-w').raw().toBuffer({resolveWithObject:true});
 assert.equal(rgba.info.width,item.evaluation.width);assert.equal(rgba.info.height,item.evaluation.height);assert.equal(rgba.info.channels,4);
 assert.equal(alpha.info.width,item.evaluation.width);assert.equal(alpha.info.height,item.evaluation.height);assert.equal(alpha.info.channels,1);
 assert.equal(source.data.length,rgba.data.length);
 let transparent=0,partial=0,opaque=0,maskMismatch=0,opaqueChanged=0;
 for(let i=0;i<alpha.data.length;i++){
  const value=rgba.data[i*4+3];if(value===0)transparent++;else if(value===255)opaque++;else partial++;
  if(alpha.data[i]!==value)maskMismatch++;
  if(value===255&&(rgba.data[i*4]!==source.data[i*4]||rgba.data[i*4+1]!==source.data[i*4+1]||rgba.data[i*4+2]!==source.data[i*4+2]))opaqueChanged++;
 }
 assert.equal(maskMismatch,0);assert.equal(opaqueChanged,0);
 assert.equal(transparent,record.decoded_properties.transparent_pixels);assert.equal(partial,record.decoded_properties.partially_transparent_pixels);assert.equal(opaque,record.decoded_properties.opaque_pixels);
 findings.push({id:record.id,status:'PASS',input_sha256:sha(input),original_sha256:sha(original),output_sha256:sha(output),mask_sha256:sha(mask),width:rgba.info.width,height:rgba.info.height,mask_file_channels:maskMetadata.channels,mask_decoded_channels:alpha.info.channels,transparent_pixels:transparent,partial_pixels:partial,opaque_pixels:opaque,mask_alpha_mismatch_pixels:maskMismatch,opaque_rgb_changed_pixels:opaqueChanged});
}
await writeFile(join(root,'artifact-verification.json'),JSON.stringify({checked_at:new Date().toISOString(),scope:'Independent read-only decoded file/hash checks, without inference or a model session; no subject-quality score',results:findings},null,2)+'\n');
console.log('PASS: both saved artifacts, input/original hashes, alpha-mask equality and opaque RGB');
