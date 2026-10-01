import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { buildApp } from '../../src/app.js';
import { getChunkDir } from '../../src/api/controllers/chunk-upload.controller.js';

describe('WinSCP-Style Raw Binary Streaming Chunk Upload Suite', () => {
  let app: FastifyInstance;
  let testUploadId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (testUploadId) {
      const dir = getChunkDir(testUploadId);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
    await app.close();
  });

  it('initializes chunk upload session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/files/chunk/init',
      payload: {
        fileName: 'test-binary-stream.txt',
        fileSize: 100,
        totalChunks: 2,
        chunkSize: 50
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.uploadId).toBeDefined();
    testUploadId = body.data.uploadId;
  });

  it('streams raw binary chunk directly without multipart headers', async () => {
    const chunk0Data = Buffer.alloc(50, 65); // 50 'A's

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/files/chunk/stream?uploadId=${testUploadId}&chunkIndex=0`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-upload-id': testUploadId,
        'x-chunk-index': '0'
      },
      payload: chunk0Data
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.chunkIndex).toBe(0);
    expect(body.data.bytesReceived).toBe(50);

    const chunkPath = path.join(getChunkDir(testUploadId), 'chunk_0.part');
    expect(fs.existsSync(chunkPath)).toBe(true);
    expect(fs.readFileSync(chunkPath).toString()).toBe('A'.repeat(50));
  });

  it('streams compressed gzip chunk and decompresses on-the-fly', async () => {
    const rawChunk1 = Buffer.from('B'.repeat(50));
    const gzippedChunk1 = zlib.gzipSync(rawChunk1);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/files/chunk/stream`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-upload-id': testUploadId,
        'x-chunk-index': '1',
        'x-content-encoding': 'gzip'
      },
      payload: gzippedChunk1
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.chunkIndex).toBe(1);

    const chunk1Path = path.join(getChunkDir(testUploadId), 'chunk_1.part');
    expect(fs.existsSync(chunk1Path)).toBe(true);
    expect(fs.readFileSync(chunk1Path).toString()).toBe('B'.repeat(50));
  });

  it('reports all uploaded chunks correctly via status check', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/files/chunk/status/${testUploadId}`
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.uploadedChunks.sort()).toEqual([0, 1]);
  });
});
