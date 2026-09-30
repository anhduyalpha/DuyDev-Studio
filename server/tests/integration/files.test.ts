import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';

describe('Files API Integration Tests (Upload & Download)', () => {
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

    // Clean up created file records and disks
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

  it('should upload a file via multipart streaming and persist metadata', async () => {
    const boundary = '----WebKitFormBoundaryTest123456';
    const fileContent = 'Content for streaming upload integration test';

    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="purpose"',
      '',
      'pdf-convert',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="sample_upload.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/files/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartPayload)
    });

    expect(response.statusCode).toBe(201);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.fileId).toBeDefined();
    expect(json.data.originalName).toBe('sample_upload.txt');
    expect(json.data.sizeBytes).toBe(Buffer.from(fileContent).length);
    expect(json.data.hashSha256).toBeDefined();

    createdFileIds.push(json.data.fileId);

    // Verify record in SQLite
    const record = await prisma.fileRecord.findUnique({
      where: { id: json.data.fileId }
    });
    expect(record).toBeDefined();
    expect(record?.isPurged).toBe(false);
  });

  it('should stream-download an uploaded file with correct headers', async () => {
    const boundary = '----WebKitFormBoundaryDownload123';
    const fileContent = 'Verification content for download test';

    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="download_target.txt"',
      'Content-Type: text/plain',
      '',
      fileContent,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/v1/files/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartPayload)
    });

    const fileId = uploadRes.json().data.fileId;
    createdFileIds.push(fileId);

    // Now test downloading
    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/files/download/${fileId}`
    });

    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.payload).toBe(fileContent);
    expect(downloadRes.headers['content-type']).toContain('text/plain');
    expect(downloadRes.headers['content-disposition']).toContain('attachment');
    expect(downloadRes.headers['content-disposition']).toContain('download_target.txt');
    expect(downloadRes.headers['content-length']).toBe(Buffer.from(fileContent).length.toString());

    // Test inline view endpoint: must strictly set Content-Disposition: inline without filename
    const viewRes = await app.inject({
      method: 'GET',
      url: `/api/v1/files/view/${fileId}`
    });
    expect(viewRes.statusCode).toBe(200);
    expect(viewRes.headers['content-disposition']).toBe('inline');
    expect(viewRes.headers['content-disposition']).not.toContain('filename=');

    // Test download endpoint with ?inline=true: must also set Content-Disposition: inline without filename
    const inlineDownloadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/files/download/${fileId}?inline=true`
    });
    expect(inlineDownloadRes.statusCode).toBe(200);
    expect(inlineDownloadRes.headers['content-disposition']).toBe('inline');
    expect(inlineDownloadRes.headers['content-disposition']).not.toContain('filename=');
  });

  it('should return 404 when downloading non-existent or expired file', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/files/download/fil_does_not_exist_999'
    });

    expect(response.statusCode).toBe(404);
    const json = response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('should reject empty file uploads with HTTP 400', async () => {
    const boundary = '----WebKitFormBoundaryEmpty123';

    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="empty.txt"',
      'Content-Type: text/plain',
      '',
      '',
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/files/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartPayload)
    });

    expect(response.statusCode).toBe(400);
    const json = response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('BAD_REQUEST_PAYLOAD');
  });
});
