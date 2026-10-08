# Independent SDK, CLI and MCP verification

Reviewed 2026-10-09 JST against active specification revision 1.1. The private active specification was read in the preceding review and its unchanged SHA-256 was rechecked: `7617a90ffca7feb05b42caea112213a098aa13e83cfcf0eb89e90a1177c9cfcf`. No applicable AGENTS.md was present. No model download, inference job, paid service or external image transfer was requested by this lane.

Tests are committed as `8e9c1586d4e15c0230bc41ceb5fd78159df64345` on branch `verification-adapters`. Worktree: `/home/sadid/Downloads/Superaster/superaster-verification-adapters`. Base: `a19f2bf31b1e423d6f8ebbb7608eca4e36c515b1`. SDK/CLI/MCP and the coordinator's shared binding-hash helper were copied from main as pinned verification inputs. They were not edited or committed by this reviewer. Root dependencies/lockfiles were not changed. Existing installed dependencies were linked into the isolated worktree, so this is not a fresh-install result.

Result: all 19 deterministic adapter tests pass across two focused runs, with real files, compiled native CLI, SDK kernels and fresh MCP stdio clients. Required inference, browser, packaging and device checks remain separate. No G gate is awarded here.

## Acceptance

| Required behavior | Result | Actual evidence |
| --- | --- | --- |
| T08, native CLI, 20 inputs including one corrupt input | PASS | Nineteen decoded correct outputs, one attributable INVALID_INPUT, partial exit 5. Repairing the corrupt input and `--retry` produces 20 outputs. The other 19 output hashes and nanosecond modification times remain unchanged. |
| T09, native CLI/SKD cancel and resume | PASS for deterministic native route | Actual SIGINT after three completion events leaves three completed outputs and 17 CANCELLED entries. Resume produces all 20 outputs and retains the three completed files byte-for-byte and without rewriting. SDK AbortSignal separately retains two completions and marks four unscheduled entries CANCELLED. |
| T09, identity and stale output | PASS for tested identities | Matching work is skipped; changed source content and changed recipe rerun; a damaged output is replaced from verified prior provenance. Bound-mask content changes recipe identity and output; unchanged bound-mask work is skipped. |
| T10, native source-relative names/collisions/backpressure | PASS | Identical basenames in folders `a`/`b` have distinct correctly decoded outputs. Case-fold collisions fail before output-directory creation. Four concurrent SDK calls observe maximum one active transform, matching the declared limit. |
| T10, web ZIP/individual-download limits and measured memory under supported large-image batches | NOT RUN | This lane exercised the native deterministic route. It does not establish browser archive behavior or a measured peak-memory support ceiling. Full T10 remains incomplete. |
| T11, fresh actual MCP client discovery/inspect/transform/validate | PASS for deterministic steps | Each test starts the compiled CLI's local stdio server and completes MCP initialize/listTools/callTool. It produces a 1200x1200 opaque white WebP, accessible file/resource refs, execution sidecar and actual catalog rule outcomes. No image bytes are inserted into tool text responses. |
| T11, removal step and fresh installation | NOT RUN | Heavy inference was explicitly withheld for this lane. Calling actual removal with installed approved weights and clean package/client setup remains required before full T11 or G6A can pass. |
| SDK/CLI/MCP binding conformance | PASS | A real grayscale mask and supplied background produce identical PNG output hashes and recipe identities across all three adapters. Decoded expected pixel is `[38,45,118,255]`. Each MCP bound path is guarded; an outside-root mask symlink fails ACCESS_DENIED without output. |
| Agent file-access boundary | PASS after coordinator fixes | Root-prefix siblings, direct read/write symlink escapes, and nested batch output-directory symlinks are denied. No outside output is created after the fix. |
| External boundary errors | PASS after coordinator fixes | Malformed recipe JSON fails INVALID_RECIPE/exit 2 without output. Invalid resume manifest fails INVALID_INPUT/exit 2 and remains unchanged. Unsupported operations and unknown MCP tool parameters fail without a successful no-op or output. Declared ambiguous alias `Japan visa` returns AMBIGUOUS_PRESET before editing. |
| Original/pre-existing file protection | PASS after coordinator fixes | Input hashes remain unchanged. Ordinary SDK writes protect original/pre-existing outputs. A first batch collision followed by `--retry` cannot claim ownership or overwrite a pre-existing user output. |
| SDK destination API | PASS after coordinator fix | `resolvePreset` and `validate` are exported with the processing API. |
| Integrated public release, offline/model cache, actual phone, browser/WebMCP, cross-runtime tolerance, quality/performance | NOT RUN | These checks require their respective gates and environments. Deterministic image fixtures do not substitute for real inference or physical-device evidence. |

