# Superaster

Local background removal and exact image preparation for people, developers and agents. The web app, CLI, SDK and local MCP server share one validated operation contract. Images stay on your device, originals are preserved, and supported exports have no watermark or paywall.

This is an **unreleased local alpha**. G1 research passed independent review; G2–G7 are incomplete. Real inference works, but the current models lose intended subjects in some group and plant photographs. Physical Pixel 7 tests, human blind quality review, frozen support budgets, heldout evaluation and final release checks remain pending. See [execution checkpoint](docs/execution.md) and [actual measurements](evidence/benchmarks/native-screening-baseline.md). File-property checks do not establish image quality.

## Run locally

Tested development environment: Linux x86_64, Node 26.11.1. Node 22 or newer is declared; other platforms/versions still require validation.

```sh
git clone https://github.com/ksmostofa/superaster.git
cd superaster
ONNXRUNTIME_NODE_INSTALL=skip npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:5180/remove`. Choose a JPEG, PNG or WebP. Prepare an approved model in the app, or import its exact verified `.onnx` artifact. Model downloads are separate from image processing. The production build requires the documented COOP/COEP headers; the local preview supplies them. Model/app/runtime setup must succeed before offline processing. The browser's current guards are provisional, not a supported-device promise.

For native processing:

```sh
node dist/native/cli/src/index.js capabilities
node dist/native/cli/src/index.js models install birefnet-512-fp16
node dist/native/cli/src/index.js remove input.jpg --output cutout.png
```

Fast is explicit: `--quality fast`. It is a separate model and has a retained screening failure. The full model is also not yet quality-approved. Additional audited 1024/BEN2 profiles are explicit experimental diagnosis choices, never automatic replacements. Exact versions, artifact sizes, hashes and rights are in [artifact records](research/artifacts.json).

## SDK and agents

The local package is `superaster-local`; it has not been published to npm. Build and install a local tarball from the source checkout. It contains the native interfaces, schemas, catalog, documentation, notices and selected screening evidence; the web application and development tooling require the checkout.

```sh
npm pack
ONNXRUNTIME_NODE_INSTALL=skip npm install /absolute/path/superaster-local-0.1.0-alpha.1.tgz
```

```ts
import { createProcessor } from 'superaster-local';
const processor = createProcessor();
try {
  const result = await processor.transform(bytes, {
    spec_version: '1.0', input: { ref: 'input-0' },
    quality: 'quality', engine: 'auto',
    operations: [{ op: 'remove_background', edge_cleanup: 'none' }],
    output: { format: 'png', metadata: 'strip' }
  });
  // result.bytes, result.mask, result.record
} finally { await processor.dispose(); }
```

Configure an authorized MCP client with `superaster mcp --roots /absolute/path/to/images`. Tools accept files only within configured roots and return accessible files and records. Optional WebMCP registers tools on supported active browser pages and uses files selected through that page. It adds no remote inference service.

See [installation and examples](docs/installation.md), [contract semantics](docs/contract.md), [generated schemas](schemas/), [physical-device procedure](docs/device-validation.md) and [human review procedure](docs/quality-review.md).

## Validation and rights

```sh
npm run typecheck
npm test
```

Real inference acceptance is an explicit opt-in with pinned inputs/models; ordinary tests do not download weights or substitute mock inference as production behavior. [Corpus reproduction](benchmarks/README.md) explains rights, input hashes, stable fixtures and separate screening/heldout conditions. Required failures and unrun checks remain incomplete.

Original application code is Apache-2.0; original catalog records are CC0. Imported Rare UI, Animate UI, fonts, models and compiled libraries retain their own terms. Read [full notices](THIRD_PARTY_NOTICES.md) and [source/replacement instructions](third-party-licenses/SOURCES.md). Current UI imports have restrictive redistribution terms and visible attribution; they are not relicensed as Apache. The private product specifications and owner-supplied design references are excluded from public history.

Report failures through [GitHub issues](https://github.com/ksmostofa/superaster/issues), including version, environment, selected profile, reproduction and sanitized execution record. Do not upload private photographs or credentials. Art, generation, GPUI desktop, hosted inference and billing remain future work.
