#!/usr/bin/env python3
"""Decode actual source-reference exports and check their recorded properties."""
import argparse, json, pathlib
import numpy as np
from PIL import Image
from prepare import FILES, REVISION, hash_file
from run import MANIFEST_HASH, verify_manifest

def require(condition, message):
    if not condition:raise ValueError(message)

def main():
    p=argparse.ArgumentParser();p.add_argument('--run',type=pathlib.Path,required=True);p.add_argument('--manifest',type=pathlib.Path,required=True);p.add_argument('--corpus-root',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
    require(not a.output.exists(),'Never overwrite prior verification evidence')
    manifest=verify_manifest(a.manifest,a.corpus_root.resolve())
    conditions=json.loads((a.run/'conditions.json').read_text());records=json.loads((a.run/'results.json').read_text())
    require(conditions['revision']==REVISION and conditions['weight_sha256']==FILES['model.safetensors'][1] and conditions['manifest_sha256']==MANIFEST_HASH,'Changed source/weight/input conditions')
    require(conditions['inference']=='completed','Incomplete inference')
    require([c['id'] for c in records]==[c['id'] for c in manifest['cases']],'Changed execution case identities')
    reports=[]
    for case,record in zip(manifest['cases'],records):
        directory=a.run/case['id'];expected=(case['evaluation']['width'],case['evaluation']['height'])
        source=np.array(Image.open(a.corpus_root/case['evaluation']['path']).convert('RGBA'))
        alpha=np.load(directory/'coverage-original.npy',allow_pickle=False)
        expected_alpha=np.floor(np.clip(alpha,0,1)*255+0.5).astype(np.uint8)
        row={'id':case['id'],'dimensions':list(expected),'arrays':{},'pngs':{}}
        for name,shape in [('input',(1,3,1024,1024)),('logits',(1,1,1024,1024)),('coverage',(1,1,1024,1024)),('coverage-original',(expected[1],expected[0]))]:
            array=np.load(directory/(name+'.npy'),allow_pickle=False)
            require(array.shape==shape and array.dtype==np.float32 and np.isfinite(array).all(),f'{name}: shape, dtype or finite-value mismatch')
            if name.startswith('coverage'):require(array.min()>=0 and array.max()<=1,f'{name}: coverage outside 0..1')
            row['arrays'][name]={'shape':list(array.shape),'dtype':str(array.dtype),'finite':True,'min':float(array.min()),'max':float(array.max())}
        for name in ('alpha','cutout','white','black','color'):
            file=directory/(name+'.png')
            with Image.open(file) as image:
                require(image.format=='PNG' and image.size==expected,f'{name}: format or dimensions mismatch')
                mode='L' if name=='alpha' else 'RGBA' if name=='cutout' else 'RGB'
                require(image.mode==mode,f'{name}: mode mismatch')
                require(not image.getexif() and 'XML:com.adobe.xmp' not in image.info,f'{name}: source EXIF/XMP present')
                row['pngs'][name]={'format':image.format,'dimensions':list(image.size),'mode':image.mode,'metadata_keys':sorted(image.info),'bytes':file.stat().st_size}
        with Image.open(directory/'alpha.png') as image:require(np.array_equal(np.array(image),expected_alpha),'Decoded alpha quantization mismatch')
        with Image.open(directory/'cutout.png') as image:
            cutout=np.array(image);require(np.array_equal(cutout[:,:,3],expected_alpha),'Decoded cutout alpha mismatch');require(np.array_equal(cutout[:,:,:3],source[:,:,:3]),'Decoded source RGB changed')
        for name,color in [('white',(255,255,255)),('black',(0,0,0)),('color',(255,0,255))]:
            coverage=alpha[:,:,None]
            wanted=np.floor(source[:,:,:3].astype(np.float32)*coverage+np.array(color,dtype=np.float32)*(1-coverage)+0.5).astype(np.uint8)
            with Image.open(directory/(name+'.png')) as image:require(np.array_equal(np.array(image),wanted),f'{name}: decoded diagnostic composition mismatch')
        files=record['exports']['files']
        require(sorted(f['path'] for f in files)==sorted([name+'.npy' for name in ('input','logits','coverage','coverage-original')]+[name+'.png' for name in ('alpha','cutout','white','black','color')]),'Unexpected export file set')
        for output in files:
            file=directory/output['path'];require(file.stat().st_size==output['bytes'] and hash_file(file)==output['sha256'],f'{file.name}: recorded hash mismatch')
        row['checks']={'arrays_shapes_dtype_finite':'PASS','coverage_range':'PASS','png_format_mode_dimensions':'PASS','alpha_quantization_all_pixels':'PASS','cutout_alpha_all_pixels':'PASS','source_RGB_preserved_all_pixels':'PASS','diagnostic_byte_space_composition_all_pixels':'PASS','all_recorded_output_hashes':'PASS','source_and_original_hashes_preserved':'PASS','no_EXIF_XMP':'PASS','quality':'NOT AWARDED'}
        reports.append(row)
    verify_manifest(a.manifest,a.corpus_root.resolve())
    a.output.write_text(json.dumps({'scope':'Actual exported source-reference diagnostics; not production color/quality conformance','verifier_sha256':hash_file(pathlib.Path(__file__)),'cases':reports},indent=2)+'\n')
    print(json.dumps({'cases':len(reports),'artifact_properties':'PASS','quality':'NOT AWARDED'}))

if __name__=='__main__':main()
