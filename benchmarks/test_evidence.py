"""Observable tests for correctness fixtures and benchmark failure reporting."""
from __future__ import annotations
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from PIL import Image, ImageOps
from common import ROOT, digest
from image_evidence import inspect_image, make_composites
from run import percentile, process_tree_rss_kib


class ImageEvidenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        subprocess.run([sys.executable, str(ROOT / 'benchmarks/generate_fixtures.py')], check=True, stdout=subprocess.DEVNULL)
        cls.generated = ROOT / 'benchmarks/fixtures/generated'

    def test_fixture_reproduction(self) -> None:
        first = {path.name: digest(path) for path in self.generated.iterdir() if path.is_file()}
        subprocess.run([sys.executable, str(ROOT / 'benchmarks/generate_fixtures.py')], check=True, stdout=subprocess.DEVNULL)
        second = {path.name: digest(path) for path in self.generated.iterdir() if path.is_file()}
        self.assertEqual(first, second)

    def test_decoded_alpha_counts(self) -> None:
        result = inspect_image(self.generated / 'rgba.png')
        self.assertEqual((result['width'], result['height']), (8, 6))
        self.assertEqual(result['transparent_pixels'], 12)
        self.assertEqual(result['partially_transparent_pixels'], 24)
        self.assertEqual(result['opaque_pixels'], 12)

    def test_composition_uses_actual_alpha_and_rgb(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            outputs = make_composites(self.generated / 'rgba.png', Path(name))
            with Image.open(self.generated / 'rgba.png') as rgba:
                for label, background in [('white', (255, 255, 255)), ('black', (0, 0, 0)), ('color', (44, 118, 150))]:
                    with Image.open(outputs[label]) as composite:
                        for y in range(rgba.height):
                            for x in range(rgba.width):
                                pixel = rgba.getpixel((x, y))
                                expected = tuple(round((pixel[channel] * pixel[3] + background[channel] * (255 - pixel[3])) / 255) for channel in range(3))
                                self.assertEqual(composite.getpixel((x, y)), expected)

    def test_exif_normalizes_once(self) -> None:
        with Image.open(self.generated / 'orientation-6.jpg') as image:
            self.assertEqual(image.size, (80, 60))
            normalized = ImageOps.exif_transpose(image)
            self.assertEqual(normalized.size, (60, 80))
            self.assertEqual(ImageOps.exif_transpose(normalized).tobytes(), normalized.tobytes())
            self.assertIsNone(normalized.getexif().get(274))

    def test_animated_fixture_is_not_single_frame(self) -> None:
        self.assertEqual(inspect_image(self.generated / 'animated.gif')['frames'], 2)

    def test_percentiles_do_not_create_missing_measurements(self) -> None:
        self.assertIsNone(percentile([], .95))
        self.assertEqual(percentile([1, 2, 3], .5), 2)
        self.assertAlmostEqual(percentile([1, 2, 3], .95), 2.9)

    def test_runner_reports_success_without_output_as_failure(self) -> None:
        self.check_runner(['true'], timeout=1, expected_timed_out=False)

    def test_runner_bounds_stalled_command(self) -> None:
        self.check_runner([sys.executable, '-c', 'import time;time.sleep(60)'], timeout=.1, expected_timed_out=True)

    def check_runner(self, command: list[str], timeout: float, expected_timed_out: bool) -> None:
        with tempfile.TemporaryDirectory() as name:
            temp = Path(name)
            fixture = self.generated / 'rgba.png'
            manifest = {'version': 'test', 'split': 'correctness', 'cases': [{'id': 'fixture', 'category': 'synthetic-correctness', 'evaluation': {'path': str(fixture.relative_to(ROOT)), 'sha256': digest(fixture), 'width': 8, 'height': 6}}]}
            manifest_path = temp / 'manifest.json'
            manifest_path.write_text(json.dumps(manifest))
            profile = temp / 'profile.json'
            profile.write_text(json.dumps({'role': 'benchmark runner error test; no inference'}))
            output = temp / 'run'
            result = subprocess.run([sys.executable, str(ROOT / 'benchmarks/run.py'), '--manifest', str(manifest_path), '--profile', str(profile), '--command-json', json.dumps(command), '--output', str(output), '--timeout-seconds', str(timeout)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            summary = json.loads((output / 'results.json').read_text())
            self.assertEqual(summary['artifact_fail'], 1)
            self.assertEqual(summary['quality_status'], 'NOT RUN')
            record = summary['records'][0]
            self.assertEqual(record['timed_out'], expected_timed_out)
            self.assertEqual(record['status'], 'FAIL')
            if not expected_timed_out:
                self.assertIn('without requested cutout', record['artifact_error'])


if __name__ == '__main__':
    unittest.main()
