import { mkdir, writeFile } from 'node:fs/promises';
import { RecipeSchema, OperationSchema } from '../packages/contract/src/index.js';
await mkdir('schemas',{recursive:true});
await writeFile('schemas/recipe-1.0.json', JSON.stringify(RecipeSchema,null,2)+'\n');
await writeFile('schemas/operation-1.0.json', JSON.stringify(OperationSchema,null,2)+'\n');
