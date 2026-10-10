# Removal and imaging reuse audit

Checked 2026-10-08 JST. This is evidence for the reuse prerequisite, not a gate pass or a quality claim. `artifacts.json` records immutable model URLs, revisions, sizes, and SHA-256 values. Upstream clones, package extracts, raw API snapshots, downloaded weights, and scratch outputs are ignored local research inputs.

## Decision

Use the same pinned BiRefNet ONNX artifact through ONNX Runtime Web and Node, with common preprocessing and postprocessing. Keep the inference adapter small. The first feasibility input is BiRefNet-lite 512 fp16; full BiRefNet 512 fp16 is the Quality candidate, subject to G2 measurements. Quality and Fast must be distinct named profiles. A failed Quality session must return an error or present an explicit Fast choice; it must not silently substitute lite.

Adapt selected BG0 cache, load-progress, resource cleanup, and corrupt-mask checks after conformance tests. Do not ship the current npm package as the authoritative shared pipeline. It cannot pin an engine, expose the original alpha for correction, or provide a complete execution record. Its repository differs materially from its published package, and its built-in full-to-lite fallback violates the explicit Quality policy. A direct ONNX adapter avoids a second browser pipeline and removes the Transformers.js promise-chain patch dependency.

Reuse Sharp 0.35.5 for native decode, orientation, color, geometry, composition, and encoding. Screen wasm-vips 0.0.19 in a Worker for the matching browser operations. It is still early-development software. Publish only codecs and paths tested through both required adapters. No Rust integration is justified by a measured bottleneck yet.

## What was inspected

