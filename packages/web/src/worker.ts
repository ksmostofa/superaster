import { BrowserEngine, browserModelStatus, installBrowserModel } from '../../engines/src/browser.js';
import { chooseModel } from '../../engines/src/models.js';
import { processingError } from '../../core/src/index.js';
import type { Recipe } from '../../contract/src/index.js';
const engine=new BrowserEngine();let queue=Promise.resolve();
self.addEventListener('message',(event:MessageEvent<{id:number;kind:string;input?:Uint8Array;recipe?:Recipe;model?:string;bindings?:Record<string,Uint8Array>}>)=>{
 const {id,kind,input,recipe,model,bindings}=event.data;
 queue=queue.then(async()=>{
  const onProgress=(progress:unknown)=>self.postMessage({id,progress});
  try{let value:unknown;
   if(kind==='inspect'&&input)value=await engine.inspect(input);
   else if(kind==='execute'&&input&&recipe)value=await engine.execute(input,recipe,{onProgress,bindings});
   else if(kind==='models')value=await browserModelStatus();
   else if(kind==='install'&&model){const definition=chooseModel(model,'fast');await installBrowserModel(definition,{onProgress});value={id:definition.id,cached:true};}
   else throw new Error('Unknown worker request');self.postMessage({id,value});
  }catch(error){self.postMessage({id,error:processingError(error).toJSON()});}
 });
});