## Failures found and fixed

The coordinator made the production fixes. The reviewer retained the red baseline and tested the changed copies.

| Baseline defect | Reproduced failure | Corrected observation |
| --- | --- | --- |
| MCP guards only batch output directory | A nested output symlink wrote an image outside the authorized root and returned completed status | Per-item/sidecar/manifest paths and existing ancestors are checked; ACCESS_DENIED and no outside file |
| Failed collision claims ownership | Initial EEXIST preserved a user output; `--retry` then overwrote it without overwrite authorization | Output and sidecar ownership require independent provenance; retry remains partial exit 5 and protects the prior bytes |
| Zod tool shapes strip unknown parameters | An unrecognized transform parameter was silently dropped and an output written | Strict tool schemas reject the request and create no output |
| Malformed recipe JSON classified as processing failure | PROCESSING_FAILED/exit 4 | INVALID_RECIPE/exit 2 |
| Invalid resume entry not validated | `entries:[null]` caused a per-item TypeError, partial exit 5, and replaced the invalid manifest | Boundary rejection before processing, INVALID_INPUT/exit 2, manifest unchanged |
| Batch ignores bound-input identity | Unchanged bound-mask work was unnecessarily rewritten because manifest and record hashes disagreed | Shared referenced-binding hashes govern both identities and resume |
| SDK omits destination functions | Missing runtime exports | Required functions are exported |

The first harness run also had two incorrect fixture queries and used Vitest's unsuitable five-second default for multi-process batch checks. Those were harness defects, not product failures. The corrected harness uses the actual immutable ID `shopify-product-square`, declared ambiguous alias `Japan visa`, 30-second per-test timeout and 30-second child-process bound. It keeps all product assertions. Baselines remain available.

## Outputs and decoded checks

Original deterministic fixtures are generated in the test by Sharp 0.35.5 from explicit dimensions/RGBA colors. They are real encoded PNG files through the production pipeline. No model or mocked inference result is injected. Their purpose is geometry, pixels, identities and errors, not removal quality.

PNG outputs are decoded independently with Sharp. Tests check actual dimensions, PNG format, one frame, full opacity, stripped EXIF, retained sRGB ICC, white padding, exact center color, source preservation and output hashes. The WebP check decodes the 1200x1200 result and observes white `[255,255,255,255]` padding and center `[120,31,200,255]`. The predeclared three-level channel bound is a uniform-color lossy fixture check, not a frozen cross-runtime release tolerance.

Representative stable bytes:

| Artifact | SHA-256 |
| --- | --- |
| 16x12 RGBA source PNG, RGB 120/30/200 | `da571471e8c8671f1197ec67aec5de457b842df9f52a3a7123affd924ff5e85f` |
| 24x24 white contain PNG | `d011f7852ade1dc8254eac2a404a30134db67acf22e8533c96428443b6b5d58c` |
| 1200x1200 white contain WebP | `e145d0912a3bbea331d9e5b0686db0745fe8e03013319e4e677b4a8475fe80d4` |
| Mask/background conformance PNG | `8b1e04561c1b06f305371f061d3eebc432c94c4b30e9c319c687a78abf0c95ae` |
| Protected pre-existing output, unchanged after fixed retry | `7e7b01a5d529dd07bd04e3e039b8083cac1affd909edba0e1ab35a3e568bf72d` |

Raw commands/stdout/stderr, manifests, input/output hashes, nanosecond modification times, MCP request results and exported files are retained under the worktree's ignored `.cache/` directory. Every test run has a new directory; prior results were not replaced.

