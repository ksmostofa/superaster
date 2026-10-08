#!/usr/bin/env node
// Run with `node --import tsx`. This verifies source files and a copied runtime;
// it does not rebuild a binary, run inference, or establish licensing admission.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, mkdir, copyFile, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--app-root', '--archives', '--output'].includes(key) || !value || args.has(key)) throw new Error('Usage: node --import tsx scripts/source-verification.mjs --app-root REPO --archives RETAINED_ARCHIVES --output NEW_DIRECTORY');
  args.set(key, resolve(value));
}
const app = args.get('--app-root') ?? process.cwd(), archives = args.get('--archives'), output = args.get('--output');
if (!archives || !output) throw new Error('--archives and --output are required');
await mkdir(output, { recursive: false });
const hash = async path => {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(path)) digest.update(bytes);
  return digest.digest('hex');
};
const report = {
  status: 'IN PROGRESS', scope: 'Source retention and identical-runtime external-path compiled-kernel checks only',
  started_at: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim(),
  node: process.version, command: process.argv, checks: [], source_rebuild: 'NOT RUN',
  modified_library_compatibility: 'NOT RUN', served_browser_service_worker_recombination: 'NOT RUN', model_inference: 'NOT RUN',
};
let runtime;
try {
  const manifest = JSON.parse(await readFile(join(app, 'third-party-licenses/sources/archives.json'), 'utf8'));
  report.source_manifest_sha256 = await hash(join(app, 'third-party-licenses/sources/archives.json'));
  for (const entry of manifest.entries) {
    const path = join(archives, `${entry.component}-${entry.version}.archive`), length = (await stat(path)).size, sha256 = await hash(path);
    assert.equal(length, entry.bytes); assert.equal(sha256, entry.sha256);
    report.checks.push({ id: `source-${entry.component}`, status: 'PASS', path, bytes: length, sha256, source_url: entry.url });
  }
  const directory = join(output, 'runtime'); await mkdir(directory);
  const files = ['vips.wasm', 'vips-node.mjs', 'vips-es6.js'];
  report.copied_runtime = [];
  for (const file of files) {
    const original = join(app, 'node_modules/wasm-vips/lib', file), replacement = join(directory, file);
    await copyFile(original, replacement); const original_hash = await hash(original), replacement_hash = await hash(replacement);
    assert.equal(replacement_hash, original_hash);
    report.copied_runtime.push({ file, original, replacement, sha256: replacement_hash, bytes: (await stat(replacement)).size });
  }
  assert.equal(report.copied_runtime[0].sha256, '36c25e290570757f911b45d67947e8262b01261028db438dadc09990ad978ff6');
  assert.equal(report.copied_runtime[0].bytes, 5154052);
  const { default: factory } = await import(pathToFileURL(join(directory, 'vips-node.mjs')).href);
  const requested = [];
  runtime = await factory({ dynamicLibraries: [], locateFile: file => { const path = join(directory, file); requested.push({ file, path }); return path; } });
  assert.equal(runtime.version(), '8.18.7'); runtime.concurrency(1);
  assert.ok(requested.some(entry => entry.file === 'vips.wasm' && entry.path === join(directory, 'vips.wasm')));
  assert.ok(requested.every(entry => entry.file === 'vips.wasm'), 'No optional plugins or other runtime assets should load');
  report.checks.push({ id: 'external-copy-initialization', status: 'PASS', libvips_version: runtime.version(), requested });
  const { BrowserKernel } = await import(pathToFileURL(join(app, 'packages/engines/src/browser-kernel.ts')).href);
  const { NativeImagingKernel } = await import(pathToFileURL(join(app, 'packages/engines/src/native.ts')).href);
  const { executePipeline } = await import(pathToFileURL(join(app, 'packages/engines/src/pipeline.ts')).href);
  const { parseRecipe } = await import(pathToFileURL(join(app, 'packages/contract/src/index.ts')).href);
  const wasm = new BrowserKernel(async () => runtime), native = new NativeImagingKernel();
  report.app_source_hashes = {};
  for (const file of ['packages/engines/src/browser-kernel.ts', 'packages/engines/src/native.ts', 'packages/engines/src/raster.ts', 'packages/engines/src/pipeline.ts', 'packages/contract/src/index.ts']) report.app_source_hashes[file] = await hash(join(app, file));
  const pixels = [40,80,200,128, 90,60,10,64, 20,130,70,0], raster = { width: 3, height: 1, data: Uint8Array.from(pixels) };
  const row = pixels.slice(0,4).concat(pixels.slice(0,4), pixels.slice(4,8), pixels.slice(4,8), pixels.slice(8,12), pixels.slice(8,12));
  const resized = await wasm.resize(raster, 6, 2, 'nearest'); assert.deepEqual([...resized.data], row.concat(row));
  report.checks.push({ id: 'copied-kernel-nearest-unassociated-rgba', status: 'PASS', pixels: [...resized.data] });
  const encoded = await wasm.encode(raster, { format: 'png', metadata: 'strip' }); await writeFile(join(output, 'unassociated-rgba.png'), encoded);
  const decoded = await native.decode(encoded); assert.deepEqual([...decoded.data], pixels); assert.deepEqual([decoded.width, decoded.height], [3,1]);
  report.checks.push({ id: 'copied-kernel-png-decoded-pixels', status: 'PASS', output: 'unassociated-rgba.png', sha256: await hash(join(output, 'unassociated-rgba.png')) });
  const recipe = parseRecipe({ spec_version: '1.0', input: { ref: 'explicit deterministic fixture' }, operations: [{ op: 'flip', axis: 'horizontal' }, { op: 'canvas', width: 8, height: 4, fit: 'contain', background: '#ffffff' }, { op: 'composite', background: '#ffffff' }], output: { format: 'png', metadata: 'strip', dpi: 300 } });
  const infer = async () => { throw new Error('This source/replacement check must never invoke model inference'); };
  const result = await executePipeline(encoded, recipe, { kernel: wasm, infer }); await writeFile(join(output, 'operation-result.png'), result.bytes);
  assert.deepEqual([result.record.output.width, result.record.output.height], [8,4]); assert.equal(result.record.output.metadata.density, 300); assert.equal(result.record.output.is_opaque, true);
  const normalized = await native.decode(result.bytes); assert.ok([...normalized.data].filter((_, i) => i % 4 === 3).every(alpha => alpha === 255));
  report.checks.push({ id: 'copied-kernel-common-operations-density-alpha', status: 'PASS', output: 'operation-result.png', record: result.record });
  const opaque = { width: 2, height: 3, data: Uint8Array.from(Array(6).fill([30,60,90,255]).flat()) };
  for (const format of ['jpeg', 'webp']) {
    const bytes = await wasm.encode(opaque, { format, metadata: 'strip', quality: 100 }); const info = await native.inspect(bytes);
    assert.equal(info.format, format); assert.deepEqual([info.width, info.height], [2,3]); assert.equal(info.is_opaque, true);
    await writeFile(join(output, `opaque.${format}`), bytes); report.checks.push({ id: `copied-kernel-${format}-decoded-container`, status: 'PASS', properties: info });
  }
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = { name: error.name, message: error.message }; throw error;
} finally {
  runtime?.shutdown(); report.finished_at = new Date().toISOString();
  await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, evidence: join(output, 'verification.json'), source_rebuild: report.source_rebuild, model_inference: report.model_inference }));
}
