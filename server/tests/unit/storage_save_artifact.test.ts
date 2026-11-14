import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { resolvedStoragePaths } from '../../src/config/env.config.js';

describe('POST /api/v1/storage/save-artifact & Security Boundary Tests', () => {
  let app: FastifyInstance;
  let authToken = '';
  const createdFileIds: string[] = [];
  const filesToCleanup: string[] = [];
  const dirsToCleanup: string[] = [];

  const testFileId = `test_art_${Date.now()}`;
  const testDiskPath = path.join(resolvedStoragePaths.uploads, `${testFileId}.pdf`);

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();

    // Authenticate with default password to get valid token
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify',
      payload: { password: 'duydev' }
    });
    expect(verifyRes.statusCode).toBe(200);
    authToken = verifyRes.json().data.token;

    // Create a real file on disk for fileId test
    const dummyContent = Buffer.from('%PDF-1.4 test pdf content for save-artifact');
    await fs.writeFile(testDiskPath, dummyContent);
    filesToCleanup.push(testDiskPath);

    // Create a Prisma file record
    await prisma.fileRecord.create({
      data: {
        id: testFileId,
        purpose: 'UPLOAD',
        originalName: 'original_test.pdf',
        storagePath: testDiskPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(dummyContent.length),
        hashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        isPurged: false,
        expiresAt: new Date(Date.now() + 86400000)
      }
    });
    createdFileIds.push(testFileId);
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();

    // Clean up Prisma file records
    if (createdFileIds.length > 0) {
      await prisma.fileRecord.deleteMany({
        where: { id: { in: createdFileIds } }
      }).catch(() => {});
    }

    // Clean up disk files
    for (const file of filesToCleanup) {
      if (existsSync(file)) {
        await fs.unlink(file).catch(() => {});
      }
    }

    // Clean up created folders if empty
    for (const dir of dirsToCleanup) {
      if (existsSync(dir)) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });

  it('1. Unauthenticated POST /api/v1/storage/save-artifact returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      payload: {
        fileId: testFileId,
        targetFolder: '/pdf',
        fileName: 'unauth_test.pdf'
      }
    });

    expect(res.statusCode).toBe(401);
    const json = res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('2. Authenticated call with unknown/disallowed targetFolder returns 400', async () => {
    // Disallowed: path traversal
    const resTraversal = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: { 'x-storage-auth': authToken },
      payload: {
        fileId: testFileId,
        targetFolder: '/../escape',
        fileName: 'evil.pdf'
      }
    });
    expect(resTraversal.statusCode).toBe(400);

    // Disallowed: not in allowlist ('/slideshare' is download-only, not an artifact target)
    const resDisallowed = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: { 'x-storage-auth': authToken },
      payload: {
        fileId: testFileId,
        targetFolder: '/slideshare',
        fileName: 'test.pdf'
      }
    });
    expect(resDisallowed.statusCode).toBe(400);
  });

  it('3. Authenticated JSON fileId copy saves to /pdf, writes .meta.json, duplicate (1) & overwrite', async () => {
    const targetPdfFolder = path.join(resolvedStoragePaths.drive, 'pdf');
    dirsToCleanup.push(targetPdfFolder);

    const initialPdfPath = path.join(targetPdfFolder, 'sample_save.pdf');
    const initialMetaPath = path.join(targetPdfFolder, 'sample_save.meta.json');
    filesToCleanup.push(initialPdfPath, initialMetaPath);

    // First save
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: { 'x-storage-auth': authToken },
      payload: {
        fileId: testFileId,
        targetFolder: '/pdf',
        fileName: 'sample_save.pdf',
        metadata: { customField: 'test1234' }
      }
    });

    expect(res1.statusCode).toBe(201);
    const data1 = res1.json().data;
    expect(data1.path).toBe('/pdf/sample_save.pdf');
    expect(data1.name).toBe('sample_save.pdf');
    expect(data1.sizeBytes).toBeGreaterThan(0);
    expect(existsSync(initialPdfPath)).toBe(true);
    expect(existsSync(initialMetaPath)).toBe(true);

    const metaContent1 = JSON.parse(await fs.readFile(initialMetaPath, 'utf8'));
    expect(metaContent1.sourceFileId).toBe(testFileId);
    expect(metaContent1.customField).toBe('test1234');
    expect(metaContent1.savedAt).toBeDefined();

    // Second save without overwrite -> increments to sample_save (1).pdf
    const duplicatePdfPath = path.join(targetPdfFolder, 'sample_save (1).pdf');
    const duplicateMetaPath = path.join(targetPdfFolder, 'sample_save (1).meta.json');
    filesToCleanup.push(duplicatePdfPath, duplicateMetaPath);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: { 'x-storage-auth': authToken },
      payload: {
        fileId: testFileId,
        targetFolder: '/pdf',
        fileName: 'sample_save.pdf',
        overwrite: false
      }
    });

    expect(res2.statusCode).toBe(201);
    const data2 = res2.json().data;
    expect(data2.path).toBe('/pdf/sample_save (1).pdf');
    expect(data2.name).toBe('sample_save (1).pdf');
    expect(existsSync(duplicatePdfPath)).toBe(true);
    expect(existsSync(duplicateMetaPath)).toBe(true);

    // Third save with overwrite: true -> overwrites sample_save.pdf
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: { 'x-storage-auth': authToken },
      payload: {
        fileId: testFileId,
        targetFolder: '/pdf',
        fileName: 'sample_save.pdf',
        overwrite: true
      }
    });

    expect(res3.statusCode).toBe(201);
    const data3 = res3.json().data;
    expect(data3.path).toBe('/pdf/sample_save.pdf');
    expect(data3.name).toBe('sample_save.pdf');
  });

  it('4. Authenticated multipart upload writes file + .meta.json; 0-byte fails with 400', async () => {
    const targetImagesFolder = path.join(resolvedStoragePaths.drive, 'images');
    dirsToCleanup.push(targetImagesFolder);

    const imageFilePath = path.join(targetImagesFolder, 'viewsplit_art.png');
    const imageMetaPath = path.join(targetImagesFolder, 'viewsplit_art.meta.json');
    filesToCleanup.push(imageFilePath, imageMetaPath);

    // Successful multipart upload
    const boundary = '----WebKitFormBoundaryArtTest1234';
    const fakePngBytes = Buffer.from('fake png image binary stream for viewsplit composite');

    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="targetFolder"',
      '',
      '/images',
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileName"',
      '',
      'viewsplit_art.png',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="viewsplit_art.png"',
      'Content-Type: image/png',
      '',
      fakePngBytes.toString('binary'),
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const resUpload = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: {
        'x-storage-auth': authToken,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartPayload, 'binary')
    });

    expect(resUpload.statusCode).toBe(201);
    const uploadData = resUpload.json().data;
    expect(uploadData.path).toBe('/images/viewsplit_art.png');
    expect(uploadData.name).toBe('viewsplit_art.png');
    expect(existsSync(imageFilePath)).toBe(true);
    expect(existsSync(imageMetaPath)).toBe(true);

    // 0-byte upload should fail with 400
    const zeroBoundary = '----WebKitFormBoundaryZeroByte1234';
    const zeroPayload = [
      `--${zeroBoundary}`,
      'Content-Disposition: form-data; name="targetFolder"',
      '',
      '/images',
      `--${zeroBoundary}`,
      'Content-Disposition: form-data; name="fileName"',
      '',
      'empty.png',
      `--${zeroBoundary}`,
      'Content-Disposition: form-data; name="file"; filename="empty.png"',
      'Content-Type: image/png',
      '',
      '',
      `--${zeroBoundary}--`,
      ''
    ].join('\r\n');

    const resZero = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/save-artifact',
      headers: {
        'x-storage-auth': authToken,
        'content-type': `multipart/form-data; boundary=${zeroBoundary}`
      },
      payload: Buffer.from(zeroPayload, 'binary')
    });

    expect(resZero.statusCode).toBe(400);
  });

  it('5. Unauthenticated GET /api/v1/storage/download?path=/pdf/sample.pdf returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/download?path=/pdf/sample.pdf'
    });

    // Public download whitelist is ONLY /slideshare/, /academia/, /researchgate/
    // /pdf must be PIN-gated!
    expect(res.statusCode).toBe(401);
    const json = res.json();
    expect(json.success).toBe(false);
  });
});
