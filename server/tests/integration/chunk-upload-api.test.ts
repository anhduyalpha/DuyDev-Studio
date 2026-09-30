import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';

describe('Chunked Resumable Upload API Integration Tests', () => {
  let app: FastifyInstance;
  let createdFileId: string | null = null;
  let testUploadId: string;

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();
    if (createdFileId) {
      const rec = await prisma.fileRecord.findUnique({ where: { id: createdFileId } });
      if (rec) {
        await StorageManager.unlinkSafe(rec.storagePath);
        await prisma.fileRecord.delete({ where: { id: createdFileId } });
      }
    }
  });

  it('should initialize a chunk upload session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/files/chunk/init',
      payload: {
        fileName: 'large-archive.zip',
        fileSize: 10 * 1024 * 1024,
        totalChunks: 2,
        purpose: 'archive-inspect'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.uploadId).toBeDefined();
    expect(json.data.totalChunks).toBe(2);
    testUploadId = json.data.uploadId;
  });

  it('should upload chunk 0 and chunk 1', async () => {
    const chunk0 = Buffer.alloc(1024, 'A');
    const form0 = new FormData();
    form0.append('file', chunk0, { filename: 'chunk_0.part' });

    const res0 = await app.inject({
      method: 'POST',
      url: `/api/v1/files/chunk/upload?uploadId=${testUploadId}&chunkIndex=0`,
      headers: form0.getHeaders(),
      payload: form0.getBuffer()
    });
    expect(res0.statusCode).toBe(200);

    const chunk1 = Buffer.alloc(512, 'B');
    const form1 = new FormData();
    form1.append('file', chunk1, { filename: 'chunk_1.part' });

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/files/chunk/upload?uploadId=${testUploadId}&chunkIndex=1`,
      headers: form1.getHeaders(),
      payload: form1.getBuffer()
    });
    expect(res1.statusCode).toBe(200);
  });

  it('should query chunk status and see uploaded chunks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/files/chunk/status/${testUploadId}`
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.data.exists).toBe(true);
    expect(json.data.uploadedChunks).toEqual([0, 1]);
  });

  it('should assemble all chunks and create fileRecord upon completion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/files/chunk/complete',
      payload: { uploadId: testUploadId }
    });

    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.data.fileId).toBeDefined();
    expect(json.data.sizeBytes).toBe(1536);
    createdFileId = json.data.fileId;

    const fileInDb = await prisma.fileRecord.findUnique({ where: { id: createdFileId } });
    expect(fileInDb).not.toBeNull();
    expect(Number(fileInDb?.sizeBytes)).toBe(1536);
  });

  it('should support storage-drive chunked upload assembling directly into drive', async () => {
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/files/chunk/init',
      payload: {
        fileName: 'test-drive-file.dat',
        fileSize: 2048,
        totalChunks: 2,
        purpose: 'storage-drive',
        targetDir: '/'
      }
    });
    expect(initRes.statusCode).toBe(200);
    const driveUploadId = initRes.json().data.uploadId;

    const chunk0 = Buffer.alloc(1024, 'X');
    const form0 = new FormData();
    form0.append('file', chunk0, { filename: 'chunk_0.part' });
    await app.inject({
      method: 'POST',
      url: `/api/v1/files/chunk/upload?uploadId=${driveUploadId}&chunkIndex=0`,
      headers: form0.getHeaders(),
      payload: form0.getBuffer()
    });

    const chunk1 = Buffer.alloc(1024, 'Y');
    const form1 = new FormData();
    form1.append('file', chunk1, { filename: 'chunk_1.part' });
    await app.inject({
      method: 'POST',
      url: `/api/v1/files/chunk/upload?uploadId=${driveUploadId}&chunkIndex=1`,
      headers: form1.getHeaders(),
      payload: form1.getBuffer()
    });

    const compRes = await app.inject({
      method: 'POST',
      url: '/api/v1/files/chunk/complete',
      payload: { uploadId: driveUploadId }
    });
    expect(compRes.statusCode).toBe(201);
    const compData = compRes.json().data;
    expect(compData.sizeBytes).toBe(2048);
    expect(compData.path).toBe('/test-drive-file.dat');

    const diskPath = StorageManager.getDrivePath('test-drive-file.dat');
    await StorageManager.unlinkSafe(diskPath);
  });
});
