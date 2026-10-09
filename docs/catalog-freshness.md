# Catalog observations and immutable pins

Every destination retains its original ID, version, rules and reviewed source baseline. A separate validated observation snapshot updates current freshness. The distributed snapshot was collected by the actual installed SDK on 2026-10-09; thirteen unique sources returned four matching raw hashes, four changed hashes and five unknown results. Changed HTML indicates review is needed, not that an official rule changed.

`createCatalog(records, {monitor_results, clock, max_age_ms})` exposes immutable current views. Missing, expired, future or inaccessible observations become unknown. The default observation lifetime is 24 hours, matching the intended daily source check; it is an implementation policy, not a photo-rule or performance tolerance. Unchanged hashes cannot approve an unreviewed record. Existing planners block automatic destination edits while freshness is unresolved; file validation can still report supported properties, visual judgments and separate confirmations.

`resolvePresetStatus(id, version)` returns the selected exact pin and notices. If a separately reviewed newer version exists, the old pin remains accessible and the notice asks for an explicit selection before changing rules. Tests use plainly fictional prospective updates. No actual authority update was invented or published here.

```sh
node --import tsx scripts/monitor-catalog.ts --output .cache/new-source-observations.json
```

The bounded sequential monitor checks each cited source once, up to 8 MiB and 15 seconds per response. The output must be a new file. It never changes rules or approves a pin. The free public-repository Actions workflow runs daily and retains this observation artifact; its execution is still NOT RUN until the source is pushed and Actions completes. A successful job means observations were collected, not that rules passed.

A maintainer inspects changed/unknown sources and reviews applicable authority/channel text. For changed rules, publish a new immutable version while preserving the old record. For unchanged rules but changed HTML, record a newly reviewed version/baseline with evidence rather than rewriting an existing pin. Review and deliberately replace `packages/catalog/data/source-observations.json` when incorporating the actual artifact. New builds distribute it to web, CLI, SDK and MCP; offline clients retain the observation date and eventually show unknown freshness. The website never sends a user's image to these sources.

The snapshot integration and fictional-update tests do not award G6B. Actual source review, browser/version-notice inspection, print-output checks and required release/device evidence remain separate acceptance work.

Pinned Actions inputs were inspected against their official releases on 2026-10-09: [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2). Workflow hashes are the exact commits returned by the primary GitHub API, with read-only repository permissions and no saved checkout credentials.
