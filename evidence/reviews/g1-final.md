# Independent G1 final review

Reviewed 2026-10-09 JST. G1 is PASS for the demand, reuse and launch-scope decision. This decision admits further feasibility work. It does not approve a model profile, freeze the contract, pass G2-G7, or authorize release claims.

I read the complete private active specification revision 1.3 and the complete original specification. Their contents were not copied into this report. No applicable AGENTS.md was present in the repository or its ancestor directories. I edited only this report. I did not run inference, repeat passing runtime suites, change dependencies, spend money, publish anything, or send external messages.

The review began at `09e1f05aa080b2a469d2880397fd6b892812e010`. Main advanced to `a854fb8e2c87c29562d2884d83bb9746e8d40351` while the coordinator integrated work. The final snapshot below identifies the observed commit and working-tree overlay. A commit ID alone does not identify these uncommitted changes.

## Requirement to evidence

| G1 requirement | Result | Evidence and limit |
| --- | --- | --- |
| Ten ranked workflows with audience, request, pain, before/after steps and expected output | PASS | `research/workflows.md` contains W01-W10 and concrete examples. Removal, geometry, byte caps, commerce, batches, social outputs, official checks, agents, printing and correction all have an identified outcome. Examples are proposed acceptance inputs rather than fabricated processing results. |
| Frequency/volume evidence, source/date/geography/method and uncertainty | PASS | E1-E10 distinguish estimated visits/searches, a selected paying-seller survey, first-party design totals, authority rules and source-code workflow evidence. Exact completed-edit counts, task frequency and Superaster time savings are explicitly unknown. Shared evidence does not establish precise ordering between related tasks. |
| Separate demand priority from build priority | PASS | Each workflow maps to the delivery dependency order. Build decisions consider launch fit, repeated seller work, failure cost and the existing removal/core prerequisites. The document does not claim a measured worldwide popularity ranking. |
| Versioned reuse/license comparison based on actual code | PASS | `research/reuse.md`, `research/artifacts.json`, `research/launch-decisions.md`, `research/interface-map.md`, the lockfile and retained licenses identify package versions, upstream commits, model lineage, fallback behavior, extension points and missing capabilities. Fresh source inspection confirmed the central direct-ORT decision and the rejected wrapper behavior described below. |
| Justified reuse/adapt/build decision for every launch component | PASS | The component table below maps the launch decisions to current implementation and rights evidence. Runtime, installation and distribution acceptance remain later checks. |
| Focused launch scope and explicit remaining prerequisites | PASS | The launch keeps local Remove, exact preparation, corrections, batches, SDK/CLI/local MCP, optional WebMCP and sourced destinations. Art, Effect.app reference work, GPUI, generation, managed inference and later HTTP compatibility remain later work. No funded service or new native rewrite was admitted. |
| Private specification exclusion | PASS | Both specification files match `.gitignore`; `git ls-files '*technical-spec*'` and `git log --all -- '*technical-spec*'` return no public tracked file/history. Original SHA-256 remains unchanged. |

The previous G1 failure concerned missing component-wide decisions and an unsettled UI-license choice. `research/launch-decisions.md` now covers those components. The owner's approved application use is recorded with the actual Rare UI and Animate UI terms, rather than an assertion that they are plain MIT or Apache-2.0. A later vanilla UI preference does not erase those terms.

## Component decision coverage

