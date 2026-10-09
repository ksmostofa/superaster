import { describe, expect, it, vi } from 'vitest';
import { createCatalog, listPresets, monitorCatalogSources, monitorSources, parseSourceStatusSnapshot, planPreset, resolvePreset, resolvePresetStatus, sourceStatusSnapshot, SOURCE_STATUS_MAX_AGE_MS, validate, type Preset } from '../packages/catalog/src/index.js';
import reviewedData from '../packages/catalog/data/presets.json' with { type: 'json' };
import { SuperasterError, type ImageInfo, type Recipe } from '../packages/contract/src/index.js';
import { sha256 } from '../packages/core/src/index.js';

const checkedAt = '2026-01-02T12:00:00.000Z';
const now = Date.parse(checkedAt);
const recipe: Recipe = { spec_version: '1.0', input: { ref: 'fixture' }, operations: [], output: { format: 'png' } };
const image: ImageInfo = { width: 2048, height: 2048, format: 'png', channels: 3, has_alpha: false, bytes: 100000, pages: 1, color_space: 'srgb', metadata: { icc: false, exif: false } };

/** Prospective versions are fictional test data, never authority updates or shipped catalog entries. */
async function fixture(version = '2026-01-01.1', bytes = 'fictional reviewed source'): Promise<Preset> {
  const original = structuredClone(resolvePreset('shopify-product-square'));
  const source = 'https://example.org/superaster-test-fixture';
  return { ...original, id: 'test-fixture-product', version, purpose: 'Fictional product test fixture', authority: 'Test fixture, no authority', jurisdiction: 'Test only', channel: 'Test only', aliases: ['fictional product'],
    sources: [{ url: source, title: 'Fictional source fixture', verified_at: '2026-01-01', sha256: await sha256(new TextEncoder().encode(bytes)) }],
    rules: original.rules.map(rule => ({ ...rule, source })), freshness: { status: 'verified', verified_at: '2026-01-01' } };
}

async function observation(profile: Preset, content: string, checked_at = checkedAt) {
  const result = await monitorSources(profile, { fetcher: async () => new Response(content) });
  return { ...result, checked_at };
}

function code(action: () => unknown) {
  try { action(); } catch (error) { if (error instanceof SuperasterError) return error.code; throw error; }
  throw new Error('Expected a public error');
}

