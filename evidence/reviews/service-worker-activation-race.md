# Service-worker activation race

Checked 2026-10-10 UTC. Natural activation is implemented, and the final section reviews the coordinator's actual Chrome evidence. The earlier forced-activation cause is removed at the identified source hashes. The recorded generation transitions and deterministic offline exports support that bounded fix; they do not establish ML offline acceptance or crash/eviction recovery. No gate is awarded. No source edits or browser tests were performed by this researcher.

## Decision

Remove forced `skipWaiting` and `clients.claim`. Keep the new worker waiting while any old controlled client remains. Display “Update downloaded. Download exports, close all Superaster tabs, then reopen to apply.” A fresh uncontrolled page must distinguish cached app assets from active offline control and tell the user to reload before offline use. Keep the existing per-build fetch/cache semantics; no runtime URL migration is required for this conservative policy.

The browser lifecycle replaces the non-atomic `clients.matchAll` admission check. A newly opened old-generation tab keeps the old worker in use. It cannot be silently moved to a new worker by the removed force-activation path. This conclusion is an implementation inference from the normative lifecycle below, and requires the named browser checks.

## Primary lifecycle evidence

The W3C Editor's Draft dated 17 September 2026 defines `matchAll` as asynchronous enumeration and excludes clients whose execution-ready flag is unset. It gives no lock on future client creation. `skipWaiting` permits activation despite existing clients. Activate step 8 moves clients using the registration to the new active worker before dispatching `activate`, so removing only `clients.claim` is insufficient. Without that override, Try Activate waits until the registration has no old clients and pending events. [W3C client enumeration](https://w3c.github.io/ServiceWorker/#clients-matchall), [activation](https://w3c.github.io/ServiceWorker/#activation-algorithm), [Try Activate](https://w3c.github.io/ServiceWorker/#try-activate-algorithm).

Registration/update jobs use the scope's synchronized queue. `CacheStorage.keys` returns cache names in creation order. These are the basis for the bounded admission and predecessor-only cleanup below. [W3C job scheduling](https://w3c.github.io/ServiceWorker/#schedule-job-algorithm), [cache keys](https://w3c.github.io/ServiceWorker/#cache-storage-keys).

Google's lifecycle guidance confirms the intended user transition: an installed update waits until old tabs close; refresh can overlap the old client. It explicitly warns that forced activation mixes older page loads with newer fetch handling. [Google service-worker lifecycle](https://web.dev/articles/service-worker-lifecycle).

## Cause in the inspected application

The earlier generator admitted an update from a single-window snapshot, called `skipWaiting`, deleted every older app cache during activation, and claimed clients. A second tab could finish loading build A after that snapshot. Its JavaScript still referred to A's compiled worker, while its controller had become B and A's cache had disappeared. Cancelling processing terminates the image worker; retry reconstructs it using A's embedded worker URL. A deployment that removed that URL leaves a real failure instead of a reusable local runtime.

Keeping one old cache and looking only in B's asset list would also be insufficient. `scripts/assets.ts` copies libvips and ORT assets to stable `/runtime/` URLs. `browser-kernel.ts` dynamically imports `/runtime/vips-es6.js` and resolves its WASM there. `browser.ts` sets ORT's `.mjs` and `.wasm` paths there. A current-first runtime lookup could return B's bytes to A's code. Conversely, `BrowserWorkerEngine` uses a Vite-compiled worker URL. Natural activation retains A's own complete cache/controller until A's clients finish, so these existing paths remain coherent during the waiting period.

A forced-update design would require immutable runtime URLs, serving all still-needed older asset generations, and safe retention/admission rules across multiple updates. A “keep the last two” rule cannot protect a much older open page through repeated forced activations. That additional mechanism is unnecessary for the accepted policy.

## Bounded cache behavior

1. Admit at most two app-generation caches for this registration: the active build and one prepared candidate. Before creating a distinct new `CACHE`, reject installation when two `superaster-app-*` names already exist. Preserve both existing caches. The already-waiting candidate can still activate after tabs close; a newer candidate retries after that transition.
2. When populating a newly created candidate fails, delete only that candidate and rethrow. Never remove the active build as a download failure recovery action. Leave `superaster-models-v1` and unrelated origin caches untouched.
3. On natural activation, prune only matching app caches earlier than the activating build in the ordered cache-name list. Preserve newer candidate caches that could be installing concurrently. If the activating cache is absent, do not use `slice(0,-1)` as cleanup; skip destructive cleanup and report/recover the missing app cache.
4. Keep fetching app assets from the current worker's own cache. Do not add a global first-match lookup across old/current caches. Report failed cache installation honestly rather than claiming offline readiness.

