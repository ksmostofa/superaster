# Attempt identities and recovery

These are actual browser interactions on sealed production builds, plus decoded output and archive checks. The imaging fixtures are original synthetic correctness inputs, not a photo-quality corpus. Build A/C/E cache names and every served asset hash are in [builds.json](builds.json). The tested E App SHA-256 is `169fac23346df370d3e395179ea00cf24bcc326bac757ffad4c7687d29983f6b`. Later natural-update changes are documented separately.

| Check | Result | Evidence |
| --- | --- | --- |
| Previously open second tab blocks forced update | PASS on old protocol; superseded | [two-tabs-blocked.json](two-tabs-blocked.json) |
| Old tab still exports after that blocked update | PASS on old protocol | [old-tab-output-properties.json](old-tab-output-properties.json) |
| Failed byte-target attempt keeps prior result and its separate hash | PASS | [attempt-properties.json](attempt-properties.json) |
| Missing bound input becomes failed new attempt, with no fabricated resolved hash | PASS | [preflight-error-properties.json](preflight-error-properties.json) |
| Successful WebMCP changed recipe records new result identity | PASS | [final-webmcp-success.json](final-webmcp-success.json) |
| Changed-recipe resume cancellation retains two previous outputs, marks new attempts cancelled | PASS | [changed-cancel-properties.json](changed-cancel-properties.json) |
| Injected worker-error event → real replacement-worker retry/export | PASS within injection scope | [inspection-recovery-properties.json](inspection-recovery-properties.json) |
| Held initial inspection → Cancel → Retry unfinished → two real decoded outputs | PASS within injection scope | [inspection-recovery-properties.json](inspection-recovery-properties.json) |
| Actual physical OOM/crash recovery, cancellation latency | NOT RUN | No physical failure inferred from injection |
| Successful correction provenance on this source snapshot | NOT RUN | Earlier deterministic correction checks are separate |

The error injection dispatched one explicit QA `ErrorEvent` to the real worker while handling `inspect`; its prototype hook restored itself on that request. The inspection-cancel fixture held one outbound inspection request, then used the real Cancel control and abort/termination path. Retry used a newly created worker and the real WASM imaging kernel. Page reload removed temporary hooks and globals. These fixtures were never part of application source or model inference.

Reproduce with [fixture inputs](../../../benchmarks/browser/fixtures): choose `01/same.png` and `02/same.png`, apply white composition plus width 120 and PNG/strip, then process. Add `19/same.png` for a deliberate invalid-input failure. The actual archives are in [exports](exports/); they preserve PNGs, execution records and attempt manifests. Change width to 60 for a successful WebMCP rerun; set `max_bytes:1` for a byte-target failure; request a composite `image_ref` without selecting its bound file for preflight failure; change to a 2800×2800 white canvas and cancel Resume & verify for changed-work cancellation. Do not substitute old output identity for the failed/cancelled attempted identity.

[Source-derived output properties](source-derived-output-properties.json) record a real 1200×800 geometry/export operation on an imported cutout from the separately identified offline general-matting diagnostic. This was **not browser model inference**. All seven checked output properties pass. Desktop/mobile screenshots show that result in the actual editor; mobile is browser emulation, not Pixel 7 evidence. The photograph is public domain by Walton LaVonda, U.S. Fish and Wildlife Service, [source page](https://commons.wikimedia.org/wiki/File:A_group_of_people_stand_birdwatching.jpg). Technical benchmark use only; no endorsement/identity-consent or brand-advertising claim.

No G2-G7 gate, numerical tolerance, human quality result, phone result or competitor comparison is awarded here.
