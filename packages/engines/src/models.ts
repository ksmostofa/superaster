import { SuperasterError } from '../../contract/src/index.js';
import type { Raster } from './raster.js';
export interface ModelDefinition { id:string; name:string; repository:string; revision:string; file:string; bytes:number; sha256:string; inputSize:number; license:string; url:string;version:string;width:number;height:number;precision:string;inputName:string;outputName:string;normalization:'imagenet'|'unit';outputType:'float32'|'float16';outputActivation:'logits'|'coverage' }
const definitions = [
 {id:'birefnet-512-fp16',name:'BiRefNet 512 Quality',repository:'naddy24/birefnet-512-webgpu',revision:'ca02a86c094927479e2be583abe87f8ea73fcfda',file:'onnx/model_fp16.onnx',bytes:473435223,sha256:'6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8',inputSize:512,license:'MIT',url:'https://huggingface.co/naddy24/birefnet-512-webgpu/resolve/ca02a86c094927479e2be583abe87f8ea73fcfda/onnx/model_fp16.onnx'},
 {id:'birefnet-lite-512-fp16',name:'BiRefNet lite 512 Fast',repository:'studioludens/birefnet-lite-512',revision:'4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7',file:'onnx/model_fp16.onnx',bytes:98484532,sha256:'eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516',inputSize:512,license:'MIT',url:'https://huggingface.co/studioludens/birefnet-lite-512/resolve/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7/onnx/model_fp16.onnx'},
 {id:'birefnet-lite-1024-fp16',name:'BiRefNet lite 1024 candidate',repository:'onnx-community/BiRefNet_lite-ONNX',revision:'de15b22ba131738a16dff04aab8bdf8dc32e3ac1',file:'onnx/model_fp16.onnx',bytes:114538221,sha256:'d39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402',inputSize:1024,license:'MIT',url:'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/de15b22ba131738a16dff04aab8bdf8dc32e3ac1/onnx/model_fp16.onnx'},
 {"id":"birefnet-full-1024-fp16","name":"BiRefNet full 1024 candidate","repository":"onnx-community/BiRefNet-ONNX","revision":"534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67","file":"onnx/model_fp16.onnx","bytes":489666272,"sha256":"3654c741eb80bd926ada8fed1713b506ccf8d30eb1f6487e87eb9f234f33df09","inputSize":1024,"width":1024,"height":1024,"license":"MIT","precision":"fp16","inputName":"input_image","outputName":"output_image","normalization":"imagenet","outputType":"float32","outputActivation":"logits","version":"534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67","url":"https://huggingface.co/onnx-community/BiRefNet-ONNX/resolve/534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67/onnx/model_fp16.onnx"},
 {id:'ben2-base-1024',name:'BEN2 Base candidate',repository:'PramaLLC/BEN2',revision:'e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f',file:'BEN2_Base.onnx',bytes:222932053,sha256:'22cea62108ff53b7ccc20f7a008bf30494228d84b1687f29ecbe76936a998101',inputSize:1024,license:'MIT',url:'https://huggingface.co/PramaLLC/BEN2/resolve/e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f/BEN2_Base.onnx',precision:'mixed fp32/fp16 weights',inputName:'input.1',outputName:'17728',normalization:'unit',outputType:'float16',outputActivation:'coverage'}
] as const;
const birefContract={precision:'fp16',inputName:'input_image',outputName:'output_image',normalization:'imagenet',outputType:'float32',outputActivation:'logits'} as const;
export const MODELS:readonly ModelDefinition[] = definitions.map(model=>({...birefContract,...model,version:model.revision,width:model.inputSize,height:model.inputSize}));
export const resolveModel=chooseModel;
export function listModels(): readonly ModelDefinition[] { return MODELS; }
export function chooseModel(engine='auto',quality='quality'):ModelDefinition {
 const id=engine==='auto'?(quality==='fast'?'birefnet-lite-512-fp16':'birefnet-512-fp16'):engine;
 const definition=MODELS.find(model=>model.id===id);
 if(!definition) throw new SuperasterError('UNSUPPORTED',`Engine ${engine} is not an approved model`,{available:MODELS.map(model=>model.id)});
 return definition;
}
export function modelInput(raster:Raster,model:ModelDefinition):Float32Array {
 const pixels=model.width*model.height;if(raster.width!==model.width||raster.height!==model.height||raster.data.length!==pixels*4)throw new SuperasterError('PROCESSING_FAILED','Model preprocessing raster shape mismatch');
 const data=new Float32Array(3*pixels),mean=[.485,.456,.406],std=[.229,.224,.225];
 for(let c=0;c<3;c++)for(let i=0;i<pixels;i++){const value=raster.data[i*4+c]!/255;data[c*pixels+i]=model.normalization==='imagenet'?(value-mean[c]!)/std[c]!:value;}return data;
}
function half(bits:number):number {const sign=bits&0x8000?-1:1,exponent=(bits>>>10)&31,mantissa=bits&1023;if(exponent===31)return mantissa?NaN:sign*Infinity;return exponent===0?sign*2**-14*(mantissa/1024):sign*2**(exponent-15)*(1+mantissa/1024);}
export function modelAlpha(data:ArrayLike<unknown>,model:ModelDefinition):Float32Array {
 const pixels=model.width*model.height;if(data.length!==pixels)throw new SuperasterError('PROCESSING_FAILED','Model output length differs from its profile');const alpha=new Float32Array(pixels);
 for(let i=0;i<pixels;i++){const raw=data[i];if(typeof raw!=='number')throw new SuperasterError('PROCESSING_FAILED','Model output is not numeric');const value=model.outputType==='float16'&&data instanceof Uint16Array?half(raw):raw;if(!Number.isFinite(value))throw new SuperasterError('PROCESSING_FAILED','Model produced nonfinite alpha');const coverage=model.outputActivation==='logits'?1/(1+Math.exp(-value)):value;if(coverage<0||coverage>1)throw new SuperasterError('PROCESSING_FAILED','Model coverage is outside [0,1]');alpha[i]=coverage;}return alpha;
}
