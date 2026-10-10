# Actual SDK, CLI and MCP removal verification

2026-10-09, independent verification lane. Production input sources were copied from integrated main `9409757993a2b536a550a6fe44ee253993122ab7` plus the coordinator's identified current contract changes, then compiled in the isolated verification worktree. Only tests and review evidence were edited by this reviewer. The reviewed T01/T11 criteria came from private active specification revision 1.2, SHA-256 `b7c33afd05ad020f285f9b62d85c809204c03b1a9790fcae21e5b6cab753f374`. Active revision 1.3 was inspected after execution, SHA-256 `e5f828d0a6d62d0b92a79b0f440c0528a4200ef4c469aa19fb514afe17a967a1`; its settled design preference leaves these acceptance criteria unchanged.

The machine image/export checks passed. Full T01 remains FAIL because actual visual inspection shows missing intended subject. No delivery gate passes on this evidence alone.

## Input and conditions

The real 2400×1600 acceptance photo is `benchmarks/fixtures/generated/acceptance/t01-2400x1600.png`, SHA-256 `08eeb79ecc9b1b1ed5bf6c93631835005b240d24523303379384737694585734`. Manifest version 1.0.0, SHA-256 `36c16076aa94f94c4af1f2f0deb106fca33aeb5f94a0fe05425ea42c7124d4ce`. Its public-domain source is the [Wikimedia birdwatching photo](https://commons.wikimedia.org/wiki/File:A_group_of_people_stand_birdwatching.jpg), source SHA-256 `59240dd21009422421968a096a28a551caa4130d0e0435f549c632c7a7904dc7`. The manifest requires retaining all three visible birdwatchers with clothing and equipment.

Real local inference used `birefnet-512-fp16`, repository `naddy24/birefnet-512-webgpu`, immutable revision `ca02a86c094927479e2be583abe87f8ea73fcfda`, SHA-256 `6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8`, 473,435,223 bytes. Native engine verifies the existing model file before initialization. Records identify fp16 weights, float32 I/O, 512×512 inference, CPU backend, onnxruntime-node 1.30.0 and edge cleanup `none`. No model or image result was simulated.

Linux x64, kernel 7.2.5-3-omarchy, Intel i7-8665U, eight logical CPUs, 16,558,522,368 bytes RAM, Node 26.11.1, Sharp 0.35.5, libvips 8.18.7. Official MCP SDK 1.32.1 supplies a fresh `Client` and `StdioClientTransport`. Installed main lockfile SHA-256 is `1eff8f71823e96cde9198b94df90d43dc6f0e3c34dd2259c727f84f922162faa`. Native build and typecheck passed. SDK, CLI and MCP model processes ran serially, with disposal before starting the next process.

Cross-adapter decoded pixels require exact equality, fixed in test commit `7469a908858856b78318f5a04befd2b21b3744b4` before execution. This compares identical installed native model, kernels and encoders. It does not establish a browser/native inference tolerance.

## Reproduction

The test can target a built source tree or an installed package through `SUPERASTER_PACKAGE_ROOT`; this run targeted the built source tree. Generate the pinned acceptance fixture with `benchmarks/prepare_acceptance.py` if needed, and install the approved quality model separately. In the source tree with installed dependencies:

```sh
node_modules/.bin/tsc -p tsconfig.native.json
node_modules/.bin/tsc --noEmit
SUPERASTER_RUN_INFERENCE_ACCEPTANCE=1 \
SUPERASTER_MODEL_DIR=/absolute/path/to/verified/model-directory \
SUPERASTER_SPEC_PATH=/absolute/path/to/private/superaster-technical-spec.updated.md \
node_modules/.bin/vitest run tests/inference-adapters.test.ts \
  --reporter=verbose --reporter=json --outputFile=.cache/inference-adapters-results.json
```

Optional `SUPERASTER_ACCEPTANCE_ROOT` locates the rights-cleared manifest and fixture. Without the inference opt-in, the expensive tests report skipped, which means NOT RUN.

Actual run used `/home/sadid/Downloads/Superaster/superaster/.cache/models` and wrote outputs to `/home/sadid/Downloads/Superaster/superaster-verification-adapters/.cache/inference-adapters-LbjEBL`. This initial run passed T01 machine checks in 46.085 seconds and failed the T11 test assertion after 24.343 seconds. The failed assertion was a test bug described below. The model ran once in each of SDK, CLI and MCP, then exited; it was not rerun to fix the test.

## Results

| Required behavior | Result and evidence |
| --- | --- |
| T01 native dimensions, format and alpha | PASS: actual 2400×1600 single-frame RGBA PNG through SDK/CLI/MCP, continuous alpha, retained opaque pixels |
| T01 thin-adapter semantics | PASS: exact resolved SDK/CLI recipe and recipe hash; identical SDK/CLI/MCP output bytes and decoded RGBA, maximum channel difference 0 |
| Original preservation and default metadata | PASS: source hash unchanged; EXIF/XMP/IPTC absent; sRGB ICC present; all 965,388 opaque pixels preserve original RGB exactly |
| T01 intended subject | FAIL: independent assistant visual inspection of source and white composite shows most of the left birdwatcher's head, torso and legs erased, leaving fragments of arm and shoes. The manifest explicitly requires all three birdwatchers. Do not change that criterion to make this output pass. |
| Formal human quality panel | NOT RUN: this visual failure is an assistant observation, not a completed human panel or held-out quality score |
| T11 fresh actual agent tools | PASS for the machine workflow: real MCP initialize/listTools/capabilities/inspect/remove/transform/validate produced accessible paths, file URIs and readable execution sidecars |
| T11 composition/encoding | PASS: 1200×1200 opaque white contain canvas, actual WebP, 111,968 bytes, white interior padding; SDK preparation from its matching cutout yields identical file and decoded pixels |
| T11 rule outcomes | PASS: mandatory maximum-size, bytes and supported-format rules pass; recommended 2048-square size correctly fails; visual shape consistency correctly needs review |
| Unsupported request | PASS: actual MCP generation request returns INVALID_RECIPE and creates no output |
| Tool response size | PASS: maximum captured successful response size 7,338 bytes; results contain records and paths rather than giant image bytes |
| Fresh package install, cold download/offline/network tracing | NOT RUN in this lane: built local package and existing verified model files were used |
| Browser, physical phone, release support and performance budgets | NOT RUN in this lane; no support claim follows from native results |

All three cutouts have 2,656,034 fully transparent pixels, 218,578 partial pixels and 965,388 opaque pixels. These counts prove alpha behavior, not intended-subject quality. The exported PNG is 6,997,873 bytes, SHA-256 `9e1bc86a97eebe62f4574b876d4bcb688754b95f36a821cd6037745c23dfabb8`; decoded RGBA SHA-256 `120359d25957a67ddc9f68af95975cbbbfc111e28ffb3812dc11df30e30fe22a`. SDK and MCP prepared WebP SHA-256 is `69f42310aeed84deadc5e4f0581c683403edde296d02a2b94e5d3d445feb69dd`; decoded RGBA SHA-256 `a4b3f7a7b944eb51ed6bb8adabd8a085613337c9f144b552cd91adadf29eb6cc`.

The SDK transform took 23.335 seconds, including existing-model verification and new session initialization. Recorded inference-kernel times were SDK 13.724 seconds, CLI 11.333 seconds and MCP 11.840 seconds; initialization was 6.921, 6.078 and 6.096 seconds respectively. These three first-session observations are not a benchmark median/p95, warmed throughput or a supported-device budget. Memory was not sampled by this test.

## Test failure and focused continuation

The initial T11 workflow actually reached and returned validation. The test parser incorrectly required `rules[].status`. The declared API in `packages/contract/src/index.ts` defines `RuleOutcome.state`, with lowercase `pass`, `fail`, `needs_review`, and `not_checked`; `catalog.validate` and the captured MCP response agree. Minimal actual response is `{ "id": "maximum-size", "state": "pass", ... }`. This was a reviewer test error, not a production contract defect or an uppercase/lowercase discrepancy.

The correction changes that field and preserves the original failed runner result. A non-ML continuation compares every compiled source hash against the initial run, checks retained input/output hashes, parses the original captured response, invokes a fresh actual MCP client for validation and unsupported-request denial, then compares actual SDK preparation pixels. It does not call removal or initialize another model.

```sh
SUPERASTER_EXISTING_ACCEPTANCE_EVIDENCE=/absolute/path/to/inference-adapters-LbjEBL \
node_modules/.bin/vitest run tests/inference-adapters.test.ts \
  --reporter=verbose --reporter=json --outputFile=.cache/inference-adapters-continuation-results.json
```

The continuation passed in 3.960 seconds, with two expensive tests explicitly skipped. Its actual outputs are in `.cache/inference-adapters-gluxHa`. No numerical tolerance or expected image property changed.

Committed raw evidence in `evidence/reviews/inference-adapters/`:

| Evidence | SHA-256 |
| --- | --- |
| `initial-observations.json` | `6c4032655fdfcd02b7b63b37bf6bff1748a4532116a81ea3b6e95e0d202745da` |
| `initial-runner-result.json` | `ae0d2ff90f3d9f3a555922d8c1a47d4f0b870f893cc55e5f45395997529e9652` |
| `nonml-continuation-observations.json` | `e3cdd3dbe8ce3b5ad403f87e6cf5e55ed2a37386c5e67e0e20ba7592c7f74b96` |
| `nonml-continuation-runner-result.json` | `5ea450e46bffa8c1360d6af2f3edb1a8a97256cb7f8701f96dd089844ccbe3bd` |

Those machine records contain exact compiled hashes and actual returned tool payloads. Original exports and white/black/color composites remain in the identified local run directory. `mcp-cutout-white.png` and `input.png` were opened for the visual finding; the display resized them from 2400×1600 to 1920×1280. The missing left subject is visible at that scale; no metric or full-resolution edge judgment is inferred from the resized view.

## Production source inputs

| Path | SHA-256 |
| --- | --- |
| Native engine | `f61f7745c53a2adff17070e14ee00d4b1f6e8d9a6be7686966d552bf59f80ed2` |
| Raster and declared-tag parser | `3bea48ef456d73b4efd02d5ad0fa3e2df393c7d05272ac2b6977c3f911401fbe` |
| Shared pipeline | `d9b83874cb365f89e49407b5ea902573c96ab40e3f5c53f2d0e99ff48865bcc1` |
| Approved model definitions | `e1aae271dd22ef8dbecb98b67940c6c3e85f8ee9234708c1a7e0f4976ace6df5` |
| Contract | `0fe7c50e5451ca638b953558c3bbd21129be0674b42669ff3bea433d4e1f01dd` |
| Core | `c01b7f0dc5694d183d68f55a4005e612715af4e52b65d3a18471d03c7a045db7` |
| SDK entry | `6456d89c6f8cbade644325459abb6c1474c4c2f5b82ac99dcbb2832fc62f2a28` |
| SDK file batches | `41454675683e660e9b32efb89edd2680b7fa9e558a463ea54ee38cbe2b9a186d` |
| CLI entry | `ea08d6fc260e6f0e122e84cc4a764cd3232bf96ef350fcc7b4f0189d653e2f10` |
| MCP entry | `c22672776d9a136cca3be1ddbb52edfba3cbbb23330498f5b32c0060e7a1b52e` |
| Published catalog data | `f24d590ab9b04b936467c44e0e2ef2cfb18bebba5e1924d8243ba2e9f6fd3a14` |

These results verify actual processing paths and expose an unresolved quality failure. G2/G3 acceptance cannot be claimed complete while that retained-subject failure or required device/human checks remain unresolved.
