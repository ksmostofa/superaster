import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { createReadStream, existsSync } from 'node:fs';
import {resolve} from 'node:path';
const headers={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({
 root:'packages/web',plugins:[react(),tailwind(),{name:'local-approved-models',configureServer(server){server.middlewares.use('/models/',(req,res,next)=>{const id=req.url?.split('?')[0]?.replace(/^\//,'');if(!id||!/^birefnet(?:-lite)?-512-fp16\.onnx$/.test(id)){next();return;}const path=resolve('.cache/models',id);if(!existsSync(path)){next();return;}res.setHeader('Content-Type','application/octet-stream');res.setHeader('Cross-Origin-Resource-Policy','same-origin');createReadStream(path).pipe(res);});}}],
 server:{headers,port:5173,strictPort:true},preview:{headers,port:5173,strictPort:true},worker:{format:'es'},
 build:{outDir:'../../dist/web',emptyOutDir:true,target:'es2022'},
});
