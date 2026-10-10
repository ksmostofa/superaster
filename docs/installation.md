# Local installation and release reproduction

These instructions describe the integrated alpha interfaces inspected on 2026-10-10. They are a reproduction guide, not a G6A/G7 result. Identify the exact commit and retain command output when running them. The [fresh source installation](../evidence/installation/primary-clean-source/README.md) passed 138 tests with three explicit inference skips; the [fresh installed package](../evidence/installation/primary-clean-package/README.md) passed 35 non-inference CLI/SDK/MCP checks. Required model/offline removal, physical-device support, human quality and deployment checks remain separate in [execution.md](execution.md).

The observed development machine is Linux x86_64 with glibc, an Intel i7-8665U and 16 GiB RAM, running Node 26.11.1. The package declares Node >=22; other Node versions, Windows, macOS, Safari, iOS and Firefox have not been established by this guide. Query capabilities for the current adapter's formats, operations and provisional limits. A dependency's codec or platform support does not establish Superaster support.

## Build the source

Source builds and the verifier/benchmark commands below require the repository checkout, not just an installed npm tarball. The package ships the native CLI/SDK/MCP build, schemas, catalog data, notices and documentation; it does not ship the web application, private specification, entire corpus or development toolchain.

Choose a new directory and clone the public repository. The private product specifications are intentionally absent from its history and packages.

```sh
git clone https://github.com/ksmostofa/superaster.git
cd superaster
git rev-parse HEAD
node --version
npm --version
ONNXRUNTIME_NODE_INSTALL=skip npm ci
npm run schemas
npm run build
node dist/native/cli/src/index.js --help
node dist/native/cli/src/index.js capabilities --json
```

`ONNXRUNTIME_NODE_INSTALL=skip` skips ONNX Runtime's optional extra binary downloads, such as CUDA, while retaining its packaged CPU runtime. It does not disable all native dependencies. The lockfile pins dependencies. Do not replace `npm ci` with an unrecorded update when reproducing a release. Web builds copy the installed runtime files and generate an app service worker through the `assets` and `build:web` scripts.

For the release candidate, run `npm run typecheck` and `npm test` once after integration, retain the output and fix any failed checks before packaging. The benchmark preparation checks in [benchmarks/README.md](../benchmarks/README.md) require a separate pinned Python environment; Python is not a production processing dependency.

## Prepare approved models

Models are separate downloads. A removal operation can download the selected model on first use. `inspect`, geometry and capability discovery do not require a removal model. Native defaults to `~/.cache/superaster/models`; `--model-dir` chooses another cache. The browser uses its own origin-scoped model cache and does not share the native cache automatically.

```sh
node dist/native/cli/src/index.js models list
node dist/native/cli/src/index.js models install birefnet-512-fp16 --model-dir .cache/models
node dist/native/cli/src/index.js models install birefnet-lite-512-fp16 --model-dir .cache/models
sha256sum .cache/models/*.onnx
```

| Profile | Model ID and pinned conversion revision | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Quality | `birefnet-512-fp16`, `naddy24/birefnet-512-webgpu` at `ca02a86c094927479e2be583abe87f8ea73fcfda` | 473,435,223 | `6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8` |
| Fast | `birefnet-lite-512-fp16`, `studioludens/birefnet-lite-512` at `4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7` | 98,484,532 | `eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516` |

Additional 1024/BEN2 entries in `models list` are explicit experimental profiles. Their licenses and graph contracts are recorded in [artifacts.json](../research/artifacts.json); Quality/Fast defaults do not change. Runtime/device/quality admission remains pending.

Both approved files are `onnx/model_fp16.onnx` at their pinned Hugging Face revisions. [artifacts.json](../research/artifacts.json) records lineage and [third-party notices](../THIRD_PARTY_NOTICES.md) records rights. These are approved candidates, not declared quality winners. Quality is the default; Fast is explicit. Both use a 512×512 inference input and restore the mask to the requested image dimensions. That interpolation does not prove recovery of fine details.

Downloads verify length and SHA-256 before promotion into cache. A corrupted native cache file produces an integrity error. Preserve it for diagnosis if needed, remove only that identified model file, then rerun `models install`; do not delete source images. Browser cache verification rejects mismatched bytes and reports a recoverable error. Cached weights can avoid a transfer while a new process or browser worker still initializes a session.

## CLI examples

Use an original you are allowed to process. Output paths below must be new. Commands write structured JSON to stdout and progress/errors to stderr. `--overwrite` explicitly permits replacing an existing output. Removal and recipes save an execution sidecar at `OUTPUT.json`.

```sh
node dist/native/cli/src/index.js inspect /absolute/path/input.jpg
node dist/native/cli/src/index.js remove /absolute/path/input.jpg --output /absolute/path/results/cutout.png --quality quality --model-dir .cache/models
node dist/native/cli/src/index.js run /absolute/path/recipe.json --input /absolute/path/input.jpg --output /absolute/path/results/square.webp --model-dir .cache/models
```