| Component | Decision supported by inspected source | Pins and rights |
| --- | --- | --- |
| Contract/capabilities | Build shared strict ordered-operation definitions and generated schemas. TypeBox/Ajv validate boundaries; source rejects unknown recipe properties. Result/error/manifest schema preparation exists, while complete contract freeze remains G3. | TypeBox 0.34.52 and Ajv 8.20.0, MIT, exact lockfile integrity and retained full texts. |
| Orchestration/resources | Adapt one warmed Processor and serial batch scheduling with Effect semaphore/typed failures. No measured bottleneck justifies Rust. | Effect 4.0.2, MIT; current `core/src/index.ts` and `native.ts` expose cancellation/disposal boundaries. Runtime ceilings are provisional. |
| Browser inference | Reuse direct ORT and approved immutable exports. The current code preserves the selected checkpoint through a same-model WebGPU-to-WASM retry. Raw continuous alpha remains available for correction. | ORT Web 1.30.0, MIT plus complete runtime notices; full/Lite revisions and hashes match `models.ts`, the artifact manifest and retained HF metadata. |
| Native inference/comparison | Reuse the same artifact/preprocessing policy through ORT Node CPU. Reject a silent switch to differently normalized rembg or a larger mixed-rights model stack. | ORT Node 1.30.0. BG0 `420442c...`, rembg `202e426...`, withoutBG `891c166...`, IMG.LY `12f56cc...` local clone HEADs match the audit. BG0 source is Apache-2.0, rembg MIT, withoutBG source Apache with separate weight terms, IMG.LY AGPL. Reference source is not imported by this decision. |
| Geometry/color/encoding/print | Reuse Sharp and wasm-vips kernels; build common semantics and explicit grayscale mask handling. Source shows EXIF normalization, color conversion, frame/format checks and resource deletion. | Sharp 0.35.5 wrapper Apache-2.0; wasm-vips 0.0.19 JS MIT. Compiled libraries retain independent terms. Correct published wasm-vips build pin is `49ac4378f2df80e38f45491abeeac9b86dddbedd`, separate from the newer research clone. |
| Web editor/theme/motion | Build image-specific state and controls around React/Vite, used Rare GooeyNav and Animate button adaptations, exact Luma tokens and reduced-motion handling. Visible Rare UI credit exists in `App.tsx`. | React/React DOM 19.3.0, Vite 8.3.4, Motion 14.0.0, Figtree 5.3.0. Rare `b4de46e...`, Animate `efeb96f...`; retained license texts byte-equal their pinned upstream files. Figtree retains OFL. Dark particle direction is a design choice, not quality evidence. |
| Browser model/app cache | Build origin-scoped verified Cache API storage and a content-versioned service worker. Model downloads use immutable URLs and SHA-256 checks; GPU runtime has a separate verified cache. | Approved model pins, ORT 1.30.0 JSEP hashes, generated app cache. App/runtime/model preparation and actual offline processing still require integrated proof. |
| Batches/ZIP/resume | Build serial shared scheduling, source-relative names, bound-input identity, output/sidecar provenance and independent completed results. Reuse fflate for browser archives. | fflate 0.8.3, MIT. Current SDK source has strict manifest parsing, exclusive output writes and path/symlink checks. Full web archive/memory checks remain pending. |
| CLI/SDK | Build thin argument/filesystem/library adapters over Processor and catalog. Preserve originals through exclusive writes unless overwrite is explicit. | Original Apache-2.0 code, Node built-ins and the pinned shared kernels. Existing adapter evidence is useful but does not establish a clean installation. |
| Local MCP | Adapt MCP SDK strict tools to the same Processor/catalog and configured realpath roots. Paths, bindings and record outputs are guarded; file URIs use `pathToFileURL`. | MCP SDK 1.32.1 and Zod 4.6.5, installed package metadata MIT and exact lockfile integrity. Their native dependency packaging must retain their supplier notices. |
| Optional WebMCP | Build feature-detected page-scoped registration over the browser contract. Current source registers ordinary inspect/transform/batch/resolve/validate operations with selected-image refs. | Original adapter; implementation/client admission remains NOT RUN in this review. Source presence does not establish supported browser integration. |
| Catalog/print/source monitoring | Build original richer CC0 records and strict resolver/planner/checks instead of importing a dataset as authority. Existing records separate authority/channel and unknown or prohibited edits. Source retrieval failure becomes unknown freshness. | Original records CC0. Dataset `3d21b1d...` and authority-page evidence are documented in `research/catalog.md`. Source scheduling, published immutable updates and actual final print outputs remain G6B. |
| Distribution/docs | Build static free hosting and source-built npm/local adapters; use separately pinned model artifacts. No paid storage or hosted inference prerequisite. | Lockfile/package/build pins and retained license/source manifest. The current packaging correction requires an affected-output check before distribution acceptance. |

Fresh inspection confirmed BG0's repository fallback can end at Lite WASM and its npm package exposes only the Lite model. rembg's actual input divides by the image maximum and its BiRefNet output applies min/max normalization. Those behaviors justify avoiding their pipelines as silent substitutes. Superaster's `chooseModel` distinguishes Quality/full and explicit Fast/Lite, while source records backend fallback separately from model choice.