The two-generation count is an implementation storage bound, not a frozen G2 memory budget or a promised device quota. Existing stores already above the count are not made compliant by deleting possibly needed caches. A killed install can leave a partial orphan and fill the second slot with no waiting worker. Close/reopen alone may then fail to recover. Ordinary population-failure cleanup handles rejected downloads; crash/eviction recovery needs a truthful cache-reset procedure or a small durable pending-cache marker before it can be claimed tested. This remains NOT RUN.

For migration, a still-open old page may send its legacy `REQUEST_UPDATE`. The new worker must never force activation in response. An explicit `UPDATE_BLOCKED` reply explaining the close-tabs transition would avoid the old page's acknowledgement timeout; otherwise the old page must be closed as instructed during migration. This is a compatibility improvement, not a reason to restore forced activation.

## Named reproduction and initial acceptance checklist

The earlier deterministic reproduction is “second tab opens after update enumeration.” Install/control build A; deploy B without retaining A's server-side compiled assets. In a diagnostic fixture only, pause B after its window enumeration and before its force-activation call. Open a second A page, load an actual image, then release activation. Cancel and retry in that page. Capture client/controller changes, requested worker/runtime URLs, cache names, exported PNGs/records and failures. The diagnostic pause is test instrumentation, not production progress or inference. This exact earlier race remains NOT RUN.

For the accepted implementation, use real published-format builds and actual deterministic image operations. No inference benchmark is needed to test cache/control behavior.

| Check | Expected observation | State in this report |
| --- | --- | --- |
| A controlled, B installed; open another A tab during update preparation | B remains waiting; both tabs keep A's controller and app cache. A's worker can be cancelled/recreated and still export after A assets disappear from the server. | NOT RUN |
| Close one old tab, retain another with images | B stays waiting; no automatic reload, cache removal, or input loss. | NOT RUN |
| Close all A clients and reopen | B activates naturally; old predecessor caches are pruned; B controls the reopened page and produces a real export. | NOT RUN |
| Fresh profile, first installation | Initial page is honestly uncontrolled; after an intentional reload the page is controlled and cache-backed. | NOT RUN |
| C arrives while A is active and B waits | C is deferred before creating a third app cache. A/B remain usable; close/reopen activates the prepared update, after which a later install can proceed. | NOT RUN |
| Failed candidate population | Newly created partial candidate is removed; active app and approved model cache remain. | NOT RUN |
| App cache eviction or killed-install orphan | Actionable recovery; no invented offline PASS or automatic deletion of needed image/session state. | NOT RUN |

The table above records checks as NOT RUN at the initial diagnosis. The final section below records the subsequently supplied evidence, without treating partially exercised rows as complete. The existing two-tab rejection/single-tab force-activation evidence belongs to the older protocol and cannot pass the new natural-lifecycle behavior.

## Inspected versions

Initial diagnosis read HEAD `9c70937f92e366190f2c337b28ddc5bee69b17a8` with the earlier generator hash `3f8afd289ffa7dbed2eb217d4dabed16580d8137d46eace2f1e7560f32e06abb`. The coordinator changed App and the generator during this investigation. At 2026-10-10T00:53:10Z the new generator was SHA-256 `a7cac31ef92149aaffd832fb2e0e1e2d4d6fa79a74cf6177a97252caa7f330aa`, and App was `e0dda515efa9c3518441e1f8e193b9bea76362ffc81c67a0efce4475637f6fb1`. Source inspection found natural activation, bounded install admission and ordered predecessor pruning; the missing-own-cache guard and crash/eviction recovery caveats above still require consideration.

| Unchanged input | SHA-256 |
| --- | --- |
| `scripts/assets.ts` | `eb2f250632391784cf3d5b1c4d438e8eabec6e1b4d67e030f436c87690de280a` |
| `packages/engines/src/browser.ts` | `d0887ffb400f7026397fc90e94a60378af6ef73648aa5ab13b411ef6839659b1` |
| `packages/engines/src/browser-kernel.ts` | `e4c15f57334a9ea6b47b5238023630907c21d8ebb76c9b3ac729617bc6969b06` |
| `packages/web/src/client.ts` | `1fbf45a2dc0585247193fbd6bebcf2a7c186f00b04e4599483e836c3b0ce1094` |

## Final source and evidence review

