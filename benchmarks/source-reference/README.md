# Pinned general-matting source reference

Research only. These tools import the reviewed local code of `ZhengPeng7/BiRefNet-matting` at revision `eccde0a8cbdce7ac5fecfeb06340fe7b949e85d9`, verify its immutable files, and use the exact existing group/fern manifest. They do not change production engines or acceptance criteria. They run CPU float32 without training, autocast, compilation, edge cleanup or alpha thresholds.

Use Linux x86_64 CPython 3.12. The recorded environment uses Python 3.12.14, PyTorch 2.5.1+cpu, torchvision 0.20.1+cpu and Transformers 5.0.0. PyTorch's [official previous-version instructions](https://pytorch.org/get-started/previous-versions/) document this Torch/torchvision pair and CPU index. `requirements.lock.txt` pins every selected wheel URL and SHA-256. It is a platform-specific research lock, not production dependencies or support for another OS/Python version.

```sh
python3.12 -m venv .cache/source-reference-venv
.cache/source-reference-venv/bin/python -m pip install -r benchmarks/source-reference/requirements.lock.txt
.cache/source-reference-venv/bin/python -m pip check
python benchmarks/source-reference/prepare.py \
  --destination .cache/general-model-prerequisite/source-reference/model
```

`prepare.py` verifies 884,878,856 weight bytes and SHA-256 `a9875de5b1e6c8eb5fdaa8c727a82927ce442cdc87ba3abee6a77e6fa46c25bb`. It uses sequential 16 MiB HTTP ranges after observed whole-transfer resets and a 64 MiB range timeout. It verifies each exact Content-Range, stages the complete bounded segment before appending it, records segment hashes, and admits the checkpoint only after the complete file hash matches. Each range has a 120-second transport bound and no automatic retry. Failed ranges leave the completed prefix intact. An inherited incomplete prefix remains untrusted until the same final complete hash passes. Source/model downloads are explicit here. Downloaded Python is not executed by the fetcher.

Provide the coordinator's existing corpus root and unchanged targeted manifest. Select a new output directory on every invocation. Preflight verifies source/weight/input/original hashes, imports reviewed local model modules, verifies the fixed configuration, checks checkpoint state keys/shapes against an allocation-free meta-device model and checks actual image preprocessing. It does not materialize model weights or run image inference.

```sh
unshare --user --map-root-user --net -- \
  .cache/source-reference-venv/bin/python benchmarks/source-reference/run.py \
  --require-isolated-net \
  --model-dir .cache/general-model-prerequisite/source-reference/model \
  --manifest ../superaster/evidence/benchmarks/full1024-targeted-233231f/targeted-manifest.json \
  --corpus-root ../superaster \
  --output .cache/general-model-prerequisite/source-reference/preflight-NEW
```

The recorded command uses an unprivileged Linux network namespace. `--require-isolated-net` refuses any interface beyond loopback and checks that IPv4/IPv6 external connections are unavailable before importing the model. The runner also rejects Python socket resolution/connect attempts and sets the HF offline flags. The audit hook alone is not an OS sandbox; hosts unable to create the namespace cannot claim this recorded offline condition by omitting the flag. The reviewed execution path calls local tensor operations and uses no hub/download API. It never uses `AutoModel.from_pretrained`, `trust_remote_code`, backbone downloads or pickle weight loading. The reviewed constructor receives `BiRefNetConfig(bb_pretrained=False)`; the safetensors state loads strictly from the verified file.

Only the coordinator may allocate the serial inference slot. Add `--run` to the same command, with a new output directory and `--threads 4`, when that slot is granted. No source inference or export is implied by a preflight pass. Real CPU activation memory and execution time remain unknown until measured. The source contains 220,176,498 logical parameters; parameter count and allocation-free construction RSS do not predict full inference memory. Existing ORT Full1024 reached about 9.13 GB sampled process RSS on this laptop, so use a quiet machine and one heavy job. That number is contextual evidence, not a guarantee or acceptance threshold for this source route.

A real run retains exact preprocessed `input.npy`, raw `logits.npy`, continuous `coverage.npy`, original-sized continuous coverage, grayscale alpha, unmodified-RGB cutout and white/black/magenta composites for each case. It records CPU initialization, decode/preprocess, inference, sigmoid, tensor diagnostics and export timings separately. Linux process RSS is a cumulative high-water mark, not a sampled stage peak. Input/original files are checked again after processing. Failure/cancellation records retain the actual stage; an OS kill may require the coordinator's process log.

The diagnostic export keeps continuous coverage until half-pixel bilinear upsampling and nearest-byte PNG assignment. Upstream's handler quantizes before its final resize and applies separate RGB foreground estimation; neither is silently represented as identical. Composites use byte-space source-over for visual diagnosis, and do not certify the application's color contract. The retained subject remains all three birdwatchers and the foreground fern fronds.

A later audited ONNX conversion can reuse the saved input tensors. Its conditions must name the same source revision/weight and manifest hashes, an immutable ONNX artifact hash, completed inference and matching case/input identities. Save raw logits and sigmoid coverage in the same array layout, then measure differences:

```sh
.cache/source-reference-venv/bin/python benchmarks/source-reference/compare.py \
  --source SOURCE_RUN --candidate ONNX_RUN --output comparison-NEW.json
.cache/source-reference-venv/bin/python benchmarks/source-reference/test_tools.py
```

The comparison requires byte-identical preprocessed tensors and reports mean/max/RMS differences. It awards no numerical tolerance or quality acceptance. Nine deterministic tool tests cover comparison boundaries and exact-range resume/admission using clearly identified synthetic arrays and transport responses; they are not fabricated inference outputs. No ONNX export/parity, hidden-label judgment, phone result, frozen budget or remove.bg superiority claim is supplied by these scripts.

The source/model MIT notice and its original copyright are retained in [the source audit](../../research/general-model-prerequisite.md). Imported dependencies retain their own notices. The private cache stores installation reports, license inventory, full source review, transfer failures and preflight conditions. Downloaded model/source/venv files stay outside public package artifacts.
