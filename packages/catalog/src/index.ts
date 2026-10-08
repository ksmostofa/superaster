import { Ajv } from 'ajv';
import { Type } from '@sinclair/typebox';
import reviewedData from '../data/presets.json' with { type: 'json' };
import { OperationSchema, parseRecipe, SuperasterError, operationDefinitions, type ImageInfo, type Recipe, type RuleOutcome } from '../../contract/src/index.js';
import { sha256 } from '../../core/src/index.js';
import type { CatalogRule, Preset, Source } from './types.js';

export type { CatalogRule, Preset, Source } from './types.js';

const exact = { additionalProperties: false } as const;
const sourceSchema = Type.Object({
  url: Type.String({ pattern: '^https://', maxLength: 2048 }), title: Type.String({ minLength: 1 }),
  verified_at: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  effective_at: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
  sha256: Type.Optional(Type.String({ pattern: '^[a-f0-9]{64}$' }))
}, exact);
const ruleSchema = Type.Object({
  id: Type.String({ minLength: 1 }), kind: Type.Union(['dimensions', 'aspect', 'formats', 'max_bytes', 'min_bytes', 'opaque', 'srgb', 'dpi', 'visual', 'confirmation'].map(value => Type.Literal(value))),
  strength: Type.Union([Type.Literal('mandatory'), Type.Literal('recommended')]), value: Type.Optional(Type.Unknown()),
  text: Type.String({ minLength: 1 }), source: Type.String({ pattern: '^https://' }), tolerance: Type.Optional(Type.Number({ minimum: 0 }))
}, exact);
export const PresetSchema = Type.Object({
  id: Type.String({ minLength: 1 }), version: Type.String({ minLength: 1 }), purpose: Type.String({ minLength: 1 }),
  jurisdiction: Type.String({ minLength: 1 }), authority: Type.String({ minLength: 1 }), channel: Type.String({ minLength: 1 }), language: Type.String({ minLength: 1 }),
  aliases: Type.Array(Type.String({ minLength: 1 })), sources: Type.Array(sourceSchema, { minItems: 1 }), rules: Type.Array(ruleSchema),
  edit_policy: Type.Object({ allowed: Type.Array(Type.String()), forbidden: Type.Array(Type.String()), unspecified: Type.Array(Type.String()), notes: Type.String() }, exact),
  exceptions: Type.Array(Type.String()), user_confirmations: Type.Array(Type.String()),
  freshness: Type.Object({ status: Type.Union([Type.Literal('verified'), Type.Literal('needs_review'), Type.Literal('unknown')]), verified_at: Type.String(), source_change: Type.Optional(Type.String()) }, exact),
  recipe_operations: Type.Optional(Type.Array(OperationSchema)), license: Type.Literal('CC0-1.0')
}, { ...exact, $id: 'https://superaster.local/schema/preset-1.0.json' });
const ajv = new Ajv({ strict: true, allErrors: true });
const checkPresets = ajv.compile<Preset[]>(Type.Array(PresetSchema));

function invalid(message: string): never { throw new SuperasterError('INVALID_INPUT', `Invalid catalog: ${message}`); }
function object(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : invalid('expected object'); }
function positiveNumber(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : invalid('expected positive number'); }
function dimensionValues(rule: CatalogRule): Record<string, number> {
  const value = object(rule.value), result: Record<string, number> = {};
  const permitted = new Set(['width', 'height', 'width_mm', 'height_mm', 'dpi', 'min_width', 'min_height', 'max_width', 'max_height']);
  for (const [key, number] of Object.entries(value)) {
    if (!permitted.has(key)) invalid(`unknown dimension ${key}`);
    result[key] = positiveNumber(number);
    if (!key.endsWith('_mm') && !Number.isSafeInteger(number)) invalid(`noninteger pixel/density dimension ${key}`);
  }
  if (Object.keys(result).length === 0) invalid('empty dimensions');
  if ('width_mm' in result || 'height_mm' in result) {
    if (!result.width_mm || !result.height_mm || !result.dpi) invalid('physical dimensions require both axes and selected dpi');
    if (Object.keys(result).some(key => !['width_mm', 'height_mm', 'dpi'].includes(key))) invalid('mixed physical/pixel dimensions');
  }
  return result;
}
function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}

