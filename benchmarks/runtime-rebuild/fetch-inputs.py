#!/usr/bin/env python3
"""Retain declared build inputs without executing downloaded code."""
import argparse
import hashlib
import json
import pathlib
import shutil
import urllib.request


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            value.update(chunk)
    return value.hexdigest()


def verify(path, entry):
    if path.stat().st_size != entry['bytes'] or digest(path) != entry['sha256']:
        raise ValueError(f"Input identity mismatch: {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--reuse', type=pathlib.Path, action='append', default=[])
    parser.add_argument('--toolchain', action='store_true')
    args = parser.parse_args()
    filename = 'toolchain.json' if args.toolchain else 'inputs.json'
    manifest = json.loads(pathlib.Path(__file__).with_name(filename).read_text())
    if args.toolchain:
        manifest['entries'] = [{**entry, 'component': entry['file']} for entry in manifest['archives']]
    args.output.mkdir(parents=True, exist_ok=True)
    records = []
    for entry in manifest['entries']:
        output = args.output / entry['file']
        method = 'existing'
        if not output.exists():
            reused = None
            names = [entry['file']]
            if entry['component'].endswith('-patch'):
                names.append(entry['component'].removesuffix('-patch') + '-pinned.patch')
            for directory in args.reuse:
                for name in names:
                    candidate = directory / name
                    if candidate.exists():
                        verify(candidate, entry)
                        reused = candidate
                        break
                if reused:
                    break
            temporary = output.with_suffix(output.suffix + '.partial')
            if temporary.exists():
                raise ValueError(f"Retained partial input must be investigated: {temporary}")
            if reused:
                shutil.copyfile(reused, temporary)
                method = 'reused verified local body'
            else:
                request = urllib.request.Request(entry['url'], headers={'User-Agent': 'Superaster-source-audit'})
                with urllib.request.urlopen(request, timeout=60) as response, temporary.open('xb') as stream:
                    shutil.copyfileobj(response, stream)
                method = 'downloaded declared source URL'
            verify(temporary, entry)
            temporary.rename(output)
        verify(output, entry)
        records.append({'component': entry['component'], 'file': str(output.resolve()),
                        'bytes': output.stat().st_size, 'sha256': digest(output), 'method': method})
        print(entry['component'], 'HASH PASS', flush=True)
    result_name = 'verified-toolchain.json' if args.toolchain else 'verified-inputs.json'
    (args.output / result_name).write_text(json.dumps(records, indent=2) + '\n')


if __name__ == '__main__':
    main()
