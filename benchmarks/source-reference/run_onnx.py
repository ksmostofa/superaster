#!/usr/bin/env python3
"""One explicitly approved CPU ONNX diagnosis using saved source tensors."""
import argparse, importlib.metadata, json, os, pathlib, resource, sys, time
from prepare import FILES, REVISION, hash_file
from run import MANIFEST_HASH, NETWORK_ATTEMPTS, check_network_isolation, prohibit_network, save_outputs, tensor_stats, verify_manifest, write_json

OUTPUT_DIRECTORY=None
CURRENT_STAGE='arguments'

def main():
    global OUTPUT_DIRECTORY,CURRENT_STAGE
    p=argparse.ArgumentParser();p.add_argument('--artifact',type=pathlib.Path,required=True);p.add_argument('--export-report',type=pathlib.Path,required=True);p.add_argument('--source-run',type=pathlib.Path,required=True);p.add_argument('--manifest',type=pathlib.Path,required=True);p.add_argument('--corpus-root',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--run',action='store_true');a=p.parse_args()
    if not a.run:raise ValueError('Heavy ONNX execution requires coordinator-approved --run')
    if a.output.exists():raise ValueError('Use a fresh evidence directory')
    artifact=json.loads(a.export_report.read_text());source=json.loads((a.source_run/'conditions.json').read_text());source_results=json.loads((a.source_run/'results.json').read_text())
    for conditions in (artifact,source):
        revision=conditions.get('source_revision',conditions.get('revision'));weight=conditions.get('source_weight_sha256',conditions.get('weight_sha256'))
        if revision!=REVISION or weight!=FILES['model.safetensors'][1] or conditions['manifest_sha256']!=MANIFEST_HASH:raise ValueError('Different source checkpoint or manifest')
    if source['inference']!='completed' or hash_file(a.artifact)!=artifact['onnx_artifact_sha256']:raise ValueError('Changed artifact or incomplete source execution')
    manifest=verify_manifest(a.manifest,a.corpus_root.resolve());isolation=check_network_isolation(True)
    os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',CUDA_VISIBLE_DEVICES='');sys.addaudithook(prohibit_network)
    import numpy as np
    import torch
    import onnxruntime as ort
    from PIL import Image
    if importlib.metadata.version('onnxruntime')!='1.30.0':raise ValueError('Expected exact ORT CPU 1.30.0')
    torch.set_num_threads(4);torch.set_num_interop_threads(1)
    a.output.mkdir(parents=True);OUTPUT_DIRECTORY=a.output;CURRENT_STAGE='initialize_cpu_onnx_session';print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
    options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1;options.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    t=time.perf_counter();session=ort.InferenceSession(str(a.artifact),sess_options=options,providers=['CPUExecutionProvider']);initialization_ms=(time.perf_counter()-t)*1000
    inputs=session.get_inputs();outputs=session.get_outputs()
    if len(inputs)!=1 or inputs[0].name!='image' or inputs[0].type!='tensor(float)' or inputs[0].shape!=[1,3,1024,1024]:raise ValueError('Unexpected actual ONNX input interface')
    if len(outputs)!=1 or outputs[0].name!='logits' or outputs[0].type!='tensor(float)' or outputs[0].shape!=[1,1,1024,1024]:raise ValueError('Unexpected actual ONNX output interface')
    conditions={'mode':'execute-onnx','revision':REVISION,'weight_sha256':FILES['model.safetensors'][1],'manifest_sha256':MANIFEST_HASH,'onnx_artifact_sha256':artifact['onnx_artifact_sha256'],'source_conditions_sha256':hash_file(a.source_run/'conditions.json'),'script_sha256':hash_file(pathlib.Path(__file__)),'network_isolation':isolation,'network_attempts':NETWORK_ATTEMPTS,'inference':'pending','session_initialization_ms':initialization_ms,'providers':session.get_providers(),'ort_build':ort.get_build_info(),'environment':{name:importlib.metadata.version(name) for name in ('onnxruntime','torch','numpy','Pillow')},'semantics':'Exact saved source NCHW input, native float32 ONNX raw logits, one Torch sigmoid and same diagnostic exports; no refinement or color cleanup','cases':[]}
    results=[];write_json(a.output/'conditions.json',conditions)
    for case in manifest['cases']:
        CURRENT_STAGE=f'onnx_inference:{case["id"]}';print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
        record=next(r for r in source_results if r['id']==case['id']);input_file=a.source_run/case['id']/'input.npy';expected=next(f for f in record['exports']['files'] if f['path']=='input.npy')
        if hash_file(input_file)!=expected['sha256']:raise ValueError('Saved source tensor changed')
        array=np.load(input_file,allow_pickle=False)
        if array.dtype!=np.float32 or array.shape!=(1,3,1024,1024) or not np.isfinite(array).all():raise ValueError('Unexpected saved tensor properties')
        directory=a.output/case['id'];directory.mkdir();t=time.perf_counter();raw=session.run(['logits'],{'image':array})[0];inference_ms=(time.perf_counter()-t)*1000
        if raw.dtype!=np.float32 or raw.shape!=(1,1,1024,1024) or not np.isfinite(raw).all():raise ValueError('Unexpected actual ONNX tensor properties')
        logits=torch.from_numpy(raw);coverage=logits.sigmoid()
        with Image.open(a.corpus_root/case['evaluation']['path']) as image:rgba=np.array(image.convert('RGBA'),copy=True)
        t=time.perf_counter();exports=save_outputs(case,directory,rgba,logits,coverage,torch.from_numpy(array));export_ms=(time.perf_counter()-t)*1000
        row={'id':case['id'],'input_sha256':case['evaluation']['sha256'],'retained_subject':case['retained_subject'],'first_image':not results,'stage_timings':{'inference_ms':inference_ms,'diagnostic_export_ms':export_ms},'tensors':{'raw_logits':tensor_stats(logits),'continuous_coverage':tensor_stats(coverage)},'exports':exports,'process_peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,'quality':'needs_review'}
        results.append(row);conditions['cases'].append({'id':case['id'],'input_sha256':case['evaluation']['sha256']});write_json(directory/'record.json',row);write_json(a.output/'results.json',results);write_json(a.output/'conditions.json',conditions)
        del array,raw,logits,coverage,rgba
    verify_manifest(a.manifest,a.corpus_root.resolve());del session
    conditions['inference']='completed';conditions['process_peak_rss_bytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024;write_json(a.output/'conditions.json',conditions)
    print(json.dumps({'onnx_cpu_execution':'completed','cases':len(results),'parity':'MEASUREMENT PENDING','quality':'NOT AWARDED'}))

if __name__=='__main__':
    try:main()
    except BaseException as error:
        if OUTPUT_DIRECTORY is not None:write_json(OUTPUT_DIRECTORY/'failure.json',{'status':'CANCELLED' if isinstance(error,KeyboardInterrupt) else 'FAIL','stage':CURRENT_STAGE,'type':type(error).__name__,'message':str(error),'network_attempts':NETWORK_ATTEMPTS,'process_high_water_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024})
        raise
