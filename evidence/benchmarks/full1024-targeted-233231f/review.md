# Full1024 targeted retained-subject diagnostic

2026-10-09 JST. Result: intended-three-birdwatchers prerequisite FAIL. Both machine artifact checks PASS, and the fern is nonempty, but complete fern retention remains needs_review. Full512, Lite1024 and BEN2 failures remain preserved. This candidate is not a winning default or release-qualified profile.

The reviewer resumed monitoring the already running PID 31995 and wrapper 31988, without starting another inference. Both processes ended and the heavy-slot release was reported to the coordinator. Final results contain two actual runs, followed by session disposal. The original coordinator exec session owns the OS exit code; external PID monitoring does not recover it. `process-monitor.json` records this limit. Final stdout and JSON report machine PASS; that result does not pass intended-subject acceptance.

## Version, immutable inputs and actual contract

Active private specification revision 1.3 has SHA-256 `e5f828d0a6d62d0b92a79b0f440c0528a4200ef4c469aa19fb514afe17a967a1`. Recorded main HEAD is `233231fb849a258e44d8aa373a59ff260ffd1585` plus the source hashes below. The pinned model is `birefnet-full-1024-fp16`, revision 534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67, 489,666,272 bytes, SHA-256 `3654c741eb80bd926ada8fed1713b506ccf8d30eb1f6487e87eb9f234f33df09`. Its rights/graph audit remains in [full1024-audit.md](../../reviews/full1024-audit.md). Original-weight revision/conversion parity remains UNKNOWN.

The retained targeted manifest is unchanged, SHA-256 `e293dfc4721a5394d9203da05f3064ea428ec65375541b31d39cbfd69330d2c9`. T01 input/original hashes are `08eeb79ecc9b1b1ed5bf6c93631835005b240d24523303379384737694585734` / `59240dd21009422421968a096a28a551caa4130d0e0435f549c632c7a7904dc7`; fern hashes are `11f56e745cf24d162b5a415db8035c61e195c99411428ce210b1923240cd0b2b` / `20778fc6cc3b0a862578ec669d3714b00fcf9202591ac04dac7290ff70273ed9`. The all-three-person and foreground-frond criteria, output dimensions, edge cleanup `none`, default choices and byte-quantization semantics did not change. No held-out image, refinement or training was used.

One persistent production NativeEngine ran serially on Linux x64, i7-8665U, eight logical CPUs, 16,558,505,984 bytes RAM, Node 26.11.1, ORT Node 1.30.0 and Sharp 0.35.5/libvips 8.18.7. Cached production size/hash verification and check-only input/path preflight passed. Cold application transfer was NOT RUN.

The retained observer calls the original public session.run unchanged, returns its original tensors and records metadata/statistics. Observer SHA-256 is `c4d649e29377adb4be74ac9b2e1aca2f22ca1221d9ff9a20d6cfe4485e5b3c3e`. Both actual runs received `input_image`, float32 `[1,3,1024,1024]`, Float32Array, 3,145,728 elements, and returned `output_image`, float32 `[1,1,1024,1024]`, Float32Array, 1,048,576 elements. Each output has 1,048,576 finite logits and 0 nonnumeric/nonfinite elements. Production ImageNet RGB preprocessing and one external sigmoid were retained. CPU operators worked on these two exact runs; no other backend/device support follows.

## Saved outcomes

| Check | Three birdwatchers | Foreground fern |
| --- | --- | --- |
| Machine image/mask checks | PASS: 2400×1600 RGBA PNG and one-channel coverage mask | PASS: 1280×960 RGBA PNG and one-channel coverage mask |
| Alpha pixels: transparent / partial / opaque | 2,830,434 / 44,408 / 965,158 | 421,709 / 57,228 / 749,863 |
| Assistant intended-subject inspection | FAIL: required left person erased; two central people remain | needs_review: nonempty right/lower fronds, broad left/upper region removed and detached leaf visible |
| Original/metadata/opaque RGB | PASS: source hashes preserved, sensitive tags stripped, ICC retained, 0 changed opaque pixels | PASS for the same checks |
| Complete elapsed | 51.177s, first cached-model session | 77.197s, warmed session on distinct image |
| Recorded inference_kernel | 43.062s, includes observer | 76.269s, includes observer |
| Initialization | 4.827s | Session reused |
| Sampled RSS maximum | 9,109,835,776 bytes | 9,134,694,400 bytes |
| Process-lifetime maxRSS | 9,361,808 KiB | 9,412,516 KiB |
| Output SHA-256 | `760e00ad2e3612d8d221c72264aff90c6ea6d2845912452c6012e1cd0c5dc0b7` | `333cf6fc1f7942f38333251485a83070ca8e3ac33bfce1841f15979ca516d44b` |
| Mask SHA-256 | `ba8ada4147d734edd5dcf2c45c0c08eae16554559759e3e981be58d8db359c17` | `5c3c71d2dcc35d7bfae5b8a205c70f8eb069ad84e69e9f0ea33ff5ef22c07426` |

Actual inputs and white/black/#d946ef composites were opened. Group displays resized 2400×1600 to 1920×1280; fern remained 1280×960. The group shows complete erasure of the required left person's head, torso, arms and legs on all backgrounds. Fern shows retained fronds and a broad missing region, but no annotated subject boundary establishes which surrounding nursery fronds belong in the output. No fine-edge metric or fern acceptance PASS is inferred. Assistant findings are in `assistant-review.json`; original `human-review.json` remains NOT RUN.

