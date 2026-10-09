import { describe, expect, it } from 'vitest';
import { createCatalog, validate, planPreset, parsePresets, monitorSources } from '../packages/catalog/src/index.js';
import reviewedData from '../packages/catalog/data/presets.json' with { type: 'json' };
import { SuperasterError, type ImageInfo, type Recipe } from '../packages/contract/src/index.js';
import { sha256 } from '../packages/core/src/index.js';

const info = (change: Partial<ImageInfo & { is_opaque: boolean }> = {}): ImageInfo & { is_opaque: boolean } => ({ width: 800, height: 1000, format: 'jpeg', channels: 3, has_alpha: false, is_opaque: true, bytes: 100_000, pages: 1, color_space: 'srgb', metadata: { icc: false, exif: false, density: 300 }, ...change });
const recipe: Recipe = { spec_version: '1.0', input: { ref: 'original' }, operations: [{ op: 'crop', x: 0, y: 0, width: 600, height: 750 }], output: { format: 'jpeg' } };
// Rule semantics use the immutable published records. Production freshness is checked separately.
const { listPresets, resolvePreset } = createCatalog(reviewedData);
function errorCode(action: () => unknown) { try { action(); } catch (error) { if (error instanceof SuperasterError) return error.code; throw error; } throw new Error('Expected public error'); }

