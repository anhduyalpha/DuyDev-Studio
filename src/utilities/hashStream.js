/**
 * hashStream.js - Zero-dependency High-Performance Streaming Hash Suite
 * Pure-JS incremental MD5, SHA-1, SHA-256, and SHA-512 engines.
 * Hybrid streaming: Web Crypto fast-path for <100MB + pure-JS chunked streaming for >=100MB.
 */

// --- Abort Helper ---
function createAbortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted', 'AbortError');
  }
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

function toUint8Array(input) {
  if (typeof input === 'string') {
    return new TextEncoder().encode(input);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('Expected string, Uint8Array, or ArrayBuffer');
}

// ==========================================
// 1. Pure-JS Incremental MD5 (RFC 1321)
// ==========================================
const MD5_S = [
  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
];

const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
  MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
}

export class Md5Hasher {
  constructor() {
    this.reset();
  }

  reset() {
    this.a0 = 0x67452301;
    this.b0 = 0xefcdab89;
    this.c0 = 0x98badcfe;
    this.d0 = 0x10325476;
    this.buffer = new Uint8Array(64);
    this.bufferLen = 0;
    this.totalBytes = 0n;
    this.finalized = false;
    this.cachedHex = null;
    this._M = new Uint32Array(16);
  }

  update(input) {
    if (this.finalized) {
      throw new Error('Cannot update after digest has been finalized');
    }
    const bytes = toUint8Array(input);
    if (bytes.length === 0) return this;

    this.totalBytes += BigInt(bytes.length);
    let offset = 0;
    const len = bytes.length;

    if (this.bufferLen > 0) {
      const needed = 64 - this.bufferLen;
      const copyLen = Math.min(needed, len);
      this.buffer.set(bytes.subarray(0, copyLen), this.bufferLen);
      this.bufferLen += copyLen;
      offset += copyLen;

      if (this.bufferLen === 64) {
        this._processBlock(this.buffer, 0);
        this.bufferLen = 0;
      }
    }

    while (offset + 64 <= len) {
      this._processBlock(bytes, offset);
      offset += 64;
    }

    if (offset < len) {
      const remaining = bytes.subarray(offset);
      this.buffer.set(remaining, this.bufferLen);
      this.bufferLen += remaining.length;
    }

    return this;
  }