Reviewed HEAD `d3b242acb63975390674bd83a6c99af9fe2d4d84` with dirty App SHA-256 `7d8bf863143b69d9075a32192aae55af6331e050eda1df9521ea43adb4acf3e0` and generator SHA-256 `78ae7cef07009db7ce0fc45596147fbbd5403f51c9bc56b7d3b324f64c2532d0`. The [source snapshot](../browser/natural-update/source-snapshot.json) pins these bytes to the build. Source inspection confirms removal of `REQUEST_UPDATE`, `skipWaiting`, `clients.claim`, and automatic update reload. Installation preserves existing caches when the two-cache admission bound rejects another generation. Activation now guards a missing own cache before pruning predecessors; approved model caches are excluded. The App reports an uncontrolled first page honestly and shows the close-tabs instruction when an update waits. No new concrete regression was identified in this bounded source change.

The [final build manifest](../browser/natural-update/builds-final.json) identifies three QA generations made from a real build by an explicit appended comment and app filename change. Chrome began with manifest `update`, cache `superaster-app-78e80a3dbac99b99`, and `assets/index-QAddaa04412d6e.js`; manifest `third`, cache `superaster-app-b7510adb0cbee917`, waited. The subsequently attempted distinct generation was manifest `base`, cache `superaster-app-4d9a87b58d9d56d9`. These labels describe fixture construction, not the order of this browser run. The [fixture script](../../benchmarks/browser/update-fixtures.py) and [reproduction steps](../browser/natural-update/README.md) keep that distinction explicit. The earlier disconnected in-app-browser run in `interruption.json` remains incomplete and is not reused as a pass.

| Recorded check | Scoped result and evidence |
| --- | --- |
| Fresh first page, before reload | PASS for the recorded state: `chrome-fresh-uncontrolled.json` shows an active registration, a null controller, and “reload before offline use.” `chrome-baseline.json` records the subsequently controlled page. |
| New tab while update waits | PASS for the recorded two-tab state: both entries in `chrome-two-tabs.json` retain the same old script, an installed waiting worker, and the same two app caches. The desktop instruction is readable in `chrome-waiting-update.jpg`. Controller script URLs are identical across generations, so generation identity is established by the page scripts and caches, rather than that URL alone. |
| Additional candidate while two app caches exist | The attempted `base` is pinned by the manifest and the coordinator's recorded action sequence. `chrome-third-rejected.json` preserves the two existing caches, old script and waiting worker. `chrome-third-rejected.txt`/`.jpg` visibly report failed cache setup with a retained result. PASS for that observed failure/retention transition; attribution to the exact admission branch is source-confirmed. No full service-worker exception trace was captured. |
| Existing old tab, origin server stopped | PASS for deterministic imaging in the recorded run: `chrome-server-stopped.json` retains the old script and waiting update. `old-generation-server-stopped.png` is the real 120 × 80 PNG export with its matching execution record in `export-properties.json`. |
| Close both old tabs and reopen with server stopped | PASS for the recorded natural transition: `chrome-activated-offline.json` has the new script, no waiting worker, and only the new app cache plus the preserved model cache. `chrome-offline-new-runtime.json` records the same state after fresh-worker imaging. |
| New cached page and worker, origin server stopped | PASS for deterministic imaging: `new-generation-offline-reload.png` and its record have matching properties. This does not establish full worker-network capture or ML model setup. |
| Update notice at 390 × 844 | PASS for that browser-emulated view: `chrome-mobile-update-top.json` places the complete notice within the viewport with no horizontal overflow. I inspected `chrome-mobile-update-top.jpg`; the instruction wraps and remains readable. The earlier scrolled capture did not show the header and is not used for this finding. |

I opened both PNGs and independently decoded their retained bytes using installed `sharp`. Both are PNG, exactly 120 × 80, fully opaque (decoded alpha minimum and maximum 255), contain ICC data, omit EXIF, and match recorded SHA-256/byte counts: old output 2,063 bytes / `a69f434e9298faa2139c99f7f1beb0ac185e7d4e7d6f7b2a5216734832bd6e78`; new output 2,071 bytes / `6473a521722c8ca24d45091f3bf2494bd9f76abecb9707aac614a06e7ceef2a7`. The coordinator reports seven passing property checks per export. This independent artifact check did not rerun application processing.

The server-stopped condition supplies strong evidence for these local deterministic exports. Network capture remains explicitly tab-scoped because worker auto-attachment is unavailable, and the recorded event buffer is truncated. Do not convert it to a complete network/privacy pass. Cancellation and worker recreation while an update waits, closing only one of two old tabs, and ordinary failed candidate population cleanup are still NOT RUN as distinct browser scenarios in this evidence. Killed-install orphans and browser cache eviction are NOT RUN; the manual save-exports/recipe, close/reopen, then clear site cache/data and prepare again guidance is a recovery procedure, not a verified recovery result. Physical-phone performance, removal inference, held-out quality, and release gates remain outside this report.
