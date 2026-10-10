#!/usr/bin/env python3
"""Make identifiable cache-generation QA fixtures from an actual web build."""
import argparse, hashlib, json, pathlib, re, shutil
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--build',type=pathlib.Path,required=True)
p.add_argument('--output',type=pathlib.Path,required=True)
p.add_argument('--evidence',type=pathlib.Path,required=True)
a=p.parse_args()
if a.output.exists():raise ValueError('Use a fresh fixture output directory')
if not (a.build/'sw.js').is_file():raise ValueError('Expected a generated production build')
a.output.mkdir(parents=True)
for label in ('base','update','third'):
 dest=a.output/label;shutil.copytree(a.build,dest)
 if label=='base':continue
 index=(dest/'index.html').read_text()
 app=re.search(r'src="(/assets/index-[^"]+\.js)"',index).group(1)
 old=dest/app.lstrip('/')
 payload=old.read_text()+f'\n/* Identifiable QA-only cache-generation fixture: {label}. No operation semantics changed. */\n'
 new=f'/assets/index-QA{hashlib.sha256(payload.encode()).hexdigest()[:12]}.js'
 (dest/new.lstrip('/')).write_text(payload);old.unlink()
 (dest/'index.html').write_text(index.replace(app,new))
 sw=(dest/'sw.js').read_text().replace(json.dumps(app),json.dumps(new))
 assets=json.loads(re.search(r'ASSETS=(\[.*?\]);',sw).group(1));h=hashlib.sha256()
 for path in sorted(assets):h.update(path.lstrip('/').encode());h.update((dest/path.lstrip('/')).read_bytes())
 sw=re.sub(r'const CACHE="superaster-app-[^"]+"',f'const CACHE="superaster-app-{h.hexdigest()[:16]}"',sw)
 (dest/'sw.js').write_text(sw)
shutil.copytree(a.output/'base',a.output/'live')
report={'scope':'QA-only sealed deployment generations. Updates change an explicit JS comment and filename. Core operation semantics are unchanged; fixtures are not production source changes.','generations':{}}
for label in ('base','update','third'):
 dest=a.output/label
 report['generations'][label]={'cache':re.search(r'const CACHE="([^"]+)"',(dest/'sw.js').read_text()).group(1),'files':{str(f.relative_to(dest)):{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in dest.rglob('*') if f.is_file()}}
a.evidence.parent.mkdir(parents=True,exist_ok=True)
a.evidence.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v['cache'] for k,v in report['generations'].items()}))
