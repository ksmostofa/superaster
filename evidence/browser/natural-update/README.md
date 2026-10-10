# Natural app update and cached imaging

This check follows the browser's natural service-worker activation rule. The application does not call `skipWaiting` or `clients.claim`. Updates cache in the background and activate after all old controlled app tabs close. Initial fresh pages honestly request a reload before offline use. At most two app-generation caches are admitted; model caches are separate.

The [final fixture builds](builds-final.json) identify every served byte. `update` and `third` differ from `base` only by an explicit QA JavaScript comment and filename; operation semantics are unchanged. Chrome used `update` as its initial generation and installed `third` as waiting. The next attempted installation became redundant, showed an error, and preserved both caches and the result. The candidate was the immutable `base` fixture copied to `live` immediately before normal update. The worker exception and network response were not captured. The two-cache admission cause is supported by inspected source, rather than an observed worker exception. The older [interrupted in-app-browser attempt](interruption.json) did not complete this check and is not counted as a pass.

| Check | Result | Actual evidence |
| --- | --- | --- |
| Fresh cache has no controller until reload; visible instruction matches | PASS | [chrome-fresh-uncontrolled.json](chrome-fresh-uncontrolled.json) |
| Two open tabs retain identical old app script; new generation waits | PASS | [chrome-two-tabs.json](chrome-two-tabs.json) |
| Failed candidate preserves current/waiting caches and retained result; visible error | PASS for observed retention/error; admission cause source-reviewed | [chrome-third-rejected.json](chrome-third-rejected.json), [visible error](chrome-third-rejected.txt) |
| Existing old tab processes/exports with preview server stopped | PASS for deterministic imaging | [export-properties.json](export-properties.json) |
| Close both old tabs; reopen offline loads new script, no waiting worker, old cache removed | PASS | [chrome-activated-offline.json](chrome-activated-offline.json) |
| New cached generation/new worker processes/exports while server stays stopped | PASS for deterministic imaging | [export-properties.json](export-properties.json), [scoped network record](chrome-offline-new-runtime.json) |
| Update guidance at 390×844 has no horizontal overflow and is visible | PASS for browser emulation | [chrome-mobile-update-top.json](chrome-mobile-update-top.json), [screenshot](chrome-mobile-update-top.jpg) |
| ML first/cached/offline setup, full worker-network observation, actual phone | NOT RUN here | This check uses imaging only |
| Killed-install orphan and physical cache eviction recovery | NOT RUN | Manual cache recovery guidance is documented |

The server was stopped before both offline export checks and stayed stopped until their files were downloaded. Both PNGs were independently decoded: exact 120×80, format, opacity, original input hash, record output hash/bytes and EXIF stripping pass. Actual output files accompany the JSON. Connector download events timed out even though files arrived; no duplicate action was taken. A locator timeout likewise reported an already visible completed result, which was inspected before exporting. Chrome's connector does not support worker target auto-attachment, so network evidence is explicitly tab-scoped.

Reproduce after `npm run build:web`:

```sh
python3 benchmarks/browser/update-fixtures.py --build dist/web --output .cache/NEW-update-fixtures --evidence .cache/NEW-update-fixtures.json
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5210 --strictPort --outDir "$PWD/.cache/NEW-update-fixtures/live"
```

Use a fresh browser origin/profile. Serve the `update` fixture first; wait for caching, reload, choose `benchmarks/browser/fixtures/01/same.png`, and prepare white composition/width120 PNG/strip. Replace only the disposable `live` fixture directory with `third`, request the registration's normal `update`, then open another tab. Both scripts must still be the `update` script. Replace `live` with `base`, request update, and check the two-cache admission error while `third` stays waiting. Stop the preview process; choose fixture02 in the second old tab and export. Close both old tabs, reopen that origin while the server remains stopped, choose fixture01 and export again. Inspect actual decoded files and records. Restore temporary viewport/network observations after testing.

No gate or physical-device claim follows from these subset checks.
