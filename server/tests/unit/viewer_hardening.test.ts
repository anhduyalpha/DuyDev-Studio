import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { getMimeTypeForExt } from '../../src/schemas/converter.schema.js';
import { AuthService } from '../../src/services/auth.service.js';

describe('Universal File Viewer Subsystem Hardening Tests', () => {
  let app: FastifyInstance;
  const createdFileIds: string[] = [];
  const testFilesToCleanup: string[] = [];
  let testFileId: string;
  let testFileHash: string;
  const testContent = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // 62 bytes
  const adminToken = AuthService.generateSessionToken();

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();

    // Create a known file in database and disk for files.controller testing
    testFileId = `fil_test_vh_${Date.now().toString(36)}`;
    const storagePath = StorageManager.getUploadPath(testFileId, '.txt');
    await fs.promises.writeFile(storagePath, testContent, 'utf-8');
    testFilesToCleanup.push(storagePath);

    testFileHash = await StorageManager.computeSha256(storagePath);
    await prisma.fileRecord.create({
      data: {
        id: testFileId,
        purpose: 'UPLOAD',
        originalName: 'viewer_hardening_specimen.txt',
        storagePath,
        mimeType: 'text/plain; charset=utf-8',
        sizeBytes: BigInt(testContent.length),
        hashSha256: testFileHash,
        isPurged: false,
        expiresAt: new Date(Date.now() + 86400000)
      }
    });
    createdFileIds.push(testFileId);
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();

    for (const f of testFilesToCleanup) {
      await StorageManager.unlinkSafe(f);
    }
    if (createdFileIds.length > 0) {
      await prisma.fileRecord.deleteMany({
        where: { id: { in: createdFileIds } }
      });
    }
  });

  describe('1. MIME Type Detection & Schema Mapping', () => {
    it('should accurately resolve fonts MIME types', () => {
      expect(getMimeTypeForExt('woff')).toBe('font/woff');
      expect(getMimeTypeForExt('woff2')).toBe('font/woff2');
      expect(getMimeTypeForExt('ttf')).toBe('font/ttf');
      expect(getMimeTypeForExt('otf')).toBe('font/otf');
      expect(getMimeTypeForExt('eot')).toBe('application/vnd.ms-fontobject');
    });

    it('should accurately resolve programming languages and markup', () => {
      expect(getMimeTypeForExt('vue')).toContain('text/plain');
      expect(getMimeTypeForExt('svelte')).toContain('text/plain');
      expect(getMimeTypeForExt('rs')).toContain('text/plain');
      expect(getMimeTypeForExt('go')).toContain('text/plain');
      expect(getMimeTypeForExt('py')).toContain('text/plain');
      expect(getMimeTypeForExt('ts')).toContain('text/plain');
      expect(getMimeTypeForExt('json5')).toContain('application/json');
      expect(getMimeTypeForExt('toml')).toContain('text/plain');
      expect(getMimeTypeForExt('dockerfile')).toContain('text/plain');
    });

    it('should accurately resolve spreadsheets, presentations and data formats', () => {
      expect(getMimeTypeForExt('tsv')).toContain('text/tab-separated-values');
      expect(getMimeTypeForExt('csv')).toContain('text/csv');
      expect(getMimeTypeForExt('ods')).toBe('application/vnd.oasis.opendocument.spreadsheet');
      expect(getMimeTypeForExt('odp')).toBe('application/vnd.oasis.opendocument.presentation');
      expect(getMimeTypeForExt('odt')).toBe('application/vnd.oasis.opendocument.text');
    });

    it('should accurately resolve web assets and subtitles', () => {
      expect(getMimeTypeForExt('wasm')).toBe('application/wasm');
      expect(getMimeTypeForExt('vtt')).toContain('text/vtt');
      expect(getMimeTypeForExt('srt')).toContain('text/plain');
      expect(getMimeTypeForExt('unknown_xyz')).toBe('application/octet-stream');
    });
  });

  describe('2. Files Controller Range Request & Security Hardening', () => {
    it('should stream regular partial byte ranges with HTTP 206', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { range: 'bytes=0-9' }
      });

      expect(res.statusCode).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 0-9/${testContent.length}`);
      expect(res.headers['content-length']).toBe('10');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.payload).toBe('0123456789');
    });

    it('should stream single-byte range correctly', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { range: 'bytes=0-0' }
      });

      expect(res.statusCode).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 0-0/${testContent.length}`);
      expect(res.headers['content-length']).toBe('1');
      expect(res.payload).toBe('0');
    });

    it('should support suffix byte ranges (bytes=-N)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { range: 'bytes=-10' }
      });

      expect(res.statusCode).toBe(206);
      const expectedStart = testContent.length - 10;
      const expectedEnd = testContent.length - 1;
      expect(res.headers['content-range']).toBe(`bytes ${expectedStart}-${expectedEnd}/${testContent.length}`);
      expect(res.headers['content-length']).toBe('10');
      expect(res.payload).toBe(testContent.slice(-10));
    });

    it('should reject out-of-bounds range with HTTP 416', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { range: 'bytes=5000-6000' }
      });

      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe(`bytes */${testContent.length}`);
    });

    it('should reject end < start with HTTP 416', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { range: 'bytes=30-10' }
      });

      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe(`bytes */${testContent.length}`);
    });

    it('should return HTTP 304 when If-None-Match matches ETag', async () => {
      const etag = `"${testFileHash}"`;
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { 'if-none-match': etag }
      });

      expect(res.statusCode).toBe(304);
      expect(res.payload).toBe('');
    });

    it('should support RFC 7232 weak ETags (W/) and wildcard (*) in If-None-Match', async () => {
      // Weak tag format
      const weakRes = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { 'if-none-match': `W/"${testFileHash}"` }
      });
      expect(weakRes.statusCode).toBe(304);

      // Wildcard format
      const wildRes = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { 'if-none-match': '*' }
      });
      expect(wildRes.statusCode).toBe(304);

      // Comma-separated list with match
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: { 'if-none-match': `"stale_etag_1", "${testFileHash}", "stale_etag_2"` }
      });
      expect(listRes.statusCode).toBe(304);
    });

    it('should strictly set Content-Disposition: inline without filename to prevent download manager hijacking per KI-FIX-005', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-disposition']).toBe('inline');
      expect(res.headers['content-disposition']).not.toContain('filename=');
    });

    it('should honor If-Range: fallback to 200 OK when ETag does not match', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: {
          range: 'bytes=0-10',
          'if-range': '"unmatched_etag_value"'
        }
      });

      // Per RFC 7233, unmatched If-Range triggers full 200 OK response
      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe(testContent);
    });

    it('should honor If-Range: serve 206 Partial Content when ETag matches', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/files/view/${testFileId}`,
        headers: {
          range: 'bytes=0-9',
          'if-range': `"${testFileHash}"`
        }
      });

      expect(res.statusCode).toBe(206);
      expect(res.payload).toBe('0123456789');
    });
  });

  describe('3. Storage Controller Range & Header Hardening', () => {
    let driveDocPath: string;

    beforeAll(async () => {
      const driveRoot = StorageManager.getDrivePath('');
      const testDir = path.join(driveRoot, 'test_vh');
      await fs.mkdirSync(testDir, { recursive: true });
      driveDocPath = path.join(testDir, 'range_specimen.txt');
      await fs.promises.writeFile(driveDocPath, testContent, 'utf-8');
      testFilesToCleanup.push(driveDocPath);
    });

    it('should support suffix range on drive storage items', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/storage/download?path=/test_vh/range_specimen.txt&inline=true',
        headers: {
          authorization: `Bearer ${adminToken}`,
          range: 'bytes=-12'
        }
      });

      expect(res.statusCode).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 50-61/${testContent.length}`);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.payload).toBe(testContent.slice(-12));
    });

    it('should return HTTP 416 for unsatisfiable drive range', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/storage/download?path=/test_vh/range_specimen.txt',
        headers: {
          authorization: `Bearer ${adminToken}`,
          range: 'bytes=9999-10000'
        }
      });

      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe(`bytes */${testContent.length}`);
    });
  });
});
