/** Clearly labelled synthetic operator probe in the installed Node WASM build. */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as ort from 'onnxruntime-web/wasm';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: node probe-wasm.mjs PROBE_JSON NEW_OUTPUT_JSON');
const sourceBytes = await readFile(inputPath);
const source = JSON.parse(sourceBytes.toString());
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
const report = {
  scope: 'Synthetic kernel compatibility in Node WASM; not a browser, GPU, model or phone result',
  probe_sha256: createHash('sha256').update(sourceBytes).digest('hex'),
  node: process.version,
  version: ort.env.versions,
  provider: 'wasm',
  wasm_threads: 1,
  cases: [],
};
try {
  for (const fixture of source.cases) {
    const bytes = await readFile(resolve(dirname(inputPath), fixture.graph_path));
    if (createHash('sha256').update(bytes).digest('hex') !== fixture.graph_sha256) throw new Error('Changed tiny ONNX fixture');
    const session = await ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ['wasm'] });
    try {
      const feeds = Object.fromEntries(Object.entries(fixture.inputs).map(([name, input]) => [name, new ort.Tensor('float32', Float32Array.from(input.data), input.dims)]));
      const output = (await session.run(feeds)).output;
      const values = Array.from(output.data);
      const pass = output.type === 'float32' && JSON.stringify(output.dims) === JSON.stringify(fixture.expected.dims) && values.length === fixture.expected.data.length && values.every((v, index) => Object.is(v, fixture.expected.data[index]));
      report.cases.push({ id: fixture.id, dtype: output.type, dims: output.dims, values, exact_expected: pass ? 'PASS' : 'FAIL' });
      if (!pass) throw new Error('Actual Node WASM differs from independent exact expected values');
    } finally {
      await session.release();
    }
  }
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = { name: error instanceof Error ? error.name : 'RuntimeError', message: error instanceof Error ? error.message : String(error) };
  process.exitCode = 1;
}
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ status: report.status, cases: report.cases.length, scope: report.scope })}\n`);
