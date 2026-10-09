# Fresh installed package smoke

On 2026-10-09, the native source at `653cf02e32ce9a744ee7a7d22883822520e4cf5c` produced a 354,554-byte npm tarball with SHA-256 `9e6e8bfe7a88ec980c03d59e3cca34b5ecb47edb1a8670a5268a6d2479b2fe73`. Eight tarball audit checks and 35 actual installed CLI/SDK/MCP checks passed; none failed. This is a deterministic, non-inference installation check. It does not award G7 or complete T11/T16.

The build used Linux x86_64 and Node 26.11.1. Native source hashes match the identified commit. The coordinator's concurrent web edits were excluded from this native package. The consumer was new and had its own real `node_modules` directory. No shared dependency directory was reinstalled.

The tarball contains 130 files. All 60 retained notice files match their manifest hashes; all 105 relative documentation links resolve. Original and updated specifications, model weights, caches, environment files and private evidence are excluded. Native relative imports, dependency declarations, entrypoints, schemas and catalog data are present. Every installed package file matches the audited tarball bytes.

Actual native CLI, imported SDK and a new MCP stdio client produced matching white 1200 × 1200 WebP files. The installed executable ran capability discovery. Explicit MCP scratch roots rejected direct and symlink read/write escapes and out-of-root image bindings. Invalid parameters, unsupported operations/engines, corruption, overwrite protection and pre-aborted SDK cancellation returned errors. Catalog discovery, ambiguity and edit policy were exercised without changing pins or fetching source pages.

The additional PNG check used an original synthetic 48 × 32 RGBA fixture with a conspicuous source EXIF sentinel. Its 48 × 48 white canvas result matches all 9,216 expected decoded channel bytes, with zero mismatches. CLI and SDK output hashes match their records. Source EXIF is present, exported source EXIF/XMP/IPTC is absent, and the original bytes are preserved. The fixture and actual outputs are in [outputs](outputs/); they contain no owner photographs and no inferred masks.

`npm install` exited 0 and `npm ls --all --json` exited 0. npm reported that ONNX Runtime and protobufjs install scripts were not covered by `allowScripts`; the warning is retained. Inference was not attempted, so this check does not establish inference installation or offline model behavior. No model artifacts were downloaded or found in the scratch model cache. No publication or deployment occurred.

See [summary](summary.json), [source/consumer identity](consumer-identity.json), [tarball audit](package-audit.json), [installed-file audit](installed-package-audit.json), [check results](consumer-results.json), [actual commands and MCP transcripts](consumer-transcripts.json), and [output inventory](outputs.json).

## Reproduce

Use the identified source commit and an empty consumer. The tarball itself remains local at `.cache/primary-clean-package/superaster-local-0.1.0-alpha.1.tgz` in the checked source worktree. Dependency locks, script hashes and command output are retained here. Repacking after documentation changes can change the tarball hash; identify that new package separately.

```sh
npm run build:native
mkdir /absolute/path/packages
npm pack --json --pack-destination /absolute/path/packages
mkdir /absolute/path/check-evidence
python3 scripts/package-audit.py --package /absolute/path/packages/superaster-local-0.1.0-alpha.1.tgz --output /absolute/path/check-evidence/package-audit.json
mkdir /absolute/path/fresh-consumer
cd /absolute/path/fresh-consumer
printf '%s\n' '{"name":"superaster-clean-consumer","version":"1.0.0","private":true,"type":"module"}' > package.json
ONNXRUNTIME_NODE_INSTALL=skip npm install /absolute/path/packages/superaster-local-0.1.0-alpha.1.tgz --no-audit --no-fund
cp /absolute/path/checkout/evidence/installation/primary-clean-package/consumer-check.mjs .
node consumer-check.mjs /absolute/path/check-evidence --skip-source-monitor
```

Required checks left **NOT RUN**: first model download, cache reuse and offline inference from this installed package; the full T11 removal workflow; physical Pixel 7 and other OS/Node/browser configurations; heldout and human image-quality evaluation; and modified WASM rebuild/replacement acceptance. The deterministic checks cannot substitute for these.
