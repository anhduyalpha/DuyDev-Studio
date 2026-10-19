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
// @ts-ignore
import { extractFileName, extractFileExtension, detectFileCategory, FILE_CATEGORIES, detectCategoryFromMagicBytes, resolveViewerUrls, ViewerConnector } from '../../../src/components/common/viewer/FileViewerConnector.js';
// @ts-ignore
import { clampCanvasDimensions } from '../../../src/components/common/viewer/renderers/pdf/PdfCanvasViewer.js';

describe('Universal File Viewer Subsystem Hardening Tests', () => {
  let app: FastifyInstance;
  const createdFileIds: string[] = [];
  const testFilesToCleanup: string[] = [];
  let testFileId: string;
  let testFileHash: string;
  let testPdfId: string;
  const testContent = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // 62 bytes
  const pdfContent = '%PDF-1.4 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // 71 bytes
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

    // Create a known PDF file for viewer.controller preview-pdf testing
    testPdfId = `fil_test_pdf_${Date.now().toString(36)}`;
    const pdfPath = StorageManager.getUploadPath(testPdfId, '.pdf');
    await fs.promises.writeFile(pdfPath, pdfContent, 'utf-8');
    testFilesToCleanup.push(pdfPath);

    await prisma.fileRecord.create({
      data: {
        id: testPdfId,
        purpose: 'UPLOAD',
        originalName: 'viewer_hardening_specimen.pdf',
        storagePath: pdfPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(pdfContent.length),
        hashSha256: await StorageManager.computeSha256(pdfPath),
        isPurged: false,
        expiresAt: new Date(Date.now() + 86400000)
      }
    });
    createdFileIds.push(testPdfId);
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

  describe('4. Viewer Controller PDF Preview Range & Header Hardening', () => {
    it('should stream partial range on preview-pdf with HTTP 206', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${testPdfId}`,
        headers: { range: 'bytes=0-8' }
      });

      expect(res.statusCode).toBe(206);
      expect(res.headers['content-range']).toBe(`bytes 0-8/${pdfContent.length}`);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.payload).toBe('%PDF-1.4 ');
    });

    it('should support suffix range on preview-pdf (bytes=-15)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${testPdfId}`,
        headers: { range: 'bytes=-15' }
      });

      expect(res.statusCode).toBe(206);
      const expectedStart = pdfContent.length - 15;
      const expectedEnd = pdfContent.length - 1;
      expect(res.headers['content-range']).toBe(`bytes ${expectedStart}-${expectedEnd}/${pdfContent.length}`);
      expect(res.payload).toBe(pdfContent.slice(-15));
    });

    it('should return HTTP 416 for out-of-bounds preview-pdf range', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${testPdfId}`,
        headers: { range: 'bytes=5000-6000' }
      });

      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe(`bytes */${pdfContent.length}`);
    });

    it('should return HTTP 304 when If-None-Match matches on preview-pdf', async () => {
      const initial = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${testPdfId}`
      });
      expect(initial.statusCode).toBe(200);
      const etag = initial.headers.etag as string;
      expect(etag).toBeTruthy();

      const cached = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${testPdfId}`,
        headers: { 'if-none-match': etag }
      });
      expect(cached.statusCode).toBe(304);
      expect(cached.payload).toBe('');
    });
  });

  describe('5. Frontend File Type Detection & URL Normalization Hardening', () => {
    it('should extract filename from query parameter path when wrapped in download URL', () => {
      const url = '/api/v1/storage/download?path=finance/q3_report.DOCX';
      const name = extractFileName({}, url);
      expect(name).toBe('q3_report.DOCX');
    });

    it('should fallback to URL parameter path when item.fileName is generic "download" or "view"', () => {
      const url = '/api/v1/storage/download?path=%C4%90%E1%BB%81%20thi%20To%C3%A1n.pdf';
      const name = extractFileName({ fileName: 'download' }, url);
      expect(name).toBe('Đề thi Toán.pdf');
    });

    it('should extract extension from query parameter path even when filename is empty', () => {
      const ext = extractFileExtension('', '', '/api/v1/storage/download?path=archive.tar.gz');
      expect(ext).toBe('gz');
    });

    it('should normalize uppercase extensions to lowercase', () => {
      expect(extractFileExtension('REPORT.PDF')).toBe('pdf');
      expect(extractFileExtension('SPREADSHEET.XLSX')).toBe('xlsx');
      expect(extractFileExtension('CLIP.MKV')).toBe('mkv');
    });

    it('should route .iso and .bin files to FALLBACK category for instant 64KB Hex inspection', () => {
      expect(detectFileCategory('ubuntu-22.04.iso')).toBe(FILE_CATEGORIES.FALLBACK);
      expect(detectFileCategory('firmware.bin')).toBe(FILE_CATEGORIES.FALLBACK);
      expect(detectFileCategory('memory.dat')).toBe(FILE_CATEGORIES.FALLBACK);
    });

    it('should route media formats with mixed case or MIME type correctly', () => {
      expect(detectFileCategory('video.MKV')).toBe(FILE_CATEGORIES.VIDEO);
      expect(detectFileCategory('image.WEBP')).toBe(FILE_CATEGORIES.IMAGE);
      expect(detectFileCategory('data.CSV')).toBe(FILE_CATEGORIES.SHEET);
      expect(detectFileCategory('notes.MD')).toBe(FILE_CATEGORIES.TEXT);
      expect(detectFileCategory('archive.7Z')).toBe(FILE_CATEGORIES.ARCHIVE);
    });
  });

  describe('6. Magic Bytes Category Detection Hardening', () => {
    it('should detect PDF from %PDF signature (0x25, 0x50, 0x44, 0x46)', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
      expect(detectCategoryFromMagicBytes(bytes)).toBe(FILE_CATEGORIES.PDF);
    });

    it('should detect PNG from \x89PNG signature (0x89, 0x50, 0x4E, 0x47)', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(detectCategoryFromMagicBytes(bytes)).toBe(FILE_CATEGORIES.IMAGE);
    });

    it('should detect JPEG from \xFF\xD8\xFF signature', () => {
      const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(detectCategoryFromMagicBytes(bytes)).toBe(FILE_CATEGORIES.IMAGE);
    });

    it('should detect GIF from GIF87a/GIF89a signature', () => {
      const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(detectCategoryFromMagicBytes(bytes)).toBe(FILE_CATEGORIES.IMAGE);
    });

    it('should detect WEBP from RIFF....WEBP signature', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50  // WEBP
      ]);
      expect(detectCategoryFromMagicBytes(bytes)).toBe(FILE_CATEGORIES.IMAGE);
    });

    it('should differentiate OpenXML Word vs Sheet vs Presentation vs generic Zip', () => {
      // DOCX: PK\x03\x04 + word/
      const docxHeader = Buffer.concat([
        Buffer.from([0x50, 0x4B, 0x03, 0x04]),
        Buffer.from('....word/document.xml....')
      ]);
      expect(detectCategoryFromMagicBytes(new Uint8Array(docxHeader))).toBe(FILE_CATEGORIES.WORD);

      // XLSX: PK\x03\x04 + xl/
      const xlsxHeader = Buffer.concat([
        Buffer.from([0x50, 0x4B, 0x03, 0x04]),
        Buffer.from('....xl/workbook.xml....')
      ]);
      expect(detectCategoryFromMagicBytes(new Uint8Array(xlsxHeader))).toBe(FILE_CATEGORIES.SHEET);

      // PPTX: PK\x03\x04 + ppt/
      const pptxHeader = Buffer.concat([
        Buffer.from([0x50, 0x4B, 0x03, 0x04]),
        Buffer.from('....ppt/presentation.xml....')
      ]);
      expect(detectCategoryFromMagicBytes(new Uint8Array(pptxHeader))).toBe(FILE_CATEGORIES.PDF);

      // Generic ZIP: PK\x03\x04 without office paths
      const zipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      expect(detectCategoryFromMagicBytes(new Uint8Array(zipHeader))).toBe(FILE_CATEGORIES.ARCHIVE);
    });

    it('should detect Audio formats: MP3 ID3 and MPEG audio sync frame', () => {
      // ID3 tag
      const id3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
      expect(detectCategoryFromMagicBytes(id3Bytes)).toBe(FILE_CATEGORIES.AUDIO);

      // MPEG sync frame: 0xFF, 0xFB
      const mpegBytes = new Uint8Array([0xFF, 0xFB, 0x90, 0x44]);
      expect(detectCategoryFromMagicBytes(mpegBytes)).toBe(FILE_CATEGORIES.AUDIO);
    });

    it('should detect Video formats: MP4/MOV (ftyp) and WebM/MKV', () => {
      // MP4: 4 bytes skip, then 'ftyp'
      const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]);
      expect(detectCategoryFromMagicBytes(mp4Bytes)).toBe(FILE_CATEGORIES.VIDEO);

      // WebM: 0x1A, 0x45, 0xDF, 0xA3
      const webmBytes = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 0x93, 0x42, 0x82, 0x88]);
      expect(detectCategoryFromMagicBytes(webmBytes)).toBe(FILE_CATEGORIES.VIDEO);
    });

    it('should detect RAR and 7-Zip archives', () => {
      // RAR: Rar! (0x52, 0x61, 0x72, 0x21)
      const rarBytes = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]);
      expect(detectCategoryFromMagicBytes(rarBytes)).toBe(FILE_CATEGORIES.ARCHIVE);

      // 7Z: 7z (0x37, 0x7A, 0xBC, 0xAF)
      const sevenZBytes = new Uint8Array([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]);
      expect(detectCategoryFromMagicBytes(sevenZBytes)).toBe(FILE_CATEGORIES.ARCHIVE);
    });

    it('should return null for short or unrecognized byte headers', () => {
      expect(detectCategoryFromMagicBytes(null)).toBeNull();
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x00, 0x01]))).toBeNull();
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x7F, 0x45, 0x4C, 0x46]))).toBeNull(); // ELF
    });
  });

  describe('7. PDF Canvas Sizing & Area Clamping (Android WebView OOM Prevention)', () => {
    it('should preserve standard dimensions when viewport area and dims are within limits', () => {
      const res = clampCanvasDimensions(800, 1100, 2);
      expect(res.width).toBe(1600);
      expect(res.height).toBe(2200);
      expect(res.width * res.height).toBeLessThanOrEqual(16777216);
      expect(res.width).toBeLessThanOrEqual(4096);
      expect(res.height).toBeLessThanOrEqual(4096);
    });

    it('should clamp single dimension if viewport exceeds maxDim (4096px)', () => {
      const res = clampCanvasDimensions(6000, 8000, 1);
      expect(res.width).toBeLessThanOrEqual(4096);
      expect(res.height).toBeLessThanOrEqual(4096);
      expect(res.width * res.height).toBeLessThanOrEqual(16777216);
    });

    it('should clamp high-DPI area scaling so width * height <= 16,777,216 px', () => {
      const res = clampCanvasDimensions(3500, 5000, 1.5);
      expect(res.width).toBeLessThanOrEqual(4096);
      expect(res.height).toBeLessThanOrEqual(4096);
      expect(res.width * res.height).toBeLessThanOrEqual(16777216);
      expect(res.dpr).toBeGreaterThanOrEqual(0.5);
    });

    it('should never collapse dimensions to 0 even on extreme inputs', () => {
      const res = clampCanvasDimensions(20000, 30000, 2);
      expect(res.width).toBeGreaterThan(0);
      expect(res.height).toBeGreaterThan(0);
      expect(res.width).toBeLessThanOrEqual(4096);
      expect(res.height).toBeLessThanOrEqual(4096);
      expect(res.width * res.height).toBeLessThanOrEqual(16777216);
    });
  });

  describe('8. Universal Viewer Connector Caller Contracts & Aliases', () => {
    it('should export all essential alias methods on ViewerConnector', () => {
      expect(typeof ViewerConnector.preview).toBe('function');
      expect(typeof ViewerConnector.open).toBe('function');
      expect(typeof ViewerConnector.openViewer).toBe('function');
      expect(typeof ViewerConnector.previewBlob).toBe('function');
      expect(typeof ViewerConnector.viewerFetch).toBe('function');
    });

    it('should rewrite Scribd download URLs to stream URLs to prevent attachment triggers', () => {
      const res = resolveViewerUrls({ viewUrl: '/api/v1/scribd/download/my_lecture_notes.pdf' });
      expect(res.viewUrl).toBe('/api/v1/scribd/stream?file=my_lecture_notes.pdf');
      expect(res.downloadUrl).toBe('/api/v1/scribd/download/my_lecture_notes.pdf');
    });

    it('should attach auth and device tokens to file view/download URLs for native HTML5 media', () => {
      // Simulate auth token in localStorage
      const originalLocal = global.localStorage;
      // @ts-ignore
      global.localStorage = {
        getItem: (key: string) => {
          if (key === 'ds_admin_token') return 'test_admin_jwt';
          if (key === 'ds_device_id') return 'device_12345';
          return null;
        }
      };

      try {
        const res = resolveViewerUrls({ fileId: 'fil_test_video_001' });
        expect(res.viewUrl).toContain('/api/v1/files/view/fil_test_video_001');
        expect(res.viewUrl).toContain('auth=test_admin_jwt');
        expect(res.viewUrl).toContain('deviceId=device_12345');
        expect(res.downloadUrl).toContain('/api/v1/files/download/fil_test_video_001');
        expect(res.downloadUrl).toContain('auth=test_admin_jwt');
        expect(res.downloadUrl).toContain('deviceId=device_12345');
      } finally {
        global.localStorage = originalLocal;
      }
    });

    it('should ensure clampCanvasDimensions sets dpr matching targetWidth / viewportWidth', () => {
      const res = clampCanvasDimensions(1000, 1500, 2);
      expect(res.width).toBe(2000);
      expect(res.height).toBe(3000);
      expect(res.dpr).toBe(2);
    });

    it('should accurately detect file category from magic byte signatures', () => {
      // PDF
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(FILE_CATEGORIES.PDF);
      // PNG
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toBe(FILE_CATEGORIES.IMAGE);
      // JPEG
      expect(detectCategoryFromMagicBytes(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]))).toBe(FILE_CATEGORIES.IMAGE);
      // GIF
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe(FILE_CATEGORIES.IMAGE);
      // MP4
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe(FILE_CATEGORIES.VIDEO);
      // WebM
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x1A, 0x45, 0xDF, 0xA3]))).toBe(FILE_CATEGORIES.VIDEO);
      // MP3 ID3
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x49, 0x44, 0x33, 0x03]))).toBe(FILE_CATEGORIES.AUDIO);
      // RAR
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x52, 0x61, 0x72, 0x21]))).toBe(FILE_CATEGORIES.ARCHIVE);
      // 7Z
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x37, 0x7A, 0xBC, 0xAF]))).toBe(FILE_CATEGORIES.ARCHIVE);
      // Fallback on unknown
      expect(detectCategoryFromMagicBytes(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
    });
  });

  describe('9. Service Worker & Static Delivery Protocol Hardening', () => {
    const rootDir = path.resolve(__dirname, '../../../');
    const swPath = path.join(rootDir, 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');

    it('sw.js must be bumped to duydev-studio-v23.x', () => {
      expect(swContent).toMatch(/const CACHE_NAME = 'duydev-studio-v23\.\d+';/);
    });

    it('sw.js must explicitly bypass ranges, blob, api, download, viewer, and stream requests', () => {
      expect(swContent).toContain("url.protocol === 'blob:'");
      expect(swContent).toContain("url.pathname.startsWith('/api/')");
      expect(swContent).toContain("url.pathname.startsWith('/downloads/')");
      expect(swContent).toContain("url.pathname.includes('/download')");
      expect(swContent).toContain("url.pathname.includes('/viewer')");
      expect(swContent).toContain("url.pathname.includes('/stream')");
      expect(swContent).toContain("url.searchParams.has('inline')");
      expect(swContent).toContain("event.request.headers.has('range')");
    });

    it('server static files delivery must serve .mjs/.js with Content-Type: text/javascript; charset=utf-8', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/src/utilities/formatters.js'
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/javascript');
      expect(res.headers['content-type']).toContain('charset=utf-8');
    });
  });
});

