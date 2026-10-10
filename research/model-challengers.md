# Model challengers for observed subject loss

Checked 2026-10-09 JST against R07 and active private specification revision 1.3. Named prerequisite: choose a rights-approved, locally usable ONNX candidate to investigate the Full 512 profile's actual birdwatcher and fern subject loss. This audit establishes artifacts, rights and graph contracts, not quality, performance or supported devices. No candidate session was initialized and no inference ran.

Decision: screen the pinned BiRefNet-lite 1024 fp16 artifact first, with the existing failed inputs unchanged. It is downloaded, locally hashed and graph-inspected; it retains the existing BiRefNet preprocessing/output semantics with explicit 1024 dimensions. This is an experimental candidate, not a default replacement or release-qualified profile. Preserve the Full 512 failures. Benchmark numerical budgets remain unset at G2.

## Candidates and rights

| Candidate | Immutable artifact and rights evidence | Reuse/adapt decision |
| --- | --- | --- |
| BiRefNet-lite 1024 fp16 | [Conversion](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/tree/de15b22ba131738a16dff04aab8bdf8dc32e3ac1), `onnx/model_fp16.onnx`, 114,538,221 bytes, SHA-256 `d39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402`. Conversion card MIT; [original lite weights/card](https://huggingface.co/ZhengPeng7/BiRefNet_lite/tree/aa62cd87eafb9cc43056d08ef3615a14628b831d) MIT. | First screen. Adapt existing manifest/shape guards and preprocessing dimensions; preserve names, normalization and external sigmoid. Lowest downloaded size among the shortlisted ready graphs. This does not imply better quality or phone viability. |
| BiRefNet full 1024 fp16 | [ONNX conversion](https://huggingface.co/onnx-community/BiRefNet-ONNX/tree/534d3c82d3bb8b2f0867db6dfbc3a525b8e42f67), `onnx/model_fp16.onnx`, 489,666,272 bytes, upstream LFS SHA-256 `3654c741eb80bd926ada8fed1713b506ccf8d30eb1f6487e87eb9f234f33df09`. Card MIT; names [original BiRefNet](https://huggingface.co/ZhengPeng7/BiRefNet/tree/e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4), MIT. | Available general-family alternative. Not downloaded or graph-audited here because the first candidate is already sufficient to start the named screen. The converter names the source repository but does not identify an immutable source-weight revision; do not invent one or claim parity with today's weights. |
| BiRefNet matting 1024 fp32 | [emrikol conversion](https://huggingface.co/emrikol/birefnet-matting-onnx/tree/0d58d809b3a360b44c556223d2f5812aeace9ba3), `birefnet-matting.onnx`, 940,840,787 bytes, upstream LFS SHA-256 `f0843e38f6a4e88efc8c5fad4178ad7ed6c818346ce12f82e7b579324fe7e0c5`. Card explicitly MIT and identifies [official matting](https://huggingface.co/ZhengPeng7/BiRefNet-matting/tree/eccde0a8cbdce7ac5fecfeb06340fe7b949e85d9), MIT. | Matting route exists. Publisher says it replaces deformable convolution with GridSample and declares float32 1024 I/O/logits, opset 16. No export script is present in the pinned tree; equivalence, actual graph, local hash, memory and backend claims remain unverified. Audit before execution rather than inheriting its numerical claims. |
| BiRefNet HR-matting 2048 fp16 | [PinkPixel conversion](https://huggingface.co/PinkPixel/birefnet-hr-matting-onnx/tree/792518b9d4dfe9793891712677de25e554f948c6), `model_fp16.onnx`, 471,320,622 bytes, upstream LFS SHA-256 `c0216070c15542b7197bcf13eb3ea07af0fc5595c591037b7c9766c3cc6470f0`. Included MIT LICENSE names both BiRefNet contributors and Pink Pixel; [official HR-matting](https://huggingface.co/ZhengPeng7/BiRefNet_HR-matting/tree/5d6b6f8adcb5b417c871b1d84ceaae9871355b7f) card MIT. | Heavier inference geometry; not first screen. Included `infer.py` and card declare float32 `image`/`alpha` 2048 I/O and sigmoid already inside the graph. Graph, parity and advertised backend support remain unverified. Do not apply the BiRefNet external sigmoid without inspection. |
| BEN2 Base | [Official ONNX artifact](https://huggingface.co/PramaLLC/BEN2/tree/e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f), `BEN2_Base.onnx`, 222,932,053 bytes, locally verified SHA-256 `22cea62108ff53b7ccc20f7a008bf30494228d84b1687f29ecbe76936a998101`. Card MIT and [source MIT license](https://github.com/PramaLLC/BEN2/blob/2c99a5da477b5523585bfa5c893888a6e818a8f6/LICENSE). | Retain as challenger after the BiRefNet screens. It needs a distinct normalization/output contract, not merely a model URL swap. Base is the inspected artifact; enhanced commercial weights/API are separate and excluded. |
| FeyNoBg | [Official pinned tree](https://huggingface.co/feyninc/FeyNobg/tree/c1fd67fbefe3efeb78fe2a003270fb5350a0bb1c) contains `model.safetensors`, 1,051,353,168 bytes, upstream LFS SHA-256 `7ee181389acf07c6dcf3d72caba2d169224caacdde8bb837ecf7aa3e22e0c3aa`; card Apache-2.0. [nobg source](https://github.com/feyninc/nobg/tree/37015c6a2dff63eaa052410c23169ecdfeb64e0c) Apache-2.0. | No ONNX file in this official tree. Pinned source implements export, but a specific conversion, graph/hash/parity audit and backend proof are prerequisites. No new conversion was built. |

MIT permits commercial processing and redistribution with the copyright and permission notice retained; inspect and retain the [BiRefNet source notice](https://github.com/ZhengPeng7/BiRefNet/blob/ebcc0bc8ec7fe919cec829f2dea656b3078acddc/LICENSE) alongside the conversion's attribution. Apache-2.0 permits commercial use and redistribution under its license/notice requirements; retain the [nobg license](https://github.com/feyninc/nobg/blob/37015c6a2dff63eaa052410c23169ecdfeb64e0c/LICENSE) and any relevant notices if a conversion is later adopted. Weight, conversion, source and runtime rights are separate. No commercial enhanced model, gated API or downloaded Python execution is part of production.

The first-party [BiRefNet model zoo](https://github.com/ZhengPeng7/BiRefNet/blob/ebcc0bc8ec7fe919cec829f2dea656b3078acddc/README.md) distinguishes general, lite, matting, HR and 512 variants. The 1024 artifact is not obtained by resizing or relabeling the currently failing fixed 512 graph. Official lite-matting weights also exist at [99c33412e3f58e1f33187abdc8c435c645243690](https://huggingface.co/ZhengPeng7/BiRefNet_lite-matting/tree/99c33412e3f58e1f33187abdc8c435c645243690), MIT, safetensors SHA-256 `ce8bcfc045e336322c0424a5863dcfb7e9ce8fed0a5fd4d1b2b20adf12d97243`, 88,965,896 bytes; its official tree has no ONNX file. Availability is established, and conversion remains a named prerequisite if that route becomes necessary.

## Actual graph and source inspection

Downloaded graphs were parsed with ONNX 1.23.2, installed only into ignored `.cache/model-challenger-audit/python-libs`. Project dependencies and lockfiles were untouched. Graph parsing is not a model session or quality run. LFS hashes in the table are explicitly upstream declarations unless locally verified.

| Actual downloaded graph | Lite 1024 fp16 | BEN2 Base |
| --- | --- | --- |
| Local size/hash match | PASS, 114,538,221 bytes | PASS, 222,932,053 bytes |
| IR / opset / producer | IR 8 / standard opset 17 / PyTorch 2.0.1 | IR 8 / standard opset 15 / PyTorch 2.5.1 |
| Input | `input_image`, FLOAT, `[1,3,1024,1024]` | `input.1`, FLOAT, `[1,3,1024,1024]` |
| Output | `output_image`, FLOAT, `[1,1,1024,1024]` | `17728`, FLOAT16, `[1,1,1024,1024]` |
| Initializers | 437 FLOAT16 | 188 FLOAT + 325 FLOAT16 |
| Output-producing path | Final Conv → Cast; no sigmoid on output path | Final Conv → Sigmoid → Concat |
| External initializers | None | None |
| Relevant operators | 72 ScatterND, 80 GatherND, 64 LayerNormalization, 150 MatMul, 22 Resize | 36 ScatterND, 13 InstanceNormalization, 8 CumSum, 244 MatMul, 18 Resize |
| Backend compatibility | NOT RUN | NOT RUN |

The pinned lite [processor JSON](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/blob/de15b22ba131738a16dff04aab8bdf8dc32e3ac1/preprocessor_config.json) declares square 1024 resize, bilinear resampling, RGB rescale 1/255 and ImageNet mean `[0.485,0.456,0.406]` / std `[0.229,0.224,0.225]`. Its card applies sigmoid externally, consistent with the inspected final Conv→Cast logits. Retain continuous alpha and original RGB. Do not add min/max scaling or thresholds.

BEN2's pinned [actual ONNX script](https://huggingface.co/PramaLLC/BEN2/blob/e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f/onnx_run.py) resizes to 1024 and converts RGB to 0..1 without ImageNet normalization. It uses per-image min/max scaling after interpolation and passes `[w,h]` to a height/width interpolation API before another resize. Constant output would divide by zero. These are concrete source gaps to diagnose in a rectangular fixture; do not copy them silently. The graph already emits sigmoid alpha as float16, so applying the current float32-logit guard or a second sigmoid is incorrect. A separate approved BEN2 profile must declare its output activation, float16 decoding and finite/constant-output handling.

The pinned [nobg processor](https://github.com/feyninc/nobg/blob/37015c6a2dff63eaa052410c23169ecdfeb64e0c/src/nobg/birefnet/image_processing_birefnet.py) and Fey processor JSON specify RGB/bilinear 1024, 1/255 and ImageNet normalization. The [export implementation](https://github.com/feyninc/nobg/blob/37015c6a2dff63eaa052410c23169ecdfeb64e0c/src/nobg/mixin.py) exports logits and requires opset 19 for DeformConv. Existing export source does not establish an available browser-compatible artifact.

## Candidate definition for coordinator integration

This object fits the current ModelDefinition fields. It names an explicit experimental profile; the coordinator owns central manifests and the dimension/shape generalization.

```ts
{
  id: 'birefnet-lite-1024-fp16',
  name: 'BiRefNet lite 1024 Candidate',
  repository: 'onnx-community/BiRefNet_lite-ONNX',
  revision: 'de15b22ba131738a16dff04aab8bdf8dc32e3ac1',
  file: 'onnx/model_fp16.onnx',
  bytes: 114538221,
  sha256: 'd39b897ceb16ae654c1731f3dba0cf9b368d9cae74b5a57459b455cc8bfec402',
  inputSize: 1024,
  width: 1024,
  height: 1024,
  license: 'MIT',
  precision: 'fp16',
  inputName: 'input_image',
  outputName: 'output_image',
  version: 'de15b22ba131738a16dff04aab8bdf8dc32e3ac1',
  url: 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/de15b22ba131738a16dff04aab8bdf8dc32e3ac1/onnx/model_fp16.onnx'
}
```

Integration must use declared dimensions in resizing, allocation, ONNX guards and execution records in both adapters. Its verified input/output dtype is float32 despite fp16 weights; output kind is logits with external sigmoid. Keep existing Auto Quality/Fast choices until measured decisions are settled. No implicit fallback to this candidate is authorized by the audit.

The smallest next useful run is one serial native job on the original failed birdwatcher and fern screening files with edge cleanup `none`. Save alpha/cutouts/composites, per-stage latency and memory, verify retained subjects and background, then decide whether a complete 25-case screening is justified. No held-out evaluation or changed input is needed to test this named failure. Passing two diagnostic inputs would not qualify a release model.

## Evidence and limit

Ignored audit inputs are in `/home/sadid/Downloads/Superaster/superaster-verification-adapters/.cache/model-challenger-audit`: exact API/tree/commit snapshots, pinned cards/configs/licenses, both actual ONNX files, `lite-1024-download.json`, `lite-1024-graph.json`, `lite-1024-output-chain.json`, `ben2-download.json` and `ben2-graph.json`. Lite graph report SHA-256 `d3dba3e10eb83839bd17e02c5a51755a5c583ebc300a6aa431ede6180bd63df2`; lite processor JSON `447d9ccb2c4129ab0ca045fc293e7d79dbc45e293ac1e94818d865db77f65a54`; BEN2 ONNX script `558d7eda04d7c24eb42377e16047bc024260e024ec22b9550f82a6095af2b71f`.

License file hashes: BiRefNet `92a7089e0915fc32bc40067560b398f1e6a7a5958abd7d04eda393629a5acefb`; BEN2 `a4843132cbd56c50f20ae008739d85b7563d38905fd692a337af52ad588c581a`; nobg `b63b846784a7f86178fd05771baabc61c12b8faa38567855df087e6cce2452c8`; PinkPixel conversion `fedb64d4650e7ad4fa97c772ff521d787ee0e588537fa2a0adc5bef83b7335f8`. These notices must accompany adopted artifacts under their terms.

Research stops here because a concrete first candidate and the alternatives' prerequisites are identified. No measured candidate quality/performance, commercial-model rights, device support, graph parity or official-photo compliance is inferred from model-card claims.
