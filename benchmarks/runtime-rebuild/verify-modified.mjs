#!/usr/bin/env node
// Deterministic compatibility checks for an actually compiled modified library.
// Run with `node --import tsx` from the identified application checkout.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  assert.ok(['--app-root', '--runtime', '--output'].includes(key) && value && !args.has(key));
  args.set(key, resolve(value));
}
const app = args.get('--app-root'), directory = args.get('--runtime'), output = args.get('--output');
assert.ok(app && directory && output, '--app-root, --runtime and new --output directory are required');
await mkdir(output, { recursive: false });
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const report = {
  status: 'IN PROGRESS', scope: 'Modified library initialization and deterministic imaging compatibility under Node',
  app_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim(),
  started_at: new Date().toISOString(), node: process.version, checks: [], outputs: [],
  source_rebuild: 'Requires separate completed compiler evidence',
  served_browser_recombination: 'NOT RUN', model_inference: 'NOT RUN', historical_binary_reproduction: 'NOT ASSERTED',
};
let modified, original;
try {
  report.runtime_files = [];
  for (const name of ['vips.wasm', 'vips-node.mjs', 'vips-es6.js']) {
    const file = join(directory, name);
    report.runtime_files.push({ name, file, bytes: (await stat(file)).size, sha256: await hash(file) });
  }
  const official = join(app, 'node_modules/wasm-vips/lib');
  assert.equal(await hash(join(official, 'vips.wasm')), '36c25e290570757f911b45d67947e8262b01261028db438dadc09990ad978ff6');
  assert.notEqual(report.runtime_files[0].sha256, await hash(join(official, 'vips.wasm')), 'Copied supplier binary is not a modified source rebuild');
  const { default: modifiedFactory } = await import(pathToFileURL(join(directory, 'vips-node.mjs')).href);
  const { default: originalFactory } = await import(pathToFileURL(join(official, 'vips-node.mjs')).href);
  const requested = [];
  modified = await modifiedFactory({ dynamicLibraries: [], locateFile: file => {
    const path = join(directory, file); requested.push({ file, path }); return path;
  } });
  original = await originalFactory({ dynamicLibraries: [], locateFile: file => join(official, file) });
  modified.concurrency(1); original.concurrency(1);
  assert.equal(original.version(), '8.18.7');
  assert.equal(modified.version(), '8.18.7-superaster-modified');
  assert.ok(requested.some(item => item.path === join(directory, 'vips.wasm')));
  assert.ok(requested.every(item => item.file === 'vips.wasm'));
  report.checks.push({ id: 'actual-modified-library-loaded', status: 'PASS', version: modified.version(), requested });
  const { BrowserKernel } = await import(pathToFileURL(join(app, 'packages/engines/src/browser-kernel.ts')).href);
  const { NativeImagingKernel } = await import(pathToFileURL(join(app, 'packages/engines/src/native.ts')).href);
  const { executePipeline } = await import(pathToFileURL(join(app, 'packages/engines/src/pipeline.ts')).href);
  const { parseRecipe } = await import(pathToFileURL(join(app, 'packages/contract/src/index.ts')).href);
  const kernel = new BrowserKernel(async () => modified), baseline = new BrowserKernel(async () => original);
  const native = new NativeImagingKernel();
  report.app_source_hashes = {};
  for (const file of ['packages/engines/src/browser-kernel.ts', 'packages/engines/src/raster.ts', 'packages/engines/src/pipeline.ts', 'packages/contract/src/index.ts']) report.app_source_hashes[file] = await hash(join(app, file));
  const fixture = { width: 3, height: 1, data: Uint8Array.from([40,80,200,128, 90,60,10,64, 20,130,70,0]) };
  const row = [...fixture.data.slice(0,4), ...fixture.data.slice(0,4), ...fixture.data.slice(4,8), ...fixture.data.slice(4,8), ...fixture.data.slice(8,12), ...fixture.data.slice(8,12)];
  const resized = await kernel.resize(fixture, 6, 2, 'nearest');
  assert.deepEqual([...resized.data], row.concat(row));
  report.checks.push({ id: 'nearest-exact-unassociated-rgba', status: 'PASS', pixels: [...resized.data] });
  const encoded = await kernel.encode(fixture, { format: 'png', metadata: 'strip' });
  const decoded = await native.decode(encoded);
  assert.deepEqual([decoded.width, decoded.height], [3,1]); assert.deepEqual([...decoded.data], [...fixture.data]);
  await writeFile(join(output, 'unassociated-rgba.png'), encoded);
  report.checks.push({ id: 'png-actual-decoded-pixels', status: 'PASS' });
  const recipe = parseRecipe({ spec_version: '1.0', input: { ref: 'deterministic source-rebuild fixture' },
    operations: [{ op: 'flip', axis: 'horizontal' }, { op: 'canvas', width: 8, height: 4, fit: 'contain', background: '#ffffff' }, { op: 'composite', background: '#ffffff' }],
    output: { format: 'png', metadata: 'strip', dpi: 300 } });
  const infer = async () => { throw new Error('This check must not invoke model inference'); };
  const result = await executePipeline(encoded, recipe, { kernel, infer });
  const originalResult = await executePipeline(encoded, recipe, { kernel: baseline, infer });
  const resultPixels = await native.decode(result.bytes), originalPixels = await native.decode(originalResult.bytes);
  assert.deepEqual([result.record.output.width, result.record.output.height], [8,4]);
  assert.equal(result.record.output.metadata.density, 300); assert.equal(result.record.output.is_opaque, true);
  assert.deepEqual([...resultPixels.data], [...originalPixels.data]);
  await writeFile(join(output, 'operation-result.png'), result.bytes);
  report.checks.push({ id: 'ordered-operations-density-alpha-and-original-pixel-parity', status: 'PASS', record: result.record });
  const opaque = { width: 2, height: 3, data: Uint8Array.from(Array(6).fill([30,60,90,255]).flat()) };
  for (const format of ['jpeg', 'webp']) {
    const bytes = await kernel.encode(opaque, { format, metadata: 'strip', quality: 100 });
    const info = await native.inspect(bytes), pixels = await native.decode(bytes);
    assert.equal(info.format, format); assert.deepEqual([info.width, info.height], [2,3]); assert.equal(info.is_opaque, true);
    assert.equal(pixels.data.length, 24);
    await writeFile(join(output, `opaque.${format}`), bytes);
    report.checks.push({ id: `${format}-decoded-container`, status: 'PASS', properties: info });
  }
  for (const name of ['unassociated-rgba.png', 'operation-result.png', 'opaque.jpeg', 'opaque.webp']) report.outputs.push({ name, bytes: (await stat(join(output, name))).size, sha256: await hash(join(output, name)) });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = { name: error.name, message: error.message }; throw error;
} finally {
  modified?.shutdown(); original?.shutdown();
  report.finished_at = new Date().toISOString();
  await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, evidence: join(output, 'verification.json') }));
}
