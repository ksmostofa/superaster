import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, stat, symlink, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import * as sdk from '../packages/sdk/src/index.js';
import { fileBatch } from '../packages/cli/src/batch.js';
import { sha256 } from '../packages/core/src/index.js';
import { parseRecipe, type Recipe } from '../packages/contract/src/index.js';

// Real decoded images and production adapters only. No inference runs in this suite.
// Multiple fresh CLI starts and decoded-image checks exceed Vitest's five-second default.
vi.setConfig({ testTimeout: 30000, hookTimeout: 15000 });
const cliPath = resolve('dist/native/cli/src/index.js');
let runRoot: string;
const observations: Record<string, unknown> = {};
beforeAll(async () => {
  await mkdir('.cache', { recursive: true });
  runRoot = await mkdtemp(resolve('.cache/adapter-verification-'));
  observations.run_root = runRoot;
  observations.node = process.version;
});
afterAll(async () => {
  await writeFile(join(runRoot, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
  console.info(`Adapter evidence retained at ${runRoot}`);
});

const recipe = (width = 24, height = 24, format: Recipe['output']['format'] = 'png') => parseRecipe({
  spec_version: '1.0', input: { ref: 'fixture' },
  operations: [{ op: 'canvas', width, height, fit: 'contain', background: '#ffffff' }],
  output: { format, quality: 100, metadata: 'strip' }
});
async function image(path: string, rgb: readonly number[] = [120, 30, 200], width = 16, height = 12) {
  await mkdir(resolve(path, '..'), { recursive: true });
  const bytes = await sharp({ create: { width, height, channels: 4, background: { r: rgb[0]!, g: rgb[1]!, b: rgb[2]!, alpha: 1 } } }).png().toBuffer();
  await writeFile(path, bytes);
  return sha256(bytes);
}
async function exists(path: string) { return access(path).then(() => true, () => false); }
async function cli(args: string[], cancelAfterCompletions?: number) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; completions: number }>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', pending = '', completions = 0;
    let sent = false;
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI exceeded 30 seconds')); }, 30000);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => {
      stderr += String(chunk); pending += String(chunk);
      const lines = pending.split('\n'); pending = lines.pop()!;
      for (const line of lines) {
        if (line.includes('"stage":"complete"')) completions++;
        if (!sent && cancelAfterCompletions && completions >= cancelAfterCompletions) {
          sent = true; child.kill('SIGINT');
        }
      }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => { clearTimeout(timeout); resolveResult({ code, stdout, stderr, completions }); });
  });
}
async function writeRecipe(directory: string, value: Recipe) {
  const path = join(directory, 'recipe.json'); await writeFile(path, JSON.stringify(value)); return path;
}
async function pixel(path: string, x: number, y: number) {
  const { data, info } = await sharp(await readFile(path)).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
}
async function checkOutput(path: string, rgb: readonly number[], width = 24, height = 24) {
  const bytes = await readFile(path);
  const metadata = await sharp(bytes).metadata();
  expect([metadata.width, metadata.height, metadata.format, metadata.pages ?? 1]).toEqual([width, height, 'png', 1]);
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeDefined();
  expect((await sharp(bytes).stats()).isOpaque).toBe(true);
  expect(await pixel(path, 0, 0)).toEqual([255, 255, 255, 255]);
  expect(await pixel(path, Math.floor(width / 2), Math.floor(height / 2))).toEqual([...rgb, 255]);
  return sha256(bytes);
}
interface BatchManifest {
  recipe_hash: string;
  entries: Array<{ id: string; source: string; output: string; input_hash: string; recipe_hash: string; output_hash?: string; status: string; error?: { code: string } }>;
}
const manifest = (text: string) => JSON.parse(text) as BatchManifest;
async function snapshots(value: BatchManifest) {
  const result: Record<string, { hash: string; mtime: string }> = {};
  for (const entry of value.entries.filter(entry => entry.status === 'completed')) result[entry.id] = {
    hash: await sha256(await readFile(entry.output)), mtime: String((await stat(entry.output, { bigint: true })).mtimeNs)
  };
  return result;
}

