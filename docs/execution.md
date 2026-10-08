# Execution checkpoint

Active specification: private root `superaster-technical-spec.updated.md`, revision 1.2, parent original 2026-10-08 (unchanged). Both private specs are excluded from public Git history; separate local version history lives in `.git/private-spec`.

Current gate: G1 completion review; G2 physical-device and human-quality checks pending. Later implementation is provisional independent preparation, not an awarded gate. No gate has passed.

Repository: https://github.com/ksmostofa/superaster. Integrated main at a19f2bf; source adapters and browser app are being integrated. G1 fresh review at a1ed8ec, fixes at 9a372f5. Initial public commit 950eb66.

Environment: Linux x86_64, Intel i7-8665U, 16 GiB RAM; Node 26.11.1. Actual Pixel 7 access not established. One heavy inference job at a time.

Verified: approved full/Lite model artifact hashes; real native full/Lite outputs; 25 screening + 99 separate heldout photos with rights/hash manifests; contract/native/catalog tests and build baseline. Evidence under research/, benchmarks/, evidence/feasibility/, evidence/corpus/, evidence/reviews/.

Owner decisions: Rare UI retained application terms approved; later vanilla UI remake preference. Owner can provide physical Pixel 7 and human blind review but is away. No phone or human outcome is inferred from that authorization.

Gate status: G1 INCOMPLETE; G2-G7 INCOMPLETE. Required phone, quality judgments, integrated adapter/browser/offline and clean-install checks remain pending. Budgets are unset until prescribed baseline; guard limits are provisional.

Active lanes: coordinator browser/core/integration; engines correctness; independent adapter verification; notices/release preparation. Shared schema/dependencies/lockfile owned by coordinator.

Next: prove real browser route; finish Rare/Animate source integration; run focused SDK/CLI/MCP batches; prepare galleries and device validation; fix evidence-backed failures. Preserve all failed/unrun checks in acceptance ledger.
