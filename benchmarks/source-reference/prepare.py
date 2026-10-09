#!/usr/bin/env python3
"""Fetch immutable reviewed research inputs. Never import downloaded Python."""
from __future__ import annotations
import argparse, hashlib, json, os, pathlib, shutil, time, urllib.request

REPOSITORY = 'ZhengPeng7/BiRefNet-matting'
REVISION = 'eccde0a8cbdce7ac5fecfeb06340fe7b949e85d9'
FILES = {
    'birefnet.py': (92134, '2a45b4e0ece72d7c4212bca1a988e7d7e52bfe9f98ec59c58b8809c8a8b7a831'),
    'BiRefNet_config.py': (298, 'e7b8c2a74f6cea6a59553d517f71d47f2c1d90e670a13416af17c25fe2f3dc52'),
    'config.json': (413, 'b2b235983b80fbff325976ca517bb7eda25e915b84a97b150eca41266cf8a13b'),
    'README.md': (4724, 'e43576e298fcfd143239f7c1dc080e1d03f4eef5e78156da4f0466d93f2c45a1'),
    'requirements.txt': (149, 'bdfdd83a090d31a2acf64f7350653fa63cd8b5d9d6e0ff3e135bea7ce3786341'),
    'BiRefNet-MIT.txt': (1066, '92a7089e0915fc32bc40067560b398f1e6a7a5958abd7d04eda393629a5acefb'),
    'model.safetensors': (884878856, 'a9875de5b1e6c8eb5fdaa8c727a82927ce442cdc87ba3abee6a77e6fa46c25bb'),
}

def hash_file(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(8*1024*1024),b''):h.update(block)
    return h.hexdigest()

def download_ranges(part, url, expected_size, expected_hash, range_bytes=16*1024*1024):
    """Admit completed exact ranges only; final whole-file SHA admits the model."""
    if not part.exists():part.touch(exist_ok=False)
    if part.stat().st_size>expected_size:raise ValueError('Oversized partial')
    ledger_path=part.with_suffix(part.suffix+'.transport.json')
    ledger=json.loads(ledger_path.read_text()) if ledger_path.exists() else []
    attempt={'start_bytes':part.stat().st_size,'start_sha256':hash_file(part),
             'expected_bytes':expected_size,'expected_sha256':expected_hash,
             'range_bytes':range_bytes,'range_time_limit_seconds':120,'ranges':[],
             'artifact_accepted':False}
    ledger.append(attempt)
    def record():ledger_path.write_text(json.dumps(ledger,indent=2)+'\n')
    record()
    while part.stat().st_size<expected_size:
        offset=part.stat().st_size;end=min(offset+range_bytes,expected_size)-1
        t=time.perf_counter();size=0;segment=part.with_suffix(part.suffix+'.segment')
        if segment.exists():raise ValueError('Prior segment exists; inspect before resuming')
        row={'requested_start':offset,'requested_end':end,'expected_bytes':end-offset+1,
             'completed':False,'appended':False};attempt['ranges'].append(row)
        request=urllib.request.Request(url,headers={'User-Agent':'Superaster-source-reference-audit','Range':f'bytes={offset}-{end}'})
        try:
            with urllib.request.urlopen(request,timeout=30) as response:
                row['http_status']=response.status;row['content_range']=response.headers.get('Content-Range')
                if response.status!=206 or row['content_range']!=f'bytes {offset}-{end}/{expected_size}':raise ValueError('Server did not honor exact range; no bytes appended')
                with segment.open('xb') as f:
                    for block in iter(lambda:response.read(1024*1024),b''):
                        size+=len(block)
                        if size>end-offset+1:raise ValueError('Oversized range; no bytes appended')
                        f.write(block)
                        if time.perf_counter()-t>120:raise TimeoutError('Range exceeded 120 seconds; no bytes appended')
            if size!=end-offset+1:raise ValueError('Incomplete range; no bytes appended')
            row['body_sha256']=hash_file(segment);row['completed']=True
            with part.open('ab') as destination,segment.open('rb') as source:
                shutil.copyfileobj(source,destination,1024*1024);destination.flush();os.fsync(destination.fileno())
            row['appended']=True;row['cumulative_bytes']=part.stat().st_size
        except BaseException as error:
            row['error_type']=type(error).__name__;row['error']=str(error)
            raise
        finally:
            row['received_bytes']=size;row['seconds']=time.perf_counter()-t
            segment.unlink(missing_ok=True);record()
        print(json.dumps(row),flush=True)
    attempt['complete_sha256']=hash_file(part);record()
    if attempt['complete_sha256']!=expected_hash:raise ValueError('Complete SHA-256 mismatch; artifact not accepted')
    attempt['artifact_accepted']=True;record()

def main():
    p=argparse.ArgumentParser();p.add_argument('--destination',type=pathlib.Path,required=True);p.add_argument('--source-only',action='store_true');args=p.parse_args()
    args.destination.mkdir(parents=True,exist_ok=True)
    index=[]
    for name,(expected_size,expected_hash) in FILES.items():
        if args.source_only and name=='model.safetensors':continue
        path=args.destination/name;url=f'https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{name}'
        if name=='BiRefNet-MIT.txt':url='https://raw.githubusercontent.com/ZhengPeng7/BiRefNet/ebcc0bc8ec7fe919cec829f2dea656b3078acddc/LICENSE'
        t=time.perf_counter();cached=path.exists()
        if not cached:
            part=path.with_suffix(path.suffix+'.partial')
            if expected_size>64*1024*1024:
                # A 64 MiB range exceeded the observed endpoint's 120-second bound.
                # Smaller exact ranges preserve completed work without whole retries.
                url+='?download=true'
                download_ranges(part,url,expected_size,expected_hash)
            else:
                h=hashlib.sha256();size=0
                try:
                    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Superaster-source-reference-audit'}),timeout=30) as response,part.open('xb') as f:
                        for block in iter(lambda:response.read(1024*1024),b''):
                            size+=len(block)
                            if size>expected_size:raise ValueError(f'{name}: oversized response')
                            h.update(block);f.write(block)
                    if size!=expected_size or h.hexdigest()!=expected_hash:raise ValueError(f'{name}: byte/hash mismatch {size} {h.hexdigest()}')
                except BaseException:
                    part.unlink(missing_ok=True);raise
            os.replace(part,path)
        if path.stat().st_size!=expected_size or hash_file(path)!=expected_hash:raise ValueError(f'{name}: cached byte/hash mismatch')
        row={'file':name,'url':url,'bytes':expected_size,'sha256':expected_hash,'cache_hit':cached,'verify_download_seconds':time.perf_counter()-t};index.append(row);print(json.dumps(row),flush=True)
    (args.destination/'verified-files.json').write_text(json.dumps({'repository':REPOSITORY,'revision':REVISION,'files':index},indent=2)+'\n')
if __name__=='__main__':main()
