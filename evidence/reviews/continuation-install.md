# Continuation installation review

The fresh local package install and all 34 installed CLI/SDK/MCP checks PASS. Package document links FAIL with ten missing secondary targets. This is finite native installation evidence, not a G6A, G6B or G7 award. Model first/cached/offline inference, full installed T11 removal, other advertised configurations and release/source gates remain NOT RUN here.

Checked 2026-10-09T04:12:24.876367+00:00. Application/source files were read only in this lane. No model weights were downloaded, heavyweight removal repeated, package published, privilege changed, source pushed, or scheduled task created.

## Candidate identity and reproduction

| Item | Actual identity |
| --- | --- |
| Source | `9f803234ff4062d54a0829f55cd69bde18adc404` plus the exact dirty source hashes in [package-audit.json](../installation/continuation/package-audit.json) |
| Private specification | Revision 1.3, SHA-256 `e5f828d0a6d62d0b92a79b0f440c0528a4200ef4c469aa19fb514afe17a967a1`; contents absent from public package/history |
| Environment | `Linux-7.2.5-3-omarchy-x86_64-with-glibc2.44`, Node `v26.11.1`, npm `11.20.0` |
| Tarball | `/tmp/superaster-continuation-install-vk6mu5z5/release/superaster-local-0.1.0-alpha.1.tgz` |
| Tarball SHA-256 | `bd3fa5396a06a6c8321006900e8b7d27f81bbfacebcc616f18c33b8449e8b0eb` |
| Contents | 115 files, 241,116 compressed bytes |
| Empty consumer | `/tmp/superaster-continuation-install-vk6mu5z5/consumer` |
| Install | `ONNXRUNTIME_NODE_INSTALL=skip npm install TARBALL --no-audit --no-fund`, exit 0; 149 installed dependencies |
| Dependency tree | `npm ls --all --json`, exit 0; retained tree and consumer lockfile |

The prepared [bootstrap](../installation/continuation/prepare-consumer.py) creates a new empty consumer, packs the current built candidate and verifies every installed package file against the actual tarball. Copy/run [consumer-check.mjs](../installation/continuation/consumer-check.mjs) from that consumer to resolve imports from its installed `node_modules`, passing the absolute evidence directory. The report originally retained the tarball, outputs and execution sidecars in the identified temporary directory. On the later documentation-closure pass, that temporary directory was absent. The committed file inventories, consumer lockfile, command transcripts, decoded property records and result JSON remain available under `evidence/installation/continuation`; the missing temporary binaries cannot be reopened without reproduction. This limitation does not rewrite the observed install results.

Current npm settings skipped unapproved `onnxruntime-node` and `protobufjs` postinstall scripts, as captured in `npm-install.stderr`. Do not describe the ONNX optional-download installer as observed running, or infer CPU inference setup from geometry/import success. No npm-script approval was changed. Installation used the inherited npm cache; it is a fresh project, not a cold dependency-download measurement.

## Actual installed checks

