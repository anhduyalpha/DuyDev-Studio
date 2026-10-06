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
import { resolvedStoragePaths } from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';
import { fileURLToPath } from 'url';
import { ConverterJobPayload, getMimeTypeForExt } from '../schemas/converter.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const homeserverVenv = '/home/anhduy/dd-studio/engines/document/venv/bin/python3';
  return existsSync(homeserverVenv) ? homeserverVenv : (process.platform === 'win32' ? 'python' : 'python3');
}

function resolveCliScript(): string {
  const candidates = [
    path.resolve(process.cwd(), 'engines/converter/convert_cli.py'),
    path.resolve(process.cwd(), '../engines/converter/convert_cli.py'),
    path.resolve(__dirname, '../../../../engines/converter/convert_cli.py'),
    path.resolve(__dirname, '../../../engines/converter/convert_cli.py'),
    '/home/anhduy/dd-studio/engines/converter/convert_cli.py'
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

interface CliResult {
  success: boolean;
  output_path?: string;
  filename?: string;
  error?: string;
}

function executeConverterCli(
  pythonBin: string,
  scriptPath: string,
  args: string[],
  onProgress: (pct: number, stage: string) => Promise<void>
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, ...args]);
    let stderr = '';
    let parsedResult: CliResult | null = null;
    const pendingPromises: Promise<void>[] = [];

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      try {
        const payload = JSON.parse(line.trim());
        if (payload.progress !== undefined) {
          pendingPromises.push(onProgress(payload.progress, payload.stage || 'Converting file').catch(() => {}));
        }
        if (payload.success !== undefined) parsedResult = payload as CliResult;
      } catch {}
    });

    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('close', async (code) => {
      await Promise.allSettled(pendingPromises);
      if (code === 0 && parsedResult?.success) resolve(parsedResult);
      else reject(new Error(parsedResult?.error || stderr.trim() || `Converter engine error (exit ${code})`));
    });
    child.on('error', (err) => reject(err));
  });
}

