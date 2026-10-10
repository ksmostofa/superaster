import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sourceStatusSnapshot } from '../packages/catalog/src/index.js';

let directory: string;
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'superaster-catalog-monitor-')); });
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
const script = (args: string[]) => spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), resolve('scripts/catalog-monitor.ts'), ...args], { encoding: 'utf8', timeout: 15000 });

describe('manual catalog source snapshot command', () => {
  it('imports installed-SDK evidence exactly, preserves its observation date and refuses output replacement', async () => {
    const evidence = join(directory, 'evidence.json'), output = join(directory, 'snapshot.json');
    await writeFile(evidence, JSON.stringify({ scope: sourceStatusSnapshot.method, checked_at_utc: sourceStatusSnapshot.checked_at, checks: sourceStatusSnapshot.results.map(result => ({ result })) }));
    const command = script(['--from', evidence, '--output', output]);
    expect(command.status, command.stderr).toBe(0);
    expect(command.stderr).toBe('');
    expect(JSON.parse(command.stdout)).toMatchObject({ output, checked_at: sourceStatusSnapshot.checked_at, observed_sources: 13 });
    const saved = await readFile(output, 'utf8');
    expect(JSON.parse(saved)).toEqual(sourceStatusSnapshot);
    const repeated = script(['--from', evidence, '--output', output]);
    expect(repeated.status).toBe(2);
    expect(repeated.stdout).toBe('');
    expect(JSON.parse(repeated.stderr).error).toMatchObject({ code: 'INVALID_INPUT' });
    expect(await readFile(output, 'utf8')).toBe(saved);
  }, 20000);

  it('rejects malformed or unknown-pin observations before creating an output', async () => {
    const source = join(directory, 'invalid.json'), output = join(directory, 'invalid-output.json');
    for (const value of [
      { ...sourceStatusSnapshot, checked_at: '2026-02-30T12:00:00Z' },
      { ...sourceStatusSnapshot, results: [{ ...sourceStatusSnapshot.results[0], preset_id: 'invented-authority-approval' }] }
    ]) {
      await writeFile(source, JSON.stringify(value));
      const command = script(['--from', source, '--output', output]);
      expect(command.status).toBe(2);
      expect(command.stdout).toBe('');
      expect(JSON.parse(command.stderr).error).toMatchObject({ code: 'INVALID_INPUT' });
      await expect(access(output)).rejects.toThrow();
    }
  }, 20000);
});
