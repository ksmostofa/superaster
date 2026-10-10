"""Inspect decoded exports and make visual review files without quality claims."""
from __future__ import annotations
from pathlib import Path
from typing import Any
from PIL import Image
from common import digest


def inspect_image(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        alpha = image.convert('RGBA').getchannel('A')
        histogram = alpha.histogram()
        frames = getattr(image, 'n_frames', 1)
        exif = image.getexif()
        return {
            'format': image.format,
            'width': image.width,
            'height': image.height,
            'mode': image.mode,
            'frames': frames,
            'bytes': path.stat().st_size,
            'sha256': digest(path),
            'alpha_min': alpha.getextrema()[0],
            'alpha_max': alpha.getextrema()[1],
            'transparent_pixels': histogram[0],
            'partially_transparent_pixels': sum(histogram[1:255]),
            'opaque_pixels': histogram[255],
            'orientation': exif.get(274),
            'exif_tags': sorted(int(key) for key in exif),
            'icc_profile_bytes': len(image.info.get('icc_profile', b'')),
            'dpi': image.info.get('dpi'),
        }


def make_composites(path: Path, directory: Path) -> dict[str, str]:
    directory.mkdir(parents=True, exist_ok=True)
    outputs = {}
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
        alpha_path = directory / 'alpha.png'
        rgba.getchannel('A').save(alpha_path, compress_level=9)
        outputs['alpha'] = str(alpha_path)
        for name, color in [('white', '#ffffff'), ('black', '#000000'), ('color', '#2c7696')]:
            background = Image.new('RGBA', rgba.size, color)
            composite = Image.alpha_composite(background, rgba).convert('RGB')
            target = directory / f'{name}.png'
            composite.save(target, compress_level=9)
            outputs[name] = str(target)
    return outputs
