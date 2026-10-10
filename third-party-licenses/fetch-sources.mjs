#!/usr/bin/env node
// Fetch recorded library source archives without executing them.
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';

const output = process.argv[2];
if (!output) throw new Error('Usage: node third-party-licenses/fetch-sources.mjs NEW_OUTPUT_DIRECTORY');
const manifest = JSON.parse(await readFile(new URL('./sources/archives.json', import.meta.url), 'utf8'));
await mkdir(resolve(output), {recursive: true});
for (const entry of manifest.entries) {
  if (!entry.sha256 || !entry.bytes) throw new Error(`Source was not retained: ${entry.component}`);
  const response = await fetch(entry.url, {signal: AbortSignal.timeout(60_000)});
  if (!response.ok) throw new Error(`${entry.component}: HTTP ${response.status}`);
  if (!response.body) throw new Error(`${entry.component}: source body missing`);
  const bytes = new Uint8Array(entry.bytes);
  const reader = response.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (received + chunk.value.length > bytes.length) throw new Error(`${entry.component}: source exceeds pinned length`);
      bytes.set(chunk.value, received);
      received += chunk.value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (received !== entry.bytes) throw new Error(`${entry.component}: source length changed`);
  if (bytes.byteLength !== entry.bytes) throw new Error(`${entry.component}: source length changed`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== entry.sha256) throw new Error(`${entry.component}: source SHA-256 changed`);
  const name = `${entry.component}-${entry.version}.archive`;
  await writeFile(join(resolve(output), name), bytes, {flag: 'wx'});
  console.log(JSON.stringify({component: entry.component, path: join(resolve(output), name), bytes: bytes.length, sha256: hash}));
}