describe('SDK deterministic file contracts', () => {
  it('matches CLI decoded output, recipe/input/output identities and preserves input', async () => {
    const directory = await mkdtemp(join(runRoot, 'sdk-cli-'));
    const input = join(directory, 'source.png'), output = join(directory, 'sdk.png'), cliOutput = join(directory, 'cli.png');
    const rgb = [120, 30, 200], inputHash = await image(input, rgb);
    const processor = sdk.createProcessor();
    try {
      const record = await sdk.transformFile(processor, input, recipe(), output);
      const command = await cli(['run', await writeRecipe(directory, recipe()), '--input', input, '--output', cliOutput]);
      expect(command.code).toBe(0);
      const cliRecord = JSON.parse(command.stdout) as { input_hash: string; recipe_hash: string; output: { hash: string } };
      const outputHash = await checkOutput(output, rgb);
      expect(await checkOutput(cliOutput, rgb)).toBe(outputHash);
      expect(cliRecord).toMatchObject({ input_hash: record.input_hash, recipe_hash: record.recipe_hash, output: { hash: record.output.hash } });
      expect(record.input_hash).toBe(inputHash);
      expect(await sha256(await readFile(input))).toBe(inputHash);
      observations.sdk_cli = { input_hash: inputHash, output_hash: outputHash, recipe_hash: record.recipe_hash, command };
    } finally { await processor.dispose(); }
  });
  it('rejects root-prefix siblings and read/write symlink escapes', async () => {
    const directory = await mkdtemp(join(runRoot, 'sdk-roots-'));
    const allowed = join(directory, 'allowed'), outside = join(directory, 'allowed-sibling');
    await mkdir(allowed); await mkdir(outside);
    const external = join(outside, 'source.png'); await image(external);
    await symlink(external, join(allowed, 'input-link.png'));
    await symlink(outside, join(allowed, 'output-link'));
    await expect(sdk.assertAllowedPath(external, [allowed])).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(sdk.assertAllowedPath(join(allowed, 'input-link.png'), [allowed])).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(sdk.assertAllowedPath(join(allowed, 'output-link', 'new.png'), [allowed], 'write')).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });
  it('protects original and pre-existing output without explicit overwrite', async () => {
    const directory = await mkdtemp(join(runRoot, 'sdk-overwrite-'));
    const input = join(directory, 'source.png'), output = join(directory, 'existing.png');
    const sourceHash = await image(input); const existingHash = await image(output, [5, 6, 7]);
    const processor = sdk.createProcessor();
    try {
      await expect(sdk.transformFile(processor, input, recipe(), input)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
      await expect(sdk.transformFile(processor, input, recipe(), output)).rejects.toThrow();
      expect(await sha256(await readFile(input))).toBe(sourceHash);
      expect(await sha256(await readFile(output))).toBe(existingHash);
    } finally { await processor.dispose(); }
  });
  it('exposes destination resolution and validation in the public SDK', () => {
    expect(sdk).toHaveProperty('resolvePreset', expect.any(Function));
    expect(sdk).toHaveProperty('validate', expect.any(Function));
  });
  it('bounds concurrent SDK transformations to the declared serial limit', async () => {
    const directory = await mkdtemp(join(runRoot, 'sdk-concurrency-')), input = join(directory, 'source.png');
    await image(input); const bytes = await readFile(input), processor = sdk.createProcessor();
    let active = 0, maximum = 0;
    try {
      const outputs = await Promise.all(Array.from({ length: 4 }, () => processor.transform(bytes, recipe(128, 128), {
        onProgress: progress => { if (progress.stage === 'decode') { active++; maximum = Math.max(maximum, active); } if (progress.stage === 'complete') active--; }
      })));
      expect(maximum).toBe(1); expect(active).toBe(0); expect(outputs).toHaveLength(4);
      for (const output of outputs) expect(output.record.output).toMatchObject({ width: 128, height: 128, is_opaque: true });
      observations.sdk_concurrency = { maximum_active: maximum, declared_limit: processor.capabilities().limits.max_concurrency };
    } finally { await processor.dispose(); }
  });
});

describe('real CLI batches and interruption', () => {
  it('processes 19 valid files and one corrupt input, retries only changed failed work', async () => {
    const directory = await mkdtemp(join(runRoot, 'batch20-'));
    const source = join(directory, 'inputs'), output = join(directory, 'outputs'); await mkdir(source);
    const hashes: Record<string, string> = {};
    for (let index = 0; index < 19; index++) hashes[`photo-${String(index).padStart(2, '0')}.png`] = await image(join(source, `photo-${String(index).padStart(2, '0')}.png`), [index * 10, 40, 200]);
    await writeFile(join(source, 'photo-19.png'), 'corrupt image fixture');
    const recipePath = await writeRecipe(directory, recipe());
    const first = await cli(['batch', source, '--recipe', recipePath, '--output', output]);
    expect(first.code).toBe(5); const initial = manifest(first.stdout);
    expect(initial.entries.filter(entry => entry.status === 'completed')).toHaveLength(19);
    expect(initial.entries.filter(entry => entry.status === 'failed')).toHaveLength(1);
    expect(initial.entries.find(entry => entry.status === 'failed')).toMatchObject({ id: 'photo-19.png', error: { code: 'INVALID_INPUT' } });
    for (let index = 0; index < 19; index++) {
      const id = `photo-${String(index).padStart(2, '0')}.png`, entry = initial.entries.find(entry => entry.id === id)!;
      expect(await checkOutput(entry.output, [index * 10, 40, 200])).toBe(entry.output_hash);
      expect(await sha256(await readFile(entry.source))).toBe(hashes[id]);
    }
    const before = await snapshots(initial);
    hashes['photo-19.png'] = await image(join(source, 'photo-19.png'), [190, 40, 200]);
    const retried = await cli(['batch', source, '--recipe', recipePath, '--output', output, '--retry']);
    expect(retried.code).toBe(0); const recovered = manifest(retried.stdout);
    expect(recovered.entries.filter(entry => entry.status === 'completed')).toHaveLength(20);
    const after = await snapshots(recovered);
    for (const id of Object.keys(before)) expect(after[id]).toEqual(before[id]);
    expect(await checkOutput(recovered.entries.find(entry => entry.id === 'photo-19.png')!.output, [190, 40, 200])).toBe(after['photo-19.png']!.hash);
    observations.batch20 = { inputs: hashes, first, retried, initial, recovered, before, after };
  });
  it('preserves duplicate basenames across folders and rejects case collisions before writes', async () => {
    const directory = await mkdtemp(join(runRoot, 'names-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    await image(join(source, 'a', 'same.png'), [200, 10, 20]); await image(join(source, 'b', 'same.png'), [20, 10, 200]);
    const recipePath = await writeRecipe(directory, recipe());
    const result = await cli(['batch', source, '--recipe', recipePath, '--output', output]);
    expect(result.code).toBe(0); const entries = manifest(result.stdout).entries;
    expect(entries.map(entry => entry.id)).toEqual(['a/same.png', 'b/same.png']);
    expect(entries[0]!.output).not.toBe(entries[1]!.output);
    await checkOutput(entries[0]!.output, [200, 10, 20]); await checkOutput(entries[1]!.output, [20, 10, 200]);
    const collisionSource = join(directory, 'collision-inputs'), collisionOutput = join(directory, 'collision-outputs');
    await image(join(collisionSource, 'A.png')); await image(join(collisionSource, 'a.png'));
    const collision = await cli(['batch', collisionSource, '--recipe', recipePath, '--output', collisionOutput]);
    expect(collision.code).toBe(2); expect(collision.stderr).toContain('Output filename collision');
    expect(await exists(collisionOutput)).toBe(false);
    observations.names = { result, collision };
  });
  it('resumes matching outputs, reruns changed input/recipe and repairs stale output', async () => {
    const directory = await mkdtemp(join(runRoot, 'resume-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    await image(join(source, 'a.png'), [200, 20, 30]); await image(join(source, 'b.png'), [30, 20, 200]);
    const recipePath = await writeRecipe(directory, recipe());
    const initial = manifest((await cli(['batch', source, '--recipe', recipePath, '--output', output])).stdout);
    const before = await snapshots(initial);
    const unchanged = manifest((await cli(['batch', source, '--recipe', recipePath, '--output', output, '--resume'])).stdout);
    expect(await snapshots(unchanged)).toEqual(before);
    await image(join(source, 'a.png'), [10, 200, 30]);
    const changedInputCommand = await cli(['batch', source, '--recipe', recipePath, '--output', output, '--resume']);
    expect(changedInputCommand.code).toBe(0); const changedInput = manifest(changedInputCommand.stdout);
    const afterInput = await snapshots(changedInput);
    expect(afterInput['a.png']!.hash).not.toBe(before['a.png']!.hash);
    expect(afterInput['b.png']).toEqual(before['b.png']);
    await checkOutput(changedInput.entries.find(entry => entry.id === 'a.png')!.output, [10, 200, 30]);
    await writeFile(changedInput.entries.find(entry => entry.id === 'b.png')!.output, 'stale output fixture');
    const repairedCommand = await cli(['batch', source, '--recipe', recipePath, '--output', output, '--resume']);
    expect(repairedCommand.code).toBe(0); const repaired = manifest(repairedCommand.stdout);
    await checkOutput(repaired.entries.find(entry => entry.id === 'b.png')!.output, [30, 20, 200]);
    await writeFile(recipePath, JSON.stringify(recipe(30, 30)));
    const changedRecipeCommand = await cli(['batch', source, '--recipe', recipePath, '--output', output, '--resume']);
    expect(changedRecipeCommand.code).toBe(0); const changedRecipe = manifest(changedRecipeCommand.stdout);
    expect(changedRecipe.recipe_hash).not.toBe(initial.recipe_hash);
    for (const entry of changedRecipe.entries) await checkOutput(entry.output, entry.id === 'a.png' ? [10, 200, 30] : [30, 20, 200], 30, 30);
    observations.resume = { before, afterInput, changedInputCommand, repairedCommand, changedRecipeCommand };
  });
  it('handles SIGINT after completions and resumes without replacing completed outputs', async () => {
    const directory = await mkdtemp(join(runRoot, 'cancel-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    for (let index = 0; index < 20; index++) await image(join(source, `${String(index).padStart(2, '0')}.png`), [index * 10, 40, 200], 512, 384);
    const recipePath = await writeRecipe(directory, recipe(1024, 1024));
    const cancelled = await cli(['batch', source, '--recipe', recipePath, '--output', output], 3);
    expect(cancelled.code).toBe(5); const partial = manifest(cancelled.stdout);
    const completed = partial.entries.filter(entry => entry.status === 'completed'), cancelledEntries = partial.entries.filter(entry => entry.status === 'cancelled');
    expect(completed.length).toBeGreaterThanOrEqual(3); expect(completed.length).toBeLessThan(20);
    expect(cancelledEntries.length).toBeGreaterThan(0); expect(partial.entries.filter(entry => entry.status === 'failed')).toHaveLength(0);
    const before = await snapshots(partial);
    const resumedCommand = await cli(['batch', source, '--recipe', recipePath, '--output', output, '--resume']);
    expect(resumedCommand.code).toBe(0); const resumed = manifest(resumedCommand.stdout); const after = await snapshots(resumed);
    expect(resumed.entries.filter(entry => entry.status === 'completed')).toHaveLength(20);
    for (const id of Object.keys(before)) expect(after[id]).toEqual(before[id]);
    for (const entry of resumed.entries) await checkOutput(entry.output, [Number.parseInt(entry.id, 10) * 10, 40, 200], 1024, 1024);
    observations.cancel = { cancelled, partial, resumedCommand, before, after };
  }, 30000);
  it('returns an invalid-recipe exit for malformed JSON before writing output', async () => {
    const directory = await mkdtemp(join(runRoot, 'invalid-json-')), input = join(directory, 'source.png'), output = join(directory, 'result.png');
    await image(input); const recipePath = join(directory, 'recipe.json'); await writeFile(recipePath, '{broken');
    const result = await cli(['run', recipePath, '--input', input, '--output', output]);
    observations.invalid_json = result;
    expect.soft(result.code).toBe(2); expect.soft(result.stderr).toContain('INVALID_RECIPE'); expect(await exists(output)).toBe(false);
  });
  it('serial SDK file batch cancellation retains completed files and marks unscheduled entries', async () => {
    const directory = await mkdtemp(join(runRoot, 'sdk-cancel-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    for (let index = 0; index < 6; index++) await image(join(source, `${index}.png`), [index * 20, 10, 100]);
    const controller = new AbortController(), processor = sdk.createProcessor(); let count = 0;
    try {
      const result = await fileBatch(processor, source, output, recipe(), {
        signal: controller.signal, onProgress: progress => { if (progress.stage === 'complete' && ++count === 2) controller.abort(); }
      });
      expect(result.entries.filter(entry => entry.status === 'completed')).toHaveLength(2);
      expect(result.entries.filter(entry => entry.status === 'cancelled')).toHaveLength(4);
      for (const entry of result.entries.slice(0, 2)) await checkOutput(entry.output, [Number.parseInt(entry.id, 10) * 20, 10, 100]);
      for (const entry of result.entries.slice(2)) expect(await exists(entry.output)).toBe(false);
      observations.sdk_cancel = result;
    } finally { await processor.dispose(); }
  });
  it('rejects malformed resume manifests before processing or output creation', async () => {
    const directory = await mkdtemp(join(runRoot, 'manifest-invalid-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    await image(join(source, 'source.png')); await mkdir(output);
    const invalid = JSON.stringify({ version: '1.0', recipe_hash: 'invalid fixture', entries: [null] });
    await writeFile(join(output, 'manifest.json'), invalid);
    const result = await cli(['batch', source, '--recipe', await writeRecipe(directory, recipe()), '--output', output, '--resume']);
    observations.invalid_manifest = result;
    expect.soft(result.code).toBe(2); expect.soft(result.stderr).toContain('INVALID_INPUT');
    expect(await exists(join(output, 'source.png.png'))).toBe(false);
    expect(await readFile(join(output, 'manifest.json'), 'utf8')).toBe(invalid);
  });
  it('never claims ownership of a pre-existing output after a collision failure', async () => {
    const directory = await mkdtemp(join(runRoot, 'ownership-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    await image(join(source, 'source.png')); const originalOutput = join(output, 'source.png.png');
    const protectedHash = await image(originalOutput, [10, 200, 40], 24, 24);
    const recipePath = await writeRecipe(directory, recipe());
    const first = await cli(['batch', source, '--recipe', recipePath, '--output', output]);
    expect(first.code).toBe(5); expect(await sha256(await readFile(originalOutput))).toBe(protectedHash);
    const retry = await cli(['batch', source, '--recipe', recipePath, '--output', output, '--retry']);
    const finalHash = await sha256(await readFile(originalOutput));
    observations.preexisting_ownership = { protected_hash: protectedHash, final_hash: finalHash, first, retry };
    expect.soft(retry.code).toBe(5); expect.soft(finalHash).toBe(protectedHash);
    expect(await exists(originalOutput + '.json')).toBe(false);
  });
  it('includes bound mask identities in batch resume while retaining unchanged outputs', async () => {
    const directory = await mkdtemp(join(runRoot, 'bindings-')), source = join(directory, 'inputs'), output = join(directory, 'outputs');
    await image(join(source, 'source.png')); const maskPath = join(directory, 'mask.png'); await image(maskPath, [128, 128, 128]);
    const boundRecipe = parseRecipe({ ...recipe(), operations: [{ op: 'correct', mask_ref: 'mask' }, ...recipe().operations] });
    const processor = sdk.createProcessor();
    try {
      const initial = await fileBatch(processor, source, output, boundRecipe, { bindings: { mask: await readFile(maskPath) } });
      const before = await snapshots(initial);
      const unchanged = await fileBatch(processor, source, output, boundRecipe, { resume: true, bindings: { mask: await readFile(maskPath) } });
      expect(await snapshots(unchanged)).toEqual(before);
      await image(maskPath, [64, 64, 64]);
      const changed = await fileBatch(processor, source, output, boundRecipe, { resume: true, bindings: { mask: await readFile(maskPath) } });
      expect(changed.recipe_hash).not.toBe(initial.recipe_hash); expect(changed.entries[0]!.output_hash).not.toBe(initial.entries[0]!.output_hash);
      const record = JSON.parse(await readFile(changed.entries[0]!.record, 'utf8')) as { recipe_hash: string; binding_hashes: Record<string, string> };
      expect(record.recipe_hash).toBe(changed.recipe_hash); expect(record.binding_hashes.mask).toBe(await sha256(await readFile(maskPath)));
      observations.batch_bindings = { initial, unchanged, changed, record };
    } finally { await processor.dispose(); }
  });
});

async function withMcp(roots: string[], action: (client: Client) => Promise<void>) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [cliPath, 'mcp', '--roots', roots.join(',')], stderr: 'pipe' });
  const client = new Client({ name: 'superaster-independent-acceptance', version: '1.0.0' }, { capabilities: {} });
  try { await client.connect(transport); await action(client); }
  finally { await client.close(); await transport.close(); }
}
function errorPayload(result: Awaited<ReturnType<Client['callTool']>>) {
  const payload = z.object({ content: z.array(z.object({ type: z.literal('text'), text: z.string() })) }).parse(result);
  if (!payload.content[0]) throw new Error('Expected structured MCP text error');
  return JSON.parse(payload.content[0].text) as unknown;
}
describe('fresh actual MCP stdio client', () => {
  it('shares explicit mask/background binding semantics across SDK, CLI and MCP and guards each path', async () => {
    const directory = await mkdtemp(join(runRoot, 'bindings-adapters-')), allowed = join(directory, 'allowed'), outside = join(directory, 'outside'); await mkdir(allowed); await mkdir(outside);
    const input = join(allowed, 'source.png'), mask = join(allowed, 'mask.png'), background = join(allowed, 'background.png');
    await image(input); await image(mask, [64, 64, 64]); await image(background, [10, 50, 90]);
    const boundRecipe = parseRecipe({ ...recipe(), operations: [{ op: 'correct', mask_ref: 'mask' }, { op: 'composite', image_ref: 'background' }] });
    const processor = sdk.createProcessor(), sdkOutput = join(allowed, 'sdk.png'), cliOutput = join(allowed, 'cli.png'), mcpOutput = join(allowed, 'mcp.png');
    let sdkHash = '', expectedRecipeHash = '';
    try {
      const record = await sdk.transformFile(processor, input, boundRecipe, sdkOutput, { bindings: { mask: await readFile(mask), background: await readFile(background) } });
      sdkHash = record.output.hash; expectedRecipeHash = record.recipe_hash;
      expect(await pixel(sdkOutput, 8, 6)).toEqual([38, 45, 118, 255]);
      const command = await cli(['run', await writeRecipe(directory, boundRecipe), '--input', input, '--output', cliOutput, '--bind', `mask=${mask}`, '--bind', `background=${background}`]);
      expect(command.code).toBe(0); expect(await sha256(await readFile(cliOutput))).toBe(sdkHash);
      expect(JSON.parse(command.stdout) as unknown).toMatchObject({ recipe_hash: expectedRecipeHash });
      observations.cli_bindings = command;
    } finally { await processor.dispose(); }
    const external = join(outside, 'external.png'); await image(external, [64, 64, 64]); await symlink(external, join(allowed, 'mask-link.png'));
    await withMcp([allowed], async client => {
      const result = await client.callTool({ name: 'transform', arguments: { input, output: mcpOutput, recipe: boundRecipe, bindings: { mask, background } } });
      expect(result.isError).not.toBe(true); expect(await sha256(await readFile(mcpOutput))).toBe(sdkHash);
      expect(result.structuredContent).toMatchObject({ record: { recipe_hash: expectedRecipeHash } });
      const denied = await client.callTool({ name: 'transform', arguments: { input, output: join(allowed, 'denied.png'), recipe: boundRecipe, bindings: { mask: join(allowed, 'mask-link.png'), background } } });
      expect(denied.isError).toBe(true); expect(errorPayload(denied)).toMatchObject({ error: { code: 'ACCESS_DENIED' } }); expect(await exists(join(allowed, 'denied.png'))).toBe(false);
      observations.cross_bindings = { result, denied, output_hash: sdkHash, recipe_hash: expectedRecipeHash };
    });
  });
  it('discovers tools, inspects, prepares white WebP, validates and returns accessible refs', async () => {
    const directory = await mkdtemp(join(runRoot, 'mcp-flow-')), input = join(directory, 'source.png'), output = join(directory, 'prepared.webp');
    const inputHash = await image(input, [120, 30, 200]);
    await withMcp([directory], async client => {
      const tools = await client.listTools(); expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['inspect', 'remove', 'transform', 'batch', 'resolve_preset', 'validate', 'capabilities']));
      const inspection = await client.callTool({ name: 'inspect', arguments: { input } });
      expect(inspection.isError).not.toBe(true); expect(inspection.structuredContent).toMatchObject({ image: { width: 16, height: 12, format: 'png' } });
      const transformation = await client.callTool({ name: 'transform', arguments: { input, output, recipe: recipe(1200, 1200, 'webp') } });
      expect(transformation.isError).not.toBe(true);
      expect(transformation.structuredContent).toMatchObject({ file: output, record_file: output + '.json', resource_uri: new URL('file://' + output).href, record: { output: { width: 1200, height: 1200, format: 'webp', is_opaque: true } } });
      const metadata = await sharp(await readFile(output)).metadata(); expect([metadata.width, metadata.height, metadata.format]).toEqual([1200, 1200, 'webp']);
      expect((await sharp(output).stats()).isOpaque).toBe(true); expect(await pixel(output, 0, 0)).toEqual([255, 255, 255, 255]);
      const centre = await pixel(output, 600, 600); for (let channel = 0; channel < 3; channel++) expect(Math.abs(centre[channel]! - [120, 30, 200][channel]!)).toBeLessThanOrEqual(3);
      const validation = await client.callTool({ name: 'validate', arguments: { input: output, preset: 'shopify-product-square', version: '2026-10-08.1' } });
      expect(validation.isError).not.toBe(true); expect(validation.structuredContent).toHaveProperty('rules');
      expect(await sha256(await readFile(input))).toBe(inputHash);
      expect(JSON.stringify(transformation).length).toBeLessThan(20000);
      observations.mcp_flow = { tools, inspection, transformation, validation, input_hash: inputHash, output_hash: await sha256(await readFile(output)), centre };
    });
  }, 15000);
  it('rejects direct read/write root escapes, unsupported operation and ambiguous preset', async () => {
    const directory = await mkdtemp(join(runRoot, 'mcp-deny-')), allowed = join(directory, 'allowed'), outside = join(directory, 'outside');
    await mkdir(allowed); await mkdir(outside); const input = join(allowed, 'source.png'), external = join(outside, 'external.png');
    await image(input); await image(external); await symlink(external, join(allowed, 'input-link.png')); await symlink(outside, join(allowed, 'output-link'));
    await withMcp([allowed], async client => {
      const deniedRead = await client.callTool({ name: 'inspect', arguments: { input: join(allowed, 'input-link.png') } });
      expect(deniedRead.isError).toBe(true); expect(errorPayload(deniedRead)).toMatchObject({ error: { code: 'ACCESS_DENIED' } });
      const deniedWrite = await client.callTool({ name: 'transform', arguments: { input, output: join(allowed, 'output-link', 'new.png'), recipe: recipe() } });
      expect(deniedWrite.isError).toBe(true); expect(errorPayload(deniedWrite)).toMatchObject({ error: { code: 'ACCESS_DENIED' } });
      const unsupported = await client.callTool({ name: 'transform', arguments: { input, output: join(allowed, 'bad.png'), recipe: { ...recipe(), operations: [{ op: 'generate' }] } } });
      expect(unsupported.isError).toBe(true); expect(errorPayload(unsupported)).toMatchObject({ error: { code: 'INVALID_RECIPE' } });
      const ambiguous = await client.callTool({ name: 'resolve_preset', arguments: { request: 'Japan visa' } });
      expect(ambiguous.isError).toBe(true); expect(errorPayload(ambiguous)).toMatchObject({ error: { code: 'AMBIGUOUS_PRESET' } });
      expect(await exists(join(outside, 'new.png'))).toBe(false); expect(await exists(join(allowed, 'bad.png'))).toBe(false);
      observations.mcp_denials = { deniedRead, deniedWrite, unsupported, ambiguous };
    });
  });
  it('prevents batch writes through nested output symlinks outside the authorized root', async () => {
    const directory = await mkdtemp(join(runRoot, 'mcp-batch-root-')), allowed = join(directory, 'allowed'), outside = join(directory, 'outside');
    const source = join(allowed, 'inputs'), output = join(allowed, 'outputs');
    await image(join(source, 'nested', 'source.png')); await mkdir(output); await mkdir(outside); await symlink(outside, join(output, 'nested'));
    const externalOutput = join(outside, 'source.png.png');
    await withMcp([allowed], async client => {
      const result = await client.callTool({ name: 'batch', arguments: { input_directory: source, output_directory: output, recipe: recipe() } });
      const wroteOutside = await exists(externalOutput);
      observations.mcp_batch_root = { result, wrote_outside: wroteOutside, external_output: externalOutput, ...(wroteOutside ? { external_hash: await sha256(await readFile(externalOutput)) } : {}) };
      expect.soft(result.isError).toBe(true); expect.soft(wroteOutside).toBe(false);
    });
  });
  it('rejects unknown MCP parameters rather than silently dropping them', async () => {
    const directory = await mkdtemp(join(runRoot, 'mcp-unknown-')), input = join(directory, 'source.png'), output = join(directory, 'result.png'); await image(input);
    await withMcp([directory], async client => {
      const outcome = await client.callTool({ name: 'transform', arguments: { input, output, recipe: recipe(), unrecognized_resize_width: 123 } })
        .then(result => ({ result }), (error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));
      const rejected = 'error' in outcome || outcome.result.isError === true;
      observations.mcp_unknown = { outcome, output_created: await exists(output) };
      expect.soft(rejected).toBe(true); expect.soft(await exists(output)).toBe(false);
    });
  });
});
