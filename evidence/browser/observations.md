# Browser pipeline observations

Environment: actual Codex in-app Chromium 154 on Linux x86_64, localhost production build at port 5180. This is laptop evidence, not Pixel 7 evidence. Active private spec revision 1.2. Source baseline ec35710 plus uncommitted adapters/browser files; exact build asset hashes accompany the next integrated commit.

PASS: approved Fast artifact downloaded with real byte progress, verified, initialized in ORT Web 1.30.0 WASM, and processed the rights-cleared 2400×1600 T01 photo. The actual Download image, execution record and mask controls wrote files. `fast-t01.json` and `fast-t01-properties.json` record the exported bytes and decoded alpha. Output files remain local under evidence/browser. Subject-quality judgment remains NOT RUN.

Observed failures and causes:

- StrictMode cleanup disposed a processor reused by the second setup. Create the processor in effect setup and dispose that exact instance.
- wasm-vips tried loading deferred HEIF/JXL plugins which were absent, returning HTML instead of WASM. Configure `dynamicLibraries: []`; these codecs are outside launch scope.
- ORT's relative MJS override hit Vite's public-source transform restriction. Use documented absolute `mjs` and `wasm` URLs.
- Development source changes reloaded the page during inference. Measure a fixed production build with no hot reload.
- Full Quality artifact download failed with a network error after more than 260 MiB; no model or quality fallback occurred. This cold external-download check remains FAIL until a documented recovery path is verified.

Browser API inspection through CDP confirms secure context isolation, navigator.gpu and document.modelContext availability. Adapter initialization/operator support and device performance do not follow from presence alone.

Download-event automation timed out, but the real controls wrote files in the user's Downloads directory. Outputs were copied into the evidence directory and independently decoded with Sharp. This tool limitation is separate from processing correctness.
