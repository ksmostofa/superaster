#!/usr/bin/env python3
"""Prepare anonymous human screening views from existing outputs, without inference."""
import argparse
import hashlib
import html
import json
import random
import re
import shutil
import struct
from pathlib import Path


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_size(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        raise ValueError(f'Expected a PNG: {path}')
    return struct.unpack('>II', data[16:24])


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('first', 'second', 'output', 'key'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--manifest', type=Path, default=Path('benchmarks/corpus/screening.json'))
    parser.add_argument('--seed', type=int, required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    output, key = args.output.resolve(), args.key.resolve()
    if output.exists() or key.exists():
        raise SystemExit('Use new gallery and hidden-key paths')
    if key.is_relative_to(output):
        raise SystemExit('Keep the hidden key outside the served gallery')
    manifest = json.loads(args.manifest.read_text())
    runs = [args.first.resolve(), args.second.resolve()]
    records = [{r['id']: r for r in json.loads((run / 'results.json').read_text())['records'] if r['repeat'] == 1} for run in runs]
    ids = [case['id'] for case in manifest['cases']]
    if len(set(ids)) != len(ids) or any(set(r) != set(ids) for r in records):
        raise SystemExit('Both actual runs must contain every original screening case exactly once')
    prepared = []
    for case in manifest['cases']:
        case_id = case['id']
        if not re.fullmatch(r'[a-z0-9-]+', case_id):
            raise SystemExit('Unsafe case path in manifest')
        source = Path(case['evaluation']['path']).resolve()
        expected_size = (case['evaluation']['width'], case['evaluation']['height'])
        if sha256(source) != case['evaluation']['sha256'] or png_size(source) != expected_size:
            raise SystemExit(f'Original screening input changed: {case_id}')
        files = []
        for index, run in enumerate(runs):
            record = records[index][case_id]
            directory = run / (case_id + '--1')
            if record['input_sha256'] != case['evaluation']['sha256']:
                raise SystemExit(f'Run used a different input: {case_id}')
            if sha256(directory / 'cutout.png') != record['output_sha256']:
                raise SystemExit(f'Run output hash changed: {case_id}')
            if sha256(directory / 'alpha.png') != record['mask_sha256']:
                raise SystemExit(f'Run mask hash changed: {case_id}')
            views = {name: directory / (name + '.png') for name in ('white', 'black', 'color', 'alpha')}
            if any(png_size(path) != expected_size for path in views.values()):
                raise SystemExit(f'Unequal comparison dimensions: {case_id}')
            files.append(views)
        prepared.append((case, source, files))

    output.mkdir(parents=True)
    rng, keys, blocks = random.Random(args.seed), [], []

    def copy(source, destination):
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        return sha256(destination)

    def choose(name):
        return '<select required name="' + name + '"><option value="">Choose</option>' + ''.join('<option>' + v + '</option>' for v in ('none', 'minor', 'material', 'uncertain')) + '</select>'

    for index, (case, source, files) in enumerate(prepared):
        case_id, order = case['id'], [0, 1]
        rng.shuffle(order)
        folder = output / 'cases' / case_id
        hashes = {'source': copy(source, folder / 'source.png')}
        views = f'<div class="photos"><figure><figcaption>Original input</figcaption><a href="cases/{case_id}/source.png"><img loading="lazy" src="cases/{case_id}/source.png" alt="Original {html.escape(case_id)}"></a></figure>'
        for label, which in zip(('A', 'B'), order):
            hashes[label] = {}
            views += '<figure><figcaption>Label ' + label + '</figcaption>'
            for name, path in files[which].items():
                hashes[label][name] = copy(path, folder / label / (name + '.png'))
                relative = f'cases/{case_id}/{label}/{name}.png'
                views += f'<a href="{relative}"><img loading="lazy" src="{relative}" alt="{label} {name} composite"></a>'
            views += '</figure>'
        views += '</div><div class="ratings">'
        for label in ('A', 'B'):
            views += '<fieldset><legend>' + label + '</legend>'
            for name, description in (('missing_subject', 'Missing intended subject'), ('background', 'Retained background'), ('halo', 'Halo / color contamination'), ('fine_edges', 'Fine-edge loss')):
                views += '<label>' + description + choose(f'{case_id}.{label}.{name}') + '</label>'
            views += '</fieldset>'
        views += f'</div><label>Paired judgment<select required name="{case_id}.winner"><option value="">Choose</option>' + ''.join('<option>' + v + '</option>' for v in ('A wins', 'B wins', 'tie', 'uncertain')) + f'</select></label><label>Reason<textarea required name="{case_id}.reason"></textarea></label>'
        credit = case['source']
        attribution = '<a href="' + html.escape(credit['description_url'], quote=True) + '">' + html.escape(credit['title']) + '</a> · ' + html.escape(credit['artist_plain']) + ' · <a href="' + html.escape(credit['license_url'] or credit['description_url'], quote=True) + '">' + html.escape(credit['license']) + '</a>. Normalized input and local processing are derivatives.'
        blocks.append(f'<section><h2>{index + 1} / {len(prepared)} · {html.escape(case_id)}</h2><p>Retain: {html.escape(case["retained_subject"])}</p>{views}<small>{attribution}</small></section>')
        keys.append({'id': case_id, 'A_run': str(runs[order[0]]), 'B_run': str(runs[order[1]]), 'hashes': hashes, 'machine_status': {label: records[which][case_id]['status'] for label, which in zip(('A', 'B'), order)}})
    key.parent.mkdir(parents=True, exist_ok=True)
    key.write_text(json.dumps({'seed': args.seed, 'manifest_sha256': sha256(args.manifest), 'run_results_sha256': [sha256(run / 'results.json') for run in runs], 'cases': keys}, indent=2) + '\n')
    identity = {'schema_version': '1.0', 'case_count': len(keys), 'manifest_sha256': sha256(args.manifest), 'hidden_key_sha256': sha256(key), 'seed': args.seed, 'source_visible': True}
    (output / 'gallery.json').write_text(json.dumps(identity, indent=2) + '\n')
    head = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Superaster human screening review</title><style>body{background:#111;color:#eee;font:16px system-ui;margin:24px}main{max-width:1300px;margin:auto}h1{font-size:28px}p,small{line-height:1.5}section{border-top:1px solid #444;margin:32px 0;padding-top:20px}.photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{display:block;width:100%;max-height:360px;object-fit:contain;margin:8px 0}a{color:#ddd}.ratings{display:flex;gap:16px}fieldset{flex:1;min-width:0}label{display:block;margin:12px 0}select,textarea,input,button{font:inherit;background:#222;color:#fff;border:1px solid #777;padding:10px;max-width:100%;box-sizing:border-box}select,textarea{display:block;width:100%}button{cursor:pointer;margin:8px}footer{position:sticky;bottom:0;background:#111;padding:12px;border-top:1px solid #555}@media(max-width:700px){.photos{grid-template-columns:1fr}.ratings{display:block}}</style><main><h1>Human screening review</h1><p>Actual uncorrected local composites. Labels are randomized per case. Click images for full-size inspection at the same viewing scale. The hidden key is stored outside this served folder. This screening review does not freeze acceptance thresholds or establish release quality. No image or rating is uploaded.</p><p>Use none, minor, material, or uncertain for each failure. The intended retained subject was recorded before inference. Record display limitations and uncertainty in the reason.</p><form><label>Participant alias<input required name="participant"></label><label>Display / viewing scale / review conditions<input required name="conditions"></label>'''
    script = '<script>const gallery=' + json.dumps(identity) + ''';function save(complete){const f=document.querySelector('form');if(complete&&!f.reportValidity())return;const data={...gallery,status:complete?'HUMAN_REVIEW_SUBMITTED':'DRAFT',reviewed_at:new Date().toISOString(),user_agent:navigator.userAgent,ratings:Object.fromEntries(new FormData(f))};const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='superaster-human-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)}</script>'''
    (output / 'index.html').write_text(head + ''.join(blocks) + '</form><footer><button onclick="save(false)">Save draft</button><button onclick="save(true)">Download complete judgments</button></footer></main>' + script + '</html>')
    print(json.dumps({'gallery': str(output / 'index.html'), 'cases': len(keys), 'hidden_key': str(key), 'inference_runs': 0}))


if __name__ == '__main__':
    main()
