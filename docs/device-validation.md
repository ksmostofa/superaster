# Physical Pixel 7 and browser validation

This is the unrun physical-device handoff for G2 and T01-T04/T08-T10/T16. Owner authorization to use a Pixel 7 does not supply a device or a measurement. Until a tester runs this on the named phone, record the physical-phone checks as NOT RUN. A Chromium mobile viewport can check layout but cannot supply Pixel 7 inference, memory, thermal or download results.

Identify the integrated commit, app build, private active specification revision and [approved profile](../research/artifacts.json). Leave [numerical budgets](../benchmarks/budgets.json) unset until the required baseline informs their G2 freeze. Provisional guards are implementation limits, not measured admission budgets. Do not tune against a threshold chosen after seeing the result.

## Connect the real phone

Install Android's current free SDK Platform Tools through its official distribution. Enable Developer options and USB debugging on the Pixel 7, connect a data-capable USB cable and approve the host's RSA prompt on the phone. [Android's ADB documentation](https://developer.android.com/tools/adb) describes this authorization. Select the physical serial explicitly when multiple devices exist; an `emulator-*` serial does not qualify.

Build and serve the production app on the laptop using [installation.md](installation.md): `npm run build:web`, then `npm run preview`. Its preview port is 5180. Use USB reverse forwarding to the phone's localhost. The [official ADB manual](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/docs/user/adb.1.md) documents `-s`, `reverse`, `push` and `pull`.

```sh
adb version
adb devices -l
superaster_phone_serial='REPLACE_WITH_PHYSICAL_SERIAL'
adb -s "$superaster_phone_serial" shell getprop ro.product.model
adb -s "$superaster_phone_serial" shell getprop ro.build.fingerprint
adb -s "$superaster_phone_serial" shell getprop ro.build.version.release
adb -s "$superaster_phone_serial" shell dumpsys package com.android.chrome
adb -s "$superaster_phone_serial" reverse tcp:5180 tcp:5180
adb -s "$superaster_phone_serial" reverse --list
```

Open `http://localhost:5180` in the phone's Chrome. The phone performs the browser computation. USB delivers app assets from the laptop, so a transfer measured on this route is not a public-hosting mobile-network measurement. Production model downloads still use their recorded pinned external URLs. A localhost origin is separate from `127.0.0.1` and from a public deployment; its caches do not transfer automatically.

On desktop Chrome open `chrome://inspect/#devices`, select the phone's actual page and inspect it. Follow [Chrome's remote-debugging guide](https://developer.chrome.com/docs/devtools/remote-debugging/). Record `navigator.userAgent`, `crossOriginIsolated`, available backend capabilities and the actual execution record from this page. Never report the desktop browser's device details as the phone's.

## Prepare inputs and evidence

Fetch and verify the rights-cleared inputs and generate fixtures using [benchmarks/README.md](../benchmarks/README.md). `benchmarks/fixtures/acceptance-manifest.json` names the real 2400×1600 T01 input and T08/T10 files; `benchmarks/fixtures/manifest.json` names deterministic correctness/error inputs. Transfer only these technical evaluation files. Retain source attribution with published derivatives.

```sh
adb -s "$superaster_phone_serial" shell mkdir -p /sdcard/Download/Superaster
adb -s "$superaster_phone_serial" push benchmarks/fixtures/generated /sdcard/Download/Superaster/
```

If the installed fixture manifest names a different directory, use that manifest's paths rather than silently changing input conditions. Select these files through the phone's real file picker. Keep outputs and their execution records in a new evidence directory on the laptop. Record app commit/build hash, input hashes, phone model/build, Chrome version, profile/artifact/runtime/backend/precision, network route, available storage, battery/power state and ambient/thermal conditions. Avoid other heavy jobs while measuring. Predeclare repeat count, input order and cooldown policy.

| Check | Procedure and required retained evidence |
| --- | --- |
| T01 actual phone | Run the real 2400×1600 input through the declared profile. Download PNG and record. Decode it on the laptop; check 2400×1600, continuous useful alpha, intended retained subject and preserved input hash. Human subject judgment remains separate from file-property checks. |
| T02 cold | Use DevTools Application to clear only this app origin's site storage, then visit online. Retain app/model requests, actual download bytes and initialization/stage timings. A newly created tab with an existing model cache is not cold setup. |
| T02 cached | Reload with cache enabled and process the same input, then a second real input. Record weight-transfer absence and session reinitialization/reuse separately. Repeat in the same warmed worker for warm timing. |
| T02 offline | After production setup and service-worker activation, reload with DevTools Network offline and process a newly selected local file. Keep ordinary cache enabled. Record success/errors and requests. Separately disable phone Wi-Fi/mobile data while keeping USB connected to check external dependency absence. Test a previously unopened profile as an honest missing-model error. |
| Eviction/integrity | Remove only the selected model cache entry through DevTools, try offline, then recover online. Preserve the typed error and recovery. Corrupt-cache verification can use a separate disposable app-origin profile; never edit the corpus originals. |
| T03 invalid/cancel | Select corrupt PNG, oversized-header PNG, animated GIF and unsupported SVG fixtures. Confirm attributable errors, responsive controls and bounded resources. Cancel download and active processing. Record completion boundary, no silent Quality downgrade and preserved completed outputs. |
| T04 privacy | Keep Network log while selecting, correcting, exporting and batching real files. Identify every request and its payload. App/runtime/model downloads are expected; no source image, mask or output bytes may be transmitted. Inspect workers too. Export a HAR only after reviewing it for unrelated secrets and private URLs. |
| T05 correction | Erase/restore with touch; compare source detail and mask. Undo/redo must restore the exact mask. Keep brush selection, comparison and downloaded pixel evidence. |
| T08/T09 batch | Use the fixed 20-item set with one corrupt file. Record 19 outputs and one error. In a separate run cancel after several completions, reselect files/permissions as needed and resume verified work. Change one input/recipe and check stale work detection. |
| T10 names/resources | Use the duplicate-basename fixture and a queue larger than simultaneous capacity. Verify source mapping, no overwrite, measured concurrency, bounded ZIP/individual downloads and no lost completed files. |
| T16 public origin | Repeat the required setup/cache/offline/error/privacy/export checks at the actual published address. Laptop localhost results do not establish public-origin headers, CORS or service-worker behavior. |

Do not replace a failed Quality test with Fast and mark Quality passed. Offer Fast explicitly and test it as a separate profile. If the phone terminates a worker or cannot fit a profile, record the failing configuration, error and smallest successful candidate without changing the required criterion.

## Record time and memory honestly

Time from the real user action through the accessible completed export, not only the inference callback. Retain individual stage timings from execution records, model transfer/setup time separately, same-worker warm time and batch throughput. Record failures and timeouts in the denominator. Use the declared repeat count and the benchmark's median/p95 method. Report actual sample counts and limitations; repeated images are not independent quality samples.

Remote DevTools Performance records identify long tasks and stages on the phone. Its JavaScript heap counters omit WASM/native/GPU allocations. [Chrome's memory guide](https://developer.chrome.com/docs/devtools/memory-problems) explains the distinction. If `performance.measureUserAgentSpecificMemory` is available in this isolated page, record its result and scope; otherwise record NOT MEASURED. Neither its presence nor JS heap size establishes whole-browser peak memory.

Android's `dumpsys meminfo` can provide an observed Chrome-process snapshot. Retain the raw report and timestamp. Other Chrome tabs/processes, shared allocations and sampling gaps limit interpretation; describe sampled PSS as sampled PSS, not exact tab peak RSS. [Android's dumpsys documentation](https://developer.android.com/tools/dumpsys#meminfo) explains the reported memory fields. Close unrelated tabs for a repeatable condition and state that choice.

```sh
adb -s "$superaster_phone_serial" shell dumpsys meminfo com.android.chrome > phone-chrome-meminfo.txt
adb -s "$superaster_phone_serial" shell dumpsys battery > phone-battery.txt
adb -s "$superaster_phone_serial" shell dumpsys thermalservice > phone-thermal.txt
```

If the device/API denies a report, keep the error and mark that metric unavailable. Do not infer a memory ceiling or phone admission from laptop RSS, an emulator or a missing measurement.

## Inspect UI and exported files

Capture input, model preparation, processing, result, correction, error and batch states from the physical phone and from a desktop browser. Keep actual screenshot dimensions and orientation. Check hierarchy, clipping, overflow, contrast, visible focus, keyboard access where supported, touch targets, screen-reader announcements, reduced motion and controls reachable without hover. Fix a concrete defect, then recheck its affected states.

```sh
adb -s "$superaster_phone_serial" exec-out screencap -p > phone-result.png
adb -s "$superaster_phone_serial" shell ls /sdcard/Download
adb -s "$superaster_phone_serial" pull /sdcard/Download/ACTUAL_EXPORTED_FILE.png ./phone-output.png
```

Use the actual downloaded filename; do not overwrite an earlier run. Pull the corresponding JSON record too. Open the PNG, mask and white/black/color composites; inspect decoded pixels, dimensions, format, frame count, bytes, alpha, orientation, color, composition and metadata policy. Use the shared fixture answers for T18. Screenshots prove UI state, not correct export pixels.

For every required check retain PASS/FAIL/NOT RUN, exact interaction steps/commands, environment, inputs, outputs, record/log/network evidence and limitations on the identified integrated commit. Use `evidence/device/<commit>-pixel7/` for the new evidence, with one concise acceptance table. Preserve failed runs. Finish by removing this task's USB forwarding with `adb -s "$superaster_phone_serial" reverse --remove tcp:5180`.