describe('catalog immutable versions and observed freshness', () => {
  it('propagates changed-source observations into resolver, planner and validation without rewriting pins', async () => {
    const original = await fixture(), baseline = JSON.stringify(original);
    const changed = await observation(original, 'fictional changed source');
    const registry = createCatalog([original], { monitor_results: [changed], clock: () => now });
    const selected = registry.resolvePresetStatus(original.id, original.version);
    expect(selected.preset.freshness).toMatchObject({ status: 'needs_review', checked_at: checkedAt });
    expect(selected.notices).toMatchObject([{ kind: 'source-freshness', status: 'needs_review' }]);
    expect(code(() => planPreset(selected.preset, recipe))).toBe('EDIT_FORBIDDEN');
    expect(validate(image, selected.preset).find(rule => rule.id === 'source-freshness')?.state).toBe('needs_review');
    expect(JSON.stringify(registry.publishedRecords()[0])).toBe(baseline);
    expect(selected.preset.rules).toBe(original.rules);
    expect(Object.isFrozen(selected.preset.freshness)).toBe(true);
  });

  it('retains an old pin after a reviewed fixture update and shows an explicit newer-version notice', async () => {
    const old = await fixture(), baseline = JSON.stringify(old);
    const updated = await fixture('2026-01-01.10', 'fictional updated source');
    updated.rules = updated.rules.map(rule => rule.id === 'recommended-size' ? { ...rule, value: { width: 1200, height: 1200 }, text: 'Fictional updated 1200 square rule' } : rule);
    const pending = { ...await fixture('2026-01-01.11', 'unreviewed fixture'), freshness: { status: 'needs_review' as const, verified_at: '2026-01-01' } };
    const registry = createCatalog([old, updated, pending]);
    const pinned = registry.resolvePresetStatus(old.id, old.version);
    expect(pinned.preset.version).toBe(old.version);
    expect(JSON.stringify(pinned.preset)).toBe(baseline);
    expect(pinned.notices).toMatchObject([{ kind: 'newer-version', newer_version: updated.version }]);
    expect(registry.resolvePreset(old.id).version).toBe(updated.version);
    expect(registry.resolvePreset('fictional product').version).toBe(updated.version);
    expect(registry.listPresets().map(profile => profile.version)).toEqual([updated.version]);
    expect(registry.presetHistory(old.id)).toMatchObject({ latest_verified: updated.version, versions: [{ version: pending.version }, { version: updated.version }, { version: old.version }] });
    expect(registry.resolvePresetStatus(old.id, updated.version).notices).toEqual([]);
    expect(validate(image, pinned.preset).find(rule => rule.id === 'newer-preset-version')?.message).toContain(updated.version);
    expect(code(() => createCatalog([old, { ...old, purpose: 'Rewritten published pin' }]))).toBe('INVALID_INPUT');
  });

  it('uses new reviewed baselines without silently moving the old pin or approving pending rules', async () => {
    const old = await fixture(), updated = await fixture('2026-01-02.1', 'fictional updated source');
    const checked = await observation(updated, 'fictional updated source');
    const registry = createCatalog([old, updated], { monitor_results: [checked], clock: () => now });
    expect(registry.resolvePreset(old.id, old.version).freshness.status).toBe('needs_review');
    expect(registry.resolvePreset(old.id).freshness.status).toBe('verified');
    expect(registry.resolvePresetStatus(old.id, old.version).notices.map(notice => notice.kind)).toEqual(['source-freshness', 'newer-version']);
    const pending = { ...await fixture('2026-01-03.1'), freshness: { status: 'needs_review' as const, verified_at: '2026-01-01' } };
    const unapproved = createCatalog([pending], { monitor_results: [await observation(pending, 'fictional reviewed source')], clock: () => now });
    expect(unapproved.resolvePreset(pending.id, pending.version).freshness.status).toBe('needs_review');
    expect(unapproved.listPresets()).toEqual([]);
  });

  it('shows failed, missing, partial, expired and future observations as unknown freshness', async () => {
    const profile = await fixture();
    const failed = { ...await monitorSources(profile, { fetcher: async () => new Response('denied', { status: 403 }) }), checked_at: checkedAt };
    const failRegistry = createCatalog([profile], { monitor_results: [failed], clock: () => now });
    expect(failRegistry.resolvePreset(profile.id).freshness.status).toBe('unknown');
    expect(code(() => planPreset(failRegistry.resolvePreset(profile.id), recipe))).toBe('EDIT_FORBIDDEN');
    expect(createCatalog([profile], { monitor_results: [], clock: () => now }).resolvePreset(profile.id).freshness.status).toBe('unknown');
    const unchanged = await observation(profile, 'fictional reviewed source');
    const expanded = { ...profile, sources: [...profile.sources, { ...profile.sources[0]!, url: 'https://example.org/additional-fixture-source' }] };
    expect(createCatalog([expanded], { monitor_results: [unchanged], clock: () => now }).resolvePreset(profile.id).freshness.status).toBe('unknown');
    let clock = now;
    const reusable = createCatalog([profile], { monitor_results: [unchanged], max_age_ms: 1000, clock: () => clock });
    expect(reusable.resolvePreset(profile.id).freshness.status).toBe('verified');
    clock += 1001;
    expect(reusable.resolvePreset(profile.id).freshness.source_change).toContain('older');
    expect(createCatalog([profile], { monitor_results: [unchanged], clock: () => now - 1 }).resolvePreset(profile.id).freshness.source_change).toContain('future');
    clock = now;
    const retained = reusable.resolvePreset(profile.id);
    expect(planPreset(retained, recipe).preset?.version).toBe(profile.version);
    clock += 1001;
    expect(code(() => planPreset(retained, recipe))).toBe('EDIT_FORBIDDEN');
    expect(validate(image, retained).find(rule => rule.id === 'source-freshness')?.message).toContain('older');
  });

  it('shares source observations across profiles and compares each immutable baseline independently', async () => {
    const old = await fixture(), alternate = { ...await fixture('2026-01-01.2', 'fictional changed source'), id: 'test-fixture-alternate', aliases: ['alternate fixture'] };
    const changed = await observation(old, 'fictional changed source'), unchanged = await observation(alternate, 'fictional changed source');
    const registry = createCatalog([old, alternate], { monitor_results: [changed, unchanged], clock: () => now });
    expect(registry.resolvePreset(old.id).freshness.status).toBe('needs_review');
    expect(registry.resolvePreset(alternate.id).freshness.status).toBe('verified');
    const newestFailure = { ...await monitorSources(old, { fetcher: async () => new Response('denied', { status: 403 }) }), checked_at: '2026-01-02T12:00:01.000Z' };
    const newerRegistry = createCatalog([old, alternate], { monitor_results: [newestFailure, unchanged, changed], clock: () => now + 1000 });
    expect(newerRegistry.resolvePreset(old.id).freshness.status).toBe('unknown');
    expect(newerRegistry.resolvePreset(alternate.id).freshness.status).toBe('unknown');
  });

  it('rejects malformed and mismatched monitor snapshots at the external boundary', async () => {
    const profile = await fixture(), checked = await observation(profile, 'fictional reviewed source');
    for (const malformed of [
      [{ ...checked, unexpected: true }], [{ ...checked, preset_version: 'missing' }], [{ ...checked, checked_at: '1' }], [{ ...checked, status: 'needs_review' }],
      [{ ...checked, checked_at: '2026-02-30T12:00:00.000Z' }],
      [{ ...checked, checks: [{ ...checked.checks[0], url: 'https://example.org/uncited' }] }],
      [{ ...checked, checks: [{ ...checked.checks[0], sha256: 'a'.repeat(64) }] }],
      [{ ...checked, checks: [checked.checks[0], checked.checks[0]] }]
    ]) expect(code(() => createCatalog([profile], { monitor_results: malformed }))).toBe('INVALID_INPUT');
    expect(code(() => createCatalog([profile], { max_age_ms: 0 }))).toBe('INVALID_INPUT');
    expect(code(() => createCatalog([profile], { monitor_results: [checked], clock: () => NaN }).resolvePreset(profile.id))).toBe('INVALID_INPUT');
    const contradictory = await observation(profile, 'contradictory fixture source');
    expect(code(() => createCatalog([profile], { monitor_results: [checked, contradictory] }))).toBe('INVALID_INPUT');
  });

  it('does not publish prospective test versions in the default offline catalog', () => {
    expect(listPresets()).toHaveLength(20);
    expect(listPresets({ history: true }).some(profile => profile.id.startsWith('test-fixture'))).toBe(false);
  });

  it('loads the actual persisted October 9 observations in production consumers without changing published rules', () => {
    const original = JSON.stringify(reviewedData);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(sourceStatusSnapshot.checked_at));
    try {
      expect(sourceStatusSnapshot.checked_at).toBe('2026-10-09T04:08:01.781Z');
      expect(sourceStatusSnapshot.results).toHaveLength(13);
      expect(resolvePreset('jp-residence-status-paper').freshness.status).toBe('verified');
      for (const id of ['uk-passport-digital-own-device', 'youtube-video-thumbnail-mobile', 'youtube-channel-banner', 'google-article-image-16x9']) {
        const selected = resolvePresetStatus(id, '2026-10-08.1');
        expect(selected.preset.freshness.status).toBe('needs_review');
        expect(selected.notices).toMatchObject([{ kind: 'source-freshness', status: 'needs_review' }]);
        expect(selected.preset.rules).toEqual(reviewedData.find(record => record.id === id)!.rules);
      }
      for (const id of ['x-profile-photo', 'shopify-product-square', 'etsy-listing-landscape', 'print-grid-4x6in-30x40mm']) expect(resolvePreset(id).freshness.status).toBe('unknown');
      expect(listPresets().find(record => record.id === 'shopify-product-square')?.freshness.status).toBe('unknown');
      const staleClaim = { ...structuredClone(resolvePreset('shopify-product-square')), freshness: { status: 'verified' as const, verified_at: '2026-10-08' } };
      expect(code(() => planPreset(staleClaim, recipe))).toBe('EDIT_FORBIDDEN');
      expect(validate(image, staleClaim).find(rule => rule.id === 'source-freshness')?.message).toContain('unknown');
      const retained = resolvePreset('jp-residence-status-paper');
      expect(retained.freshness.status).toBe('verified');
      clock.mockReturnValue(Date.parse(sourceStatusSnapshot.checked_at) + SOURCE_STATUS_MAX_AGE_MS + 1);
      expect(resolvePreset('jp-residence-status-paper').freshness.status).toBe('unknown');
      expect(code(() => planPreset(retained, recipe))).toBe('EDIT_FORBIDDEN');
      expect(validate(image, retained).find(rule => rule.id === 'source-freshness')?.message).toContain('older');
      expect(JSON.stringify(reviewedData)).toBe(original);
    } finally { clock.mockRestore(); }
  });

  it('validates persisted snapshot dates, schema and completion before applying source observations', () => {
    expect(Object.isFrozen(sourceStatusSnapshot.results)).toBe(true);
    for (const value of [
      { ...sourceStatusSnapshot, schema_version: '2.0' },
      { ...sourceStatusSnapshot, checked_at: '2026-02-30T12:00:00Z' },
      { ...sourceStatusSnapshot, checked_at: '2026-10-08T04:08:01.781Z' },
      { ...sourceStatusSnapshot, extra: 'unexpected' },
      { ...sourceStatusSnapshot, results: [{ ...sourceStatusSnapshot.results[0], checks: [] }] }
    ]) expect(code(() => parseSourceStatusSnapshot(value))).toBe('INVALID_INPUT');
  });

  it('checks repeated catalog citations once with one bounded fetch at a time and preserves cancellation', async () => {
    const first = await fixture(), second = { ...await fixture('2026-01-01.2'), id: 'test-fixture-alternate' };
    const third = { ...await fixture('2026-01-01.3'), id: 'test-fixture-third', sources: [{ ...first.sources[0]!, url: 'https://example.org/second-fixture' }], rules: first.rules.map(rule => ({ ...rule, source: 'https://example.org/second-fixture' })) };
    let active = 0, maximum = 0;
    const calls: string[] = [];
    const fetcher: typeof fetch = async url => {
      calls.push(String(url)); active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 2)); active--;
      return new Response('fictional reviewed source');
    };
    const observations = await monitorCatalogSources([first, second, third], { fetcher });
    expect(calls).toEqual([first.sources[0]!.url, third.sources[0]!.url]);
    expect(maximum).toBe(1);
    expect(observations).toHaveLength(2);
    const checked = observations.map(result => ({ ...result, checked_at: checkedAt }));
    expect(createCatalog([first, second, third], { monitor_results: checked, clock: () => now }).listPresets().every(profile => profile.freshness.status === 'verified')).toBe(true);
    const controller = new AbortController();
    await expect(monitorCatalogSources([first], { signal: controller.signal, fetcher: async () => { controller.abort(); return new Response('source'); } })).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
