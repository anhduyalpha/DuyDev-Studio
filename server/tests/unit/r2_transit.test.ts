import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { R2Service } from '../../src/services/r2.service.js';
import { env } from '../../src/config/env.config.js';

describe('Cloudflare R2 Transit Pipe Architecture Suite', () => {
  let app: FastifyInstance;
  const createdFileIds: string[] = [];

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();

    // Clean up created file records and disk files
    for (const fileId of createdFileIds) {
      const record = await prisma.fileRecord.findUnique({ where: { id: fileId } });
      if (record?.storagePath) {
        await StorageManager.unlinkSafe(record.storagePath);
      }
    }
    if (createdFileIds.length > 0) {
      await prisma.fileRecord.deleteMany({
        where: { id: { in: createdFileIds } }
      });
    }
  });

  describe('R2Service Core Functionality', () => {
    it('generates a valid presigned upload URL and sanitized key structure', async () => {
      const result = await R2Service.generatePresignedUploadUrl('My Test File (Draft #1)!.pdf', 'application/pdf', 1024);

      expect(result.fileId).toMatch(/^fil_[a-zA-Z0-9_]+$/);
      expect(result.fileKey).toMatch(/^transit\/[a-zA-Z0-9_]+_My_Test_File__Draft__1__\.pdf$/);
      expect(result.sanitizedName).toBe('My_Test_File__Draft__1__.pdf');
      expect(result.presignedUrl).toContain('https://');
      expect(result.presignedUrl).toContain(result.fileKey);
    });

    it('persists quota metrics and triggers circuit breaker at quota limit', () => {
      const initialMetrics = R2Service.getMetrics();
      expect(initialMetrics.month).toBe(new Date().toISOString().slice(0, 7));

      // Record dummy classA and classB requests
      const prevTotal = initialMetrics.totalRequests;
      R2Service.recordRequest('classA');
      R2Service.recordRequest('classB');

      const updatedMetrics = R2Service.getMetrics();
      expect(updatedMetrics.totalRequests).toBe(prevTotal + 2);

      // Verify circuit breaker logic
      const originalMax = env.R2_MAX_MONTHLY_REQUESTS;
      try {
        // Temporarily lower threshold below current requests
        (env as any).R2_MAX_MONTHLY_REQUESTS = updatedMetrics.totalRequests;
        expect(R2Service.isAvailable()).toBe(false);

        // Restore above
        (env as any).R2_MAX_MONTHLY_REQUESTS = updatedMetrics.totalRequests + 1000;
        expect(R2Service.isAvailable()).toBe(true);
      } finally {
        (env as any).R2_MAX_MONTHLY_REQUESTS = originalMax;
      }
    });

    it('atomically ingests a transit stream and deletes object from R2', async () => {
      const testContent = 'Hello R2 Transit Pipe Ingestion Test Content!';
      const testBuffer = Buffer.from(testContent);
      const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');

      const dummyFileId = `fil_test_${Date.now()}`;
      const targetPath = StorageManager.getUploadPath(dummyFileId, '.txt');
      createdFileIds.push(dummyFileId);

      // Spy on client send to mock GetObject and DeleteObject
      const client = R2Service.getClient();
      const sendSpy = vi.spyOn(client, 'send').mockImplementation(async (command: any) => {
        const commandName = command.constructor.name;
        if (commandName === 'GetObjectCommand') {
          return {
            Body: Readable.from(testBuffer)
          } as any;
        }
        if (commandName === 'DeleteObjectCommand') {
          return {} as any;
        }
        return {} as any;
      });

      const result = await R2Service.ingestAndPurgeTransitObject('transit/test_file.txt', targetPath);

      expect(result.byteCount).toBe(testBuffer.length);
      expect(result.hashSha256).toBe(expectedHash);
      expect(fs.existsSync(targetPath)).toBe(true);
      expect(fs.readFileSync(targetPath, 'utf-8')).toBe(testContent);

      // Verify DeleteObject was called
      const deleteCalls = sendSpy.mock.calls.filter(call => call[0]?.constructor?.name === 'DeleteObjectCommand');
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);

      sendSpy.mockRestore();
    });
  });

  describe('Fastify Transit API Endpoints', () => {
    it('auto-bypasses to direct upload when request comes from LAN', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/presign',
        headers: {
          host: '192.168.2.171:3000'
        },
        payload: {
          fileName: 'document.pdf',
          fileSize: 5000000,
          mimeType: 'application/pdf',
          purpose: 'pdf-convert'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.mode).toBe('direct');
      expect(body.data.uploadUrl).toContain('/api/v1/files/upload');
    });

    it('provides R2 presigned URL when request comes from WAN (Cloudflare)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/presign',
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          host: 'duydevstudio.alphadaniel.io.vn'
        },
        payload: {
          fileName: 'video_clip.mp4',
          fileSize: 45000000,
          mimeType: 'video/mp4',
          purpose: 'media-transcode'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.mode).toBe('r2');
      expect(body.data.presignedUrl).toContain('https://');
      expect(body.data.fileKey).toMatch(/^transit\//);
      expect(body.data.fileId).toMatch(/^fil_/);
    });

    it('falls back to direct upload if circuit breaker trips on WAN', async () => {
      const originalAvailable = R2Service.isAvailable;
      (R2Service as any).isAvailable = () => false;

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/files/presign',
          headers: {
            'cf-connecting-ip': '203.0.113.195',
            host: 'duydevstudio.alphadaniel.io.vn'
          },
          payload: {
            fileName: 'large_archive.zip',
            fileSize: 10000000,
            mimeType: 'application/zip',
            purpose: 'archive-inspect'
          }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.data.mode).toBe('direct');
      } finally {
        (R2Service as any).isAvailable = originalAvailable;
      }
    });

    it('completes transit upload and creates database file record', async () => {
      const testContent = 'Simulated Transit Payload Ingestion';
      const testBuffer = Buffer.from(testContent);
      const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');

      const fileId = `fil_transit_int_${Date.now()}`;
      createdFileIds.push(fileId);

      const client = R2Service.getClient();
      const sendSpy = vi.spyOn(client, 'send').mockImplementation(async (command: any) => {
        const commandName = command.constructor.name;
        if (commandName === 'GetObjectCommand') {
          return {
            Body: Readable.from(testBuffer)
          } as any;
        }
        return {} as any;
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/complete-transit',
        payload: {
          fileKey: `transit/test_${Date.now()}_document.pdf`,
          fileId,
          originalName: 'final_document.pdf',
          mimeType: 'application/pdf',
          purpose: 'pdf-convert',
          sizeBytes: testBuffer.length
        }
      });

      sendSpy.mockRestore();

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.fileId).toBe(fileId);
      expect(body.data.originalName).toBe('final_document.pdf');
      expect(body.data.sizeBytes).toBe(testBuffer.length);
      expect(body.data.hashSha256).toBe(expectedHash);

      // Verify Prisma database record
      const dbRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.originalName).toBe('final_document.pdf');
      expect(dbRecord?.hashSha256).toBe(expectedHash);
      expect(dbRecord?.isPurged).toBe(false);
      expect(fs.existsSync(dbRecord!.storagePath)).toBe(true);
    });

    it('rejects transit completion with unauthorized or malicious fileKey', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/complete-transit',
        payload: {
          fileKey: '../../etc/passwd',
          fileId: 'fil_malicious_123',
          originalName: 'exploit.txt'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('rejects transit completion with malicious or traversal fileId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/complete-transit',
        payload: {
          fileKey: 'transit/test_file.txt',
          fileId: '../../etc/shadow',
          originalName: 'exploit.txt'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('auto-bypasses to direct upload for IPv4-mapped IPv6 LAN address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/presign',
        remoteAddress: '::ffff:192.168.2.105',
        headers: {
          host: 'duydev-homeserver:3000'
        },
        payload: {
          fileName: 'doc_ipv6.pdf',
          fileSize: 1000000,
          mimeType: 'application/pdf',
          purpose: 'pdf-convert'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.mode).toBe('direct');
    });

    it('rejects presign request when fileSize exceeds system maxUploadSizeBytes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/files/presign',
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          host: 'duydevstudio.alphadaniel.io.vn'
        },
        payload: {
          fileName: 'huge_archive.iso',
          fileSize: 100 * 1024 * 1024 * 1024, // 100GB > 50GB limit
          mimeType: 'application/octet-stream',
          purpose: 'storage-drive'
        }
      });

      expect(response.statusCode).toBe(413);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FILE_SIZE_LIMIT_EXCEEDED');
    });

    it('cleans orphaned transit objects older than 1 hour', async () => {
      const client = R2Service.getClient();
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const sendSpy = vi.spyOn(client, 'send').mockImplementation(async (command: any) => {
        const commandName = command.constructor.name;
        if (commandName === 'ListObjectsV2Command') {
          return {
            Contents: [
              { Key: 'transit/orphaned_old.pdf', LastModified: twoHoursAgo },
              { Key: 'transit/in_progress_fresh.pdf', LastModified: tenMinutesAgo }
            ]
          } as any;
        }
        if (commandName === 'DeleteObjectCommand') {
          return {} as any;
        }
        return {} as any;
      });

      const purged = await R2Service.cleanOrphanedTransitObjects(3600 * 1000);
      expect(purged).toBe(1);

      const deleteCalls = sendSpy.mock.calls.filter(call => call[0]?.constructor?.name === 'DeleteObjectCommand');
      expect(deleteCalls.length).toBe(1);
      expect((deleteCalls[0][0] as any).input.Key).toBe('transit/orphaned_old.pdf');

      sendSpy.mockRestore();
    });
  });
});
