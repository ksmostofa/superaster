import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const cliPath = resolve('packages/cli/src/index.ts');
const tsxLoader = import.meta.resolve('tsx');
let directory: string, input: string, recipePath: string;
const recipe = {
  spec_version: '1.0', input: { ref: 'fixture' },
  operations: [{ op: 'canvas', width: 8, height: 8, background: '#ffffff' }],
  output: { format: 'png' }
};

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'superaster-cli-boundary-'));
  input = join(directory, 'input.png');
  recipePath = join(directory, 'recipe.json');
  await writeFile(input, await sharp({ create: { width: 4, height: 2, channels: 4, background: '#204060' } }).png().toBuffer());
  await writeFile(recipePath, JSON.stringify(recipe));
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

function cli(args: string[], cwd?: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--import', tsxLoader, cliPath, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI exceeded 15 seconds')); }, 15000);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => { clearTimeout(timeout); resolveResult({ code, stdout, stderr }); });
  });
}

async function invalid(args: string[], message?: string) {
  const result = await cli(args);
  expect(result.code, JSON.stringify(result)).toBe(2);
  expect(result.stdout).toBe('');
  const lines = result.stderr.trim().split('\n');
  expect(lines).toHaveLength(1);
  const error = JSON.parse(lines[0]!).error;
  expect(error).toMatchObject({ code: 'INVALID_INPUT', message: expect.any(String), details: expect.any(Object) });
  if (message) expect(error.message).toContain(message);
}

describe('CLI rejects argument mistakes before processing', () => {
  it('reports an unknown option as invalid input rather than a processing failure', async () => {
    await invalid(['inspect', input, '--definitely-unknown'], '--definitely-unknown');
  });
  it('rejects an extra inspect input instead of silently ignoring it', async () => {
    await invalid(['inspect', input, 'ignored.png']);
  });
  it('rejects a quality option on inspect instead of silently ignoring it', async () => {
    await invalid(['inspect', input, '--quality', 'not-a-quality'], '--quality');
  });

  it.concurrent.each([
    ['inspect'],
    ['inspect', ''],
    ['inspect', 'missing.png', '--output', 'result.png'],
    ['remove', 'missing.png', '--output', 'result.png', '--quality', 'not-a-quality'],
    ['remove', 'missing.png', '--output', 'result.png', 'ignored.png'],
    ['remove', 'missing.png', '--input', 'other.png', '--output', 'result.png'],
    ['remove', 'missing.png', '--bind', 'mask=missing.png', '--output', 'result.png'],
    ['run', 'missing.json', '--input', 'missing.png'],
    ['run', 'missing.json', '--input', 'missing.png', '--output', 'result.png', '--quality', 'fast'],
    ['run', 'missing.json', '--input', 'missing.png', '--output', 'result.png', '--engine', 'auto'],
    ['batch', 'missing-directory', '--recipe', 'missing.json', '--output', 'results', '--overwrite'],
    ['batch', 'missing-directory', '--recipe', 'missing.json', '--output', 'results', '--resume', '--retry'],
    ['capabilities', '--json', 'ignored'],
    ['capabilities', '--quality', 'quality'],
    ['models', 'list', 'ignored'],
    ['models', 'list', '--model-dir', 'cache'],
    ['models', 'install'],
    ['models', 'install', 'model-id', 'ignored'],
    ['models', 'install', 'model-id', '--quality', 'fast'],
    ['models', 'unknown'],
    ['resolve', 'jp-residence-status-paper', 'ignored'],
    ['resolve', 'jp-residence-status-paper', '--preset', 'other'],
    ['validate', 'missing.png', '--preset', 'jp-residence-status-paper', '--json'],
    ['validate', 'missing.png'],
    ['mcp', '--roots', '/missing', 'ignored'],
    ['mcp', '--roots', ','],
    ['mcp', '--roots', '/missing', '--input', 'missing.png'],
    ['unknown-command'],
    ['toString'],
    ['__proto__'],
    ['--json'],
    ['inspect', 'missing.png', '--help', '--quality', 'fast'],
    ['run', 'missing.json', '--input', 'missing.png', '--output'],
    ['run', 'missing.json', '--input', 'missing.png', '--output', ''],
    ['run', 'missing.json', '--input', 'missing.png', '--output', 'first.png', '--output', 'second.png'],
    ['run', 'missing.json', '--input', 'missing.png', '--output', 'result.png', '--overwrite=yes'],
    ['remove', 'missing.png', '--output', 'result.png', '--engine', ''],
    ['remove', 'missing.png', '--output', 'result.png', '--model-dir', ''],
    ['resolve', 'jp-residence-status-paper', '--preset-version', ''],
    ['run', 'missing.json', '--input', 'missing.png', '--bind', 'mask=missing.png'],
    ['run', '', '--input', 'missing.png', '--output', 'result.png', '--bind', 'mask=missing.png'],
    ['run', 'missing.json', '--input', 'missing.png', '--output', 'result.png', '--bind', 'mask=missing.png', '--bind', 'broken'],
    ['run', 'missing.json', '--input', 'missing.png', '--output', 'result.png', '--bind', 'mask=missing.png', '--bind', 'mask=other.png']
  ])('rejects %j with one structured error and no stdout', async (...args) => { await invalid(args); }, 20000);
});

