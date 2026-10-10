# Full1024 two-case diagnostic

The required left birdwatcher remains erased: **T01 intended-subject FAIL**. The empty fern mask is resolved in this artifact; exact frond/background quality remains for human review. Machine artifact checks PASS for both files. No default, threshold, supported-device claim or gate changed.

Identity: coordinator `233231f` plus exact dirty engine source hashes in conditions.json; private active specification 1.3; unchanged diagnostic manifest SHA-256 `e293dfc4721a5394d9203da05f3064ea428ec65375541b31d39cbfd69330d2c9`. Full1024 MIT artifact revision `534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67`, SHA-256 `3654c741eb80bd926ada8fed1713b506ccf8d30eb1f6487e87eb9f234f33df09`.

Reproduce from the source checkout by placing the exact model in a local model directory, copying runtime-observer.mjs to `.cache/full1024-runtime-observer.mjs` (its relative imports intentionally target the checkout), then:

```sh
node --import tsx .cache/full1024-runtime-observer.mjs --manifest evidence/benchmarks/full1024-targeted-233231f/targeted-manifest.json --corpus-root . --model-dir MODEL_DIRECTORY --engine birefnet-full-1024-fp16 --profile quality --edge none --spec superaster-technical-spec.updated.md --output NEW_EVIDENCE_DIRECTORY
```

| Case | Complete observed seconds | Sampled RSS bytes | Transparent / partial / opaque pixels |
| --- | ---: | ---: | --- |
| Group, initial session with cached weights | 51.177 | 9,109,835,776 | 2,830,434 / 44,408 / 965,158 |
| Fern, distinct warm image | 77.197 | 9,134,694,400 | 421,709 / 57,228 / 749,863 |

Actual CPU outputs are FLOAT `[1,1,1024,1024]`, Float32Array, with no nonfinite values. Raw group logits span −35.496 to 26.511; fern spans −29.377 to 27.131. The unchanged observer delegates real inference and inspects returned tensors. Its statistics took 3.383 and 1.606 seconds; file I/O/hash overhead is additional. These instrumented times are descriptive, not frozen performance budgets or an uninstrumented model comparison. Per-case machine properties, engine pins and actual exports are retained alongside conditions/results/runtime-statistics; PNGs are local evidence. Corpus attribution remains in benchmarks/corpus/NOTICE.md.

The finite strategy review stops broader trials of this artifact after the retained-subject failure. Numerical budgets, Pixel 7 measurements, hidden-label human review, source-weight conversion parity and held-out acceptance remain incomplete. Manual restoration cannot count as automatic quality improvement.
