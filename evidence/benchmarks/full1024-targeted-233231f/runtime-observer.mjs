// Diagnostic observer: actual production session.run returns unchanged tensors.
import * as ort from 'onnxruntime-node';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const originalRun = ort.InferenceSession.prototype.run;
const records = [];
const summary = tensor => ({type:tensor.type,dimensions:tensor.dims,data_constructor:tensor.data.constructor.name,elements:tensor.data.length,bytes:tensor.data.byteLength});
function statistics(data, sigmoid=false) {
  const finite=[];let nonfinite=0,nonnumeric=0,above=0,sum=0;
  for(const raw of data){
    if(typeof raw!=='number'){nonnumeric++;continue;}
    const value=sigmoid?1/(1+Math.exp(-raw)):raw;
    if(!Number.isFinite(value)){nonfinite++;continue;}
    finite.push(value);sum+=value;if(value>0.5/255)above++;
  }
  finite.sort((a,b)=>a-b);
  const quantile=p=>{if(!finite.length)return null;const i=(finite.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return finite[lo]+(finite[hi]-finite[lo])*(i-lo);};
  return {finite_count:finite.length,nonfinite_count:nonfinite,nonnumeric_count:nonnumeric,min:finite[0]??null,max:finite.at(-1)??null,mean:finite.length?sum/finite.length:null,quantiles:{p01:quantile(.01),p50:quantile(.5),p99:quantile(.99)},quantile_method:'sorted finite values, linear interpolation at (n-1)*p',...(sigmoid?{alpha_above_half_byte_boundary:above,alpha_at_or_below_half_byte_boundary:finite.length-above,boundary:0.5/255,boundary_purpose:'existing nearest-byte PNG quantization diagnostic, not a quality acceptance threshold'}:{})};
}
ort.InferenceSession.prototype.run = async function (...args) {
  const output=await Reflect.apply(originalRun,this,args);
  const start=performance.now();
  const observed={inputs:Object.fromEntries(Object.entries(args[0]).map(([name,tensor])=>[name,summary(tensor)])),outputs:Object.fromEntries(Object.entries(output).map(([name,tensor])=>[name,{...summary(tensor),raw_logits:statistics(tensor.data),continuous_sigmoid_alpha:statistics(tensor.data,true)}]))};
  records.push(observed);
  observed.observer_statistics_ms=performance.now()-start;
  const hash=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
  await writeFile('.cache/full1024-runtime-statistics.json',JSON.stringify({scope:'Actual returned production CPU tensors observed without substitution; exactly one session run per case',observer_sha256:hash,timing_limit:'session.run timing includes observer statistics and JSON write. No budget or cross-model speed claim. observer_statistics_ms excludes hash/read/write overhead.',records},null,2)+'\n');
  return output;
};
await import('../scripts/evaluate-native.ts');
