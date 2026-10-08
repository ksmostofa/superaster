# Independent native/WASM imaging checks

Review date: 2026-10-09. Active private specification: revision 1.2, SHA-256 `b7c33afd05ad020f285f9b62d85c809204c03b1a9790fcae21e5b6cab753f374`. These checks use native Sharp and the real compiled wasm-vips image library in Node. They do not establish browser behavior, inference quality, physical-phone performance, or a passed delivery gate.

## Conditions and criteria

Test: `tests/kernel-conformance.test.ts`. Node 26.11.1; Sharp 0.35.5; wasm-vips 0.0.19. Both libraries report libvips 8.18.7, lcms 2.19.1, PNG 1.6.58 and WebP 1.6.0. WASM SHA-256: `36c25e290570757f911b45d67947e8262b01261028db438dadc09990ad978ff6`. The injected factory loads this installed artifact with `dynamicLibraries: []`; it does not replace image processing with a fixture implementation.

The tolerances were frozen in test commit `8d5d93d10dd249fc0d8d5834a02d5c3e47ea57fe` before measurements. Exact known PNG pixels, nearest resize, composition and orthogonal rotation require zero difference. Interpolated RGBA cross-library pixels allow one byte; RGB is ignored only when both corresponding alpha values are zero. ICC round-trip allows two bytes. Q100 JPEG/WebP color allows three bytes, with exact alpha. Arbitrary rotation requires identical bounds, explicit opaque fill and at most one byte difference. Print geometry and 300-DPI tags are exact. A fixed 512-square JPEG must meet 200,000 bytes; an impossible one-byte request must fail explicitly. No thresholds changed after failures.

All generated fixtures have known pixels and are separate from the rights-cleared quality corpus. The inference callback throws if these deterministic tests accidentally request inference. Measurements retain source hashes, actual output files, decoded properties and numerical differences.

## Baseline

The initial full run had nine passing tests and four failures. Command in the isolated verification worktree:

```sh
node_modules/.bin/tsc --noEmit
node_modules/.bin/vitest run tests/kernel-conformance.test.ts --reporter=verbose --reporter=json --outputFile=.cache/kernel-baseline-results.json
```

Typecheck passed. Baseline evidence is `.cache/kernel-conformance-TKJV2Z/measurements.json`, SHA-256 `077fea109dc2df348e2c0a02506586c4cc45766d735b3529b889a1ba01d9b512`. JSON runner result SHA-256 is `f32350ed2f0b6478abffdae3382a01ad4e9109c72faad30f6516a4b68ec47114`.

| Check | Baseline | Observation |
| --- | --- | --- |
| RGBA PNG decode and export | PASS | Exact known continuous-alpha pixels; retained sRGB and stripped sensitive source tags |
| White composition | PASS | Translucent red at alpha 128 becomes `[255,127,127,255]`; a fully transparent source pixel becomes white |
| Nearest resize | FAIL | Native changed unassociated RGB by up to 3 bytes, although the operation must repeat source pixels exactly |
| Linear/Lanczos interpolation | FAIL | Opaque pixels agreed exactly; WASM transparent-edge RGB differed by 134/168 bytes because its filtering lacked premultiplication |
| Display-P3 normalization | PASS | Embedded profile conversion stayed within the frozen limits |
| JPEG/WebP export | PASS | Q100 color and alpha criteria passed; transparent JPEG requests failed explicitly |
| EXIF orientation and tag stripping | PASS | Orientation 6 applied once, no second rotation after export |
| Requested metadata preservation | PASS | EXIF/XMP survived, orientation reset to 1, and transformed pixel geometry remained authoritative |
| Missing density | Invalid input fixture | The fixture described as untagged actually contained a real PNG `pHYs` chunk; see correction below |
| Rotation | FAIL | WASM 90-degree rotation lost a column; arbitrary rotation gave transparent corners for an explicitly opaque white fill |
| Print sheet | PASS | 1200×1800 pixels, exact 354×472 placement geometry and actual 300 DPI |
| Byte constraint | PASS | Dimensions preserved, actual JPEG within 200,000 bytes, impossible JPEG/PNG requests failed |

The rotation capture is `.cache/kernel-conformance-rJuJu0`; `.cache/kernel-rotation-baseline.json` has SHA-256 `a4aed38489436c608a76cfe2087ff7203321e097dd8e5f702c6896688e78d4e6`. It preserves both exact 90-degree pixel arrays and actual exported files.

## Fixture correction and remaining density defect

Sharp 0.35.5 emits `pHYs` X=1000, Y=1000, unit=1 in the generated 95-byte PNG, even while its metadata API omits density. This is a real declaration of 25.4 DPI. The current contract reports rounded integer DPI, hence 25. After removing the whole optional `pHYs` chunk, Sharp instead synthesizes 72 DPI. Its metadata result cannot establish whether the file declared a density.

The corrected absence fixture removes only that complete optional chunk. All retained chunks and CRCs stay unchanged. The test asserts no `pHYs` chunk and exact unchanged decoded RGBA pixels; both production kernels must report density absent. A separate test retains the original chunk and requires both kernels to report 25. This correction does not weaken the absence assertion or numerical tolerances.

