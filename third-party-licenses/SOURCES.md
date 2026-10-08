# Library source access and replacement

This notice accompanies the separately loaded browser `vips.wasm`, which contains LGPL library portions. Keep the complete license texts in `legal/`, each library's copyright/terms in `wasm/`, and the vendor inventory in `runtime/` with the app. Library modification and reverse engineering to debug such modifications are permitted under the applicable LGPL terms. Superaster's original application source remains available from its public repository.

## Source identifiers

| Binary/build | Corresponding upstream source and retained instructions |
| --- | --- |
| wasm-vips 0.0.19 | [source tree](https://github.com/kleisauke/wasm-vips/tree/49ac4378f2df80e38f45491abeeac9b86dddbedd), [retained build.sh](sources/wasm-vips-build.sh), [Dockerfile](sources/wasm-vips-Dockerfile), [published CI workflow](sources/wasm-vips-ci.yml). npm `gitHead` and the decoded registry provenance statement identify this commit. The provenance statement is retained in `sources/wasm-vips-npm-provenance.json`; its signature was not independently verified in this audit. |
| Main LGPL source libraries | libvips 8.18.7, glib 2.90.0, libexif 0.6.26. [archives.json](sources/archives.json) gives upstream archive URLs, actual download sizes and verified SHA-256. libnsgif source and its MIT notice are included inside libvips. |
| Other main-WASM dependencies | Versions and source-fetch URLs are in the retained build.sh and actual runtime versions inventory. Full source license texts accompany the shipped compiled portions. Optional HEIF/JXL/resvg plugins are not copied into this app. |
| Emscripten/runtime | 6.0.10, Docker image `emscripten/emsdk:6.0.10`, plus the upstream fork patch identified in Dockerfile. Full runtime notices are retained in `wasm/emscripten-6.0.10-LICENSE`. |
| Native official npm dependency | [sharp-libvips v1.3.4 source](https://github.com/lovell/sharp-libvips/tree/ebb95f8add54eee8bed840e3fb587e4cbec857d7), [POSIX build](sources/sharp-libvips-posix.sh), [Linux x64 Dockerfile](sources/sharp-libvips-Linux-x64-Dockerfile), supplier version/notice files in `native/`. This optional dependency supplies the binary separately from Superaster's original-JS tarball. |

The source archive URLs were downloaded and hashed on 2026-10-09. Source archives remain available from their named upstream hosts; `fetch-sources.mjs` retrieves the recorded bytes and refuses a hash mismatch. If a required URL becomes unavailable, retain the failure and provide a permitted equivalent mirror with the same hash before claiming source access. A moved version tag cannot silently replace an identified source input.

## Fetch the recorded source archives

From the repository root, choose a new output directory:

```sh
node third-party-licenses/fetch-sources.mjs /absolute/path/source-archives
```

The script checks declared length and SHA-256, creates files exclusively and does not build or execute downloaded code. It retrieves the pinned build repositories and the main LGPL source archives named above. The exact npm package integrity remains in the root lockfile, and the distributed WASM's hash is in the top-level notices.

## Build and recombine

The published wasm-vips CI runs its Dockerfile and default `build.sh` at the pinned commit. A fresh source checkout can use those commands:

```sh
git clone https://github.com/kleisauke/wasm-vips.git superaster-vips-source
cd superaster-vips-source
git checkout --detach 49ac4378f2df80e38f45491abeeac9b86dddbedd
docker build -t superaster-vips-source .
docker run --rm -v "$PWD:/src" superaster-vips-source
```

These build commands were inspected, not executed by the documentation lane. The upstream scripts fetch additional dependency archives and patches. Some patch URLs reference fork branches, and the container installs system build tools. For a fully frozen rebuild, retain/hash the exact patch and archive bytes, pin the container digest/build-tool inputs, and compare the generated library's version/operator behavior and original artifact hash. Identifying the published commit alone does not prove bit-reproducible compilation. Do not claim that an untested or changed patch is the original release's input.

The app loads the library from `/runtime/vips-es6.js` and `/runtime/vips.wasm`, without an immutable application integrity check that prevents replacing the library. The wrapper initializes `dynamicLibraries: []`; unsupported codec plugins are omitted. To use a modified interface-compatible library in a locally served app:

1. Build the library and compatible JS wrapper from the source above with your declared modifications. Retain its licenses and changes. If build inputs change, record the new versions/hashes rather than relabeling it as the original binary.
2. Build Superaster's identified source release. Replace `packages/web/public/runtime/vips.wasm` and, if required, `vips-es6.js` with the compatible outputs after `npm run assets`. `npm run assets` normally restores the official npm files, so invoke the underlying web build next with `npx vite build`, then `npx tsx scripts/service-worker.ts` to regenerate the cache for the modified assets.
3. Serve the result using `npm run preview`, clear only that local app origin's old service-worker/app cache and load the new build. Check isolation, library initialization and the deterministic color/alpha/geometry fixtures. Record the substituted binary hashes and actual outputs. A compatible modified library must work without an application license restriction on the substitution.

The application code needed to recombine the build is the public repository's TypeScript, generated contract, package/lockfile and assets/service-worker scripts. Preserve those exact source files with the release and its reproduction commands. Do not infer validated runtime support for arbitrary modified libraries.

## Distribution admission still to verify

The full notice copies, source identities, actual archive retrieval and replacement instructions are prepared. The final integrated release still must verify that its static output includes these notices and accessible source directions, repeat the copied-asset/module inventory, and test library replacement/recombination on the identified build. Exact fork patch/container inputs and a source rebuild have not been independently reproduced here. Keep those checks unrun until their evidence exists. No complete licensing-distribution acceptance is inferred from a link or this checklist.
