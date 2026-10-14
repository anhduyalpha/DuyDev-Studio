import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { resolvedStoragePaths } from '../../src/config/env.config.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Scribd Document Archiver Integration & Drive Save Tests', () => {
  let app: FastifyInstance;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
    await closeTaskQueue();
  });

  it('verifies GET /api/v1/scribd/status endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scribd/status'
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('port');
  });

  it('enforces Content-Type: application/pdf and Content-Disposition: inline on /api/v1/scribd/stream', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/document-stream')) {
        return new Response(Buffer.from('%PDF-1.4 mock scribd document stream'), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': '35',
            'Accept-Ranges': 'bytes',
            'Content-Disposition': 'inline'
          }
        });
      }
      return originalFetch(url);
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scribd/stream?id=693471767&file=Smart_Money_Concept.pdf'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('inline');
    expect(res.body).toContain('%PDF-1.4');
  });

  it('verifies POST /api/v1/scribd/save-drive saves file and creates meta sidecar + HistoryRecord', async () => {
    const mockFilename = 'test_save_drive_693471767.pdf';
    const mockPdfBytes = Buffer.from('%PDF-1.4 Dummy Scribd PDF for Drive Test');

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes(`/downloads/${encodeURIComponent(mockFilename)}`)) {
        return new Response(mockPdfBytes, { status: 200 });
      }
      if (url.includes('/api/status')) {
        return new Response(JSON.stringify({ success: true, active: true }), { status: 200 });
      }
      return originalFetch(url);
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/scribd/save-drive',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': 'dev_test_scribd_123'
      },
      payload: {
        filename: mockFilename,
        title: 'Smart Money Concept Test',
        targetDir: 'scribd'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.relPath).toBe('/scribd/' + mockFilename);

    // Verify file exists on disk
    const targetFile = path.join(resolvedStoragePaths.drive, 'scribd', mockFilename);
    const metaFile = targetFile.replace(/\.pdf$/i, '.meta.json');

    const fileContent = await fsPromises.readFile(targetFile);
    expect(fileContent.toString()).toContain('%PDF-1.4');

    const metaContent = JSON.parse(await fsPromises.readFile(metaFile, 'utf-8'));
    expect(metaContent.source).toBe('Scribd Archiver');

    // Verify HistoryRecord was saved in Prisma
    const record = await prisma.historyRecord.findFirst({
      where: {
        fileName: mockFilename,
        deviceId: 'dev_test_scribd_123'
      }
    });
    expect(record).not.toBeNull();
    expect(record?.toolId).toBe('scribd-archiver');

    // Cleanup test files
    try {
      await fsPromises.unlink(targetFile);
      await fsPromises.unlink(metaFile);
      if (record) {
        await prisma.historyRecord.delete({ where: { id: record.id } });
      }
    } catch (_) {}
  });
});
