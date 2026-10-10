#!/usr/bin/env python3
"""Research-only local CPU reference. Heavy execution requires explicit --run."""
from __future__ import annotations
import argparse, errno, hashlib, importlib, importlib.metadata, json, os, pathlib, resource, socket, sys, time, types
from prepare import FILES, REPOSITORY, REVISION, hash_file

MANIFEST_HASH = 'e293dfc4721a5394d9203da05f3064ea428ec65375541b31d39cbfd69330d2c9'
EXPECTED_CASES = {
 't01-three-birdwatchers': ('08eeb79ecc9b1b1ed5bf6c93631835005b240d24523303379384737694585734', '59240dd21009422421968a096a28a551caa4130d0e0435f549c632c7a7904dc7'),
 'thin-plant': ('11f56e745cf24d162b5a415db8035c61e195c99411428ce210b1923240cd0b2b', '20778fc6cc3b0a862578ec669d3714b00fcf9202591ac04dac7290ff70273ed9'),
}
NETWORK_ATTEMPTS=[]
OUTPUT_DIRECTORY=None
CURRENT_STAGE="arguments"
def prohibit_network(event,args):
    if event in ('socket.connect','socket.connect_ex','socket.getaddrinfo'):
        NETWORK_ATTEMPTS.append(event)
        raise RuntimeError('Network is prohibited during source-reference execution')

def check_network_isolation(required):
    facts={'required':required,'namespace':os.readlink('/proc/self/ns/net'),
           'interfaces':sorted(name for _,name in socket.if_nameindex())}
    if not required:
        facts['scope']='Python socket audit only; no OS isolation established'
        return facts
    if facts['interfaces']!=['lo']:raise ValueError('Expected an isolated Linux namespace with loopback only')
    facts['probes']=[]
    for family,address in ((socket.AF_INET,('1.1.1.1',443)),(socket.AF_INET6,('2606:4700:4700::1111',443))):
        with socket.socket(family,socket.SOCK_STREAM) as connection:
            connection.settimeout(1)
            try:connection.connect(address)
            except OSError as error:
                expected={errno.ENETUNREACH}
                if family==socket.AF_INET6:expected.add(errno.EADDRNOTAVAIL)
                if error.errno not in expected:raise
                facts['probes'].append({'family':'IPv4' if family==socket.AF_INET else 'IPv6','errno':error.errno,'result':'network unreachable' if error.errno==errno.ENETUNREACH else 'no IPv6 source address available'})
            else:raise ValueError('External connection succeeded; offline execution not established')
    facts['scope']='Linux isolated network namespace with loopback only; IPv4/IPv6 external connections unavailable'
    return facts

def write_json(path,value):path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')
def path_under(root,name):
    p=(root/name).resolve()
    if not p.is_relative_to(root):raise ValueError('Manifest path escapes corpus root')
    return p

def verify_manifest(path,root):
    if hash_file(path)!=MANIFEST_HASH:raise ValueError('Changed targeted manifest')
    data=json.loads(path.read_text())
    if [c['id'] for c in data['cases']]!=list(EXPECTED_CASES):raise ValueError('Changed case order or count')
    for case in data['cases']:
        for kind,expected in zip(('evaluation','original'),EXPECTED_CASES[case['id']]):
            info=case[kind];file=path_under(root,info['path'])
            if info['sha256']!=expected or hash_file(file)!=expected:raise ValueError(f'Changed {kind}: {case["id"]}')
    return data

def verify_sources(directory):
    for name,(size,digest) in FILES.items():
        p=directory/name
        if p.stat().st_size!=size or hash_file(p)!=digest:raise ValueError(f'Changed reviewed model file: {name}')
    config=json.loads((directory/'config.json').read_text())
    if config['bb_pretrained'] is not False:raise ValueError('Backbone downloads are prohibited')

def load_reviewed_module(directory):
    package=types.ModuleType('reviewed_matting');package.__path__=[str(directory)];sys.modules[package.__name__]=package
    return importlib.import_module('reviewed_matting.birefnet')

