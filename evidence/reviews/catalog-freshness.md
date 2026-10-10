# Catalog freshness continuation review

Recorded 2026-10-09 at 06:12 UTC, Node 26.11.1 on Linux x86_64. This continuation finished the existing dirty catalog registry and tests rather than recreating them.

Production previously constructed the default catalog without monitoring observations. The separate registry could report changed sources, but ordinary consumers still received the original verified claim. The default catalog now loads the saved October 9 snapshot. Planning, preparation and validation refresh retained records at use time, including after the 24-hour observation limit. Changed sources block editing pending review; failed retrievals and missing baselines report unknown freshness. Validation continues to report the pinned rules with explicit freshness and newer-version notices.

`packages/catalog/data/source-status.json` contains the exact 13 source-monitor results from the installed-SDK evidence at `evidence/installation/continuation/source-monitor.json`, completed at `2026-10-09T04:08:01.781Z`. At that time the 20 published profiles resolve to 10 needing review, 9 unknown and 1 verified. Shared citations are checked against each profile's immutable baseline. A changed raw hash does not establish a changed authority rule. No new authority version was published, no baseline was replaced, and neither `presets.json` nor `source-retrievals.json` changed.

`resolvePresetStatus(query, version)` returns `{ preset, notices }` for UI display and execution warnings. Default list, resolve, history, plan, prepare and validation consumers use the same snapshot. Fictional fixture versions test explicit newer-version notices while preserving an old pin and its rule values. They are absent from production data. Snapshot parsing rejects unknown fields, invalid calendar dates, inconsistent checks, uncited sources, unknown origin pins and conflicting same-time observations.

The manual `scripts/catalog-monitor.ts` command can perform bounded sequential source checks or import existing installed-SDK evidence without another network request. It preserves imported dates and refuses output replacement. It creates no scheduler. Its import mode reproduced the saved snapshot and the same status counts.

Validation passed:

- `npm run typecheck`
- `npm run build:native`
- `npx vitest run tests/catalog-freshness.test.ts tests/catalog.test.ts tests/catalog-monitor.test.ts`: 19 tests across 3 files, 4.03 seconds.
- A direct compiled-catalog resolution returned the exact UK `2026-10-08.1` pin with `needs_review` and a source-freshness notice.
- `git diff --check`; immutable production rule and retrieval files have no diff.

The existing rule-semantic tests now use an explicit unmonitored registry to isolate their rule assertions. Separate production-consumer tests cover the persisted observations, current blockers and expiry. A test initially assumed A4 print freshness was verified; actual evidence includes a failed shared policy citation, so the final test correctly expects print freshness to remain unknown.

App, SDK exports and core execution-warning integration belong to the coordinator. Catalog tests do not claim new official approvals, human quality acceptance, physical-device support or complete release readiness.
