import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../src/lib/prisma.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { processPdfJob } from '../../src/workers/pdf.worker.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { FileCorruptedError } from '../../src/lib/errors.js';

describe('Adversarial PDF Backend & Polyglot Pipeline Tests (Challenger M1)', () => {
  const baseFileId = `fil_adv_base_${Date.now()}`;
  let basePath: string;
  let basePdfBytes: Uint8Array;
  const createdJobIds: string[] = [];
  const createdFileIds: string[] = [baseFileId];

  beforeAll(async () => {
    await StorageManager.initStorage();

    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 700]);
    page.drawText('Adversarial Test Base PDF Document');
    basePdfBytes = await doc.save();

    basePath = StorageManager.getUploadPath(baseFileId, '.pdf');
    await fs.writeFile(basePath, Buffer.from(basePdfBytes));

    await prisma.fileRecord.create({
      data: {
        id: baseFileId,
        purpose: 'UPLOAD',
        originalName: 'adversarial_base.pdf',
        storagePath: basePath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(basePdfBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(basePdfBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });
  });

  afterAll(async () => {
    await closeTaskQueue();
    for (const fid of createdFileIds) {
      const rec = await prisma.fileRecord.findUnique({ where: { id: fid } }).catch(() => null);
      if (rec) {
        await StorageManager.unlinkSafe(rec.storagePath);
      }
    }
    await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    await prisma.fileRecord.deleteMany({ where: { id: { in: createdFileIds } } });
  });

  describe('1. Adversarial Password Failure Classification', () => {
    let lockedFileId: string;

    beforeAll(async () => {
      // Create an encrypted PDF
      const lockJobId = `job_adv_lock_${Date.now()}`;
      createdJobIds.push(lockJobId);

      await prisma.job.create({
        data: {
          id: lockJobId,
          type: 'pdf_lock',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: baseFileId, operation: 'lock', password: 'SuperSecretPassword2026!' })
        }
      });

      lockedFileId = await processPdfJob({
        jobId: lockJobId,
        fileId: baseFileId,
        operation: 'lock',
        options: { password: 'SuperSecretPassword2026!' }
      });
      createdFileIds.push(lockedFileId);
    });

    it('should return structured field: password error when unlocking with wrong password', async () => {
      const jobId = `job_adv_unl_wrong_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_unlock',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: lockedFileId, operation: 'unlock', password: 'WrongPassword' })
        }
      });

      let caughtErr: any = null;
      try {
        await processPdfJob({
          jobId,
          fileId: lockedFileId,
          operation: 'unlock',
          options: { password: 'WrongPassword' }
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(FileCorruptedError);
      expect(caughtErr.statusCode).toBe(422);
      expect(caughtErr.code).toBe('FILE_CORRUPTED');
      expect(caughtErr.details).toEqual([
        { field: 'password', issue: 'Document requires password for decrypt' }
      ]);

      const jobRec = await prisma.job.findUnique({ where: { id: jobId } });
      expect(jobRec?.status).toBe('FAILED');
      expect(jobRec?.errorMessage).toContain('invalid or password-protected');
    });

    it('should return structured field: password error when unlocking with empty password', async () => {
      const jobId = `job_adv_unl_empty_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_unlock',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: lockedFileId, operation: 'unlock', password: '' })
        }
      });

      let caughtErr: any = null;
      try {
        await processPdfJob({
          jobId,
          fileId: lockedFileId,
          operation: 'unlock',
          options: { password: '' }
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(FileCorruptedError);
      expect(caughtErr.statusCode).toBe(422);
      expect(caughtErr.details).toEqual([
        { field: 'password', issue: 'Document requires password for decrypt' }
      ]);
    });

    it('should classify un-decrypted operations on encrypted PDF with structured password error', async () => {
      const jobId = `job_adv_wm_encrypted_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_watermark',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: lockedFileId, operation: 'watermark' })
        }
      });

      let caughtErr: any = null;
      try {
        await processPdfJob({
          jobId,
          fileId: lockedFileId,
          operation: 'watermark',
          options: { watermarkText: 'TEST WATERMARK' }
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(FileCorruptedError);
      // PyMuPDF raises error on encrypted file during page access or saving
      expect(caughtErr.statusCode).toBe(422);
      // If error mentions password or encrypted, it must be structured with field: password
      if (caughtErr.details) {
        expect(caughtErr.details).toEqual([
          { field: 'password', issue: 'Document requires password for decrypt' }
        ]);
      }
    });
  });

  describe('2. Adversarial File Corruption Classification', () => {
    it('should reject a 0-byte empty file with FileCorruptedError without password details', async () => {
      const emptyFileId = `fil_adv_empty_${Date.now()}`;
      createdFileIds.push(emptyFileId);
      const emptyPath = StorageManager.getUploadPath(emptyFileId, '.pdf');
      await fs.writeFile(emptyPath, Buffer.alloc(0));

      await prisma.fileRecord.create({
        data: {
          id: emptyFileId,
          purpose: 'UPLOAD',
          originalName: 'empty.pdf',
          storagePath: emptyPath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(0),
          hashSha256: crypto.createHash('sha256').update('').digest('hex'),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      });

      const jobId = `job_adv_empty_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_compress',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: emptyFileId, operation: 'compress' })
        }
      });

      let caughtErr: any = null;
      try {
        await processPdfJob({
          jobId,
          fileId: emptyFileId,
          operation: 'compress'
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(FileCorruptedError);
      expect(caughtErr.statusCode).toBe(422);
      // Crucial: A 0-byte corrupt file MUST NOT be mistaken for a password-protected file!
      expect(caughtErr.details).toBeNull();

      const jobRec = await prisma.job.findUnique({ where: { id: jobId } });
      expect(jobRec?.status).toBe('FAILED');
    });

    it('should reject random binary non-PDF file with FileCorruptedError without password details', async () => {
      const randomFileId = `fil_adv_rand_${Date.now()}`;
      createdFileIds.push(randomFileId);
      const randBytes = crypto.randomBytes(512);
      const randPath = StorageManager.getUploadPath(randomFileId, '.pdf');
      await fs.writeFile(randPath, randBytes);

      await prisma.fileRecord.create({
        data: {
          id: randomFileId,
          purpose: 'UPLOAD',
          originalName: 'random_noise.pdf',
          storagePath: randPath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(randBytes.length),
          hashSha256: crypto.createHash('sha256').update(randBytes).digest('hex'),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      });

      const jobId = `job_adv_rand_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_split',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: randomFileId, operation: 'split' })
        }
      });

      let caughtErr: any = null;
      try {
        await processPdfJob({
          jobId,
          fileId: randomFileId,
          operation: 'split',
          options: { pages: '1' }
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(FileCorruptedError);
      expect(caughtErr.statusCode).toBe(422);
      expect(caughtErr.details).toBeNull();
    });

    it('should reject truncated PDF header/stream with FileCorruptedError without password details', async () => {
      const truncFileId = `fil_adv_trunc_${Date.now()}`;
      createdFileIds.push(truncFileId);
      const truncBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
      const truncPath = StorageManager.getUploadPath(truncFileId, '.pdf');
      await fs.writeFile(truncPath, truncBytes);

      await prisma.fileRecord.create({
        data: {
          id: truncFileId,
          purpose: 'UPLOAD',
          originalName: 'truncated.pdf',
          storagePath: truncPath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(truncBytes.length),
          hashSha256: crypto.createHash('sha256').update(truncBytes).digest('hex'),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      });

      const jobId = `job_adv_trunc_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_rotate',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: truncFileId, operation: 'rotate' })
        }
      });

      let caughtErr: any = null;
      try {
        await processPdfJob({
          jobId,
          fileId: truncFileId,
          operation: 'rotate',
          options: { angle: 90 }
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(FileCorruptedError);
      expect(caughtErr.statusCode).toBe(422);
      expect(caughtErr.details).toBeNull();
    });
  });

  describe('3. SHA-256 Stream Calculation and Size Consistency', () => {
    it('should verify streaming SHA-256 calculation matches file on disk byte-for-byte and DB record', async () => {
      const jobId = `job_adv_sha_${Date.now()}`;
      createdJobIds.push(jobId);

      await prisma.job.create({
        data: {
          id: jobId,
          type: 'pdf_watermark',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: baseFileId, operation: 'watermark' })
        }
      });

      const resultFileId = await processPdfJob({
        jobId,
        fileId: baseFileId,
        operation: 'watermark',
        options: { watermarkText: 'STREAM SHA-256 CHECK', watermarkPosition: 'center', watermarkOpacity: 0.25 }
      });
      createdFileIds.push(resultFileId);

      const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
      expect(artifact).toBeDefined();

      const diskBytes = await fs.readFile(artifact!.storagePath);
      const diskStats = await fs.stat(artifact!.storagePath);

      // 1. Independent in-memory SHA-256 computation
      const expectedHash = crypto.createHash('sha256').update(diskBytes).digest('hex');

      // 2. StorageManager stream SHA-256 computation
      const streamHash = await StorageManager.computeSha256(artifact!.storagePath);

      // Verify DB matches stream and independent computation
      expect(artifact!.hashSha256).toBe(expectedHash);
      expect(streamHash).toBe(expectedHash);

      // Verify DB sizeBytes matches physical file size exactly
      expect(Number(artifact!.sizeBytes)).toBe(diskStats.size);
      expect(Number(artifact!.sizeBytes)).toBe(diskBytes.byteLength);
    });

    it('should maintain size and SHA-256 consistency under compress fallback protection', async () => {
      const tinyDoc = await PDFDocument.create();
      tinyDoc.addPage([100, 100]);
      const tinyBytes = await tinyDoc.save();

      const tinyFileId = `fil_adv_tiny_${Date.now()}`;
      createdFileIds.push(tinyFileId);
      const tinyPath = StorageManager.getUploadPath(tinyFileId, '.pdf');
      await fs.writeFile(tinyPath, Buffer.from(tinyBytes));

      const originalHash = crypto.createHash('sha256').update(tinyBytes).digest('hex');
      const originalSize = tinyBytes.byteLength;

      await prisma.fileRecord.create({
        data: {
          id: tinyFileId,
          purpose: 'UPLOAD',
          originalName: 'tiny.pdf',
          storagePath: tinyPath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(originalSize),
          hashSha256: originalHash,
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      });

      const fallbackJobId = `job_adv_fallback_${Date.now()}`;
      createdJobIds.push(fallbackJobId);

      await prisma.job.create({
        data: {
          id: fallbackJobId,
          type: 'pdf_compress',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: tinyFileId, operation: 'compress' })
        }
      });

      const resultFileId = await processPdfJob({
        jobId: fallbackJobId,
        fileId: tinyFileId,
        operation: 'compress',
        options: { compressionLevel: 'low' }
      });
      createdFileIds.push(resultFileId);

      const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
      expect(artifact).toBeDefined();

      const resultStats = await fs.stat(artifact!.storagePath);
      const resultBytes = await fs.readFile(artifact!.storagePath);
      const resultDiskHash = crypto.createHash('sha256').update(resultBytes).digest('hex');

      // Due to fallback protection:
      // 1. Result size must be <= original size
      expect(resultStats.size).toBeLessThanOrEqual(originalSize);
      expect(Number(artifact!.sizeBytes)).toBe(resultStats.size);

      // 2. Hash in DB must match hash on disk
      expect(artifact!.hashSha256).toBe(resultDiskHash);

      // 3. If fallback occurred (copied original file), hashes and sizes must be identical
      if (resultStats.size === originalSize) {
        expect(artifact!.hashSha256).toBe(originalHash);
      }
    });

    it('should verify StorageManager.computeSha256 stream integrity on multi-chunk (4MB) binary buffer', async () => {
      const chunkFileId = `fil_adv_chunk_${Date.now()}`;
      const chunkPath = StorageManager.getTempPath(chunkFileId, '.bin');
      const largeBuffer = crypto.randomBytes(4 * 1024 * 1024); // 4MB
      await fs.writeFile(chunkPath, largeBuffer);

      const expectedSha256 = crypto.createHash('sha256').update(largeBuffer).digest('hex');
      const computedSha256 = await StorageManager.computeSha256(chunkPath);

      expect(computedSha256).toBe(expectedSha256);

      await StorageManager.unlinkSafe(chunkPath);
    });
  });
});
