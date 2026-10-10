import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { sha256 } from '../packages/core/src/index.js';
import { chooseModel, verifyModel } from '../packages/engines/src/native.js';
import type { Recipe, Progress } from '../packages/contract/src/index.js';

// Explicit opt-in keeps expensive, real model execution separate from deterministic suites.
// A skipped run is NOT RUN, never a gate pass. One model process runs at a time.
const continuationRoot = process.env.SUPERASTER_EXISTING_ACCEPTANCE_EVIDENCE ? resolve(process.env.SUPERASTER_EXISTING_ACCEPTANCE_EVIDENCE) : undefined;
const enabled = process.env.SUPERASTER_RUN_INFERENCE_ACCEPTANCE === '1' && !continuationRoot;
const acceptanceRoot = resolve(process.env.SUPERASTER_ACCEPTANCE_ROOT ?? '.');
const packageRoot = resolve(process.env.SUPERASTER_PACKAGE_ROOT ?? '.');
const modelDir = resolve(process.env.SUPERASTER_MODEL_DIR ?? '.cache/models');
const cliPath = join(packageRoot, 'dist/native/cli/src/index.js');
const sourceHash = '08eeb79ecc9b1b1ed5bf6c93631835005b240d24523303379384737694585734';
const modelHash = '6ea208a51de23aab41f42489e5764d1c9d70896fbef5f0a0666404dcd3c3b3d8';
const removal: Recipe = { spec_version: '1.0', input: { ref: 'input-0' }, engine: 'auto', quality: 'quality', operations: [{ op: 'remove_background', edge_cleanup: 'none' }], output: { format: 'png' } };
const preparation: Recipe = { spec_version: '1.0', input: { ref: 'input-0' }, operations: [{ op: 'canvas', width: 1200, height: 1200, fit: 'contain', position: 'center', background: '#ffffff' }], output: { format: 'webp', quality: 100, metadata: 'strip' } };
// Same installed native model/kernel/encoder should be bit-exact across thin adapters.
// This exact criterion is fixed before execution; it is not a browser inference tolerance.
const crossAdapterPixelTolerance = 0;
vi.setConfig({ testTimeout: 120000, hookTimeout: 30000 });
let sdk: typeof import('../packages/sdk/src/index.js');
let evidence: string;
let input: string;
let sdkOutput: string;
const observations: Record<string, unknown> = { status: 'NOT RUN', scope: 'Real native SDK/CLI/MCP workflow checks; browser and human subject-quality checks remain separate', cross_adapter_pixel_tolerance: crossAdapterPixelTolerance, human_intended_subject: 'NOT RUN', fresh_package_install: 'NOT RUN unless SUPERASTER_PACKAGE_ROOT identifies the clean installed package' };

const recordSchema = z.object({
  contract_version: z.string(), input_hash: z.string(), recipe_hash: z.string(), resolved_recipe: z.unknown(),
  engine: z.object({ id: z.string(), model_hash: z.string().nullable(), runtime: z.string(), backend: z.string() }).passthrough(),
  output: z.object({ width: z.number(), height: z.number(), format: z.string(), hash: z.string(), is_opaque: z.boolean().optional() }).passthrough(),
  timings_ms: z.record(z.string(), z.number()), warnings: z.array(z.string())
}).passthrough();
const removalPayload = z.object({ file: z.string(), resource_uri: z.string(), record_file: z.string(), record: recordSchema }).passthrough();