Continuous sigmoid-alpha mean was 0.2573655745 for group and 0.6388859791 for fern. Logit ranges were -35.49632263..26.51148987 and -29.37687874..27.13109970. The observer counted 274,999 and 687,826 model-space alpha values above the existing half-byte rounding boundary 0.5/255. These statistics diagnose finite model output/quantization only; they are not new quality thresholds, calibrated confidence or ground truth. Final alpha counts refer to exported dimensions after interpolation.

Observer statistics took 3.383s and 1.606s. Kernel/complete times include that work plus unseparated hash/read/write overhead. RSS includes this observer and the whole production processing path. 20ms samples can miss peaks; lifetime maxRSS cannot be attributed to the warmed image alone. The final lifetime maximum is about 9.64 decimal GB. One warmed sample does not establish a useful p95, performance ranking or a phone budget. Numerical acceptance budgets remain NOT FROZEN.

## Existing diagnoses and independent saved-file checks

| Recorded profile | Required three people | Fern diagnostic |
| --- | --- | --- |
| Full512 | FAIL: left person materially erased in existing T01 adapter review | Existing 25-case Quality artifact validity passed; that is not a complete frond-quality score |
| Lite1024 | FAIL: left person partly erased | FAIL: exported alpha entirely zero |
| BEN2 Base | FAIL: left person essentially erased | needs_review: nonempty fern with partly faded fronds |
| Full1024, this run | FAIL: left person erased | needs_review: nonempty fern with broad removed region |

`comparison.json` retains the unchanged-manifest Lite1024/BEN2/Full1024 alpha counts, elapsed/kernel times and RSS measures from their actual records. Runtime/profile/source and observer costs differ, so these descriptive values do not support a matched speed or overall quality claim. This Full1024 output is nonempty; Lite1024's empty-fern failure remains preserved. The all-three-person prerequisite still fails. It does not justify an unchanged retry, 25-case Full1024 expansion, model tuning or held-out use.

Independent file checks re-read saved PNGs without inference. Input/original/output/mask hashes match the records; both masks have one encoded/decoded grayscale channel; every mask byte equals its exported RGBA alpha; all opaque RGB bytes equal normalized originals. `artifact-verification.json` records PASS. The first checker attempt mistakenly used Sharp's default RGB raw output for a grayscale mask and failed its channel assertion. The initial script/failure is retained; the corrected checker verifies PNG metadata and requests explicit `b-w` raw pixels. No model or output reran or changed.

## Reproduction and source identification

The original command used the existing observer, unchanged manifest and approved cached artifact:

```sh
node --import tsx .cache/full1024-runtime-observer.mjs \
  --manifest .cache/lite1024-targeted-manifest.json --corpus-root . \
  --model-dir ../superaster-verification-adapters/.cache/full1024-audit \
  --engine birefnet-full-1024-fp16 --profile quality --edge none \
  --spec superaster-technical-spec.updated.md \
  --output evidence/benchmarks/full1024-targeted-233231f
```

The runner refuses an existing output directory. This command records what ran, not authorization for another run. Restore the retained observer/manifest to the named cache paths and use a new directory only after a new specific diagnostic question is authorized. Saved-file verification alone is reproducible with `node evidence/benchmarks/full1024-targeted-233231f/verify-artifacts.mjs` and initializes no model.

| Actual source at run start | SHA-256 |
| --- | --- |
| `packages/engines/src/native.ts` | `045a43cfcb1e0dc8c57dc0a0b43078dc8ffa2931dd74738198282eb2578ec833` |
| `packages/engines/src/pipeline.ts` | `6f069bbd002edc53691fa8bf8dd100cc97f7fc2417dacafb2428e31f8adae645` |
| `packages/engines/src/models.ts` | `947b8c6544a83c225be959ef2ba5abbc1bbbeb6006bfe0bb6827be1982c1f0b1` |
| `packages/engines/src/raster.ts` | `731a10a1d16abdb8bb870da293fb850a189ef6733c962e4766ff50b57d8e66a1` |
| `scripts/evaluate-native.ts` | `fa9256146dd920ab6322b26349df9274fef90a6888c8eaf2e03cdb338a8f7bb3` |

`conditions.json` SHA-256 is `e5ab4d94fdf7615b85fbd5eb1d2e61dfc3112ac29cf644be99a05928c3a7b69c`; `results.json` is `a819330118a7dde4ee42b9db786cfcf6086d6a1528cf287474fc56b56e368977`; `runtime-statistics.json` is `c05972c32f5179fe638ce70e5215839298659efd561e6335bf8b304c404c2f0b`. `artifact-index.json` pins every retained file except itself, including original exports, masks, composites, logs, observer and unchanged manifest. Original actual images remain under this identified run's two case directories. Birdwatching public-domain credit and Forest and Kim Starr's fern CC BY 3.0 US terms/derivative change remain in manifest and measurements; they are not relabeled Apache-2.0 or CC0.

The outcome is a retained automatic group failure plus exact native-runtime/artifact evidence. Human panel, physical Pixel 7, browser admission, frozen budgets and held-out/release evaluation remain NOT RUN or incomplete. No gate, default replacement or superiority claim is awarded.
