import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import crypto from 'crypto';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';

describe('Converter API Integration Tests', () => {
  let app: FastifyInstance;
  const fileId = `fil_api_conv_${Date.now()}`;
  let pngPath: string;
  const createdJobIds: string[] = [];

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();

    // 1x1 PNG Buffer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    pngPath = StorageManager.getUploadPath(fileId, '.png');
    await fs.writeFile(pngPath, pngBuffer);

    await prisma.fileRecord.create({
      data: {
        id: fileId,
        purpose: 'UPLOAD',
        originalName: 'dot.png',
        storagePath: pngPath,
        mimeType: 'image/png',
        sizeBytes: BigInt(pngBuffer.byteLength),
        hashSha256: crypto.createHash('sha256').update(pngBuffer).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();
    await StorageManager.unlinkSafe(pngPath);
    await prisma.job.deleteMany({
      where: { id: { in: createdJobIds } }
    });
    await prisma.fileRecord.deleteMany({
      where: { id: fileId }
    });
  });

  it('POST /api/v1/converter/detect should detect format and return target options for uploaded file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/converter/detect',
      payload: { fileId }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.category).toBe('image');
    expect(body.data.extension).toBe('PNG');
    expect(body.data.targetFormats).toContain('webp');
    expect(body.data.targetFormats).toContain('jpg');
  });

  it('POST /api/v1/converter/detect should infer category from fileName when fileId is absent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/converter/detect',
      payload: { fileName: 'clip.mp4' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.category).toBe('video');
    expect(body.data.targetFormats).toContain('mp4');
    expect(body.data.targetFormats).toContain('gif');
  });

  it('POST /api/v1/converter/job should enqueue job and return HTTP 202 with URLs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/converter/job',
      payload: {
        fileId,
        targetFormat: 'webp',
        options: { quality: 80 }
      }
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.jobId).toBeDefined();
    expect(body.data.status).toBe('QUEUED');
    expect(body.data.eventsUrl).toContain('/events');
    expect(body.data.pollUrl).toContain('/api/v1/jobs/');

    createdJobIds.push(body.data.jobId);
  });

  it('POST /api/v1/converter/job should return 404 for non-existent fileId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/converter/job',
      payload: {
        fileId: 'fil_missing_file_id',
        targetFormat: 'webp'
      }
    });

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/converter/job should return 400 for missing targetFormat', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/converter/job',
      payload: {
        fileId
      }
    });

    expect(res.statusCode).toBe(400);
  });
});
