# Native screening baseline

Measured baseline only. Numerical budgets remain unfrozen. G2, human quality, physical Pixel 7, and superiority acceptance are incomplete.

The integrated native CPU pipeline processed the same 25 hash-pinned screening inputs using one persistent session per profile. Edge cleanup was `none`; no tuning or threshold change occurred. Quality used commit `d21946ebb736cf7093e5c5534bdfd7ee1a0dd9de` and Fast used `3f009d0b9283a4e146f197e08dfe1a2654fe07ab`. The five recorded engine/runner source hashes, manifest and active private specification 1.2 hash are identical across these runs. Individual `conditions.json`, `execution.json`, `measurement.json` and source notices identify the inputs, dependencies and exact model artifacts.

| Observed item | Quality full | Fast lite |
| --- | ---: | ---: |
| Machine artifact checks | 25/25 PASS | 24/25 PASS, 1 FAIL |
| First complete operation, installed artifacts | 19.293s | 9.410s |
| Warm complete median, all 24 outputs | 11.434s | 4.368s |
| Warm complete p95, all 24 outputs | 13.563s | 5.167s |
| Warm inference-kernel median | 10.864s | 3.834s |
| Warm inference-kernel p95 | 12.958s | 4.578s |
| Peak sampled process RSS | 4,651,806,720B | 3,955,183,616B |
| Process lifetime maxRSS | 4,542,780KiB | 3,863,068KiB |
| Opaque foreground pixels with changed RGB | 0 | 0 |
| Derived serial processing throughput including cold setup | 5.05images/min | 12.79images/min |

The latency statistics include the failed Fast output. The runner's original machine-passing-only Fast summary has 23 warm cases; [the complete numerical report](native-screening-baseline.json) retains both scopes. Percentiles interpolate at `(n-1)*p` and are descriptive sample statistics. Derived throughput sums item timings and excludes gallery/evidence I/O and gaps; it is not whole benchmark wall throughput.

The laptop was Linux x86_64, Intel i7-8665U, 16 GiB RAM, Node 26.11.1, ONNX Runtime Node 1.30.0 and Sharp 0.35.5/libvips 8.18.7, with a normal desktop/Vite session. These numbers do not establish browser or physical-phone performance. Inputs ranged from 344,000 to 1,342,720 pixels. Earlier 2400×1600 smoke evidence is separate and excluded from these percentiles. Current guard ceilings are implementation bounds, not measured maximum-image support. 20 ms RSS sampling can miss brief peaks; maxRSS measures the entire process lifetime.

## Fast fern failure

`thin-plant` has 1,228,800 pixels at 1280×960. Fast exported a valid RGBA PNG and one-channel mask, but every exported alpha pixel is 0. `has_retained_pixels` is FAIL. The alpha and three composites confirm a completely removed intended subject. The recipe, input hash and approved Lite model hash are correct; metadata, preserved-original, dimensions and other machine checks pass. Raw inference logits were not retained, so their exact range is NOT RUN. No subsequent inference was performed for diagnosis.

Quality on this same source retains only a few leaf fragments. Its nonempty-alpha machine check passes, while intended-subject retention requires review. This observation prevents treating Quality's 25 machine passes as 25 successful cutouts. The source is a crowded nursery with foreground fern fronds, leaves and stems; the declared intended subject remains unchanged.

Evidence: [Quality conditions](screening-quality-d21946e/conditions.json), [Quality results](screening-quality-d21946e/results.json), [Fast conditions](screening-fast-40d2c57/conditions.json), [Fast results](screening-fast-40d2c57/results.json), [Fast failed measurement](screening-fast-40d2c57/thin-plant--1/measurement.json), [Fast alpha](screening-fast-40d2c57/thin-plant--1/alpha.png), [Fast white composite](screening-fast-40d2c57/thin-plant--1/white.png), [Quality white composite](screening-quality-d21946e/thin-plant--1/white.png).

Source credit: Forest and Kim Starr, [Wikimedia Commons source](https://commons.wikimedia.org/wiki/File:Starr-100623-7771-Nephrolepis_sp-potted_plants_in_shade_house-Pukalani_Plant_Company_Pulehu-Maui_(24746746030).jpg), [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/). Changes: bounded orientation-normalized evaluation rendition and the explicitly recorded background-removal profile. Input/source hashes and revision 1190650229 remain in each measurement.

The npm tarball retains the numerical report, the conditions/results linked above and the three fern images needed to inspect this failure. Complete per-case galleries, input photographs and remaining raw sidecars stay in the source evaluation workspace; their paths in JSON records identify retained local evidence, not additional packaged files. The linked fern derivatives retain the source credit and CC BY terms above.

## Reproduction

Use the repository checkout: the installed npm tarball does not include the development runner, Python corpus tooling, full corpus or private specification. Install the locked dependencies and pinned models, restore the rights-cleared corpus, then run each profile in a separate process from the repository root. Use a new output directory for each run. The optional `--spec` argument records the private active specification hash without publishing its contents.

```sh
npx tsx scripts/evaluate-native.ts --check-only --corpus-root . --profile quality
npx tsx scripts/evaluate-native.ts --corpus-root . --model-dir .cache/models --profile quality --edge none --spec superaster-technical-spec.updated.md --output evidence/benchmarks/repro-quality
npx tsx scripts/evaluate-native.ts --corpus-root . --model-dir .cache/models --profile fast --edge none --spec superaster-technical-spec.updated.md --output evidence/benchmarks/repro-fast
```

No heldout evaluation or automatic-cleanup comparison was run. Schedule those after the prescribed numerical freeze, using one heavy inference job at a time. Human blind quality ratings, Pixel 7 checks and declared supported ceilings remain NOT RUN.
