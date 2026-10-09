import { mkdir,copyFile,rm,cp } from 'node:fs/promises';
await rm('packages/web/public/runtime',{recursive:true,force:true});
await mkdir('packages/web/public/runtime',{recursive:true});
for(const file of ['vips.wasm','vips-es6.js'])await copyFile('node_modules/wasm-vips/lib/'+file,'packages/web/public/runtime/'+file);
for(const file of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs'])await copyFile('node_modules/onnxruntime-web/dist/'+file,'packages/web/public/runtime/'+file);
await rm('packages/web/public/third-party-licenses',{recursive:true,force:true});
await cp('third-party-licenses','packages/web/public/third-party-licenses',{recursive:true});
await copyFile('THIRD_PARTY_NOTICES.md','packages/web/public/THIRD_PARTY_NOTICES.md');
