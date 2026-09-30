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
