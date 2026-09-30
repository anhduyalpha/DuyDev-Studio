import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '../../src/lib/prisma.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { processPdfJob } from '../../src/workers/pdf.worker.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { FileCorruptedError } from '../../src/lib/errors.js';

describe('PDF Empirical Challenge Suite (Challenger 1 - M1)', () => {
  const createdJobIds: string[] = [];
  const createdFileIds: string[] = [];

  beforeAll(async () => {
    await StorageManager.initStorage();
  });

  afterAll(async () => {
    await closeTaskQueue();
    for (const jId of createdJobIds) {
      await prisma.job.deleteMany({ where: { id: jId } }).catch(() => {});
    }
    for (const fId of createdFileIds) {
      const f = await prisma.fileRecord.findUnique({ where: { id: fId } }).catch(() => null);
      if (f?.storagePath) {
        await StorageManager.unlinkSafe(f.storagePath).catch(() => {});
      }
      await prisma.fileRecord.deleteMany({ where: { id: fId } }).catch(() => {});
    }
  });

  it('Stress Test 1: images_to_pdf with extreme aspect ratio images (3000x200, 200x3000, 1000x1000, 1x1)', async () => {
    const pythonBin = process.env.PYTHON_BIN || (existsSync('/home/anhduy/dd-studio/engines/document/venv/bin/python3') ? '/home/anhduy/dd-studio/engines/document/venv/bin/python3' : (process.platform === 'win32' ? 'python' : 'python3'));
    const testCases = [
      { name: 'wide.png', w: 3000, h: 200 },
      { name: 'tall.png', w: 200, h: 3000 },
      { name: 'square.png', w: 1000, h: 1000 },
      { name: 'tiny.png', w: 1, h: 1 }
    ];

    const inputPaths: string[] = [];
    for (const tc of testCases) {
      const fId = `fil_stress_${tc.w}x${tc.h}_${Date.now()}`;
      createdFileIds.push(fId);
      const imgPath = StorageManager.getUploadPath(fId, '.png');
      execSync(`${pythonBin} -c "import fitz; p = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,${tc.w},${tc.h}), 0); p.save('${imgPath.replace(/\\/g, '/')}')"`);
      inputPaths.push(imgPath);

      const stats = await fs.stat(imgPath);
      await prisma.fileRecord.create({
        data: {
          id: fId,
          purpose: 'UPLOAD',
          originalName: tc.name,
          storagePath: imgPath,
          mimeType: 'image/png',
          sizeBytes: BigInt(stats.size),
          hashSha256: await StorageManager.computeSha256(imgPath),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      });
    }

    const jobId = `job_stress_img2pdf_${Date.now()}`;
    createdJobIds.push(jobId);
    await prisma.job.create({
      data: {
        id: jobId,
        type: 'pdf_images_to_pdf',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: createdFileIds[0], fileIds: createdFileIds, operation: 'images_to_pdf' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId,
      fileId: createdFileIds[0],
      operation: 'images_to_pdf',
      options: { fileIds: createdFileIds }
    });

    expect(resultFileId).toBeDefined();
    createdFileIds.push(resultFileId);

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(existsSync(artifact!.storagePath)).toBe(true);

    // Verify page dimensions strictly 595x842 pt across all pages using pdf-lib
    const pdfBytes = await fs.readFile(artifact!.storagePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(testCases.length);

    for (let i = 0; i < testCases.length; i++) {
      const page = pdfDoc.getPage(i);
      expect(page.getWidth()).toBe(595);
      expect(page.getHeight()).toBe(842);
    }

    // Verify exact geometry via PyMuPDF inspection
    const inspectScript = `
import pymupdf as fitz
import json
doc = fitz.open('${artifact!.storagePath.replace(/\\/g, '/')}')
PAGE_W, PAGE_H = 595.0, 842.0
results = []
for i, page in enumerate(doc):
    infos = page.get_image_info(xrefs=True)
    bbox = infos[0]['bbox']
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    cx = (bbox[0] + bbox[2]) / 2.0
    cy = (bbox[1] + bbox[3]) / 2.0
    results.append({
        'page': i,
        'bbox': bbox,
        'w': w,
        'h': h,
        'ratio': w / h,
        'cx': cx,
        'cy': cy,
        'centered_x': abs(cx - 297.5) < 0.1,
        'centered_y': abs(cy - 421.0) < 0.1,
        'in_margins': bbox[0] >= 19.99 and bbox[1] >= 19.99 and bbox[2] <= 575.01 and bbox[3] <= 822.01
    })
print(json.dumps(results))
`;
    const inspectRaw = execSync(pythonBin, { input: inspectScript }).toString();
    const lastLine = inspectRaw.trim().split(/\r?\n/).filter((l) => l.trim().startsWith('[')).pop() || '[]';
    const metrics = JSON.parse(lastLine);

    for (let i = 0; i < testCases.length; i++) {
      const m = metrics[i];
      const tc = testCases[i];
      const expectedRatio = tc.w / tc.h;
      expect(m.centered_x).toBe(true);
      expect(m.centered_y).toBe(true);
      expect(m.in_margins).toBe(true);
      expect(Math.abs(m.ratio - expectedRatio) / expectedRatio).toBeLessThan(0.001);
    }
  }, 30000);

  it('Stress Test 2: Watermark positions (center, top, bottom) and opacities (0.0, 0.5, 1.0)', async () => {
    // Create base 1-page PDF
    const baseDoc = await PDFDocument.create();
    baseDoc.addPage([595, 842]);
    const baseBytes = await baseDoc.save();

    const baseFileId = `fil_wm_base_${Date.now()}`;
    createdFileIds.push(baseFileId);
    const basePath = StorageManager.getUploadPath(baseFileId, '.pdf');
    await fs.writeFile(basePath, Buffer.from(baseBytes));

    await prisma.fileRecord.create({
      data: {
        id: baseFileId,
        purpose: 'UPLOAD',
        originalName: 'base.pdf',
        storagePath: basePath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(baseBytes.byteLength),
        hashSha256: await StorageManager.computeSha256(basePath),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    const positions = ['center', 'top', 'bottom'] as const;
    const opacities = [0.0, 0.5, 1.0];

    for (const pos of positions) {
      for (const op of opacities) {
        const jobId = `job_wm_${pos}_${op}_${Date.now()}`;
        createdJobIds.push(jobId);

        await prisma.job.create({
          data: {
            id: jobId,
            type: 'pdf_watermark',
            status: 'QUEUED',
            progress: 0,
            optionsJson: JSON.stringify({
              fileId: baseFileId,
              operation: 'watermark',
              watermarkText: `TEST_${pos.toUpperCase()}`,
              watermarkPosition: pos,
              watermarkOpacity: op,
              pageNumbers: true
            })
          }
        });

        const resFileId = await processPdfJob({
          jobId,
          fileId: baseFileId,
          operation: 'watermark',
          options: {
            watermarkText: `TEST_${pos.toUpperCase()}`,
            watermarkPosition: pos,
            watermarkOpacity: op,
            pageNumbers: true
          }
        });

        expect(resFileId).toBeDefined();
        createdFileIds.push(resFileId);

        const art = await prisma.fileRecord.findUnique({ where: { id: resFileId } });
        expect(art).toBeDefined();
        expect(existsSync(art!.storagePath)).toBe(true);

        const artBytes = await fs.readFile(art!.storagePath);
        const artDoc = await PDFDocument.load(artBytes);
        expect(artDoc.getPageCount()).toBe(1);
      }
    }
  }, 30000);

  it('Stress Test 3: Compress fallback protection with minimal 574-byte PDF', async () => {
    // Create minimal 574-byte PDF that expands under PyMuPDF deflation
    const minDoc = await PDFDocument.create();
    minDoc.addPage([200, 200]);
    const minBytes = await minDoc.save();
    const originalSizeBytes = minBytes.byteLength;
    expect(originalSizeBytes).toBeGreaterThan(0);

    const minFileId = `fil_compress_fallback_${Date.now()}`;
    createdFileIds.push(minFileId);
    const minPath = StorageManager.getUploadPath(minFileId, '.pdf');
    await fs.writeFile(minPath, Buffer.from(minBytes));
    const originalSha256 = await StorageManager.computeSha256(minPath);

    await prisma.fileRecord.create({
      data: {
        id: minFileId,
        purpose: 'UPLOAD',
        originalName: 'minimal.pdf',
        storagePath: minPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(originalSizeBytes),
        hashSha256: originalSha256,
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    const jobId = `job_compress_fallback_${Date.now()}`;
    createdJobIds.push(jobId);

    await prisma.job.create({
      data: {
        id: jobId,
        type: 'pdf_compress',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: minFileId, operation: 'compress' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId,
      fileId: minFileId,
      operation: 'compress',
      options: { compressionLevel: 'low' }
    });

    expect(resultFileId).toBeDefined();
    createdFileIds.push(resultFileId);

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();

    const artifactStats = await fs.stat(artifact!.storagePath);

    // CRITICAL ASSERTION: The output file must not exceed original size.
    // In fact, because PyMuPDF output was 853 bytes (> 574), fallback was triggered:
    // It must be byte-for-byte identical to original 574 bytes!
    expect(artifactStats.size).toBe(originalSizeBytes);
    expect(Number(artifact!.sizeBytes)).toBe(originalSizeBytes);
    expect(artifact!.hashSha256).toBe(originalSha256);

    const artifactBytes = await fs.readFile(artifact!.storagePath);
    expect(Buffer.compare(artifactBytes, Buffer.from(minBytes))).toBe(0);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(job?.progress).toBe(100);
  });
});
