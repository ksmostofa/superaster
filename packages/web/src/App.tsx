import {CatalogPage} from './components/catalog-page.js';
import {DocsPage} from './components/docs-page.js';
import {ImageControls} from './components/image-controls.js';
import {GooeyNav} from './components/gooey-nav.js';
import {Button} from './components/button.js';
import {useState,useEffect,useRef} from 'react';
import {zipSync,strToU8} from 'fflate';
import {Processor,processingError,sha256,recipeHash,plan,bindingHashes,type ProcessResult} from '../../core/src/index.js';
import {parseRecipe,SuperasterError,type Recipe,type Operation,type Progress,type ImageInfo} from '../../contract/src/index.js';
import {registerWebTools,type WebTools} from './webmcp.js';
import {MODELS} from '../../engines/src/models.js';
import {BrowserWorkerEngine} from './client.js';
import {listPresets,resolvePreset,resolvePresetStatus,validate,preparePreset} from '../../catalog/src/index.js';
import {loadEditor,paint,renderMask,encodeMask,type MaskState} from './editor.js';

interface Item {id:number;file:File;status:'queued'|'running'|'completed'|'failed'|'cancelled';result?:ProcessResult;url?:string;error?:string;input_hash?:string;recipe_hash?:string;requested_recipe_hash?:string;requested_recipe?:Recipe;failure?:ReturnType<SuperasterError['toJSON']>;info?:ImageInfo;bindings?:Record<string,Uint8Array>}
const initialRecipe:Recipe={spec_version:'1.0',input:{ref:'input-0'},engine:'auto',quality:'quality',operations:[{op:'remove_background',edge_cleanup:'none'}],output:{format:'png',metadata:'strip'}};
function restoredRecipe(){try{const raw=localStorage.getItem('superaster.recipe.v1');return raw?parseRecipe(JSON.parse(raw)):initialRecipe;}catch{return initialRecipe;}}
function download(bytes:Uint8Array,name:string,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([Uint8Array.from(bytes)],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export function App(){
 const engine=useRef<BrowserWorkerEngine|null>(null),processor=useRef<Processor|null>(null);
 const nextItemId=useRef(0),toolsActions=useRef<WebTools|null>(null),busyRef=useRef(false);
 const [tab,setTab]=useState(location.pathname==='/presets'?'presets':location.pathname==='/docs'?'docs':'remove'),[items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState<number>(),[busy,setBusy]=useState(false),[progress,setProgress]=useState<Progress>(),[error,setError]=useState(''),[recipe,setRecipe]=useState<Recipe>(restoredRecipe),[recipeText,setRecipeText]=useState(()=>JSON.stringify(restoredRecipe(),null,2)),[preview,setPreview]=useState('cutout'),[background,setBackground]=useState('checker'),[modelStatus,setModelStatus]=useState<{id:string;cached:boolean}[]>([]),[info,setInfo]=useState<ImageInfo>(),[dragging,setDragging]=useState(false),[presetId,setPresetId]=useState(''),[rules,setRules]=useState<ReturnType<typeof validate>>([]);
 const [appControlled,setAppControlled]=useState(Boolean(navigator.serviceWorker?.controller)),[appCached,setAppCached]=useState(false),[appUpdate,setAppUpdate]=useState(false),[boundFiles,setBoundFiles]=useState<Record<string,File>>({});
 const [editor,setEditor]=useState<MaskState>(),[brush,setBrush]=useState<'erase'|'restore'>('erase'),[radius,setRadius]=useState(24),[history,setHistory]=useState<Uint8Array[]>([]),[future,setFuture]=useState<Uint8Array[]>([]),[brushX,setBrushX]=useState('0'),[brushY,setBrushY]=useState('0');
 const canvas=useRef<HTMLCanvasElement>(null),abort=useRef<AbortController|undefined>(undefined),fileInput=useRef<HTMLInputElement>(null),itemsRef=useRef<Item[]>([]),painting=useRef(false),pointerPrev=useRef<{x:number;y:number}|undefined>(undefined);
 const active=items.find(item=>item.id===selected),[originalUrl,setOriginalUrl]=useState<string>();
 const visibleInfo=preview==='original'?active?.info:active?.result?.record.output??active?.info;
 useEffect(()=>{itemsRef.current=items;},[items]);
 useEffect(()=>{let mounted=true;const adapter=new BrowserWorkerEngine();const service=new Processor(adapter);engine.current=adapter;processor.current=service;const unregister=registerWebTools(()=>toolsActions.current!,setError);void adapter.request<typeof modelStatus>('models').then(value=>{if(mounted)setModelStatus(value);}).catch(e=>{if(mounted)setError(processingError(e).message);});return()=>{mounted=false;unregister();void service.dispose();for(const item of itemsRef.current)if(item.url)URL.revokeObjectURL(item.url);};},[]);
 useEffect(()=>{const url=active?.info?URL.createObjectURL(active.file):undefined;setOriginalUrl(url);setEditor(undefined);setHistory([]);setFuture([]);setInfo(active?.result?.record.output??active?.info);setRules(active?.result?.record.rules??[]);return()=>{if(url)URL.revokeObjectURL(url);};},[selected,active?.file,active?.info]);
 useEffect(()=>{try{localStorage.setItem('superaster.recipe.v1',JSON.stringify(recipe));}catch{setError('Recipe storage is unavailable. Download your recipe to keep it.');}},[recipe]);
 useEffect(()=>{
  if(import.meta.env.DEV||!('serviceWorker' in navigator))return;
  let mounted=true;let registration:ServiceWorkerRegistration|undefined;let installing:ServiceWorker|null= null;
  const refresh=()=>{if(mounted&&registration){setAppCached(Boolean(registration.active));setAppUpdate(Boolean(registration.waiting));setAppControlled(Boolean(navigator.serviceWorker.controller));}};
  const installed=()=>{if(installing?.state==='installed')refresh();else if(mounted&&installing?.state==='redundant'){refresh();setError('Offline app setup or update could not be cached. Download exports, close all Superaster tabs, then reopen. If caching still fails, clear this site’s browser cache and prepare its offline assets again.');}};
  const found=()=>{installing=registration?.installing??null;installing?.addEventListener('statechange',installed);};
  const controlled=()=>refresh();
  navigator.serviceWorker.addEventListener('controllerchange',controlled);
  void navigator.serviceWorker.register('/sw.js').then(value=>{if(!mounted)return;registration=value;refresh();found();value.addEventListener('updatefound',found);return navigator.serviceWorker.ready;}).then(()=>refresh()).catch(error=>{if(mounted)setError('Offline app setup failed: '+processingError(error).message);});
  return()=>{mounted=false;navigator.serviceWorker.removeEventListener('controllerchange',controlled);registration?.removeEventListener('updatefound',found);installing?.removeEventListener('statechange',installed);};
 },[]);
 useEffect(()=>{if(editor&&canvas.current)renderMask(canvas.current,editor);},[editor]);
 const updateRecipe=(next:Recipe)=>{setRecipe(next);setRecipeText(JSON.stringify(next,null,2));};
 const beginAttempt=async(id:number,value:Recipe)=>{
  setItems(old=>old.map(item=>item.id===id?{...item,status:'running',recipe_hash:undefined,requested_recipe_hash:undefined,requested_recipe:value,error:undefined,failure:undefined}:item));
  const requestedHash=await recipeHash(value);setItems(old=>old.map(item=>item.id===id?{...item,requested_recipe_hash:requestedHash}:item));
 };
 toolsActions.current={
  capabilities:()=>processor.current!.capabilities(),
  inputs:()=>itemsRef.current.map(item=>({ref:'image-'+item.id,name:item.file.name,status:item.status,info:item.info})),
  inspect:async(ref,signal)=>{const item=itemsRef.current.find(item=>'image-'+item.id===ref);if(!item)throw new SuperasterError('INVALID_INPUT','Select the input file through this page first');return item.info??await processor.current!.inspect(new Uint8Array(await item.file.arrayBuffer()),{signal});},
  transform:async(ref,value,signal)=>{
   if(busyRef.current)throw new SuperasterError('LIMIT_EXCEEDED','Another image operation is running');const item=itemsRef.current.find(item=>'image-'+item.id===ref);if(!item)throw new SuperasterError('INVALID_INPUT','Select the input file through this page first');
   busyRef.current=true;setBusy(true);setError('');setSelected(item.id);setTab('remove');setEditor(undefined);const controller=new AbortController();abort.current=controller;
   try{
    await beginAttempt(item.id,value);
    const bindings:Record<string,Uint8Array>={...item.bindings};for(const [name,file]of Object.entries(boundFiles)){if(file.size>engine.current!.capabilities().limits.max_bytes)throw new SuperasterError('LIMIT_EXCEEDED','Bound file exceeds the compressed byte limit');bindings[name]=new Uint8Array(await file.arrayBuffer());}
    const attemptedRecipeHash=await recipeHash(plan(value,engine.current!),await bindingHashes(value,bindings));setItems(old=>old.map(i=>i.id===item.id?{...i,recipe_hash:attemptedRecipeHash}:i));
    const result=await processor.current!.transform(new Uint8Array(await item.file.arrayBuffer()),value,{bindings,signal:AbortSignal.any([signal,controller.signal]),onProgress:setProgress});
    if(itemsRef.current.reduce((sum,i)=>sum+(i.id===item.id?0:i.result?.bytes.length??0),result.bytes.length)>128*1024*1024)throw new SuperasterError('LIMIT_EXCEEDED','Batch output memory limit reached; download completed images and clear the batch');
    const url=URL.createObjectURL(new Blob([Uint8Array.from(result.bytes)]));if(item.url)URL.revokeObjectURL(item.url);setItems(old=>old.map(i=>i.id===item.id?{...i,result,url,status:'completed',bindings,recipe_hash:result.record.recipe_hash,error:undefined,failure:undefined}:i));setInfo(result.record.output);setRules(result.record.rules);updateRecipe(value);
    return {input_ref:ref,output_url:url,record:result.record,download:'Use the page Download image or batch ZIP action; this blob URL lasts for the active page'};
   }catch(error){const failure=processingError(error);setError(failure.message);setItems(old=>old.map(i=>i.id===item.id?{...i,status:failure.code==='CANCELLED'?'cancelled':'failed',error:failure.message,failure:failure.toJSON()}:i));throw failure;}
   finally{busyRef.current=false;setBusy(false);setProgress(undefined);abort.current=undefined;}
  }
 };
 const addFiles=async(files:File[])=>{
  if(busyRef.current){setError('Wait for the running operation before adding images.');return;}
  setError('');if(files.length+itemsRef.current.length>100){setError('Select up to 100 images per local batch.');return;}
  busyRef.current=true;setBusy(true);const controller=new AbortController();abort.current=controller;const next:Item[]=[];
  try{for(const file of files){const item:Item={id:++nextItemId.current,file,status:'queued'};try{if(file.size>engine.current!.capabilities().limits.max_bytes)throw new SuperasterError('LIMIT_EXCEEDED','Input exceeds the compressed file limit');const bytes=new Uint8Array(await file.arrayBuffer());item.input_hash=await sha256(bytes);item.info=await processor.current!.inspect(bytes,{signal:controller.signal});}catch(error){const failure=processingError(error);item.status=failure.code==='CANCELLED'?'cancelled':'failed';item.error=failure.message;item.failure=failure.toJSON();}next.push(item);}itemsRef.current=[...itemsRef.current,...next];setItems(itemsRef.current);setSelected(next[0]?.id);}
  finally{busyRef.current=false;setBusy(false);abort.current=undefined;}
 };
 const applyText=()=>{try{updateRecipe(parseRecipe(JSON.parse(recipeText)));setError('');}catch(e){setError(processingError(e).message);}};
 const refreshModels=async()=>setModelStatus(await engine.current!.request<typeof modelStatus>('models'));
 const process=async(targets:Item[],resume=false)=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setEditor(undefined);const controller=new AbortController();abort.current=controller;let retained=itemsRef.current.reduce((sum,item)=>sum+(item.result?.bytes.length??0),0);
  let requestedRecipe=recipe;const targetIds=new Set(targets.map(item=>item.id));
  try {
   requestedRecipe=parseRecipe(recipe);if(presetId){const preset=resolvePreset(presetId);requestedRecipe={...requestedRecipe,preset:{id:preset.id,version:preset.version}};}
   const requestedHash=await recipeHash(requestedRecipe);
   setItems(old=>old.map(item=>targetIds.has(item.id)?{...item,recipe_hash:undefined,requested_recipe_hash:requestedHash,requested_recipe:requestedRecipe}:item));
   const currentRecipe=presetId?preparePreset(resolvePreset(presetId),requestedRecipe):requestedRecipe;
   const suppliedBindings:Record<string,Uint8Array>={};for(const [ref,file] of Object.entries(boundFiles)){if(file.size>engine.current!.capabilities().limits.max_bytes)throw new SuperasterError('LIMIT_EXCEEDED','Bound image exceeds compressed byte limit');suppliedBindings[ref]=new Uint8Array(await file.arrayBuffer());}
   for(const item of targets){
    const bindings={...item.bindings,...suppliedBindings};
    try {
     const attemptedRecipeHash=await recipeHash(plan(currentRecipe,engine.current!),await bindingHashes(currentRecipe,bindings));setItems(old=>old.map(i=>i.id===item.id?{...i,recipe_hash:attemptedRecipeHash}:i));
     if(!item.info&&item.failure?.code!=='CANCELLED'&&item.failure?.code!=='PROCESSING_FAILED')continue;
     if(controller.signal.aborted)throw new SuperasterError('CANCELLED','Not scheduled after cancellation');
     if(resume&&item.status==='completed'&&item.result){if(await sha256(new Uint8Array(await item.file.arrayBuffer()))===item.result.record.input_hash&&attemptedRecipeHash===item.result.record.recipe_hash&&await sha256(item.result.bytes)===item.result.record.output.hash)continue;}
     setSelected(item.id);setItems(old=>old.map(i=>i.id===item.id?{...i,status:'running',error:undefined,failure:undefined}:i));
     const bytes=new Uint8Array(await item.file.arrayBuffer()),inputInfo=item.info??await processor.current!.inspect(bytes,{signal:controller.signal});const result=await processor.current!.transform(bytes,currentRecipe,{signal:controller.signal,onProgress:setProgress,bindings});
     if(retained-(item.result?.bytes.length??0)+result.bytes.length>128*1024*1024)throw new SuperasterError('LIMIT_EXCEEDED','Batch output memory limit reached; download completed images and clear the batch before continuing');
     retained+=result.bytes.length-(item.result?.bytes.length??0);const url=URL.createObjectURL(new Blob([Uint8Array.from(result.bytes)]));if(item.url)URL.revokeObjectURL(item.url);
     setItems(old=>old.map(i=>i.id===item.id?{...i,status:'completed',result,url,bindings,info:inputInfo,recipe_hash:result.record.recipe_hash,error:undefined,failure:undefined}:i));setInfo(result.record.output);if(presetId)setRules(validate(result.record.output,resolvePreset(presetId)));
    }catch(error){const failure=processingError(error);setItems(old=>old.map(i=>i.id===item.id?{...i,status:failure.code==='CANCELLED'?'cancelled':'failed',error:failure.message,failure:failure.toJSON()}:i));setError(failure.message);}
   }
  }catch(error){const failure=processingError(error);setError(failure.message);const requestedHash=await recipeHash(requestedRecipe);setItems(old=>old.map(item=>targetIds.has(item.id)?{...item,status:failure.code==='CANCELLED'?'cancelled':'failed',recipe_hash:undefined,requested_recipe:requestedRecipe,requested_recipe_hash:requestedHash,error:failure.message,failure:failure.toJSON()}:item));}
  finally{busyRef.current=false;setBusy(false);setProgress(undefined);abort.current=undefined;await refreshModels().catch(()=>{});}
 };
 const install=async(id:string)=>{busyRef.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;try{await engine.current!.request('install',{model:id},{signal:controller.signal,onProgress:setProgress});await refreshModels();}catch(e){setError(processingError(e).message);}finally{busyRef.current=false;setBusy(false);setProgress(undefined);abort.current=undefined;}};
 const importModel=async(id:string,file:File)=>{const model=MODELS.find(model=>model.id===id)!;if(file.size!==model.bytes){setError('This file does not match the approved artifact size.');return;}busyRef.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;try{await engine.current!.request('importModel',{model:id,input:new Uint8Array(await file.arrayBuffer())},{signal:controller.signal,onProgress:setProgress});await refreshModels();}catch(error){setError(processingError(error).message);}finally{busyRef.current=false;setBusy(false);setProgress(undefined);abort.current=undefined;}};
 const startCorrection=async()=>{
  if(!active?.result||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
  try{
   let mask=active.result.mask;const operations=active.result.record.resolved_recipe.operations;
   if(!operations.some(op=>op.op==='remove_background'))throw new SuperasterError('INVALID_RECIPE','Correction requires a removal mask.');
   const geometryIndex=operations.findIndex(op=>['resize','canvas','crop','subject_crop','rotate','flip','print_sheet'].includes(op.op));
   if(geometryIndex>=0){
    if(operations.slice(geometryIndex).some(op=>op.op==='remove_background'||op.op==='correct'))throw new SuperasterError('UNSUPPORTED','This recipe removes or corrects after geometry changes. Correct the original-size removal first, then apply geometry.');
    const removalRecipe={...active.result.record.resolved_recipe,operations:operations.slice(0,geometryIndex),output:{format:'png' as const,metadata:'strip' as const}};
    mask=(await processor.current!.transform(new Uint8Array(await active.file.arrayBuffer()),removalRecipe,{bindings:{...active.bindings},signal:controller.signal,onProgress:setProgress})).mask;
   }
   if(!mask)throw new SuperasterError('PROCESSING_FAILED','No foreground coverage mask is available for this result.');
   const next=await loadEditor(active.file,mask);if(controller.signal.aborted)throw new SuperasterError('CANCELLED','Correction preparation cancelled');
   setEditor(next);setBrushX(String(Math.floor(next.width/2)));setBrushY(String(Math.floor(next.height/2)));setHistory([]);setFuture([]);
  }catch(error){setError(processingError(error).message);}
  finally{busyRef.current=false;setBusy(false);setProgress(undefined);abort.current=undefined;}
 };
 const paintAtPosition=()=>{if(!editor)return;const x=Number(brushX),y=Number(brushY);if(!brushX||!brushY||!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=editor.width||y<0||y>=editor.height){setError('Choose a brush position within the original image dimensions.');return;}const next={...editor,alpha:editor.alpha.slice()};setHistory(old=>[...old.slice(-9),editor.alpha.slice()]);setFuture([]);paint(next,x,y,radius,brush);setEditor(next);setError('');};
 const point=(event:React.PointerEvent<HTMLCanvasElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return{x:(event.clientX-rect.left)*event.currentTarget.width/rect.width,y:(event.clientY-rect.top)*event.currentTarget.height/rect.height};};
 const draw=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!editor||!painting.current)return;const pos=point(event),previous=pointerPrev.current??pos,steps=Math.max(1,Math.ceil(Math.hypot(pos.x-previous.x,pos.y-previous.y)/Math.max(1,radius/3)));for(let i=1;i<=steps;i++)paint(editor,previous.x+(pos.x-previous.x)*i/steps,previous.y+(pos.y-previous.y)*i/steps,radius,brush);pointerPrev.current=pos;renderMask(event.currentTarget,editor);};
 const commitCorrection=async()=>{
  if(!editor||!active?.result||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');const controller=new AbortController();abort.current=controller;
  try{
   const base=active.result.record.resolved_recipe;
   const operations:Operation[]=base.operations.filter(op=>op.op!=='correct');const removeIndex=operations.findIndex(op=>op.op==='remove_background');
   if(removeIndex<0)throw new SuperasterError('INVALID_RECIPE','Correction requires a removal operation');
   operations.splice(removeIndex+1,0,{op:'correct',mask_ref:'edited-mask'});
   const next={...base,operations};await beginAttempt(active.id,next);const mask=await encodeMask(editor),bindings={...active.bindings,'edited-mask':mask};
   const attemptedRecipeHash=await recipeHash(plan(next,engine.current!),await bindingHashes(next,bindings));setItems(old=>old.map(item=>item.id===active.id?{...item,recipe_hash:attemptedRecipeHash}:item));
   const result=await processor.current!.transform(new Uint8Array(await active.file.arrayBuffer()),next,{bindings,signal:controller.signal,onProgress:setProgress});
   if(itemsRef.current.reduce((sum,item)=>sum+(item.id===active.id?0:item.result?.bytes.length??0),result.bytes.length)>128*1024*1024)throw new SuperasterError('LIMIT_EXCEEDED','Batch output memory limit reached; download and clear completed images');
   if(active.url)URL.revokeObjectURL(active.url);const url=URL.createObjectURL(new Blob([Uint8Array.from(result.bytes)]));
   setItems(old=>old.map(item=>item.id===active.id?{...item,status:'completed',result,url,bindings,recipe_hash:result.record.recipe_hash,error:undefined,failure:undefined}:item));updateRecipe(next);setInfo(result.record.output);setRules(result.record.rules);setEditor(undefined);
  }catch(error){const failure=processingError(error);setError(failure.message);setItems(old=>old.map(item=>item.id===active.id?{...item,status:failure.code==='CANCELLED'?'cancelled':'failed',error:failure.message,failure:failure.toJSON()}:item));}
  finally{busyRef.current=false;setBusy(false);setProgress(undefined);abort.current=undefined;}
 };
 const zip=()=>{const entries:Record<string,Uint8Array>={},manifest=items.map((item,index)=>{const output=item.result?`${String(index+1).padStart(3,'0')}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}.${item.result.record.output.format}`:undefined;if(item.result&&output){entries[output]=item.result.bytes;entries[output+'.json']=strToU8(JSON.stringify(item.result.record,null,2));}return {index:index+1,input_ref:'image-'+item.id,input:item.file.webkitRelativePath||item.file.name,status:item.status,output,input_hash:item.input_hash??item.result?.record.input_hash,recipe_hash:item.recipe_hash,requested_recipe_hash:item.requested_recipe_hash,requested_recipe:item.requested_recipe,output_recipe_hash:item.result?.record.recipe_hash,error:item.failure??(item.error?new SuperasterError('PROCESSING_FAILED',item.error).toJSON():undefined)};});entries['manifest.json']=strToU8(JSON.stringify(manifest,null,2));download(zipSync(entries,{level:0}),'superaster-batch.zip','application/zip');};
 const clear=()=>{for(const item of items)if(item.url)URL.revokeObjectURL(item.url);setItems([]);setSelected(undefined);setEditor(undefined);};
 const go=(next:string)=>{setTab(next);window.history.replaceState(null,'',next==='remove'?'/remove':'/'+next);};
 const primaryActions=<div className={'primary-actions '+(active?.result?'has-result':'')}>{busy?<Button className="secondary" onClick={()=>abort.current?.abort()}>Cancel</Button>:<>{active?.result?<Button className="primary" disabled={!!editor} onClick={()=>download(active.result!.bytes,active.file.name+'.'+active.result!.record.output.format,'image/'+active.result!.record.output.format)}>Download image</Button>:null}<Button className={active?.result?'secondary':'primary'} disabled={!items.some(item=>item.info||item.failure?.code==='CANCELLED'||item.failure?.code==='PROCESSING_FAILED')||!!editor} onClick={()=>void process(items.length===1?items:items.some(i=>i.status!=='completed')?items.filter(i=>i.status!=='completed'):items)}>{items.length>1?'Process batch':active?.result?'Process again':recipe.operations.some(op=>op.op==='remove_background')?'Remove background':'Prepare image'}</Button></>}</div>;
 return <div className="app-shell">
  <header><a className="brand" href="/remove" onClick={e=>{e.preventDefault();go('remove');}}><img src="/favicon.svg" alt=""/>Superaster</a><GooeyNav aria-label="Workspaces" items={['Remove','Destinations','Docs']} value={['remove','presets','docs'].indexOf(tab)} size="sm" separation={8} onChange={index=>go(['remove','presets','docs'][index]!)}/><span className={'local-label '+(appUpdate?'has-update':'')}>{appUpdate?<small>Update downloaded. Download exports, close all Superaster tabs, then reopen to apply.</small>:appCached?appControlled?'App cached · local processing':'App cached · reload before offline use':'Local processing'}</span></header>
  {tab==='remove'?<main>
   <div className={'intro '+(active?'has-image':'')}><div><h1>Remove background</h1><p>Inspect the edges. Prepare the exact export.</p></div>{active?<Button className="secondary" onClick={()=>fileInput.current?.click()} disabled={busy}>Add images</Button>:null}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>{void addFiles(Array.from(e.target.files??[]));e.target.value='';}}/></div>
   <div className="workspace">
    <section className="image-area" aria-label="Image work area">
     {!active?<div className={'drop-area '+(dragging?'dragging':'')} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void addFiles(Array.from(e.dataTransfer.files));}}><img className="aster-mark" src="/logo-particles.svg" alt="" aria-hidden="true"/><h2>Start with an image</h2><p>Drop images here, or choose files.</p><Button className="primary" onClick={()=>fileInput.current?.click()}>Choose images</Button><small>JPEG, PNG or WebP. Originals stay untouched.<br/>Models download separately. No image upload or account.</small></div>:<>
      <div className="image-toolbar"><span className="filename">{active.file.name}</span><div className="segmented" aria-label="Preview">{['original','cutout'].map(p=><Button key={p} onClick={()=>setPreview(p)} disabled={p==='cutout'&&!active.result} aria-pressed={preview===p}>{p==='original'?'Original':'Result'}</Button>)}</div></div>
      <div className={'viewer '+background}>
       {editor?<canvas ref={canvas} aria-label="Mask correction canvas" onPointerDown={e=>{const before=editor.alpha.slice();e.currentTarget.setPointerCapture(e.pointerId);painting.current=true;pointerPrev.current=undefined;setHistory(old=>[...old.slice(-9),before]);setFuture([]);draw(e);}} onPointerMove={draw} onPointerUp={()=>{painting.current=false;pointerPrev.current=undefined;}} onPointerCancel={()=>{painting.current=false;}}/>:originalUrl?<img src={preview==='cutout'&&active.url?active.url:originalUrl} alt={preview==='cutout'&&active.result?'Processed image':'Original input'}/>:<p className="invalid-preview">{active.error??'Inspecting the selected file'}</p>}
       {busy&&active.status==='running'?<div className="stage-overlay" role="status">{progress?.message??progress?.stage??'Preparing image'}</div>:null}
      </div>
      <div className="image-bottom"><span className="image-properties">{editor?'Mask correction':preview==='original'||!active.result?'Original':'Result'}{visibleInfo?` · ${visibleInfo.width} × ${visibleInfo.height} · ${visibleInfo.format.toUpperCase()} · ${(visibleInfo.bytes/1024).toFixed(0)} KB`:''}</span><div className="preview-backgrounds" aria-label="Preview background">{(['checker','light','dark'] as const).map(bg=><Button key={bg} aria-label={`${bg==='checker'?'Transparent':bg==='light'?'White':'Dark'} preview background only`} aria-pressed={background===bg} onClick={()=>setBackground(bg)}><span className={'swatch '+bg} aria-hidden="true"/>{bg==='checker'?'Transparent':bg==='light'?'White':'Dark'}</Button>)}</div>{active.result?.record.resolved_recipe.operations.some(op=>op.op==='remove_background')?<Button className="secondary correct-mask" disabled={busy||!!editor} onClick={startCorrection}>Correct mask</Button>:null}</div>
     </>}
     {items.length>1?<div className="batch-list" aria-label="Batch images">{items.map((item,index)=><Button disabled={busy} className={item.id===selected?'active-item':''} onClick={()=>setSelected(item.id)} key={item.id}><span>{String(index+1).padStart(2,'0')} · {item.file.name}</span><small>{item.status}</small></Button>)}</div>:null}
    </section>
    <aside aria-label="Processing and export settings" className={active?.result?'has-result':undefined}>
     <div className="panel-heading"><h2>Prepare & export</h2><span className="badge">Local alpha</span></div>
     {active?.result?primaryActions:null}
     <div className="quick-settings"><label>Quality<select value={recipe.quality} disabled={busy} onChange={e=>updateRecipe({...recipe,quality:e.target.value as Recipe['quality']})}><option value="quality">Quality</option><option value="fast">Fast · lighter model</option></select></label>
     <label>Export format<select value={recipe.output.format} disabled={busy} onChange={e=>updateRecipe({...recipe,output:{...recipe.output,format:e.target.value as Recipe['output']['format']}})}><option value="png">PNG · transparency</option><option value="webp">WebP</option><option value="jpeg">JPEG · opaque background required</option></select></label>
     </div>
     {!active?.result?primaryActions:null}
     <small className="action-note">{!active?'Choose an image to begin. Models download separately.':active.result?'Downloads use the shown result. Process again to apply settings.':'Processing stays on your device. Models download separately.'}</small>
     {progress?<div role="status" className="progress"><span>{progress.stage}</span>{progress.total?<><progress value={progress.completed??0} max={progress.total}/><small>{((progress.completed??0)/1024/1024).toFixed(1)} / {(progress.total/1024/1024).toFixed(1)} MiB</small></>:<small>{progress.message??'Working on your device'}</small>}</div>:null}
     {error?<div role="alert" className="error"><strong>Could not finish</strong><p>{error}</p></div>:null}
     {active?.error&&active.error!==error?<p className="item-error">{active.error}</p>:null}
     <small className="engine-summary">Engine: {recipe.engine==='auto'?'Auto':recipe.engine}</small>
     <details><summary>Destination</summary><label>Destination profile<select value={presetId} disabled={busy} onChange={e=>setPresetId(e.target.value)}><option value="">Custom preparation</option>{listPresets().map(preset=><option key={preset.id+'@'+preset.version} value={preset.id}>{preset.purpose} · {preset.channel}</option>)}</select></label></details>
     <details><summary>Advanced engine</summary><label>Engine<select value={recipe.engine} disabled={busy} onChange={e=>updateRecipe({...recipe,engine:e.target.value})}><option value="auto">Auto · selected quality, available backend</option>{MODELS.flatMap(model=>['auto','wasm','webgpu'].map(backend=><option key={model.id+':'+backend} value={backend==='auto'?model.id:model.id+':'+backend}>{model.name} · {backend==='auto'?'Auto backend':backend==='wasm'?'WASM':'WebGPU'}</option>))}</select></label><p>Quality and Fast keep their selected model. Experimental candidates are explicit choices, not quality-approved defaults.</p></details>
     <ImageControls recipe={recipe} disabled={busy} onChange={updateRecipe} onError={setError}/><details><summary>Exact recipe</summary><p>Ordered operations and explicit constraints. Apply before processing.</p><textarea aria-label="Operation recipe JSON" value={recipeText} onChange={e=>setRecipeText(e.target.value)} spellCheck={false}/><Button className="secondary" disabled={busy} onClick={applyText}>Apply recipe</Button><Button className="text-button" onClick={()=>download(strToU8(JSON.stringify(active?.result?.record.resolved_recipe??recipe,null,2)),'superaster-recipe.json','application/json')}>Save recipe</Button><label className="import-label">Load recipe<input type="file" accept="application/json,.json" onChange={async e=>{try{const file=e.target.files?.[0];if(file)updateRecipe(parseRecipe(JSON.parse(await file.text())));}catch(err){setError(processingError(err).message);}}}/></label></details>
     {[...new Set(recipe.operations.flatMap(op=>op.op==='composite'&&op.image_ref?[op.image_ref]:op.op==='correct'&&op.mask_ref?[op.mask_ref]:[]))].map(ref=><label key={ref}>Bound input: {ref}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)setBoundFiles(old=>({...old,[ref]:file}));}}/></label>)}
     {presetId?<>{resolvePresetStatus(presetId).notices.map(notice=><p className="destination-note" key={notice.kind}>{notice.message}</p>)}<p className="destination-note">Destination preparation uses reviewed contain/white-background or fixed-grid settings. Restrictions are checked before processing. <Button className="text-button" disabled={busy||!active?.info} onClick={()=>{try{if(active?.info)setRules(validate(active.info,resolvePreset(presetId)));}catch(error){setError(processingError(error).message);}}}>Validate original</Button></p></>:null}
     {editor?<div className="correction"><h3>Correct coverage</h3><div className="segmented"><Button disabled={busy} aria-pressed={brush==='erase'} onClick={()=>setBrush('erase')}>Erase</Button><Button disabled={busy} aria-pressed={brush==='restore'} onClick={()=>setBrush('restore')}>Restore original</Button></div><label>Brush radius · {radius}px<input disabled={busy} type="range" min="2" max="160" value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label><div className="inline-actions"><Button disabled={busy||!history.length} onClick={()=>{const previous=history.at(-1)!;setFuture(old=>[...old,editor.alpha.slice()]);setHistory(old=>old.slice(0,-1));setEditor({...editor,alpha:previous});}}>Undo</Button><Button disabled={busy||!future.length} onClick={()=>{const next=future.at(-1)!;setHistory(old=>[...old,editor.alpha.slice()]);setFuture(old=>old.slice(0,-1));setEditor({...editor,alpha:next});}}>Redo</Button></div><Button className="primary" disabled={busy} onClick={()=>void commitCorrection()}>Apply correction</Button><Button className="text-button" disabled={busy} onClick={()=>setEditor(undefined)}>Discard correction</Button><div className="control-grid"><label>Brush center X<input disabled={busy} type="number" min="0" max={editor.width-1} value={brushX} onChange={event=>setBrushX(event.target.value)}/></label><label>Brush center Y<input disabled={busy} type="number" min="0" max={editor.height-1} value={brushY} onChange={event=>setBrushY(event.target.value)}/></label></div><Button className="secondary" disabled={busy} onClick={paintAtPosition}>Apply brush at position</Button><small>Touch or drag over the image, or enter original-image coordinates and apply the selected brush with the keyboard.</small></div>:null}
     {active?.result?<div className="execution"><Button className="text-button" onClick={()=>download(strToU8(JSON.stringify(active.result!.record,null,2)),'execution-record.json','application/json')}>Download execution record</Button>{active.result.mask?<Button className="text-button" onClick={()=>download(active.result!.mask!,'coverage-mask.png','image/png')}>Download mask</Button>:null}<small>{active.result.record.engine.id} · {active.result.record.engine.backend}</small>{active.result.record.warnings.map(w=><p key={w}>{w}</p>)}</div>:null}
     {rules.length?<ul className="rules">{rules.map(rule=><li key={rule.id}><span className={'rule-state '+rule.state}>{rule.state.replace('_',' ')}</span>{rule.message}</li>)}</ul>:null}
     {items.length>1?<div className="batch-actions"><p>{items.filter(i=>i.status==='completed').length} / {items.length} completed</p><Button className="secondary" disabled={busy||!items.some(i=>i.result)} onClick={zip}>Download batch ZIP</Button><Button className="text-button" disabled={busy} onClick={()=>void process(items.filter(i=>i.status==='failed'||i.status==='cancelled'))}>Retry unfinished</Button><Button className="text-button" disabled={busy} onClick={()=>void process(items,true)}>Resume & verify</Button></div>:null}
     <details><summary>Model preparation</summary>{MODELS.map(model=><div className="model-row" key={model.id}><span>{model.name}<small>{(model.bytes/1024/1024).toFixed(0)} MiB · {model.license}</small></span><Button disabled={busy} onClick={()=>void install(model.id)}>{modelStatus.find(m=>m.id===model.id)?.cached?'Verify cache':'Prepare'}</Button><label className="model-import">Import approved artifact<input type="file" accept=".onnx" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void importModel(model.id,file);}}/></label></div>)}<p>Processing is local. Set up the app, runtime and model before going offline. Browser limits are provisional pending device validation.</p></details>
     {items.length?<Button className="text-button" disabled={busy} onClick={clear}>Clear local batch</Button>:null}
    </aside>
   </div>
  </main>:tab==='presets'?<CatalogPage onSelectPreset={id=>{setPresetId(id);go('remove');}}/>:<DocsPage/>}
  <footer><span>Free supported exports. No watermark. No image uploads.</span><span>UI adapted from <a href="https://rareui.com">Rare UI</a> and <a href="https://animate-ui.com">Animate UI</a> · <a href="https://github.com/ksmostofa/superaster">GitHub</a> · <a href="/THIRD_PARTY_NOTICES.md">Notices</a></span></footer>
 </div>;
}
