# Human composite review protocol

Freeze the compared profiles and acceptance limits before tuning. Each case specifies its intended retained subject before inference. Do not count manual corrections in automatic quality scores. Keep screening and held-out images separate, and record every failure rather than dropping hard cases.

For a paired comparison, show the same input, final pixel dimensions, and white/black/color backgrounds. Randomize the two candidate labels independently by case from a recorded seed. Keep the label-to-profile key hidden from the reviewer until judgments are recorded. The reviewer can inspect whole-image views and equal-size zoom crops. Record browser/display, viewing scale, review date, participant identifier, and whether the source was visible. A source-visible review can identify missing content; it is not equivalent to alpha ground truth.

For each label record missing intended subject, retained background, halo/color contamination, and fine-edge loss. Use these descriptive categories:

| Code | Meaning |
| --- | --- |
| none | No visible failure under the stated conditions |
| minor | Visible with inspection; the stated workflow remains usable |
| material | Visible failure that prevents the stated workflow without correction |
| uncertain | The reviewer cannot establish the result |

Then record A wins, B wins, tie, or uncertain and a concrete reason. These categories define a recording method, not a numerical release threshold. Budgets and category acceptance remain separate G2 decisions.

Preserve raw judgments and hidden-label key. Report wins/losses/ties, category counts, material failures, uncertain judgments, and sample size. A suitable ground-truth alpha can enable explicitly named segmentation metrics; a model-generated mask, subjective cutout, or synthetic fixture cannot become real-image alpha truth. Missing comparator outputs, human reviewers, or physical hardware remain NOT RUN. Public quality/speed claims must match the completed evaluation.
