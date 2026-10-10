#!/usr/bin/env python3
"""Named synthetic DeformConv probe, unrelated to image/model quality."""
import argparse, importlib.metadata, json, os, pathlib, sys, time
from prepare import hash_file
from run import check_network_isolation, prohibit_network, write_json

def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
    if a.output.exists():raise ValueError('Use a fresh synthetic-probe evidence directory')
    isolation=check_network_isolation(True)
    os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',CUDA_VISIBLE_DEVICES='')
    sys.addaudithook(prohibit_network)
    import numpy as np
    import torch, torchvision, onnx, onnxruntime as ort
    from native_deform import register
    versions={n:importlib.metadata.version(n) for n in ('torch','torchvision','onnx','onnxruntime','protobuf','flatbuffers')}
    if versions!={'torch':'2.5.1+cpu','torchvision':'0.20.1+cpu','onnx':'1.17.0','onnxruntime':'1.30.0','protobuf':'4.25.8','flatbuffers':'25.2.10'}:raise ValueError('Unexpected research probe dependencies')
    torch.set_num_threads(1);torch.set_num_interop_threads(1);register();a.output.mkdir(parents=True)
    class Probe(torch.nn.Module):
        def __init__(self,padding):super().__init__();self.padding=padding
        def forward(self,image,weight,offset,mask,bias):
            return torchvision.ops.deform_conv2d(image,offset,weight,bias=bias,padding=self.padding,mask=mask)
    fixtures=[
        {'id':'zero-offset-3x3-padding','padding':1,
         'image':np.arange(1,10,dtype=np.float32).reshape(1,1,3,3),'weight':np.ones((1,1,3,3),np.float32),
         'offset':np.zeros((1,18,3,3),np.float32),'mask':np.ones((1,9,3,3),np.float32),'bias':np.array([0.5],np.float32),
         'expected':np.array([12.5,21.5,16.5,27.5,45.5,33.5,24.5,39.5,28.5],np.float32).reshape(1,1,3,3),
         'reason':'Independent integer 3x3 neighborhood sums under zero padding, plus 0.5 bias'},
        {'id':'fractional-asymmetric-offset-edge-mask','padding':0,
         'image':np.array([1,2,3,4],np.float32).reshape(1,1,2,2),'weight':np.array([2],np.float32).reshape(1,1,1,1),
         'offset':np.array([0.5]*4+[0.25]*4,np.float32).reshape(1,2,2,2),'mask':np.array([1,0.5,2,0],np.float32).reshape(1,1,2,2),'bias':np.array([0.5],np.float32),
         'expected':np.array([5,2.75,7,0.5],np.float32).reshape(1,1,2,2),
         'reason':'Hand-derived bilinear samples [2.25,2.25,1.625,1.5]; dy=0.5/dx=0.25; zero outside input; modulation [1,0.5,2,0]; multiply weight 2 then add bias 0.5'}
    ]
    report={'scope':'Synthetic operator compatibility, not model inference/quality or hardware acceptance','network_isolation':isolation,'versions':versions,'ort_build':ort.get_build_info(),'symbolic_sha256':hash_file(pathlib.Path(__file__).with_name('native_deform.py')),'cases':[]}
    for fixture in fixtures:
        names=('image','weight','offset','mask','bias');arguments=tuple(torch.from_numpy(fixture[n]) for n in names);model=Probe(fixture['padding']).eval()
        with torch.inference_mode():reference=model(*arguments).numpy()
        if not np.array_equal(reference,fixture['expected']):raise ValueError(f'{fixture["id"]}: Torch differs from independent exact expected values')
        graph=a.output/(fixture['id']+'.onnx')
        with torch.inference_mode():torch.onnx.export(model,arguments,graph,opset_version=19,dynamo=False,input_names=list(names),output_names=['output'],do_constant_folding=False)
        onnx.checker.check_model(str(graph));parsed=onnx.load(graph)
        if [(n.domain,n.op_type) for n in parsed.graph.node]!=[('','DeformConv')]:raise ValueError('Unexpected tiny operator graph')
        opts=ort.SessionOptions();opts.intra_op_num_threads=1;opts.inter_op_num_threads=1
        session=ort.InferenceSession(str(graph),sess_options=opts,providers=['CPUExecutionProvider'])
        inputs={name:fixture[name] for name in names};output=session.run(['output'],inputs)[0]
        if output.dtype!=np.float32 or not np.array_equal(output,fixture['expected']):raise ValueError(f'{fixture["id"]}: ORT CPU differs from independent exact expected values')
        row={'id':fixture['id'],'scope':'SYNTHETIC KERNEL FIXTURE','graph_path':graph.name,'graph_bytes':graph.stat().st_size,'graph_sha256':hash_file(graph),
             'inputs':{n:{'dtype':'float32','dims':list(fixture[n].shape),'data':fixture[n].ravel().tolist()} for n in names},
             'expected':{'dtype':'float32','dims':list(fixture['expected'].shape),'data':fixture['expected'].ravel().tolist()},
             'independent_expected_reason':fixture['reason'],'torch_exact_expected':'PASS','ort_cpu_exact_expected':'PASS','ort_cpu_output':output.ravel().tolist(),'providers':session.get_providers()}
        report['cases'].append(row);write_json(a.output/'probe.json',report)
    print(json.dumps({'synthetic_operator_cpu':'PASS','cases':len(fixtures),'full_model_parity':'NOT RUN','browser':'NOT RUN','quality':'NOT AWARDED'}))

if __name__=='__main__':main()