Both selected conversion cards declare MIT at the exact manifest revisions. Their original BiRefNet notice and conversion lineage are retained. There is no independent training-data provenance or quality guarantee, and neither conversion repository supplied a separate LICENSE at the audited revision. This review accepts the documented artifact-rights basis; it does not extend that approval to other model families.

## License and diff risks

| Check or risk | Result | Concrete observation and required follow-through |
| --- | --- | --- |
| Retained license inventory integrity | PASS | All 58 `third-party-licenses/manifest.json` entries match their recorded byte counts and SHA-256. Both retained UI licenses match the pinned upstream bytes. The complete app is not uniformly Apache-2.0 or plain MIT. |
| UI application versus component redistribution | PASS for documented application-use decision | Rare UI requires visible credit and restricts selling, sublicensing or redistributing the components themselves, including bundles/ports. Animate UI restricts sale/redistribution of original components. Do not distribute a component collection or silently relicense these files. No new licensing decision was inferred. |
| Normal package/static notice inclusion, first observed build | FAIL | Read-only `npm pack --dry-run --json --ignore-scripts` found 36 package files, including root notices but zero `third-party-licenses/` files. Existing `dist/web` had 20 files and no license/notice/source files. Root notice links therefore had no included full-text targets. The coordinator is correcting the allowlist and asset-copy script; this failure is retained, not treated as a current passing build. |
| Packaging correction, local inclusion | PASS for affected local check | The coordinator added `third-party-licenses` and `docs` to the allowlist and corrected the static directory to `/third-party-licenses/`. The changed npm dry run has 103 files, including 60 license/source files and the source directions/manifest. All 58 manifest entries in current `dist/web/third-party-licenses/` match their exact bytes/hashes; root notices byte-equal the source; every relative link in root notices and SOURCES resolves. Actual tarball installation, public distribution and final inventory remain NOT RUN. |
| LGPL source/replacement/rebuild evidence | NOT RUN | Correct published wasm-vips and sharp-libvips build inputs, source archive hashes, fetch script and replacement directions exist. Exact historical patch/container inputs, final source access and actual replacement/recombination were not reproduced. A source link or retained notice alone does not establish complete distribution acceptance. |
| Evidence freshness | FAIL as a current execution ledger | `docs/execution.md` still names revision 1.2, older HEAD and no passed gate. `artifacts.json` says full Quality is not downloaded/runtime verified despite real later evidence. `reuse.md` retains the research wasm-vips pin and early unresolved smoke state; `launch-decisions.md` correctly records the published build pin. Update status summaries without changing the immutable old observations. |
| Dirty integration scope | NOT RUN as a final release | Current contract/schema, browser/backend/cache, MCP/file URI, SDK manifest, WebMCP, UI/assets and packaging edits are uncommitted. Old adapter/kernel reports have different source hashes from some current files. Preserve their valid scope, then verify the changed consumers on one identified integrated version. |

No material scope, privacy, licensing or official-platform acceptance rule was changed by this review. Any proposal to change one remains an owner decision. Ordinary corrections that satisfy the existing requirements do not require inventing a new approval flow.

## Later gate state retained

| Required acceptance outside G1 | Result | Evidence limit |
| --- | --- | --- |
| Native 25-case Quality machine artifact checks | PASS for recorded machine checks | `evidence/benchmarks/native-screening-baseline.md` and JSON identify full model, source hashes and conditions. Nonempty alpha is not intended-subject quality. |
| Native 25-case Fast machine artifact checks | FAIL | 24/25 pass; `thin-plant` is completely empty alpha. The failed output remains in latency statistics and the gallery. Quality retains only leaf fragments on the same input, so its machine pass does not establish a successful cutout. |
| Physical Pixel 7 | NOT RUN | Automated Chromium and native laptop data cannot establish phone support. |
| Human hidden-label quality review and heldout evaluation | NOT RUN | Prepared corpus/galleries do not supply human judgments or a comparative quality conclusion. |
| G2 budgets, supported ceilings and winning profile admission | NOT RUN | `benchmarks/budgets.json` is NOT FROZEN with unset numerical values. Guards are implementation bounds. No threshold or target-profile failure was waived. |
| T01-T20 and final G3-G7 | NOT RUN as complete gates | Existing focused adapter/kernel/browser records support named partial checks only. Clean install, offline/CORS/privacy/resource behavior, corrected consumers, actual agent removal, source-monitor deployment and final public configuration still need their own acceptance evidence. |
| Superiority claim | NOT RUN | No matched competitor/human results establish better-than-remove.bg performance. |