def check_config(cfg):
    expected={'bb':'swin_v1_l','size':1024,'SDPA_enabled':False,'refine':'','auxiliary_classification':False,'mul_scl_ipt':'cat','dec_att':'ASPPDeformable','dec_blk':'BasicDecBlk','cxt_num':3,'dec_ipt':True,'dec_ipt_split':True,'ms_supervision':True,'out_ref':True,'batch_size':4}
    for name,value in expected.items():
        if getattr(cfg,name)!=value:raise ValueError(f'Unreviewed config: {name}')
    return expected

def tensor_stats(tensor):
    import torch
    if not torch.isfinite(tensor).all():raise ValueError('Nonfinite reference tensor')
    return {'dtype':str(tensor.dtype),'shape':list(tensor.shape),'minimum':float(tensor.min()),'maximum':float(tensor.max()),'mean':float(tensor.mean())}

def save_outputs(case,directory,rgba,logits,coverage,input_tensor):
    import numpy as np
    import torch
    from PIL import Image
    width,height=case['evaluation']['width'],case['evaluation']['height']
    alpha=torch.nn.functional.interpolate(coverage,size=(height,width),mode='bilinear',align_corners=False)[0,0].numpy()
    alpha=alpha*(rgba[:,:,3].astype(np.float32)/255)
    np.save(directory/'input.npy',input_tensor.numpy(),allow_pickle=False)
    np.save(directory/'logits.npy',logits.numpy(),allow_pickle=False)
    np.save(directory/'coverage.npy',coverage.numpy(),allow_pickle=False)
    np.save(directory/'coverage-original.npy',alpha,allow_pickle=False)
    alpha_bytes=np.floor(np.clip(alpha,0,1)*255+0.5).astype(np.uint8)
    Image.fromarray(alpha_bytes).save(directory/'alpha.png')
    cutout=np.array(rgba,copy=True);cutout[:,:,3]=alpha_bytes
    Image.fromarray(cutout).save(directory/'cutout.png')
    for name,color in [('white',(255,255,255)),('black',(0,0,0)),('color',(255,0,255))]:
        a=alpha[:,:,None]
        rgb=np.floor(rgba[:,:,:3].astype(np.float32)*a+np.array(color,dtype=np.float32)*(1-a)+0.5).astype(np.uint8)
        Image.fromarray(rgb).save(directory/f'{name}.png')
    return {'alpha_min':int(alpha_bytes.min()),'alpha_max':int(alpha_bytes.max()),'transparent_pixels':int(np.count_nonzero(alpha_bytes==0)),'soft_pixels':int(np.count_nonzero((alpha_bytes>0)&(alpha_bytes<255))),'opaque_pixels':int(np.count_nonzero(alpha_bytes==255)),'files':[{ 'path':p.name,'bytes':p.stat().st_size,'sha256':hash_file(p)} for p in sorted(directory.iterdir())]}

