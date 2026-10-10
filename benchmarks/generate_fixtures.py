#!/usr/bin/env python3
"""Generate original CC0 correctness fixtures. These are not real-image quality cases."""
from __future__ import annotations
import argparse
from pathlib import Path
import struct
import zlib
from PIL import Image, ImageCms, ImageOps
from common import ROOT, digest, write_json


def chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'benchmarks/fixtures/generated')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rgba = Image.new('RGBA', (8, 6))
    alpha_values = [0, 64, 128, 192, 255, 128, 255, 0]
    rgba.putdata([(x * 31, y * 43, (x + y) * 19, alpha_values[x]) for y in range(6) for x in range(8)])
    rgba.save(args.output / 'rgba.png', compress_level=9)
    rgba.getchannel('A').save(args.output / 'mask.png', compress_level=9)
    for name, color in [('white', '#ffffff'), ('black', '#000000'), ('color', '#2c7696')]:
        Image.alpha_composite(Image.new('RGBA', rgba.size, color), rgba).convert('RGB').save(args.output / f'composite-{name}.png', compress_level=9)
    opaque = Image.new('RGB', (80, 60), '#808080')
    colors = [((0, 0, 39, 29), '#ff0000'), ((40, 0, 79, 29), '#00ff00'), ((0, 30, 39, 59), '#0000ff'), ((40, 30, 79, 59), '#ffff00')]
    from PIL import ImageDraw
    draw = ImageDraw.Draw(opaque)
    for box, color in colors:
        draw.rectangle(box, fill=color)
    exif = Image.Exif()
    exif[274] = 6
    exif[315] = 'Superaster synthetic fixture author'
    exif[306] = '2000:01:01 00:00:00'
    opaque.save(args.output / 'orientation-6.jpg', quality=100, subsampling=0, exif=exif)
    with Image.open(args.output / 'orientation-6.jpg') as image:
        ImageOps.exif_transpose(image).save(args.output / 'orientation-normalized.png', compress_level=9)
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    # LittleCMS inserts the current creation date. Fix the ICC header date for reproducibility.
    profile = profile[:24] + struct.pack('>6H', 2000, 1, 1, 0, 0, 0) + profile[36:]
    opaque.save(args.output / 'srgb-icc.png', icc_profile=profile, dpi=(300, 300))
    # A correct PNG signature and IHDR declare oversized decoded memory before any image allocation.
    oversized = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 100_000, 100_000, 8, 2, 0, 0, 0)) + chunk(b'IEND', b'')
    (args.output / 'oversized-header.png').write_bytes(oversized)
    (args.output / 'corrupt.jpg').write_bytes(b'\xff\xd8this is deliberately not a valid JPEG\xff\xd9')
    frames = [Image.new('RGB', (4, 3), color) for color in ['red', 'blue']]
    frames[0].save(args.output / 'animated.gif', save_all=True, append_images=frames[1:], duration=100, loop=0)
    (args.output / 'unsupported.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="red"/></svg>\n')
    files = []
    for path in sorted(args.output.iterdir()):
        if path.is_file():
            files.append({'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': digest(path)})
    write_json(ROOT / 'benchmarks/fixtures/manifest.json', {
        'version': '1.0.0', 'license': 'CC0-1.0', 'role': 'deterministic correctness only; excluded from quality corpora',
        'generator': 'benchmarks/generate_fixtures.py', 'generator_sha256': digest(Path(__file__)),
        'pillow': Image.__version__, 'files': files,
        'known_answers': {
            'rgba.png': {'width': 8, 'height': 6, 'mode': 'RGBA', 'pixel_formula': '[31*x, 43*y, 19*(x+y), [0,64,128,192,255,128,255,0][x]]'},
            'mask.png': {'width': 8, 'height': 6, 'meaning': 'light foreground; dark background', 'columns': alpha_values},
            'composites': {'formula': 'round((foreground_byte*alpha_byte + background_byte*(255-alpha_byte))/255) in encoded sRGB bytes; no linear-light claim'},
            'orientation-6.jpg': {'raw_width': 80, 'raw_height': 60, 'orientation': 6, 'normalized_width': 60, 'normalized_height': 80, 'sensitive_metadata_present': ['Artist', 'DateTime'], 'normalize_exactly_once': True},
            'srgb-icc.png': {'width': 80, 'height': 60, 'profile': 'embedded generated sRGB ICC; required color metadata retained by policy', 'dpi': 300},
            'oversized-header.png': {'declared_width': 100000, 'declared_height': 100000, 'expected': 'reject before large allocation; payload intentionally has no IDAT'},
            'corrupt.jpg': {'expected': 'explicit invalid-image error'},
            'animated.gif': {'frames': 2, 'expected': 'unsupported animated-input error'},
            'unsupported.svg': {'expected': 'unsupported format error; never execute arbitrary SVG'},
        },
    })
    print(f'Generated {len(files)} correctness artifacts in {args.output}')


if __name__ == '__main__':
    main()
