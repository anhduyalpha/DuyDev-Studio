import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { ViewerService, resolveLibreOfficeBin } from '../../src/services/viewer.service.js';
import { resolvedStoragePaths } from '../../src/config/env.config.js';
import { NotFoundError, BadRequestError } from '../../src/lib/errors.js';
import { AuthService } from '../../src/services/auth.service.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Universal Viewer Pipeline & Service Tests', () => {
  let app: FastifyInstance;
  const testDir = path.join(resolvedStoragePaths.temp, 'test_viewer_suite');
  let validAdminToken: string;

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    app = await buildApp();
    validAdminToken = AuthService.generateSessionToken();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('resolveLibreOfficeBin', () => {
    it('should respect LIBREOFFICE_BIN when configured', () => {
      const prev = process.env.LIBREOFFICE_BIN;
      process.env.LIBREOFFICE_BIN = process.execPath; // node binary exists
      expect(resolveLibreOfficeBin()).toBe(process.execPath);
      if (prev !== undefined) {
        process.env.LIBREOFFICE_BIN = prev;
      } else {
        delete process.env.LIBREOFFICE_BIN;
      }
    });

    it('should return a fallback executable name', () => {
      const prev = process.env.LIBREOFFICE_BIN;
      delete process.env.LIBREOFFICE_BIN;
      const bin = resolveLibreOfficeBin();
      expect(['soffice', 'libreoffice', '/usr/bin/soffice', '/usr/bin/libreoffice']).toContain(
        path.basename(bin).replace(/\.exe$/i, '').toLowerCase()
      );
      if (prev !== undefined) process.env.LIBREOFFICE_BIN = prev;
    });
  });

  describe('ViewerService', () => {
    it('should throw NotFoundError if physical source file does not exist', async () => {
      const missing = path.join(testDir, 'non_existent_file.docx');
      await expect(ViewerService.getPreviewPdfPath(missing)).rejects.toThrow(NotFoundError);
    });

    it('should pass-through PDF files directly without conversion', async () => {
      const pdfPath = path.join(testDir, 'sample_doc.pdf');
      await fs.writeFile(pdfPath, '%PDF-1.4 mock content');
      const resolved = await ViewerService.getPreviewPdfPath(pdfPath);
      expect(resolved).toBe(pdfPath);
    });

    it('should return cached PDF when preview cache already exists', async () => {
      const docxPath = path.join(testDir, 'cached_doc.docx');
      await fs.writeFile(docxPath, 'PK mock docx binary data');

      const stat = await fs.stat(docxPath);
      const hash = crypto.createHash('sha256').update(`${docxPath}:${stat.mtimeMs}:${stat.size}`).digest('hex');
      const previewsDir = path.join(resolvedStoragePaths.temp, 'previews');
      await fs.mkdir(previewsDir, { recursive: true });
      const cachedPdf = path.join(previewsDir, `${hash}.pdf`);
      await fs.writeFile(cachedPdf, '%PDF-1.5 pre-rendered cached content');

      const resolved = await ViewerService.getPreviewPdfPath(docxPath);
      expect(resolved).toBe(cachedPdf);
      const content = await fs.readFile(resolved, 'utf-8');
      expect(content).toContain('pre-rendered cached content');
    });
  });

  describe('GET /api/v1/viewer/preview-pdf Endpoint', () => {
    it('should return 400 if neither fileId nor path is supplied', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/viewer/preview-pdf'
      });
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error.message).toContain('fileId hoặc path');
    });

    it('should return 401 if path is supplied without admin authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/viewer/preview-pdf?path=/Documents/report.docx'
      });
      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('should return 404 if path is supplied with auth but file is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?path=/Missing/report.docx&auth=${validAdminToken}`
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for unknown fileId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/viewer/preview-pdf?fileId=non_existent_file_id_999'
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 200 and stream PDF inline for valid PDF fileRecord', async () => {
      const pdfStoragePath = path.join(testDir, 'db_sample.pdf');
      await fs.writeFile(pdfStoragePath, '%PDF-1.4 test stream content');

      const fileRecord = await prisma.fileRecord.create({
        data: {
          id: `test_pdf_${Date.now()}`,
          originalName: 'test_stream.pdf',
          storagePath: pdfStoragePath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(26),
          hashSha256: 'mockhash123',
          purpose: 'test',
          expiresAt: new Date(Date.now() + 3600_000)
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${fileRecord.id}`
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe('inline; filename="preview.pdf"');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-length']).toBe('28');
      expect(res.body).toContain('%PDF-1.4 test stream content');

      // Test HTTP 206 Range Request
      const rangeRes = await app.inject({
        method: 'GET',
        url: `/api/v1/viewer/preview-pdf?fileId=${fileRecord.id}`,
        headers: {
          range: 'bytes=0-8'
        }
      });
      expect(rangeRes.statusCode).toBe(206);
      expect(rangeRes.headers['content-range']).toBe('bytes 0-8/28');
      expect(rangeRes.headers['content-length']).toBe('9');
      expect(rangeRes.body).toBe('%PDF-1.4 ');

      // Cleanup db
      await prisma.fileRecord.delete({ where: { id: fileRecord.id } });
    });
  });
});