Save this as `recipe.json` for the inspect/remove/white-canvas/WebP workflow. `edge_cleanup: none` names the current baseline; automatic cleanup requires its own quality acceptance.

```json
{
  "spec_version": "1.0",
  "input": {"ref": "input-0"},
  "engine": "auto",
  "quality": "quality",
  "operations": [
    {"op": "remove_background", "edge_cleanup": "none"},
    {"op": "canvas", "width": 1200, "height": 1200, "fit": "contain", "background": "#ffffff"}
  ],
  "output": {"format": "webp", "quality": 90, "metadata": "strip"}
}
```

Bind supplied background images or correction masks by the exact recipe reference. For a recipe containing `image_ref: "backdrop"`, append `--bind backdrop=/absolute/path/background.png`. Repeat `--bind` for distinct references. A missing binding fails explicitly; these arguments do not fetch URLs. Recipes use the shared generated [schema](../schemas/recipe-1.0.json) and the draft semantics in [contract.md](contract.md).

```sh
node dist/native/cli/src/index.js batch /absolute/path/photos --recipe /absolute/path/recipe.json --output /absolute/path/results --model-dir .cache/models
node dist/native/cli/src/index.js batch /absolute/path/photos --recipe /absolute/path/recipe.json --output /absolute/path/results --resume --model-dir .cache/models
node dist/native/cli/src/index.js batch /absolute/path/photos --recipe /absolute/path/recipe.json --output /absolute/path/results --retry --model-dir .cache/models
node dist/native/cli/src/index.js resolve jp-residence-status-paper --preset-version 2026-10-08.1
node dist/native/cli/src/index.js validate /absolute/path/results/photo.jpg --preset jp-residence-status-paper --preset-version 2026-10-08.1
```

Batch output must be outside the input directory. Paths retain source-relative names and the source extension, followed by the output extension. `manifest.json` records independent results. Resume/retry checks input, resolved recipe, output and execution-record identities before reusing completed work. Changed data must rerun or report a collision; it must not inherit a stale success. Symlinks are rejected in batch inputs and existing output ancestry. Ctrl-C requests cancellation at a safe execution boundary, retains completed work and stops new processing.

| Exit | Meaning |
| ---: | --- |
| 0 | Command succeeded; inspect validation rule outcomes separately |
| 2 | Invalid input/recipe, denied path, ambiguous or missing preset |
| 3 | Unsupported operation, format, engine or configuration |
| 4 | Processing/model/resource/constraint failure |
| 5 | Partial batch |
| 130 | Cancellation |

Profile validation reports `pass`, `fail`, `needs_review` and `not_checked` by rule. It cannot certify government acceptance, photo age or human appearance. Respect each profile's edit restrictions before processing.

## Fresh package and SDK check

No npm publication is assumed. Build the identified candidate first, then create and install its actual tarball into an empty test project. Replace the absolute paths with directories you own.

```sh
mkdir /absolute/path/release-packages
npm pack --pack-destination /absolute/path/release-packages
sha256sum /absolute/path/release-packages/superaster-local-0.1.0-alpha.1.tgz
mkdir /absolute/path/clean-consumer
cd /absolute/path/clean-consumer
npm init -y
ONNXRUNTIME_NODE_INSTALL=skip npm install /absolute/path/release-packages/superaster-local-0.1.0-alpha.1.tgz
./node_modules/.bin/superaster --help
./node_modules/.bin/superaster capabilities --json
```

Save this as `demo.mjs` in that consumer. It reads the same recipe as the CLI and disposes the shared processor even on failure. The optional `bindings` property accepts reference-to-`Uint8Array` entries. The SDK also exports `runBatch`, `batchFiles`, `listPresets`, `resolvePreset`, `planPreset`, `validate`, `presetHistory` and `monitorSources`.

```js
import {readFile} from 'node:fs/promises';
import {createProcessor, readInput, writeResult} from 'superaster-local';

const processor = createProcessor({modelDir: '/absolute/path/model-cache'});
const cancellation = new AbortController();
process.once('SIGINT', () => cancellation.abort());
try {
  const input = await readInput('/absolute/path/input.jpg');
  const recipe = JSON.parse(await readFile('/absolute/path/recipe.json', 'utf8'));
  console.log(await processor.inspect(input, {signal: cancellation.signal}));
  const result = await processor.transform(input, recipe, {
    signal: cancellation.signal,
    onProgress: progress => process.stderr.write(JSON.stringify(progress) + '\n')
  });
  await writeResult(result, '/absolute/path/results/sdk.webp', {inputPath: '/absolute/path/input.jpg'});
  console.log(result.record);
} finally {
  await processor.dispose();
}
```