beforeAll(async () => {
  if (!enabled && !continuationRoot) return;
  await mkdir('.cache', { recursive: true }); evidence = await mkdtemp(resolve('.cache/inference-adapters-'));
  const manifest = z.object({ version: z.string(), t01: z.object({ path: z.string(), sha256: z.string(), width: z.number(), height: z.number(), license: z.string(), source_url: z.string(), source_sha256: z.string(), retained_subject: z.string() }).passthrough() }).passthrough()
    .parse(JSON.parse(await readFile(join(acceptanceRoot, 'benchmarks/fixtures/acceptance-manifest.json'), 'utf8')));
  expect(manifest.t01.sha256).toBe(sourceHash); expect([manifest.t01.width, manifest.t01.height]).toEqual([2400, 1600]);
  const fixture = join(acceptanceRoot, manifest.t01.path); expect(await sha256(await readFile(fixture))).toBe(sourceHash);
  input = continuationRoot ? join(continuationRoot, 'input.png') : join(evidence, 'input.png'); if (!continuationRoot) await copyFile(fixture, input); sdkOutput = join(continuationRoot ?? evidence, 'sdk-cutout.png');
  const model = chooseModel('auto', 'quality'); expect(model.sha256).toBe(modelHash); if (!continuationRoot) await verifyModel(join(modelDir, model.id + '.onnx'), model);
  sdk = await import(pathToFileURL(join(packageRoot, 'dist/native/sdk/src/index.js')).href);
  observations.conditions = {
    started_at: new Date().toISOString(), node: process.version, native_versions: sharp.versions,
    test_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    package_root: packageRoot, model_directory: modelDir, model, input: manifest.t01,
    compiled_hashes: Object.fromEntries(await Promise.all(['dist/native/sdk/src/index.js', 'dist/native/cli/src/index.js', 'dist/native/mcp/src/index.js', 'dist/native/engines/src/native.js', 'dist/native/engines/src/pipeline.js', 'dist/native/core/src/index.js', 'dist/native/contract/src/index.js'].map(async path => [path, await sha256(await readFile(join(packageRoot, path)))]))),
    parallel_inference_jobs: continuationRoot ? 0 : 1, download_condition: 'Approved existing model files verified by byte size and SHA-256 in initial run; cold download not exercised',
    ...(continuationRoot ? { continuation_from: continuationRoot, continuation_scope: 'Existing real inference outputs retained; only previously failing response assertion and unexecuted non-ML checks rerun' } : {})
  };
  if (process.env.SUPERASTER_SPEC_PATH) {
    const specBytes = await readFile(process.env.SUPERASTER_SPEC_PATH), header = specBytes.toString().match(/^Revision:\s*([\d.]+)/m);
    observations.specification = { revision: header?.[1]?.replace(/\.$/, ''), sha256: await sha256(specBytes) };
  }
});
afterAll(async () => {
  if ((!enabled && !continuationRoot) || !evidence) return;
  await writeFile(join(evidence, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
  console.info(`Real adapter evidence retained at ${evidence}`);
});

async function cli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((complete, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Real CLI workflow exceeded 120-second harness timeout')); }, 120000);
    child.stdout.on('data', data => { stdout += String(data); }); child.stderr.on('data', data => { stderr += String(data); });
    child.once('error', error => { clearTimeout(timeout); reject(error); }); child.once('close', code => { clearTimeout(timeout); complete({ code, stdout, stderr }); });
  });
}
async function decoded(path: string) { return sharp(await readFile(path)).autoOrient().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
async function cutout(path: string) {
  const bytes = await readFile(path), metadata = await sharp(bytes).metadata(), value = await decoded(path), source = await decoded(input);
  expect([metadata.width, metadata.height, metadata.format, metadata.pages ?? 1]).toEqual([2400, 1600, 'png', 1]);
  expect(metadata.hasAlpha).toBe(true); expect(metadata.exif).toBeUndefined(); expect(metadata.xmp).toBeUndefined(); expect(metadata.iptc).toBeUndefined(); expect(metadata.icc).toBeDefined();
  let transparent = 0, partial = 0, opaque = 0, opaqueRgbChanged = 0;
  for (let offset = 0; offset < value.data.length; offset += 4) {
    const alpha = value.data[offset + 3];
    if (alpha === 0) transparent++; else if (alpha === 255) { opaque++; if (value.data[offset] !== source.data[offset] || value.data[offset + 1] !== source.data[offset + 1] || value.data[offset + 2] !== source.data[offset + 2]) opaqueRgbChanged++; } else partial++;
  }
  expect(transparent).toBeGreaterThan(0); expect(partial).toBeGreaterThan(0); expect(opaque).toBeGreaterThan(0); expect(opaqueRgbChanged).toBe(0);
  const record = recordSchema.parse(JSON.parse(await readFile(path + '.json', 'utf8')));
  expect(record.input_hash).toBe(sourceHash); expect(record.engine.model_hash).toBe(modelHash); expect(record.engine.backend).toBe('cpu');
  expect(record.timings_ms.inference_kernel).toBeGreaterThan(0); expect(record.output.hash).toBe(await sha256(bytes));
  for (const [name, background] of [['white', '#ffffff'], ['black', '#000000'], ['color', '#d946ef']] as const) await sharp(bytes).flatten({ background }).png().toFile(path.replace('.png', '-' + name + '.png'));
  return { sha256: await sha256(bytes), bytes: bytes.length, transparent_pixels: transparent, partial_pixels: partial, opaque_pixels: opaque, opaque_rgb_changed: opaqueRgbChanged, record };
}
async function identicalPixels(a: string, b: string) {
  const [first, second] = await Promise.all([decoded(a), decoded(b)]);
  expect(first.info).toEqual(second.info); let maximum = 0;
  for (let offset = 0; offset < first.data.length; offset++) maximum = Math.max(maximum, Math.abs(first.data[offset]! - second.data[offset]!));
  expect(maximum).toBeLessThanOrEqual(crossAdapterPixelTolerance); return { maximum_channel_delta: maximum, first_pixel_sha256: await sha256(first.data), second_pixel_sha256: await sha256(second.data) };
}
async function prepared(path: string) {
  const bytes = await readFile(path), metadata = await sharp(bytes).metadata(), value = await decoded(path);
  expect([metadata.width, metadata.height, metadata.format, metadata.pages ?? 1]).toEqual([1200, 1200, 'webp', 1]); expect((await sharp(bytes).stats()).isOpaque).toBe(true);
  expect(metadata.exif).toBeUndefined(); expect(metadata.xmp).toBeUndefined(); expect(metadata.iptc).toBeUndefined(); expect(metadata.icc).toBeDefined();
  // The 2400×1600 source occupies exactly 1200×800 at y=200. Interior padding must stay white after lossy export.
  for (const [x, y] of [[0, 0], [600, 100], [600, 1100], [1199, 1199]]) {
    const offset = (y! * 1200 + x!) * 4; expect([...value.data.subarray(offset, offset + 4)]).toEqual([255, 255, 255, 255]);
  }
  return { sha256: await sha256(bytes), bytes: bytes.length, decoded_pixel_sha256: await sha256(value.data), metadata: { width: metadata.width, height: metadata.height, format: metadata.format, has_icc: Boolean(metadata.icc), exif: Boolean(metadata.exif) } };
}

describe.skipIf(!enabled)('real native inference through installed adapters', () => {
  it('T01 SDK and CLI preserve 2400×1600 and exact declared semantics with actual removal', async () => {
    const events: Progress[] = [], processor = sdk.createProcessor({ modelDir });
    try {
      const start = performance.now(); await sdk.transformFile(processor, input, removal, sdkOutput, { onProgress: event => events.push(event) });
      observations.sdk_elapsed_ms = performance.now() - start;
    } finally { await processor.dispose(); }
    observations.sdk = await cutout(sdkOutput); observations.sdk_progress = events;
    const cliOutput = join(evidence, 'cli-cutout.png'), command = await cli(['remove', input, '--output', cliOutput, '--quality', 'quality', '--model-dir', modelDir]);
    observations.cli_command = command; expect(command.code).toBe(0); observations.cli = await cutout(cliOutput);
    const sdkRecord = recordSchema.parse(JSON.parse(await readFile(sdkOutput + '.json', 'utf8'))), cliRecord = recordSchema.parse(JSON.parse(command.stdout));
    expect(cliRecord.recipe_hash).toBe(sdkRecord.recipe_hash); expect(cliRecord.resolved_recipe).toEqual(sdkRecord.resolved_recipe);
    observations.sdk_cli_pixels = await identicalPixels(sdkOutput, cliOutput); expect(await sha256(await readFile(input))).toBe(sourceHash);
    observations.t01_native = 'PASS for machine artifact/semantic checks; intended-subject human review and web workflow remain NOT RUN';
  });
  it('T11 fresh official MCP client discovers, inspects, removes, prepares WebP and validates actual accessible files', async () => {
    expect(observations.t01_native).toBeDefined();
    const transport = new StdioClientTransport({ command: process.execPath, args: [cliPath, 'mcp', '--roots', evidence, '--model-dir', modelDir], stderr: 'pipe' });
    const client = new Client({ name: 'superaster-independent-real-removal', version: '1.0.0' }, { capabilities: {} });
    const responses: Record<string, unknown> = {}; let maximumResponseBytes = 0;
    observations.mcp_responses = responses;
    const tool = async (name: string, args: Record<string, unknown>) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
      maximumResponseBytes = Math.max(maximumResponseBytes, Buffer.byteLength(JSON.stringify(result))); responses[name] = result;
      expect(result.isError).not.toBe(true); return result;
    };
    try {
      await client.connect(transport); const tools = await client.listTools(); responses.tools = tools;
      expect(tools.tools.map(item => item.name)).toEqual(expect.arrayContaining(['capabilities', 'inspect', 'remove', 'transform', 'validate']));
      await tool('capabilities', {}); const inspection = await tool('inspect', { input }); expect(inspection.structuredContent).toMatchObject({ image: { width: 2400, height: 1600, format: 'png' } });
      const removed = join(evidence, 'mcp-cutout.png'); const removalResult = removalPayload.parse((await tool('remove', { input, output: removed, quality: 'quality' })).structuredContent);
      expect(removalResult.file).toBe(removed); expect(removalResult.resource_uri).toBe(pathToFileURL(removed).href); expect(removalResult.record_file).toBe(removed + '.json');
      observations.mcp_cutout = await cutout(removed); observations.sdk_mcp_pixels = await identicalPixels(sdkOutput, removed);
      const output = join(evidence, 'mcp-prepared.webp'); const transformResult = removalPayload.parse((await tool('transform', { input: removed, output, recipe: preparation })).structuredContent);
      expect(transformResult.file).toBe(output); expect(transformResult.resource_uri).toBe(pathToFileURL(output).href); expect(transformResult.record_file).toBe(output + '.json');
      observations.mcp_prepared = await prepared(output);
      const validation = await tool('validate', { input: output, preset: 'shopify-product-square', version: '2026-10-08.1' });
      const checked = validationPayload.parse(validation.structuredContent);
      expectMandatoryRules(checked);
      const deniedPath = join(evidence, 'unsupported.webp'), unsupported = await client.callTool({ name: 'transform', arguments: { input: removed, output: deniedPath, recipe: { ...preparation, operations: [{ op: 'generate' }] } } });
      expect(unsupported.isError).toBe(true); responses.unsupported = unsupported;
      await expect(readFile(deniedPath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(maximumResponseBytes).toBeLessThan(20000); expect(await sha256(await readFile(input))).toBe(sourceHash);
      observations.t11 = 'PASS for actual native MCP artifact workflow; human image quality and clean installation remain separately recorded';
      observations.mcp_responses = responses; observations.maximum_mcp_response_bytes = maximumResponseBytes;
    } finally { await client.close(); await transport.close(); }
    // The MCP process is now closed before another SDK process can initialize a model.
    const expectedPath = join(evidence, 'sdk-prepared.webp'), processor = sdk.createProcessor({ modelDir });
    try { await sdk.transformFile(processor, sdkOutput, preparation, expectedPath); } finally { await processor.dispose(); }
    observations.sdk_prepared = await prepared(expectedPath); observations.prepared_pixels = await identicalPixels(expectedPath, join(evidence, 'mcp-prepared.webp'));
    observations.status = 'PASS for the executed machine checks only';
  });
});

// Contract index.ts defines RuleOutcome.state, not status. Keeping the captured
// failure proves this test correction follows the declared API rather than hiding a product failure.
const validationPayload = z.object({ rules: z.array(z.object({ id: z.string(), state: z.enum(['pass', 'fail', 'needs_review', 'not_checked']) }).passthrough()) }).passthrough();
function expectMandatoryRules(value: z.infer<typeof validationPayload>) {
  expect(value.rules).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'maximum-size', state: 'pass' }), expect.objectContaining({ id: 'bytes', state: 'pass' }), expect.objectContaining({ id: 'formats', state: 'pass' }), expect.objectContaining({ id: 'recommended-size', state: 'fail' }), expect.objectContaining({ id: 'shape', state: 'needs_review' })]));
}
describe.skipIf(!continuationRoot)('retained actual removal evidence, non-ML continuation', () => {
  it('checks declared rule response and completes unsupported-request and exact SDK preparation checks without reinference', async () => {
    if (!continuationRoot) throw new Error('Explicit prior actual evidence is required');
    const priorBytes = await readFile(join(continuationRoot, 'observations.json'));
    const prior = z.object({ t01_native: z.string(), conditions: z.object({ compiled_hashes: z.record(z.string(), z.string()) }).passthrough(), mcp_responses: z.record(z.string(), z.unknown()), mcp_cutout: z.object({ sha256: z.string() }).passthrough(), mcp_prepared: z.object({ sha256: z.string() }).passthrough() }).passthrough().parse(JSON.parse(priorBytes.toString()));
    observations.previous_observations_sha256 = await sha256(priorBytes);
    for (const [path, hash] of Object.entries(prior.conditions.compiled_hashes)) expect(await sha256(await readFile(join(packageRoot, path)))).toBe(hash);
    const captured = z.object({ structuredContent: validationPayload }).passthrough().parse(prior.mcp_responses.validate); expectMandatoryRules(captured.structuredContent);
    const removed = join(continuationRoot, 'mcp-cutout.png'), preparedPath = join(continuationRoot, 'mcp-prepared.webp');
    expect(await sha256(await readFile(input))).toBe(sourceHash); expect(await sha256(await readFile(removed))).toBe(prior.mcp_cutout.sha256); expect(await sha256(await readFile(preparedPath))).toBe(prior.mcp_prepared.sha256);
    const transport = new StdioClientTransport({ command: process.execPath, args: [cliPath, 'mcp', '--roots', [continuationRoot, evidence].join(','), '--model-dir', modelDir], stderr: 'pipe' });
    const client = new Client({ name: 'superaster-independent-nonml-continuation', version: '1.0.0' }, { capabilities: {} });
    try {
      await client.connect(transport);
      const validation = await client.callTool({ name: 'validate', arguments: { input: preparedPath, preset: 'shopify-product-square', version: '2026-10-08.1' } });
      observations.validation = validation; expect(validation.isError).not.toBe(true); expectMandatoryRules(validationPayload.parse(validation.structuredContent));
      const deniedPath = join(evidence, 'unsupported.webp'), unsupported = await client.callTool({ name: 'transform', arguments: { input: removed, output: deniedPath, recipe: { ...preparation, operations: [{ op: 'generate' }] } } });
      observations.unsupported = unsupported; expect(unsupported.isError).toBe(true); await expect(readFile(deniedPath)).rejects.toMatchObject({ code: 'ENOENT' });
      const responseSizes = Object.values(prior.mcp_responses).map(value => Buffer.byteLength(JSON.stringify(value))); observations.maximum_mcp_response_bytes = Math.max(...responseSizes); expect(observations.maximum_mcp_response_bytes).toBeLessThan(20000);
    } finally { await client.close(); await transport.close(); }
    const expected = join(evidence, 'sdk-prepared.webp'), processor = sdk.createProcessor({ modelDir });
    try { await sdk.transformFile(processor, sdkOutput, preparation, expected); } finally { await processor.dispose(); }
    observations.sdk_prepared = await prepared(expected); observations.prepared_pixels = await identicalPixels(expected, preparedPath);
    observations.status = 'PASS for corrected response assertion and previously unexecuted non-ML checks; real removal evidence is the original identified run';
  });
});
