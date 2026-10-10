#!/usr/bin/env bash
set -euo pipefail
if [[ ${SUPERASTER_COMPILE_APPROVED:-} != yes ]]; then
  echo 'The coordinator must grant the serial compiler resource slot first.' >&2
  exit 2
fi
if [[ $# != 1 ]]; then echo 'Usage: run.sh PREPARED_CACHE_DIRECTORY' >&2; exit 2; fi
rebuild_cache=$(realpath "$1")
rebuild_source=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["source_directory"])' "$rebuild_cache/prepared.json")
rebuild_path="$rebuild_cache/bin:$rebuild_cache/toolchain/install/emscripten:$rebuild_cache/toolchain/install/bin:$rebuild_cache/node/node-v24.19.0-linux-x64/bin:$rebuild_cache/cmake/cmake-3.28.3-linux-x86_64/bin:/usr/bin:/bin"
# All host files are read-only. Only this task cache is writable; networking is
# unavailable throughout compilation. Keep the complete log, including failure.
/usr/bin/time -v -o "$rebuild_cache/compile-resource.txt" \
  bwrap --unshare-net --die-with-parent --ro-bind / / \
  --bind "$rebuild_cache" "$rebuild_cache" --tmpfs /tmp --dev /dev --proc /proc \
  --chdir "$rebuild_source" \
  /usr/bin/env -i PATH="$rebuild_path" LANG=C.UTF-8 \
  EMSDK="$rebuild_cache/toolchain" EM_CONFIG="$rebuild_cache/emscripten-config.py" \
  EM_CACHE="$rebuild_cache/emcache" EMCC_CORES=2 CMAKE_BUILD_PARALLEL_LEVEL=2 \
  /usr/bin/timeout --signal=TERM --kill-after=15s 75m \
  /bin/bash ./build.sh --disable-jxl --disable-avif --disable-svg \
  > "$rebuild_cache/compile.log" 2>&1
