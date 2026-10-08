import { SuperasterError } from '../../contract/src/index.js';
export interface ModelDefinition { id:string; name:string; repository:string; revision:string; file:string; bytes:number; sha256:string; inputSize:number; license:string; url:string;version:string;width:number;height:number;precision:'fp16';inputName:string;outputName:string }
const definitions = [
 {id:'birefnet-512-fp16',name:'BiRefNet 512 Quality',repository:'naddy24/birefnet-512-webgpu',revision:'ca02a86c094927479e2be583abe87f8ea73fcfda',file:'onnx/model_fp16.onnx',bytes:473435223,sha256:'6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8',inputSize:512,license:'MIT',url:'https://huggingface.co/naddy24/birefnet-512-webgpu/resolve/ca02a86c094927479e2be583abe87f8ea73fcfda/onnx/model_fp16.onnx'},
 {id:'birefnet-lite-512-fp16',name:'BiRefNet lite 512 Fast',repository:'studioludens/birefnet-lite-512',revision:'4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7',file:'onnx/model_fp16.onnx',bytes:98484532,sha256:'eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516',inputSize:512,license:'MIT',url:'https://huggingface.co/studioludens/birefnet-lite-512/resolve/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7/onnx/model_fp16.onnx'}
] as const;
export const MODELS:readonly ModelDefinition[] = definitions.map(model=>({...model,version:model.revision,width:512,height:512,precision:'fp16',inputName:'input_image',outputName:'output_image'}));
export const resolveModel=chooseModel;
export function listModels(): readonly ModelDefinition[] { return MODELS; }
export function chooseModel(engine='auto',quality='quality'):ModelDefinition {
 const id=engine==='auto'?(quality==='fast'?'birefnet-lite-512-fp16':'birefnet-512-fp16'):engine;
 const definition=MODELS.find(model=>model.id===id);
 if(!definition) throw new SuperasterError('UNSUPPORTED',`Engine ${engine} is not an approved model`,{available:MODELS.map(model=>model.id)});
 return definition;
}