describe('reviewed catalog contract', () => {
  it('resolves a pinned profile exactly and surfaces material ambiguity', () => {
    const own = resolvePreset('uk-passport-digital-own-device', '2026-10-08.1');
    expect(own.channel).toContain('own device');
    expect(errorCode(() => resolvePreset(own.id, 'missing'))).toBe('PRESET_NOT_FOUND');
    for (const query of ['Japan visa', 'UK passport', 'YouTube thumbnail', 'article image', 'photo sheet']) expect(errorCode(() => resolvePreset(query))).toBe('AMBIGUOUS_PRESET');
    expect(listPresets()).toHaveLength(20);
    expect(Object.isFrozen(own.rules)).toBe(true);
  });
  it('rejects contributed records with uncited rules and conflicting permissions', () => {
    const copied = JSON.parse(JSON.stringify(listPresets()));
    copied[0].edit_policy.allowed.push('correct');
    expect(errorCode(() => parsePresets(copied))).toBe('INVALID_INPUT');
    copied[0].edit_policy.allowed.pop(); copied[0].rules[0].source = 'https://uncited.example/rule';
    expect(errorCode(() => parsePresets(copied))).toBe('INVALID_INPUT');
  });
  it('treats minimum dimensions, byte unit uncertainty and human questions separately', () => {
    const profile = resolvePreset('uk-passport-digital-own-device');
    const outcomes = validate(info({ width: 1200, height: 1600, bytes: 50_500 }), profile);
    expect(outcomes.find(rule => rule.id === 'minimum-pixels')?.state).toBe('pass');
    expect(outcomes.find(rule => rule.id === 'minimum-bytes')?.state).toBe('needs_review');
    expect(outcomes.find(rule => rule.id === 'photo-age')).toMatchObject({ state: 'not_checked', user_confirmation: true });
    expect(outcomes.find(rule => rule.id === 'portrait')?.state).toBe('needs_review');
    expect(validate(info({ width: 599 }), profile).find(rule => rule.id === 'minimum-pixels')?.state).toBe('fail');
    expect(validate(info({ bytes: 10_200_000 }), profile).find(rule => rule.id === 'maximum-bytes')?.state).toBe('needs_review');
    expect(validate(info({ bytes: 11_000_000 }), profile).find(rule => rule.id === 'maximum-bytes')?.state).toBe('fail');
  });
  it('uses decoded opacity, density and colour evidence without guessing from channel count', () => {
    const etsy = resolvePreset('etsy-shop-logo');
    expect(validate(info({ width: 500, height: 500, has_alpha: true, is_opaque: true }), etsy).find(rule => rule.id === 'opaque')?.state).toBe('pass');
    expect(validate(info({ is_opaque: false }), etsy).find(rule => rule.id === 'opaque')?.state).toBe('fail');
    const withoutOpacity: ImageInfo = info(); delete (withoutOpacity as Partial<ImageInfo & { is_opaque: boolean }>).is_opaque;
    expect(validate(withoutOpacity, etsy).find(rule => rule.id === 'opaque')?.state).toBe('not_checked');
    expect(validate(info({ color_space: 'cmyk' }), etsy).find(rule => rule.id === 'colour')?.state).toBe('fail');
    const sheet = resolvePreset('print-grid-4x6in-30x40mm');
    expect(validate(info({ width: 1200, height: 1800 }), sheet).filter(rule => rule.id !== 'print-size').every(rule => rule.state === 'pass')).toBe(true);
    expect(validate(info({ width: 1200, height: 1800, metadata: { icc: false, exif: false } }), sheet).find(rule => rule.id === 'density')?.state).toBe('not_checked');
    const residence = resolvePreset('jp-residence-status-paper');
    expect(validate(info({ width: 354, height: 472 }), residence).find(rule => rule.id === 'paper-size')?.state).toBe('pass');
    expect(validate(info({ width: 354, height: 472, metadata: { icc: false, exif: false, density: 72 } }), residence).find(rule => rule.id === 'paper-size')?.state).toBe('fail');
    expect(validate(info({ width: 709, height: 945, metadata: { icc: false, exif: false, density: 600 } }), residence).find(rule => rule.id === 'paper-size')?.state).toBe('pass');
  });
  it('blocks forbidden and unspecified official changes, including hidden re-encoding', () => {
    const uk = resolvePreset('uk-passport-digital-own-device');
    expect(errorCode(() => planPreset(uk, recipe))).toBe('EDIT_FORBIDDEN');
    expect(errorCode(() => planPreset(uk, { ...recipe, operations: [] }))).toBe('EDIT_FORBIDDEN');
    const residence = resolvePreset('jp-residence-status-paper');
    expect(errorCode(() => planPreset(residence, { ...recipe, operations: [{ op: 'flip', axis: 'horizontal' }] }))).toBe('EDIT_FORBIDDEN');
    expect(errorCode(() => planPreset(residence, recipe))).toBe('EDIT_FORBIDDEN');
    const shopify = resolvePreset('shopify-product-square');
    const planned = planPreset(shopify, recipe);
    expect(planned.operations).toEqual(recipe.operations);
    expect(planned.preset).toEqual({ id: shopify.id, version: shopify.version });
  });
  it('detects changed sources, reports failed access as unknown and preserves published pins', async () => {
    const bytes = new TextEncoder().encode('reviewed source');
    const original = resolvePreset('uk-passport-digital-own-device');
    const profile = { ...original, sources: [{ ...original.sources[0]!, sha256: await sha256(bytes) }] };
    const baseline = JSON.stringify(profile);
    const fetcher: typeof fetch = async () => new Response(bytes);
    expect((await monitorSources(profile, { fetcher })).status).toBe('verified');
    expect((await monitorSources(profile, { fetcher: async () => new Response('changed') })).status).toBe('needs_review');
    expect((await monitorSources(profile, { fetcher: async () => new Response('denied', { status: 403 }) })).status).toBe('unknown');
    expect((await monitorSources(profile, { fetcher, max_source_bytes: 1 })).status).toBe('unknown');
    expect(JSON.stringify(profile)).toBe(baseline);
  });
  it('makes missing monitoring baselines explicit and supports cancellation', async () => {
    const profile = resolvePreset('x-profile-photo');
    const result = await monitorSources(profile, { fetcher: async () => new Response('source') });
    expect(result.status).toBe('unknown');
    expect(result.checks[0]?.reason).toContain('baseline');
    const controller = new AbortController(); controller.abort();
    await expect(monitorSources(profile, { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
