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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QuizJobPayload {
  jobId: string;
  fileId?: string;
  gdriveUrl?: string;
  pages: string;
  count: number;
  startNum: number;
  title: string;
  subtitle?: string;
  prefix: string;
  apiKey?: string;
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

function resolveQuizScript(): string {
  const candidates = [
    path.resolve(process.cwd(), '../engines/quiz/quiz_pipeline.py'),
    path.resolve(process.cwd(), 'engines/quiz/quiz_pipeline.py'),
    path.resolve(__dirname, '../../../../engines/quiz/quiz_pipeline.py'),
    path.resolve(__dirname, '../../../engines/quiz/quiz_pipeline.py'),
    '/home/anhduy/dd-studio/engines/quiz/quiz_pipeline.py'
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

interface PythonProgressEvent {
  progress?: number;
  stage?: string;
  success?: boolean;
  worksheet_pdf?: string;
  answer_pdf?: string;
  worksheet_pages?: number;
  answer_pages?: number;
  questions_count?: number;
  extracted_images_count?: number;
  question_types?: {
    mcq: number;
    true_false: number;
    short_answer: number;
  };
}


function cleanQuizErrorMessage(rawErr: string): string {
  if (!rawErr) return 'Đã xảy ra lỗi không xác định khi tạo bài tập.';
  const lowerErr = rawErr.toLowerCase();
  if (
    lowerErr.includes('không có câu hỏi') ||
    lowerErr.includes('không tìm thấy câu hỏi') ||
    lowerErr.includes('no questions')
  ) {
    return 'Không có câu hỏi trong trang, vui lòng chọn lại.';
  }
  if (lowerErr.includes('không chứa văn bản dạng số/vector') || lowerErr.includes('ảnh scan thuần túy')) {
    return 'Trang đã chọn không chứa văn bản trắc nghiệm. Vui lòng chọn trang có lớp chữ hoặc OCR trước.';
  }
  if (lowerErr.includes('vượt quá tổng số')) {
    const lastLine = rawErr.trim().split('\n').pop() || '';
    return lastLine.replace(/^ValueError:\s*/, '').trim() || lastLine.trim();
  }

  // Strip Python tracebacks if present
  if (rawErr.includes('Traceback (most recent call last):')) {
    const lines = rawErr.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine.includes(':')) {
      const parts = lastLine.split(':');
      const clean = parts.slice(1).join(':').trim();
      if (clean) return clean;
    }
    return lastLine;
  }
  return rawErr.trim();
}

function executeQuizEngine(
  pythonBin: string,
  scriptPath: string,
  args: string[],
  onProgress: (pct: number, stage: string) => Promise<void>
): Promise<PythonProgressEvent> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, ...args]);
    let stderr = '';
    let finalResult: PythonProgressEvent | null = null;
    const pendingPromises: Promise<void>[] = [];

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      try {
        const payload: PythonProgressEvent = JSON.parse(line.trim());
        if (payload.progress !== undefined) {
          const rawStage = payload.stage || 'Đang xử lý đề thi...';
          const cleanStage = rawStage.replace(/Agnes(\s*3\.0\s*Flash)?\s*/gi, '').trim();
          const p = onProgress(payload.progress, cleanStage || 'Đang xử lý đề thi...').catch(() => {});
          pendingPromises.push(p);
        }
        if (payload.success) {
          finalResult = payload;
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
      if (code === 0 && finalResult) return resolve(finalResult);
      if (code === 0) return resolve({ success: true });

      const cleaned = cleanQuizErrorMessage(stderr);
      return reject(new Error(cleaned || `Tiến trình Python gặp lỗi với mã thoát ${code}`));
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export async function processQuizJob(payload: QuizJobPayload): Promise<any> {
  const { jobId, fileId, gdriveUrl, pages, count, startNum, title, subtitle, prefix, apiKey } = payload;
  let isFinished = false;

  try {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const emitProgress = async (pct: number, stage: string) => {
      if (isFinished) return;
      await prisma.job.update({
        where: { id: jobId },
        data: { progress: Math.min(99, Math.max(0, pct)) }
      }).catch(() => {});
      await publishJobEvent(jobId, 'progress', { jobId, percentage: pct, stage });
    };

    let inputSource = gdriveUrl || '';
    let originalSizeBytes = 0;
    if (fileId && typeof fileId === 'string' && fileId.trim() !== '') {
      const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } });
      if (!fileRecord || fileRecord.isPurged) {
        throw new NotFoundError(`Tệp nguồn ${fileId} không tồn tại hoặc đã bị xóa`);
      }
      inputSource = fileRecord.storagePath;
      originalSizeBytes = Number(fileRecord.sizeBytes);
    }

    if (!inputSource) {
      throw new Error('Không tìm thấy nguồn tài liệu đầu vào (fileId hoặc gdriveUrl)');
    }

    const tmpOutputDir = path.resolve(process.cwd(), 'data', 'temp', `quiz_${jobId}`);
    await fs.mkdir(tmpOutputDir, { recursive: true });

    const pythonBin = resolvePythonBin();
    const scriptPath = resolveQuizScript();

    const cleanPrefix = prefix.trim().replace(/[\\/*?:"<>|]/g, '').replace(/\s+/g, '_') || 'quiz';
    const pyArgs = [
      inputSource,
      '--pages', pages,
      '--count', String(count),
      '--start', String(startNum),
      '--title', title || 'BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12',
      '--subtitle', subtitle || '',
      '--prefix', cleanPrefix,
      '--output-dir', tmpOutputDir
    ];

    const effectiveKey = apiKey || process.env.AGNES_AI_API_KEY;
    if (effectiveKey) {
      pyArgs.push('--api-key', effectiveKey);
    }
    if (process.env.AGNES_AI_BASE_URL) {
      pyArgs.push('--base-url', process.env.AGNES_AI_BASE_URL);
    }
    if (process.env.AGNES_AI_MODEL) {
      pyArgs.push('--model', process.env.AGNES_AI_MODEL);
    }

    await emitProgress(5, 'Đang khởi chạy tiến trình trích xuất câu hỏi...');
    const resultMeta = await executeQuizEngine(pythonBin, scriptPath, pyArgs, emitProgress);

    const wsTmpPath = resultMeta.worksheet_pdf || path.join(tmpOutputDir, `${cleanPrefix}_DeBai.pdf`);
    const ansTmpPath = resultMeta.answer_pdf || path.join(tmpOutputDir, `${cleanPrefix}_DapAn.pdf`);

    if (!existsSync(wsTmpPath) || !existsSync(ansTmpPath)) {
      throw new Error('Tệp PDF Đề bài hoặc Đáp án không được tạo ra từ pipeline');
    }

    const wsStats = await fs.stat(wsTmpPath);
    const ansStats = await fs.stat(ansTmpPath);

    const wsFileId = `cuid_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}_ws`;
    const ansFileId = `cuid_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}_ans`;

    const storageRoot = path.resolve(process.cwd(), 'data', 'storage');
    await fs.mkdir(storageRoot, { recursive: true });

    const wsStoragePath = path.join(storageRoot, `${wsFileId}.pdf`);
    const ansStoragePath = path.join(storageRoot, `${ansFileId}.pdf`);

    await fs.copyFile(wsTmpPath, wsStoragePath);
    await fs.copyFile(ansTmpPath, ansStoragePath);

    const wsHash = await StorageManager.computeSha256(wsStoragePath);
    const ansHash = await StorageManager.computeSha256(ansStoragePath);
    const expiresAt = computeExpiresAt();

    const wsFileName = path.basename(wsTmpPath);
    const ansFileName = path.basename(ansTmpPath);

    // Atomic Prisma transaction to register both files
    await prisma.$transaction([
      prisma.fileRecord.create({
        data: {
          id: wsFileId,
          jobId,
          purpose: 'PROCESSED_ARTIFACT',
          originalName: wsFileName,
          storagePath: wsStoragePath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(wsStats.size),
          hashSha256: wsHash,
          isPurged: false,
          expiresAt
        }
      }),
      prisma.fileRecord.create({
        data: {
          id: ansFileId,
          jobId,
          purpose: 'PROCESSED_ARTIFACT',
          originalName: ansFileName,
          storagePath: ansStoragePath,
          mimeType: 'application/pdf',
          sizeBytes: BigInt(ansStats.size),
          hashSha256: ansHash,
          isPurged: false,
          expiresAt
        }
      })
    ]);

    isFinished = true;

    const wsEncodedName = encodeURIComponent(wsFileName);
    const ansEncodedName = encodeURIComponent(ansFileName);

    const resultPayload = {
      jobId,
      percentage: 100,
      worksheet: {
        fileId: wsFileId,
        fileName: wsFileName,
        sizeBytes: wsStats.size,
        pages: resultMeta.worksheet_pages || 1,
        downloadUrl: `/api/v1/files/download/${wsFileId}/${wsEncodedName}?filename=${wsEncodedName}`,
        viewUrl: `/api/v1/files/view/${wsFileId}/${wsEncodedName}`
      },
      answer: {
        fileId: ansFileId,
        fileName: ansFileName,
        sizeBytes: ansStats.size,
        pages: resultMeta.answer_pages || 1,
        downloadUrl: `/api/v1/files/download/${ansFileId}/${ansEncodedName}?filename=${ansEncodedName}`,
        viewUrl: `/api/v1/files/view/${ansFileId}/${ansEncodedName}`
      },
      questionsCount: resultMeta.questions_count || count,
      extractedImagesCount: resultMeta.extracted_images_count || 0,
      questionTypes: resultMeta.question_types || {
        mcq: resultMeta.questions_count || count,
        true_false: 0,
        short_answer: 0
      }
    };


    let currentOptions: Record<string, unknown> = {};
    try {
      const existingJob = await prisma.job.findUnique({ where: { id: jobId } });
      if (existingJob?.optionsJson) {
        currentOptions = JSON.parse(existingJob.optionsJson);
      }
    } catch {}

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        optionsJson: JSON.stringify({
          ...currentOptions,
          result: resultPayload
        })
      }
    });

    // Create TWO separate history records: one for Worksheet PDF and one for Answer PDF
    const [wsHistory, ansHistory] = await Promise.all([
      prisma.historyRecord.create({
        data: {
          toolId: 'quiz-generator',
          toolTitle: 'Tạo Bài Tập Trắc Nghiệm',
          fileName: wsFileName,
          originalSize: BigInt(originalSizeBytes || wsStats.size),
          resultSize: BigInt(wsStats.size),
          resultFileId: wsFileId,
          downloadUrl: `/api/v1/files/download/${wsFileId}/${wsEncodedName}?filename=${wsEncodedName}`,
          status: 'success'
        }
      }).catch((e) => {
        logger.warn({ e }, 'Failed to record worksheet quiz history');
        return null;
      }),
      prisma.historyRecord.create({
        data: {
          toolId: 'quiz-generator',
          toolTitle: 'Tạo Bài Tập Trắc Nghiệm',
          fileName: ansFileName,
          originalSize: BigInt(originalSizeBytes || ansStats.size),
          resultSize: BigInt(ansStats.size),
          resultFileId: ansFileId,
          downloadUrl: `/api/v1/files/download/${ansFileId}/${ansEncodedName}?filename=${ansEncodedName}`,
          status: 'success'
        }
      }).catch((e) => {
        logger.warn({ e }, 'Failed to record answer quiz history');
        return null;
      })
    ]);

    await publishJobEvent(jobId, 'completed', {
      ...resultPayload,
      historyId: wsHistory?.id || null,
      answerHistoryId: ansHistory?.id || null
    });

    // Cleanup temp directory
    try {
      await fs.rm(tmpOutputDir, { recursive: true, force: true });
    } catch {}

    logger.info({ jobId, wsFileId, ansFileId, questionsCount: resultPayload.questionsCount }, 'Quiz job completed successfully');
    return resultPayload;
  } catch (err: unknown) {
    isFinished = true;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const errorMessage = cleanQuizErrorMessage(rawMessage);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage }
    }).catch(() => {});
    await publishJobEvent(jobId, 'failed', {
      jobId,
      error: errorMessage,
      timestamp: Math.floor(Date.now() / 1000)
    });
    logger.error({ jobId, err, errorMessage }, 'Quiz job execution failed');
    throw new Error(errorMessage);
  }
}

let _quizWorkerInstance: Worker<QuizJobPayload> | null = null;

export function getQuizWorker(): Worker<QuizJobPayload> {
  if (!_quizWorkerInstance) {
    _quizWorkerInstance = new Worker<QuizJobPayload>(
      'ds-quiz-tasks',
      async (bullJob: BullJob<QuizJobPayload>) => {
        if (bullJob.name === 'quiz_process') {
          return processQuizJob(bullJob.data);
        }
      },
      { connection: redisConnection, concurrency: limits.workerConcurrency.pdf }
    );
    _quizWorkerInstance.on('error', (err) => {
      logger.warn({ err: err.message }, 'Quiz worker warning/error');
    });
  }
  return _quizWorkerInstance;
}

export async function closeQuizWorker(): Promise<void> {
  if (_quizWorkerInstance) {
    await _quizWorkerInstance.close();
    _quizWorkerInstance = null;
  }
}
