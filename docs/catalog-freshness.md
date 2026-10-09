# Catalog source freshness

Published preset rules, edit policies, citations and version pins are immutable. The separate `packages/catalog/data/source-status.json` snapshot records observed source bytes and failed retrievals. It does not approve a new rule or change a pin. Its October 9, 2026 observations come from the actual installed-SDK checks retained in `evidence/installation/continuation/source-monitor.json`.

The default catalog loads that snapshot for `listPresets`, `resolvePreset` and `resolvePresetStatus`. Chooser defaults still select the latest maintainer-reviewed rule version. Each selected record separately reports `verified`, `needs_review` or `unknown` source freshness. A changed raw page needs maintainer review, because byte changes can include irrelevant page content. Failed access, missing baselines, missing checks, future dates and observations older than 24 hours report unknown freshness. This snapshot does not guarantee current authority requirements.

`planPreset` and `preparePreset` block editing when source freshness requires review or is unknown. `validate` still evaluates the pinned rules and reports a source-freshness review outcome. Both recheck a retained catalog record at use time, so an old object cannot keep a now-expired observation verified. No rule values are silently replaced.

Use `resolvePresetStatus(id, version)` when displaying a selected pin or recording execution warnings. It returns `{ preset, notices }`. Notices include the freshness reason and, when a genuinely reviewed newer version exists, an explicit newer-version notice. The old pin and its rules remain selected. Validation also reports a newer-version notice. Current production data contains no newly invented authority update; prospective versions appear only in fictional tests.

## Manual checks

From a source checkout, run this command when you explicitly want to refresh source observations. It checks each cited URL once, sequentially, with a 15-second default timeout and an 8 MiB per-source byte ceiling. `--timeout-ms` permits an integer from 1 to 60000. The repository workflow runs only when manually dispatched. No scheduled check or background follow-up is configured.

```sh
node --import tsx scripts/catalog-monitor.ts --output packages/catalog/data/source-status.next.json
```

To turn existing installed-SDK evidence into the same validated snapshot without another network check:

```sh
node --import tsx scripts/catalog-monitor.ts --from evidence/installation/continuation/source-monitor.json --output packages/catalog/data/source-status.next.json
```

The command refuses to overwrite an existing output. It preserves imported observation timestamps, checks all origin pins and baseline comparisons, and reports preset status counts on stdout. Review the new file and its evidence, then replace `source-status.json` deliberately and rebuild. Keep the dated evidence. Do not change a reviewed baseline merely to remove a changed-source warning.

For a real rule change, a maintainer must review authority guidance and publish a new immutable rule version with its evidence. A successful retrieval, an unchanged hash, or this command cannot approve that update. Rule-only development can use an explicit `createCatalog(records)` registry; supply `monitor_results` when testing or using monitored freshness. Production exports use the persisted snapshot by default.
