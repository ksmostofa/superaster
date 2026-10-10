# Quality evaluation handoff

No human ratings, physical Pixel 7 result or matched full-resolution remove.bg comparison is implied by this document. Those required checks remain NOT RUN until a real reviewer supplies the specified evidence. Existing native screening outputs at `evidence/benchmarks/screening-quality-d21946e/` pass artifact validity on 25 cases. Fast at `evidence/benchmarks/screening-fast-40d2c57/` passes 24 cases and fails retained-pixel validity on `thin-plant`, whose mask is empty. Preserve that failure; do not relabel it as a usable cutout or weaken its assertion. These runs use one persistent NativeEngine per profile and exclude evidence-composite/file-write time from their recorded elapsed scope. They do not establish subject quality, complete fresh-command export time, a winning release profile or superiority.

Use the full [human composite review protocol](../benchmarks/review-protocol.md), [corpus reproduction guide](../benchmarks/README.md) and [artifact pins](../research/artifacts.json). This handoff adds the integrated CLI invocation and a finite release review sequence. No new scoring threshold is introduced.

## Inputs and frozen conditions

The screening split has 25 real photos, five each of people, products, animals, thin structures and difficult materials. Its manifest declares retained subjects and edge challenges. The separate release split has 99 images, 20 per category except 19 products, and broadens groups, vehicles, low contrast and reflective/translucent cases. Canonical exact-source overlap between splits is zero. Repeated photographers, related object families and historical photos limit diversity. Evaluation inputs are bounded published renditions normalized to a maximum 1280-pixel edge; they do not establish full-camera-resolution quality. T01's separate real 2400×1600 fixture tests output geometry and workflow.

The manifest retains original/source hashes, rights, credit and derivative changes. Preserve originals. Mixed CC BY, CC0 and public-domain images retain their individual terms; they are not all CC0 or Apache-2.0. No real-image alpha ground truth is supplied. [model-overlap.json](../benchmarks/corpus/model-overlap.json) records checkpoint cards and their incomplete training-file descriptions. Corpus/checkpoint training overlap remains UNKNOWN.

Before tuning, identify and freeze profile IDs, checkpoint/export hashes, runtime/backend, precision, inference dimensions, preprocessing, refinement/edge cleanup, final dimensions, encoder/color/metadata settings, hardware, test order, repeat count and numerical acceptance budgets. [budgets.json](../benchmarks/budgets.json) currently records NOT FROZEN with null values. Missing baseline/device evidence prevents that freeze. Do not turn provisional memory/pixel guards into measured acceptance or move thresholds after an unfavorable result.

Keep deterministic synthetic fixture correctness separate from real-photo quality. A synthetic alpha ramp supplies exact composition answers; it does not score whisker, glass or group retention. A model-produced mask cannot become its own ground truth.

## Execute the pinned candidate

Prepare and verify the corpus with the commands in the benchmark guide. Build the exact integrated version and install its approved model into the recorded cache. Save a JSON profile containing the frozen conditions above. The supplied profile is a declaration; compare it against every actual processor execution record.

This example runs the current Quality CLI through the harness. Run one heavy inference job at a time. Use new output directories and absolute CLI/cache paths.

```sh
benchmarks/.venv/bin/python benchmarks/run.py \
  --manifest benchmarks/corpus/screening.json \
  --profile /absolute/path/quality-profile.json \
  --command-json '["node","/absolute/path/superaster/dist/native/cli/src/index.js","remove","{input}","--output","{output}","--quality","quality","--engine","birefnet-512-fp16","--model-dir","/absolute/path/model-cache"]' \
  --output benchmarks/runs/screening-quality \
  --repeats 3
benchmarks/.venv/bin/python benchmarks/gallery.py --run benchmarks/runs/screening-quality
```

