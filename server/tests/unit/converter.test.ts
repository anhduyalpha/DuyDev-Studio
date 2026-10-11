import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { processConverterJob } from '../../src/workers/converter.worker.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { NotFoundError } from '../../src/lib/errors.js';

describe('Converter Worker Unit Tests', () => {
  const fileId = `fil_test_png_${Date.now()}`;
  const nonExistentFileId = `fil_non_existent_${Date.now()}`;
  let pngPath: string;
  const createdJobIds: string[] = [];
  const createdArtifactIds: string[] = [];

  beforeAll(async () => {
    await StorageManager.initStorage();

    // 1x1 Red PNG bytes
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
        originalName: 'pixel.png',
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
    await StorageManager.unlinkSafe(pngPath);
    for (const artId of createdArtifactIds) {
      const art = await prisma.fileRecord.findUnique({ where: { id: artId } });
      if (art) {
        await StorageManager.unlinkSafe(art.storagePath);
      }
    }
    await prisma.job.deleteMany({
      where: { id: { in: createdJobIds } }
    });
    await prisma.fileRecord.deleteMany({
      where: { id: { in: [fileId, ...createdArtifactIds] } }
    });
  });

  it('should successfully convert PNG to WEBP and persist processed artifact', async () => {
    const jobId = `job_test_conv_${Date.now()}`;
    createdJobIds.push(jobId);

    await prisma.job.create({
      data: {
        id: jobId,
        type: 'convert_webp',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, targetFormat: 'webp' })
      }
    });

    const resultFileId = await processConverterJob({
      jobId,
      fileId,
      targetFormat: 'webp',
      options: { quality: 85 }
    });

    expect(resultFileId).toBeDefined();
    createdArtifactIds.push(resultFileId);

    // Verify job in DB
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(job?.progress).toBe(100);

    // Verify artifact file record
    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(artifact?.purpose).toBe('PROCESSED_ARTIFACT');
    expect(artifact?.mimeType).toBe('image/webp');
    expect(existsSync(artifact!.storagePath)).toBe(true);
  });

  it('should successfully convert SVG to PNG with width and height options', async () => {
    const svgFileId = `fil_test_svg_${Date.now()}`;
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="blue"/></svg>';
    const svgPath = StorageManager.getUploadPath(svgFileId, '.svg');
    await fs.writeFile(svgPath, svgContent, 'utf-8');

    await prisma.fileRecord.create({
      data: {
        id: svgFileId,
        purpose: 'UPLOAD',
        originalName: 'test.svg',
        storagePath: svgPath,
        mimeType: 'image/svg+xml',
        sizeBytes: BigInt(Buffer.byteLength(svgContent)),
        hashSha256: crypto.createHash('sha256').update(svgContent).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    const jobId = `job_test_svg_${Date.now()}`;
    createdJobIds.push(jobId);

    const resultFileId = await processConverterJob({
      jobId,
      fileId: svgFileId,
      targetFormat: 'png',
      options: { width: 400, height: 400, quality: 90 }
    });

    expect(resultFileId).toBeDefined();
    createdArtifactIds.push(resultFileId);

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(artifact?.mimeType).toBe('image/png');
    expect(existsSync(artifact!.storagePath)).toBe(true);

    await StorageManager.unlinkSafe(svgPath);
    await prisma.fileRecord.delete({ where: { id: svgFileId } });
  });

  it('should successfully convert Markdown to DOCX document', async () => {
    const mdFileId = `fil_test_md_${Date.now()}`;
    const mdContent = '# Tiêu đề tài liệu\n\nĐây là nội dung thử nghiệm Markdown.';
    const mdPath = StorageManager.getUploadPath(mdFileId, '.md');
    await fs.writeFile(mdPath, mdContent, 'utf-8');

    await prisma.fileRecord.create({
      data: {
        id: mdFileId,
        purpose: 'UPLOAD',
        originalName: 'document.md',
        storagePath: mdPath,
        mimeType: 'text/markdown',
        sizeBytes: BigInt(Buffer.byteLength(mdContent)),
        hashSha256: crypto.createHash('sha256').update(mdContent).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    const jobId = `job_test_md_${Date.now()}`;
    createdJobIds.push(jobId);

    const resultFileId = await processConverterJob({
      jobId,
      fileId: mdFileId,
      targetFormat: 'docx'
    });

    expect(resultFileId).toBeDefined();
    createdArtifactIds.push(resultFileId);

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(artifact?.mimeType).toContain('wordprocessingml.document');
    expect(existsSync(artifact!.storagePath)).toBe(true);

    await StorageManager.unlinkSafe(mdPath);
    await prisma.fileRecord.delete({ where: { id: mdFileId } });
  });

  it('should throw NotFoundError if source file does not exist on disk', async () => {
    const jobId = `job_test_missing_${Date.now()}`;
    createdJobIds.push(jobId);

    await prisma.job.create({
      data: {
        id: jobId,
        type: 'convert_webp',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: nonExistentFileId, targetFormat: 'webp' })
      }
    });

    await expect(
      processConverterJob({
        jobId,
        fileId: nonExistentFileId,
        targetFormat: 'webp'
      })
    ).rejects.toThrow(NotFoundError);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
  });
});