def main():
    global OUTPUT_DIRECTORY,CURRENT_STAGE
    parser=argparse.ArgumentParser();parser.add_argument('--model-dir',type=pathlib.Path,required=True);parser.add_argument('--manifest',type=pathlib.Path,required=True);parser.add_argument('--corpus-root',type=pathlib.Path,required=True);parser.add_argument('--output',type=pathlib.Path,required=True);parser.add_argument('--threads',type=int,default=4);parser.add_argument('--run',action='store_true');parser.add_argument('--require-isolated-net',action='store_true');args=parser.parse_args()
    if args.threads<1 or args.threads>8:raise ValueError('Threads must be 1..8')
    args.model_dir=args.model_dir.resolve();args.corpus_root=args.corpus_root.resolve()
    if args.output.exists():raise ValueError('Use a new evidence directory; never overwrite prior results')
    args.output.mkdir(parents=True);OUTPUT_DIRECTORY=args.output;CURRENT_STAGE='verify_sources_and_inputs'
    started=time.perf_counter();verify_sources(args.model_dir);manifest=verify_manifest(args.manifest,args.corpus_root)
    network_isolation=check_network_isolation(args.require_isolated_net)
    os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1';os.environ['CUDA_VISIBLE_DEVICES']='';sys.addaudithook(prohibit_network)
    CURRENT_STAGE='import_reviewed_cpu_environment'
    import numpy as np
    import torch
    from PIL import Image
    from safetensors import safe_open
    from torchvision import transforms
    torch.set_num_threads(args.threads);torch.set_num_interop_threads(1);torch.manual_seed(0)
    if torch.version.cuda is not None:raise ValueError('Expected the pinned CPU-only PyTorch build')
    module=load_reviewed_module(args.model_dir);configuration=check_config(module.config)
    from reviewed_matting.BiRefNet_config import BiRefNetConfig
    local_configuration=BiRefNetConfig(bb_pretrained=False)
    if local_configuration.bb_pretrained is not False:raise ValueError('Unsafe backbone configuration')
    tensor_metadata=[]
    with safe_open(args.model_dir/'model.safetensors',framework='pt',device='cpu') as sf:
        for key in sorted(sf.keys()):
            item=sf.get_slice(key);tensor_metadata.append({'key':key,'shape':item.get_shape(),'dtype':item.get_dtype()})
    CURRENT_STAGE='allocation_free_state_preflight'
    with torch.device('meta'):prototype=module.BiRefNet(config=local_configuration)
    check_config(prototype.config)
    state_shapes={k:list(v.shape) for k,v in prototype.state_dict().items()}
    weight_shapes={item['key']:item['shape'] for item in tensor_metadata}
    if state_shapes!=weight_shapes:raise ValueError('Source architecture and pinned checkpoint state keys/shapes differ')
    if not all(t.device.type=='meta' for t in prototype.state_dict().values()):raise ValueError('Preflight unexpectedly materialized model buffers')
    meta_details={'status':'PASS','scope':'allocation-free meta construction and exact checkpoint state-key/shape match','logical_parameter_count':sum(p.numel() for p in prototype.parameters()),'state_tensor_count':len(state_shapes),'cpu_materialization':'NOT RUN'}
    del prototype
    transform=transforms.Compose([transforms.Resize((1024,1024)),transforms.ToTensor(),transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])])
    conditions={'mode':'execute' if args.run else 'preflight','repository':REPOSITORY,'revision':REVISION,'weight_sha256':FILES['model.safetensors'][1],'manifest_sha256':MANIFEST_HASH,'script_sha256':hash_file(pathlib.Path(__file__)),'prepare_sha256':hash_file(pathlib.Path(__file__).with_name('prepare.py')),'environment':{'python':sys.version,'platform':sys.platform,'cpu_only':torch.version.cuda is None,'threads':args.threads,'interop_threads':1,'packages':{name:importlib.metadata.version(name) for name in ('torch','torchvision','transformers','timm','numpy','Pillow','safetensors','kornia','einops','psutil')}},'reviewed_config':configuration,'meta_state_preflight':meta_details,'semantics':{'input':'Pillow RGB -> torchvision PIL bilinear 1024 square -> RGB 0..1 -> ImageNet normalization -> NCHW float32','output':'last raw float32 logits, one sigmoid, continuous half-pixel bilinear coverage to original dimensions, multiply original alpha, nearest-byte quantization','refinement':'none','color_cleanup':'none','precision':'float32 CPU; no autocast or compile','comparison':'source-reference only; no ONNX parity or numerical acceptance awarded','composites':'diagnostic byte-space RGB source-over using continuous coverage; not application color conformance'},'network_attempts':NETWORK_ATTEMPTS,'model_initialization':'NOT RUN' if not args.run else 'pending','inference':'NOT RUN' if not args.run else 'pending','cases':[]}
    conditions['network_isolation']=network_isolation
    conditions['requirements_lock_sha256']=hash_file(pathlib.Path(__file__).with_name('requirements.lock.txt'))
    conditions['python_executable_sha256']=hash_file(pathlib.Path(sys.executable).resolve())
    for case in manifest['cases']:
        file=path_under(args.corpus_root,case['evaluation']['path'])
        with Image.open(file) as image:
            if image.size!=(case['evaluation']['width'],case['evaluation']['height']):raise ValueError('Wrong dimensions')
            if image.getexif().get(274,1)!=1:raise ValueError('Expected orientation-normalized fixture')
            tensor=transform(image.convert('RGB')).unsqueeze(0)
        conditions['cases'].append({'id':case['id'],'input_sha256':case['evaluation']['sha256'],'original_sha256':case['original']['sha256'],'retained_subject':case['retained_subject'],'preprocess':tensor_stats(tensor)})
    import psutil
    conditions['available_memory_bytes']=psutil.virtual_memory().available
    conditions['preflight_ms']=(time.perf_counter()-started)*1000
    conditions['preflight_peak_rss_bytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024
    write_json(args.output/'conditions.json',conditions);write_json(args.output/'weight-tensors.json',tensor_metadata)
    if not args.run:
        print(json.dumps({'preflight':'PASS','model_initialization':'NOT RUN','inference':'NOT RUN','output':str(args.output),'weight_tensors':len(tensor_metadata)}));return
    CURRENT_STAGE='model_initialization';print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
    from safetensors.torch import load_file
    t=time.perf_counter();model=module.BiRefNet(config=local_configuration)
    check_config(model.config)
    state=load_file(args.model_dir/'model.safetensors',device='cpu');model.load_state_dict(state,strict=True);del state
    model=model.to(device='cpu',dtype=torch.float32).eval();conditions['model_initialization']={'status':'PASS','ms':(time.perf_counter()-t)*1000,'peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024};write_json(args.output/'conditions.json',conditions)
    results=[]
    for case in manifest['cases']:
        CURRENT_STAGE=f'inference:{case["id"]}';print(json.dumps({'stage':CURRENT_STAGE}),flush=True)
        case_dir=args.output/case['id'];case_dir.mkdir();stage={};t=time.perf_counter()
        with Image.open(path_under(args.corpus_root,case['evaluation']['path'])) as image:
            rgba=np.array(image.convert('RGBA'),copy=True);tensor=transform(image.convert('RGB')).unsqueeze(0)
        stage['decode_preprocess_ms']=(time.perf_counter()-t)*1000;t=time.perf_counter()
        with torch.inference_mode():outputs=model(tensor);logits=outputs[-1].detach().cpu().float()
        stage['inference_ms']=(time.perf_counter()-t)*1000;t=time.perf_counter();coverage=logits.sigmoid()
        stage['sigmoid_ms']=(time.perf_counter()-t)*1000
        if list(logits.shape)!=[1,1,1024,1024]:raise ValueError('Unexpected reference output shape')
        t=time.perf_counter();stats={'raw_logits':tensor_stats(logits),'continuous_coverage':tensor_stats(coverage)};stage['tensor_diagnostic_ms']=(time.perf_counter()-t)*1000;t=time.perf_counter();exports=save_outputs(case,case_dir,rgba,logits,coverage,tensor);stage['diagnostic_export_ms']=(time.perf_counter()-t)*1000
        result={'id':case['id'],'input_sha256':case['evaluation']['sha256'],'retained_subject':case['retained_subject'],'first_image':not results,'stage_timings':stage,'tensors':stats,'exports':exports,'process_peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024,'quality':'needs_review','original_preserved':hash_file(path_under(args.corpus_root,case['original']['path']))==case['original']['sha256']};results.append(result);write_json(case_dir/'record.json',result);write_json(args.output/'results.json',results)
        del tensor,outputs,logits,coverage,rgba
    verify_manifest(args.manifest,args.corpus_root);conditions['inference']='completed';conditions['network_attempts']=NETWORK_ATTEMPTS;conditions['process_peak_rss_bytes']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024;write_json(args.output/'conditions.json',conditions)
    print(json.dumps({'execution':'completed','cases':len(results),'quality':'NOT AWARDED','output':str(args.output)}))
if __name__=='__main__':
    try:main()
    except BaseException as error:
        if OUTPUT_DIRECTORY is not None:
            write_json(OUTPUT_DIRECTORY/'failure.json',{'status':'CANCELLED' if isinstance(error,KeyboardInterrupt) else 'FAIL','stage':CURRENT_STAGE,'type':type(error).__name__,'message':str(error),'network_attempts':NETWORK_ATTEMPTS,'process_peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024})
        raise