| Component | Exact input | Actual code and rights findings | Reuse decision |
| --- | --- | --- | --- |
| BG0 repository | `420442c016eafb5fc76c66c56b6bacf191c61ed7`, `packages/browser` version 0.1.2 | Apache-2.0 source. `models.ts` declares full/lite 512 fp16; `index.ts` performs model/provider fallback, session leasing, progress, cancellation boundaries, optional focused refinement; `cache.ts` uses Cache API/IndexedDB with 16 MiB chunks and size validation. `image.ts` uses native decode, source-in canvas composition, and a smoothstep alpha remap in Fast. Model licenses are independent. Repository also includes HEIC/iOS assets outside launch scope. | Adapt audited patterns; keep profile choice and original alpha owned by Superaster. Do not import unrelated HEIC/iOS features. |
| BG0 npm | `@bg0/browser@0.1.1`, tarball SHA-256 `37da2bef9c2cffed16575475fcf5808e05b9ddf8f2d621396aac4dec38788447` | Published 2026-09-15. Tarball contains 10 files, 25,961 unpacked bytes, dependency `@huggingface/transformers:^3.8.1`. `dist/index.js` has only lite model; fp16 WebGPU, fp32 WASM. It returns baked PNG, provider, quality, dimensions, duration, but no checkpoint pin, alpha, or session/dispose controls. | Reject as drop-in complete pipeline. Still a useful small reference. |
| rembg | `202e42649a8492a7c49f808de36608a7d1cbbfe3` | MIT source. `BaseSession.normalize` divides RGB by the image's maximum, not constant 255. `BiRefNetSessionGeneral.predict` applies sigmoid then per-image min/max normalization and Lanczos. Both change output semantics from the inspected HF processor. `bg.py` includes PyMatting foreground estimation separately from alpha estimation. Artifact download uses release URLs and MD5. | Research baseline and edge-RGB reference; do not copy its preprocessing unchanged or run Python in production. Wrapper MIT does not approve every offered model. |
| withoutBG | `891c1663315ead5c3be16b55205c096594de7ef2` | Apache-2.0 source with a mixed-license open model. `routed.py` chooses matting or BiRefNet, validates finite output, and bilinearly upsamples. Model requires DINOv3 terms and attribution in addition to Apache/MIT. Initial model is about 1.5 GB according to upstream; exact sidecars control each graph. | No first browser integration. More download, routing, and rights obligations than the initial shared route. Keep as a comparator if BiRefNet screening reveals a specific unresolved failure. No Cloud API in this product. |
| IMG.LY | `12f56cc4f2a90d624e165a715748d22efc7a1d93`, web/node 1.7.0 | AGPL-3.0 license in both packages. Web source uses ISNet variants, schema validation, external static resource chunks, optional Worker proxy; web ORT peer 1.21.0, native ORT 1.21.0 and Sharp 0.32.4. Package test scripts are `true`, not evidence of correctness. | Compare behavior without importing AGPL code into the planned Apache implementation. Any adoption would need an explicit license decision. |
| BEN2 Base | HF `e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f`; source `2c99a5da477b5523585bfa5c893888a6e818a8f6` | Model card and source license MIT, copyright 2025 Prama LLC. Base ONNX exists, 222,932,053 bytes. `onnx_run.py` stretches to 1024, rescales to 0..1 without ImageNet normalization, then bilinearly resizes and min/max rescales output. Its `[w,h]` interpolation ordering merits a rectangular-input check. Advertised enhanced commercial model is separate from Base. | Approved Base candidate for focused screening; not first reuse choice because browser operators/memory and rectangular parity are unverified. No claims inherited from the commercial model. |
| FeyNoBg | HF `c1fd67fbefe3efeb78fe2a003270fb5350a0bb1c`; nobg `37015c6a2dff63eaa052410c23169ecdfeb64e0c` | HF card and nobg source Apache-2.0. Published safetensors 1,051,353,168 bytes; no ONNX file in pinned HF tree. Processor uses 1024 RGB/ImageNet normalization; source utilities distinguish sigmoid alpha from foreground color refinement. | Not first browser candidate. A separately pinned conversion and operator audit are prerequisites for runtime comparison. |
| Sharp | npm 0.35.5; tarball SHA-256 `3b6bbbe6b308f5c383938ca4a31926cd5d79c4651ed8c5fda16a97da2014a9ac` | Apache-2.0 wrapper; libvips and bundled codec/library licenses independent. Native source handles auto orientation once, sRGB transforms, premultiplication before resize/composition and unpremultiplication for relevant paths. `metadata()` reads header properties without decoded pixels; `limitInputPixels` bounds decode. | Reuse compiled implementation; centralize explicit fit/kernel/color/metadata policies and check actual decoded output. |
| wasm-vips | `4ea2b9769a1179735b61ce9cb97176a2c8366674`, npm 0.0.19 | MIT bindings; compiled libvips/glib/libexif/libheif use LGPLv3 via upstream's later-version clauses; notices enumerate other libraries. README requires SIMD, exception handling, SharedArrayBuffer and COOP/COEP. Unit source shows `Image.newFromBuffer`, `newFromMemory`, `extractBand`, `bandjoin`, resize/autorotate, and `writeToBuffer`. Explicit resource deletion is required. | Reuse browser compiled kernels if required operations, memory, color/alpha, and Worker execution pass. Include notices and corresponding-source links; no codec support inferred from package presence. |
| Snipmat | API/compatibility pages checked 2026-10-08 | Hosted paid credit API, legacy multipart fields/binary and ZIP outputs, cloud MCP with OAuth or API key. Local files use presigned upload URLs. No audited reusable source license obtained. | Workflow/conformance reference only. Images upload there, so it is outside the local processing path. |

