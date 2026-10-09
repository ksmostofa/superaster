# CLI argument boundary review

Recorded 2026-10-09 on Linux x86_64, Node 26.11.1. The documented CLI forms and exit meanings in `docs/installation.md` define this review's scope.

Before the fix, real CLI invocations reproduced all three reported failures. `inspect INPUT --definitely-unknown` returned `PROCESSING_FAILED` and exit 4. `inspect INPUT ignored.png` and `inspect INPUT --quality not-a-quality` returned successful inspection JSON and exit 0. The three process regression tests failed against that source.

The cause was global flag parsing without command-specific validation. Node parser errors reached the generic processing-error handler, extra operands were discarded, and flags accepted by other commands were ignored. Binding files were also read before command validation.

The CLI now translates parser failures to `INVALID_INPUT`, checks each command's operands and permitted flags, validates required and nonempty values, rejects repeated singleton flags and conflicting resume/retry flags, and validates every binding's syntax and reference uniqueness before reading any binding file. Invalid requests produce one JSON error on stderr, empty stdout, and exit 2. Quality and Auto defaults still apply to removal. Help skips file reads and required operands, while malformed or inapplicable supplied arguments still fail.

The new suite starts the actual CLI through Node and tsx. It covers the original failures, all command families, malformed and empty values, repeated flags, bindings checked before missing-file reads, inherited object-key command names, help, dash-prefixed filenames, and valid local command forms. Success checks decode real images, execute geometry and composition, verify output hashes, run separate resume/retry batches, and inspect stdout/stderr. No removal inference, model downloads, or fake inference results are used.

Validation passed:

- `npm run build:native`
- `npm run typecheck`
- `npx vitest run tests/cli-boundary.test.ts tests/adapters.test.ts`: 71 tests passed across both files, 94.19 seconds. The existing adapter suite exercised the rebuilt native CLI.
- `git diff --check`

The first full boundary run had one test-fixture error, a colored correction mask. Production correctly rejected it. The final fixture uses real grayscale coverage and passes. These checks establish argument handling and existing local adapter behavior; they do not establish model quality or physical-device support.
