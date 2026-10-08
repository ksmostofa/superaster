import type * as Ort from 'onnxruntime-web/webgpu';
import { SuperasterError } from '../../contract/src/index.js';
import { cancelled, sha256, type RuntimeOptions } from '../../core/src/index.js';
import { MODELS, type ModelDefinition } from './models.js';

/** Exact files from the installed MIT onnxruntime-web@1.30.0 package. */
export const GPU_RUNTIME_ASSETS = {
  wasm: {
    file: 'ort-wasm-simd-threaded.jsep.wasm',
    url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort-wasm-simd-threaded.jsep.wasm',
    bytes: 28312028,
    sha256: '3ad23231b5bd6d9dda55a7f84606315e0bf35b6750c28ee993c987c54cacab0f',
    delivery: 'verified persistent Cache API; passed as env.wasm.wasmBinary',
  },
  loader: {
    file: 'ort-wasm-simd-threaded.jsep.mjs',
    bytes: 46851,
    sha256: '709853412fd1ffc34247af1e73569227b5b79629c5ca3f59cc39cf7e500e4947',
    delivery: 'embedded in the default onnxruntime-web/webgpu ESM bundle',
  },
  javascript: {
    file: 'ort.webgpu.bundle.min.mjs',
    bytes: 117732,
    sha256: '0730816731ce2cdfb06f273da065d4a1c7091eb9d1756a83b2916c8a89d015e2',
    delivery: 'local pinned npm dependency, bundled with application',
  },
} as const;

const CACHE_NAME = 'superaster-ort-webgpu-1.30.0';

export type GpuProbe =
  | { supported: true; adapter: GPUAdapter; shader_f16: true; adapter_info: Record<string, string> }
  | { supported: false; reason: string };

