import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { resolvedStoragePaths } from '../../src/config/env.config.js';

describe('Storage & Auth API Integration Tests', () => {
  let app: FastifyInstance;
  let authToken = '';

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();

    // Clean up test items in drive directory
    const testDir = path.join(resolvedStoragePaths.drive, 'test_folder');
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
    const testFile = path.join(resolvedStoragePaths.drive, 'sample_doc.txt');
    if (existsSync(testFile)) {
      await fs.unlink(testFile).catch(() => {});
    }
    const testZip = path.join(resolvedStoragePaths.drive, 'test_archive.zip');
    if (existsSync(testZip)) {
      await fs.unlink(testZip).catch(() => {});
    }
  });

  it('Auth: rejects incorrect admin password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify',
      payload: { password: 'wrong_password_123' }
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
  });

  it('Auth: accepts default password "duydev" and returns session token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify',
      payload: { password: 'duydev' }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    authToken = body.data.token;
  });

  it('Storage: rejects unauthorized access without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/list'
    });
    expect(res.statusCode).toBe(401);
  });

  it('Storage: lists root storage items and disk stats with valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/list?path=/',
      headers: {
        'x-storage-auth': authToken
      }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.currentPath).toBe('/');
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.stats).toBeDefined();
  });

  it('Storage: creates a new folder', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/mkdir',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/',
        name: 'test_folder'
      }
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('test_folder');
    expect(body.data.isDirectory).toBe(true);
  });

  it('Storage: blocks path traversal attempts during folder creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/mkdir',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/',
        name: '../../traversal'
      }
    });
    expect(res.statusCode).toBe(400);
  });

  it('Storage: uploads a file to the created folder', async () => {
    const boundary = '----WebKitFormBoundaryStorageTest';
    const content = 'Test file content for storage drive';

    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="sample_doc.txt"',
      'Content-Type: text/plain',
      '',
      content,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/upload?path=/test_folder',
      headers: {
        'x-storage-auth': authToken,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartPayload)
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.uploaded.length).toBe(1);
    expect(body.data.uploaded[0].name).toBe('sample_doc.txt');
  });

  it('Storage: downloads the uploaded file', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/download?path=/test_folder/sample_doc.txt',
      headers: {
        'x-storage-auth': authToken
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain('Test file content for storage drive');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('sample_doc.txt');

    // Test inline download for viewing: must strictly set Content-Disposition: inline without filename
    const inlineRes = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/download?path=/test_folder/sample_doc.txt&inline=true',
      headers: {
        'x-storage-auth': authToken
      }
    });
    expect(inlineRes.statusCode).toBe(200);
    expect(inlineRes.headers['content-disposition']).toBe('inline');
    expect(inlineRes.headers['content-disposition']).not.toContain('filename=');
  });

  it('Storage: renames the file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/rename',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder/sample_doc.txt',
        newName: 'renamed_doc.txt'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.name).toBe('renamed_doc.txt');
  });

  it('Storage: downloads folder as ZIP archive', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/download?path=/test_folder',
      headers: {
        'x-storage-auth': authToken
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('Archive: inspects and extracts archive via drivePath', async () => {
    // 1. Save zip to drive for inspection
    const zipPath = path.join(resolvedStoragePaths.drive, 'test_archive.zip');
    const zipRes = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/download?path=/test_folder',
      headers: { 'x-storage-auth': authToken }
    });
    expect(zipRes.statusCode).toBe(200);
    await fs.writeFile(zipPath, zipRes.rawPayload);

    // 2. Inspect archive via drivePath
    const inspectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/archive/inspect',
      headers: { 'x-storage-auth': authToken },
      payload: { drivePath: '/test_archive.zip' }
    });
    expect(inspectRes.statusCode).toBe(200);
    const inspectBody = JSON.parse(inspectRes.payload);
    expect(inspectBody.success).toBe(true);
    expect(inspectBody.data.drivePath).toBe('/test_archive.zip');
    expect(inspectBody.data.totalFiles).toBeGreaterThan(0);

    // 3. Extract member file via drivePath
    const entries = inspectBody.data.tree || inspectBody.data.entries || [];
    const member = entries.find((e: any) => !e.isDirectory);
    if (member) {
      const extractRes = await app.inject({
        method: 'GET',
        url: `/api/v1/archive/extract-file?drivePath=/test_archive.zip&memberPath=${encodeURIComponent(member.path)}&inline=true`,
        headers: { 'x-storage-auth': authToken }
      });
      expect(extractRes.statusCode).toBe(200);
      expect(extractRes.headers['content-disposition']).toContain('inline');
    }

    // Clean up zipPath
    await fs.unlink(zipPath).catch(() => {});
  });

  it('Storage: deletes file and directory', async () => {
    const delFileRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/storage/delete',
      headers: {
        'x-storage-auth': authToken
      },
      payload: { path: '/test_folder/renamed_doc.txt' }
    });
    expect(delFileRes.statusCode).toBe(200);

    const delDirRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/storage/delete',
      headers: {
        'x-storage-auth': authToken
      },
      payload: { path: '/test_folder' }
    });
    expect(delDirRes.statusCode).toBe(200);
  });
});