/** Validate contributed records before they can become a reviewed, immutable catalog. */
export function parsePresets(value: unknown): Preset[] {
  if (!checkPresets(value)) invalid(ajv.errorsText(checkPresets.errors));
  const pins = new Set<string>(), operations = new Set<string>(operationDefinitions.map(operation => operation.id));
  for (const preset of value) {
    const pin = `${preset.id}@${preset.version}`;
    if (pins.has(pin)) invalid(`duplicate pin ${pin}`);
    pins.add(pin);
    const sources = new Set(preset.sources.map(source => source.url)), ids = new Set<string>(), policies = new Set<string>();
    for (const category of ['allowed', 'forbidden', 'unspecified'] as const) for (const op of preset.edit_policy[category]) {
      if (!operations.has(op)) invalid(`unknown operation ${op}`);
      if (policies.has(op)) invalid(`contradictory/duplicate edit policy for ${op}`);
      policies.add(op);
    }
    if (policies.size !== operations.size) invalid(`incomplete edit policy ${pin}`);
    for (const rule of preset.rules) {
      if (ids.has(rule.id)) invalid(`duplicate rule ${rule.id}`);
      ids.add(rule.id);
      if (!sources.has(rule.source)) invalid(`uncited rule ${rule.id}`);
      if (rule.kind === 'dimensions') dimensionValues(rule);
      else if (['aspect', 'dpi', 'min_bytes', 'max_bytes'].includes(rule.kind)) positiveNumber(rule.value);
      else if (rule.kind === 'formats' && (!Array.isArray(rule.value) || !rule.value.length || rule.value.some(format => typeof format !== 'string' || !format))) invalid('invalid formats');
      else if (['opaque', 'srgb'].includes(rule.kind) && typeof rule.value !== 'boolean') invalid('invalid boolean rule');
    }
    if (preset.recipe_operations) parseRecipe({ spec_version: '1.0', input: { ref: 'catalog-example' }, operations: preset.recipe_operations, output: { format: 'png' } });
  }
  return freeze(value);
}

const presets = parsePresets(reviewedData);
const queryKey = (value: string) => value.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
function versions(id: string): Preset[] { return presets.filter(preset => preset.id === id).sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true })); }

/** Latest reviewed records for chooser defaults, or all immutable pins for offline history. */
export function listPresets(options: { history?: boolean } = {}): Preset[] {
  if (options.history) return [...presets];
  const ids = [...new Set(presets.map(preset => preset.id))];
  return ids.flatMap(id => { const reviewed = versions(id).find(preset => preset.freshness.status === 'verified'); return reviewed ? [reviewed] : []; });
}

export function resolvePreset(query: string, version?: string): Preset {
  if (typeof query !== 'string' || !query.trim()) throw new SuperasterError('INVALID_INPUT', 'Destination query must be a nonempty string');
  const exact = versions(query);
  if (exact.length) {
    const found = version ? exact.find(preset => preset.version === version) : exact.find(preset => preset.freshness.status === 'verified');
    if (found) return found;
    throw new SuperasterError('PRESET_NOT_FOUND', `No reviewed ${query} version ${version ?? 'latest'}`, { available_versions: exact.map(preset => preset.version) });
  }
  const key = queryKey(query);
  const available = version ? listPresets({ history: true }).filter(preset => preset.version === version) : listPresets();
  const candidates = available.filter(preset => queryKey(preset.purpose) === key || preset.aliases.some(alias => queryKey(alias) === key));
  if (candidates.length > 1) throw new SuperasterError('AMBIGUOUS_PRESET', 'Choose the purpose, submitting authority or upload channel before editing', {
    candidates: candidates.map(preset => ({ id: preset.id, version: preset.version, purpose: preset.purpose, authority: preset.authority, channel: preset.channel }))
  });
  const selected = candidates[0];
  if (!selected || (version && selected.version !== version)) throw new SuperasterError('PRESET_NOT_FOUND', `No reviewed destination matches ${query}`, { query, version });
  return selected;
}

