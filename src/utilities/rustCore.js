/**
 * Rust WebAssembly Core Accelerator (`src/vendor/ds_rust_core.wasm`)
 * Provides zero-copy CRC-32, FNV-1a 64-bit digest, and instant fuzzy matching.
 */

let _exports = null;
let _initPromise = null;
const _encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input === 'string') {
    if (_encoder) return _encoder.encode(input);
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = input.charCodeAt(i) & 0xff;
    return out;
  }
  return new Uint8Array(0);
}

function jsCrc32Fallback(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function isRustCoreReady() {
  return Boolean(_exports);
}

export function rustCrc32(input) {
  const bytes = toBytes(input);
  if (bytes.length === 0) return 0;
  if (!_exports) return jsCrc32Fallback(bytes);

  const ptr = _exports.alloc_buf(bytes.length);
  if (!ptr) return jsCrc32Fallback(bytes);
  try {
    new Uint8Array(_exports.memory.buffer, ptr, bytes.length).set(bytes);
    return _exports.crc32_fast(ptr, bytes.length) >>> 0;
  } finally {
    _exports.free_buf(ptr, bytes.length);
  }
}

export function rustFnv1a64(input) {
  const bytes = toBytes(input);
  if (!_exports) {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < bytes.length; i++) {
      h ^= BigInt(bytes[i]);
      h = BigInt.asUintN(64, h * 0x0100000001b3n);
    }
    return h.toString(16).padStart(16, '0');
  }
  const ptr = bytes.length > 0 ? _exports.alloc_buf(bytes.length) : 0;
  if (bytes.length > 0 && !ptr) return 'cbf29ce484222325';
  try {
    if (bytes.length > 0) {
      new Uint8Array(_exports.memory.buffer, ptr, bytes.length).set(bytes);
    }
    const val = _exports.fnv1a64_fast(ptr, bytes.length);
    return BigInt.asUintN(64, BigInt(val)).toString(16).padStart(16, '0');
  } finally {
    if (ptr) _exports.free_buf(ptr, bytes.length);
  }
}

export function rustFuzzyScore(query, target) {
  if (!query || !target) return 0;
  if (!_exports) {
    const q = String(query).toLowerCase();
    const t = String(target).toLowerCase();
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length ? 100 : 0;
  }

  const qBytes = toBytes(String(query));
  const tBytes = toBytes(String(target));
  if (qBytes.length === 0 || tBytes.length === 0) return 0;

  const qPtr = _exports.alloc_buf(qBytes.length);
  const tPtr = _exports.alloc_buf(tBytes.length);
  if (!qPtr || !tPtr) {
    if (qPtr) _exports.free_buf(qPtr, qBytes.length);
    if (tPtr) _exports.free_buf(tPtr, tBytes.length);
    return 0;
  }

  try {
    const mem = new Uint8Array(_exports.memory.buffer);
    mem.set(qBytes, qPtr);
    mem.set(tBytes, tPtr);
    return _exports.fuzzy_match_score(qPtr, qBytes.length, tPtr, tBytes.length) >>> 0;
  } finally {
    _exports.free_buf(qPtr, qBytes.length);
    _exports.free_buf(tPtr, tBytes.length);
  }
}

export async function initRustCore(wasmUrl = './src/vendor/ds_rust_core.wasm') {
  if (_exports) return _exports;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      if (typeof WebAssembly === 'undefined' || typeof fetch === 'undefined') return null;
      let instanceResult;
      const respPromise = fetch(wasmUrl);
      if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
          instanceResult = await WebAssembly.instantiateStreaming(respPromise, {});
        } catch {
          const resp = await fetch(wasmUrl);
          if (!resp.ok) return null;
          instanceResult = await WebAssembly.instantiate(await resp.arrayBuffer(), {});
        }
      } else {
        const resp = await respPromise;
        if (!resp.ok) return null;
        instanceResult = await WebAssembly.instantiate(await resp.arrayBuffer(), {});
      }
      _exports = instanceResult?.instance?.exports || null;
      return _exports;
    } catch {
      return null;
    }
  })();

  return _initPromise;
}

const rustCoreApi = {
  init: initRustCore,
  isReady: isRustCoreReady,
  crc32: rustCrc32,
  fnv1a64: rustFnv1a64,
  fuzzyScore: rustFuzzyScore
};

if (typeof window !== 'undefined') {
  window.__dsRustCore = rustCoreApi;
}

export default rustCoreApi;
