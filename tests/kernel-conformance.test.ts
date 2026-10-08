import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import vipsFactory from 'wasm-vips';
import { BrowserKernel } from '../packages/engines/src/browser-kernel.js';
import { NativeImagingKernel } from '../packages/engines/src/native.js';
import { executePipeline } from '../packages/engines/src/pipeline.js';
import { blank, type Raster, type ImagingKernel } from '../packages/engines/src/raster.js';
import { parseRecipe, type Recipe, type Operation } from '../packages/contract/src/index.js';
import { sha256 } from '../packages/core/src/index.js';

// Frozen before any measurement. These are fixture criteria, not public device support budgets.
const TOLERANCES = Object.freeze({ exact: 0, interpolation: 1, color_roundtrip: 2, lossy_q100: 3 });
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
type VipsModule = Awaited<ReturnType<typeof vipsFactory>>;
let vips: VipsModule;
let browser: BrowserKernel;
const native = new NativeImagingKernel();
let evidence: string;
const measured: Record<string, unknown> = { environment: 'Node-hosted WASM image-library unit tests; no browser/phone inference', tolerances: TOLERANCES };
beforeAll(async () => {
  await mkdir('.cache', { recursive: true }); evidence = await mkdtemp(resolve('.cache/kernel-conformance-'));
  const require = createRequire(import.meta.url);
  measured.wasm_sha256 = await sha256(await readFile(require.resolve('wasm-vips/vips.wasm')));
  measured.node = process.version; measured.native_versions = sharp.versions;
  measured.source_hashes = Object.fromEntries(await Promise.all([
    'packages/engines/src/browser-kernel.ts', 'packages/engines/src/native.ts', 'packages/engines/src/pipeline.ts',
    'packages/engines/src/raster.ts', 'packages/core/src/index.ts', 'packages/contract/src/index.ts', 'packages/catalog/src/index.ts'
  ].map(async path => [path, await sha256(await readFile(path))])));
  vips = await vipsFactory({ dynamicLibraries: [] });
  measured.wasm_vips_version = vips.version();
  browser = new BrowserKernel(async () => vips);
});
afterAll(async () => {
  await writeFile(join(evidence, 'measurements.json'), JSON.stringify(measured, null, 2) + '\n');
  console.info(`Node WASM conformance evidence: ${evidence}`);
  vips.shutdown();
});

function raster(width: number, height: number, pixels: readonly number[]): Raster { return { width, height, data: Uint8Array.from(pixels) }; }
async function png(value: Raster) { return new Uint8Array(await sharp(Buffer.from(value.data), { raw: { width: value.width, height: value.height, channels: 4 } }).png().toBuffer()); }
function pngChunks(bytes: Uint8Array) {
  const chunks: Array<{ type: string; bytes: Uint8Array; payload: Uint8Array }> = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset), end = offset + length + 12;
    if (end > bytes.length) throw new Error('Malformed generated PNG fixture');
    chunks.push({ type: new TextDecoder().decode(bytes.slice(offset + 4, offset + 8)), bytes: bytes.slice(offset, end), payload: bytes.slice(offset + 8, end - 4) }); offset = end;
  }
  return chunks;
}
function withoutPngDensity(bytes: Uint8Array) {
  // Sharp 0.35.5 emits pHYs=1000/1000 metres even when its metadata() omits density.
  // Remove the entire optional chunk; retained chunks and their CRCs stay unchanged.
  const pieces = [bytes.slice(0, 8), ...pngChunks(bytes).filter(chunk => chunk.type !== 'pHYs').map(chunk => chunk.bytes)];
  const result = new Uint8Array(pieces.reduce((length, piece) => length + piece.length, 0));
  let offset = 0; for (const piece of pieces) { result.set(piece, offset); offset += piece.length; }
  return result;
}
async function output(name: string, bytes: Uint8Array) {
  const path = join(evidence, name); await writeFile(path, bytes);
  return { path, bytes: bytes.length, sha256: await sha256(bytes), metadata: await sharp(bytes).metadata() };
}
async function saveRaster(name: string, value: Raster) { return output(name, await png(value)); }
function difference(a: Raster, b: Raster, ignoreHiddenRgb = false) {
  expect.soft([a.width, a.height]).toEqual([b.width, b.height]);
  if (a.width !== b.width || a.height !== b.height) return { comparable: false, maximum: null };
  let maximum = 0, count = 0, alphaMaximum = 0;
  for (let index = 0; index < a.data.length; index++) {
    if (ignoreHiddenRgb && index % 4 !== 3 && a.data[index - index % 4 + 3] === 0 && b.data[index - index % 4 + 3] === 0) continue;
    const delta = Math.abs(a.data[index]! - b.data[index]!); maximum = Math.max(maximum, delta);
    if (delta) count++; if (index % 4 === 3) alphaMaximum = Math.max(alphaMaximum, delta);
  }
  return { comparable: true, maximum, alpha_maximum: alphaMaximum, different_channels: count };
}
function pixel(value: Raster, x: number, y: number) { return [...value.data.subarray((y * value.width + x) * 4, (y * value.width + x) * 4 + 4)]; }
const recipe = (operations: Operation[], settings: Recipe['output'] = { format: 'png', metadata: 'strip' }): Recipe => parseRecipe({ spec_version: '1.0', input: { ref: 'known-fixture' }, operations, output: settings });
async function pipeline(kernel: ImagingKernel, input: Uint8Array, value: Recipe) {
  return executePipeline(input, value, { kernel, infer: async () => { throw new Error('Inference is forbidden in deterministic imaging conformance'); } });
}
const rgba = raster(2, 2, [200,30,80,255, 40,80,200,128, 70,200,30,64, 25,40,90,0]);