G1 has no remaining research gate blocker in this reviewed snapshot. The next mandatory outcome is measured G2 admission with phone and human evidence, explicit failure handling and numerical budgets. Later implementation remains provisional preparation until those dependencies pass. Fix packaging and stale status documentation without recasting runtime gaps as research gaps or weakening acceptance.

## Reproduction performed

Read-only commands included `git rev-parse HEAD`, `git status --short`, `git diff`, `rg`, source/file reads, exact installed package/lockfile inspection, pinned local clone checks, SHA-256 verification of retained license manifest entries, upstream/retained UI-license byte comparison, and `npm pack --dry-run --json --ignore-scripts`. Native runtime suites and heavyweight benchmarks were not repeated. Existing deterministic and inference reports were inspected as evidence with their recorded source/version scope.

## Final observed snapshot

The following snapshot is generated from the files present when this report was finished. It records hashes only for the private specifications. It excludes ignored caches, corpora, node_modules, private source references and generated local runtime directories from the dirty-tree listing.

Observed UTC timestamp: `2026-10-08T21:38:16.106Z`. Integrated HEAD: `a854fb8e2c87c29562d2884d83bb9746e8d40351`. Environment: Linux x86_64, Node v26.11.1.

```text
M .gitignore
 M docs/execution.md
 M docs/spec-changes.md
 M package.json
 M packages/contract/src/index.ts
 M packages/engines/src/browser-kernel.ts
 M packages/engines/src/browser.ts
 M packages/mcp/src/index.ts
 M packages/sdk/src/files.ts
 M packages/web/public/favicon.svg
 M packages/web/src/App.tsx
 M packages/web/src/client.ts
 M packages/web/src/main.tsx
 M packages/web/src/style.css
 M packages/web/src/worker.ts
 M research/interface-map.md
 M scripts/assets.ts
 M scripts/schemas.ts
 M scripts/service-worker.ts
?? README.md
?? evidence/benchmarks/
?? evidence/browser/correction-undo-fixed.json
?? evidence/browser/correction-undo.json
?? evidence/browser/native-browser-alpha-measurement.json
?? evidence/browser/quality-t01-properties.json
?? evidence/browser/quality-t01-undo-fixed.json
?? evidence/browser/quality-t01-undo.json
?? evidence/browser/quality-t01.json
?? evidence/feasibility/quality-2400x1600.json
?? evidence/feasibility/quality-native.log
?? evidence/feasibility/quality-warm-animal.json
?? evidence/reviews/g1-final.md
?? packages/web/public/logo-particles.svg
?? packages/web/public/point-wave.svg
?? packages/web/src/webmcp.ts
?? schemas/error-1.0.json
?? schemas/file-batch-1.0.json
?? schemas/image-info-1.0.json
```

