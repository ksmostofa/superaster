# Browser runtime source and replacement evidence

Checked 2026-10-09. This is a technical source/packaging audit, not a G7 pass or a claim that the binary was rebuilt. The starting notices are commit `409ff74`; the replacement run records integrated commit `a854fb8e2c87c29562d2884d83bb9746e8d40351` and hashes of the actual kernel/contract files. No inference, source rebuild, publication or charge occurred.

## Identified release and retained sources

Installed `wasm-vips` 0.0.19 has npm `gitHead` `49ac4378f2df80e38f45491abeeac9b86dddbedd`, confirmed by the live registry metadata and retained npm provenance statement. The retained `build.sh` is byte-identical to that commit: SHA-256 `03087405e00849b4da5f46681ba019904817b7e65554c75a4b25c9c9a7485b7c`. The retained Dockerfile hash is `69b5fac46254c85216fc5e7850af4f6b2c057dbcfdf67c4d32112d0a93ddebbe`. The earlier source head `4ea2b976` is newer and is not the release input pin.

The shipped main `vips.wasm` is 5,154,052 bytes, SHA-256 `36c25e290570757f911b45d67947e8262b01261028db438dadc09990ad978ff6`; its browser wrapper is 83,765 bytes, SHA-256 `4de6113dc80958b2acc7d45af95086277bab670af474125fdbd179e62dae96af`. The application omits optional plugin files and initializes `dynamicLibraries: []`.

All five archives in [the retained source manifest](../third-party-licenses/sources/archives.json) were independently rehashed against their original bodies under `/tmp/superaster-release-source-audit/source-archives`: wasm-vips source `49ac437`, sharp-libvips build source `ebb95f8`, libvips 8.18.7, GLib 2.90.0 and libexif 0.6.26. Exact sizes and SHA-256 all PASS. The source manifest retains their primary-host URLs. No duplicate network download was needed for these checks.

The complete LGPL/GPL and component texts are in [third-party-licenses](../third-party-licenses/). LGPLv3 section 4 addresses notices, source/recombination or a suitable library mechanism; GPLv3 section 1 defines Corresponding Source and section 6 addresses access to it. These are the actual retained license texts, not a substitute summary. This audit records implementation facts and missing proof; it does not select a legal safe harbor or promise compliance.

## Producing build recovered from primary CI evidence