describe('native and Node-hosted WASM image contract', () => {
  it('decodes the known RGBA PNG exactly, including continuous alpha', async () => {
    const input = await png(rgba), a = await native.decode(input), b = await browser.decode(input);
    measured.decode_rgba = { input: await output('rgba-input.png', input), native: await native.inspect(input), wasm: await browser.inspect(input), difference: difference(a, b) };
    expect([...a.data]).toEqual([...rgba.data]); expect([...b.data]).toEqual([...rgba.data]);
    expect(await browser.inspect(input)).toMatchObject({ width: 2, height: 2, has_alpha: true, is_opaque: false, format: 'png' });
  });
  it('exports lossless RGBA PNG and strips sensitive source tags while retaining sRGB', async () => {
    const outputs = await Promise.all([native, browser].map(kernel => kernel.encode(rgba, { format: 'png', metadata: 'strip' })));
    const decoded = await Promise.all(outputs.map(bytes => native.decode(bytes)));
    measured.png_export = await Promise.all(outputs.map((bytes, index) => output(`rgba-${index ? 'wasm' : 'native'}.png`, bytes)));
    for (const [index, value] of decoded.entries()) {
      expect([...value.data]).toEqual([...rgba.data]);
      const tags = await sharp(outputs[index]).metadata(); expect(tags.exif).toBeUndefined(); expect(tags.icc).toBeDefined();
    }
  });
  it('composes known translucent coverage over white with exact encoded-sRGB pixels', async () => {
    const source = raster(2, 1, [255,0,0,128, 0,40,200,0]), input = await png(source), value = recipe([{ op: 'composite', background: '#ffffff' }]);
    const results = await Promise.all([native, browser].map(kernel => pipeline(kernel, input, value)));
    measured.composition = await Promise.all(results.map((result, index) => output(`composition-${index ? 'wasm' : 'native'}.png`, result.bytes)));
    for (const result of results) expect([...(await native.decode(result.bytes)).data]).toEqual([255,127,127,255, 255,255,255,255]);
  });
  it('repeats exact RGBA source pixels under nearest resizing', async () => {
    const source = raster(2, 2, [200,30,80,255, 40,80,200,128, 70,200,30,64, 25,40,90,255]);
    const a = await native.resize(source, 4, 4, 'nearest'), b = await browser.resize(source, 4, 4, 'nearest');
    measured.nearest = { native: await saveRaster('nearest-native.png', a), wasm: await saveRaster('nearest-wasm.png', b), difference: difference(a, b) };
    for (const target of [a, b]) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(pixel(target, x, y)).toEqual(pixel(source, Math.floor(x / 2), Math.floor(y / 2)));
  });
  it('resizes opaque and translucent edges with declared interpolation tolerance and alpha semantics', async () => {
    const opaque = raster(3, 2, [200,30,80,255, 40,80,200,255, 70,200,30,255, 25,40,90,255, 210,80,50,255, 20,180,220,255]);
    const transparent = raster(3, 2, [200,30,80,255, 40,80,200,128, 70,200,30,0, 25,40,90,0, 210,80,50,64, 20,180,220,255]);
    for (const [name, source] of [['opaque', opaque], ['transparent', transparent]] as const) for (const kernel of ['linear', 'lanczos3'] as const) {
      const a = await native.resize(source, 7, 5, kernel), b = await browser.resize(source, 7, 5, kernel), delta = difference(a, b, true);
      measured[`resize_${name}_${kernel}`] = { native: await saveRaster(`resize-${name}-${kernel}-native.png`, a), wasm: await saveRaster(`resize-${name}-${kernel}-wasm.png`, b), difference: delta };
      expect.soft(delta.maximum).toBeLessThanOrEqual(TOLERANCES.interpolation);
    }
  });
  it('converts embedded Display-P3 to declared sRGB within frozen color tolerances', async () => {
    const source = raster(2, 1, [180,60,20,255, 70,100,210,255]);
    const input = new Uint8Array(await sharp(Buffer.from(source.data), { raw: { width: 2, height: 1, channels: 4 } }).withIccProfile('p3').png().toBuffer());
    const a = await native.decode(input), b = await browser.decode(input), cross = difference(a, b), nativeSource = difference(a, source), wasmSource = difference(b, source);
    measured.icc = { input: await output('display-p3-input.png', input), native: await saveRaster('p3-normalized-native.png', a), wasm: await saveRaster('p3-normalized-wasm.png', b), cross, nativeSource, wasmSource };
    expect(cross.maximum).toBeLessThanOrEqual(TOLERANCES.interpolation);
    expect(nativeSource.maximum).toBeLessThanOrEqual(TOLERANCES.color_roundtrip); expect(wasmSource.maximum).toBeLessThanOrEqual(TOLERANCES.color_roundtrip);
  });
  it('retains exact WebP alpha and declared Q100 lossy color while JPEG requires opacity', async () => {
    const source = blank(8, 8, '#7896c880');
    for (const format of ['webp', 'jpeg'] as const) {
      const rasterValue = format === 'jpeg' ? blank(8, 8, '#7896c8') : source;
      const bytes = await Promise.all([native, browser].map(kernel => kernel.encode(rasterValue, { format, quality: 100, metadata: 'strip' })));
      const decoded = await Promise.all(bytes.map(value => native.decode(value)));
      measured[format] = { outputs: await Promise.all(bytes.map((value, index) => output(`codec-${index ? 'wasm' : 'native'}.${format === 'jpeg' ? 'jpg' : format}`, value))), cross: difference(decoded[0]!, decoded[1]!) };
      for (const result of decoded) {
        expect(difference(result, rasterValue).maximum).toBeLessThanOrEqual(TOLERANCES.lossy_q100);
        for (let index = 3; index < result.data.length; index += 4) expect(result.data[index]).toBe(rasterValue.data[index]);
      }
      expect(difference(decoded[0]!, decoded[1]!).maximum).toBeLessThanOrEqual(TOLERANCES.lossy_q100);
    }
    const input = await png(source);
    for (const kernel of [native, browser]) await expect(pipeline(kernel, input, recipe([], { format: 'jpeg' }))).rejects.toMatchObject({ code: 'INVALID_RECIPE' });
  });
  it('applies EXIF orientation once and default exports remove sensitive tags', async () => {
    const source = raster(3, 2, [200,30,80,255, 40,80,200,255, 70,200,30,255, 25,40,90,255, 210,80,50,255, 20,180,220,255]);
    const input = new Uint8Array(await sharp(Buffer.from(source.data), { raw: { width: 3, height: 2, channels: 4 } }).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'conformance fixture' } }).withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">fixture-only</x:xmpmeta>').toBuffer());
    const raw = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const expected = raster(2, 3, Array.from({ length: 24 }, (_, index) => { const x = Math.floor(index / 4) % 2, y = Math.floor(index / 4 / 2), channel = index % 4; return raw.data[((1 - x) * 3 + y) * 4 + channel]!; }));
    measured.orientation_input = await output('orientation-6-input.jpg', input);
    for (const [name, kernel] of [['native', native], ['wasm', browser]] as const) {
      expect(await kernel.inspect(input)).toMatchObject({ width: 3, height: 2, orientation: 6 });
      const decoded = await kernel.decode(input); expect([decoded.width, decoded.height]).toEqual([2, 3]); expect(difference(decoded, expected).maximum).toBe(TOLERANCES.exact);
      const encoded = await kernel.encode(decoded, { format: 'png', metadata: 'strip' }); measured[`orientation_${name}`] = await output(`orientation-normalized-${name}.png`, encoded);
      const tags = await sharp(encoded).metadata(); expect(tags.orientation).toBeUndefined(); expect(tags.exif).toBeUndefined(); expect(tags.xmp).toBeUndefined(); expect(tags.icc).toBeDefined();
      const twice = await kernel.decode(encoded); expect([twice.width, twice.height]).toEqual([2, 3]); expect(difference(twice, decoded).maximum).toBe(TOLERANCES.exact);
    }
  });
  it('preserves requested EXIF/XMP, resets orientation and encodes authoritative transformed pixels', async () => {
    const input = new Uint8Array(await sharp({ create: { width: 3, height: 2, channels: 3, background: '#ff0000' } }).jpeg().withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'conformance fixture' } }).withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">fixture-only</x:xmpmeta>').toBuffer());
    const authoritative = blank(6, 4, '#773355');
    for (const format of ['png', 'jpeg', 'webp'] as const) for (const [name, kernel] of [['native', native], ['wasm', browser]] as const) {
      const bytes = await kernel.encode(authoritative, { format, quality: 100, metadata: 'preserve', source: input }); measured[`preserve_${name}_${format}`] = await output(`preserve-${name}.${format === 'jpeg' ? 'jpg' : format}`, bytes);
      const tags = await sharp(bytes).metadata(); expect.soft([tags.width, tags.height, tags.orientation]).toEqual([6, 4, 1]);
      expect.soft(tags.exif?.includes('conformance fixture')).toBe(true); expect.soft(tags.xmp?.toString()).toContain('fixture-only'); expect.soft(tags.icc).toBeDefined();
      expect.soft(difference(await native.decode(bytes), authoritative).maximum).toBeLessThanOrEqual(format === 'png' ? TOLERANCES.exact : TOLERANCES.lossy_q100);
    }
  });
  it('does not invent a declared density for a PNG without a density tag', async () => {
    const original = await png(blank(2, 2, '#203040')), input = withoutPngDensity(original);
    expect(pngChunks(original).some(chunk => chunk.type === 'pHYs')).toBe(true);
    expect(pngChunks(input).some(chunk => chunk.type === 'pHYs')).toBe(false);
    const originalPixels = await sharp(original).ensureAlpha().raw().toBuffer(), correctedPixels = await sharp(input).ensureAlpha().raw().toBuffer();
    expect(correctedPixels).toEqual(originalPixels);
    const a = await native.inspect(input), b = await browser.inspect(input); measured.missing_density = { input: await output('density-absent-input.png', input), correction: 'Original generated PNG actually contained pHYs; complete optional chunk removed without changing pixels or tolerance. Binary tag absence is authoritative because Sharp synthesizes 72 DPI after removal.', native: a, wasm: b };
    expect.soft(a.metadata.density).toBeUndefined(); expect.soft(b.metadata.density).toBeUndefined();
  });
  it('reports the real pHYs density even when the native library suppresses its default value', async () => {
    const input = await png(blank(2, 2, '#203040')), physical = pngChunks(input).find(chunk => chunk.type === 'pHYs'); expect(physical).toBeDefined();
    const view = new DataView(physical!.payload.buffer, physical!.payload.byteOffset, physical!.payload.byteLength);
    expect([view.getUint32(0), view.getUint32(4), view.getUint8(8)]).toEqual([1000, 1000, 1]);
    const a = await native.inspect(input), b = await browser.inspect(input);
    measured.declared_default_density = { input: await output('density-1000ppm-input.png', input), png_pHYs: { x_pixels_per_metre: 1000, y_pixels_per_metre: 1000, unit: 1 }, native: a, wasm: b };
    // Inspection currently declares rounded integer DPI; 1000 ppm is 25.4 DPI, rounded to 25.
    expect.soft(a.metadata.density).toBe(25); expect.soft(b.metadata.density).toBe(25);
  });
  it('keeps clockwise right-angle pixels exact and arbitrary rotation bounds/fill consistent', async () => {
    const source = raster(3, 2, [200,30,80,255, 40,80,200,255, 70,200,30,255, 25,40,90,255, 210,80,50,255, 20,180,220,255]);
    const expected = raster(2, 3, [25,40,90,255, 200,30,80,255, 210,80,50,255, 40,80,200,255, 20,180,220,255, 70,200,30,255]);
    for (const [name, kernel] of [['native', native], ['wasm', browser]] as const) {
      const result = await kernel.rotate(source, 90, '#ffffff');
      measured[`rotate_90_${name}`] = { output: await saveRaster(`rotate-90-${name}.png`, result), pixels: [...result.data], difference: difference(result, expected) };
      expect.soft(difference(result, expected).maximum).toBe(TOLERANCES.exact);
    }
    const opaque = blank(9, 7, '#203040'), a = await native.rotate(opaque, 30, '#ffffff'), b = await browser.rotate(opaque, 30, '#ffffff'), delta = difference(a, b);
    measured.arbitrary_rotate = { native: await saveRaster('rotate-30-native.png', a), wasm: await saveRaster('rotate-30-wasm.png', b), difference: delta, native_corner: pixel(a, 0, 0), wasm_corner: pixel(b, 0, 0) };
    expect.soft([b.width, b.height]).toEqual([a.width, a.height]);
    for (const value of [a, b]) expect.soft([...value.data].filter((_, index) => index % 4 === 3).every(alpha => alpha === 255)).toBe(true);
    expect.soft(delta.maximum).toBeLessThanOrEqual(TOLERANCES.interpolation);
  });
  it('exports exact physical fixed-grid pixels and actual density 300', async () => {
    const input = await png(blank(3, 4, '#cc3300'));
    const value = recipe([{ op: 'print_sheet', sheet_width_mm: 101.6, sheet_height_mm: 152.4, item_width_mm: 30, item_height_mm: 40, dpi: 300, rows: 3, columns: 2, margin_mm: 5, spacing_mm: 5, background: '#ffffff' }]);
    const a = await pipeline(native, input, value), b = await pipeline(browser, input, value);
    measured.print_sheet = { native: await output('print-native.png', a.bytes), wasm: await output('print-wasm.png', b.bytes), native_record: a.record, wasm_record: b.record };
    for (const result of [a, b]) {
      const tags = await sharp(result.bytes).metadata(); expect([tags.width, tags.height, tags.density]).toEqual([1200, 1800, 300]);
      const pixels = await native.decode(result.bytes);
      for (const y of [59, 590, 1121]) for (const x of [59, 472]) {
        expect(pixel(pixels, x, y)).toEqual([204,51,0,255]); expect(pixel(pixels, x + 353, y + 471)).toEqual([204,51,0,255]); expect(pixel(pixels, x - 1, y)).toEqual([255,255,255,255]);
      }
      expect(pixel(pixels, 0, 0)).toEqual([255,255,255,255]); expect(result.record.output.metadata.density).toBe(300);
    }
    expect(difference(await native.decode(a.bytes), await native.decode(b.bytes)).maximum).toBe(TOLERANCES.exact);
  });
  it('honors 200000-byte JPEG caps at fixed geometry and fails impossible constraints', async () => {
    const source = raster(512, 512, Array.from({ length: 512 * 512 * 4 }, (_, index) => index % 4 === 3 ? 255 : (Math.floor(index / 4) * 73 + (index % 4) * 97 + Math.floor(index / 4 / 512) * 37) % 256));
    const input = await png(source), value = recipe([], { format: 'jpeg', quality: 100, max_bytes: 200000 });
    for (const [name, kernel] of [['native', native], ['wasm', browser]] as const) {
      const result = await pipeline(kernel, input, value); measured[`bytecap_${name}`] = { output: await output(`bytecap-${name}.jpg`, result.bytes), record: result.record };
      const tags = await sharp(result.bytes).metadata(); expect([tags.width, tags.height, tags.format]).toEqual([512, 512, 'jpeg']); expect(result.bytes.length).toBeLessThanOrEqual(200000);
      await expect(pipeline(kernel, input, recipe([], { format: 'jpeg', max_bytes: 1 }))).rejects.toMatchObject({ code: 'CONSTRAINT_UNSATISFIABLE' });
      await expect(pipeline(kernel, input, recipe([], { format: 'png', max_bytes: 1 }))).rejects.toMatchObject({ code: 'CONSTRAINT_UNSATISFIABLE' });
    }
  });
});
