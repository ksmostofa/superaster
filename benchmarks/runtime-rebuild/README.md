# Modified wasm-vips build

This is a source-rebuild and replacement diagnostic. It does not replace production assets, reproduce the supplier's historical binary, clear release licensing admission, or run model inference.

The official [emsdk 6.0.10 source](https://github.com/emscripten-core/emsdk/tree/a2b92777574c2feda07994cd4f1079a3dfc151f8) identifies Linux toolchain `666337b525e673e769121856d175f6f52b8ead64`. The [installation documentation](https://emscripten.org/docs/getting_started/downloads.html) describes an SDK contained in its own directory. We retain the compiler archive directly and supply a local configuration. No installer, Docker daemon, system package change or Rust installation is involved.

The declaration in `inputs.json` combines the checked source archives with the recorded immutable fork patch candidates. The current upstream branch-fetch aliases return retained bytes through a local `curl` replacement. Networking is disabled for the entire compiler process. The historical patch responses remain unproven.

`prepare.py` verifies each archive, extracts a fresh source tree, applies the Emscripten candidate patch and adapts the inspected upstream build. It limits Make and Ninja to two jobs and adds this observable libvips change:

```c
return VIPS_VERSION_STRING "-superaster-modified";
```

The change is inside `libvips/iofuncs/init.c`, in `vips_version_string()`. Its integer ABI/version values and imaging algorithms remain unchanged. The runtime verifier requires the changed string and a WASM hash different from the supplier binary. A copied binary cannot satisfy that check.

The build omits optional JXL, AVIF and resvg inputs. The application omits these plugins and supports single-frame PNG, JPEG and WebP. UHDR and the other recorded main dependencies remain enabled. This is a declared modified compatible build, not a claim to have reproduced the supplier's complete build. CMake 3.28.3 matches the producing log's reported version. Host Ninja, pkgconf and native GLib code-generation tools are recorded separately.

## Prepare without compiling

Use a fresh cache directory. Python 3.12 or newer, `patch`, Make, Ninja, pkgconf and the host GLib development/code-generation tools must already be available.

```sh
python3 benchmarks/runtime-rebuild/fetch-inputs.py --toolchain --output .cache/runtime-rebuild
python3 benchmarks/runtime-rebuild/fetch-inputs.py --output .cache/runtime-rebuild/inputs
python3 benchmarks/runtime-rebuild/prepare.py --cache .cache/runtime-rebuild
```

Pass `--reuse /absolute/path/retained-inputs` to either fetch command to reuse an already verified body. Partial downloads are retained and block resumption until inspected. A size or hash mismatch fails preparation. Neither fetch command executes supplier code.

## Compile after the coordinator grants the resource slot

The existing source tree is writable only inside the chosen cache. Bubblewrap makes the host read-only, removes network access and provides a private temporary directory. The command has a 75-minute bound and retains both the complete compiler log and resource report, including failures. Python's standard `resource` module records waited-child CPU usage and maximum RSS. That RSS value is not the simultaneous sum of all compiler processes. An existing resource report blocks accidental overwriting.

```sh
SUPERASTER_COMPILE_APPROVED=yes bash benchmarks/runtime-rebuild/run.sh .cache/runtime-rebuild
```

The expected runtime files are under `.cache/runtime-rebuild/source/wasm-vips-49ac4378f2df80e38f45491abeeac9b86dddbedd/lib/`. Actual output hashes, compile exit status and the modified source bytes must be recorded after the build. Preparation alone is not a source rebuild.

## Check actual runtime outputs

Run from the identified app checkout with its pinned development dependencies. Choose a new output directory and the actual compiled library directory.

```sh
node --import tsx /absolute/path/benchmarks/runtime-rebuild/verify-modified.mjs \
  --app-root /absolute/path/integrated-app \
  --runtime /absolute/path/compiled-source/lib \
  --output /absolute/path/new-runtime-evidence
```

The checks load the actual modified wrapper and WASM through external paths. They verify exact nearest-neighbor unassociated RGBA, decoded PNG pixels, ordered operations, density, opaque composition, pixel parity with the supplier on a deterministic fixture, and decoded JPEG/WebP properties. They retain real files and hashes. These checks do not establish browser cache behavior, broad image quality or a numerical ML tolerance.

## Served browser recombination still required

The coordinator must use a separate app clone at the recorded integrated commit. Build the normal assets, then replace `/runtime/vips.wasm` and its matched ES6 wrapper with the compiled outputs. Retain original and substituted hashes. Run the underlying Vite build and service-worker generator directly, since `npm run assets` restores the supplier files. Follow [the source directions](../../third-party-licenses/SOURCES.md).

Serve that isolated build on a fresh origin with COOP/COEP headers. In the actual browser, confirm isolation, the modified version string, fetched runtime hashes and accessible notices/source directions. Process the deterministic alpha/geometry/density fixture through the real app, export it, decode it and compare the pixels and properties. Repeat the warm-cache path on that origin. Retain actual network/cache evidence and files. The Node verifier cannot mark these browser checks PASS.
