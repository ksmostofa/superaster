# Corpus and benchmark reproduction

The screening corpus contains 25 real photographs, five each of people, products, animals, thin structures, and difficult materials. `corpus/screening.json` pins the downloaded input and evaluation bytes, retained subject, challenges, photographer, selected copyright terms, source page revision, and canonical highest-resolution asset. `corpus/provenance.json` retains selected license, credit, revision, and file fields from the Commons API responses. Full raw responses are retained locally in ignored `corpus/source-snapshots/`, with their hashes in the public manifest. SHA-256 covers local bytes; the upstream SHA-1 identifies the canonical source file.

Downloaded originals are preserved. Four canonical Commons originals were available before the original host returned rate-limit responses. A Commons original may itself be a resized or edited source upload; no original-camera-resolution claim follows. Other inputs use official published renditions requested at [MediaWiki's current standard sizes](https://www.mediawiki.org/wiki/Common_thumbnail_sizes). Their rendition status and dimensions are explicit. Screening uses EXIF-normalized RGB PNGs with a maximum edge of 1280 pixels and no upscaling. These inputs establish bounded screening conditions; they do not establish full-camera-resolution or physical-phone support. No alpha ground truth is supplied. The local held-out split cannot prove exclusion from model training.

Copyright permissions permit reuse and derivatives under each manifest's selected CC0, public-domain, or CC BY terms. Attribute the photographer, original source, license, and derivative changes when publishing images or results. Do not describe every image as CC0 or Apache-2.0. Commons' [reuse policy](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) also distinguishes copyright permission from other rights. No model release, endorsement, or identity consent is claimed. These photographs are technical evaluation inputs, not advertising assets.

Install Python 3.11 or newer and the pinned image library:

```sh
python3 -m venv benchmarks/.venv
benchmarks/.venv/bin/python -m pip install -r benchmarks/requirements.txt
benchmarks/.venv/bin/python benchmarks/fetch_corpus.py --prepare-evaluation
benchmarks/.venv/bin/python benchmarks/fetch_corpus.py --verify-only
benchmarks/.venv/bin/python benchmarks/generate_fixtures.py
benchmarks/.venv/bin/python benchmarks/prepare_acceptance.py
benchmarks/.venv/bin/python -m unittest discover -s benchmarks -p test_evidence.py -v
```

The repository excludes downloaded inputs, generated correctness images, and benchmark result images from Git. Fetching refuses a changed upstream hash and never overwrites a mismatched original. A missing or changed input stops processing. Correctness fixtures have explicit geometry, coverage, composition, ICC, orientation, metadata, frame-count, corrupt-input, and oversized-header answers. They are original CC0 fixtures, separate from real-image quality scoring. Their generator fixes the otherwise time-dependent ICC header date. `prepare_acceptance.py` separately prepares a real 2400×1600 orientation-normalized T01 input, a T08 batch of 19 real photos plus one deliberately corrupt file, and T10 duplicate basenames in distinct folders. The real inputs retain their per-source licenses. These workflow fixtures stay outside quality scoring.

`run.py` executes one command at a time with an argv array, without a shell. Supply the actual processor command through `--command-json`. It replaces `{input}`, `{output}`, `{record}`, and `{profile}` inside arguments. The processor must write the cutout PNG to `{output}` and should write its execution record to `{record}`. Pass a pinned JSON execution profile with checkpoint/model artifact hashes, engine/runtime versions, backend, precision, inference dimensions, refinement, device, and encoder settings through `--profile`. The harness records the supplied profile separately from the processor's actual record, so supplied metadata alone does not prove it was used.

```sh
benchmarks/.venv/bin/python benchmarks/run.py \
  --manifest benchmarks/corpus/screening.json \
  --profile path/to/pinned-execution-profile.json \
  --command-json '["path/to/actual-processor", "{input}", "{output}", "{record}"]' \
  --output benchmarks/runs/screening-candidate \
  --repeats 3
benchmarks/.venv/bin/python benchmarks/gallery.py --run benchmarks/runs/screening-candidate
```

The command path above is a substitution example, not an installed Superaster command. The integrated CLI invocation must be recorded once its interface freezes. Result directories must be new, so another run cannot silently replace evidence.

Every run saves raw stdout/stderr, complete command time, exit/failure/timeout status, observed process-tree memory, decoded output properties, execution records when emitted, alpha, and white/black/color composites. PNG, dimensions, frame count, nonempty coverage, actual transparency, and preserved inputs are machine checks. Those checks cannot judge whether the intended subject survives. A zero exit without an image fails.

Timing includes a fresh command process for each image, with startup, decode, inference, render, encode, and exit. It excludes a separately installed model download. It is not warm-session throughput. The RSS measurement samples instantaneous Linux process-tree RSS every 20 ms; shared pages may double-count and shorter peaks may be missed. Missing stages stay missing. Median and p95 use linear interpolation at `(n-1)*p` and are descriptive sample statistics. They are not uncertainty bounds or budgets.

Run one heavy inference job until measured resources support more. Freeze input/profile conditions and numerical budgets at G2 before tuning. `evidence/corpus/preparation.json` separates preparatory PASS checks from required NOT RUN evaluations. Keep model-download, cached initialization, warm sessions, batches, and physical Pixel 7 measurements separate. Browser viewport emulation is not phone performance evidence.

`corpus/heldout.json` contains 99 separately selected real images, about 20 per category, including vehicles, groups, low contrast, and reflective/translucent scenes. Selection and input-only visual triage preceded model outputs. Exact canonical source duplicates within that split and overlap with screening are zero. Historical images, repeated photographers, and related object families remain sampling limits. These inputs remain unused for tuning. Their evaluation requires `--acknowledge-heldout`, and their downloads use the same verification command with `--manifest benchmarks/corpus/heldout.json`. Human hidden-label composite review remains required for quality comparisons. Preserve each judgment and review condition. Do not substitute synthetic metrics or AI triage for human ratings. A remove.bg comparison requires matched permitted full-resolution output, with no unauthorized paid credits.

`corpus/model-overlap.json` records pinned candidate model-card hashes and observed dataset statements. The lite card reports DIS-TR training with DIS-TEs/DIS-VD validation; the 512 card reports 512-pixel training and DIS-VD evaluation without a complete training-file inventory. No source-file membership/exclusion hashes establish this corpus as unseen by either checkpoint. Overlap remains UNKNOWN.