Run `node demo.mjs`. For T16 retain the tarball, its hash, dependency tree, OS/Node versions, command logs and decoded output. Reproduce first setup, cached setup, offline processing, cancellation/errors and preserved source hashes from this clean installation. Check included LICENSE, notices, catalog data, schemas and executable files using `npm pack --dry-run --json`. A pack listing alone does not establish clean-install acceptance. From the repository checkout, audit the actual tarball with `python scripts/package-audit.py --package /absolute/path/release-packages/superaster-local-0.1.0-alpha.1.tgz --output /absolute/path/package-audit.json`. This checks linked packaged documents, private-file exclusion, notices, schemas and native import closure without running inference.

## Local MCP

Configure a stdio-capable client you have authorized to access a scratch directory. Replace all example paths with existing absolute paths, including the Node executable. The CLI requires explicit roots; all file and binding paths are checked against them. Do not grant your entire home directory for a small test.

```json
{
  "mcpServers": {
    "superaster": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/superaster/dist/native/cli/src/index.js", "mcp", "--roots", "/absolute/path/scratch", "--model-dir", "/absolute/path/model-cache"]
    }
  }
}
```

Tools are `capabilities`, `inspect`, `remove`, `transform`, `batch`, `resolve_preset` and `validate`. `transform` accepts `input`, `output`, the shared `recipe`, and optional `bindings` mapping references to allowed absolute paths. Results provide a file path, `file://` resource URI and execution-record path instead of embedding a full image in the agent conversation. Tool errors are explicit. JSON-RPC owns stdout; diagnostic logs belong on stderr. [MCP's stdio guide](https://modelcontextprotocol.io/docs/develop/build-server) explains this constraint; the installed v1 SDK's APIs remain pinned by the lockfile.

For T11 ask a fresh authorized agent to discover capabilities, inspect the real input, remove it, apply the recipe's white 1200×1200 canvas, encode WebP and inspect/validate the actual output. Retain tool requests/results and test an unsupported operation and an out-of-root path. A tool-list test does not replace this agent workflow. Local stdio does not create a remotely reachable API or automatic ChatGPT discovery. Optional WebMCP requires a supported browser/client and an active application page; advertise it only after its feature-detected registration passes an actual client test.

## Browser and free static deployment

```sh
npm run dev
```

Open `http://127.0.0.1:5173`. The development server can serve the approved `.cache/models/ID.onnx` files; model integrity rules remain unchanged. Production uses pinned external model URLs and is tested separately:

```sh
npm run build:web
npm run preview
```

Open `http://127.0.0.1:5180`. Confirm `crossOriginIsolated === true`, successful app service-worker installation and the selected verified model cache. If a model download fails, the integrated local-artifact importer can verify a separately downloaded exact approved `.onnx` file before caching it; record that setup route separately from a successful cold browser download. T02/T16 must test a production reload and new-file processing offline after setup. A development tab, cache-presence flag or service-worker registration alone does not prove offline operation. WebGPU additionally requires its verified 28,312,028-byte JSEP runtime cache and actual adapter/shader-f16/operator checks; an available API alone is not a supported configuration. See [device-validation.md](device-validation.md) for the physical-phone procedure and network evidence.

Browser app updates download in the background and wait until all existing Superaster tabs close. Download your images, records and ZIP first, then close every app tab and reopen. New tabs opened while an update waits stay on the existing cached generation. A fresh first visit must reload once after caching before relying on offline use. App assets retain at most the active and one waiting generation; model caching is separate. If another update cannot fit or asset fetching fails, the app reports the failed setup. An interrupted installation can leave an orphan cache: close/reopen first; if the error persists, save the recipe and exports, clear this site's browser cache/data, reload online and prepare its app/runtime/models again. Clearing site data removes local recipes and cached models, so save them first. Original selected files remain on disk. Physical cache-eviction and killed-install recovery are still NOT RUN; [natural-update evidence](../evidence/browser/natural-update/README.md) covers actual two-tab waiting, cache admission and server-stopped deterministic imaging.

Free static hosting can publish `dist/web` with its `_headers`, generated `sw.js`, complete notice bundle and copied runtimes. [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/) currently limits individual assets to 25 MiB and free projects to 20,000 files. Keep the 98/473 MB models at their approved pinned URLs or use a separately verified permitted mirror; do not bundle them into Pages assets or add paid storage. The WebGPU candidate's JSEP WASM also exceeds that limit and uses a size/SHA-256-verified pinned jsDelivr npm download. Its JS/loader remain local pinned package code. The [Pages `_headers` format](https://developers.cloudflare.com/pages/configuration/headers/) applies to static responses. Verify COOP/COEP, model/runtime CORS, downloads, service-worker control, offline operation and notices on the actual free deployment address before claiming support. Domain ownership and a deployed public app are not assumed.

Report failures at [GitHub Issues](https://github.com/ksmostofa/superaster/issues). Include commit/package hash, OS/browser/Node versions, profile/model hashes, capability output, recipe, typed error and a reproduction. Attach only images you explicitly choose to share and have rights to publish. The app should not upload them for you. Do not attach private specifications or secrets.
