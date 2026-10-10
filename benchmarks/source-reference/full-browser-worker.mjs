/** One explicitly requested research invocation, never a production fallback. */
const pins = {
  model: { name: 'model.onnx', bytes: 929574771, hash: '09e180872581e886bb531e5c72a1df354ba2dd55445a11bb0618435a98abe92d' },
  input: { name: 'input.npy', bytes: 12583040, hash: '24e6193e65609e8f88326676a0b845072ed0836653e9ee5264f59ea3a7698771', shape: [1,3,1024,1024] },
  source: { name: 'source-logits.npy', bytes: 4194432, hash: '221a940711594bb0617a1b5c6a73b3436c1e2448cd8e716d2ee0b9a70751d345', shape: [1,1,1024,1024] },
  native: { name: 'native-logits.npy', bytes: 4194432, hash: 'fc08106649b30d1b274b2d9d6f4c25375acd1a3e7e86700a0bbf35d8c651a1e9', shape: [1,1,1024,1024] },
};
let used = false, currentStage = 'idle', session;
const started = performance.now();
const timings = {};
const stage = (name, fields = {}) => { currentStage = name; postMessage({ kind: 'stage', stage: name, elapsed_ms: performance.now() - started, ...fields }); };
const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
async function fetchPinned(pin) {
  stage(`fetch:${pin.name}`);
  const t = performance.now();
  const url = new URL(`./${pin.name}`, import.meta.url);
  if (url.origin !== location.origin) throw new Error('External requests are forbidden');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok || !response.body) throw new Error(`${pin.name}: HTTP ${response.status}`);
  const declared = response.headers.get('Content-Length');
  if (declared !== null && Number(declared) !== pin.bytes) throw new Error(`${pin.name}: changed length`);
  const bytes = new Uint8Array(pin.bytes), reader = response.body.getReader();
  let received = 0, lastProgress = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (received + value.length > pin.bytes) throw new Error(`${pin.name}: oversized body`);
      bytes.set(value, received); received += value.length;
      if (received - lastProgress >= 16 * 1024 * 1024) { stage(`fetch:${pin.name}`, { received_bytes: received, expected_bytes: pin.bytes }); lastProgress = received; }
    }
  } finally { reader.releaseLock(); }
  if (received !== pin.bytes) throw new Error(`${pin.name}: incomplete body`);
  timings[`fetch:${pin.name}`] = performance.now() - t;
  stage(`hash:${pin.name}`, { received_bytes: received });
  const h = performance.now(), digest = await hash(bytes);
  timings[`hash:${pin.name}`] = performance.now() - h;
  if (digest !== pin.hash) throw new Error(`${pin.name}: SHA-256 mismatch`);
  return bytes;
}
function npy(bytes, shape) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(0) !== 0x93 || new TextDecoder().decode(bytes.subarray(1,6)) !== 'NUMPY' || view.getUint8(6) !== 1 || view.getUint8(7) !== 0) throw new Error('Expected fixed NPY v1.0 fixture');
  const length = view.getUint16(8, true), offset = 10 + length;
  const header = new TextDecoder().decode(bytes.subarray(10,offset));
  const match = /'shape':\s*\(([^)]+)\)/.exec(header);
  if (!/'descr':\s*'<f4'/.test(header) || !/'fortran_order':\s*False/.test(header) || !match) throw new Error('Expected contiguous little-endian float32 NPY');
  const dims = match[1].split(',').map(x => x.trim()).filter(Boolean).map(Number);
  if (JSON.stringify(dims) !== JSON.stringify(shape) || offset % 4 !== 0 || bytes.byteLength-offset !== shape.reduce((a,b) => a*b, 4)) throw new Error('Changed fixed NPY dimensions/body');
  const data = new Float32Array(bytes.buffer, bytes.byteOffset + offset, (bytes.byteLength-offset)/4);
  stats(data); return data;
}
function stats(values) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const value of values) { if (!Number.isFinite(value)) throw new Error('Nonfinite tensor'); min = Math.min(min,value); max = Math.max(max,value); sum += value; }
  return { elements: values.length, finite: true, min, max, mean: sum / values.length };
}
function differences(actual, reference) {
  if (actual.length !== reference.length) throw new Error('Comparison size mismatch');
  let abs = 0, square = 0, maximum = 0;
  for (let i=0;i<actual.length;i++) { const difference = actual[i]-reference[i]; abs += Math.abs(difference); square += difference*difference; maximum = Math.max(maximum,Math.abs(difference)); }
  return { mean_absolute_difference: abs/actual.length, max_absolute_difference: maximum, root_mean_square_difference: Math.sqrt(square/actual.length) };
}
onmessage = async ({ data }) => {
  if (used || data.command !== 'one_group_case') return;
  used = true;
  const report = { scope: 'One pinned group tensor only; no product/phone/quality/frozen-tolerance acceptance', case_id: 't01-three-birdwatchers', provider: 'wasm', threads: 1, proxy: false, wasm_heap_ceiling_bytes: 4294967296, pins, numerical_acceptance: 'NOT AWARDED', quality: 'NOT AWARDED', timings_ms: timings };
  let outputBuffer;
  try {
    stage('load_pinned_runtime');
    const ort = await import('./runtime/ort.wasm.min.mjs');
    report.runtime_versions = ort.env.versions;
    if (ort.env.versions.web !== '1.30.0') throw new Error('Unexpected actual ORT web version');
    ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('./runtime/', import.meta.url).href;
    const input = npy(await fetchPinned(pins.input), pins.input.shape);
    const source = npy(await fetchPinned(pins.source), pins.source.shape);
    const native = npy(await fetchPinned(pins.native), pins.native.shape);
    let model = await fetchPinned(pins.model);
    stage('initialize_wasm_session');
    const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all', executionMode: 'sequential', enableCpuMemArena: false, enableMemPattern: false };
    report.session_options = options;
    let t = performance.now(); session = await ort.InferenceSession.create(model, options); timings.session_initialization = performance.now()-t;
    model = undefined;
    report.actual_interface = { input_names: session.inputNames, output_names: session.outputNames, input_metadata: session.inputMetadata, output_metadata: session.outputMetadata };
    for (const [metadata, name, dims] of [[session.inputMetadata,'image',pins.input.shape],[session.outputMetadata,'logits',pins.source.shape]]) {
      if (metadata.length !== 1 || metadata[0].name !== name || !metadata[0].isTensor || metadata[0].type !== 'float32' || JSON.stringify(metadata[0].shape) !== JSON.stringify(dims)) throw new Error('Unexpected actual WASM interface');
    }
    stage('one_group_wasm_inference');
    const tensor = new ort.Tensor('float32', input, pins.input.shape);
    t = performance.now(); const result = await session.run({ image: tensor }, ['logits']); timings.inference = performance.now()-t;
    const output = result.logits;
    if (output.type !== 'float32' || JSON.stringify(output.dims) !== JSON.stringify(pins.source.shape) || !(output.data instanceof Float32Array)) throw new Error('Changed output type/dimensions');
    stage('measure_actual_raw_logits');
    report.tensor = { type: output.type, dims: output.dims, ...stats(output.data) };
    report.raw_logit_differences = { source: differences(output.data,source), native: differences(output.data,native) };
    outputBuffer = output.data.slice().buffer;
    report.raw_float32_little_endian_sha256 = await hash(outputBuffer);
    report.raw_bytes = outputBuffer.byteLength;
    report.status = 'COMPLETED; ACCEPTANCE NOT AWARDED'; report.execution_completed = true;
  } catch (error) {
    report.status = 'FAIL'; report.execution_completed = false;
    report.error = { name: error instanceof Error ? error.name : 'RuntimeError', message: error instanceof Error ? error.message : String(error) };
  } finally {
    report.last_stage = currentStage;
    if (session) {
      stage('release_session');
      try { await session.release(); report.session_cleanup = 'released'; }
      catch (error) { report.session_cleanup = { status: 'FAIL', message: String(error) }; report.status = 'FAIL'; }
    }
    postMessage({ kind: 'result', report, raw: outputBuffer }, outputBuffer ? [outputBuffer] : []);
  }
};