The CLI saves `{output}.json`; the harness retains that execution record through its sidecar fallback. Its command process starts anew for each image. Time therefore includes CLI startup/decode/inference/render/encode/exit and excludes an already completed separate model download. This is not same-session warm throughput. Sampled Linux process-tree RSS is descriptive and may miss peaks or double-count shared pages. Use actual records and distinct device runs for stages, warm sessions, transfer and phone memory.

For Fast, use a separate frozen profile and new output directory, `--quality fast` and `--engine birefnet-lite-512-fp16`. For T19 before/after cleanup, use two actual recipe files through `run` and name the refinement change explicitly. Evaluate automatic outputs before brush correction; corrected outputs belong to T05 evidence and cannot improve automatic scores.

Machine checks retain exit/failure/timeout status, unchanged source hashes, actual decoded PNG/frame/dimension/alpha properties, raw logs, masks and white/black/#2c7696 composites. Record an empty/missing output or fully opaque/empty foreground as a failure. These checks cannot judge whether the intended subject survived.

## Human review

Prepare equal-sized paired composites from the uncorrected outputs. Randomize A/B independently per case from a recorded seed. A coordinator keeps the label key hidden until the reviewer saves all judgments. Keep case order, intended retained subject, display/browser, viewing scale, review date and participant identifier. Whole-image and equal-scale zoom inspection are permitted. Record whether the source is visible; source-visible comparison can identify missing content but does not provide alpha ground truth.

For each case and anonymous label, record `none`, `minor`, `material` or `uncertain` for missing intended subject, retained background, halo/color contamination and fine-edge loss. Record A wins/B wins/tie/uncertain with a concrete reason. These are descriptive anchors from the existing protocol. Apply separately frozen category acceptance thresholds; do not derive those thresholds from the judgments.

Retain raw judgments and the revealed label key alongside input/profile hashes, result files and review conditions. Report counts by category, material failures, uncertain judgments, sample size and paired wins/losses/ties. Preserve missing outputs and failed cases in the report. AI visual triage can locate defects for inspection; it cannot replace the human acceptance ratings or a fresh reviewer's reproduction.

## Held-out release and comparator

Once screening decisions and thresholds are frozen, evaluate the 99-image held-out split with the same method and `--acknowledge-heldout`. For example, change the harness manifest to `benchmarks/corpus/heldout.json`, append that acknowledgement and use a new output directory. Do not use those outputs to tune the named candidate and still describe the same evaluation as held out. A changed candidate requires an honest new evaluation plan and provenance.

Matched remove.bg comparison requires permitted full-resolution outputs at the same final dimensions, the recorded request/quality/settings and whole processing-path times. Donated suitable outputs can unblock it without charges. A free preview, resized result, unavailable legacy ZIP reconstruction or unrecorded total latency cannot establish a fair full-resolution comparison. Do not purchase credits under the $0 constraint or send corpus images to a provider without explicit authorization. Keep this comparison NOT RUN when the needed outputs or timings are missing.

A public "better than remove.bg" claim requires the specification's predeclared overall paired wins greater than losses, no increased material failures in declared core categories, and competitive median/p95 complete time on the advertised route. Report sample size and uncertainty. Missing comparator evidence prevents that claim; local usefulness can be evaluated and reported on its actual narrower evidence.

## Gate evidence

Keep one acceptance table under the identified release evidence, with spec revision, commit, input versions, environment, reproduction commands, actual outputs and PASS/FAIL/NOT RUN for each required item. G2 requires the 25-image masks/composites and actual laptop/phone route evidence. T19/G4 requires automatic before/after category judgments and cost without unrelated regression. G7 requires the declared held-out evaluation and fresh review on advertised configurations. Refer to [device-validation.md](device-validation.md) for phone measurements and [installation.md](installation.md) for clean installation.

The smallest outstanding inputs are a physical Pixel 7 with authorized Chrome/USB access, a human reviewer for hidden-label composites, and suitable authorized comparator outputs/timings if superiority is to be claimed. Continue deterministic conformance, UI inspection, package and privacy checks independently. Keep any required unavailable check incomplete.
