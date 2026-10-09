# Full1024 artifact audit for retained-subject diagnosis

Checked 2026-10-09 JST. Decision: this exact conversion can enter one bounded native diagnostic as an explicit experimental candidate after coordinator integration. Rights, downloaded hash and graph contract pass. Quality, runtime operators, memory, CPU/browser/device support and source-conversion parity remain NOT RUN or UNKNOWN. No model session was initialized in this audit. Existing Full512, Lite1024 and BEN2 runs were read and were not repeated.

There is a specific remaining question. Full512 loses the left birdwatcher, Lite1024 loses part of that person and erases the fern, and BEN2 still loses that person while retaining a fern whose fronds need review. This artifact supplies full-family 1024 geometry, four times Full512's input pixels, rather than another Lite1024 run. That justifies a two-input diagnosis of small-person/frond retention; it does not predict success. Preserve all three birdwatchers and the foreground-frond criterion, existing images, thresholds, alpha semantics and edge cleanup `none`.

## Rights and source limits

The pinned [conversion card](https://huggingface.co/onnx-community/BiRefNet-ONNX/blob/534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67/README.md) declares MIT and names `ZhengPeng7/BiRefNet`. The [official source-weight card](https://huggingface.co/ZhengPeng7/BiRefNet/blob/e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4/README.md) also declares MIT. The retained [BiRefNet notice](https://github.com/ZhengPeng7/BiRefNet/blob/ebcc0bc8ec7fe919cec829f2dea656b3078acddc/LICENSE) permits commercial use and redistribution with its copyright and permission notice. Notice SHA-256 is `92a7089e0915fc32bc40067560b398f1e6a7a5958abd7d04eda393629a5acefb`, 1,066 bytes. Retain the full notice and conversion attribution with an adopted artifact. Its terms do not make the imported weights Apache-2.0.

The pinned conversion tree contains cards/configuration and two ONNX files, with no export script or immutable original-weight revision. The inspected official source revision establishes rights/configuration only. It is not asserted to be the source of these ONNX bytes. Its card describes standard DIS training; its actual `birefnet.py` config selects DIS5K, a 1024 input size and `swin_v1_l`. The [official model zoo](https://github.com/ZhengPeng7/BiRefNet/blob/ebcc0bc8ec7fe919cec829f2dea656b3078acddc/README.md) distinguishes general, matting and other weights. Do not label this conversion as a verified current general checkpoint, assert a particular training set, invent a source-weight hash or claim conversion parity. Training-image overlap remains UNKNOWN. Source Python was read as text and never executed.

The pinned [processor](https://huggingface.co/onnx-community/BiRefNet-ONNX/blob/534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67/preprocessor_config.json) declares square 1024 resize, bilinear resampling, RGB rescale 1/255 and ImageNet mean `[0.485,0.456,0.406]` / std `[0.229,0.224,0.225]`. Processor SHA-256 is `447d9ccb2c4129ab0ca045fc293e7d79dbc45e293ac1e94818d865db77f65a54`. The conversion example applies sigmoid to output logits. No threshold or per-image min/max scaling is introduced.

## Actual downloaded graph

The immutable [artifact](https://huggingface.co/onnx-community/BiRefNet-ONNX/blob/534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67/onnx/model_fp16.onnx) is 489,666,272 bytes. A complete local SHA-256 calculation matched `3654c741eb80bd926ada8fed1713b506ccf8d30eb1f6487e87eb9f234f33df09` and the pinned tree's LFS declaration. The graph was parsed with ONNX 1.23.2 from the existing ignored audit library directory. No project dependency, lockfile, schema, model manifest or production source changed.

| Inspected property | Actual value |
| --- | --- |
| IR / opset / producer | 8 / 17 / pytorch 2.0.1 |
| Input | `input_image`, FLOAT, `[1,3,1024,1024]` |
| Output | `output_image`, FLOAT, `[1,1,1024,1024]` |
| Initializers | 593, 593 FLOAT16 |
| External initializers | None |
| Nodes | 22014 |
| Relevant operators | 72 ScatterND, 80 GatherND, 112 LayerNormalization, 294 MatMul, 22 Resize |
| Terminal output path | Final Conv → Cast to FLOAT → `output_image`; no terminal sigmoid |
| Whole-graph Sigmoid nodes | 23; internal nonlinearities do not turn the final Conv logits into alpha |
| CPU / WASM / WebGPU | NOT RUN on this exact graph |

The actual FLOAT I/O differs from its fp16-weight precision label. Use float32 input/output and one external sigmoid, then declared alpha interpolation to original dimensions. Preserve original RGB. Graph parsing alone cannot establish operator availability, numerical parity or runtime memory.

## Candidate object and coordinator prerequisites

This complete object fits the coordinator's current `ModelDefinition`. The audit worktree's older model module lacks the generalized normalization/output fields. That module was not changed and was not used to infer this candidate.

```json
{
  "id": "birefnet-full-1024-fp16",
  "name": "BiRefNet full 1024 candidate",
  "repository": "onnx-community/BiRefNet-ONNX",
  "revision": "534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67",
  "file": "onnx/model_fp16.onnx",
  "bytes": 489666272,
  "sha256": "3654c741eb80bd926ada8fed1713b506ccf8d30eb1f6487e87eb9f234f33df09",
  "inputSize": 1024,
  "width": 1024,
  "height": 1024,
  "license": "MIT",
  "precision": "fp16",
  "inputName": "input_image",
  "outputName": "output_image",
  "normalization": "imagenet",
  "outputType": "float32",
  "outputActivation": "logits",
  "version": "534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67",
  "url": "https://huggingface.co/onnx-community/BiRefNet-ONNX/resolve/534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67/onnx/model_fp16.onnx"
}
```

Coordinator integration must add this explicit experimental model object and corresponding artifact/notice provenance, retaining unknown original-weight revision/parity. Keep Auto Quality and Fast unchanged. The current coordinator native/browser adapters already use declared dimensions, normalization, output dtype and activation; retain their metadata and finite-output guards. No schema change is required by the current string engine field. Do not advertise backend/device admission before actual checks.

After integration and an explicit heavy-slot grant, the smallest useful job uses the unchanged retained two-case manifest, SHA-256 `e293dfc4721a5394d9203da05f3064ea428ec65375541b31d39cbfd69330d2c9`, and one serial native session. Preflight must check input/original hashes without inference. The cached model is already named `birefnet-full-1024-fp16.onnx` in the audit directory, which can be supplied directly as `--model-dir`; its production loader must still verify it. Suggested command from the coordinator source tree, with a new output directory:

```sh
node_modules/.bin/tsx scripts/evaluate-native.ts \
  --manifest evidence/benchmarks/lite1024-targeted-d140d55/targeted-manifest.json \
  --corpus-root /home/sadid/Downloads/Superaster/superaster-corpus \
  --engine birefnet-full-1024-fp16 --profile quality --edge none \
  --model-dir /home/sadid/Downloads/Superaster/superaster-verification-adapters/.cache/full1024-audit \
  --spec superaster-technical-spec.updated.md \
  --output evidence/benchmarks/full1024-targeted-IDENTIFIED_VERSION \
  --check-only
```

Remove only `--check-only` for the authorized actual run. Save source hashes at run time, model/tensor metadata, alpha/cutouts and white/black/magenta composites, stage latency, peak-memory methods, exit/failure state and intended-subject review. T01 input/original SHA-256 stays `08eeb79ecc9b1b1ed5bf6c93631835005b240d24523303379384737694585734` / `59240dd21009422421968a096a28a551caa4130d0e0435f549c632c7a7904dc7`; fern stays `11f56e745cf24d162b5a415db8035c61e195c99411428ce210b1923240cd0b2b` / `20778fc6cc3b0a862578ec669d3714b00fcf9202591ac04dac7290ff70273ed9`. A failure ends this candidate's screen. Do not rerun unchanged cases or expand to 25 images unless these outputs establish a useful next question.

This audit transfers no images, adds no infrastructure cost, trains nothing and changes no defaults, refinement or thresholds. Native success on two inputs would leave physical Pixel7, human blind review, budgets, held-out evaluation, browser tests and release decisions incomplete.

## Conditions and retained evidence

Private active specification revision 1.3 has SHA-256 `e5f828d0a6d62d0b92a79b0f440c0528a4200ef4c469aa19fb514afe17a967a1`. It was read in full; its contents remain excluded from public history. Audit worktree HEAD is `a2b02fcc4874d4589887990d7d813c56c48e2be7`. Observed coordinator HEAD was `df81e4a15db403930dfe7197d041f13234ca3c9f`. These hashes identify a read-only audit, not a quality run on either checkout.

| Production source path | Audit worktree SHA-256 | Observed coordinator SHA-256 |
| --- | --- | --- |
| `packages/engines/src/models.ts` | `e1aae271dd22ef8dbecb98b67940c6c3e85f8ee9234708c1a7e0f4976ace6df5` | `a42d3f4658e1f8a95bb7e0c80a3182ebdd73db9d711c0f2d38800f6224d679b0` |
| `packages/engines/src/native.ts` | `f61f7745c53a2adff17070e14ee00d4b1f6e8d9a6be7686966d552bf59f80ed2` | `045a43cfcb1e0dc8c57dc0a0b43078dc8ffa2931dd74738198282eb2578ec833` |
| `packages/engines/src/pipeline.ts` | `d9b83874cb365f89e49407b5ea902573c96ab40e3f5c53f2d0e99ff48865bcc1` | `6f069bbd002edc53691fa8bf8dd100cc97f7fc2417dacafb2428e31f8adae645` |
| `packages/engines/src/raster.ts` | `3bea48ef456d73b4efd02d5ad0fa3e2df393c7d05272ac2b6977c3f911401fbe` | `731a10a1d16abdb8bb870da293fb850a189ef6733c962e4766ff50b57d8e66a1` |

Raw source/card/config/tree/code snapshots and scripts remain under the ignored `/home/sadid/Downloads/Superaster/superaster-verification-adapters/.cache/full1024-audit`. Exact source snapshot URLs, bytes and hashes are retained in `source-index.json` / `source-code-index.json`. Small factual reports are retained beside this review:

| Evidence file | SHA-256 |
| --- | --- |
| `download.json` | `f3a8ffa04bf3f170c6b146cf27194249730fbd5de4956ea3e2435fcd4b6f5d3f` |
| `graph.json` | `13e792ba3db7819bfaa5852dc2a4797d2363af6a9fc47180c2688fb435a1e568` |
| `conditions.json` | `eb054e320a27b89f4c94fe45a7a0d6d9a5db5bc24af430ef254959bb79ab58c1` |
| `source-index.json` | `37d7063383bbe393d5d6730b39de9726c00b0c65e7e21d9b1f353fca09be8819` |
| `source-code-index.json` | `a5add83b16a21db24c0009ed7b94269f007d68045522731799a5dba19c5029b2` |
| `candidate.json` | `ca78d6a3c89a910bc5887e4f2ef5d83d965cb3b5531817bad25fa2f5524d16dc` |

`artifact-index.json` pins these reports and the local model. The audit's raw HTTP transfer time is descriptive; it is not an application cold-download measurement. No quality result, runtime-supported profile, default replacement or delivery gate is awarded here.
