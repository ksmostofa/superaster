#!/usr/bin/env python3
"""Stage exact local artifacts for a separately reviewed one-case browser probe."""
import argparse, json, os, pathlib, shutil
from prepare import FILES, REVISION, hash_file
from run import MANIFEST_HASH, write_json

RUNTIME = {
    'ort.wasm.min.mjs': (50126, '219e6a1fc8a9938268d18efca3c91d310bd2f4a59bbd13744df5b2b7fc6cee3b'),
    'ort-wasm-simd-threaded.mjs': (24381, 'e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b'),
    'ort-wasm-simd-threaded.wasm': (14239897, '3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2'),
}
MODEL_HASH = '09e180872581e886bb531e5c72a1df354ba2dd55445a11bb0618435a98abe92d'
CASE = 't01-three-birdwatchers'
TENSORS = {
    'input.npy': (12583040, '24e6193e65609e8f88326676a0b845072ed0836653e9ee5264f59ea3a7698771'),
    'source-logits.npy': (4194432, '221a940711594bb0617a1b5c6a73b3436c1e2448cd8e716d2ee0b9a70751d345'),
    'native-logits.npy': (4194432, 'fc08106649b30d1b274b2d9d6f4c25375acd1a3e7e86700a0bbf35d8c651a1e9'),
}

def require_file(file, size, digest):
    if file.stat().st_size != size or hash_file(file) != digest:
        raise ValueError(f'Changed pinned artifact: {file.name}')

def main():
    p=argparse.ArgumentParser()
    for name in ('export-dir','source-run','native-run','runtime-dir','output'):
        p.add_argument('--'+name, type=pathlib.Path, required=True)
    a=p.parse_args()
    if a.output.exists(): raise ValueError('Use a fresh diagnostic staging directory')
    source=json.loads((a.source_run/'conditions.json').read_text())
    native=json.loads((a.native_run/'conditions.json').read_text())
    export=json.loads((a.export_dir/'export.json').read_text())
    for conditions in (source,native):
        if conditions['inference'] != 'completed' or conditions['revision'] != REVISION or conditions['weight_sha256'] != FILES['model.safetensors'][1] or conditions['manifest_sha256'] != MANIFEST_HASH:
            raise ValueError('Changed or incomplete source/native conditions')
    if hash_file(a.source_run/'conditions.json') != 'feb5eb5e97ddf83f5e5cf6eaf0d51b9c0faf0bff53b6a86231f7fcd3b741e4da':
        raise ValueError('Changed completed source condition identity')
    if export['onnx_artifact_sha256'] != MODEL_HASH or native['onnx_artifact_sha256'] != MODEL_HASH:
        raise ValueError('Different model candidate')
    files={
        'model.onnx': (a.export_dir/'general-matting-f32-opset19.onnx',929574771,MODEL_HASH),
        'input.npy': (a.source_run/CASE/'input.npy',*TENSORS['input.npy']),
        'source-logits.npy': (a.source_run/CASE/'logits.npy',*TENSORS['source-logits.npy']),
        'native-logits.npy': (a.native_run/CASE/'logits.npy',*TENSORS['native-logits.npy']),
    }
    require_file(a.native_run/CASE/'input.npy',*TENSORS['input.npy'])
    for name,(size,digest) in RUNTIME.items(): files['runtime/'+name]=(a.runtime_dir/name,size,digest)
    for file,size,digest in files.values(): require_file(file,size,digest)
    a.output.mkdir(parents=True);(a.output/'runtime').mkdir()
    for name,(file,size,digest) in files.items():
        # The large local artifact uses a hardlink, with no broad-directory server.
        os.link(file,a.output/name)
    code={}
    for name in ('full-browser.html','full-browser.mjs','full-browser-worker.mjs'):
        source_file=pathlib.Path(__file__).with_name(name)
        shutil.copyfile(source_file,a.output/name)
        code[name]={'bytes':source_file.stat().st_size,'sha256':hash_file(source_file)}
    write_json(a.output/'manifest.json',{
        'scope':'ONE pinned group tensor; research only, full browser execution not yet run',
        'source_revision':REVISION,'weight_sha256':FILES['model.safetensors'][1],
        'source_conditions_sha256':hash_file(a.source_run/'conditions.json'),
        'native_conditions_sha256':hash_file(a.native_run/'conditions.json'),
        'source_manifest_sha256':MANIFEST_HASH,'case':CASE,
        'files':{name:{'bytes':size,'sha256':digest} for name,(_,size,digest) in files.items()},
        'harness_code':code,'wasm_heap_ceiling_bytes':4294967296,
        'provider':'wasm','threads':1,'proxy':False,'numerical_acceptance':'NOT AWARDED',
        'quality':'NOT AWARDED','investigation_bound_ms':600000,
    })
    print(json.dumps({'status':'STAGED; EXECUTION NOT RUN','output':str(a.output),'manifest_sha256':hash_file(a.output/'manifest.json')}))

if __name__=='__main__': main()
