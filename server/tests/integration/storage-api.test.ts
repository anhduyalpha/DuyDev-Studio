import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { DriveService } from '../../src/services/drive.service.js';
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

  it('Storage: verifies uploaded file is present in folder listing', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/list?path=/test_folder',
      headers: {
        'x-storage-auth': authToken
      }
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.success).toBe(true);
    const found = listBody.data.items.find((item: any) => item.name === 'sample_doc.txt');
    expect(found).toBeDefined();
    expect(found.isDirectory).toBe(false);
  });

  it('Storage: uploads a file using targetDir query parameter', async () => {
    const boundary = '----WebKitFormBoundaryStorageTest2';
    const content = 'Test file content via targetDir param';

    const multipartPayload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="targetdir_doc.txt"',
      'Content-Type: text/plain',
      '',
      content,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/upload?targetDir=/test_folder',
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
    expect(body.data.uploaded[0].name).toBe('targetdir_doc.txt');
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

  it('Storage: copies a file to destination folder', async () => {
    const copyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/copy',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder/renamed_doc.txt',
        destinationDir: '/'
      }
    });

    expect(copyRes.statusCode).toBe(200);
    const body = JSON.parse(copyRes.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('renamed_doc.txt');
    expect(body.data.path).toBe('/renamed_doc.txt');
  });

  it('Storage: moves a file to destination folder with conflict resolution', async () => {
    const moveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/move',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/renamed_doc.txt',
        destinationDir: '/test_folder'
      }
    });

    expect(moveRes.statusCode).toBe(200);
    const body = JSON.parse(moveRes.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('renamed_doc (1).txt');
    expect(body.data.path).toBe('/test_folder/renamed_doc (1).txt');
  });

  it('Storage: blocks moving folder into itself or its child', async () => {
    const invalidMoveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/move',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder',
        destinationDir: '/test_folder'
      }
    });

    expect(invalidMoveRes.statusCode).toBe(400);
  });

  it('Storage: blocks copying folder into itself or its child', async () => {
    const invalidCopyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/copy',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder',
        destinationDir: '/test_folder'
      }
    });

    expect(invalidCopyRes.statusCode).toBe(400);
    const body = JSON.parse(invalidCopyRes.payload);
    expect(body.error.message).toContain('Không thể sao chép thư mục vào chính nó');
  });

  it('Storage: blocks archiving a non-directory file with archiveFolderToZip', async () => {
    await expect(
      DriveService.archiveFolderToZip('/test_folder/renamed_doc.txt')
    ).rejects.toThrow('không phải là thư mục');
  });

  it('Storage: single item archive uses item name for zipName', async () => {
    const { zipName, zipPath } = await DriveService.archiveItemsToZip(['/test_folder']);
    expect(zipName).toBe('test_folder.zip');
    await StorageManager.unlinkSafe(zipPath);
  });

  it('Storage: blocks moving item into its own current folder', async () => {
    const invalidMoveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/move',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder/renamed_doc.txt',
        destinationDir: '/test_folder'
      }
    });

    expect(invalidMoveRes.statusCode).toBe(400);
    const body = JSON.parse(invalidMoveRes.payload);
    expect(body.error.message).toContain('Mục đã nằm trong thư mục đích');
  });

  it('Storage: renames file casing on Windows NTFS (case-change rename)', async () => {
    const caseRenameRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/rename',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder/renamed_doc.txt',
        newName: 'Renamed_Doc.txt'
      }
    });

    expect(caseRenameRes.statusCode).toBe(200);
    const body = JSON.parse(caseRenameRes.payload);
    expect(body.data.name).toBe('Renamed_Doc.txt');

    // Rename back to lowercase
    const revertRenameRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/rename',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        path: '/test_folder/Renamed_Doc.txt',
        newName: 'renamed_doc.txt'
      }
    });

    expect(revertRenameRes.statusCode).toBe(200);
    const revertBody = JSON.parse(revertRenameRes.payload);
    expect(revertBody.data.name).toBe('renamed_doc.txt');
  });

  it('Storage: batch copies and batch moves multiple files into another folder', async () => {
    // 1. Create target directories
    await app.inject({
      method: 'POST',
      url: '/api/v1/storage/mkdir',
      headers: { 'x-storage-auth': authToken },
      payload: { path: '/', name: 'batch_copy_dest' }
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/storage/mkdir',
      headers: { 'x-storage-auth': authToken },
      payload: { path: '/', name: 'batch_move_dest' }
    });

    // 2. Batch copy 2 items to /batch_copy_dest
    const batchCopyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/copy',
      headers: { 'x-storage-auth': authToken },
      payload: {
        paths: ['/test_folder/renamed_doc.txt', '/test_folder/targetdir_doc.txt'],
        destinationDir: '/batch_copy_dest'
      }
    });

    expect(batchCopyRes.statusCode).toBe(200);
    const copyBody = JSON.parse(batchCopyRes.payload);
    expect(copyBody.success).toBe(true);
    expect(copyBody.data.length).toBe(2);

    // 3. Batch move the copied items from /batch_copy_dest to /batch_move_dest
    const batchMoveRes = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/move',
      headers: { 'x-storage-auth': authToken },
      payload: {
        paths: ['/batch_copy_dest/renamed_doc.txt', '/batch_copy_dest/targetdir_doc.txt'],
        destinationDir: '/batch_move_dest'
      }
    });

    expect(batchMoveRes.statusCode).toBe(200);
    const moveBody = JSON.parse(batchMoveRes.payload);
    expect(moveBody.success).toBe(true);
    expect(moveBody.data.length).toBe(2);

    // 4. Batch delete folder and already included child gracefully
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/storage/delete',
      headers: { 'x-storage-auth': authToken },
      payload: {
        paths: ['/batch_move_dest', '/batch_move_dest/renamed_doc.txt', '/batch_copy_dest']
      }
    });

    expect(delRes.statusCode).toBe(200);
  });

  it('Storage: batch downloads selected items as ZIP archive', async () => {
    const batchDlRes = await app.inject({
      method: 'GET',
      url: `/api/v1/storage/download?paths=${encodeURIComponent(JSON.stringify(['/test_folder/renamed_doc.txt', '/test_folder/targetdir_doc.txt']))}`,
      headers: {
        'x-storage-auth': authToken
      }
    });

    expect(batchDlRes.statusCode).toBe(200);
    expect(batchDlRes.headers['content-type']).toBe('application/zip');
    expect(batchDlRes.headers['content-disposition']).toContain('attachment');
  });

  it('Storage: batch deletes multiple files', async () => {
    const batchDelRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/storage/delete',
      headers: {
        'x-storage-auth': authToken
      },
      payload: {
        paths: [
          '/test_folder/renamed_doc.txt',
          '/test_folder/renamed_doc (1).txt',
          '/test_folder/targetdir_doc.txt'
        ]
      }
    });

    expect(batchDelRes.statusCode).toBe(200);
    const body = JSON.parse(batchDelRes.payload);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Đã xóa thành công 3 mục');
  });

  it('Storage: deletes remaining test directory', async () => {
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
