import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function createZipBuffer(files: { name: string; content: string }[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.from(f.content, 'utf8');
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    localHeaders.push(lh, nameBuf, dataBuf);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    centralHeaders.push(cd, nameBuf);
    offset += 30 + nameBuf.length + size;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const b of centralHeaders) cdSize += b.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

describe('API Routes Integration Tests', () => {
  let app: FastifyInstance;
  const testFileIds: string[] = [];
  const testJobIds: string[] = [];
  let archiveFileId: string;
  let pdfFileId: string;

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();

    // Prepare an archive file record
    archiveFileId = `fil_arch_${Date.now()}`;
    testFileIds.push(archiveFileId);
    const zipBuf = createZipBuffer([
      { name: 'data.json', content: '{"status":"ok"}' },
      { name: 'readme.txt', content: 'Read this first' }
    ]);
    const archPath = StorageManager.getUploadPath(archiveFileId, '.zip');
    await fs.writeFile(archPath, zipBuf);

    await prisma.fileRecord.create({
      data: {
        id: archiveFileId,
        purpose: 'UPLOAD',
        originalName: 'test_bundle.zip',
        storagePath: archPath,
        mimeType: 'application/zip',
        sizeBytes: BigInt(zipBuf.length),
        hashSha256: crypto.createHash('sha256').update(zipBuf).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    // Prepare a dummy PDF file record
    pdfFileId = `fil_pdf_${Date.now()}`;
    testFileIds.push(pdfFileId);
    const dummyPdf = Buffer.from('%PDF-1.4 dummy pdf content');
    const dummyPdfPath = StorageManager.getUploadPath(pdfFileId, '.pdf');
    await fs.writeFile(dummyPdfPath, dummyPdf);

    await prisma.fileRecord.create({
      data: {
        id: pdfFileId,
        purpose: 'UPLOAD',
        originalName: 'report.pdf',
        storagePath: dummyPdfPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(dummyPdf.length),
        hashSha256: crypto.createHash('sha256').update(dummyPdf).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();

    for (const fileId of testFileIds) {
      const rec = await prisma.fileRecord.findUnique({ where: { id: fileId } });
      if (rec?.storagePath) {
        await StorageManager.unlinkSafe(rec.storagePath);
      }
    }
    await prisma.job.deleteMany({ where: { id: { in: testJobIds } } });
    await prisma.fileRecord.deleteMany({ where: { id: { in: testFileIds } } });
  });

  describe('Health Endpoints', () => {
    it('should return UP on /health and /api/v1/health', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/health' });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().status).toBe('UP');

      const res2 = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().status).toBe('UP');
      expect(res2.json().version).toBe('1.0.0');
    });
  });

  describe('QR Generation Endpoint', () => {
    it('should generate VietQR SVG QR code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/qr/generate',
        payload: {
          type: 'vietqr',
          payload: {
            bankBin: '970422',
            accountNumber: '0987654321',
            amount: 250000,
            purpose: 'Thanh toan tien hosting'
          },
          format: 'svg',
          margin: 2
        }
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.format).toBe('svg');
      expect(json.data.content).toContain('<svg');
      expect(json.data.dataUrl).toContain('data:image/svg+xml');
    });

    it('should generate Wi-Fi PNG QR code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/qr/generate',
        payload: {
          type: 'wifi',
          payload: {
            ssid: 'MyOfficeWifi',
            password: 'SuperPassword',
            security: 'WPA'
          },
          format: 'png'
        }
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.format).toBe('png');
      expect(json.data.dataUrl).toContain('data:image/png;base64,');
    });

    it('should reject invalid QR type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/qr/generate',
        payload: {
          type: 'invalid-type',
          payload: 'test'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Archive Inspection & Extraction Endpoints', () => {
    it('should inspect uploaded archive structure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/archive/inspect',
        payload: { fileId: archiveFileId }
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.archiveName).toBeDefined();
      expect(json.data.totalFiles).toBe(2);
      expect(json.data.tree.length).toBe(2);
    });

    it('should extract a single file from the archive', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/archive/extract-file?fileId=${archiveFileId}&memberPath=data.json`
      });

      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe('{"status":"ok"}');
      expect(response.headers['content-disposition']).toContain('data.json');
    });

    it('should reject Zip Slip attack with 403 SecurityException', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/archive/extract-file?fileId=${archiveFileId}&memberPath=../../etc/passwd`
      });

      expect(response.statusCode).toBe(403);
      const json = response.json();
      expect(json.error.code).toBe('SECURITY_EXCEPTION');
    });
  });

  describe('Jobs Lifecycle Endpoints', () => {
    let createdJobId: string;

    it('should enqueue a PDF job and return 202 Accepted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: pdfFileId,
          operation: 'compress',
          options: {
            compressionLevel: 'medium',
            stripMetadata: true
          }
        }
      });

      expect(response.statusCode).toBe(202);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      expect(json.data.status).toBe('QUEUED');
      expect(json.data.eventsUrl).toContain(json.data.jobId);
      expect(json.data.pollUrl).toContain(json.data.jobId);

      createdJobId = json.data.jobId;
      testJobIds.push(createdJobId);
    });

    it('should poll job status via GET /api/v1/jobs/:jobId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/jobs/${createdJobId}`
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBe(createdJobId);
      expect(json.data.status).toBeDefined();
    });

    it('should return 404 for non-existent job polling', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/non_existent_job_123'
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('Static Path Security Endpoints', () => {
    it('should strictly return 404 for sensitive server files and databases', async () => {
      const blockedPaths = [
        '/server/.env',
        '/server/prisma/dev.db',
        '/data/storage/temp.bin',
        '/engines/document/pdf_engine.py',
        '/certs/ssl.key',
        '/.git/config',
        '/app.env',
        '/.env.local',
        '/.env_production',
        '/secret.sqlite',
        '/test.sqlite3',
        '/data.db-wal',
        '/server%2f.env',
        '/%73erver/.env',
        '/src/../../server/.env',
        '/missing.js'
      ];

      for (const p of blockedPaths) {
        const res = await app.inject({ method: 'GET', url: p });
        expect(res.statusCode).toBe(404);
      }
    });

    it('should return 404 for non-GET requests to unhandled SPA routes', async () => {
      const res = await app.inject({ method: 'POST', url: '/random_nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    it('should allow legitimate frontend assets and SPA routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/index.html' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');

      const spaRes = await app.inject({ method: 'GET', url: '/converter' });
      expect(spaRes.statusCode).toBe(200);
      expect(spaRes.headers['content-type']).toContain('text/html');
    });
  });
});