| Source/evidence path | SHA-256 |
| --- | --- |
| `superaster-technical-spec.updated.md` | `e5f828d0a6d62d0b92a79b0f440c0528a4200ef4c469aa19fb514afe17a967a1` |
| `superaster-technical-spec.md` | `4f38a2c0eec96c275840740fd7f3ab4ecd84224b693fa27066c914c3518a436b` |
| `docs/execution.md` | `2e135e883513ea19408580a045076b3c5ebe710d2ee1e542a59f855ef9b29179` |
| `research/workflows.md` | `7b9d13b756140622eb78a7ab998f72b1a9210db593a278aef4c7d07fd3815183` |
| `research/reuse.md` | `f4c8369819e4aa1d3ca9292a68aef3630b8dbe5f54e6fc9516d20bc5d47928dd` |
| `research/artifacts.json` | `e4badd446b5f4c3f5e4670021bc78fec12c1624a500f35cd3e63ae8c4330edf6` |
| `research/launch-decisions.md` | `8746025181d0efdcbabd6d7f3b9939b221f5ca9d8748135cb4f0bf7a078ebfe7` |
| `research/interface-map.md` | `9a1de4ca20344e47d4d387d00409204eccc41d31df4044a20087fbec96a5436f` |
| `THIRD_PARTY_NOTICES.md` | `0fe702cac11246166080895a9c07b4434d10ab40d279c02aeb8a783ae569d049` |
| `package.json` | `811cd39c892724b44bc7fcc4a0d6c4db36be33b0f66121eeeea8540276ab69d1` |
| `package-lock.json` | `1eff8f71823e96cde9198b94df90d43dc6f0e3c34dd2259c727f84f922162faa` |
| `packages/contract/src/index.ts` | `6d00e07bf43cd105d10cd2e7ae0b1d48c6418e3f33e749e90ecc508a78fa80e8` |
| `packages/core/src/index.ts` | `c01b7f0dc5694d183d68f55a4005e612715af4e52b65d3a18471d03c7a045db7` |
| `packages/engines/src/models.ts` | `e1aae271dd22ef8dbecb98b67940c6c3e85f8ee9234708c1a7e0f4976ace6df5` |
| `packages/engines/src/native.ts` | `f61f7745c53a2adff17070e14ee00d4b1f6e8d9a6be7686966d552bf59f80ed2` |
| `packages/engines/src/browser.ts` | `0bb2e5c1f598c8c60d461eb65c7779ebc4beea4bc4ed040635f48719bb4cb3b5` |
| `packages/engines/src/browser-kernel.ts` | `7e274b80278119190aaa9eed4924ba40c75b4ece40540bd076e3b156735cc4e5` |
| `packages/engines/src/gpu-runtime.ts` | `af8dad70f34929097c2004865daee3b61b96fca812d8d04dd5cf0a1d99f23d0f` |
| `packages/engines/src/pipeline.ts` | `d9b83874cb365f89e49407b5ea902573c96ab40e3f5c53f2d0e99ff48865bcc1` |
| `packages/engines/src/raster.ts` | `3bea48ef456d73b4efd02d5ad0fa3e2df393c7d05272ac2b6977c3f911401fbe` |
| `packages/sdk/src/index.ts` | `6456d89c6f8cbade644325459abb6c1474c4c2f5b82ac99dcbb2832fc62f2a28` |
| `packages/sdk/src/files.ts` | `725d5c6939ff8fa491d5f289a791fd657603ff0788f8f1cf5427e7eda667e6fa` |
| `packages/cli/src/index.ts` | `ea08d6fc260e6f0e122e84cc4a764cd3232bf96ef350fcc7b4f0189d653e2f10` |
| `packages/mcp/src/index.ts` | `1e46b17f50d03bcd3e9ed73f6898c1bb23e17418660a7674e7fd3086d70d6733` |
| `packages/catalog/src/index.ts` | `e09b5b14063ec3d94698de8981048c11b3b8d59e0d51a36fd54d16603433fb86` |
| `packages/web/src/App.tsx` | `1081812f3b9cbac91db35a52f70ae5d13134a504802621580ceaf180e46e4990` |
| `packages/web/src/client.ts` | `1fbf45a2dc0585247193fbd6bebcf2a7c186f00b04e4599483e836c3b0ce1094` |
| `packages/web/src/worker.ts` | `9e717ad334f48dc3c29b7ea8d7f7f133418ba33b1aa0b3a5207d6b98d1a6c87d` |
| `packages/web/src/webmcp.ts` | `b1deae33c442664a5d67db18a9422f08bdcf7ae8a3aa8372834cb1853e1f9e18` |
| `packages/web/src/components/button.tsx` | `549796a298c05983efeae0596c643302a5f56d380c9b647e76706eb43c0178e1` |
| `packages/web/src/components/gooey-nav.tsx` | `dcfb303e7765a19a259730caafb992984a404f08fa68db2cc9dede24e0dc5681` |
| `scripts/assets.ts` | `eb2f250632391784cf3d5b1c4d438e8eabec6e1b4d67e030f436c87690de280a` |
| `scripts/service-worker.ts` | `e520628a49afc55e936c6c4e9ade6f9684eaa62f1d31e1cc72b7d83fcdd95d76` |
| `scripts/schemas.ts` | `8b78e23650f2fb121b0483e26b325c3b281190b6deffed670698d794685106e4` |
| `third-party-licenses/manifest.json` | `c0bf6f5941c52e01632c1afb215329dae3390474a9205aa71752ce94c3e6a1f5` |
| `third-party-licenses/SOURCES.md` | `31f482460ee50c7160ca91c362a5fcc756027bd88ec0379eec49a6947976b27d` |
| `benchmarks/budgets.json` | `b628be49a2c0f881ea62ef643b21b34403e2ef4c2a055330da6615f738d49179` |
