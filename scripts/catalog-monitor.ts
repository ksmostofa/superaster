import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createCatalog, monitorCatalogSources, parseSourceStatusSnapshot } from '../packages/catalog/src/index.js';
import { SuperasterError } from '../packages/contract/src/index.js';

// Manual invocation only. Writing observations never publishes or edits authority rules.
try {
  const { values } = parseArgs({ options: { output: { type: 'string' }, from: { type: 'string' }, 'timeout-ms': { type: 'string' } }, strict: true });
  if (!values.output?.trim() || values.from !== undefined && !values.from.trim()) throw new SuperasterError('INVALID_INPUT', 'Use --output NEW_FILE [--from EXISTING_MONITOR_EVIDENCE]');
  const timeout = values['timeout-ms'] === undefined ? 15000 : Number(values['timeout-ms']);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000) throw new SuperasterError('INVALID_INPUT', '--timeout-ms must be an integer from 1 to 60000');
  let snapshot;
  if (values.from) {
    const evidence: unknown = JSON.parse(await readFile(values.from, 'utf8'));
    if (typeof evidence !== 'object' || evidence === null || Array.isArray(evidence)) throw new SuperasterError('INVALID_INPUT', 'Expected a source-status snapshot or installed-SDK monitor evidence object');
    const record = evidence as Record<string, unknown>;
    if (record.schema_version !== undefined) snapshot = parseSourceStatusSnapshot(record);
    else {
      const entries = record.checks;
      if (!Array.isArray(entries)) throw new SuperasterError('INVALID_INPUT', 'Monitor evidence must contain source checks');
      snapshot = parseSourceStatusSnapshot({ schema_version: '1.0', checked_at: record.checked_at_utc, method: record.scope, results: entries.map(entry => typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>).result : undefined) });
    }
  } else {
    const results = await monitorCatalogSources(undefined, { timeout_ms: timeout });
    snapshot = parseSourceStatusSnapshot({ schema_version: '1.0', checked_at: new Date().toISOString(), method: 'Manual monitorCatalogSources; each cited URL fetched once; observations do not approve rules or change immutable pins', results });
  }
  const registry = createCatalog(undefined, { monitor_results: snapshot.results, clock: () => Date.parse(snapshot.checked_at) });
  const statusCounts: Record<string, number> = {};
  for (const preset of registry.listPresets()) statusCounts[preset.freshness.status] = (statusCounts[preset.freshness.status] ?? 0) + 1;
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ output, checked_at: snapshot.checked_at, observed_sources: snapshot.results.reduce((count, result) => count + result.checks.length, 0), preset_status_counts: statusCounts }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ error: { code: error instanceof SuperasterError ? error.code : 'INVALID_INPUT', message: error instanceof Error ? error.message : String(error) } }) + '\n');
  process.exitCode = 2;
}
