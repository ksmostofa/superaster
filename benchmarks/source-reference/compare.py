#!/usr/bin/env python3
"""Report numerical deltas for an explicitly identical checkpoint/input pair."""
import argparse,json,pathlib
import numpy as np
from prepare import REVISION,hash_file

def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--candidate',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
    if a.output.exists():raise ValueError('Never overwrite prior comparisons')
    left=json.loads((a.source/'conditions.json').read_text());right=json.loads((a.candidate/'conditions.json').read_text())
    if left['revision']!=REVISION or right['revision']!=REVISION or left['weight_sha256']!=right['weight_sha256'] or left['manifest_sha256']!=right['manifest_sha256']:raise ValueError('Different checkpoint or manifest cannot establish export parity')
    if left['inference']!='completed' or right['inference']!='completed':raise ValueError('Both executions must be complete')
    if not right.get('onnx_artifact_sha256'):raise ValueError('Candidate must record an immutable ONNX artifact hash')
    results=[]
    for case in left['cases']:
        identity=next(c for c in right['cases'] if c['id']==case['id'])
        if identity['input_sha256']!=case['input_sha256']:raise ValueError('Different evaluation input')
        row={'id':case['id'],'input_sha256':case['input_sha256'],'arrays':{}}
        for name in ('input','logits','coverage'):
            lp=a.source/case['id']/(name+'.npy');rp=a.candidate/case['id']/(name+'.npy')
            x=np.load(lp,allow_pickle=False);y=np.load(rp,allow_pickle=False)
            if x.shape!=y.shape or not np.isfinite(x).all() or not np.isfinite(y).all():raise ValueError('Shape/nonfinite mismatch')
            if name=='input' and (x.dtype!=y.dtype or not np.array_equal(x,y)):raise ValueError('Use byte-identical preprocessed model inputs for this parity comparison')
            diff=x.astype(np.float64)-y.astype(np.float64)
            row['arrays'][name]={'shape':list(x.shape),'source_dtype':str(x.dtype),'candidate_dtype':str(y.dtype),'source_sha256':hash_file(lp),'candidate_sha256':hash_file(rp),'mean_absolute_difference':float(np.abs(diff).mean()),'max_absolute_difference':float(np.abs(diff).max()),'root_mean_square_difference':float(np.sqrt(np.mean(diff*diff)))}
        results.append(row)
    report={'source_checkpoint_revision':REVISION,'source_weight_sha256':left['weight_sha256'],'onnx_artifact_sha256':right['onnx_artifact_sha256'],'results':results,'numerical_acceptance':'NOT AWARDED','quality':'NOT AWARDED','reason':'Measurements only; no tolerance invented or acceptance threshold moved'}
    a.output.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n');print(json.dumps({'comparison':'recorded','acceptance':'NOT AWARDED','output':str(a.output)}))
if __name__=='__main__':main()
