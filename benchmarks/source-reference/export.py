#!/usr/bin/env python3
"""Research proposal: export the exact source to float32 native-opset-19 ONNX."""
import argparse, collections, importlib.metadata, json, os, pathlib, resource, sys, time
from prepare import FILES, REVISION, hash_file
from run import EXPECTED_CASES, MANIFEST_HASH, NETWORK_ATTEMPTS, check_config, check_network_isolation, load_reviewed_module, prohibit_network, verify_sources, write_json

OUTPUT_DIRECTORY=None
CURRENT_STAGE='arguments'

def main():
    global OUTPUT_DIRECTORY,CURRENT_STAGE
    p=argparse.ArgumentParser();p.add_argument('--model-dir',type=pathlib.Path,required=True);p.add_argument('--source-run',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--execute',action='store_true');a=p.parse_args()
    if not a.execute:raise ValueError('Heavy export requires coordinator-approved --execute')
    if a.output.exists():raise ValueError('Use a fresh output directory')
    verify_sources(a.model_dir)
    conditions=json.loads((a.source_run/'conditions.json').read_text());results=json.loads((a.source_run/'results.json').read_text())
    if conditions['revision']!=REVISION or conditions['weight_sha256']!=FILES['model.safetensors'][1] or conditions['manifest_sha256']!=MANIFEST_HASH or conditions['inference']!='completed':raise ValueError('Use the exact completed source-reference run')
    if [c['id'] for c in conditions['cases']]!=list(EXPECTED_CASES) or [c['id'] for c in results]!=list(EXPECTED_CASES):raise ValueError('Changed source case count or identities')
    for case in conditions['cases']:
        if (case['input_sha256'],case['original_sha256'])!=EXPECTED_CASES[case['id']]:raise ValueError('Changed source evaluation/original identities')
    for record in results:
        if record['input_sha256']!=EXPECTED_CASES[record['id']][0]:raise ValueError('Changed source evaluation identity')
        file=next(f for f in record['exports']['files'] if f['path']=='input.npy')
        if hash_file(a.source_run/record['id']/file['path'])!=file['sha256']:raise ValueError('Saved model input changed')
    isolation=check_network_isolation(True)
    os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',CUDA_VISIBLE_DEVICES='')
    sys.addaudithook(prohibit_network)
    import numpy as np
    import torch
    import onnx
    from safetensors.torch import load_file
    from native_deform import register
    torch.set_num_threads(4);torch.set_num_interop_threads(1);torch.manual_seed(0)
    if torch.version.cuda is not None:raise ValueError('Expected CPU-only source environment')
    versions={name:importlib.metadata.version(name) for name in ('torch','torchvision','onnx','protobuf')}
    if versions!={'torch':'2.5.1+cpu','torchvision':'0.20.1+cpu','onnx':'1.17.0','protobuf':'4.25.8'}:raise ValueError('Unexpected exporter dependency versions')
    a.output.mkdir(parents=True);OUTPUT_DIRECTORY=a.output;CURRENT_STAGE='initialize_pinned_cpu_model'
    print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
    start=time.perf_counter();module=load_reviewed_module(a.model_dir.resolve())
    from reviewed_matting.BiRefNet_config import BiRefNetConfig
    model=module.BiRefNet(config=BiRefNetConfig(bb_pretrained=False));check_config(model.config)
    state=load_file(a.model_dir/'model.safetensors',device='cpu');model.load_state_dict(state,strict=True);del state
    model=model.to(device='cpu',dtype=torch.float32).eval()
    class LastLogits(torch.nn.Module):
        def __init__(self,model):super().__init__();self.model=model
        def forward(self,image):return self.model(image)[-1]
    array=np.load(a.source_run/conditions['cases'][0]['id']/'input.npy',allow_pickle=False)
    if array.shape!=(1,3,1024,1024) or array.dtype!=np.float32 or not np.isfinite(array).all():raise ValueError('Unexpected saved tensor')
    tensor=torch.from_numpy(array);register();path=a.output/'general-matting-f32-opset19.onnx'
    CURRENT_STAGE='trace_and_export';print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
    with torch.inference_mode():
        torch.onnx.export(LastLogits(model),tensor,path,opset_version=19,dynamo=False,
                          input_names=['image'],output_names=['logits'],export_params=True,
                          do_constant_folding=True,keep_initializers_as_inputs=False,
                          training=torch.onnx.TrainingMode.EVAL)
    export_seconds=time.perf_counter()-start
    del tensor,model,array
    CURRENT_STAGE='check_graph_and_interface';print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
    onnx.checker.check_model(str(path));graph=onnx.load(path)
    if any(t.external_data for t in graph.graph.initializer):raise ValueError('Expected one self-contained artifact; external tensor files need separate hashing')
    ops=collections.Counter((n.domain,n.op_type) for n in graph.graph.node)
    if any(domain not in ('','ai.onnx') for domain,_ in ops):raise ValueError('Unexpected custom operator domain')
    if ops[('','DeformConv')]==0:raise ValueError('Expected native DeformConv translation')
    def interface(value):return {'name':value.name,'dtype':value.type.tensor_type.elem_type,'shape':[d.dim_value for d in value.type.tensor_type.shape.dim]}
    inputs=[interface(v) for v in graph.graph.input];outputs=[interface(v) for v in graph.graph.output]
    if inputs!=[{'name':'image','dtype':1,'shape':[1,3,1024,1024]}] or outputs!=[{'name':'logits','dtype':1,'shape':[1,1,1024,1024]}]:raise ValueError('Unexpected graph interface')
    report={'status':'EXPORTED AND CHECKED; PARITY NOT RUN','source_revision':REVISION,'source_weight_sha256':FILES['model.safetensors'][1],
            'manifest_sha256':MANIFEST_HASH,'source_conditions_sha256':hash_file(a.source_run/'conditions.json'),
            'onnx_artifact_sha256':hash_file(path),'onnx_bytes':path.stat().st_size,'opsets':[{'domain':o.domain,'version':o.version} for o in graph.opset_import],
            'inputs':inputs,'outputs':outputs,'operator_counts':[{'domain':d,'op':op,'count':count} for (d,op),count in sorted(ops.items())],
            'export_script_sha256':hash_file(pathlib.Path(__file__)),'native_symbolic_sha256':hash_file(pathlib.Path(__file__).with_name('native_deform.py')),
            'dependency_lock_sha256':hash_file(pathlib.Path(__file__).with_name('export-requirements.lock.txt')),'versions':versions,'network_isolation':isolation,'network_attempts':NETWORK_ATTEMPTS,
            'export_seconds':export_seconds,'process_high_water_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,
            'semantics':'raw final logits; no in-graph sigmoid or foreground cleanup; static float32 1024 input',
            'quality':'NOT AWARDED','numerical_acceptance':'NOT AWARDED','cpu_browser_execution':'NOT RUN'}
    write_json(a.output/'export.json',report);print(json.dumps({'export':'completed','parity':'NOT RUN','artifact_sha256':report['onnx_artifact_sha256']}))

if __name__=='__main__':
    try:main()
    except BaseException as error:
        if OUTPUT_DIRECTORY is not None:
            write_json(OUTPUT_DIRECTORY/'failure.json',{'status':'CANCELLED' if isinstance(error,KeyboardInterrupt) else 'FAIL','stage':CURRENT_STAGE,'type':type(error).__name__,'message':str(error),'network_attempts':NETWORK_ATTEMPTS,'process_high_water_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024})
        raise
