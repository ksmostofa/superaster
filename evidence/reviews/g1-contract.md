# Independent G1 and contract review

Reviewed 2026-10-08 JST. Active private specification revision 1.1, SHA-256 `7617a90ffca7feb05b42caea112213a098aa13e83cfcf0eb89e90a1177c9cfcf`. Entire active specification read. No applicable AGENTS.md was present in the repository or its parent directories. No implementation, dependency, lockfile, or checkpoint edits were made by this reviewer.

Inspected HEAD `43ccc9910c89d5e188a212d1ba2716f063f7dd09`, newer than the assigned starting point `63bf7b6`. Concurrent work included unstaged root dependency changes and untracked web/CLI/SDK/MCP files. Those files are not an integrated release. The reviewed contract/core/native/pipeline files matched HEAD. Findings below apply to those exact files, not to subsequent fixes.

G1 is **FAIL/incomplete**. Demand and selected removal/imaging research are supported, but the required component-wide reuse/license decision is not complete. This review does not pass G2-G7. Four small observable contract failures reproduce despite the passing baseline suites.

## G1 acceptance

| Required item | Result | Evidence and limit |
| --- | --- | --- |
| Ten workflow priorities, concrete requests/input/output/pain/audience | PASS | `research/workflows.md` provides W01-W10, F traceability, proposed examples, and UI states. Examples are explicitly proposals rather than measured results. |
| Sources/date/geography/method/uncertainty; separate demand/build order | PASS | E1-E10 distinguish traffic, searches, first-party totals, selected subscriber surveys and workflow existence. Counts and user frequency remain unknown. Ranking is an evidence-weighted product decision, not an invented global usage order. |
| Actual removal implementation reviewed and pinned | PASS | Checked local clone HEADs for BG0, rembg, withoutBG, IMG.LY, BEN2 and nobg against `research/reuse.md`. Confirmed BG0 repository/npm differences, full-to-lite fallback, and rembg maximum-based input rescaling plus output min/max rescaling in actual source. |
| Selected artifact lineage, hashes, commercial/redistribution terms | PASS for documented candidates | `research/artifacts.json` separates source checkpoint, converted ONNX, immutable revision, size/hash and model-card terms. Saved HF API metadata agrees with lite/full conversion revisions and MIT declarations. Source notice retention is recorded. This is artifact-rights evidence, not runtime/quality admission or a complete packaged notice set. |
| Each launch component has justified reuse/adapt/build decision, dependencies and rights | FAIL | Removal, imaging, UI references and catalog have substantial research. Contract/core orchestration, batch/archive, CLI/SDK, MCP/WebMCP and deployment/app-cache paths lack a complete explicit component decision with inspected pinned dependencies and obligations. `package.json` versions alone do not establish that audit. |
| Focused release scope and later requirements retained | PASS | Active specification and workflow/reuse/catalog research keep Art, generation, paid inference, GPUI and conditional capabilities outside launch. No additional infrastructure was added by this review. |
| UI component-source/license choice settled | NOT RUN / pending decision | Exact Rare UI and Animate UI source/license revisions exist. Their application-use permission is separate from redistribution restrictions. No substitute-library recommendation or assumption of OSI licensing follows from those terms. User licensing decision was already pending. |

## Component decision coverage

| Launch component | Existing decision/evidence | What remains before G1 closure |
| --- | --- | --- |
| Shared contract/planner | TypeBox/Ajv definitions and Effect semaphore exist; draft coordinates/error policies exist | Explicit build/reuse rationale, pinned library source/rights check, result/error/capability schemas and conformance fixture inventory |
| Browser/native inference | Direct ORT, common preprocessing, separate full/lite pins, audited BG0 patterns | Runtime dependency rights/notices matrix and G2 admission remain distinct tasks |
| Native/browser imaging | Sharp 0.35.5 and wasm-vips 0.0.19 inspected; compiled kernels reused | Enumerate exact shipped compiled-library versions/licenses and corresponding-source obligations rather than leaving them generically independent |
| Cache/model management | BG0 cache patterns audited; integrity verification required | Settle actual browser persistent-cache/app-offline implementation choice and record source/rights and eviction behavior |
| Web controls/theme/motion | `research/interface-map.md` pins references and exact preset; saved registry variables agree with `theme.css` | Settle pending license decision; inspect and record only actually used component files and their accessibility/compatibility obligations |
| Batch/ZIP/resume | Serial warm execution is specified and core scheduling exists | Explicit build/adapt choice for identities, archive/names/resume and used archive library source/rights |
| CLI/SDK | Thin adapters are specified | Actual implementation decision, inspected dependencies and pin/rights evidence |
| MCP/WebMCP | Local stdio and optional feature detection are specified; existing agent workflow is referenced | Inspect shipped SDK/tool/file-access behavior and pinned dependency rights; explicit optional WebMCP decision |
| Catalog/print | Original CC0 richer records, no import, dataset/license comparison and authority evidence exist | Runtime integration is later G6B; clarify exact launch data/schema ownership and source-monitor deployment choice in the component audit |
| Distribution/docs/assets | Free static distribution and separate model artifacts are specified | Concrete free-provider/app-runtime/model asset/cache choice, pinned limits/header sources, publishing/notice ownership |