describe('CLI preserves documented local command forms', () => {
  it('prints help without reading model or binding files', async () => {
    for (const args of [[], ['--help'], ['run', '--help', '--bind', 'mask=missing.png'], ['remove', 'missing.png', '--quality', 'fast', '--engine', 'auto', '--model-dir', join(directory, 'models'), '--output', 'result.png', '--overwrite', '--help'], ['models', 'install', 'birefnet-lite-512-fp16', '--model-dir', join(directory, 'models'), '--help'], ['mcp', '--roots', directory, '--model-dir', join(directory, 'models'), '--help']]) {
      const result = await cli(args);
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain('superaster inspect INPUT');
      expect(result.stderr).toBe('');
    }
  }, 20000);
  it('inspects a real image, including a dash-prefixed filename after --', async () => {
    const result = await cli(['inspect', input]);
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ width: 4, height: 2, format: 'png' });
    expect(result.stderr).toBe('');
    const dashed = join(directory, '-input.png');
    await writeFile(dashed, await readFile(input));
    const separated = await cli(['inspect', '--', '-input.png'], directory);
    expect(separated.code, separated.stderr).toBe(0);
    expect(JSON.parse(separated.stdout)).toMatchObject({ width: 4, height: 2, format: 'png' });
  }, 20000);
  it('discovers models, capabilities and a pinned preset using JSON stdout', async () => {
    const models = await cli(['models', 'list']);
    expect(models.code, models.stderr).toBe(0);
    expect(JSON.parse(models.stdout)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'birefnet-lite-512-fp16' })]));
    expect(models.stderr).toBe('');
    const capabilities = await cli(['capabilities', '--json']);
    expect(capabilities.code, capabilities.stderr).toBe(0);
    expect(JSON.parse(capabilities.stdout)).toMatchObject({ contract_version: '1.0', adapter: 'native' });
    expect(capabilities.stderr).toBe('');
    const preset = await cli(['resolve', 'jp-residence-status-paper', '--preset-version', '2026-10-08.1']);
    expect(preset.code, preset.stderr).toBe(0);
    expect(JSON.parse(preset.stdout)).toMatchObject({ id: 'jp-residence-status-paper', version: '2026-10-08.1' });
    expect(preset.stderr).toBe('');
  }, 20000);
  it('runs a geometry recipe with an explicit model directory and overwrite', async () => {
    const output = join(directory, 'result.png');
    const args = ['run', recipePath, '--input', input, '--output', output, '--model-dir', join(directory, 'models')];
    const first = await cli(args);
    expect(first.code, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout).output).toMatchObject({ width: 8, height: 8, format: 'png' });
    expect(first.stderr.trim().split('\n').map(line => JSON.parse(line))).toEqual(expect.arrayContaining([expect.objectContaining({ stage: 'complete' })]));
    expect(first.stderr).not.toContain('"error"');
    const overwritten = await cli([...args, '--overwrite']);
    expect(overwritten.code, overwritten.stderr).toBe(0);
    expect(JSON.parse(overwritten.stdout).output.hash).toBe(JSON.parse(first.stdout).output.hash);
    expect((await sharp(output).metadata()).width).toBe(8);
  }, 20000);
  it('accepts repeated distinct bindings and validates an actual image', async () => {
    const boundRecipe = join(directory, 'bound.json'), output = join(directory, 'bound.png'), mask = join(directory, 'mask.png');
    await writeFile(mask, await sharp({ create: { width: 4, height: 2, channels: 3, background: '#808080' } }).greyscale().png().toBuffer());
    await writeFile(boundRecipe, JSON.stringify({ ...recipe, operations: [{ op: 'correct', mask_ref: 'mask' }, { op: 'composite', image_ref: 'background' }] }));
    const result = await cli(['run', boundRecipe, '--input', input, '--output', output, '--bind', `mask=${mask}`, '--bind', `background=${input}`]);
    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).binding_hashes).toEqual({ mask: expect.any(String), background: expect.any(String) });
    const validation = await cli(['validate', output, '--preset', 'jp-residence-status-paper', '--preset-version', '2026-10-08.1']);
    expect(validation.code, validation.stderr).toBe(0);
    expect(JSON.parse(validation.stdout)).toEqual(expect.arrayContaining([expect.objectContaining({ state: expect.any(String) })]));
    expect(validation.stderr).toBe('');
  }, 20000);
  it('accepts batch resume and retry as separate flags with JSON manifests', async () => {
    const sources = join(directory, 'batch-inputs'), output = join(directory, 'batch-outputs');
    await mkdir(sources);
    await writeFile(join(sources, 'source.png'), await readFile(input));
    const args = ['batch', sources, '--recipe', recipePath, '--output', output, '--model-dir', join(directory, 'models')];
    for (const suffix of [[], ['--resume'], ['--retry']]) {
      const result = await cli([...args, ...suffix]);
      expect(result.code, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).entries).toEqual([expect.objectContaining({ status: 'completed', input_hash: expect.any(String), output_hash: expect.any(String) })]);
      expect(result.stderr).not.toContain('"error"');
    }
  }, 20000);
});