Source links pin code rather than mutable branches: [BG0](https://github.com/opencoredev/bg0/tree/420442c016eafb5fc76c66c56b6bacf191c61ed7), [npm artifact](https://registry.npmjs.org/@bg0/browser/-/browser-0.1.1.tgz), [rembg](https://github.com/danielgatis/rembg/tree/202e42649a8492a7c49f808de36608a7d1cbbfe3), [withoutBG](https://github.com/withoutbg/withoutbg-python/tree/891c1663315ead5c3be16b55205c096594de7ef2), [IMG.LY](https://github.com/imgly/background-removal-js/tree/12f56cc4f2a90d624e165a715748d22efc7a1d93), [BEN2](https://github.com/PramaLLC/BEN2/tree/2c99a5da477b5523585bfa5c893888a6e818a8f6), [nobg](https://github.com/feyninc/nobg/tree/37015c6a2dff63eaa052410c23169ecdfeb64e0c), [wasm-vips](https://github.com/kleisauke/wasm-vips/tree/4ea2b9769a1179735b61ce9cb97176a2c8366674), [Sharp source package](https://registry.npmjs.org/sharp/-/sharp-0.35.5.tgz), [Snipmat API](https://snipmat.com/api), [Snipmat migration](https://snipmat.com/remove-bg-alternative).

## Artifact rights and provenance

Code license, source weights, converted artifact, and runtime library are separately recorded. The official BiRefNet [MIT notice](https://github.com/ZhengPeng7/BiRefNet/blob/ebcc0bc8ec7fe919cec829f2dea656b3078acddc/LICENSE) gives use, modification, commercial use, and redistribution rights with its copyright/permission notice retained. The original HF cards independently mark the source weights MIT; both chosen conversion cards mark their ONNX artifacts MIT. This permits local commercial processing and redistribution under those notices. It does not establish training-data completeness, model quality, or legal clearance of the subject in a user's photo.

| Candidate | Pinned conversion | Weight/source lineage | Artifact |
| --- | --- | --- | --- |
| Lite 512 fp16 | [studioludens](https://huggingface.co/studioludens/birefnet-lite-512/tree/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7) | [official lite](https://huggingface.co/ZhengPeng7/BiRefNet_lite/tree/aa62cd87eafb9cc43056d08ef3615a14628b831d), MIT | 98,484,532 bytes; SHA-256 `eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516` |
| Full 512 fp16 | [naddy24](https://huggingface.co/naddy24/birefnet-512-webgpu/tree/ca02a86c094927479e2be583abe87f8ea73fcfda) | [onnx-community](https://huggingface.co/onnx-community/BiRefNet_512x512-ONNX/tree/b0b30aff33d009f6bcd7dacdc3cdcf2f8f42175b) from [official 512](https://huggingface.co/ZhengPeng7/BiRefNet_512x512/tree/678c37f9158280a2b3000b566ecd12bfbfd1a09c), all MIT cards | 473,435,223 bytes; SHA-256 `6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8` |

The lite conversion card describes fixed 512 input, opset 17, a patched deformable-convolution exporter, then fp16 conversion. The full card describes replacing five empty-update ScatterND nodes with Identity and pruning 530 dead nodes. Its bit-exact claim is an upstream claim; this audit has not reproduced it. No downloaded Python executes in production. Conversion tools belong only in research. Neither converter repository includes a separate LICENSE file at its pinned revision; their explicit MIT model-card metadata plus the source MIT notice are the recorded weight terms. Keep both cards and original notices in model documentation.

BRIA RMBG-2.0 is not approved by its wrapper's code license. withoutBG's DINOv3-derived artifacts carry additional conditions and are not substitutes under the pure MIT approval. BEN2 enhanced commercial weights are not the MIT Base artifact. FeyNoBg needs an approved immutable ONNX conversion before production use.

## Shared inference semantics

Both 512 BiRefNet candidates use RGB stretched to 512×512, constant rescale 1/255, then ImageNet mean `[0.485,0.456,0.406]` and std `[0.229,0.224,0.225]`, with NCHW layout and tensor name `input_image`. Processor configuration specifies bilinear resampling. The graph emits single-channel logits. Apply sigmoid externally, preserve continuous alpha, bilinearly resize to requested output geometry. Do not add per-image min/max normalization or hard thresholds without a separately measured profile change. Preserve original RGB and alpha separately so corrections restore original-source pixels.

Exact tensor element types/output names and fp16 CPU support must come from loaded session metadata and a real run, not card assumptions. Those measured results are appended below when the smoke completes.

The direct APIs are `InferenceSession.create(modelBytesOrPath, options)`, `session.run(feeds)`, `new Tensor(type, data, dims)`, and `session.release()`. `inputNames`, `outputNames`, `inputMetadata`, and `outputMetadata` describe the loaded contract. Both runtime packages use common TypeScript API types. WebGPU is available through the `onnxruntime-web/webgpu` entry; WASM through the ordinary web package. CPU/WASM supports more operators than WebGPU, but operator presence does not prove this graph runs within memory. A Worker must terminate safely for active inference cancellation where the runtime cannot interrupt its Promise.

The checked npm versions are Node/Web 1.30.0, Sharp 0.35.5, wasm-vips 0.0.19. Transformers.js 4.3.1 depends on Node 1.30.0 but a development Web build `1.31.0-dev.20260914-8d85527a0`. BG0 pins 4.3.0 and adds a repository-only recovery patch changing `.then(load)` to `.then(load,load)` and the matching inference chain. This audit recommends stable direct 1.30.0 as the first smoke, then escalating only on a reproduced operator failure. [ORT Web](https://onnxruntime.ai/docs/tutorials/web/), [ORT Node](https://onnxruntime.ai/docs/get-started/with-javascript/node.html).

## Required integration gaps

| Gap | Observable check |
| --- | --- |
| Model bytes and cache identity | Hash every approved download before session creation; reject corrupted/truncated bytes; retry by explicit install/eviction. Upstream size-only cache checks are insufficient. |
| Profile choice | Requested Quality/full pin survives backend retry. Lite only on explicit Fast/profile selection. Record model, hash, inference size, precision, runtime and provider. |
| Original/alpha separation | Programmatic masks and web correction operate on the same alpha; RGB restoration reads normalized original, never generated pixels. |
| Cancellation and memory | Single initial heavy job, warm session reuse, bounded queue, releases after failure; Worker termination/native process boundary as required. BG0 checks AbortSignal at stage boundaries and does not interrupt a live desktop session.run call. |
| Exact manipulation and exports | Sharp/wasm-vips fit/crop/rotate/color/metadata/encoding semantics freeze only after fixture conformance; decode exports and inspect dimensions/alpha/bytes/pixels. |
| Offline/privacy | Cache app/runtime/model assets, verify warm and offline behavior, inspect network to prove no images leave device. Inference locality alone does not prove UI privacy. |
| Edge RGB | BG0 retains source RGB; its alpha changes do not recover unblended edge color. Test foreground estimation separately and preserve unaffected opaque detail. |
| Quality/performance | Rights-cleared 25-image screening and held-out release review, actual laptop and Pixel 7 measurements, category failures and numeric budgets. Upstream Mac/iPhone reports are not these device results. |

## Reproduction

Read-only audit used `git clone --depth 1`, `git rev-parse HEAD`, `rg`, exact npm tarball extraction, GitHub commit API, and Hugging Face `/api/models/<id>` plus pinned `/tree/<revision>?recursive=true`. LFS `oid` values are SHA-256 artifact hashes. Downloaded lite bytes were independently hashed and matched. Its transfer on this environment took about 144 seconds; network time is a single observation and not an inference budget.

```sh
curl --fail --location \
  https://huggingface.co/studioludens/birefnet-lite-512/resolve/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7/onnx/model_fp16.onnx \
  --output .cache/models/birefnet-lite-512-fp16.onnx
sha256sum .cache/models/birefnet-lite-512-fp16.onnx
node research/upstream/smoke-native.mjs
```

The scratch native smoke uses BG0's `cat.webp`, derived from [Pexels photo 1170986](https://www.pexels.com/photo/close-up-photography-of-brown-tabby-cat-1170986/) under the [Pexels license](https://www.pexels.com/license/), as recorded in its pinned sample README. This is a feasibility input, separate from the benchmark worker's cleared release corpus. It writes alpha, transparent PNG and white/black/magenta composites, source/output hashes, loaded tensor metadata, timing stages, and process memory. Outputs remain local until their evidence rights and relevance are reviewed.

## Status and unresolved prerequisites

Measured facts: upstream revisions/package parity, inspected preprocessing/fallback/source behavior, manifest sizes/hashes, matched lite download hash, native packages imported once as ORT 1.30.0 and Sharp 0.35.5.

Implementation decision: direct shared ORT adapter and separate immutable model manifests, with audited BG0 ideas adapted as necessary. It is justified by package parity gaps, missing alpha/pins, and explicit profile semantics, not by a performance claim.

Proposal: full 512 fp16 Quality and lite 512 fp16 Fast. Runtime/quality admission remains pending. No profile is advertised as supported yet.

Unresolved prerequisites: exact session tensor metadata; CPU/WebGPU/WASM operator and memory smoke; physical Pixel 7 access; numerical G2 budgets; observed quality and edge-RGB fixes; clean offline/caching/CORS deployment; copied notices and exact bundled-library source obligations. No required FAIL or NOT RUN is recategorized as a pass.

## Native feasibility observation

One real CPU removal completed on the available Intel Core i7-8665U laptop with 16 GiB RAM, Node 26.11.1, ORT Node 1.30.0 and Sharp 0.35.5. No model/provider substitution ran. The fp16 lite artifact accepts `input_image` as float32 `[1,3,512,512]` and emits `output_image` as float32 `[1,1,512,512]`. fp16 weights do not mean fp16 input/output. Both names/types were read from the loaded session and checked against the actual tensor. ORT warned that fp16 Div/Ceil constants could not be constant-folded by the CPU provider, but session creation and inference succeeded.

| Stage/property | Single observed run |
| --- | --- |
| Decode/preprocess | 11.0 ms |
| Session initialization | 4,247.3 ms |
| Inference | 3,349.9 ms |
| Postprocess plus five encoded outputs | 95.9 ms |
| Total excluding model download | 7,749.0 ms |
| Process maximum RSS | 2,455,516 KiB, about 2.34 GiB |
| Raw alpha | finite; 0.0000006017..0.9999999207; 13,240 intermediate 8-bit coverage values among 262,144 mask pixels |
| Encoded cutout | PNG, 768×512, RGBA8, 644,757 bytes, no metadata/profile, source hash unchanged |

The record is `research/upstream/lite-native-smoke.json`; cutout/mask/three composites share its prefix. A cat under the Pexels sample license supplies this smoke. It proves actual local inference and export, not complete quality, fixed budgets, browser viability, or phone support. The benchmark corpus remains a separate input set.

## Scratch export regression and corrected evidence

Visual inspection rejected the first encoded cat composite because it had repeating stripes. A 2×2 reproduction showed that Sharp expands a one-channel raw image to three channels unless `.greyscale()` is explicit before raw output. The scratch exporter indexed the expanded buffer as one channel. This was an export implementation bug, not a model output failure. Its evidence remains `evidence/feasibility/lite-native-first-export-failed.{json,png}`.

The corrected export explicitly requests one-channel raw mask and asserts `buffer.length === width*height`. A fresh rights-cleared `animal-fur.jpg` run produced inspected PNG/composites at 1200×977 with continuous alpha. Measured corrected run was 19.7 ms decode/preprocess, 4,043.6 ms initialization, 3,425.7 ms inference, 221.7 ms postprocess/five exports, 7,751.6 ms total, max RSS 2,445,072 KiB. PNG is RGBA8 and 1,991,841 bytes, SHA-256 `1e930accc3d48dba82cd93963fa9e0751b9cb4e41bef83675d053fb3227a53b5`. Alpha has 12,892 intermediate 8-bit values among 262,144 mask pixels. Visual inspection shows the cat retained with whiskers, while soft fur edge and snow remnants need category review. This observation does not score quality. Exact corrected script, log, JSON and output images are in `evidence/feasibility/`.
