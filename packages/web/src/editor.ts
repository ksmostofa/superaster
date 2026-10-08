import { SuperasterError } from '../../contract/src/index.js';
export interface MaskState{width:number;height:number;alpha:Uint8Array;source:Uint8ClampedArray}
export async function loadEditor(original:File,cutout:Uint8Array):Promise<MaskState>{
 const [source,output]=await Promise.all([createImageBitmap(original),createImageBitmap(new Blob([Uint8Array.from(cutout)],{type:'image/png'}))]);
 try {if(source.width!==output.width||source.height!==output.height)throw new SuperasterError('UNSUPPORTED','Correct before changing geometry; restore the original-size removal recipe first');
  const canvas=document.createElement('canvas');canvas.width=output.width;canvas.height=output.height;const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});if(!ctx)throw new Error('Canvas unavailable');ctx.drawImage(source,0,0);const rgba=ctx.getImageData(0,0,output.width,output.height).data;ctx.clearRect(0,0,output.width,output.height);ctx.drawImage(output,0,0);const pixels=ctx.getImageData(0,0,output.width,output.height).data;const alpha=new Uint8Array(output.width*output.height);for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3]!;return{width:output.width,height:output.height,alpha,source:rgba};
 }finally{source.close();output.close();}
}
export function paint(mask:MaskState,x:number,y:number,radius:number,mode:'erase'|'restore') {
 for(let py=Math.max(0,Math.floor(y-radius));py<Math.min(mask.height,Math.ceil(y+radius));py++)for(let px=Math.max(0,Math.floor(x-radius));px<Math.min(mask.width,Math.ceil(x+radius));px++)if((px-x)**2+(py-y)**2<=radius**2){const index=py*mask.width+px;mask.alpha[index]=mode==='erase'?0:mask.source[index*4+3]!;}
}
export function renderMask(canvas:HTMLCanvasElement,mask:MaskState){canvas.width=mask.width;canvas.height=mask.height;const data=new Uint8ClampedArray(mask.source);for(let i=0;i<mask.alpha.length;i++)data[i*4+3]=mask.alpha[i]!;canvas.getContext('2d')?.putImageData(new ImageData(data,mask.width,mask.height),0,0);}
export async function encodeMask(mask:MaskState):Promise<Uint8Array>{const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;const data=new Uint8ClampedArray(mask.width*mask.height*4);for(let i=0;i<mask.alpha.length;i++){data[i*4]=data[i*4+1]=data[i*4+2]=mask.alpha[i]!;data[i*4+3]=255;}canvas.getContext('2d')?.putImageData(new ImageData(data,mask.width,mask.height),0,0);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Mask encode failed')),'image/png'));return new Uint8Array(await blob.arrayBuffer());}