export function presetHistory(id: string): { versions: Preset[]; latest_verified?: string } {
  const history = versions(id);
  if (!history.length) throw new SuperasterError('PRESET_NOT_FOUND', `Unknown destination ${id}`);
  return { versions: history, latest_verified: history.find(preset => preset.freshness.status === 'verified')?.version };
}

function state(rule: CatalogRule, matches: boolean, uncertain = false): RuleOutcome {
  return { id: rule.id, state: uncertain ? 'needs_review' : matches ? 'pass' : 'fail', message: `${rule.strength}: ${rule.text}`, source: rule.source };
}

export function validate(info: ImageInfo, preset: Preset): RuleOutcome[] {
  if (![info.width, info.height, info.bytes, info.pages].every(number => Number.isSafeInteger(number) && number > 0)) throw new SuperasterError('INVALID_INPUT', 'Image inspection lacks valid integer dimensions, bytes or frame count');
  const outcomes: RuleOutcome[] = [];
  if (info.pages !== 1) outcomes.push({ id: 'single-frame-support', state: 'fail', message: 'These profiles support still images; animated/multi-frame preparation is outside the MVP' });
  if (preset.freshness.status !== 'verified') outcomes.push({ id: 'source-freshness', state: 'needs_review', message: `Source freshness is ${preset.freshness.status}; review authority guidance` });
  for (const rule of preset.rules) {
    if (rule.kind === 'confirmation') { outcomes.push({ id: rule.id, state: 'not_checked', message: rule.text, source: rule.source, user_confirmation: true }); continue; }
    if (rule.kind === 'visual') { outcomes.push({ id: rule.id, state: 'needs_review', message: rule.text, source: rule.source }); continue; }
    if (rule.kind === 'dimensions') {
      const value = dimensionValues(rule);
      if (value.width_mm && info.metadata.density === undefined) { outcomes.push({ id: rule.id, state: 'not_checked', message: 'Physical dimensions require an explicit density and actual-size print check', source: rule.source }); continue; }
      const width = value.width_mm ? Math.round(value.width_mm * positiveNumber(info.metadata.density) / 25.4) : value.width;
      const height = value.height_mm ? Math.round(value.height_mm * positiveNumber(info.metadata.density) / 25.4) : value.height;
      outcomes.push(state(rule, (!width || info.width === width) && (!height || info.height === height) && (!value.min_width || info.width >= value.min_width) && (!value.min_height || info.height >= value.min_height) && (!value.max_width || info.width <= value.max_width) && (!value.max_height || info.height <= value.max_height)));
    } else if (rule.kind === 'aspect') outcomes.push(state(rule, Math.abs(info.width / info.height - positiveNumber(rule.value)) <= (rule.tolerance ?? 1e-9)));
    else if (rule.kind === 'max_bytes') {
      const cap = positiveNumber(rule.value), window = rule.tolerance ?? 0;
      outcomes.push(state(rule, info.bytes <= cap, info.bytes > cap && info.bytes <= cap + window));
    } else if (rule.kind === 'min_bytes') {
      const floor = positiveNumber(rule.value), window = rule.tolerance ?? 0;
      outcomes.push(state(rule, info.bytes >= floor, info.bytes < floor && info.bytes >= floor - window));
    } else if (rule.kind === 'formats') {
      const formats = rule.value;
      if (!Array.isArray(formats)) invalid('invalid formats');
      outcomes.push(state(rule, formats.includes(info.format === 'jpg' ? 'jpeg' : info.format)));
    } else if (rule.kind === 'opaque') {
      const opaque = 'is_opaque' in info ? info.is_opaque : undefined;
      outcomes.push(typeof opaque === 'boolean' ? state(rule, opaque === rule.value) : { id: rule.id, state: 'not_checked', message: 'Decoded-pixel opacity was not inspected', source: rule.source });
    } else if (rule.kind === 'srgb') outcomes.push(state(rule, ['srgb', 'sRGB'].includes(info.color_space) === rule.value));
    else if (rule.kind === 'dpi') outcomes.push(info.metadata.density === undefined ? { id: rule.id, state: 'not_checked', message: 'Density metadata was not available', source: rule.source } : state(rule, info.metadata.density === positiveNumber(rule.value)));
  }
  return outcomes;
}