| Run | Local retained evidence | Result |
| --- | --- | --- |
| Corrected harness against original adapters | `.cache/adapters-corrected-harness-baseline.json`, `.cache/adapter-verification-W6DIxE/` | Three production defects reproduced; four selected checks passed |
| Additional boundary/binding baseline | `.cache/adapters-additional-baseline.json`, `.cache/adapter-verification-nHcEc9/` | Three defects reproduced; concurrency check passed |
| Collision ownership baseline | `.cache/adapters-ownership-baseline.json`, `.cache/adapter-verification-Ii0EQd/` | User output overwritten by retry, FAIL preserved |
| Corrected MCP/binding tests | `.cache/adapters-mcp-fixed.json`, `.cache/adapter-verification-czIg5P/` | Five selected tests PASS, 10.18 seconds |
| Corrected SDK/CLI/batch tests | `.cache/adapters-sdk-cli-fixed.json`, `.cache/adapter-verification-I1UKwU/` | Fourteen selected tests PASS, 37.25 seconds |

Final result-report hashes: MCP JSON `1bc72ea356fa224c429d1de6988867f02e650554010513b5575da4925e9ec3a7`; SDK/CLI JSON `b239cbf0f82373567ed91aa43f26478f42e21a0e274d5f4883fb3e6715a49da6`.

## Exact tested inputs and environment

Linux x86_64, Node 26.11.1. Actual installed packages: Sharp 0.35.5, ONNX Runtime Node 1.30.0, MCP SDK 1.32.1, Zod 4.6.5, Effect 4.0.2, Ajv 8.20.0, TypeScript 7.0.2, tsx 4.23.15 and Vitest 5.0.3. Importing the engine did not initiate model installation; no removal operation appears in the executed recipes.

The original adapter-copy hashes were SDK `1e5bfb9a2c5cacd6dff50473da19a891a0f5cb5dba423e97b85b5c94626da9ba`, CLI index `f2cef9488cd7309d2596497d83fc792eca337ef126e90b18e996da7240d89c44`, CLI batch `c62f02746d9f808593dd00f38d307cae1065b30334e427a232d42e6bff0f68eb`, MCP `3de39d9261fa1540ebd4421358aa52df02e07f2be7a4af35a04a40792d8472ca`.

Final copied source identities:

| Path | SHA-256 |
| --- | --- |
| `packages/sdk/src/index.ts` | `3c364bc8541acf7f597a4b9814495652b5bf6a92d913bb576dcd4b44f1dfc7db` |
| `packages/sdk/src/files.ts` | `41454675683e660e9b32efb89edd2680b7fa9e558a463ea54ee38cbe2b9a186d` |
| `packages/cli/src/index.ts` | `ea08d6fc260e6f0e122e84cc4a764cd3232bf96ef350fcc7b4f0189d653e2f10` |
| `packages/cli/src/batch.ts` | `f55c7ad02c7c6dde9c2a59ac418c1176b8a72553b13fce558ff898de9ce4f59c` |
| `packages/mcp/src/index.ts` | `c22672776d9a136cca3be1ddbb52edfba3cbbb23330498f5b32c0060e7a1b52e` |
| `packages/core/src/index.ts` | `420eda18326016336a19f47009ae2df0a70c1b0e23bae0c8b6e43393dd4646d1` |
| `tests/adapters.test.ts` | `cd63c726c2a90abb813457c1019a1a3347caa807313203ff26020e76dda06355` |

MCP's five tests ran before the final ownership refinement in `sdk/src/files.ts`; that refinement was then covered by the fourteen SDK/CLI tests, including the collision regression, positive resume and stale-output repair. MCP's nested-root preflight path was unchanged. The coordinator must integrate and verify any later changes before using these observations for a gate result.

## Reproduction and remaining work

On an integrated checkout containing the tested inputs and test commit, use the reproducible locked dependency installation, then:

```sh
npm run build:native
node_modules/.bin/tsc --noEmit
node_modules/.bin/vitest run tests/adapters.test.ts
```

The test starts actual CLI processes and actual MCP stdio servers automatically. Its output prints the new local evidence directory. The native build is a prerequisite because acceptance invokes `dist/native/cli/src/index.js`, rather than a simulated CLI function. On the isolated reviewed copy, native compilation and TypeScript no-emit checks both passed.

Remaining: integrate the coordinator's final adapter/core/schema changes; validate any changed boundary; run actual approved-model removal through the SDK, CLI and MCP without parallel heavy jobs; complete browser archive/resource evidence, clean installation and the required support matrix. The malformed-manifest regression proves rejection of that case but does not award completeness to a pending full manifest schema. No inference latency, mask quality, offline support or physical-phone claim follows from these deterministic results.