  _processBlock(buf, offset) {
    const M = this._M;
    for (let j = 0; j < 16; j++) {
      const idx = offset + (j << 2);
      M[j] = (buf[idx] | (buf[idx + 1] << 8) | (buf[idx + 2] << 16) | (buf[idx + 3] << 24)) >>> 0;
    }

    let a = this.a0;
    let b = this.b0;
    let c = this.c0;
    let d = this.d0;

    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) & 15;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) & 15;
      }

      const temp = d;
      d = c;
      c = b;
      const rot = (a + f + MD5_K[i] + M[g]) >>> 0;
      const shift = MD5_S[i];
      b = (b + ((rot << shift) | (rot >>> (32 - shift)))) >>> 0;
      a = temp;
    }

    this.a0 = (this.a0 + a) >>> 0;
    this.b0 = (this.b0 + b) >>> 0;
    this.c0 = (this.c0 + c) >>> 0;
    this.d0 = (this.d0 + d) >>> 0;
  }

  digestHex() {
    if (this.finalized) {
      return this.cachedHex;
    }
    this.finalized = true;

    this.buffer[this.bufferLen++] = 0x80;
    if (this.bufferLen > 56) {
      this.buffer.fill(0, this.bufferLen, 64);
      this._processBlock(this.buffer, 0);
      this.bufferLen = 0;
    }
    this.buffer.fill(0, this.bufferLen, 56);

    const bitLen = this.totalBytes * 8n;
    for (let i = 0; i < 8; i++) {
      this.buffer[56 + i] = Number((bitLen >> BigInt(i * 8)) & 0xffn);
    }
    this._processBlock(this.buffer, 0);

    const wordToHexLE = (val) => {
      let s = '';
      for (let i = 0; i < 4; i++) {
        s += ((val >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
      }
      return s;
    };

    this.cachedHex = wordToHexLE(this.a0) + wordToHexLE(this.b0) + wordToHexLE(this.c0) + wordToHexLE(this.d0);
    return this.cachedHex;
  }

  hex() {
    return this.digestHex();
  }
}

// ==========================================
// 2. Pure-JS Incremental SHA-1 (FIPS 180-4)
// ==========================================
export class Sha1Hasher {
  constructor() {
    this.reset();
  }

  reset() {
    this.h0 = 0x67452301;
    this.h1 = 0xefcdab89;
    this.h2 = 0x98badcfe;
    this.h3 = 0x10325476;
    this.h4 = 0xc3d2e1f0;
    this.buffer = new Uint8Array(64);
    this.bufferLen = 0;
    this.totalBytes = 0n;
    this.finalized = false;
    this.cachedHex = null;
    this._W = new Uint32Array(80);
  }

  update(input) {
    if (this.finalized) {
      throw new Error('Cannot update after digest has been finalized');
    }
    const bytes = toUint8Array(input);
    if (bytes.length === 0) return this;

    this.totalBytes += BigInt(bytes.length);
    let offset = 0;
    const len = bytes.length;

    if (this.bufferLen > 0) {
      const needed = 64 - this.bufferLen;
      const copyLen = Math.min(needed, len);
      this.buffer.set(bytes.subarray(0, copyLen), this.bufferLen);
      this.bufferLen += copyLen;
      offset += copyLen;

      if (this.bufferLen === 64) {
        this._processBlock(this.buffer, 0);
        this.bufferLen = 0;
      }
    }

    while (offset + 64 <= len) {
      this._processBlock(bytes, offset);
      offset += 64;
    }

    if (offset < len) {
      const remaining = bytes.subarray(offset);
      this.buffer.set(remaining, this.bufferLen);
      this.bufferLen += remaining.length;
    }

    return this;
  }

  _processBlock(buf, offset) {
    const W = this._W;
    for (let j = 0; j < 16; j++) {
      const idx = offset + (j << 2);
      W[j] = ((buf[idx] << 24) | (buf[idx + 1] << 16) | (buf[idx + 2] << 8) | buf[idx + 3]) >>> 0;
    }
    for (let t = 16; t < 80; t++) {
      const v = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16];
      W[t] = ((v << 1) | (v >>> 31)) >>> 0;
    }

    let a = this.h0;
    let b = this.h1;
    let c = this.h2;
    let d = this.h3;
    let e = this.h4;

    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const rotA = ((a << 5) | (a >>> 27)) >>> 0;
      const temp = (rotA + f + e + k + W[t]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    this.h0 = (this.h0 + a) >>> 0;
    this.h1 = (this.h1 + b) >>> 0;
    this.h2 = (this.h2 + c) >>> 0;
    this.h3 = (this.h3 + d) >>> 0;
    this.h4 = (this.h4 + e) >>> 0;
  }

  digestHex() {
    if (this.finalized) {
      return this.cachedHex;
    }
    this.finalized = true;

    this.buffer[this.bufferLen++] = 0x80;
    if (this.bufferLen > 56) {
      this.buffer.fill(0, this.bufferLen, 64);
      this._processBlock(this.buffer, 0);
      this.bufferLen = 0;
    }
    this.buffer.fill(0, this.bufferLen, 56);

    const bitLen = this.totalBytes * 8n;
    for (let i = 0; i < 8; i++) {
      this.buffer[56 + i] = Number((bitLen >> BigInt((7 - i) * 8)) & 0xffn);
    }
    this._processBlock(this.buffer, 0);

    const wToHex = (val) => (val >>> 0).toString(16).padStart(8, '0');
    this.cachedHex = wToHex(this.h0) + wToHex(this.h1) + wToHex(this.h2) + wToHex(this.h3) + wToHex(this.h4);
    return this.cachedHex;
  }

  hex() {
    return this.digestHex();
  }
}

// ==========================================
// 3. Pure-JS Incremental SHA-256 (FIPS 180-4)
// ==========================================
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export class Sha256Hasher {
  constructor() {
    this.reset();
  }

  reset() {
    this.h0 = 0x6a09e667;
    this.h1 = 0xbb67ae85;
    this.h2 = 0x3c6ef372;
    this.h3 = 0xa54ff53a;
    this.h4 = 0x510e527f;
    this.h5 = 0x9b05688c;
    this.h6 = 0x1f83d9ab;
    this.h7 = 0x5be0cd19;
    this.buffer = new Uint8Array(64);
    this.bufferLen = 0;
    this.totalBytes = 0n;
    this.finalized = false;
    this.cachedHex = null;
    this._W = new Uint32Array(64);
  }

  update(input) {
    if (this.finalized) {
      throw new Error('Cannot update after digest has been finalized');
    }
    const bytes = toUint8Array(input);
    if (bytes.length === 0) return this;

    this.totalBytes += BigInt(bytes.length);
    let offset = 0;
    const len = bytes.length;

    if (this.bufferLen > 0) {
      const needed = 64 - this.bufferLen;
      const copyLen = Math.min(needed, len);
      this.buffer.set(bytes.subarray(0, copyLen), this.bufferLen);
      this.bufferLen += copyLen;
      offset += copyLen;

      if (this.bufferLen === 64) {
        this._processBlock(this.buffer, 0);
        this.bufferLen = 0;
      }
    }

    while (offset + 64 <= len) {
      this._processBlock(bytes, offset);
      offset += 64;
    }

    if (offset < len) {
      const remaining = bytes.subarray(offset);
      this.buffer.set(remaining, this.bufferLen);
      this.bufferLen += remaining.length;
    }

    return this;
  }

  _processBlock(buf, offset) {
    const W = this._W;
    for (let j = 0; j < 16; j++) {
      const idx = offset + (j << 2);
      W[j] = ((buf[idx] << 24) | (buf[idx + 1] << 16) | (buf[idx + 2] << 8) | buf[idx + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15];
      const s0 = (((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)) >>> 0;
      const w2 = W[t - 2];
      const s1 = (((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10)) >>> 0;
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = this.h0;
    let b = this.h1;
    let c = this.h2;
    let d = this.h3;
    let e = this.h4;
    let f = this.h5;
    let g = this.h6;
    let h = this.h7;

    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    this.h0 = (this.h0 + a) >>> 0;
    this.h1 = (this.h1 + b) >>> 0;
    this.h2 = (this.h2 + c) >>> 0;
    this.h3 = (this.h3 + d) >>> 0;
    this.h4 = (this.h4 + e) >>> 0;
    this.h5 = (this.h5 + f) >>> 0;
    this.h6 = (this.h6 + g) >>> 0;
    this.h7 = (this.h7 + h) >>> 0;
  }

  digestHex() {
    if (this.finalized) {
      return this.cachedHex;
    }
    this.finalized = true;

    this.buffer[this.bufferLen++] = 0x80;
    if (this.bufferLen > 56) {
      this.buffer.fill(0, this.bufferLen, 64);
      this._processBlock(this.buffer, 0);
      this.bufferLen = 0;
    }
    this.buffer.fill(0, this.bufferLen, 56);

    const bitLen = this.totalBytes * 8n;
    for (let i = 0; i < 8; i++) {
      this.buffer[56 + i] = Number((bitLen >> BigInt((7 - i) * 8)) & 0xffn);
    }
    this._processBlock(this.buffer, 0);

    const wToHex = (val) => (val >>> 0).toString(16).padStart(8, '0');
    this.cachedHex =
      wToHex(this.h0) +
      wToHex(this.h1) +
      wToHex(this.h2) +
      wToHex(this.h3) +
      wToHex(this.h4) +
      wToHex(this.h5) +
      wToHex(this.h6) +
      wToHex(this.h7);
    return this.cachedHex;
  }

  hex() {
    return this.digestHex();
  }
}

// ==========================================
// 4. Pure-JS Incremental SHA-512 (FIPS 180-4)
// ==========================================
const MASK64 = 0xffffffffffffffffn;

const SHA512_K = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
];

function rotr64(x, n) {
  const bn = BigInt(n);
  return ((x >> bn) | (x << (64n - bn))) & MASK64;
}

export class Sha512Hasher {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = [
      0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
      0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
    ];
    this.buffer = new Uint8Array(128);
    this.bufferLen = 0;
    this.totalBytes = 0n;
    this.finalized = false;
    this.cachedHex = null;
    this._W = new Array(80);
  }

  update(input) {
    if (this.finalized) {
      throw new Error('Cannot update after digest has been finalized');
    }
    const bytes = toUint8Array(input);
    if (bytes.length === 0) return this;

    this.totalBytes += BigInt(bytes.length);
    let offset = 0;
    const len = bytes.length;

    if (this.bufferLen > 0) {
      const needed = 128 - this.bufferLen;
      const copyLen = Math.min(needed, len);
      this.buffer.set(bytes.subarray(0, copyLen), this.bufferLen);
      this.bufferLen += copyLen;
      offset += copyLen;

      if (this.bufferLen === 128) {
        this._processBlock(this.buffer, 0);
        this.bufferLen = 0;
      }
    }

    while (offset + 128 <= len) {
      this._processBlock(bytes, offset);
      offset += 128;
    }

    if (offset < len) {
      const remaining = bytes.subarray(offset);
      this.buffer.set(remaining, this.bufferLen);
      this.bufferLen += remaining.length;
    }

    return this;
  }

  _processBlock(buf, offset) {
    const W = this._W;
    for (let j = 0; j < 16; j++) {
      let w = 0n;
      const idx = offset + (j << 3);
      for (let k = 0; k < 8; k++) {
        w = (w << 8n) | BigInt(buf[idx + k]);
      }
      W[j] = w;
    }

    for (let t = 16; t < 80; t++) {
      const w15 = W[t - 15];
      const s0 = (rotr64(w15, 1) ^ rotr64(w15, 8) ^ (w15 >> 7n)) & MASK64;
      const w2 = W[t - 2];
      const s1 = (rotr64(w2, 19) ^ rotr64(w2, 61) ^ (w2 >> 6n)) & MASK64;
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) & MASK64;
    }

    let a = this.state[0];
    let b = this.state[1];
    let c = this.state[2];
    let d = this.state[3];
    let e = this.state[4];
    let f = this.state[5];
    let g = this.state[6];
    let h = this.state[7];

    for (let t = 0; t < 80; t++) {
      const S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
      const ch = (e & f) ^ ((~e & MASK64) & g);
      const temp1 = (h + S1 + ch + SHA512_K[t] + W[t]) & MASK64;
      const S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & MASK64;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & MASK64;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & MASK64;
    }

    this.state[0] = (this.state[0] + a) & MASK64;
    this.state[1] = (this.state[1] + b) & MASK64;
    this.state[2] = (this.state[2] + c) & MASK64;
    this.state[3] = (this.state[3] + d) & MASK64;
    this.state[4] = (this.state[4] + e) & MASK64;
    this.state[5] = (this.state[5] + f) & MASK64;
    this.state[6] = (this.state[6] + g) & MASK64;
    this.state[7] = (this.state[7] + h) & MASK64;
  }

  digestHex() {
    if (this.finalized) {
      return this.cachedHex;
    }
    this.finalized = true;

    this.buffer[this.bufferLen++] = 0x80;
    if (this.bufferLen > 112) {
      this.buffer.fill(0, this.bufferLen, 128);
      this._processBlock(this.buffer, 0);
      this.bufferLen = 0;
    }
    this.buffer.fill(0, this.bufferLen, 112);

    const bitLen = this.totalBytes * 8n;
    for (let i = 0; i < 16; i++) {
      this.buffer[112 + i] = Number((bitLen >> BigInt((15 - i) * 8)) & 0xffn);
    }
    this._processBlock(this.buffer, 0);

    this.cachedHex = this.state.map((w) => w.toString(16).padStart(16, '0')).join('');
    return this.cachedHex;
  }

  hex() {
    return this.digestHex();
  }
}

// ==========================================
// 5. High-Level Text & Streaming File APIs
// ==========================================

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes MD5, SHA-1, SHA-256, and SHA-512 hashes for raw text strings.
 * @param {string} text
 * @returns {Promise<{ md5: string, sha1: string, sha256: string, sha512: string }>}
 */
export async function computeTextHashes(text) {
  const data = new TextEncoder().encode(text || '');
  const md5 = new Md5Hasher().update(data).hex();

  if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
    const [sha1Buf, sha256Buf, sha512Buf] = await Promise.all([
      crypto.subtle.digest('SHA-1', data),
      crypto.subtle.digest('SHA-256', data),
      crypto.subtle.digest('SHA-512', data)
    ]);
    return {
      md5,
      sha1: bufferToHex(sha1Buf),
      sha256: bufferToHex(sha256Buf),
      sha512: bufferToHex(sha512Buf)
    };
  }

  return {
    md5,
    sha1: new Sha1Hasher().update(data).hex(),
    sha256: new Sha256Hasher().update(data).hex(),
    sha512: new Sha512Hasher().update(data).hex()
  };
}

/**
 * Streams a File or Blob in bounded slices, computing MD5, SHA-1, SHA-256, and SHA-512 concurrently.
 * Employs Web Crypto subtle.digest fast-path for < webCryptoThreshold and pure-JS streaming for >= webCryptoThreshold.
 *
 * @param {Blob|File} file
 * @param {Object} [options]
 * @param {number} [options.chunkSize=4194304] Slice size in bytes (default 4MB)
 * @param {number} [options.webCryptoThreshold=104857600] Threshold for Web Crypto memory path (default 100MB)
 * @param {(percent: number) => void} [options.onProgress] Progress callback (0-100)
 * @param {AbortSignal} [options.signal] AbortSignal to cancel streaming cleanly
 * @returns {Promise<{ md5: string, sha1: string, sha256: string, sha512: string }>}
 */
export async function computeFileHashesStreaming(file, {
  chunkSize = 4 * 1024 * 1024,
  webCryptoThreshold = 100 * 1024 * 1024,
  onProgress,
  signal
} = {}) {
  if (signal?.aborted) {
    throw createAbortError();
  }

  const fileSize = file?.size || 0;

  // Zero-byte edge case
  if (fileSize === 0) {
    onProgress?.(100);
    return {
      md5: 'd41d8cd98f00b204e9800998ecf8427e',
      sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sha512:
        'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
    };
  }

  const canUseWebCrypto =
    typeof crypto !== 'undefined' &&
    crypto?.subtle?.digest &&
    fileSize < webCryptoThreshold;

  if (canUseWebCrypto) {
    // Fast path: load ArrayBuffer once for native Web Crypto SHA-1/256/512 + stream MD5 in chunks
    const arrayBuffer = await file.arrayBuffer();
    if (signal?.aborted) {
      throw createAbortError();
    }

    const shaPromise = Promise.all([
      crypto.subtle.digest('SHA-1', arrayBuffer),
      crypto.subtle.digest('SHA-256', arrayBuffer),
      crypto.subtle.digest('SHA-512', arrayBuffer)
    ]);

    const md5Hasher = new Md5Hasher();
    const bytes = new Uint8Array(arrayBuffer);
    let offset = 0;

    while (offset < fileSize) {
      if (signal?.aborted) {
        throw createAbortError();
      }
      const end = Math.min(offset + chunkSize, fileSize);
      md5Hasher.update(bytes.subarray(offset, end));
      offset = end;

      const pct = Math.min(100, Math.round((offset / fileSize) * 100));
      onProgress?.(pct);

      if (offset < fileSize) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const [sha1Buf, sha256Buf, sha512Buf] = await shaPromise;
    if (signal?.aborted) {
      throw createAbortError();
    }

    onProgress?.(100);
    return {
      md5: md5Hasher.hex(),
      sha1: bufferToHex(sha1Buf),
      sha256: bufferToHex(sha256Buf),
      sha512: bufferToHex(sha512Buf)
    };
  }

  // Pure-JS chunked streaming path (>= webCryptoThreshold or no crypto.subtle)
  // NEVER loads entire file into memory; reads 4MB slices with yielding
  const md5Hasher = new Md5Hasher();
  const sha1Hasher = new Sha1Hasher();
  const sha256Hasher = new Sha256Hasher();
  const sha512Hasher = new Sha512Hasher();

  let offset = 0;

  while (offset < fileSize) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    const end = Math.min(offset + chunkSize, fileSize);
    const sliceBlob = file.slice(offset, end);
    const chunkBuf = await sliceBlob.arrayBuffer();

    if (signal?.aborted) {
      throw createAbortError();
    }

    const chunk = new Uint8Array(chunkBuf);
    md5Hasher.update(chunk);
    sha1Hasher.update(chunk);
    sha256Hasher.update(chunk);
    sha512Hasher.update(chunk);

    offset = end;
    const pct = Math.min(100, Math.round((offset / fileSize) * 100));
    onProgress?.(pct);

    if (offset < fileSize) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  onProgress?.(100);
  return {
    md5: md5Hasher.hex(),
    sha1: sha1Hasher.hex(),
    sha256: sha256Hasher.hex(),
    sha512: sha512Hasher.hex()
  };
}