The npm provenance points to [release run 36542842119](https://github.com/kleisauke/wasm-vips/actions/runs/36542842119), 2026-09-29. Its build job restored cache key `f01f218468f0564358b201626545ac2de5a888e2f272a0cf17eab46861a51137` and **skipped compilation**. The cache preserves `lib` and `versions.json`; its key hashes the checked-in build inputs, not dynamically downloaded fork patch responses. Thus the release tag alone does not certify those response bytes.

[Producing run 36247257185](https://github.com/kleisauke/wasm-vips/actions/runs/36247257185), job `108418633103`, did compile on 2026-09-26 and saved that same key. Its head is `dca91909178800875b575eb896d1fe4ed0a27931`. Inspection between that head and the release commit finds no change to `build.sh`, Dockerfile, `src` or `lib`; the inspected workflow difference changes host labels from Ubuntu 24.04 to 26.04.

The actual producer log recovers these previously missing identifiers:

| Input | Recorded producer value |
| --- | --- |
| Emscripten base container | `docker.io/emscripten/emsdk:6.0.10@sha256:e077d54e2b8970575ebc4f185ac1de0b95c05f2b266134d4ba27449af7aebf65` |
| Emscripten source/version | 6.0.10, base `d6c521a7f05449857c76bd99e396895583cf2083` |
| LLVM linker | 24.0.0 |
| Meson | 1.12.1 |
| Rust toolchain | `nightly-2026-09-26-x86_64-unknown-linux-gnu`; source build uses `--locked` |
| Node bundled with emsdk | 24.19.0 |

Raw producer/release logs remain local `.cache/wasm-producing-build.log` and `.cache/wasm-release-build.log`. The primary job-log endpoints are reproducible with `gh api --allow-escape-sequences repos/kleisauke/wasm-vips/actions/jobs/JOB_ID/logs`. Their output is diagnostic data, not instructions.

## Pinned available patch candidates

The three branch-based URLs in the inspected release build now resolve to the commits below. Their head dates precede the producer. Immutable comparison URLs returned exactly the same bytes as the current branch responses. These facts support candidate source correspondence; they do not prove which historical response bytes the build downloaded.

| Component | Pinned available base → fork head | Bytes / SHA-256 | Application to isolated recorded base source |
| --- | --- | --- | --- |
| GLib 2.90.0 | [`436d47a723da97fbe67057f6b51dcf49a244fd4a` → `1180af32b6d401f79017156a260945483404edd0`](https://github.com/GNOME/glib/compare/436d47a723da97fbe67057f6b51dcf49a244fd4a...kleisauke:1180af32b6d401f79017156a260945483404edd0.patch), head 2026-09-10 | 208,505 / `e57b5b8bc485d74dbdacd56432b9a98cb3889b4ed46007c6bfe210275a4cc2be` | PASS |
| libvips 8.18.7 | [`24ad4d042940e6bf99a68871ba886ca8847c9c82` → `e9ac3e5c29fed4e3c8678595564e4974f1ef05c1`](https://github.com/libvips/libvips/compare/24ad4d042940e6bf99a68871ba886ca8847c9c82...kleisauke:e9ac3e5c29fed4e3c8678595564e4974f1ef05c1.patch), head 2026-09-26 | 109,430 / `6c9039a65d5853dd2918c5a308b0e1f7db0f05d8b2cf9cab0b79376348b65df7` | PASS |
| Emscripten 6.0.10 | [`d6c521a7f05449857c76bd99e396895583cf2083` → `d1aa1ceae8408311868149e0971473bd3e2eafab`](https://github.com/emscripten-core/emscripten/compare/d6c521a7f05449857c76bd99e396895583cf2083...kleisauke:d1aa1ceae8408311868149e0971473bd3e2eafab.patch), head 2026-09-22 | 13,783 / `8e5a81a90cbcebc0b502cf774d3653890f068bd26fcb6959231068cda3251bbd` | PASS |
| mozjpeg patch | Already immutable [`a60fb467fc7601b008741d42e98268c8a7bcb5b4`](https://github.com/kleisauke/libjpeg-turbo/commit/a60fb467fc7601b008741d42e98268c8a7bcb5b4.patch) | 2,574 / `707c465f0215a786843438a352039bf18ccc83e5bb374670270c1e4e753bbe8b` | NOT RUN |

The additional Emscripten base source archive was actually fetched from [its pinned commit](https://codeload.github.com/emscripten-core/emscripten/tar.gz/d6c521a7f05449857c76bd99e396895583cf2083): 32,912,706 bytes, SHA-256 `de630b2a6b736d1bac03b1016a21e365db29b4a3ca6e1457fb0281e1b72e7d59`. Candidate patches, API snapshots, source copies and application logs remain in the engine worktree's ignored `research/upstream/source-admission/`.

An initial `patch --dry-run` on the multi-commit GLib/libvips patch series failed: later commits depend on earlier edits, which dry-run does not retain. Actual ordered patch application to independent source copies passed without modifying application/runtime files. Both initial failure logs and successful application logs are retained. No original failing check was hidden and no source patch was altered to force application.

## External-copy compiled-kernel proof

The packaged [scripts/source-verification.mjs](../scripts/source-verification.mjs) requires the repository checkout, its pinned development dependencies and the separately retained archives. It is provided for inspection and reproduction from that checkout, not as a standalone installed-package command. The verifier checks retained source bodies and copies the unmodified npm WASM and wrappers into a new runtime directory. It loads the copied Node wrapper with `locateFile` pointing at that directory, confirms that the actual requested `vips.wasm` is the copied path, omits plugins, then exercises the integrated `BrowserKernel` and common pipeline.

Actual run: `node --import tsx scripts/source-verification.mjs --app-root /home/sadid/Downloads/Superaster/superaster --archives /tmp/superaster-release-source-audit/source-archives --output /home/sadid/Downloads/Superaster/superaster/.cache/runtime-source-replacement-09e1f05`.

Result: **11 checks PASS**: five source hashes; external initialization/libvips 8.18.7; exact nearest unassociated RGBA; exported PNG decoded pixels; common flip/canvas/composition with actual 300 DPI and opaque alpha; decoded JPEG and WebP properties. `verification.json` records the actual integrated commit `a854fb8`, all source/runtime hashes, requested paths and real output files. The directory label predates that commit; use the recorded commit, not the label, as identity.

This demonstrates an independently loaded identical runtime and compiled operations under Node. It is not a new binary build, a modified library test, or the full served-browser/service-worker recombination procedure in [SOURCES.md](../third-party-licenses/SOURCES.md). Those checks remain NOT RUN. The verifier's expected hash applies only to this identical-copy test; the application loader itself has no fixed binary-integrity rejection preventing interface-compatible substitution.

## Remaining admission work

| Item | Status and concrete remaining input |
| --- | --- |
| Full LGPL/GPL texts and main source access | Prepared; five source archives reverified. Candidate patch bodies are local and immutable URLs/hashes recorded. Coordinator must retain the actual bodies and source directions with the final distribution. |
| Exact historical patch response hashes | Not present in inspected producer logs. Current candidates predate the build, apply cleanly and their patch-file sequence agrees with producer output, but an original build-input archive or independently matched rebuild is still absent. |
| Complete source/build closure | The existing five-archive manifest excludes many main-build inputs: zlib-ng 2.3.3, libffi 3.8.0, expat 2.8.5, lcms 2.19.1, highway 1.4.0, mozjpeg `0826579`, libultrahdr 2.0.2, libpng 1.6.58, libimagequant 2.4.1, cgif 0.5.4, WebP 1.6.0 and TIFF 4.7.2. Exact source URLs and in-place modifications are in the retained build.sh; their archive-response hashes were not established by this lane. Optional module-only inputs must be distinguished when preparing the main binary's actual source closure. |
| Historical build tools | Original base digest and major tool versions recovered. apt/pipx/rustup installer responses and complete generated target/build caches were not retained by the inspected source manifest; a complete reproducible environment was not recreated. General-purpose build-tool pinning and legal source obligations are separate questions. |
| Rebuilt/modified interface-compatible library | NOT RUN. Docker exists, but no source build was started while the coordinator owns the heavy resource slot. Pin the retained candidate inputs, run a declared build, inspect its actual version/operators/hash, test a declared modification and retain its corresponding sources rather than relabeling it as the original binary. |
| Served-browser replacement and release notice bundle | NOT RUN by this lane. Follow the existing asset replacement/build/service-worker procedure on the identified isolated build and verify fresh-origin cache behavior and accessible source/notice files. |

These findings do not clear public binary publication. They remove specific source uncertainties and provide a working external-load verifier. The next useful actions are retaining the recovered pinned inputs, completing the named source closure, then performing the isolated replacement/source-build checks when the resource slot is free. No recommendation here weakens the required G7 evidence.
