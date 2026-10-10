#!/usr/bin/env python3
"""Check identified public Git blobs and optional staged changes without logging secrets."""
import argparse, hashlib, json, pathlib, re, subprocess


def git(*args):
    return subprocess.check_output(['git', *args])


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--ref', action='append', default=[])
    parser.add_argument('--private-file', action='append', type=pathlib.Path, default=[])
    parser.add_argument('--include-index', action='store_true')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args=parser.parse_args()
    refs=args.ref or ['HEAD']
    private_hashes={hashlib.sha256(p.read_bytes()).hexdigest() for p in args.private_file}
    objects={}
    paths=set()
    for line in git('rev-list','--objects',*refs).decode().splitlines():
        oid, _, path=line.partition(' ')
        objects.setdefault(oid,set()).add(path)
        if path:paths.add(path)
    if args.include_index:
        for row in git('ls-files','--stage','-z').decode().split('\0'):
            if not row:continue
            metadata,path=row.split('\t',1)
            mode,oid,stage=metadata.split()
            if stage != '0':raise ValueError('Resolve index conflicts before publication')
            objects.setdefault(oid,set()).add(path);paths.add(path)
    # Original 410-byte single-operator test graphs contain synthetic tensors, no weights.
    synthetic={
        'evidence/benchmarks/general-matting-conversion-prerequisite/fractional-asymmetric-offset-edge-mask.onnx':'33aa33f2e0c47a8d48ee8c513c9df11bc806477f22ed6ac734642e42613cc85a',
        'evidence/benchmarks/general-matting-conversion-prerequisite/zero-offset-3x3-padding.onnx':'57b3bd7d93cf13347c93cbc45a2db0a5aeb91c10541599cff98bdc661c22d3c6',
    }
    forbidden=re.compile(r'(^|/)(superaster-technical-spec[^/]*\.md|\.env[^/]*|\.cache|node_modules|private)(/|$)|\.(onnx|safetensors|pt|pth|npy)$',re.I)
    patterns={
        'github_token':rb'(?:ghp_|gho_|ghs_|ghu_)[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{45,}',
        'openai_key':rb'sk-(?:proj-)?[A-Za-z0-9_-]{35,}',
        'aws_access_key':rb'AKIA[A-Z0-9]{16}',
        'private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        'literal_bearer':rb'(?i)authorization[\s\x22\x27:]+bearer [a-z0-9._-]{25,}',
        'signed_url':rb'(?i)[?&](?:x-amz-signature|x-goog-signature|access_token|api_key)=[^\s\x22<>]{12,}',
    }
    report={'refs':{ref:git('rev-parse',ref).decode().strip() for ref in refs},'includes_index':args.include_index,
            'private_file_count':len(args.private_file),'history_and_index_blobs_checked':0,
            'forbidden_paths':sorted(p for p in paths if forbidden.search(p) and p not in synthetic),
            'synthetic_fixture_checks':[],
            'oversize_blobs':[],'private_body_matches':[],'credential_pattern_flags':[]}
    process=subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    try:
        for oid,names in sorted(objects.items()):
            process.stdin.write((oid+'\n').encode());process.stdin.flush()
            header=process.stdout.readline().decode().split()
            if len(header)!=3:raise ValueError('Unexpected Git object response')
            size=int(header[2]);data=process.stdout.read(size)
            if process.stdout.read(1)!=b'\n' or len(data)!=size:raise ValueError('Incomplete Git object')
            if header[1]!='blob':continue
            report['history_and_index_blobs_checked']+=1
            named=sorted(p for p in names if p)
            for name in named:
                if name in synthetic:
                    valid=size==410 and hashlib.sha256(data).hexdigest()==synthetic[name]
                    report['synthetic_fixture_checks'].append({'path':name,'oid':oid,'bytes':size,'status':'PASS' if valid else 'FAIL'})
                    if not valid:report['forbidden_paths'].append(name)
            if size>64*1024*1024:report['oversize_blobs'].append({'oid':oid,'bytes':size,'paths':named})
            if hashlib.sha256(data).hexdigest() in private_hashes:report['private_body_matches'].append({'oid':oid,'paths':named})
            for label,pattern in patterns.items():
                if re.search(pattern,data):report['credential_pattern_flags'].append({'oid':oid,'paths':named,'category':label})
    finally:
        process.stdin.close();process.stdout.close();process.wait()
    report['status']='PASS' if not any(report[k] for k in ('forbidden_paths','oversize_blobs','private_body_matches','credential_pattern_flags')) else 'REVIEW REQUIRED'
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('status','history_and_index_blobs_checked','forbidden_paths','oversize_blobs','private_body_matches','credential_pattern_flags')}))
    raise SystemExit(0 if report['status']=='PASS' else 1)


if __name__=='__main__':main()