| Scope | Result and evidence |
| --- | --- |
| Package/native closure | PASS. Apache root LICENSE, full notice manifest including IJG README, native relative imports/runtime dependencies, schemas and twenty destination IDs present. All 115 installed files match tarball hashes. |
| Private exclusion | PASS. No technical specifications, private evidence/cache or Git internals in tarball; prior tracked/reachable public-history audit also finds no specification objects. |
| Real CLI entrypoint | PASS. Actual `node_modules/.bin/superaster` executes and returns native capabilities; help, inspection and structured stdout/stderr work. |
| CLI boundaries | PASS. Unknown flags, extra positionals and invalid/inapplicable parameters return invalid-input exit 2. Unsupported engine returns exit 3 before processing; unknown operation/recipe property fails explicitly. Corrupt input and an existing output fail. |
| Geometry across interfaces | PASS. A generated real 48×32 RGBA PNG produces actual opaque-white 1200×1200 WebP through installed CLI, SDK and stdio MCP. All three encoded-byte hashes are identical: `d89e98cf7006c3b1c17496fffa1bbee613c5d79e90a0c9d0ee18fef384941cbc`. Decoded corner is `[255,255,255,255]`. Standard sRGB ICC remains; EXIF/XMP/IPTC are absent. These are imaging-kernel records, with no removal/inference claim. |
| Programmatic correction/cancel | PASS. Actual erase alpha is 0 and restored alpha 255; a mask returns. Pre-aborted SDK execution reports `CANCELLED`. This is not an in-flight inference cancellation proof. |
| MCP restrictions | PASS. Seven real tools discovered; returned output/resource/record paths are accessible. Outside-root read/write, symlink read/write and bound-input escapes return `ACCESS_DENIED`. Unknown request properties and unsupported operations/engines fail. |
| Catalog consumers | PASS within scope. Immutable ISA pin resolves, shipped shared alias `japan visa` returns material ambiguity, UK unaltered profile rejects re-encoding, and real output validation returns per-rule results. No official acceptance is inferred. |
| Original preservation | PASS. Input SHA-256 remains `f0416c5782a061758c53cf150482aa4a791768785b11cf12d99d00a7277cd3ee`. |

Raw requests/results, actual output metadata and source hashes are in [consumer-transcripts.json](../installation/continuation/consumer-transcripts.json), [consumer-results.json](../installation/continuation/consumer-results.json), [installed-package-audit.json](../installation/continuation/installed-package-audit.json) and [dependency-tree.json](../installation/continuation/dependency-tree.json).

## Verifier corrections

Initial runner results retain 32 PASS and two verifier FAIL in `consumer-results.initial.json` and the original log/transcripts. The first assertion incorrectly prohibited the standard sRGB ICC explicitly retained by `docs/contract.md`. The second used unlisted `Japan visa photo`; that request correctly returned `PRESET_NOT_FOUND`. The shipped overlapping alias is `japan visa`.

The [focused correction](../installation/continuation/consumer-correction.json) reads the unchanged real output and calls the installed resolver with the documented shared alias. Both corrected checks PASS, yielding 34/34. No production source, tolerance, image transform, package installation, source fetch or inference was repeated to obtain this result.

## Freshness and release limits

The installed SDK's actual bounded `monitorSources` fetches checked thirteen unique sources. Four return `verified` because raw bytes match their reviewed baselines, four `needs_review` because raw hashes differ, and five `unknown` because access failed or no reviewed raw baseline exists. Changed HTML is a review signal, not proof that authoritative rules changed. Details, hashes, exact URLs and reasons are in [source-monitor.json](../installation/continuation/source-monitor.json). No pin was mutated or new authority version approved by this lane. Current catalog propagation/version-notice integration remains root-owned work; this native function result does not award T15.

The earlier source-compliance report documents five retrieved archives and eleven checks on an identical external-loaded runtime. That copy test is not a source rebuild, declared modified-library test or served-browser/service-worker recombination. Complete source/build closure, those source/replacement checks, physical Pixel 7, human acceptance, heldout evaluation and comparison gates retain their existing incomplete status. No Docker privilege change or additional source build occurred here.

## New package blocker

[package-audit.json](../installation/continuation/package-audit.json) records ten relative Markdown links that do not exist in the actual tarball. Nine are newly introduced by including `native-screening-baseline.md`: its full JSON report, Quality/Fast conditions/results, failed measurement, alpha and white composites. The tenth is `research/runtime-source-compliance.md` linking to `scripts/source-verification.mjs`.

Include permitted linked files, provide reachable pinned external references, or identify retained local-only artifacts in plain text. Keep the real evidence and source/notice directions available without claiming binary/source gates passed. Repack after this documentation change and verify the final installed files. Passed native execution checks should repeat only if compiled native bytes or runtime dependency resolution changes.
