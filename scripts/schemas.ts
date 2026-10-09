import { mkdir, writeFile } from 'node:fs/promises';
import { RecipeSchema, OperationSchema, ImageInfoSchema, ErrorSchema, FileBatchManifestSchema, ExecutionRecordSchema } from '../packages/contract/src/index.js';
await mkdir('schemas',{recursive:true});
await writeFile('schemas/recipe-1.0.json', JSON.stringify(RecipeSchema,null,2)+'\n');
await writeFile('schemas/operation-1.0.json', JSON.stringify(OperationSchema,null,2)+'\n');
for(const [name,schema]of Object.entries({'image-info-1.0':ImageInfoSchema,'error-1.0':ErrorSchema,'file-batch-1.0':FileBatchManifestSchema,'execution-record-1.0':ExecutionRecordSchema}))await writeFile('schemas/'+name+'.json',JSON.stringify(schema,null,2)+'\n');
