/** Separate development harness; never included in the product site. */
import * as ort from './runtime/ort.wasm.min.mjs';

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('./runtime/', import.meta.url).href;
const button = document.querySelector('#run');
const output = document.querySelector('#output');
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
button.addEventListener('click', async () => {
  button.disabled = true;
  const report = { scope: 'Synthetic browser-WASM operator probe; no full model, GPU, phone, quality or performance acceptance', user_agent: navigator.userAgent, versions: ort.env.versions, provider: 'wasm', threads: 1, cases: [] };
  output.textContent = 'Loading the actual local WASM runtime and fixtures…';
  try {
    const response = await fetch('./probe.json');
    if (!response.ok) throw new Error(`Fixture HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    report.probe_sha256 = await sha256(bytes);
    const source = JSON.parse(new TextDecoder().decode(bytes));
    for (const fixture of source.cases) {
      const graphResponse = await fetch(`./${fixture.graph_path}`);
      if (!graphResponse.ok) throw new Error(`Graph HTTP ${graphResponse.status}`);
      const graph = await graphResponse.arrayBuffer();
      if (await sha256(graph) !== fixture.graph_sha256) throw new Error('Changed tiny ONNX graph');
      const session = await ort.InferenceSession.create(new Uint8Array(graph), { executionProviders: ['wasm'] });
      try {
        const inputs = Object.fromEntries(Object.entries(fixture.inputs).map(([name, input]) => [name, new ort.Tensor('float32', Float32Array.from(input.data), input.dims)]));
        const actual = (await session.run(inputs)).output;
        const values = Array.from(actual.data);
        const pass = actual.type === 'float32' && JSON.stringify(actual.dims) === JSON.stringify(fixture.expected.dims) && values.length === fixture.expected.data.length && values.every((value, index) => Object.is(value, fixture.expected.data[index]));
        report.cases.push({ id: fixture.id, type: actual.type, dims: actual.dims, values, exact_expected: pass ? 'PASS' : 'FAIL' });
        if (!pass) throw new Error('Actual browser WASM differs from independent exact expected values');
      } finally { await session.release(); }
    }
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.error = { name: error instanceof Error ? error.name : 'RuntimeError', message: error instanceof Error ? error.message : String(error) };
  }
  output.textContent = JSON.stringify(report, null, 2);
  window.superasterSyntheticKernelProbe = report;
  button.disabled = false;
});