/** Availability is a prerequisite, never evidence of model operators, speed or device support. */
export async function probeWebGpu(signal?: AbortSignal): Promise<GpuProbe> {
  cancelled(signal);
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, reason: 'WebGPU is unavailable in this browser context' };
  }
  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (error) {
    cancelled(signal);
    return { supported: false, reason: `WebGPU adapter request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  cancelled(signal);
  if (!adapter || typeof adapter.features?.has !== 'function' || typeof adapter.limits !== 'object' || typeof adapter.requestDevice !== 'function') {
    return { supported: false, reason: 'No usable WebGPU adapter was returned' };
  }
  if (!adapter.features.has('shader-f16')) {
    return { supported: false, reason: 'This WebGPU adapter lacks shader-f16 required by the approved fp16 artifact' };
  }
  const adapter_info: Record<string, string> = {};
  for (const field of ['vendor', 'architecture', 'device', 'description'] as const) {
    const value = adapter.info?.[field];
    if (typeof value === 'string' && value.length) adapter_info[field] = value;
  }
  return { supported: true, adapter, shader_f16: true, adapter_info };
}

async function verifyRuntime(bytes: Uint8Array, signal?: AbortSignal): Promise<void> {
  cancelled(signal);
  if (bytes.length !== GPU_RUNTIME_ASSETS.wasm.bytes || await sha256(bytes) !== GPU_RUNTIME_ASSETS.wasm.sha256) {
    throw new SuperasterError('MODEL_INTEGRITY', 'The WebGPU runtime failed its pinned size/SHA-256 verification', {
      asset: GPU_RUNTIME_ASSETS.wasm.file, expected_bytes: GPU_RUNTIME_ASSETS.wasm.bytes,
      expected_sha256: GPU_RUNTIME_ASSETS.wasm.sha256, actual_bytes: bytes.length,
    });
  }
  cancelled(signal);
}

export interface PreparedGpuRuntime {
  bytes: Uint8Array;
  cache_hit: boolean;
  cache_repaired: boolean;
  persistent_cache: true;
}

/** Called before ORT starts; cache hits are reverified, corrupt entries are evicted. */
export async function prepareGpuRuntime(options: RuntimeOptions = {}): Promise<PreparedGpuRuntime> {
  cancelled(options.signal);
  if (typeof caches === 'undefined') throw new SuperasterError('UNSUPPORTED', 'Persistent Cache API is unavailable for the WebGPU runtime');
  let cache: Cache;
  try { cache = await caches.open(CACHE_NAME); }
  catch (error) { throw new SuperasterError('UNSUPPORTED', 'The persistent WebGPU runtime cache could not be opened', { reason: String(error) }); }
  const asset = GPU_RUNTIME_ASSETS.wasm;
  const cached = await cache.match(asset.url);
  let cache_repaired = false;
  if (cached) {
    options.onProgress?.({ stage: 'verify', message: 'Verifying cached WebGPU runtime' });
    try {
      // Refuse a poisoned entry's declared oversized body before allocating it.
      const length = cached.headers.get('content-length');
      if (length && Number(length) !== asset.bytes) {
        await cached.body?.cancel();
        throw new SuperasterError('MODEL_INTEGRITY', 'Cached runtime size differs from the pinned artifact');
      }
      const bytes = await readBounded(cached, options);
      await verifyRuntime(bytes, options.signal);
      return { bytes, cache_hit: true, cache_repaired, persistent_cache: true };
    } catch (error) {
      cancelled(options.signal);
      if (!(error instanceof SuperasterError) || error.code !== 'MODEL_INTEGRITY') throw error;
      await cache.delete(asset.url);
      cache_repaired = true;
    }
  }
  options.onProgress?.({ stage: 'download', completed: 0, total: asset.bytes, message: 'Downloading the pinned WebGPU runtime' });
  let response: Response;
  try { response = await fetch(asset.url, { signal: options.signal, credentials: 'omit' }); }
  catch (error) {
    cancelled(options.signal);
    throw new SuperasterError('PROCESSING_FAILED', 'WebGPU runtime download failed; prepare it online before offline use', { asset: asset.url, reason: String(error) });
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new SuperasterError('PROCESSING_FAILED', `WebGPU runtime download failed with HTTP ${response.status}`, { asset: asset.url });
  }
  const length = response.headers.get('content-length');
  if (length && Number(length) !== asset.bytes) {
    await response.body.cancel();
    throw new SuperasterError('MODEL_INTEGRITY', 'WebGPU runtime download size differs from the pinned artifact');
  }
  const bytes = await readBounded(response, options, true);
  options.onProgress?.({ stage: 'verify', message: 'Verifying WebGPU runtime SHA-256' });
  await verifyRuntime(bytes, options.signal);
  // A failed cache write is explicit: this configuration cannot claim warm offline readiness.
  try {
    await cache.put(asset.url, new Response(Uint8Array.from(bytes), {
      headers: { 'content-type': 'application/wasm', 'content-length': String(asset.bytes), 'x-superaster-sha256': asset.sha256 },
    }));
  } catch (error) {
    throw new SuperasterError('LIMIT_EXCEEDED', 'The verified WebGPU runtime could not be stored persistently', { reason: String(error), asset: asset.url });
  }
  cancelled(options.signal);
  return { bytes, cache_hit: false, cache_repaired, persistent_cache: true };
}

async function readBounded(response: Response, options: RuntimeOptions, download = false): Promise<Uint8Array> {
  const asset = GPU_RUNTIME_ASSETS.wasm;
  if (!response.body) throw new SuperasterError('MODEL_INTEGRITY', 'WebGPU runtime body is missing');
  const bytes = new Uint8Array(asset.bytes);
  const reader = response.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      cancelled(options.signal);
      const chunk = await reader.read();
      if (chunk.done) break;
      if (offset + chunk.value.length > bytes.length) throw new SuperasterError('MODEL_INTEGRITY', 'WebGPU runtime exceeds its pinned artifact size');
      bytes.set(chunk.value, offset);
      offset += chunk.value.length;
      if (download) options.onProgress?.({ stage: 'download', completed: offset, total: asset.bytes, message: 'Downloading the pinned WebGPU runtime' });
    }
    if (offset !== bytes.length) throw new SuperasterError('MODEL_INTEGRITY', 'WebGPU runtime is truncated', { expected_bytes: bytes.length, actual_bytes: offset });
    return bytes;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export interface GpuSession {
  session: Ort.InferenceSession;
  runtime: typeof Ort;
  metadata: {
    runtime: 'onnxruntime-web 1.30.0';
    backend: 'webgpu';
    model_hash: string;
    shader_f16: true;
    adapter_info: Record<string, string>;
    runtime_hash: typeof GPU_RUNTIME_ASSETS.wasm.sha256;
    runtime_cache_hit: boolean;
    runtime_cache_repaired: boolean;
    cpu_kernel_fallback: 'ORT default permitted; operator assignment not profiled';
    timings_ms: Record<string, number>;
  };
}

/**
 * Use in a dedicated worker/JS realm, before importing another ORT Web entrypoint.
 * ORT flags and backend registration are global. The caller owns session reuse/release.
 * Source: onnxruntime-web/lib/wasm/{wasm-factory,wasm-utils-import,wasm-core-impl}.ts.
 */
export async function createGpuSession(modelBytes: Uint8Array, model: ModelDefinition, options: RuntimeOptions = {}): Promise<GpuSession> {
  const timings_ms: Record<string, number> = {};
  const startProbe = performance.now();
  const probe = await probeWebGpu(options.signal);
  timings_ms.gpu_probe = performance.now() - startProbe;
  if (!probe.supported) throw new SuperasterError('UNSUPPORTED', probe.reason, { backend: 'webgpu', model: model.id });
  const approved = MODELS.find(candidate => candidate.id === model.id);
  if (!approved || approved.sha256 !== model.sha256 || approved.revision !== model.revision || modelBytes.length !== approved.bytes) {
    throw new SuperasterError('MODEL_INTEGRITY', 'WebGPU requires an exact approved model artifact');
  }
  const startVerify = performance.now();
  options.onProgress?.({ stage: 'verify', message: 'Verifying the approved WebGPU model' });
  if (await sha256(modelBytes) !== approved.sha256) throw new SuperasterError('MODEL_INTEGRITY', 'The WebGPU model failed its approved SHA-256 verification', { model: approved.id });
  cancelled(options.signal);
  timings_ms.model_verify = performance.now() - startVerify;
  const startAsset = performance.now();
  const prepared = await prepareGpuRuntime(options);
  timings_ms.runtime_setup = performance.now() - startAsset;
  const runtime = await import('onnxruntime-web/webgpu');
  if (runtime.env.versions.web !== '1.30.0') throw new SuperasterError('MODEL_INTEGRITY', 'WebGPU JavaScript and runtime pins differ', { actual: runtime.env.versions.web });
  cancelled(options.signal);
  runtime.env.wasm.numThreads = 1;
  runtime.env.wasm.proxy = false;
  runtime.env.wasm.wasmPaths = undefined;
  runtime.env.wasm.wasmBinary = prepared.bytes;
  runtime.env.webgpu.adapter = probe.adapter;
  const startInitialize = performance.now();
  options.onProgress?.({ stage: 'initialize', message: `Initializing ${approved.name} with WebGPU` });
  let session: Ort.InferenceSession | undefined;
  try {
    session = await runtime.InferenceSession.create(modelBytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
    cancelled(options.signal);
    const input = session.inputMetadata[0], output = session.outputMetadata[0];
    if (session.inputNames.length !== 1 || session.outputNames.length !== 1 || !input?.isTensor || input.name !== approved.inputName || input.type !== 'float32' || input.shape.join(',') !== '1,3,512,512' || !output?.isTensor || output.name !== approved.outputName || output.type !== 'float32' || output.shape.join(',') !== '1,1,512,512') {
      throw new SuperasterError('MODEL_INTEGRITY', 'The WebGPU model tensor contract differs from the approved profile');
    }
    timings_ms.initialize = performance.now() - startInitialize;
    return {
      session, runtime,
      metadata: {
        runtime: 'onnxruntime-web 1.30.0', backend: 'webgpu', model_hash: approved.sha256,
        shader_f16: true, adapter_info: probe.adapter_info, runtime_hash: GPU_RUNTIME_ASSETS.wasm.sha256,
        runtime_cache_hit: prepared.cache_hit, runtime_cache_repaired: prepared.cache_repaired,
        cpu_kernel_fallback: 'ORT default permitted; operator assignment not profiled', timings_ms,
      },
    };
  } catch (error) {
    await session?.release();
    cancelled(options.signal);
    if (error instanceof SuperasterError) throw error;
    throw new SuperasterError('UNSUPPORTED', 'The approved model could not initialize with this WebGPU configuration', { model: approved.id, reason: error instanceof Error ? error.message : String(error) });
  } finally {
    // The initialized native WASM module owns its memory. Drop the extra downloadable buffer reference.
    runtime.env.wasm.wasmBinary = undefined;
  }
}