export async function processConverterJob(payload: ConverterJobPayload): Promise<string> {
  const { jobId, fileId, targetFormat, options } = payload;
  const startTime = Date.now();
  let isFinished = false;

  const safeConverterJobUpdate = async (data: Record<string, any>) => {
    try {
      await prisma.job.upsert({
        where: { id: jobId },
        create: {
          id: jobId,
          type: 'converter_process',
          status: data.status || 'PROCESSING',
          progress: data.progress ?? 0,
          startedAt: data.startedAt || new Date(),
          optionsJson: data.optionsJson || '{}'
        },
        update: data
      });
    } catch (dbErr) {
      logger.debug({ jobId, dbErr }, 'safeConverterJobUpdate skipped');
    }
  };

  let lastDbProgressTime = 0;
  let lastDbPercentage = -1;

  const emitProgress = async (percentage: number, stage: string) => {
    if (isFinished) return;
    const now = Date.now();
    if (now - lastDbProgressTime >= 500 || Math.abs(percentage - lastDbPercentage) >= 5 || percentage >= 100) {
      lastDbProgressTime = now;
      lastDbPercentage = percentage;
      await safeConverterJobUpdate({ progress: percentage, status: 'PROCESSING' });
    }
    await publishJobEvent(jobId, 'progress', { jobId, percentage, stage, timestamp: Math.floor(now / 1000) });
  };

  try {
    await safeConverterJobUpdate({ status: 'PROCESSING', startedAt: new Date(), progress: 5 });
    await emitProgress(10, 'Locating uploaded file artifact');

    const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } });
    if (!fileRecord || !existsSync(fileRecord.storagePath)) {
      throw new NotFoundError(`Input file ${fileId} not found on disk`);
    }

    const processedDir = resolvedStoragePaths.processed;
    await fs.mkdir(processedDir, { recursive: true });

    let qualityArg = 'high';
    if (options?.quality !== undefined) {
      if (typeof options.quality === 'number') {
        qualityArg = options.quality >= 80 ? 'high' : options.quality >= 50 ? 'medium' : 'low';
      } else if (typeof options.quality === 'string') {
        qualityArg = options.quality.toLowerCase();
      }
    }

    const pyArgs = ['--input', fileRecord.storagePath, '--target', targetFormat, '--output-dir', processedDir, '--quality', qualityArg];
    await emitProgress(20, 'Invoking Python Converter Bridge');
    const cliResult = await executeConverterCli(resolvePythonBin(), resolveCliScript(), pyArgs, emitProgress);

    const outputPath = cliResult.output_path || path.join(processedDir, `${path.parse(fileRecord.originalName).name}.${targetFormat}`);
    const resultStats = await fs.stat(outputPath);
    const resultSizeBytes = resultStats.size;
    const originalSizeBytes = Number(fileRecord.sizeBytes);
    const hashSha256 = await StorageManager.computeSha256(outputPath);
    const expiresAt = computeExpiresAt();

    const resultFileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const baseName = path.parse(fileRecord.originalName).name || 'converted_file';
    const resultFileName = `${baseName}.${targetFormat}`;

    const finalOutputPath = path.join(processedDir, `${resultFileId}.${targetFormat}`);
    if (existsSync(outputPath) && outputPath !== finalOutputPath) {
      await fs.rename(outputPath, finalOutputPath).catch(() => {});
    }
    const finalStoredPath = existsSync(finalOutputPath) ? finalOutputPath : outputPath;

    await prisma.fileRecord.create({
      data: {
        id: resultFileId,
        jobId,
        purpose: 'PROCESSED_ARTIFACT',
        originalName: resultFileName,
        storagePath: finalStoredPath,
        mimeType: getMimeTypeForExt(targetFormat),
        sizeBytes: BigInt(resultSizeBytes),
        hashSha256,
        isPurged: false,
        expiresAt
      }
    });

    isFinished = true;
    await safeConverterJobUpdate({ status: 'COMPLETED', progress: 100, completedAt: new Date() });

    const savingsPct = originalSizeBytes > 0
      ? Number(Math.max(0, ((originalSizeBytes - resultSizeBytes) / originalSizeBytes) * 100).toFixed(1))
      : 0;
    const downloadUrl = `/api/v1/files/download/${resultFileId}`;

    const historyItem = await prisma.historyRecord.create({
      data: {
        toolId: 'universal-converter',
        toolTitle: 'File Converter Pro',
        fileName: resultFileName,
        originalSize: BigInt(originalSizeBytes),
        resultSize: BigInt(resultSizeBytes),
        resultFileId,
        downloadUrl,
        status: 'success'
      }
    }).catch(e => {
      logger.warn({ e }, 'Failed to record converter history');
      return null;
    });

    await publishJobEvent(jobId, 'completed', {
      jobId,
      percentage: 100,
      resultFileId,
      resultFileName,
      resultSizeBytes,
      originalSizeBytes,
      savingsPct,
      downloadUrl,
      historyId: historyItem?.id || null,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    });

    logger.info({ jobId, resultFileId, originalSizeBytes, resultSizeBytes }, 'Converter job completed successfully');
    return resultFileId;
  } catch (err: unknown) {
    isFinished = true;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await safeConverterJobUpdate({ status: 'FAILED', errorMessage });
    await publishJobEvent(jobId, 'failed', { jobId, error: errorMessage, timestamp: Math.floor(Date.now() / 1000) });
    logger.error({ jobId, err }, 'Converter job execution failed');
    throw err;
  }
}

let _converterWorkerInstance: Worker<ConverterJobPayload> | null = null;

export function getConverterWorker(): Worker<ConverterJobPayload> {
  if (!_converterWorkerInstance) {
    _converterWorkerInstance = new Worker<ConverterJobPayload>(
      'ds-converter-tasks',
      async (bullJob: BullJob<ConverterJobPayload>) => processConverterJob(bullJob.data),
      { connection: redisConnection, concurrency: limits.workerConcurrency.media || 2 }
    );
    _converterWorkerInstance.on('error', (err) => { logger.warn({ err: err.message }, 'Converter worker error'); });
  }
  return _converterWorkerInstance;
}

export async function closeConverterWorker(): Promise<void> {
  if (_converterWorkerInstance) {
    await _converterWorkerInstance.close();
    _converterWorkerInstance = null;
  }
}
