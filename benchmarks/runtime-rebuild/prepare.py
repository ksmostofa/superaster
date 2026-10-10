#!/usr/bin/env python3
"""Prepare a declared modified build with local inputs and no compiler execution."""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import tarfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
MARKER = '8.18.7-superaster-modified'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=pathlib.Path, required=True)
    args = parser.parse_args()
    cache = args.cache.resolve()
    manifest = json.loads((ROOT / 'benchmarks/runtime-rebuild/inputs.json').read_text())
    inputs = cache / 'inputs'
    for entry in manifest['entries']:
        file = inputs / entry['file']
        assert file.stat().st_size == entry['bytes'] and sha(file) == entry['sha256'], entry['component']
    tool_pins = json.loads((ROOT / 'benchmarks/runtime-rebuild/toolchain.json').read_text())
    for entry in tool_pins['archives']:
        file = cache / entry['file']
        assert file.stat().st_size == entry['bytes'] and sha(file) == entry['sha256'], entry['file']
    for filename, directory in [('wasm-binaries-6.0.10.tar.xz', 'toolchain'),
                                ('node-v24.19.0-linux-x64.tar.xz', 'node'),
                                ('cmake-3.28.3-linux-x86_64.tar.gz', 'cmake')]:
        if not (cache / directory).exists():
            with tarfile.open(cache / filename) as archive:
                archive.extractall(cache / directory, filter='data')
    if not (cache / 'meson-wheel').exists():
        with zipfile.ZipFile(cache / 'meson-1.12.1-py3-none-any.whl') as wheel:
            for name in wheel.namelist():
                assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
            wheel.extractall(cache / 'meson-wheel')
    if not (cache / 'toolchain/upstream').exists():
        (cache / 'toolchain/upstream').symlink_to('install', target_is_directory=True)
    source_parent = cache / 'source'
    source_parent.mkdir(exist_ok=False)
    wasm = next(entry for entry in manifest['entries'] if entry['component'] == 'wasm-vips')
    with tarfile.open(inputs / wasm['file']) as archive:
        archive.extractall(source_parent, filter='data')
    source = source_parent / ('wasm-vips-' + wasm['version'])
    build = source / 'build.sh'
    assert sha(build) == '03087405e00849b4da5f46681ba019904817b7e65554c75a4b25c9c9a7485b7c'
    # Refuse to reuse supplier binaries, if the source archive ever includes any.
    removed = []
    for file in (source / 'lib').glob('vips*'):
        if file.is_file() and file.suffix in ['.wasm', '.js', '.mjs']:
            removed.append({'file': str(file), 'sha256': sha(file)})
            file.unlink()
    (cache / 'bin').mkdir(exist_ok=True)
    mapping = {alias: str(inputs / entry['file']) for entry in manifest['entries']
               for alias in entry['aliases']}
    (cache / 'curl-map.json').write_text(json.dumps(mapping, indent=2) + '\n')
    # Only the known upstream fetch grammar is accepted. Each alias supplies
    # verified bytes from this cache. No curl executable or network is used.
    curl = cache / 'bin/curl'
    curl.write_text('#!/usr/bin/env python3\nimport json,pathlib,shutil,sys\n'
                    f'mapping=json.loads(pathlib.Path({str(cache / "curl-map.json")!r}).read_text())\n'
                    "assert len(sys.argv)==3 and sys.argv[1] in ['-Ls','-Lks'], 'Unexpected curl invocation'\n"
                    "path=mapping.get(sys.argv[2])\n"
                    "assert path, 'Unpinned source fetch: '+sys.argv[2]\n"
                    "with open(path,'rb') as stream:shutil.copyfileobj(stream,sys.stdout.buffer)\n")
    curl.chmod(0o755)
    meson = cache / 'bin/meson'
    meson.write_text('#!/usr/bin/env python3\nimport sys\n'
                     f'sys.path.insert(0,{str(cache / "meson-wheel")!r})\n'
                     'from mesonbuild.mesonmain import main\nraise SystemExit(main())\n')
    meson.chmod(0o755)
    text = build.read_text()
    text = text.replace('set -e\n', 'set -eo pipefail\n', 1)
    assert text.count('export MAKEFLAGS="-j$(nproc)"') == 1
    text = text.replace('export MAKEFLAGS="-j$(nproc)"', 'export MAKEFLAGS="-j2"')
    # Meson install otherwise chooses Ninja's host-wide parallel default.
    text = text.replace('meson install -C ', 'meson compile -C _build --jobs 2\n  meson install --no-rebuild -C ')
    # The bindings build uses its own build directory, unlike dependency builds.
    text = text.replace('meson compile -C _build --jobs 2\n  meson install --no-rebuild -C $DEPS/wasm-vips',
                        'meson compile -C $DEPS/wasm-vips --jobs 2\n  meson install --no-rebuild -C $DEPS/wasm-vips')
    anchor = '  # Disable building man pages, gettext po files, tools, and (fuzz-)tests\n'
    assert text.count(anchor) == 1
    text = text.replace(anchor, "  sed -i 's/return VIPS_VERSION_STRING;/return VIPS_VERSION_STRING \"-superaster-modified\";/' libvips/iofuncs/init.c\n" + anchor)
    build.write_text(text)
    config = cache / 'emscripten-config.py'
    install = cache / 'toolchain/install'
    node = cache / 'node/node-v24.19.0-linux-x64/bin/node'
    config.write_text(f'LLVM_ROOT={str(install / "bin")!r}\n'
                      f'BINARYEN_ROOT={str(install)!r}\n'
                      f'NODE_JS={str(node)!r}\n'
                      f'CACHE={str(cache / "emcache")!r}\n')
    patch = inputs / 'emscripten-patch.patch'
    subprocess.run(['patch', '--batch', '-p1', '-i', str(patch)],
                   cwd=install / 'emscripten', check=True)
    report = {'status': 'PREPARED_NOT_COMPILED', 'source_directory': str(source),
              'marker': MARKER, 'compiler_jobs': 2,
              'upstream_build_sha256': '03087405e00849b4da5f46681ba019904817b7e65554c75a4b25c9c9a7485b7c',
              'adapted_build_sha256': sha(build), 'removed_supplier_binaries': removed,
              'arguments': ['--disable-jxl', '--disable-avif', '--disable-svg'],
              'modified_library': 'libvips version_string only; image algorithms unchanged',
              'historical_binary_reproduction': 'NOT ASSERTED',
              'inputs_manifest_sha256': sha(ROOT / 'benchmarks/runtime-rebuild/inputs.json'),
              'toolchain_manifest_sha256': sha(ROOT / 'benchmarks/runtime-rebuild/toolchain.json')}
    (cache / 'prepared.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
