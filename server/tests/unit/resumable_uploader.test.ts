import { describe, it, expect } from 'vitest';
import {
  getOptimalChunkSize,
  isWanConnection,
  formatBytes,
  formatSpeed,
  formatEta,
  ResumableUploader
} from '../../../src/utilities/resumableUploader.js';

describe('Resumable Uploader Engine Suite', () => {
  describe('Adaptive Chunk Sizing (getOptimalChunkSize)', () => {
    it('provides minimum 16MB chunk for small files to avoid TCP slow-start', () => {
      const size10MB = 10 * 1024 * 1024;
      const chunk = getOptimalChunkSize(size10MB, false);
      expect(chunk).toBe(16 * 1024 * 1024);
    });

    it('allocates 16MB chunk for 100MB file', () => {
      const size100MB = 100 * 1024 * 1024;
      const chunk = getOptimalChunkSize(size100MB, true);
      expect(chunk).toBe(16 * 1024 * 1024);
      const totalChunks = Math.ceil(size100MB / chunk);
      expect(totalChunks).toBe(7); // only 7 roundtrips!
    });

    it('allocates optimal ~32MB chunk for 953.8MB archive (e.g. hello.zip) instead of 4MB', () => {
      const sizeHelloZip = Math.floor(953.8 * 1024 * 1024);
      const wanChunk = getOptimalChunkSize(sizeHelloZip, true);
      const lanChunk = getOptimalChunkSize(sizeHelloZip, false);

      // Both WAN and LAN must use high-throughput chunks (>= 30MB)
      expect(wanChunk).toBeGreaterThanOrEqual(30 * 1024 * 1024);
      expect(wanChunk).toBeLessThanOrEqual(48 * 1024 * 1024);
      expect(lanChunk).toBeGreaterThanOrEqual(30 * 1024 * 1024);

      // Ensure total chunks is between 20 and 35, NEVER 239!
      const totalChunks = Math.ceil(sizeHelloZip / wanChunk);
      expect(totalChunks).toBeLessThanOrEqual(35);
      expect(totalChunks).toBeGreaterThanOrEqual(20);
    });

    it('clamps chunk size to max 48MB for multi-gigabyte files (well under Cloudflare 100MB limit)', () => {
      const size10GB = 10 * 1024 * 1024 * 1024;
      const chunk = getOptimalChunkSize(size10GB, true);
      expect(chunk).toBe(48 * 1024 * 1024);
    });

    it('returns valid minimum chunk for 0 or negative fileSize', () => {
      expect(getOptimalChunkSize(0)).toBe(16 * 1024 * 1024);
      expect(getOptimalChunkSize(-100)).toBe(16 * 1024 * 1024);
    });
  });

  describe('Accurate Byte Tracking & Math', () => {
    it('calculates exact chunk byte lengths including smaller trailing chunk', () => {
      const fakeFile = { name: 'test.bin', size: 70 * 1024 * 1024, lastModified: Date.now() };
      const uploader = new ResumableUploader(fakeFile, { chunkSize: 32 * 1024 * 1024 });

      expect(uploader.totalChunks).toBe(3);
      expect(uploader._getChunkByteLength(0)).toBe(32 * 1024 * 1024);
      expect(uploader._getChunkByteLength(1)).toBe(32 * 1024 * 1024);
      expect(uploader._getChunkByteLength(2)).toBe(6 * 1024 * 1024); // trailing chunk!
    });

    it('calculates completed bytes accurately even when chunks finish out of order', () => {
      const fakeFile = { name: 'test.bin', size: 70 * 1024 * 1024, lastModified: Date.now() };
      const uploader = new ResumableUploader(fakeFile, { chunkSize: 32 * 1024 * 1024 });

      // Chunk 2 (the 6MB trailing chunk) finishes first
      uploader.uploadedChunks.add(2);
      expect(uploader._getCompletedBytes()).toBe(6 * 1024 * 1024);

      // Chunk 0 (32MB) finishes next
      uploader.uploadedChunks.add(0);
      expect(uploader._getCompletedBytes()).toBe(38 * 1024 * 1024);

      // With 5MB in flight on chunk 1
      uploader.activeBytes.set(1, 5 * 1024 * 1024);
      expect(uploader._getCurrentTotalSent()).toBe(43 * 1024 * 1024);

      // Chunk 1 completes
      uploader.uploadedChunks.add(1);
      uploader.activeBytes.delete(1);
      expect(uploader._getCurrentTotalSent()).toBe(70 * 1024 * 1024);
    });

    it('caps total sent to file.size to prevent overflow in telemetry', () => {
      const fakeFile = { name: 'test.bin', size: 1000, lastModified: Date.now() };
      const uploader = new ResumableUploader(fakeFile, { chunkSize: 500 });
      uploader.uploadedChunks.add(0);
      uploader.uploadedChunks.add(1);
      uploader.activeBytes.set(0, 200); // dangling simulated in-flight

      expect(uploader._getCurrentTotalSent()).toBe(1000);
    });
  });

  describe('Telemetry Formatting Helpers', () => {
    it('formats bytes accurately', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(953.8 * 1024 * 1024)).toBe('953.8 MB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
    });

    it('formats speed cleanly', () => {
      expect(formatSpeed(0)).toBe('0 KB/s');
      expect(formatSpeed(500)).toBe('0 KB/s');
      expect(formatSpeed(466.7 * 1024)).toBe('466.7 KB/s');
      expect(formatSpeed(12.5 * 1024 * 1024)).toBe('12.5 MB/s');
    });

    it('formats ETA properly', () => {
      expect(formatEta(0)).toBe('--');
      expect(formatEta(-5)).toBe('--');
      expect(formatEta(45)).toBe('~45s');
      expect(formatEta(125)).toBe('2:05');
      expect(formatEta(3600)).toBe('60:00');
    });
  });
});