| Actual file | SHA-256 | Native inspect | WASM inspect | Result |
| --- | --- | --- | --- | --- |
| 74-byte PNG with no `pHYs` | `4158db6468a014cdc75a52b1b49a8216c8f6b52349f9f4a0852df204d0ae1c7b` | Invented 72 DPI | Density absent | Native FAIL; WASM PASS |
| 95-byte PNG with 1000/1000 pixels-per-metre declaration | `64792b9b44d2945732dbb4eb6155571f1a5a9d984ab58c8755499180d9610266` | Density omitted | 25 DPI | Native FAIL; WASM PASS |

Command:

```sh
node_modules/.bin/vitest run tests/kernel-conformance.test.ts -t 'PNG without a density|real pHYs' --reporter=verbose --reporter=json --outputFile=.cache/kernel-density-corrected-results.json
```

Both density checks failed only in NativeImagingKernel. Evidence: `.cache/kernel-conformance-rvqial/measurements.json`, SHA-256 `3525ed28516e620b9dd54453b55b62bad28e150d3a034c4e7b3c934eae3c83e8`; runner JSON SHA-256 `ea906bda5698b2a2f1061e66e954d5512ebe4cf08977f9e18109606ac55c3da6`. Native `inspect` currently copies `sharp.metadata().density`; a declared-tag parser is needed. Reporting synthesized or missing density affects inspection and physical-rule validation.

## Integrated fix verification

Inputs copied from main commit `525b73987f10d69a89dff98762d2f1dd8bcb00ee` plus coordinator's current BrowserKernel and contract changes. Production files were copied as test inputs, never committed by this reviewer.

| Source input | SHA-256 |
| --- | --- |
| `packages/engines/src/browser-kernel.ts` | `06bcdca238c4ff3fc2b513719d574343bc31940622988120e5f06fd374a882ed` |
| `packages/engines/src/native.ts` | `69a5d65d288713049cad1152e90e36ac0cd0e7128f95868796fa9394fe2be403` |
| `packages/engines/src/raster.ts` | `4cba5146e3eac0ad0392bb7e6f3132e4b3fa06456154ae7955afa40abea020db` |
| `packages/engines/src/pipeline.ts` | `d9b83874cb365f89e49407b5ea902573c96ab40e3f5c53f2d0e99ff48865bcc1` |
| `packages/core/src/index.ts` | `c01b7f0dc5694d183d68f55a4005e612715af4e52b65d3a18471d03c7a045db7` |
| `packages/contract/src/index.ts` | `0fe7c50e5451ca638b953558c3bbd21129be0674b42669ff3bea433d4e1f01dd` |
| `packages/catalog/src/index.ts` | `e09b5b14063ec3d94698de8981048c11b3b8d59e0d51a36fd54d16603433fb86` |

```sh
node_modules/.bin/vitest run tests/kernel-conformance.test.ts -t 'nearest|interpolation|density|clockwise' --reporter=verbose --reporter=json --outputFile=.cache/kernel-fixes-results.json
```

The targeted run passed four tests, failed the two density checks and skipped eight unaffected tests. Actual evidence is `.cache/kernel-conformance-BF1ZFq/measurements.json`, SHA-256 `9ca5eb6f8fbd2c9fc7c1e21dd5ad067747797c733f31f019cd06f7f73b42babd`; runner JSON SHA-256 `b77605034625bd482366304fbff57d10016ab99b7468e136aa9d53bc02f28f53`. The initial corrected-absence check stopped at its erroneous Sharp metadata assertion; the subsequent density-only run above reached both actual kernels.

| Changed behavior | Result | Measured maximum RGBA difference |
| --- | --- | --- |
| Native exact nearest resize | PASS | 0 |
| WASM opaque linear/Lanczos | PASS | 0 |
| WASM premultiplied translucent linear/Lanczos | PASS | 0 |
| WASM exact 90-degree rotation | PASS | 0 |
| Arbitrary 30-degree rotation with opaque white fill | PASS | 0, identical 11×11 bounds and alpha 255 |
| 300-DPI physical sheet | PASS | 0, actual tag and exact placement pixels |

The fix follows the installed Sharp implementation, inspected directly. `node_modules/sharp/src/pipeline.cc`, SHA-256 `445ed9aa726806dc01188cf13a2866ee47ccd38504cddd049e4e639703edc0e9`, uses `image.rot(rotation)` for cardinal rotation and `image.rotate(angle, {background})` for arbitrary rotation. It premultiplies and casts before filtered resizing, then unpremultiplies and casts afterwards. `common.cc`, SHA-256 `c3c56a37bb780dfd97ee53d3556d9ba3d674b1b9cf7d57caf94248f982207a75`, supplies the alpha component of the explicit fill. This inspected source explains the fixes without adding ad-hoc coordinate offsets.

## Outstanding acceptance

Native declared-density correctness is FAIL on these identified sources. The full final integrated suite, browser execution, physical-phone tests, real removal quality, cross-runtime inference tolerances and cold/offline paths are NOT RUN by this kernel check. Prior passing results identify their earlier inputs; they are not a claim that every requirement passes on a final release. G2-G7 remain incomplete.

Raw evidence paths are local to `/home/sadid/Downloads/Superaster/superaster-verification-adapters`. The test reproduces and saves the actual output artifacts under a new `.cache/kernel-conformance-*` directory for each run.
