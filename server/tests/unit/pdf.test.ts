import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { PDFDocument, PDFName } from 'pdf-lib';
import StreamZip from 'node-stream-zip';
import { prisma } from '../../src/lib/prisma.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { processPdfJob } from '../../src/workers/pdf.worker.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { FileCorruptedError } from '../../src/lib/errors.js';

describe('PDF Worker Unit Tests', () => {
  const fileId = `fil_test_pdf_${Date.now()}`;
  const corruptFileId = `fil_test_corrupt_${Date.now()}`;
  let pdfPath: string;
  let corruptPath: string;
  const createdJobIds: string[] = [];

  beforeAll(async () => {
    await StorageManager.initStorage();

    // Create a valid test PDF document
    const doc = await PDFDocument.create();
    const page1 = doc.addPage([400, 600]);
    page1.drawText('DuyDev Studio PDF Unit Test');
    const page2 = doc.addPage([400, 600]);
    page2.drawText('Second page content');
    doc.setTitle('Original Title');
    const pdfBytes = await doc.save();

    pdfPath = StorageManager.getUploadPath(fileId, '.pdf');
    corruptPath = StorageManager.getUploadPath(corruptFileId, '.pdf');

    await fs.writeFile(pdfPath, Buffer.from(pdfBytes));
    await fs.writeFile(corruptPath, Buffer.from('NOT_A_VALID_PDF_STREAM_CONTENT'));

    await prisma.fileRecord.create({
      data: {
        id: fileId,
        purpose: 'UPLOAD',
        originalName: 'test_doc.pdf',
        storagePath: pdfPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(pdfBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(pdfBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    await prisma.fileRecord.create({
      data: {
        id: corruptFileId,
        purpose: 'UPLOAD',
        originalName: 'corrupt.pdf',
        storagePath: corruptPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(29),
        hashSha256: crypto.createHash('sha256').update('NOT_A_VALID_PDF_STREAM_CONTENT').digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });
  });

  afterAll(async () => {
    await closeTaskQueue();
    await StorageManager.unlinkSafe(pdfPath);
    await StorageManager.unlinkSafe(corruptPath);
    await prisma.job.deleteMany({
      where: { id: { in: createdJobIds } }
    });
    await prisma.fileRecord.deleteMany({
      where: { id: { in: [fileId, corruptFileId] } }
    });
  });

  it('should process PDF compression and create artifact record', async () => {
    const jobId = `job_test_comp_${Date.now()}`;
    createdJobIds.push(jobId);

    await prisma.job.create({
      data: {
        id: jobId,
        type: 'pdf_compress',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'compress' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId,
      fileId,
      operation: 'compress',
      options: { stripMetadata: true }
    });

    expect(resultFileId).toBeDefined();

    // Verify job status
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(job?.progress).toBe(100);

    // Verify artifact file record
    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(artifact?.purpose).toBe('PROCESSED_ARTIFACT');
    expect(existsSync(artifact!.storagePath)).toBe(true);

    // Clean up artifact
    await StorageManager.unlinkSafe(artifact!.storagePath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
  });

  it('should fail gracefully and record FAILED status on corrupted PDF', async () => {
    const jobId = `job_test_corrupt_${Date.now()}`;
    createdJobIds.push(jobId);

    await prisma.job.create({
      data: {
        id: jobId,
        type: 'pdf_compress',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: corruptFileId, operation: 'compress' })
      }
    });

    await expect(
      processPdfJob({
        jobId,
        fileId: corruptFileId,
        operation: 'compress'
      })
    ).rejects.toThrow(FileCorruptedError);

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('FAILED');
    expect(job?.errorMessage).toBeDefined();
  });

  it('should process per-page rotation with custom rotations mapping', async () => {
    const jobId = `job_test_rot_${Date.now()}`;
    createdJobIds.push(jobId);

    await prisma.job.create({
      data: {
        id: jobId,
        type: 'pdf_rotate',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'rotate', rotations: { '0': 90, '1': 180 } })
      }
    });

    const resultFileId = await processPdfJob({
      jobId,
      fileId,
      operation: 'rotate',
      options: { rotations: { '0': 90, '1': 180 } }
    });

    expect(resultFileId).toBeDefined();

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.status).toBe('COMPLETED');

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(existsSync(artifact!.storagePath)).toBe(true);

    // Verify rotated pages using pdf-lib
    const rotatedBytes = await fs.readFile(artifact!.storagePath);
    const rotatedDoc = await PDFDocument.load(rotatedBytes);
    expect(rotatedDoc.getPageCount()).toBe(2);
    expect(rotatedDoc.getPage(0).getRotation().angle).toBe(90);
    expect(rotatedDoc.getPage(1).getRotation().angle).toBe(180);

    // Clean up
    await StorageManager.unlinkSafe(artifact!.storagePath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
  });

  it('should convert images to standard A4 portrait PDF with aspect ratio preservation and centering', async () => {
    const imgJobId = `job_test_img2pdf_${Date.now()}`;
    const imgFileId = `fil_test_img_${Date.now()}`;
    createdJobIds.push(imgJobId);

    const imgPath = StorageManager.getUploadPath(imgFileId, '.png');
    const pythonBin = process.env.PYTHON_BIN || (existsSync('/home/anhduy/dd-studio/engines/document/venv/bin/python3') ? '/home/anhduy/dd-studio/engines/document/venv/bin/python3' : (process.platform === 'win32' ? 'python' : 'python3'));
    execSync(`${pythonBin} -c "import fitz; p = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,400,200), 0); p.save('${imgPath.replace(/\\/g, '/')}')"`);
    const imgStats = await fs.stat(imgPath);

    await prisma.fileRecord.create({
      data: {
        id: imgFileId,
        purpose: 'UPLOAD',
        originalName: 'sample.png',
        storagePath: imgPath,
        mimeType: 'image/png',
        sizeBytes: BigInt(imgStats.size),
        hashSha256: await StorageManager.computeSha256(imgPath),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    await prisma.job.create({
      data: {
        id: imgJobId,
        type: 'pdf_images_to_pdf',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: imgFileId, operation: 'images_to_pdf' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: imgJobId,
      fileId: imgFileId,
      operation: 'images_to_pdf'
    });

    expect(resultFileId).toBeDefined();

    const job = await prisma.job.findUnique({ where: { id: imgJobId } });
    expect(job?.status).toBe('COMPLETED');

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(existsSync(artifact!.storagePath)).toBe(true);

    const pdfBytes = await fs.readFile(artifact!.storagePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(1);
    const page = pdfDoc.getPage(0);
    // Standard A4 portrait: 595 x 842 points
    expect(page.getWidth()).toBe(595);
    expect(page.getHeight()).toBe(842);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await StorageManager.unlinkSafe(imgPath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
    await prisma.fileRecord.delete({ where: { id: imgFileId } });
  });

  it('should apply watermark with position and opacity', async () => {
    const wmJobId = `job_test_wm_${Date.now()}`;
    createdJobIds.push(wmJobId);

    await prisma.job.create({
      data: {
        id: wmJobId,
        type: 'pdf_watermark',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({
          fileId,
          operation: 'watermark',
          watermarkText: 'CONFIDENTIAL',
          watermarkPosition: 'top',
          watermarkOpacity: 0.5,
          pageNumbers: true
        })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: wmJobId,
      fileId,
      operation: 'watermark',
      options: {
        watermarkText: 'CONFIDENTIAL',
        watermarkPosition: 'top',
        watermarkOpacity: 0.5,
        pageNumbers: true
      }
    });

    expect(resultFileId).toBeDefined();

    const job = await prisma.job.findUnique({ where: { id: wmJobId } });
    expect(job?.status).toBe('COMPLETED');

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(existsSync(artifact!.storagePath)).toBe(true);

    const pdfBytes = await fs.readFile(artifact!.storagePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(2);

    // 1. Verify ExtGState dictionary in page resources via pdf-lib DOM
    const page0 = pdfDoc.getPage(0);
    const resources = page0.node.Resources();
    expect(resources).toBeDefined();
    const extGState = resources?.lookup(PDFName.of('ExtGState'));
    expect(extGState).toBeDefined();

    // 2. Verify opacity parameters (/ca and /CA) for watermark (0.5) and page numbers (0.8)
    const extGStateStr = extGState?.toString() || '';
    expect(extGStateStr).toContain('/ca');
    expect(extGStateStr).toContain('/CA');
    expect(extGStateStr).toMatch(/\/(ca|CA)\s*0?\.5/);
    expect(extGStateStr).toMatch(/\/(ca|CA)\s*0?\.8/);

    // 3. Verify ExtGState dictionary exists across document indirect objects
    let hasExtGState = false;
    let hasAlphaParam = false;
    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
      const objStr = obj.toString();
      if (objStr.includes('/ExtGState')) hasExtGState = true;
      if (objStr.includes('/ca') || objStr.includes('/CA')) hasAlphaParam = true;
    }
    expect(hasExtGState).toBe(true);
    expect(hasAlphaParam).toBe(true);

    // 4. Verify raw decompressed PDF byte stream contains ExtGState and opacity
    const rawPdf = pdfBytes.toString('latin1');
    expect(rawPdf).toContain('/ExtGState');
    expect(rawPdf).toMatch(/\/(ca|CA)\s*0?\.5/);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
  });

  it('should protect file size and fallback to original if compression results in equal or larger size', async () => {
    const smallFileId = `fil_test_small_${Date.now()}`;
    const smallJobId = `job_test_fallback_${Date.now()}`;
    createdJobIds.push(smallJobId);

    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const smallBytes = await doc.save();
    const smallPath = StorageManager.getUploadPath(smallFileId, '.pdf');
    await fs.writeFile(smallPath, Buffer.from(smallBytes));

    await prisma.fileRecord.create({
      data: {
        id: smallFileId,
        purpose: 'UPLOAD',
        originalName: 'small.pdf',
        storagePath: smallPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(smallBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(smallBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    await prisma.job.create({
      data: {
        id: smallJobId,
        type: 'pdf_compress',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: smallFileId, operation: 'compress' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: smallJobId,
      fileId: smallFileId,
      operation: 'compress',
      options: { compressionLevel: 'low' }
    });

    expect(resultFileId).toBeDefined();

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    const artifactStats = await fs.stat(artifact!.storagePath);
    // Compression should never exceed original file size due to fallback protection
    expect(artifactStats.size).toBeLessThanOrEqual(smallBytes.byteLength);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await StorageManager.unlinkSafe(smallPath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
    await prisma.fileRecord.delete({ where: { id: smallFileId } });
  });

  it('should correctly classify password error and not shadow it with generic corrupted error', async () => {
    const lockJobId = `job_test_lock_${Date.now()}`;
    createdJobIds.push(lockJobId);

    await prisma.job.create({
      data: {
        id: lockJobId,
        type: 'pdf_lock',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'lock', password: 'test_password_123' })
      }
    });

    const lockedFileId = await processPdfJob({
      jobId: lockJobId,
      fileId,
      operation: 'lock',
      options: { password: 'test_password_123' }
    });

    expect(lockedFileId).toBeDefined();

    const unlockFailJobId = `job_test_unl_fail_${Date.now()}`;
    createdJobIds.push(unlockFailJobId);

    await prisma.job.create({
      data: {
        id: unlockFailJobId,
        type: 'pdf_unlock',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: lockedFileId, operation: 'unlock', password: 'incorrect_pass' })
      }
    });

    let thrownError: any = null;
    try {
      await processPdfJob({
        jobId: unlockFailJobId,
        fileId: lockedFileId,
        operation: 'unlock',
        options: { password: 'incorrect_pass' }
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(FileCorruptedError);
    expect(thrownError.details).toEqual([
      { field: 'password', issue: 'Document requires password for decrypt' }
    ]);

    const failedJob = await prisma.job.findUnique({ where: { id: unlockFailJobId } });
    expect(failedJob?.status).toBe('FAILED');

    const unlockSuccessJobId = `job_test_unl_ok_${Date.now()}`;
    createdJobIds.push(unlockSuccessJobId);

    await prisma.job.create({
      data: {
        id: unlockSuccessJobId,
        type: 'pdf_unlock',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: lockedFileId, operation: 'unlock', password: 'test_password_123' })
      }
    });

    const unlockedFileId = await processPdfJob({
      jobId: unlockSuccessJobId,
      fileId: lockedFileId,
      operation: 'unlock',
      options: { password: 'test_password_123' }
    });

    expect(unlockedFileId).toBeDefined();
    const unlockedArtifact = await prisma.fileRecord.findUnique({ where: { id: unlockedFileId } });
    expect(unlockedArtifact).toBeDefined();
    expect(existsSync(unlockedArtifact!.storagePath)).toBe(true);

    const unlockedBytes = await fs.readFile(unlockedArtifact!.storagePath);
    const unlockedDoc = await PDFDocument.load(unlockedBytes);
    expect(unlockedDoc.getPageCount()).toBe(2);

    const lockedArtifact = await prisma.fileRecord.findUnique({ where: { id: lockedFileId } });
    if (lockedArtifact) {
      await StorageManager.unlinkSafe(lockedArtifact.storagePath);
      await prisma.fileRecord.delete({ where: { id: lockedFileId } });
    }
    await StorageManager.unlinkSafe(unlockedArtifact!.storagePath);
    await prisma.fileRecord.delete({ where: { id: unlockedFileId } });
  });

  it('should merge multiple PDF documents in exact specified order with metadata stripping option', async () => {
    // Create Doc 1 (2 pages)
    const doc1 = await PDFDocument.create();
    const p1_1 = doc1.addPage([400, 600]);
    p1_1.drawText('Doc1 Page 1');
    const p1_2 = doc1.addPage([400, 600]);
    p1_2.drawText('Doc1 Page 2');
    doc1.setTitle('Doc 1 Title');
    const doc1Bytes = await doc1.save();

    // Create Doc 2 (3 pages)
    const doc2 = await PDFDocument.create();
    const p2_1 = doc2.addPage([400, 600]);
    p2_1.drawText('Doc2 Page 1');
    const p2_2 = doc2.addPage([400, 600]);
    p2_2.drawText('Doc2 Page 2');
    const p2_3 = doc2.addPage([400, 600]);
    p2_3.drawText('Doc2 Page 3');
    doc2.setTitle('Doc 2 Title');
    const doc2Bytes = await doc2.save();

    const fId1 = `fil_merge_1_${Date.now()}`;
    const fId2 = `fil_merge_2_${Date.now()}`;
    const pPath1 = StorageManager.getUploadPath(fId1, '.pdf');
    const pPath2 = StorageManager.getUploadPath(fId2, '.pdf');
    await fs.writeFile(pPath1, Buffer.from(doc1Bytes));
    await fs.writeFile(pPath2, Buffer.from(doc2Bytes));

    await prisma.fileRecord.createMany({
      data: [
        {
          id: fId1,
          purpose: 'UPLOAD',
          originalName: 'part1.pdf',
          storagePath: pPath1,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(doc1Bytes.byteLength),
          hashSha256: crypto.createHash('sha256').update(doc1Bytes).digest('hex'),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        },
        {
          id: fId2,
          purpose: 'UPLOAD',
          originalName: 'part2.pdf',
          storagePath: pPath2,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(doc2Bytes.byteLength),
          hashSha256: crypto.createHash('sha256').update(doc2Bytes).digest('hex'),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      ]
    });

    const mergeJobId = `job_test_merge_${Date.now()}`;
    createdJobIds.push(mergeJobId);

    await prisma.job.create({
      data: {
        id: mergeJobId,
        type: 'pdf_merge',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: fId1, operation: 'merge', fileIds: [fId1, fId2], stripMetadata: true })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: mergeJobId,
      fileId: fId1,
      operation: 'merge',
      options: { fileIds: [fId1, fId2], stripMetadata: true }
    });

    expect(resultFileId).toBeDefined();

    const job = await prisma.job.findUnique({ where: { id: mergeJobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(job?.progress).toBe(100);

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(artifact?.purpose).toBe('PROCESSED_ARTIFACT');
    expect(existsSync(artifact!.storagePath)).toBe(true);

    const mergedBytes = await fs.readFile(artifact!.storagePath);
    const mergedDoc = await PDFDocument.load(mergedBytes);
    // 2 pages from doc1 + 3 pages from doc2 = 5 pages total
    expect(mergedDoc.getPageCount()).toBe(5);

    // Clean up
    await StorageManager.unlinkSafe(artifact!.storagePath);
    await StorageManager.unlinkSafe(pPath1);
    await StorageManager.unlinkSafe(pPath2);
    await prisma.fileRecord.deleteMany({ where: { id: { in: [resultFileId, fId1, fId2] } } });
  });

  it('should split multi-page PDF into specific page ranges e.g. "1-2, 4"', async () => {
    // Create a 4-page PDF
    const doc4 = await PDFDocument.create();
    for (let i = 1; i <= 4; i++) {
      const page = doc4.addPage([400, 600]);
      page.drawText(`Page ${i}`);
    }
    const doc4Bytes = await doc4.save();

    const splitFileId = `fil_split_src_${Date.now()}`;
    const splitSrcPath = StorageManager.getUploadPath(splitFileId, '.pdf');
    await fs.writeFile(splitSrcPath, Buffer.from(doc4Bytes));

    await prisma.fileRecord.create({
      data: {
        id: splitFileId,
        purpose: 'UPLOAD',
        originalName: 'four_pages.pdf',
        storagePath: splitSrcPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(doc4Bytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(doc4Bytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    const splitJobId = `job_test_split_${Date.now()}`;
    createdJobIds.push(splitJobId);

    await prisma.job.create({
      data: {
        id: splitJobId,
        type: 'pdf_split',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: splitFileId, operation: 'split', pages: '1-2, 4' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: splitJobId,
      fileId: splitFileId,
      operation: 'split',
      options: { pages: '1-2, 4' }
    });

    expect(resultFileId).toBeDefined();

    const job = await prisma.job.findUnique({ where: { id: splitJobId } });
    expect(job?.status).toBe('COMPLETED');

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(existsSync(artifact!.storagePath)).toBe(true);

    const splitBytes = await fs.readFile(artifact!.storagePath);
    const splitDoc = await PDFDocument.load(splitBytes);
    // Extracted pages 1, 2, and 4 -> exactly 3 pages
    expect(splitDoc.getPageCount()).toBe(3);

    // Negative case: Out-of-bounds page range
    const badJobId = `job_test_split_bad_${Date.now()}`;
    createdJobIds.push(badJobId);
    await prisma.job.create({
      data: {
        id: badJobId,
        type: 'pdf_split',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: splitFileId, operation: 'split', pages: '99-100' })
      }
    });

    await expect(
      processPdfJob({
        jobId: badJobId,
        fileId: splitFileId,
        operation: 'split',
        options: { pages: '99-100' }
      })
    ).rejects.toThrow();

    const badJob = await prisma.job.findUnique({ where: { id: badJobId } });
    expect(badJob?.status).toBe('FAILED');

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await StorageManager.unlinkSafe(splitSrcPath);
    await prisma.fileRecord.deleteMany({ where: { id: { in: [resultFileId, splitFileId] } } });
  });

  it('should extract embedded images to ZIP archive with numbered naming and valid format', async () => {
    // Generate a PDF with 2 embedded images using PyMuPDF
    const extSrcId = `fil_ext_src_${Date.now()}`;
    const extSrcPath = StorageManager.getUploadPath(extSrcId, '.pdf');
    const pythonBin = process.env.PYTHON_BIN || (existsSync('/home/anhduy/dd-studio/engines/document/venv/bin/python3') ? '/home/anhduy/dd-studio/engines/document/venv/bin/python3' : (process.platform === 'win32' ? 'python' : 'python3'));
    execSync(
      `${pythonBin} -c "import fitz; doc = fitz.open(); p1 = doc.new_page(); img1 = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,80,80), 0); p1.insert_image(fitz.Rect(50,50,130,130), pixmap=img1); p2 = doc.new_page(); img2 = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,120,60), 0); p2.insert_image(fitz.Rect(50,50,170,110), pixmap=img2); doc.save('${extSrcPath.replace(/\\/g, '/')}')"`
    );

    const extSrcBytes = await fs.readFile(extSrcPath);
    await prisma.fileRecord.create({
      data: {
        id: extSrcId,
        purpose: 'UPLOAD',
        originalName: 'embedded_images.pdf',
        storagePath: extSrcPath,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(extSrcBytes.byteLength),
        hashSha256: crypto.createHash('sha256').update(extSrcBytes).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000)
      }
    });

    const extJobId = `job_test_ext_${Date.now()}`;
    createdJobIds.push(extJobId);
    await prisma.job.create({
      data: {
        id: extJobId,
        type: 'pdf_extract_images',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: extSrcId, operation: 'extract_images' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: extJobId,
      fileId: extSrcId,
      operation: 'extract_images'
    });

    expect(resultFileId).toBeDefined();

    const job = await prisma.job.findUnique({ where: { id: extJobId } });
    expect(job?.status).toBe('COMPLETED');
    expect(job?.progress).toBe(100);

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(artifact?.mimeType).toBe('application/zip');
    expect(artifact?.originalName).toContain('images.zip');
    expect(existsSync(artifact!.storagePath)).toBe(true);

    // Verify ZIP content using StreamZip
    const zip = new StreamZip.async({ file: artifact!.storagePath });
    const entries = await zip.entries();
    await zip.close();

    const entryNames = Object.keys(entries);
    expect(entryNames.length).toBeGreaterThanOrEqual(2);
    expect(entryNames).toContain('image_001.png');
    expect(entryNames).toContain('image_002.png');
    expect(entries['image_001.png'].size).toBeGreaterThan(0);
    expect(entries['image_002.png'].size).toBeGreaterThan(0);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await StorageManager.unlinkSafe(extSrcPath);
    await prisma.fileRecord.deleteMany({ where: { id: { in: [resultFileId, extSrcId] } } });
  });

  it('should rotate specific pages using single angle and page selector', async () => {
    const rotJobId = `job_test_rot_single_${Date.now()}`;
    createdJobIds.push(rotJobId);

    await prisma.job.create({
      data: {
        id: rotJobId,
        type: 'pdf_rotate',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'rotate', angle: 270, pages: '2' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: rotJobId,
      fileId,
      operation: 'rotate',
      options: { angle: 270, pages: '2' }
    });

    expect(resultFileId).toBeDefined();

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();

    const rotatedBytes = await fs.readFile(artifact!.storagePath);
    const rotatedDoc = await PDFDocument.load(rotatedBytes);
    expect(rotatedDoc.getPageCount()).toBe(2);
    // Page 0 unchanged (0 deg), Page 1 rotated 270 deg
    expect(rotatedDoc.getPage(0).getRotation().angle).toBe(0);
    expect(rotatedDoc.getPage(1).getRotation().angle).toBe(270);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
  });

  it('should convert multiple images into multi-page standard A4 PDF', async () => {
    const imgId1 = `fil_test_mimg1_${Date.now()}`;
    const imgId2 = `fil_test_mimg2_${Date.now()}`;
    const imgPath1 = StorageManager.getUploadPath(imgId1, '.png');
    const imgPath2 = StorageManager.getUploadPath(imgId2, '.png');
    const pythonBin = process.env.PYTHON_BIN || (existsSync('/home/anhduy/dd-studio/engines/document/venv/bin/python3') ? '/home/anhduy/dd-studio/engines/document/venv/bin/python3' : (process.platform === 'win32' ? 'python' : 'python3'));

    execSync(`${pythonBin} -c "import fitz; p = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,300,200), 0); p.save('${imgPath1.replace(/\\/g, '/')}')"`);
    execSync(`${pythonBin} -c "import fitz; p = fitz.Pixmap(fitz.csRGB, fitz.IRect(0,0,200,400), 0); p.save('${imgPath2.replace(/\\/g, '/')}')"`);

    const stats1 = await fs.stat(imgPath1);
    const stats2 = await fs.stat(imgPath2);

    await prisma.fileRecord.createMany({
      data: [
        {
          id: imgId1,
          purpose: 'UPLOAD',
          originalName: 'img1.png',
          storagePath: imgPath1,
          mimeType: 'image/png',
          sizeBytes: BigInt(stats1.size),
          hashSha256: await StorageManager.computeSha256(imgPath1),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        },
        {
          id: imgId2,
          purpose: 'UPLOAD',
          originalName: 'img2.png',
          storagePath: imgPath2,
          mimeType: 'image/png',
          sizeBytes: BigInt(stats2.size),
          hashSha256: await StorageManager.computeSha256(imgPath2),
          isPurged: false,
          expiresAt: new Date(Date.now() + 600_000)
        }
      ]
    });

    const mImgJobId = `job_test_mimg_${Date.now()}`;
    createdJobIds.push(mImgJobId);

    await prisma.job.create({
      data: {
        id: mImgJobId,
        type: 'pdf_images_to_pdf',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId: imgId1, operation: 'images_to_pdf', fileIds: [imgId1, imgId2] })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: mImgJobId,
      fileId: imgId1,
      operation: 'images_to_pdf',
      options: { fileIds: [imgId1, imgId2] }
    });

    expect(resultFileId).toBeDefined();

    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();

    const pdfBytes = await fs.readFile(artifact!.storagePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBe(2);
    expect(pdfDoc.getPage(0).getWidth()).toBe(595);
    expect(pdfDoc.getPage(0).getHeight()).toBe(842);
    expect(pdfDoc.getPage(1).getWidth()).toBe(595);
    expect(pdfDoc.getPage(1).getHeight()).toBe(842);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await StorageManager.unlinkSafe(imgPath1);
    await StorageManager.unlinkSafe(imgPath2);
    await prisma.fileRecord.deleteMany({ where: { id: { in: [resultFileId, imgId1, imgId2] } } });
  });

  it('should apply watermark at center diagonal and bottom positions', async () => {
    // Test center diagonal
    const centerJobId = `job_test_wm_cnt_${Date.now()}`;
    createdJobIds.push(centerJobId);
    await prisma.job.create({
      data: {
        id: centerJobId,
        type: 'pdf_watermark',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'watermark', watermarkText: 'CENTER DRAFT', watermarkPosition: 'center', watermarkOpacity: 0.4 })
      }
    });

    const centerResId = await processPdfJob({
      jobId: centerJobId,
      fileId,
      operation: 'watermark',
      options: { watermarkText: 'CENTER DRAFT', watermarkPosition: 'center', watermarkOpacity: 0.4 }
    });
    expect(centerResId).toBeDefined();
    const centerArt = await prisma.fileRecord.findUnique({ where: { id: centerResId } });
    expect(existsSync(centerArt!.storagePath)).toBe(true);

    // Test bottom position with page numbers
    const bottomJobId = `job_test_wm_btm_${Date.now()}`;
    createdJobIds.push(bottomJobId);
    await prisma.job.create({
      data: {
        id: bottomJobId,
        type: 'pdf_watermark',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'watermark', watermarkText: 'BOTTOM COPY', watermarkPosition: 'bottom', watermarkOpacity: 0.6, pageNumbers: true })
      }
    });

    const bottomResId = await processPdfJob({
      jobId: bottomJobId,
      fileId,
      operation: 'watermark',
      options: { watermarkText: 'BOTTOM COPY', watermarkPosition: 'bottom', watermarkOpacity: 0.6, pageNumbers: true }
    });
    expect(bottomResId).toBeDefined();
    const bottomArt = await prisma.fileRecord.findUnique({ where: { id: bottomResId } });
    expect(existsSync(bottomArt!.storagePath)).toBe(true);

    const btmBytes = await fs.readFile(bottomArt!.storagePath);
    const btmDoc = await PDFDocument.load(btmBytes);
    expect(btmDoc.getPageCount()).toBe(2);

    await StorageManager.unlinkSafe(centerArt!.storagePath);
    await StorageManager.unlinkSafe(bottomArt!.storagePath);
    await prisma.fileRecord.deleteMany({ where: { id: { in: [centerResId, bottomResId] } } });
  });

  it('should process PDF compression at high level with garbage collection and font deflation', async () => {
    const compHighJobId = `job_test_comp_high_${Date.now()}`;
    createdJobIds.push(compHighJobId);

    await prisma.job.create({
      data: {
        id: compHighJobId,
        type: 'pdf_compress',
        status: 'QUEUED',
        progress: 0,
        optionsJson: JSON.stringify({ fileId, operation: 'compress', compressionLevel: 'high' })
      }
    });

    const resultFileId = await processPdfJob({
      jobId: compHighJobId,
      fileId,
      operation: 'compress',
      options: { compressionLevel: 'high' }
    });

    expect(resultFileId).toBeDefined();
    const artifact = await prisma.fileRecord.findUnique({ where: { id: resultFileId } });
    expect(artifact).toBeDefined();
    expect(existsSync(artifact!.storagePath)).toBe(true);

    const resBytes = await fs.readFile(artifact!.storagePath);
    const doc = await PDFDocument.load(resBytes);
    expect(doc.getPageCount()).toBe(2);

    await StorageManager.unlinkSafe(artifact!.storagePath);
    await prisma.fileRecord.delete({ where: { id: resultFileId } });
  });
});

