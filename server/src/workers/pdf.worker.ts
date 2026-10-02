import { Worker, Job as BullJob } from 'bullmq';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';
import { redisConnection, publishJobEvent } from '../queues/task.queue.js';
import { limits, computeExpiresAt } from '../config/limits.config.js';
import { prisma } from '../lib/prisma.js';
import { StorageManager } from '../storage/storage.manager.js';
import { logger } from '../lib/logger.js';
import { FileCorruptedError, NotFoundError } from '../lib/errors.js';
import { fileURLToPath } from 'url';
import { PdfJobOptions, PdfOperation } from '../schemas/jobs.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PdfJobPayload {
  jobId: string;
  fileId: string;
  operation: PdfOperation;
  options?: PdfJobOptions;
}

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidateVenvs = [
    '/home/anhduy/dd-studio/engines/document/venv/bin/python',
    '/home/anhduy/dd-studio/engines/document/venv/bin/python3',
    '/home/anhduy/dd-studio/engines/converter/file_conversor_core/venv/bin/python'
  ];
  for (const v of candidateVenvs) {
    if (existsSync(v)) return v;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveEngineScript(): string {
  const candidates = [
    path.resolve(process.cwd(), '../engines/document/pdf_engine.py'),
    path.resolve(process.cwd(), 'engines/document/pdf_engine.py'),
    path.resolve(__dirname, '../../../../engines/document/pdf_engine.py'),
    path.resolve(__dirname, '../../../engines/document/pdf_engine.py'),
    '/home/anhduy/dd-studio/engines/document/pdf_engine.py'
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

function executePythonEngine(
  pythonBin: string,
  scriptPath: string,
  args: string[],
  onProgress: (pct: number, stage: string) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, ...args]);
    let stderr = '';
    const pendingPromises: Promise<void>[] = [];

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      try {
        const payload = JSON.parse(line.trim());
        if (payload.progress !== undefined) {
          const p = onProgress(payload.progress, payload.stage || 'Processing document').catch(() => {});
          pendingPromises.push(p);
        }
      } catch {
        // Non-JSON stdout line
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', async (code) => {
      await Promise.allSettled(pendingPromises);
      if (code === 0) return resolve();
      const lowerErr = stderr.toLowerCase();
      if (['password', 'encrypted', 'mật khẩu', 'mã hóa', 'decrypt', 'authenticate'].some((k) => lowerErr.includes(k))) {
        return reject(new FileCorruptedError('The uploaded PDF structure is invalid or password-protected.', [{ field: 'password', issue: 'Document requires password for decrypt' }]));
      }
      if (['corrupted', 'no pdf header found', 'failed to parse pdf document', 'filedataerror', 'cannot open broken', 'failed to open file', 'pdf engine error'].some((k) => lowerErr.includes(k))) {
        return reject(new FileCorruptedError(`Failed to parse PDF document: ${stderr.trim()}`));
      }
      return reject(new Error(`Python PDF Engine error (exit ${code}): ${stderr.trim()}`));
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export async function processPdfJob(payload: PdfJobPayload): Promise<string> {
  const { jobId, fileId, operation, options } = payload;
  let isFinished = false;

  let lastDbProgressTime = 0;
  let lastDbPercentage = -1;

  const emitProgress = async (percentage: number, stage: string) => {
    if (isFinished) return;
    const now = Date.now();
    if (now - lastDbProgressTime >= 500 || Math.abs(percentage - lastDbPercentage) >= 5 || percentage >= 100) {
      lastDbProgressTime = now;
      lastDbPercentage = percentage;
      try {
        await prisma.job.update({ where: { id: jobId }, data: { progress: percentage, status: 'PROCESSING' } });
      } catch (dbErr) {
        logger.debug({ jobId, dbErr }, 'Progress DB update skipped due to SQLite lock');
      }
    }
    await publishJobEvent(jobId, 'progress', { jobId, percentage, stage, timestamp: Math.floor(now / 1000) });
  };

  try {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'PROCESSING', startedAt: new Date(), progress: 5 } });
    await emitProgress(10, 'Locating uploaded file artifact');
    const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!fileRecord || !existsSync(fileRecord.storagePath)) {
      throw new NotFoundError(`Input file ${fileId} not found on disk`);
    }

    const isExtract = operation === 'extract_images';
    const isDocx = operation === 'pdf_to_docx';
    const outExt = isExtract ? 'zip' : isDocx ? 'docx' : 'pdf';
    const resultFileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const resultPath = StorageManager.getProcessedPath(resultFileId, outExt);
    const pythonBin = resolvePythonBin();
    const scriptPath = resolveEngineScript();

    await emitProgress(15, isDocx ? 'Starting AI-guided PDF to Word pipeline' : 'Dispatching task to Polyglot Python PDF Engine');
    if (operation === 'merge' || operation === 'images_to_pdf') {
      const subcmd = operation === 'images_to_pdf' ? 'images-to-pdf' : 'merge';
      let inputPaths = [fileRecord.storagePath];
      if (options?.fileIds?.length) {
        const records = await prisma.fileRecord.findMany({ where: { id: { in: options.fileIds } } });
        const map = new Map(records.map((r) => [r.id, r.storagePath]));
        const resolved = options.fileIds.map((id) => map.get(id)).filter(Boolean) as string[];
        if (resolved.length) inputPaths = resolved;
      }
      const pyArgs = [subcmd, '--inputs', ...inputPaths, '--output', resultPath];
      if (options?.stripMetadata) pyArgs.push('--strip-metadata');
      await executePythonEngine(pythonBin, scriptPath, pyArgs, emitProgress);
    } else if (isExtract) {
      const tmpDir = StorageManager.getTempPath(`ext_${resultFileId}`, '');
      await executePythonEngine(pythonBin, scriptPath, ['extract-images', '--input', fileRecord.storagePath, '--output-dir', tmpDir], emitProgress);
      const files = await fs.readdir(tmpDir).catch(() => []);
      const items = files.map((f) => ({ filePath: path.join(tmpDir, f), originalName: f }));
      const { ArchiveService } = await import('../services/archive.service.js');
      await ArchiveService.compressFiles(items, resultPath, 'zip', 'normal');
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    } else {
      const subcmd = operation === 'pdf_to_docx' ? 'pdf-to-docx' : operation;
      const pyArgs = [subcmd, '--input', fileRecord.storagePath, '--output', resultPath];
      if (operation === 'compress') {
        pyArgs.push('--level', options?.compressionLevel || 'medium');
        if (options?.targetDpi) pyArgs.push('--dpi', String(options.targetDpi));
      } else if (operation === 'rotate') {
        if (options?.rotations && Object.keys(options.rotations).length > 0) {
          pyArgs.push('--rotations-json', JSON.stringify(options.rotations));
        } else {
          pyArgs.push('--angle', String(options?.angle || 90));
          if (options?.pages) pyArgs.push('--pages', options.pages);
        }
      } else if (operation === 'organize') {
        if (options?.order?.length) {
          pyArgs.push('--pages', JSON.stringify(options.order));
        } else if (options?.pages) {
          pyArgs.push('--pages', options.pages);
        }
        if (options?.rotations && Object.keys(options.rotations).length > 0) {
          pyArgs.push('--rotations', JSON.stringify(options.rotations));
        }
      } else if (operation === 'pdf_to_docx') {
        if (options?.pages) pyArgs.push('--pages', options.pages);
        if (options?.streamTable) pyArgs.push('--stream-table');
        if (options?.forceStreamTable) pyArgs.push('--force-stream-table');
      } else if (operation === 'split' && options?.pages) {
        pyArgs.push('--pages', options.pages);
      } else if (operation === 'watermark') {
        if (options?.watermarkText) pyArgs.push('--text', options.watermarkText);
        if (options?.watermarkPosition) pyArgs.push('--position', options.watermarkPosition);
        if (options?.watermarkOpacity !== undefined) pyArgs.push('--opacity', String(options.watermarkOpacity));
        if (options?.pageNumbers) pyArgs.push('--page-numbers');
      } else if (operation === 'lock' || operation === 'unlock') {
        if (options?.password) pyArgs.push('--password', options.password);
      }
      if (options?.stripMetadata) pyArgs.push('--strip-metadata');
      await executePythonEngine(pythonBin, scriptPath, pyArgs, emitProgress);
    }

    let resultStats = await fs.stat(resultPath);
    let resultSizeBytes = resultStats.size;
    const originalSizeBytes = Number(fileRecord.sizeBytes);

    if (operation === 'compress' && originalSizeBytes > 0 && resultSizeBytes >= originalSizeBytes) {
      logger.info({ jobId, originalSizeBytes, resultSizeBytes }, 'Compressed size is >= original; retaining original file');
      await fs.copyFile(fileRecord.storagePath, resultPath);
      resultStats = await fs.stat(resultPath);
      resultSizeBytes = resultStats.size;
    }

    const hashSha256 = await StorageManager.computeSha256(resultPath);
    const expiresAt = computeExpiresAt();

    const baseName = path.parse(fileRecord.originalName).name;
    const processedFileName = isExtract
      ? `${baseName}_images.zip`
      : isDocx
      ? `${baseName}.docx`
      : `${baseName}_${operation}.pdf`;
    const mimeType = isExtract
      ? 'application/zip'
      : isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';

    await prisma.fileRecord.create({
      data: {
        id: resultFileId, jobId, purpose: 'PROCESSED_ARTIFACT', originalName: processedFileName,
        storagePath: resultPath, mimeType, sizeBytes: BigInt(resultSizeBytes),
        hashSha256, isPurged: false, expiresAt
      }
    });

    isFinished = true;
    await prisma.job.update({ where: { id: jobId }, data: { status: 'COMPLETED', progress: 100, completedAt: new Date() } });

    const savingsPct = originalSizeBytes > 0
      ? Number(Math.max(0, ((originalSizeBytes - resultSizeBytes) / originalSizeBytes) * 100).toFixed(1))
      : 0;
    const downloadUrl = `/api/v1/files/download/${resultFileId}`;

    const historyItem = await prisma.historyRecord.create({
      data: {
        toolId: 'pdf-studio', toolTitle: 'PDF Studio Pro', fileName: processedFileName,
        originalSize: BigInt(originalSizeBytes), resultSize: BigInt(resultSizeBytes),
        resultFileId, downloadUrl, status: 'success'
      }
    }).catch((e) => { logger.warn({ e }, 'Failed to record pdf history'); return null; });

    await publishJobEvent(jobId, 'completed', {
      jobId, percentage: 100, resultFileId, resultFileName: processedFileName,
      resultSizeBytes, originalSizeBytes, savingsPct, downloadUrl, historyId: historyItem?.id || null
    });

    logger.info({ jobId, resultFileId, originalSizeBytes, resultSizeBytes, savingsPct }, 'PDF job completed successfully');
    return resultFileId;
  } catch (err: unknown) {
    isFinished = true;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED', errorMessage } });
    await publishJobEvent(jobId, 'failed', { jobId, error: errorMessage, timestamp: Math.floor(Date.now() / 1000) });
    logger.error({ jobId, err }, 'PDF job execution failed');
    throw err;
  }
}

let _workerInstance: Worker<PdfJobPayload> | null = null;

export function getPdfWorker(): Worker<PdfJobPayload> {
  if (!_workerInstance) {
    _workerInstance = new Worker<PdfJobPayload>(
      'ds-tasks',
      async (bullJob: BullJob<PdfJobPayload>) => {
        if (bullJob.name === 'pdf_process') {
          return processPdfJob(bullJob.data);
        }
      },
      { connection: redisConnection, concurrency: limits.workerConcurrency.pdf }
    );
    _workerInstance.on('error', (err) => { logger.warn({ err: err.message }, 'PDF worker warning/error'); });
  }
  return _workerInstance;
}

export async function closePdfWorker(): Promise<void> {
  if (_workerInstance) {
    await _workerInstance.close();
    _workerInstance = null;
  }
}
