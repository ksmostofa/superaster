import {readdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root='dist/web';
let files=(await readdir(root,{recursive:true,withFileTypes:true})).filter(item=>item.isFile()).map(item=>join(item.parentPath,item.name).slice(root.length+1)).filter(path=>!path.startsWith('_')&&path!=='sw.js');
// ORT's universal bundle emits a WebNN asyncify binary even though Superaster
// only requests WASM/WebGPU. WebGPU receives its verified jsep bytes directly.
const unused=await readFile('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm'),unusedHash=createHash('sha256').update(unused).digest('hex');
for(const file of files){const bytes=await readFile(join(root,file));if(file.includes('ort-wasm-simd-threaded.asyncify-')&&createHash('sha256').update(bytes).digest('hex')===unusedHash){await unlink(join(root,file));files=files.filter(value=>value!==file);continue;}if(bytes.length>25*1024*1024)throw new Error(`Static deployment asset exceeds 25 MiB: ${file}`);}
const hash=createHash('sha256');for(const file of files.sort())hash.update(file).update(await readFile(join(root,file)));
const cache='superaster-app-'+hash.digest('hex').slice(0,16);
const assets=files.map(file=>'/'+file);
await writeFile(join(root,'sw.js'),`// Generated from exact build assets. Image bytes are never sent to this worker.\nconst CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(assets)};\nself.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});\nself.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('superaster-app-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});\nself.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}if(!ASSETS.includes(url.pathname))return;event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))??fetch(request)));});\n`);
console.log(JSON.stringify({cache,assets:assets.length}));
