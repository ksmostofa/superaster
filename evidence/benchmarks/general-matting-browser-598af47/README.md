# One full browser model diagnosis

The pinned full float32 general-matting model loads and initializes, but its one group inference fails with `OrtRun ERROR_CODE: 6, std::bad_alloc`. No output tensor or image was produced. The session released and the page terminated its dedicated worker. This is a failed browser prerequisite, not a production model admission or gate PASS.

The coordinator reviewed the separate research page and ran the one fixed group tensor once on 2026-10-10 JST in the actual in-app Chromium154 browser. The model, input, native/source reference arrays and installed ORT1.30 runtime were size/hash verified. The [manifest](manifest.json), [source index](source-index.json), [actual report](report.json), [visible failure](failure.png) and [acceptance states](acceptance.json) retain the identities and outcome. The diagnostic has a ten-minute investigation guard, one-use run button, local-only URLs, no proxy/WebGPU, one WASM thread and explicit cancellation/worker termination. It was not retried.

Model fetch/hash took 1.802/2.764 seconds over loopback. Session initialization took 4.941 seconds. The failure event precedes session release at 36.358 seconds from worker start. There is no successful inference latency or performance distribution. The server log is a concise retained transcription; connector events are tab-scoped and omit a full worker-network trace.

The installed loader declares maximum65,536 WASM memory pages, 4,294,967,296 bytes. [Official large-model documentation](https://onnxruntime.ai/docs/tutorials/web/large-models.html) describes the 4GB WASM32 limit. Installed `session-options.ts` passes false for omitted CPU arena/memory-pattern flags; this check explicitly used false for both. The native Python process's cumulative7.72GB RSS includes allocations outside a WASM heap and cannot prove a specific browser heap requirement. The actual allocation failure establishes failure in this tested configuration. Exact heap peak and the failing internal allocation were not measured, so the cause is not narrowed to a particular buffer or fragmentation pattern.

The same candidate's [native comparison](../general-matting-onnx-bb8cc67/README.md) completed and retained the three people under assistant inspection. Human quality remains NOT RUN. Keep the production profile unchanged. A model/runtime memory reduction would require a separately reviewed conversion and unchanged acceptance; no dimension, precision, tolerance or threshold was silently changed after this failure.

Reproduce the pinned staging from the completed source/native runs with a fresh directory:

```sh
python3 benchmarks/source-reference/prepare_full_browser.py \
  --export-dir .cache/general-model-prerequisite/conversion-audit/export-20261010-native19-retry \
  --source-run .cache/general-model-prerequisite/source-reference/run-20261010-source \
  --native-run .cache/general-model-prerequisite/conversion-audit/run-20261010-native19 \
  --runtime-dir node_modules/onnxruntime-web/dist --output BROWSER_NEW
python3 benchmarks/source-reference/serve_full_browser.py --directory BROWSER_NEW --port 5211
```

Open `http://127.0.0.1:5211/full-browser.html`, confirm READY and isolation, click the one-case action once, and retain its actual report. The server serves only the exact allowlist with COOP/COEP and a same-origin CSP. Weights and raw arrays remain excluded from public Git. This page is outside the app and never becomes a product fallback.
