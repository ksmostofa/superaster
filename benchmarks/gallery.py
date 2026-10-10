#!/usr/bin/env python3
"""Build a local review gallery from actual run records; no remote image requests."""
from __future__ import annotations
import argparse
import html
import os
from pathlib import Path
from common import ROOT, read_json, resolve_input


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'benchmarks/corpus/screening.json')
    args = parser.parse_args()
    run = args.run.resolve()
    manifest = read_json(args.manifest)
    by_id = {case['id']: case for case in manifest['cases']}
    results = read_json(run / 'results.json')
    conditions_path = run / 'conditions.json'
    conditions = read_json(conditions_path) if conditions_path.exists() else {}
    timing_scope = conditions.get('timing_scope', 'NOT RECORDED; inspect actual run conditions before interpreting timings')
    blocks = []
    for record in results['records']:
        case = by_id[record['id']]
        directory = run / f'{case["id"]}--{record["repeat"]}'
        figures = [('Input', resolve_input(case['evaluation']['path']))]
        if (directory / 'cutout.png').exists():
            figures.extend((title, directory / name) for title, name in [('Cutout', 'cutout.png'), ('Alpha', 'alpha.png'), ('White', 'white.png'), ('Black', 'black.png'), ('Color', 'color.png')])
        images = ''.join(f'<figure><figcaption>{html.escape(title)}</figcaption><a href="{html.escape(os.path.relpath(path, run))}"><img loading="lazy" src="{html.escape(os.path.relpath(path, run))}" alt="{html.escape(case["id"] + " " + title)}"></a></figure>' for title, path in figures if path.exists())
        source = case['source']
        attribution = f'<a href="{html.escape(source["description_url"])}">{html.escape(source["title"])}</a>, {html.escape(source["artist_plain"])}. <a href="{html.escape(source["license_url"] or source["description_url"])}">{html.escape(source["license"])}</a>. Evaluation normalization and processing are derivatives.'
        blocks.append(f'<section><h2>{html.escape(case["id"])} · {html.escape(record["status"])} · {record["elapsed_seconds"]:.3f}s</h2><p>Retain: {html.escape(case["retained_subject"])}. Declared challenges: {html.escape(", ".join(case["challenges"]))}.</p><div class="images">{images}</div><p>{attribution}</p><p>Human review: NOT RUN. Automatic artifact validity does not establish subject quality.</p></section>')
    document = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Superaster actual output review</title><style>body{font:16px system-ui;margin:24px;background:#eee;color:#222}h1{font-size:24px}section{border-top:1px solid #aaa;padding:16px 0}.images{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}figure{margin:0}figcaption{margin-bottom:6px}img{width:100%;max-height:330px;object-fit:contain;background:repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0/16px 16px}a{color:#005e92}p{line-height:1.5}</style><h1>Actual local cutouts and decoded composites</h1><p>Alpha is coverage, not calibrated model confidence. Timing scope: ' + html.escape(str(timing_scope)) + '. See conditions.json. Missing output remains an explicit failure.</p>' + ''.join(blocks) + '</html>'
    (run / 'gallery.html').write_text(document, encoding='utf-8')
    print(run / 'gallery.html')


if __name__ == '__main__':
    main()
