#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createCatalog,monitorCatalogSources} from '../packages/catalog/src/index.js';
if(process.argv.length!==4||process.argv[2]!=='--output'||!process.argv[3])throw new Error('Use monitor-catalog.ts --output NEW_SNAPSHOT_FILE');
const output=resolve(process.argv[3]);
const observations=await monitorCatalogSources(createCatalog().publishedRecords());
// Observations never approve rules or mutate immutable records. Maintainers review
// changed/unknown responses before updating the distributed observation snapshot.
createCatalog(undefined,{monitor_results:observations});
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(observations,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sources:observations.length,statuses:observations.reduce<Record<string,number>>((counts,item)=>({...counts,[item.status]:(counts[item.status]??0)+1}),{}),rules_approved:false}));
