#!/usr/bin/env python3
"""Download only pinned corpus originals; refuse artifact changes and preserve sources."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import tempfile
import urllib.request
from PIL import Image, ImageOps
from common import ROOT, digest, read_json, resolve_input, write_json


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'benchmarks/corpus/screening.json')
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--prepare-evaluation', action='store_true', help='Produce declared orientation-normalized bounded evaluation inputs.')
    args = parser.parse_args()
    manifest = read_json(args.manifest)
    outcomes = []
    for case in manifest['cases']:
        original = resolve_input(case['original']['path'])
        if original.exists() and digest(original) != case['original']['sha256']:
            raise ValueError(f'Changed original: {case["id"]}; original will never be overwritten')
        if not original.exists():
            if args.verify_only:
                raise FileNotFoundError(original)
            original.parent.mkdir(parents=True, exist_ok=True)
            request = urllib.request.Request(case['source']['artifact_url'], headers={'User-Agent': 'SuperasterResearch/0.1 (rights-cleared benchmark reproduction)'})
            with urllib.request.urlopen(request, timeout=60) as response:
                with tempfile.NamedTemporaryFile(dir=original.parent, delete=False) as temp:
                    temp_path = Path(temp.name)
                    try:
                        size = 0
                        while chunk := response.read(1024 * 1024):
                            size += len(chunk)
                            if size > 20_000_000:
                                raise ValueError(f'Corpus artifact exceeds 20 MB: {case["id"]}')
                            temp.write(chunk)
                    except BaseException:
                        temp_path.unlink(missing_ok=True)
                        raise
            try:
                if digest(temp_path) != case['original']['sha256']:
                    raise ValueError(f'Upstream artifact changed for {case["id"]}; select and review a new corpus version')
                os.replace(temp_path, original)
            finally:
                temp_path.unlink(missing_ok=True)
        with Image.open(original) as image:
            image.verify()
        evaluation = case['evaluation']
        output = resolve_input(evaluation['path'])
        if args.prepare_evaluation:
            with Image.open(original) as image:
                image = ImageOps.exif_transpose(image).convert('RGB')
                image.thumbnail((manifest['evaluation_policy']['max_edge_px'],) * 2, Image.Resampling.LANCZOS)
                output.parent.mkdir(parents=True, exist_ok=True)
                image.save(output, format='PNG', compress_level=9)
            if digest(output) != evaluation['sha256']:
                raise ValueError(f'Evaluation derivative changed: {case["id"]}; check pinned Pillow version')
        if output.exists() and digest(output) != evaluation['sha256']:
            raise ValueError(f'Changed evaluation derivative: {case["id"]}')
        outcomes.append({'id': case['id'], 'original_sha256': digest(original), 'evaluation_sha256': digest(output) if output.exists() else None, 'status': 'PASS'})
    print(json.dumps({'manifest_sha256': digest(args.manifest), 'cases': outcomes}, indent=2))


if __name__ == '__main__':
    main()
