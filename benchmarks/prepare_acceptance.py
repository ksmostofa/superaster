#!/usr/bin/env python3
"""Prepare pinned real-image workflow inputs, separate from quality evaluation."""
from __future__ import annotations
import argparse
from pathlib import Path
import shutil
from PIL import Image, ImageOps
from common import ROOT, digest, read_json, resolve_input, write_json


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'benchmarks/fixtures/generated/acceptance')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    screening = read_json(ROOT / 'benchmarks/corpus/screening.json')
    people_group = next(case for case in screening['cases'] if case['id'] == 'people-group')
    original = resolve_input(people_group['original']['path'])
    if digest(original) != people_group['original']['sha256']:
        raise ValueError('Changed T01 source original')
    with Image.open(original) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.thumbnail((2400, 1600), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (2400, 1600), '#ffffff')
        placement = ((2400 - image.width) // 2, (1600 - image.height) // 2)
        canvas.paste(image, placement)
        t01 = args.output / 't01-2400x1600.png'
        canvas.save(t01, compress_level=9)
    source_paths = []
    batch = args.output / 'batch-20'
    batch.mkdir(exist_ok=True)
    for index, case in enumerate(screening['cases'][:19]):
        source = resolve_input(case['evaluation']['path'])
        if digest(source) != case['evaluation']['sha256']:
            raise ValueError(f'Changed batch source {case["id"]}')
        target = batch / f'{index + 1:02d}-{case["id"]}.png'
        shutil.copyfile(source, target)
        source_paths.append({'case_id': case['id'], 'path': str(target.relative_to(ROOT)), 'sha256': digest(target), 'expected': 'valid real-image input; output quality judged separately'})
    corrupt = batch / '20-corrupt.jpg'
    corrupt.write_bytes(b'\xff\xd8deliberately corrupt acceptance input\xff\xd9')
    source_paths.append({'case_id': 'corrupt', 'path': str(corrupt.relative_to(ROOT)), 'sha256': digest(corrupt), 'expected': 'one attributable invalid-image error'})
    collisions = []
    for directory, case in [('a', screening['cases'][0]), ('b', screening['cases'][1])]:
        target = args.output / 'batch-collisions' / directory / 'same-name.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(resolve_input(case['evaluation']['path']), target)
        collisions.append({'case_id': case['id'], 'path': str(target.relative_to(ROOT)), 'sha256': digest(target)})
    write_json(ROOT / 'benchmarks/fixtures/acceptance-manifest.json', {
        'version': '1.0.0',
        'role': 'workflow correctness/resource/error inputs; excluded from automatic quality scoring and heldout corpus',
        't01': {'path': str(t01.relative_to(ROOT)), 'sha256': digest(t01), 'width': 2400, 'height': 1600, 'orientation_normalized': True, 'source_case_id': people_group['id'], 'source_sha256': people_group['original']['sha256'], 'derived_geometry': {'source_scaled_dimensions': list(image.size), 'canvas_background': '#ffffff', 'position_px': list(placement), 'resampling': 'Pillow 12.3.0 LANCZOS; contain without upscaling'}, 'retained_subject': people_group['retained_subject'], 'license': people_group['source']['license'], 'source_url': people_group['source']['description_url']},
        't08_batch': {'valid_input_count': 19, 'corrupt_input_count': 1, 'files': source_paths},
        't10_duplicate_basenames': collisions,
        'source_permissions': 'Real images retain screening manifest licenses and attribution; generated corruption bytes are original CC0.',
    })
    print(t01)
    print(batch)


if __name__ == '__main__':
    main()
