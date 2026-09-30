import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import StreamZip from 'node-stream-zip';
import { buildApp } from '../../src/app.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { processPdfJob } from '../../src/workers/pdf.worker.js';

describe('PDF Studio Pro E2E & Integration Test Suite', () => {
  let app: FastifyInstance;
  const createdJobIds: string[] = [];
  const createdFileIds: string[] = [];

  const basePdfFileId = `fil_e2e_base_${Date.now()}`;
  const secondPdfFileId = `fil_e2e_second_${Date.now()}`;
  const imgFileId = `fil_e2e_img_${Date.now()}`;
  const pdfWithImgFileId = `fil_e2e_pdfimg_${Date.now()}`;

  let basePdfPath: string;
  let secondPdfPath: string;
  let imgPath: string;
  let pdfWithImgPath: string;

  beforeAll(async () => {
    await StorageManager.initStorage();
    app = await buildApp();
    await app.ready();

    // 1. Create Base 3-page PDF
    const baseDoc = await PDFDocument.create();
    for (let i = 1; i <= 3; i++) {
      const p = baseDoc.addPage([595, 842]);
      p.drawText(`Base PDF Page ${i}`);
    }
    const baseBytes = await baseDoc.save();
    basePdfPath = StorageManager.getUploadPath(basePdfFileId, '.pdf');
    await fs.writeFile(basePdfPath, Buffer.from(baseBytes));
    createdFileIds.push(basePdfFileId);

    await prisma.fileRecord.create({
      data: {
        id: basePdfFileId,
        purpose: 'UPLOAD',
        originalName: 'base_document.pdf',
        storagePath: basePdfPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(baseBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(baseBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    // 2. Create Second 2-page PDF
    const secDoc = await PDFDocument.create();
    for (let i = 1; i <= 2; i++) {
      const p = secDoc.addPage([595, 842]);
      p.drawText(`Second PDF Page ${i}`);
    }
    const secBytes = await secDoc.save();
    secondPdfPath = StorageManager.getUploadPath(secondPdfFileId, '.pdf');
    await fs.writeFile(secondPdfPath, Buffer.from(secBytes));
    createdFileIds.push(secondPdfFileId);

    await prisma.fileRecord.create({
      data: {
        id: secondPdfFileId,
        purpose: 'UPLOAD',
        originalName: 'second_document.pdf',
        storagePath: secondPdfPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(secBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(secBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    // 3. Create Sample PNG Image (400x300)
    const pythonBin = process.env.PYTHON_BIN || (existsSync('/home/anhduy/dd-studio/engines/document/venv/bin/python3') ? '/home/anhduy/dd-studio/engines/document/venv/bin/python3' : (process.platform === 'win32' ? 'python' : 'python3'));
    imgPath = StorageManager.getUploadPath(imgFileId, '.png');
    execSync(`${pythonBin} -c "import fitz; p = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,400,300), 0); p.save('${imgPath.replace(/\\/g, '/')}')"`);
    const imgStats = await fs.stat(imgPath);
    createdFileIds.push(imgFileId);

    await prisma.fileRecord.create({
      data: {
        id: imgFileId,
        purpose: 'UPLOAD',
        originalName: 'photo.png',
        storagePath: imgPath,
        mimeType: 'image/png',
        sizeBytes: BigInt(imgStats.size),
        hashSha256: await StorageManager.computeSha256(imgPath),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    // 4. Create PDF with embedded image for image extraction
    pdfWithImgPath = StorageManager.getUploadPath(pdfWithImgFileId, '.pdf');
    execSync(
      `${pythonBin} -c "import fitz; doc = fitz.open(); p = doc.new_page(); img = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,100,100), 0); p.insert_image(fitz.Rect(50,50,150,150), pixmap=img); doc.save('${pdfWithImgPath.replace(/\\/g, '/')}')"`
    );
    const pdfWithImgStats = await fs.stat(pdfWithImgPath);
    createdFileIds.push(pdfWithImgFileId);

    await prisma.fileRecord.create({
      data: {
        id: pdfWithImgFileId,
        purpose: 'UPLOAD',
        originalName: 'doc_with_image.pdf',
        storagePath: pdfWithImgPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(pdfWithImgStats.size),
        hashSha256: await StorageManager.computeSha256(pdfWithImgPath),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();

    for (const fId of createdFileIds) {
      const rec = await prisma.fileRecord.findUnique({ where: { id: fId } }).catch(() => null);
      if (rec?.storagePath) {
        await StorageManager.unlinkSafe(rec.storagePath).catch(() => {});
      }
    }

    await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    await prisma.fileRecord.deleteMany({ where: { id: { in: createdFileIds } } });
  });

  describe('1. Schema Validation & Defensive Rejection on Invalid Inputs', () => {
    it('should reject request missing fileId with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          operation: 'compress'
        }
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error).toBeDefined();
    });

    it('should reject request with unsupported operation with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'unsupported_operation_xyz'
        }
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent fileId with 404 RESOURCE_NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: 'fil_completely_nonexistent_12345',
          operation: 'compress'
        }
      });

      expect(res.statusCode).toBe(404);
      const json = res.json();
      expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should reject invalid watermark opacity > 1 with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'watermark',
          options: {
            watermarkOpacity: 1.5
          }
        }
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid watermark position with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'watermark',
          options: {
            watermarkPosition: 'random_nowhere'
          }
        }
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('2. API Enqueue Acceptance for All 9 Operations', () => {
    it('POST /api/v1/jobs/pdf (merge) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'merge',
          options: {
            fileIds: [basePdfFileId, secondPdfFileId]
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      expect(json.data.status).toBe('QUEUED');
      expect(json.data.eventsUrl).toContain(json.data.jobId);
      expect(json.data.pollUrl).toContain(json.data.jobId);
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (split) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'split',
          options: {
            pages: '1-2'
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (rotate) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'rotate',
          options: {
            angle: 90
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (images_to_pdf) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: imgFileId,
          operation: 'images_to_pdf',
          options: {
            fileIds: [imgFileId]
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (compress) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'compress',
          options: {
            compressionLevel: 'high'
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (extract_images) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: pdfWithImgFileId,
          operation: 'extract_images'
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (watermark) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'watermark',
          options: {
            watermarkText: 'E2E_WATERMARK',
            watermarkPosition: 'center',
            watermarkOpacity: 0.5,
            pageNumbers: true
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (lock) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'lock',
          options: {
            password: 'secret_e2e_password'
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });

    it('POST /api/v1/jobs/pdf (unlock) should enqueue job and return HTTP 202', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'unlock',
          options: {
            password: 'secret_e2e_password'
          }
        }
      });

      expect(res.statusCode).toBe(202);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      createdJobIds.push(json.data.jobId);
    });
  });

  describe('3. End-to-End Execution, Polling & Artifact Download', () => {
    it('E2E Merge: Enqueue -> Process -> Poll COMPLETED -> Download Merged 5-Page PDF', async () => {
      // 1. Enqueue merge
      const enqueueRes = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: basePdfFileId,
          operation: 'merge',
          options: {
            fileIds: [basePdfFileId, secondPdfFileId]
          }
        }
      });
      expect(enqueueRes.statusCode).toBe(202);
      const { jobId } = enqueueRes.json().data;
      createdJobIds.push(jobId);

      // 2. Execute job via worker
      const artifactId = await processPdfJob({
        jobId,
        fileId: basePdfFileId,
        operation: 'merge',
        options: { fileIds: [basePdfFileId, secondPdfFileId] }
      });
      expect(artifactId).toBeDefined();
      createdFileIds.push(artifactId);

      // 3. Poll job status
      const pollRes = await app.inject({
        method: 'GET',
        url: `/api/v1/jobs/${jobId}`
      });
      expect(pollRes.statusCode).toBe(200);
      const pollJson = pollRes.json();
      expect(pollJson.data.status).toBe('COMPLETED');
      expect(pollJson.data.progress).toBe(100);

      // 4. Download artifact
      const dlRes = await app.inject({
        method: 'GET',
        url: `/api/v1/files/download/${artifactId}`
      });
      expect(dlRes.statusCode).toBe(200);
      expect(dlRes.headers['content-type']).toContain('application/pdf');

      // 5. Verify PDF structure
      const downloadedBytes = dlRes.rawPayload;
      const pdfDoc = await PDFDocument.load(downloadedBytes);
      expect(pdfDoc.getPageCount()).toBe(5);
    });

    it('E2E Extract Images: Enqueue -> Process -> Download ZIP Archive', async () => {
      // 1. Enqueue
      const enqueueRes = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/pdf',
        payload: {
          fileId: pdfWithImgFileId,
          operation: 'extract_images'
        }
      });
      expect(enqueueRes.statusCode).toBe(202);
      const { jobId } = enqueueRes.json().data;
      createdJobIds.push(jobId);

      // 2. Process
      const artifactId = await processPdfJob({
        jobId,
        fileId: pdfWithImgFileId,
        operation: 'extract_images'
      });
      expect(artifactId).toBeDefined();
      createdFileIds.push(artifactId);

      // 3. Download ZIP
      const dlRes = await app.inject({
        method: 'GET',
        url: `/api/v1/files/download/${artifactId}`
      });
      expect(dlRes.statusCode).toBe(200);
      expect(dlRes.headers['content-type']).toContain('application/zip');
      expect(dlRes.headers['content-disposition']).toContain('.zip');

      // 4. Verify ZIP
      const artifactRec = await prisma.fileRecord.findUnique({ where: { id: artifactId } });
      const zip = new StreamZip.async({ file: artifactRec!.storagePath });
      const entries = await zip.entries();
      await zip.close();
      expect(Object.keys(entries).length).toBeGreaterThanOrEqual(1);
    });

    it('E2E Security Round-Trip: Lock Base PDF -> Unlock With Password -> Download Plain PDF', async () => {
      const lockJobId = `job_e2e_lock_${Date.now()}`;
      createdJobIds.push(lockJobId);

      await prisma.job.create({
        data: {
          id: lockJobId,
          type: 'pdf_lock',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: basePdfFileId, operation: 'lock', password: 'RoundTripPassword2026!' })
        }
      });

      const lockedId = await processPdfJob({
        jobId: lockJobId,
        fileId: basePdfFileId,
        operation: 'lock',
        options: { password: 'RoundTripPassword2026!' }
      });
      expect(lockedId).toBeDefined();
      createdFileIds.push(lockedId);

      // Decrypt locked file
      const unlockJobId = `job_e2e_unlock_${Date.now()}`;
      createdJobIds.push(unlockJobId);

      await prisma.job.create({
        data: {
          id: unlockJobId,
          type: 'pdf_unlock',
          status: 'QUEUED',
          progress: 0,
          optionsJson: JSON.stringify({ fileId: lockedId, operation: 'unlock', password: 'RoundTripPassword2026!' })
        }
      });

      const unlockedId = await processPdfJob({
        jobId: unlockJobId,
        fileId: lockedId,
        operation: 'unlock',
        options: { password: 'RoundTripPassword2026!' }
      });
      expect(unlockedId).toBeDefined();
      createdFileIds.push(unlockedId);

      // Verify decrypted file is normal PDF
      const dlRes = await app.inject({
        method: 'GET',
        url: `/api/v1/files/download/${unlockedId}`
      });
      expect(dlRes.statusCode).toBe(200);
      const unlockedDoc = await PDFDocument.load(dlRes.rawPayload);
      expect(unlockedDoc.getPageCount()).toBe(3);
    });

    it('GET /api/v1/jobs/:jobId should return 200 with COMPLETED status and progress 100 for finished job', async () => {
      const completedJobId = `job_e2e_comp_${Date.now()}`;
      createdJobIds.push(completedJobId);

      await prisma.job.create({
        data: {
          id: completedJobId,
          type: 'pdf_compress',
          status: 'COMPLETED',
          progress: 100,
          optionsJson: JSON.stringify({ fileId: basePdfFileId, operation: 'compress' }),
          files: {
            create: {
              id: `fil_comp_art_${Date.now()}`,
              purpose: 'PROCESSED_ARTIFACT',
              originalName: 'base_document_compress.pdf',
              storagePath: basePdfPath,
              mimeType: 'application/pdf',
              sizeBytes: BigInt(100),
              hashSha256: 'abc123',
              isPurged: false,
              expiresAt: new Date(Date.now() + 600_000)
            }
          }
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/jobs/${completedJobId}`
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBe(completedJobId);
      expect(json.data.status).toBe('COMPLETED');
      expect(json.data.progress).toBe(100);
      expect(json.data.files).toBeDefined();
      expect(json.data.files.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/jobs/:jobId/events should return 404 for non-existent job', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/job_missing_12345/events'
      });

      expect(res.statusCode).toBe(404);
      const json = res.json();
      expect(json.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
