# Pinned native ONNX conversion

The first full export failed and remains in `../general-matting-export-first-failure`. A focused metadata fix at `bb8cc67dc8411fae189ac37fd1424f385d2bf830` then exported the fixed source once. One exact two-case native ORT CPU run completed using the saved source inputs. No source/native inference was repeated to verify these outputs.

`export.json` records the artifact, source and dependency hashes, static interfaces, operators, actual offline environment and process high-water RSS. `graph-audit.json` confirms raw final logits from Conv; internal model sigmoid operations remain. The original producer report's phrase "no in-graph sigmoid" is preserved and clarified here. `conditions.json`, `results.json`, `comparison.json` and `properties.json` identify the actual run, finite raw tensors, all recorded output hashes, source/native deltas and all-pixel decoded export checks.

The native artifact is 929,574,771 bytes, SHA-256 `09e180872581e886bb531e5c72a1df354ba2dd55445a11bb0618435a98abe92d`. It remains local at `.cache/general-model-prerequisite/conversion-audit/export-20261010-native19-retry/general-matting-f32-opset19.onnx`. Actual PNG/NPY outputs remain at `.cache/general-model-prerequisite/conversion-audit/run-20261010-native19`. Model and array binaries are excluded from public source/packages. A cloud checkout can reproduce them through the pinned setup and commands; Git does not transfer the ignored cache.

`acceptance.json` distinguishes observed prerequisite passes from unfrozen tolerance, human quality, browser, phone, heldout and comparator checks. These remain incomplete. No production default or gate was changed.

Run from the repository root after the exact [source setup](../../../benchmarks/source-reference/README.md), fixed corpus setup and completed source diagnosis. The recorded producer used the code at `bb8cc67`; later source clarifies the report wording without changing conversion semantics. Heavy commands require the coordinator's serial allocation and use fresh directories. Their 900-second bounds are investigation guards, not product budgets.

```sh
timeout --signal=INT --kill-after=10s 900s \
  unshare --user --map-root-user --net -- \
  .cache/source-reference-venv/bin/python benchmarks/source-reference/export.py \
  --model-dir .cache/general-model-prerequisite/source-reference/model \
  --source-run .cache/general-model-prerequisite/source-reference/run-20261010-source \
  --output EXPORT_NEW --execute

timeout --signal=INT --kill-after=10s 900s \
  unshare --user --map-root-user --net -- \
  .cache/source-reference-venv/bin/python benchmarks/source-reference/run_onnx.py \
  --artifact EXPORT_NEW/general-matting-f32-opset19.onnx \
  --export-report EXPORT_NEW/export.json \
  --source-run .cache/general-model-prerequisite/source-reference/run-20261010-source \
  --manifest ../superaster/evidence/benchmarks/full1024-targeted-233231f/targeted-manifest.json \
  --corpus-root ../superaster --output ONNX_RUN_NEW --run

.cache/source-reference-venv/bin/python benchmarks/source-reference/compare.py \
  --source .cache/general-model-prerequisite/source-reference/run-20261010-source \
  --candidate ONNX_RUN_NEW --output comparison-NEW.json
.cache/source-reference-venv/bin/python benchmarks/source-reference/verify.py \
  --run ONNX_RUN_NEW \
  --manifest ../superaster/evidence/benchmarks/full1024-targeted-233231f/targeted-manifest.json \
  --corpus-root ../superaster --output properties-NEW.json
```

The group source is a public-domain technical fixture; fern is attributed to Forest and Kim Starr under CC BY 3.0 US in the pinned corpus. The source checkpoint and converter/runtime retain their documented notices. The generated composites make no brand, consent or official-photo-compliance claim.
