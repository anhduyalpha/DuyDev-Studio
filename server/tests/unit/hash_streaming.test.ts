import { describe, it, expect, vi } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Md5Hasher,
  Sha1Hasher,
  Sha256Hasher,
  Sha512Hasher,
  computeTextHashes,
  computeFileHashesStreaming
} from '../../../src/utilities/hashStream.js';

// Target modules to test
// Note: hashStream.js will be created in src/utilities/hashStream.js
// We dynamically import it or import it directly.
describe('Task 3.4 — Hash Streaming & Performance Optimizations Suite', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const markdownEditorPath = path.join(rootDir, 'src/components/tools/MarkdownEditor.js');
  const pdfPreviewCanvasPath = path.join(rootDir, 'src/components/tools/pdf/components/PdfPreviewCanvas.js');
  const hashStudioPath = path.join(rootDir, 'src/components/tools/hash/HashStudio.js');
  const useHashActionsPath = path.join(rootDir, 'src/components/tools/hash/hooks/useHashActions.js');
  const hashCardsPath = path.join(rootDir, 'src/components/tools/hash/components/HashCards.js');

  const mdEditorContent = fs.readFileSync(markdownEditorPath, 'utf-8');
  const pdfCanvasContent = fs.readFileSync(pdfPreviewCanvasPath, 'utf-8');
  const hashStudioContent = fs.readFileSync(hashStudioPath, 'utf-8');
  const useHashActionsContent = fs.readFileSync(useHashActionsPath, 'utf-8');
  const hashCardsContent = fs.readFileSync(hashCardsPath, 'utf-8');

  describe('1. Static Code Analysis & Contracts', () => {
    it('PdfPreviewCanvas.js must remove backdrop-blur-sm and use bg-black/65 hover:bg-black/85', () => {
      // Must not have backdrop-blur on btn-preview-page
      expect(pdfCanvasContent).not.toMatch(/btn-preview-page[^"]*backdrop-blur/);
      expect(pdfCanvasContent).toContain('bg-black/65');
      expect(pdfCanvasContent).toContain('hover:bg-black/85');
    });

    it('MarkdownEditor.js must implement 180ms debounce, flushMarkdownSync, and cleanup timer', () => {
      expect(mdEditorContent).toMatch(/180/);
      expect(mdEditorContent).toMatch(/flushMarkdownSync/);
      expect(mdEditorContent).toMatch(/clearTimeout/);
      // Export buttons must call flushMarkdownSync
      expect(mdEditorContent).toMatch(/btnExportHtml[\s\S]*?flushMarkdownSync/);
      expect(mdEditorContent).toMatch(/btnExportMd[\s\S]*?flushMarkdownSync/);
      expect(mdEditorContent).toMatch(/btnPrintPdf[\s\S]*?flushMarkdownSync/);
    });

    it('HashStudio.js and useHashActions.js must use streaming hasher and abort on unmount/new file', () => {
      // Must not read whole file via file.arrayBuffer() in useHashActions
      expect(useHashActionsContent).not.toContain('await file.arrayBuffer()');
      expect(useHashActionsContent).toMatch(/computeFileHashesStreaming/);
      // Must support AbortController
      expect(useHashActionsContent).toMatch(/AbortController|abort/i);
      // HashCards must render MD5 card and adhere to min-h-[44px] touch target
      expect(hashCardsContent).toMatch(/MD5/i);
      expect(hashCardsContent).toMatch(/min-h-\[44px\]/);
      // Text hashing must be debounced at 150ms
      expect(hashStudioContent).toMatch(/150/);
    });
  });

  describe('2. hashStream.js Module Exports & Algorithm Accuracy', () => {
    it('must import hashStream.js and verify all exports', () => {
      expect(Md5Hasher).toBeDefined();
      expect(Sha1Hasher).toBeDefined();
      expect(Sha256Hasher).toBeDefined();
      expect(Sha512Hasher).toBeDefined();
      expect(computeTextHashes).toBeDefined();
      expect(computeFileHashesStreaming).toBeDefined();
    });

    it('Md5Hasher matches node:crypto on empty, boundary, and unicode strings', () => {
      const testCases = [
        '',
        'a',
        'abc',
        'message digest',
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
        'Exact 55 bytes text string for RFC padding boundary check!', // 55 bytes
        'Exact 56 bytes text string for RFC padding boundary check!!!', // 56 bytes
        'Exact 64 bytes text string for RFC padding boundary check!!!!!!!', // 64 bytes
        'DuyDev Studio - Tiện ích đa năng tiếng Việt với emoji 🚀🇻🇳✨'
      ];

      for (const str of testCases) {
        const expected = crypto.createHash('md5').update(Buffer.from(str, 'utf-8')).digest('hex');

        const hasher = new Md5Hasher();
        hasher.update(str);
        expect(hasher.hex()).toBe(expected);

        // Incremental chunked update
        const chunkedHasher = new Md5Hasher();
        const bytes = new TextEncoder().encode(str);
        const chunkSize = 7;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          chunkedHasher.update(bytes.subarray(i, i + chunkSize));
        }
        expect(chunkedHasher.hex()).toBe(expected);
      }
    });

    it('Sha1Hasher, Sha256Hasher, and Sha512Hasher match node:crypto bit-for-bit', () => {
      const testCases = [
        '',
        'hello world',
        'Boundary test 55: ' + 'A'.repeat(37), // 55 bytes
        'Boundary test 56: ' + 'B'.repeat(38), // 56 bytes
        'Boundary test 64: ' + 'C'.repeat(46), // 64 bytes
        'Boundary test 111: ' + 'D'.repeat(92), // 111 bytes (SHA-512 boundary)
        'Boundary test 112: ' + 'E'.repeat(93), // 112 bytes (SHA-512 boundary)
        'Boundary test 119: ' + 'F'.repeat(100), // 119 bytes
        'Boundary test 120: ' + 'G'.repeat(101), // 120 bytes
        'Boundary test 128: ' + 'H'.repeat(109), // 128 bytes
        'Multi-byte unicode: Trắc nghiệm GDPT 2018 🎯 Hoá học & Toán học 🧪📐'
      ];

      for (const str of testCases) {
        const buf = Buffer.from(str, 'utf-8');
        const expSha1 = crypto.createHash('sha1').update(buf).digest('hex');
        const expSha256 = crypto.createHash('sha256').update(buf).digest('hex');
        const expSha512 = crypto.createHash('sha512').update(buf).digest('hex');

        const sha1 = new Sha1Hasher();
        sha1.update(str);
        expect(sha1.hex()).toBe(expSha1);

        const sha256 = new Sha256Hasher();
        sha256.update(str);
        expect(sha256.hex()).toBe(expSha256);

        const sha512 = new Sha512Hasher();
        sha512.update(str);
        expect(sha512.hex()).toBe(expSha512);

        // Chunked binary test
        const sha1Chunked = new Sha1Hasher();
        const sha256Chunked = new Sha256Hasher();
        const sha512Chunked = new Sha512Hasher();
        const u8 = new TextEncoder().encode(str);
        for (let i = 0; i < u8.length; i += 5) {
          const slice = u8.subarray(i, i + 5);
          sha1Chunked.update(slice);
          sha256Chunked.update(slice);
          sha512Chunked.update(slice);
        }
        expect(sha1Chunked.hex()).toBe(expSha1);
        expect(sha256Chunked.hex()).toBe(expSha256);
        expect(sha512Chunked.hex()).toBe(expSha512);
      }
    });

    it('computeTextHashes returns all 4 hashes correctly', async () => {
      const text = 'DuyDev Studio Suite 2026 Test Text';
      const buf = Buffer.from(text, 'utf-8');

      const res = await computeTextHashes(text);
      expect(res.md5).toBe(crypto.createHash('md5').update(buf).digest('hex'));
      expect(res.sha1).toBe(crypto.createHash('sha1').update(buf).digest('hex'));
      expect(res.sha256).toBe(crypto.createHash('sha256').update(buf).digest('hex'));
      expect(res.sha512).toBe(crypto.createHash('sha512').update(buf).digest('hex'));
    });
  });

  describe('3. computeFileHashesStreaming Execution & Edge Cases', () => {
    it('handles empty 0-byte file bit-for-bit with standard digests', async () => {
      const emptyBlob = new Blob([]);
      const res = await computeFileHashesStreaming(emptyBlob);

      expect(res.md5).toBe('d41d8cd98f00b204e9800998ecf8427e');
      expect(res.sha1).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
      expect(res.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(res.sha512).toBe(
        'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
      );
    });

    it('streams binary file in slices matching node:crypto (< webCryptoThreshold path)', async () => {
      // Generate 12KB random binary data
      const randomBytes = crypto.randomBytes(12 * 1024);
      const blob = new Blob([randomBytes]);

      const progressTicks: number[] = [];
      const res = await computeFileHashesStreaming(blob, {
        chunkSize: 1024,
        webCryptoThreshold: 50 * 1024, // Blob is 12KB < 50KB -> triggers Web Crypto path
        onProgress: (pct) => progressTicks.push(pct)
      });

      expect(res.md5).toBe(crypto.createHash('md5').update(randomBytes).digest('hex'));
      expect(res.sha1).toBe(crypto.createHash('sha1').update(randomBytes).digest('hex'));
      expect(res.sha256).toBe(crypto.createHash('sha256').update(randomBytes).digest('hex'));
      expect(res.sha512).toBe(crypto.createHash('sha512').update(randomBytes).digest('hex'));

      expect(progressTicks.length).toBeGreaterThan(0);
      expect(progressTicks[progressTicks.length - 1]).toBe(100);
    });

    it('streams large binary file via pure-JS streaming path (>= webCryptoThreshold)', async () => {
      // Generate 16KB random data, set webCryptoThreshold to 4KB so it uses pure-JS streaming
      const randomBytes = crypto.randomBytes(16 * 1024);
      const blob = new Blob([randomBytes]);

      const progressTicks: number[] = [];
      const res = await computeFileHashesStreaming(blob, {
        chunkSize: 2048,
        webCryptoThreshold: 4096, // Blob is 16KB >= 4KB -> triggers pure-JS streaming path
        onProgress: (pct) => progressTicks.push(pct)
      });

      expect(res.md5).toBe(crypto.createHash('md5').update(randomBytes).digest('hex'));
      expect(res.sha1).toBe(crypto.createHash('sha1').update(randomBytes).digest('hex'));
      expect(res.sha256).toBe(crypto.createHash('sha256').update(randomBytes).digest('hex'));
      expect(res.sha512).toBe(crypto.createHash('sha512').update(randomBytes).digest('hex'));

      expect(progressTicks.length).toBeGreaterThan(0);
      expect(progressTicks[progressTicks.length - 1]).toBe(100);
    });

    it('aborts cleanly via AbortSignal before start and mid-stream', async () => {
      const data = crypto.randomBytes(32 * 1024);
      const blob = new Blob([data]);

      // Pre-aborted
      const preController = new AbortController();
      preController.abort();
      await expect(
        computeFileHashesStreaming(blob, { signal: preController.signal })
      ).rejects.toThrow(/abort/i);

      // Mid-stream abort in pure-JS streaming path
      const midController = new AbortController();
      let callCount = 0;
      await expect(
        computeFileHashesStreaming(blob, {
          chunkSize: 1024,
          webCryptoThreshold: 2048,
          signal: midController.signal,
          onProgress: () => {
            callCount++;
            if (callCount === 3) {
              midController.abort();
            }
          }
        })
      ).rejects.toThrow(/abort/i);
    });
  });
});
