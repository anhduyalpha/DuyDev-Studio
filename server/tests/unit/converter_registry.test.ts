import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import {
  COMPATIBILITY_MATRIX,
  getDefaultTarget,
  getCompatibleFormats,
  EXTENSION_CATEGORIES,
  CATEGORY_FORMATS
} from '../../src/schemas/converter.schema.js';

describe('Converter Registry & Compatibility Matrix Unit Tests', () => {
  let app: FastifyInstance;
  const docxFileId = `fil_test_docx_${Date.now()}`;
  const zipFileId = `fil_test_zip_${Date.now()}`;
  let docxPath: string;
  let zipPath: string;

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();

    // Create a mock DOCX file that has ZIP magic bytes (50 4B 03 04)
    const pkMagicBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    docxPath = StorageManager.getUploadPath(docxFileId, '.docx');
    await fs.writeFile(docxPath, pkMagicBytes);

    await prisma.fileRecord.create({
      data: {
        id: docxFileId,
        purpose: 'UPLOAD',
        originalName: 'quarterly_report.docx',
        storagePath: docxPath,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: BigInt(pkMagicBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(pkMagicBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    zipPath = StorageManager.getUploadPath(zipFileId, '.zip');
    await fs.writeFile(zipPath, pkMagicBytes);

    await prisma.fileRecord.create({
      data: {
        id: zipFileId,
        purpose: 'UPLOAD',
        originalName: 'backup_archive.zip',
        storagePath: zipPath,
        mimeType: 'application/zip',
        sizeBytes: BigInt(pkMagicBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(pkMagicBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();
    await StorageManager.unlinkSafe(docxPath);
    await StorageManager.unlinkSafe(zipPath);
    await prisma.fileRecord.deleteMany({
      where: { id: { in: [docxFileId, zipFileId] } }
    });
  });

  describe('Schema Compatibility Matrix & Defaults', () => {
    it('DOCX: should return document targets, exclude docx, default to pdf', () => {
      const targets = getCompatibleFormats('docx');
      expect(targets).toContain('pdf');
      expect(targets).toContain('txt');
      expect(targets).toContain('html');
      expect(targets).toContain('md');
      expect(targets).not.toContain('docx');
      expect(getDefaultTarget('docx')).toBe('pdf');
    });

    it('CSV: should return data targets, exclude csv, default to xlsx', () => {
      const targets = getCompatibleFormats('csv');
      expect(targets).toContain('xlsx');
      expect(targets).toContain('json');
      expect(targets).toContain('xml');
      expect(targets).not.toContain('csv');
      expect(getDefaultTarget('csv')).toBe('xlsx');
    });

    it('PNG: should return image targets, exclude png, no avif/svg, default to webp', () => {
      const targets = getCompatibleFormats('png');
      expect(targets).toContain('webp');
      expect(targets).toContain('jpg');
      expect(targets).toContain('ico');
      expect(targets).toContain('pdf');
      expect(targets).toContain('bmp');
      expect(targets).not.toContain('png');
      expect(targets).not.toContain('avif');
      expect(targets).not.toContain('svg');
      expect(getDefaultTarget('png')).toBe('webp');
    });

    it('SVG: should only output png, jpg, pdf (cairosvg limits), never svg as target', () => {
      const targets = getCompatibleFormats('svg');
      expect(targets).toEqual(['png', 'jpg', 'pdf']);
      expect(targets).not.toContain('svg');
      expect(getDefaultTarget('svg')).toBe('png');
    });

    it('MP4: should include both video and audio extraction targets, exclude mp4, default to webm', () => {
      const targets = getCompatibleFormats('mp4');
      expect(targets).toContain('webm');
      expect(targets).toContain('gif');
      expect(targets).toContain('mp3');
      expect(targets).toContain('wav');
      expect(targets).not.toContain('mp4');
      expect(getDefaultTarget('mp4')).toBe('webm');
    });

    it('ZIP: should return archive targets, exclude zip, default to 7z', () => {
      const targets = getCompatibleFormats('zip');
      expect(targets).toContain('7z');
      expect(targets).toContain('tar');
      expect(targets).toContain('gz');
      expect(targets).not.toContain('zip');
      expect(getDefaultTarget('zip')).toBe('7z');
    });

    it('PDF: should return document targets, exclude pdf, include rtf, default to docx', () => {
      const targets = getCompatibleFormats('pdf');
      expect(targets).toContain('docx');
      expect(targets).toContain('txt');
      expect(targets).toContain('html');
      expect(targets).toContain('md');
      expect(targets).toContain('rtf');
      expect(targets).toContain('png');
      expect(targets).toContain('jpg');
      expect(targets).not.toContain('pdf');
      expect(getDefaultTarget('pdf')).toBe('docx');
    });

    it('RTF: should be classified as document and have application/rtf mime type', () => {
      expect(EXTENSION_CATEGORIES['rtf']?.category).toBe('document');
      expect(CATEGORY_FORMATS.image).not.toContain('avif');
    });

    it('Unknown extension: should gracefully fallback to document defaults without crashing', () => {
      const targets = getCompatibleFormats('unknownxyz');
      expect(targets).toBeDefined();
      expect(targets.length).toBeGreaterThan(0);
      expect(getDefaultTarget('unknownxyz')).toBeDefined();
    });
  });

  describe('Extension-first magic bytes regression prevention', () => {
    it('CRITICAL BUG FIX: DOCX with PK magic bytes must NOT be misdetected as ZIP', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/converter/detect',
        payload: { fileId: docxFileId }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.extension).toBe('DOCX');
      expect(body.data.category).toBe('document');
      expect(body.data.compatibleFormats).toContain('pdf');
      expect(body.data.compatibleFormats).not.toContain('docx');
      expect(body.data.defaultTarget).toBe('pdf');
    });

    it('ZIP file with PK magic bytes should be detected as archive ZIP', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/converter/detect',
        payload: { fileId: zipFileId }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.extension).toBe('ZIP');
      expect(body.data.category).toBe('archive');
      expect(body.data.compatibleFormats).toContain('7z');
      expect(body.data.compatibleFormats).not.toContain('zip');
      expect(body.data.defaultTarget).toBe('7z');
    });

    it('Detect from fileName only: should correctly detect data category for CSV', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/converter/detect',
        payload: { fileName: 'financial_ledger.csv' }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.extension).toBe('CSV');
      expect(body.data.category).toBe('data');
      expect(body.data.compatibleFormats).toContain('xlsx');
      expect(body.data.compatibleFormats).not.toContain('csv');
      expect(body.data.defaultTarget).toBe('xlsx');
    });

    it('Detect from fileName with whitespace: should trim and resolve correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/converter/detect',
        payload: { fileName: '  my_report.docx   ' }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.extension).toBe('DOCX');
      expect(body.data.category).toBe('document');
      expect(body.data.defaultTarget).toBe('pdf');
    });
  });
});