## Reproduced contract defects

1. **P1: Bound inputs do not participate in execution identity.** `packages/engines/src/pipeline.ts:77` computes `recipeHash(recipe)` without the background/mask bytes; `packages/core/src/index.ts:52` does the same for batch entries. An identical recipe and source with white versus black `image_ref` bindings produces different output hashes but the same recipe hash and no `binding_hashes`. T09 identity verification can reuse stale work after a bound background or correction mask changes. Compute referenced binding identities before execution and use the same resolved identity in the record, batch manifest and resume check.

2. **P1: Composition destroys separately requested foreground coverage.** `pipeline.ts:46` overwrites the image alpha with composited opacity; `pipeline.ts:66` then derives `result.mask` from that image. Erase one pixel in a two-pixel source, then composite on white: the separate mask decodes to `[255,255]`, rather than foreground coverage `[0,255]`. F037 and correction/subject-bound semantics need a separately maintained mask through geometry. The final canvas opacity cannot replace it.

3. **P1: Programmatic mask restoration exposes cleaned RGB instead of source RGB.** `pipeline.ts:51` replaces only alpha, while region restoration at line 52 copies original RGBA. A synthetic known blended edge, followed by `edge_cleanup:auto` and a mask restoring that edge, outputs `[255,2,2,255]`; source restoration should return `[255,128,128,255]`. This violates F013-F015/T05 and makes programmatic/web correction semantics diverge once RGB cleanup is enabled. Decide the mask correction semantics before freeze and restore source RGB wherever its restored coverage requires it.

4. **P2: Contain resize disagrees with the draft's exact-dimension rule.** `pipeline.ts:36` uses `fitRaster`, whose contain branch at lines 7-12 returns only the fitted image. A 4x2 input requested as width 4, height 4, contain exports 4x2. `docs/contract.md` promises exact padded dimensions when both are supplied. The canvas operation already demonstrates the required padding behavior. Settle and implement this delegated contract choice before G3 freeze, without changing the expected behavior merely to hide the mismatch.

These are synthetic deterministic diagnostics. The only injected inference result is explicitly named `test-fixture`, with no model/performance claim. No simulated inference is being proposed for production.

## Independent checks

Environment: Linux `7.2.5-3-omarchy`, x86_64; Node `26.11.1`; bundled Python `3.12.14` and Pillow `12.3.0`. No heavy inference run was started because another coordinator-controlled inference lane was active.

| Check | Result |
| --- | --- |
| `node_modules/.bin/vitest run tests/contract.test.ts tests/native-pipeline.test.ts tests/catalog.test.ts` | PASS, 3 files and 24 tests, 2.26 seconds |
| `node_modules/.bin/tsc --noEmit` | PASS |
| Bundled Python `benchmarks/fetch_corpus.py --verify-only` | PASS, all 25 original/evaluation hashes match manifest |
| Bundled Python `-m unittest discover -s benchmarks -p test_evidence.py -v` | PASS, 8 tests, 0.381 seconds |
| Private specifications ignored and absent from all current local Git history | PASS, `git check-ignore -v` matches both root specifications; `git log --all --oneline -- superaster-technical-spec.md superaster-technical-spec.updated.md` is empty |
| Documented pre-existing `benchmarks/.venv/bin/python` reproduction | NOT RUN, that venv was absent; system Python also lacked Pillow. No installation was attempted. Bundled exact Python/Pillow above reproduced the checks. README gives fresh-venv creation steps, so absence in this workspace alone is not a package defect. |
| Full T01-T20, browser/privacy/offline/cancellation integration, phone and quality evaluation | NOT RUN by this review |

The verified screening manifest SHA-256 is `4856791a5b76405ac2b254c5458dda4893478977167f9d75c0d0f12736559fb6`. Fixture manifest SHA-256 is `7916b464e5f7854097f51f39c9a7be8e1e2045d3acf1d70ba98fe349895d2b59`.

The 25 rights-documented photographs are genuine screening inputs. License variants and rendition/full-resolution differences are explicit. The harness checks decoded properties, input preservation and missing-output/timeouts; it does not invent alpha ground truth or judge retained subject quality. `benchmarks/budgets.json` remains NOT FROZEN, which is correct until G2 measurements. Current hard-coded runtime ceilings are provisional implementation bounds, not yet a measured supported matrix.

The corrected native feasibility outputs and failed scratch export are retained. They support a real local removal path and transparent export, not phone/browser support, release quality, or comparative claims. Physical Pixel 7 measurements, human hidden-label review, held-out release evaluation, and appropriate remove.bg comparator outputs remain separate prerequisites.

## Reproduction

Run from the repository root at the reviewed version:

```sh
node_modules/.bin/vitest run tests/contract.test.ts tests/native-pipeline.test.ts tests/catalog.test.ts
node_modules/.bin/tsc --noEmit
/home/sadid/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 benchmarks/fetch_corpus.py --verify-only
/home/sadid/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest discover -s benchmarks -p test_evidence.py -v
git check-ignore -v superaster-technical-spec.md superaster-technical-spec.updated.md
git log --all --oneline -- superaster-technical-spec.md superaster-technical-spec.updated.md
```

Deterministic defect reproduction, no model download or heavyweight inference:

```sh
node --import tsx --input-type=module <<'JS'
import sharp from 'sharp';
import { NativeEngine, NativeImagingKernel } from './packages/engines/src/native.ts';
import { Processor } from './packages/core/src/index.ts';
import { executePipeline } from './packages/engines/src/pipeline.ts';
import { parseRecipe } from './packages/contract/src/index.ts';
const kernel = new NativeImagingKernel();
const mk = async (width, height, pixels) => new Uint8Array(await sharp(
  Buffer.from(pixels), { raw: { width, height, channels: 4 } }
).png().toBuffer());
const recipe = operations => parseRecipe({
  spec_version: '1.0', input: { ref: 'fixture' }, operations, output: { format: 'png' }
});
const processor = new Processor(new NativeEngine());
const source = await mk(4, 2, Array.from({ length: 32 }, (_, i) => i % 4 === 3 ? 255 : 50));
const resized = await processor.transform(source, recipe([
  { op: 'resize', width: 4, height: 4, fit: 'contain' }
]));
console.log('resize expected 4x4, actual', resized.record.output.width, resized.record.output.height);
const maskSource = await mk(2, 1, [200,20,30,255,40,50,220,255]);
const composited = await processor.transform(maskSource, recipe([
  { op: 'correct', regions: [{ x: 0, y: 0, width: 1, height: 1, mode: 'erase' }] },
  { op: 'composite', background: '#ffffff' }
]));
console.log('mask expected [0,255], actual', [...(await kernel.decode(composited.mask)).data].filter((_, i) => i % 4 === 0));
const cleanupSource = await mk(3, 1, [255,255,255,255,255,128,128,255,255,0,0,255]);
const restoreMask = await mk(3, 1, [0,0,0,255,255,255,255,255,255,255,255,255]);
const restored = await executePipeline(cleanupSource, recipe([
  { op: 'remove_background', edge_cleanup: 'auto' }, { op: 'correct', mask_ref: 'restore' }
]), {
  kernel, bindings: { restore: restoreMask },
  infer: async () => ({ alpha: new Float32Array([0,.5,1]), width: 3, height: 1,
    engine: { id: 'test-fixture', version: '1', model_hash: null, precision: 'fixture',
      inference_dimensions: [3,1], runtime: 'fixture', backend: 'fixture', refinement: 'none' } })
});
console.log('restore expected [255,128,128,255], actual', [...(await kernel.decode(restored.bytes)).data].slice(4, 8));
const overlay = await mk(1, 1, [255,0,0,128]);
const white = await mk(1, 1, [255,255,255,255]);
const black = await mk(1, 1, [0,0,0,255]);
const boundRecipe = recipe([{ op: 'composite', image_ref: 'background' }]);
const first = await processor.transform(overlay, boundRecipe, { bindings: { background: white } });
const second = await processor.transform(overlay, boundRecipe, { bindings: { background: black } });
console.log('recipe hashes unexpectedly equal', first.record.recipe_hash === second.record.recipe_hash);
console.log('output hashes differ', first.record.output.hash !== second.record.output.hash);
console.log('binding hashes absent', first.record.binding_hashes === undefined);
await processor.dispose();
JS
```

Observed output:

```text
resize expected 4x4, actual 4 2
mask expected [0,255], actual [255,255]
restore expected [255,128,128,255], actual [255,2,2,255]
recipe hashes unexpectedly equal true
output hashes differ true
binding hashes absent true
```

## File identity and next checks

| Reviewed file | SHA-256 |
| --- | --- |
| `packages/contract/src/index.ts` | `b9d0a9ff59af5dbe5c6b365a8ca7fda37e5cc05c7a664cae2809dd4f5af84c1a` |
| `packages/core/src/index.ts` | `4a1c5e5fc4e7f3eb5ce6c0c1a0087926c0ac5d4fe5242fa2e6bbb8284c6122dc` |
| `packages/engines/src/pipeline.ts` | `27fa5cc9757528a3f070c32d6eb3b2f8dc49e4383fe4623e9a13baba8ff87336` |
| `packages/engines/src/native.ts` | `53f7b2e9130cd2494f2a85eb3663736150624a7b6ce88b437d5f833572e5b77e` |

Complete the component audit and pending license decision, then reproduce the four diagnostics after coherent fixes and add consequential regression tests. Contract schemas, numerical tolerances and supported profiles remain unfrozen until the required G2 evidence. Do not repeat the unchanged baseline or expensive inference solely because this review ran. Recheck affected consumers on the integrated commit.
