#!/usr/bin/env python3
"""Run one bounded processor command at a time against a hash-pinned corpus."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import platform
import signal
import subprocess
import time
from typing import Any
from common import ROOT, digest, read_json, resolve_input, write_json
from image_evidence import inspect_image, make_composites


def process_tree_rss_kib(pid: int) -> int | None:
    """Linux instantaneous resident memory for command process and its descendants."""
    if platform.system() != 'Linux':
        return None
    total = 0
    pending = [pid]
    seen = set()
    while pending:
        current = pending.pop()
        if current in seen:
            continue
        seen.add(current)
        try:
            status = Path(f'/proc/{current}/status').read_text()
            for line in status.splitlines():
                if line.startswith('VmRSS:'):
                    total += int(line.split()[1])
            tasks = Path(f'/proc/{current}/task')
            for task in tasks.iterdir():
                children = (task / 'children').read_text().split()
                pending.extend(int(child) for child in children)
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
    return total


def percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    lo = math.floor(index)
    hi = math.ceil(index)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (index - lo)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'benchmarks/corpus/screening.json')
    parser.add_argument('--profile', type=Path, required=True, help='Pinned engine/model/runtime/device/settings JSON; these are recorded claims and require engine records to substantiate them.')
    parser.add_argument('--command-json', required=True, help='JSON argv array. Placeholders: {input}, {output}, {record}, {profile}. No shell runs.')
    parser.add_argument('--output', type=Path, required=True, help='New result directory; must not already exist.')
    parser.add_argument('--repeats', type=int, default=1)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--timeout-seconds', type=float, default=180)
    parser.add_argument('--acknowledge-heldout', action='store_true', help='Release evaluation only, after tuning decisions are frozen.')
    args = parser.parse_args()
    manifest = read_json(args.manifest)
    profile = read_json(args.profile)
    argv_template = json.loads(args.command_json)
    if not isinstance(argv_template, list) or not argv_template or not all(isinstance(v, str) for v in argv_template):
        parser.error('--command-json must be a nonempty JSON array of strings')
    if not 1 <= args.repeats <= 20 or args.timeout_seconds <= 0:
        parser.error('repeats must be 1..20 and timeout must be positive')
    if args.limit is not None and args.limit <= 0:
        parser.error('limit must be positive')
    if manifest['split'] == 'heldout' and not args.acknowledge_heldout:
        parser.error('Held-out images require --acknowledge-heldout after recipe/profile freeze; never tune on their results')
    args.output.mkdir(parents=True, exist_ok=False)
    cases = manifest['cases'][:args.limit] if args.limit else manifest['cases']
    settings = {
        'started_at_utc': datetime.now(timezone.utc).isoformat(),
        'manifest_sha256': digest(args.manifest),
        'manifest_version': manifest['version'],
        'split': manifest['split'],
        'profile_sha256': digest(args.profile),
        'profile_supplied': profile,
        'command_argv_template': argv_template,
        'repeats': args.repeats,
        'timeout_seconds': args.timeout_seconds,
        'parallel_commands': 1,
        'rss_sample_interval_seconds': 0.02,
        'environment': {'platform': platform.platform(), 'python': platform.python_version(), 'processor': platform.processor()},
        'timing_scope': 'one fresh process per case; includes command startup, decode, inference, render, encode and command exit; excludes separate model installation',
        'warm_session_latency': 'NOT RUN; use a processor-specific persistent session driver, not these fresh-process timings',
        'stage_timings': 'Copied from actual execution record when emitted; command elapsed time never fabricates missing stages',
        'quality_judgments': 'NOT RUN; no ground-truth alpha or human review supplied',
        'model_train_test_overlap': 'unknown; distinct local split is not evidence of checkpoint training exclusion',
    }
    write_json(args.output / 'conditions.json', settings)
    records: list[dict[str, Any]] = []
    for case in cases:
        input_path = resolve_input(case['evaluation']['path'])
        if not input_path.exists() or digest(input_path) != case['evaluation']['sha256']:
            raise ValueError(f'Missing or changed evaluation input: {case["id"]}')
        for repetition in range(args.repeats):
            directory = args.output / f'{case["id"]}--{repetition + 1}'
            directory.mkdir()
            output_path = directory / 'cutout.png'
            record_path = directory / 'execution.json'
            replacements = {'{input}': str(input_path), '{output}': str(output_path.resolve()), '{record}': str(record_path.resolve()), '{profile}': str(args.profile.resolve())}
            argv = [value for value in argv_template]
            for placeholder, replacement in replacements.items():
                argv = [value.replace(placeholder, replacement) for value in argv]
            start = time.perf_counter()
            timed_out = False
            peak_rss = None
            try:
                with (directory / 'stdout.log').open('wb') as stdout, (directory / 'stderr.log').open('wb') as stderr:
                    process = subprocess.Popen(argv, cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
                    while process.poll() is None:
                        rss = process_tree_rss_kib(process.pid)
                        if rss is not None:
                            peak_rss = max(peak_rss or 0, rss)
                        if time.perf_counter() - start > args.timeout_seconds:
                            timed_out = True
                            os.killpg(process.pid, signal.SIGTERM)
                            try:
                                process.wait(timeout=3)
                            except subprocess.TimeoutExpired:
                                os.killpg(process.pid, signal.SIGKILL)
                                process.wait()
                            break
                        time.sleep(0.02)
                    exit_code = process.wait()
                command_error = None
            except OSError as error:
                exit_code = None
                command_error = str(error)
            elapsed = time.perf_counter() - start
            record: dict[str, Any] = {'id': case['id'], 'category': case['category'], 'repeat': repetition + 1, 'input_sha256': case['evaluation']['sha256'], 'command': argv, 'elapsed_seconds': elapsed, 'peak_rss_kib_observed': peak_rss, 'rss_limit': '20 ms instantaneous samples of process tree; shared pages may double-count and unsampled short peaks may be missed', 'exit_code': exit_code, 'timed_out': timed_out, 'command_error': command_error, 'status': 'FAIL', 'human_intended_subject': 'NOT RUN', 'human_missing_subject_background_halo_fine_edges': 'NOT RUN'}
            if exit_code == 0 and not timed_out and output_path.exists():
                try:
                    properties = inspect_image(output_path)
                    expected = case['evaluation']
                    checks = {
                        'requested_dimensions': properties['width'] == expected['width'] and properties['height'] == expected['height'],
                        'png': properties['format'] == 'PNG',
                        'single_frame': properties['frames'] == 1,
                        'has_nonopaque_pixels': properties['transparent_pixels'] + properties['partially_transparent_pixels'] > 0,
                        'has_retained_pixels': properties['partially_transparent_pixels'] + properties['opaque_pixels'] > 0,
                        'source_preserved': digest(input_path) == expected['sha256'],
                    }
                    record['decoded_properties'] = properties
                    record['artifact_checks'] = {key: 'PASS' if passed else 'FAIL' for key, passed in checks.items()}
                    record['visual_files'] = make_composites(output_path, directory)
                    record['status'] = 'PASS' if all(checks.values()) else 'FAIL'
                    record['status_scope'] = 'artifact validity only; quality/device/support gate remains separate'
                except Exception as error:
                    record['artifact_error'] = f'{type(error).__name__}: {error}'
            elif exit_code == 0:
                record['artifact_error'] = 'Command returned success without requested cutout PNG'
            if record_path.exists():
                try:
                    record['engine_execution_record'] = read_json(record_path)
                    record['engine_execution_record_sha256'] = digest(record_path)
                except (OSError, ValueError) as error:
                    record['execution_record_error'] = str(error)
            else:
                record['engine_execution_record'] = 'NOT RUN; processor emitted no sidecar record'
            write_json(directory / 'measurement.json', record)
            records.append(record)
            print(json.dumps({'id': case['id'], 'repeat': repetition + 1, 'status': record['status'], 'elapsed_seconds': elapsed}), flush=True)
    valid_times = [record['elapsed_seconds'] for record in records if record['status'] == 'PASS']
    summary = {'attempts': len(records), 'artifact_pass': len(valid_times), 'artifact_fail': len(records) - len(valid_times), 'artifact_failure_rate': (len(records) - len(valid_times)) / len(records) if records else None, 'successful_command_median_seconds': percentile(valid_times, 0.5), 'successful_command_p95_seconds': percentile(valid_times, 0.95), 'percentile_method': 'linear interpolation at (n-1)*p; descriptive sample statistic, not a confidence bound', 'quality_status': 'NOT RUN', 'physical_phone_status': 'NOT RUN', 'records': records}
    write_json(args.output / 'results.json', summary)
    if summary['artifact_fail']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
