# Third-party notices

Superaster's original software is Apache-2.0. Original structured catalog records and generated correctness fixtures are CC0. Imported code, fonts, photographs, model weights and compiled libraries retain their own terms. The root package license does not relicense them. Personal/commercial local image processing and supported exports remain free.

The complete retained license texts and vendor notices are in [third-party-licenses/](third-party-licenses/). Its [manifest](third-party-licenses/manifest.json) records exact bytes, SHA-256 and source/package revisions. Keep this notice and the applicable full texts with distributions. They are actual upstream texts, including their copyright, permissions, restrictions and disclaimers. Do not replace them with a guessed generic license.

This inventory was checked on 2026-10-09 against the observed integrated alpha build. The final release must repeat the rendered-module and copied-asset inventory and retain its commit/build hashes. Packaging and corresponding-source/replacement checks remain explicit release work; this document does not declare G7 passed.

## Application UI and fonts

| Imported material | Retained terms and complete notice | Attribution and adaptation |
| --- | --- | --- |
| Rare UI source `b4de46efe4eb2613e22bb8134b482ed4e0c7736a` | [MIT + Commons Clause License Condition v1.0 + Attribution](third-party-licenses/ui/RARE-UI.txt) | Copyright 2026 Swami Malode. GooeyNav adapted for Vite, exact Luma tokens and brief application transitions. Visible credit: [Rare UI](https://rareui.com). |
| Animate UI source `efeb96ffd7a3b7a4868667e4ac3c346620fb3044` | [MIT + Commons Clause License Condition](third-party-licenses/ui/ANIMATE-UI.txt) | Copyright 2025 Elliot Sutton. Application button adapted to the theme and reduced-motion behavior. |
| Figtree via `@fontsource-variable/figtree` 5.3.0 | [SIL Open Font License 1.1, full copyright and text](third-party-licenses/js/@fontsource-variable__figtree-5.3.0-LICENSE) | Copyright 2022 The Figtree Project Authors, https://github.com/erikdkennedy/figtree. Fonts retain OFL, including its standalone-sale and naming conditions. |

The owner approved Rare UI use in this application under its retained terms on 2026-10-09. Its actual license requires a visible Rare UI link and restricts selling, sublicensing or redistributing the components themselves, including bundles/ports. Animate UI's actual license similarly restricts sale/redistribution of the components themselves in original form. These components are not plain MIT or Apache-2.0. Application-use permission does not grant permission to publish a component collection. A later vanilla UI preference does not remove current notices.

The exact shadcn Luma preset `b1VlJBjs` was inspected through official CLI 4.21.4. Its generated theme configuration is recorded in `research/luma-*.json`. The observed rendered app uses Figtree and the imported components above. Unused installed icon/component dependencies do not establish bundled assets or a new license grant.

## Browser JavaScript and build-generated runtime code

The [rendered-module inventory](third-party-licenses/browser-modules.json) identifies the observed browser build. Complete npm package notices below retain their exact copyright holders and terms. This covers actual rendered package code and generated runtime code; server tooling and unused optional codec plugins are not advertised as browser capabilities.

| Package/version | License | Complete retained notice |
| --- | --- | --- |
| React 19.3.0 | MIT | [React](third-party-licenses/js/react-19.3.0-LICENSE) |
| React DOM 19.3.0 | MIT | [React DOM](third-party-licenses/js/react-dom-19.3.0-LICENSE) |
| scheduler 0.28.0 | MIT | [scheduler](third-party-licenses/js/scheduler-0.28.0-LICENSE) |
| Effect 4.0.2 | MIT | [Effect](third-party-licenses/js/effect-4.0.2-LICENSE) |
| TypeBox 0.34.52 | MIT | [TypeBox](third-party-licenses/js/@sinclair__typebox-0.34.52-license) |
| Ajv 8.20.0 | MIT | [Ajv](third-party-licenses/js/ajv-8.20.0-LICENSE) |
| fast-deep-equal 3.1.3 | MIT | [fast-deep-equal](third-party-licenses/js/fast-deep-equal-3.1.3-LICENSE) |
| fast-uri 3.1.8 | BSD-3-Clause | [fast-uri, including URI-JS attribution](third-party-licenses/js/fast-uri-3.1.8-LICENSE) |
| json-schema-traverse 1.0.0 | MIT | [json-schema-traverse](third-party-licenses/js/json-schema-traverse-1.0.0-LICENSE) |
| fflate 0.8.3 | MIT | [fflate](third-party-licenses/js/fflate-0.8.3-LICENSE) |
| motion 14.0.0 | MIT | [motion](third-party-licenses/js/motion-14.0.0-LICENSE.md) |
| framer-motion 14.0.0 | MIT | [framer-motion](third-party-licenses/js/framer-motion-14.0.0-LICENSE.md) |
| motion-dom 14.0.0 | MIT | [motion-dom](third-party-licenses/js/motion-dom-14.0.0-LICENSE.md) |
| motion-utils 14.0.0 | MIT | [motion-utils](third-party-licenses/js/motion-utils-14.0.0-LICENSE.md) |
| Vite 8.3.4 module-preload code | MIT and included third-party notices | [Vite](third-party-licenses/js/vite-8.3.4-LICENSE.md) |
| Rolldown 1.2.13 generated runtime | MIT | [Rolldown](third-party-licenses/js/rolldown-1.2.13-LICENSE) |

## ONNX Runtime binaries

Browser processing uses ONNX Runtime Web 1.30.0 and copied `ort-wasm-simd-threaded.wasm`/`.mjs` runtime files. Native installation uses the official `onnxruntime-node` 1.30.0 dependency and its CPU binaries. Both retain Microsoft's [MIT license](third-party-licenses/runtime/onnxruntime-1.30.0-LICENSE) and the complete [ONNX Runtime third-party notices](third-party-licenses/runtime/onnxruntime-1.30.0-ThirdPartyNotices.txt), copied from upstream v1.30.0 commit `f2c39fe2f838cf35ce7da92824f5a5e3ee6e88a7`. Those notices include embedded third-party code; a Microsoft license alone is insufficient for the whole binary.

Observed CPU browser WASM SHA-256 is `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2`. The WebGPU candidate also uses `ort.webgpu.bundle.min.mjs` and its embedded JSEP loader from that same pinned package. Its separately verified `ort-wasm-simd-threaded.jsep.wasm` is 28,312,028 bytes, SHA-256 `3ad23231b5bd6d9dda55a7f84606315e0bf35b6750c28ee993c987c54cacab0f`, delivered from the pinned jsDelivr npm URL and stored in `superaster-ort-webgpu-1.30.0`. The loader is 46,851 bytes, SHA-256 `709853412fd1ffc34247af1e73569227b5b79629c5ca3f59cc39cf7e500e4947`; the bundled JavaScript is 117,732 bytes, SHA-256 `0730816731ce2cdfb06f273da065d4a1c7091eb9d1756a83b2916c8a89d015e2`. Complete ORT notices accompany both runtime routes. Each other architecture/runtime artifact must retain its own version, package integrity and applicable notice. GPU availability alone does not establish model operators, device support or speed.

## libvips, browser WASM and native dependencies

wasm-vips 0.0.19's JavaScript bindings retain [MIT, copyright 2020-present Kleis Auke Wolthuizen](third-party-licenses/js/wasm-vips-0.0.19-LICENSE). The separately compiled library retains [its vendor notice](third-party-licenses/runtime/wasm-vips-0.0.19-THIRD-PARTY-NOTICES.md), [actual version inventory](third-party-licenses/runtime/wasm-vips-0.0.19-versions.json) and the full dependency licenses below. The shipped `vips.wasm` has SHA-256 `36c25e290570757f911b45d67947e8262b01261028db438dadc09990ad978ff6`.

libvips, glib and libexif are used under LGPLv3 through their earlier licenses' any-later-version clause, as stated by the binary supplier. Complete [LGPLv3 and GPLv3 texts](third-party-licenses/legal/LGPL-3.0-and-GPL-3.0.txt) accompany this notice; the original dependency texts are also retained. Superaster does not restrict modification of these library portions or reverse engineering to debug those modifications. [Source access and replacement/build instructions](third-party-licenses/SOURCES.md) identify their source/build inputs and the separable runtime loading path.

| Main browser-WASM library | Version | Full notice |
| --- | --- | --- |
| libvips | 8.18.7 | [LGPL 2.1 or later](third-party-licenses/wasm/libvips-8.18.7-LICENSE) |
| glib | 2.90.0 | [LGPL 2.1 or later](third-party-licenses/wasm/glib-2.90.0-LGPL-2.1-or-later.txt) |
| libexif | 0.6.26 | [LGPL](third-party-licenses/wasm/libexif-0.6.26-COPYING) |
| libnsgif bundled in libvips | libvips 8.18.7 source | [MIT, original copyright holders](third-party-licenses/wasm/libnsgif-bundled-libvips-8.18.7-COPYING) |
| Emscripten runtime | 6.0.10 | [complete Emscripten license and notices](third-party-licenses/wasm/emscripten-6.0.10-LICENSE) |
| expat | 2.8.5 | [MIT](third-party-licenses/wasm/expat-2.8.5-COPYING) |
| libffi | 3.8.0 | [MIT](third-party-licenses/wasm/libffi-3.8.0-LICENSE) |
| Little CMS | 2.19.1 | [MIT](third-party-licenses/wasm/lcms-2.19.1-LICENSE) |
| highway | 1.4.0 | [BSD-3-Clause](third-party-licenses/wasm/highway-1.4.0-LICENSE) |
| mozjpeg | `0826579` source revision | [zlib/IJG/BSD terms and copyright](third-party-licenses/wasm/mozjpeg-0826579-LICENSE.md) |
| libpng | 1.6.58 | [libpng terms](third-party-licenses/wasm/libpng-1.6.58-LICENSE) |
| libimagequant | lovell fork 2.4.1 | [BSD-2-Clause](third-party-licenses/wasm/libimagequant-2.4.1-COPYRIGHT) |
| cgif | 0.5.4 | [MIT](third-party-licenses/wasm/cgif-0.5.4-LICENSE) |
| libwebp | 1.6.0 | [BSD terms](third-party-licenses/wasm/libwebp-1.6.0-COPYING), [patent grant](third-party-licenses/wasm/libwebp-1.6.0-PATENTS) |
| libtiff | 4.7.2 | [libtiff terms](third-party-licenses/wasm/libtiff-4.7.2-LICENSE.md) |
| libultrahdr | 2.0.2 | [MIT](third-party-licenses/wasm/libultrahdr-2.0.2-LICENSE) |
| zlib-ng | 2.3.3 | [zlib terms](third-party-licenses/wasm/zlib-ng-2.3.3-LICENSE.md) |

The upstream package inventory also lists optional HEIF/JXL/resvg modules and their dependencies. This app copies only the main `vips.wasm` and JS wrapper, initializes with `dynamicLibraries: []`, and rejects unsupported formats. Optional module binaries are not copied. Their presence in an upstream inventory does not establish launch codec support or require shipping unneeded module source/assets.

Sharp 0.35.5's original wrapper retains [Apache-2.0](third-party-licenses/native/sharp-0.35.5-LICENSE). On the observed Linux glibc x64 installation, the official optional dependency `@img/sharp-libvips-linux-x64` 1.3.4 supplies `libvips-cpp.so.8.18.7` under LGPL-3.0-or-later/mixed dependency terms. Preserve its [complete supplier notice](third-party-licenses/native/sharp-libvips-linux-x64-1.3.4-README.md) and [version inventory](third-party-licenses/native/sharp-libvips-linux-x64-1.3.4-versions.json). Its observed binary hash is `4aa73553408c3964071728f4a231a8e86918e39bc49f1fbae75355f7ea933ea9`. The Superaster npm tarball contains original compiled JavaScript; official npm dependencies supply the native binaries separately. Bundling those binaries directly would require a matching complete distribution audit, not just this wrapper license.

## Approved model weights and conversions

BiRefNet source notice is [MIT, copyright 2024 ZhengPeng](third-party-licenses/models/BiRefNet-LICENSE), copied from `ZhengPeng7/BiRefNet` commit `ebcc0bc8ec7fe919cec829f2dea656b3078acddc`. The chosen source/conversion model cards independently mark the weight artifacts MIT. Retain the notice, source/model-card references and conversion changes when redistributing weights. Neither converter had a separate LICENSE file at the pinned revision; the cards' explicit metadata and original source notice are the recorded approval basis.

| Approved model | Conversion, lineage and declared changes | SHA-256 |
| --- | --- | --- |
| `birefnet-512-fp16` | [naddy24/birefnet-512-webgpu](https://huggingface.co/naddy24/birefnet-512-webgpu/tree/ca02a86c094927479e2be583abe87f8ea73fcfda), 473,435,223 bytes. Derived from [onnx-community](https://huggingface.co/onnx-community/BiRefNet_512x512-ONNX/tree/b0b30aff33d009f6bcd7dacdc3cdcf2f8f42175b) and [ZhengPeng7 512 source](https://huggingface.co/ZhengPeng7/BiRefNet_512x512/tree/678c37f9158280a2b3000b566ecd12bfbfd1a09c). Converter describes empty ScatterND replacement and dead-node pruning; its bit-exact assertion remains an upstream claim. | `6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8` |
| `birefnet-lite-512-fp16` | [studioludens/birefnet-lite-512](https://huggingface.co/studioludens/birefnet-lite-512/tree/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7), 98,484,532 bytes. Derived from [ZhengPeng7 lite source](https://huggingface.co/ZhengPeng7/BiRefNet_lite/tree/aa62cd87eafb9cc43056d08ef3615a14628b831d). Converter describes fixed 512 input, opset 17, deformable-convolution export changes and fp16 conversion. | `eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516` |

These notices concern code/weight use and redistribution. They do not establish complete training-data provenance, model quality or rights in a user's subject. Production verifies the approved ONNX files and executes no downloaded Python. BRIA, BEN2 challengers, FeyNoBg, withoutBG and IMG.LY weights/code are not included as production alternatives under these approvals.

## Evaluation photographs and catalog

The corpus retains per-image public-domain, CC0 or CC BY permissions, source pages, photographer/credit, license URLs, original and derivative hashes, and normalization changes in [its manifests and notice](https://github.com/ksmostofa/superaster/blob/a19f2bf/benchmarks/corpus/NOTICE.md). Keep those attributions with published input/output/gallery derivatives. No blanket model release, advertising consent or endorsement is claimed. Raw source-page prose is not relicensed as catalog data.

Original destination records are CC0 factual records with authority/platform provenance. Official source text, third-party datasets and imagery keep their own terms. No copied proprietary competitor UI, branding or assets are distributed. BG0, rembg, mcp-image-optimizer and other audited implementations are references unless an actual copied file is declared above.