/** Plan only explicitly permitted edits. A validation-only profile cannot re-encode an unaltered input. */
export function planPreset(preset: Preset, value: Recipe): Recipe {
  const recipe = parseRecipe(value);
  if (preset.freshness.status !== 'verified') throw new SuperasterError('EDIT_FORBIDDEN', 'Destination sources need review before editing', { preset: preset.id, freshness: preset.freshness.status });
  if (recipe.preset && (recipe.preset.id !== preset.id || recipe.preset.version !== preset.version)) throw new SuperasterError('INVALID_RECIPE', 'Recipe destination pin differs from the planned profile');
  if (!preset.edit_policy.allowed.length && !preset.edit_policy.unspecified.length) throw new SuperasterError('EDIT_FORBIDDEN', 'This destination requires an unaltered photo. Validate the original file; retake if it fails.', { preset: preset.id, reason: 'unaltered-original', guidance: preset.edit_policy.notes });
  for (const operation of recipe.operations) {
    if (preset.edit_policy.forbidden.includes(operation.op)) throw new SuperasterError('EDIT_FORBIDDEN', `${operation.op} is blocked for ${preset.id}; use permitted preparation or retake`, { operation: operation.op, preset: preset.id, guidance: preset.edit_policy.notes });
    if (!preset.edit_policy.allowed.includes(operation.op)) throw new SuperasterError('EDIT_FORBIDDEN', `Permission for ${operation.op} is unspecified; review the submitting authority or retake`, { operation: operation.op, preset: preset.id, reason: 'unspecified-edit-permission', guidance: preset.edit_policy.notes });
  }
  return { ...recipe, preset: { id: preset.id, version: preset.version } };
}

export interface SourceCheck { url: string; status: 'unchanged' | 'changed' | 'unknown'; sha256?: string; reason?: string }
export interface SourceMonitorResult { preset_id: string; preset_version: string; checked_at: string; status: 'verified' | 'needs_review' | 'unknown'; checks: SourceCheck[] }
export interface SourceMonitorOptions { fetcher?: typeof fetch; signal?: AbortSignal; max_source_bytes?: number; timeout_ms?: number }

/** Monitoring reports review state; it never mutates a published pin or approves new rules. */
export async function monitorSources(preset: Preset, options: SourceMonitorOptions = {}): Promise<SourceMonitorResult> {
  const fetcher = options.fetcher ?? globalThis.fetch, limit = options.max_source_bytes ?? 8 * 1024 * 1024, timeout = options.timeout_ms ?? 15_000;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isFinite(timeout) || timeout < 1) throw new SuperasterError('INVALID_INPUT', 'Invalid source-monitor byte/time limit');
  const checks: SourceCheck[] = [];
  for (const source of preset.sources) {
    if (options.signal?.aborted) throw new SuperasterError('CANCELLED', 'Source monitoring cancelled');
    const timeoutSignal = AbortSignal.timeout(timeout), signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetcher(source.url, { signal, redirect: 'follow' });
      if (!response.ok || !response.body) throw new Error(`Source access failed: HTTP ${response.status}`);
      reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > limit) throw new Error('Source exceeds bounded download limit'); chunks.push(chunk.value); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const hash = await sha256(bytes);
      checks.push(!source.sha256 ? { url: source.url, status: 'unknown', sha256: hash, reason: 'No reviewed raw-content baseline; maintainer verification required' } : { url: source.url, status: source.sha256 === hash ? 'unchanged' : 'changed', sha256: hash });
    } catch (error) {
      if (options.signal?.aborted) throw new SuperasterError('CANCELLED', 'Source monitoring cancelled');
      checks.push({ url: source.url, status: 'unknown', reason: error instanceof Error ? error.message : String(error) });
    } finally {
      if (reader) {
        try { await reader.cancel(); }
        catch (error) { const check = checks.at(-1); if (check) { check.status = 'unknown'; check.reason = `Source stream cleanup failed: ${error instanceof Error ? error.message : String(error)}`; } }
        finally { reader.releaseLock(); }
      }
    }
  }
  return { preset_id: preset.id, preset_version: preset.version, checked_at: new Date().toISOString(), status: checks.some(check => check.status === 'changed') ? 'needs_review' : checks.some(check => check.status === 'unknown') ? 'unknown' : 'verified', checks };
}
