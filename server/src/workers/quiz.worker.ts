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
  duration?: string;
  stylePresetId?: string;
  apiKey?: string;
}

async function downloadGoogleDrivePdf(driveUrl: string, destPath: string): Promise<number> {
  const match =
    driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    driveUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
    driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Đường dẫn Google Drive không hợp lệ hoặc không đúng định dạng');
  }
  const driveId = match[1];
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;

  const res = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) {
    throw new Error('Không thể tải tài liệu từ Google Drive. Vui lòng kiểm tra quyền chia sẻ công khai.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const text = await res.text();
    const confirmMatch =
      text.match(/href="(\/uc\?export=download[^"]+)"/) ||
      text.match(/confirm=([a-zA-Z0-9_-]+)/);
    if (confirmMatch) {
      const confirmUrl = confirmMatch[1].startsWith('http')
        ? confirmMatch[1]
        : `https://drive.google.com${confirmMatch[1].replace(/&amp;/g, '&')}`;
      const res2 = await fetch(confirmUrl);
      if (!res2.ok) {
        throw new Error('Không thể tải tài liệu từ Google Drive sau bước xác nhận.');
      }
      const buffer = Buffer.from(await res2.arrayBuffer());
      await fs.writeFile(destPath, buffer);
      return buffer.length;
    } else {
      throw new Error('Không thể tải tài liệu từ Google Drive. Tệp có thể yêu cầu quyền truy cập hoặc bị giới hạn tải.');
    }
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 100) {
    throw new Error('Tệp tải từ Google Drive quá nhỏ hoặc không hợp lệ.');
  }
  await fs.writeFile(destPath, buffer);
  return buffer.length;
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
    lowerErr.includes('google drive') ||
    lowerErr.includes('drive.google.com')
  ) {
    return 'Không thể tải tài liệu từ Google Drive. Vui lòng kiểm tra quyền chia sẻ công khai (Bất kỳ ai có đường liên kết).';
  }
  if (
    lowerErr.includes('tệp nguồn') &&
    (lowerErr.includes('không tồn tại') || lowerErr.includes('đã bị xóa') || lowerErr.includes('hết hạn'))
  ) {
    return 'Tệp PDF nguồn đã hết hạn hoặc không tồn tại. Vui lòng tải lại tệp.';
  }
  if (
    lowerErr.includes('không có câu hỏi') ||
    lowerErr.includes('không tìm thấy câu hỏi') ||
    lowerErr.includes('no questions')
  ) {
    const pageMatch = rawErr.match(/không\s*(?:có|tìm\s*thấy)\s*câu\s*hỏi\s*trong\s*([^,\.]+)/i);
    if (pageMatch) {
      return `Không có câu hỏi trong ${pageMatch[1].trim()}, vui lòng kiểm tra lại số trang.`;
    }
    return 'Không có câu hỏi trong trang đã chọn, vui lòng kiểm tra lại số trang.';
  }
  if (
    lowerErr.includes('không chứa văn bản') ||
    lowerErr.includes('ảnh scan thuần túy') ||
    lowerErr.includes('ảnh quét')
  ) {
    return 'Trang tài liệu dạng ảnh quét thuần túy không có lớp chữ số. Vui lòng chọn trang có văn bản rõ ràng.';
  }
  if (
    lowerErr.includes('range_mismatch') ||
    lowerErr.includes('không tìm thấy đủ câu hỏi') ||
    lowerErr.includes('tuyệt đối không xuất bản đề thi thiếu câu hỏi')
  ) {
    return 'Dải câu hỏi phát hiện không khớp với yêu cầu của bạn. Vui lòng kiểm tra lại số trang hoặc số câu.';
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
  onProgress: (pct: number, stage: string) => Promise<void>,
  timeoutMs: number = 180000
): Promise<PythonProgressEvent> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, ...args]);
    let stderr = '';
    let finalResult: PythonProgressEvent | null = null;
    const pendingPromises: Promise<void>[] = [];
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {}
        }, 3000);
        reject(new Error('Quá trình xử lý bài tập trắc nghiệm vượt quá giới hạn thời gian (180s)'));
      }
    }, timeoutMs);

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
      clearTimeout(timer);
      if (isSettled) return;
      isSettled = true;
      await Promise.allSettled(pendingPromises);
      if (code === 0 && finalResult) return resolve(finalResult);
      if (code === 0) return resolve({ success: true });

      // Check if stderr contains structured JSON error payload
      try {
        const lines = stderr.trim().split('\n').map((l) => l.trim()).filter(Boolean).reverse();
        for (const line of lines) {
          try {
            const errJson = JSON.parse(line);
            if (errJson && (errJson.error_code || errJson.message)) {
              const customErr: any = new Error(errJson.message || cleanQuizErrorMessage(stderr));
              customErr.errorCode = errJson.error_code || 'INTERNAL_ERROR';
              customErr.diagnosticLayer = errJson.diagnostic_layer || null;
              return reject(customErr);
            }
          } catch {}
        }
      } catch {}

      const cleaned = cleanQuizErrorMessage(stderr);
      return reject(new Error(cleaned || `Tiến trình Python gặp lỗi với mã thoát ${code}`));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (isSettled) return;
      isSettled = true;
      reject(err);
    });
  });
}

export async function processQuizJob(payload: QuizJobPayload): Promise<any> {
  const { jobId, fileId, gdriveUrl, pages, count, startNum, title, subtitle, prefix, duration, stylePresetId, apiKey } = payload;
  let isFinished = false;
  let tmpOutputDir: string | null = null;

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

    tmpOutputDir = path.resolve(process.cwd(), 'data', 'temp', `quiz_${jobId}`);
    await fs.mkdir(tmpOutputDir, { recursive: true });

    let inputSource = '';
    let originalSizeBytes = 0;
    if (fileId && typeof fileId === 'string' && fileId.trim() !== '') {
      const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } });
      if (!fileRecord || fileRecord.isPurged) {
        throw new NotFoundError(`Tệp nguồn ${fileId} không tồn tại hoặc đã bị xóa`);
      }
      inputSource = fileRecord.storagePath;
      originalSizeBytes = Number(fileRecord.sizeBytes);
    } else if (gdriveUrl && typeof gdriveUrl === 'string' && gdriveUrl.trim() !== '') {
      await emitProgress(3, 'Đang tải tệp PDF từ Google Drive...');
      const gdrivePdfPath = path.join(tmpOutputDir, 'gdrive_source.pdf');
      originalSizeBytes = await downloadGoogleDrivePdf(gdriveUrl.trim(), gdrivePdfPath);
      inputSource = gdrivePdfPath;
    }

    if (!inputSource) {
      throw new Error('Không tìm thấy nguồn tài liệu đầu vào (fileId hoặc gdriveUrl)');
    }

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
      '--output-dir', tmpOutputDir,
      '--job-id', jobId
    ];

    if (duration && duration.trim()) {
      pyArgs.push('--duration', duration.trim());
    }

    if (stylePresetId) {
      pyArgs.push('--style', stylePresetId);
    }

    const effectiveKey = (apiKey || process.env.AGNES_AI_API_KEY || '').trim();
    if (effectiveKey) {
      pyArgs.push('--api-key', effectiveKey);
    }
    if (process.env.AGNES_AI_BASE_URL) {
      pyArgs.push('--base-url', process.env.AGNES_AI_BASE_URL.trim());
    }
    if (process.env.AGNES_AI_MODEL) {
      pyArgs.push('--model', process.env.AGNES_AI_MODEL.trim());
    }

    await emitProgress(5, 'Đang khởi chạy tiến trình trích xuất câu hỏi...');
    let resultMeta: PythonProgressEvent;
    try {
      resultMeta = await executeQuizEngine(pythonBin, scriptPath, pyArgs, emitProgress);
    } catch (engineErr) {
      // Defensive recovery: If Python threw an error near completion (e.g. process termination race),
      // check if both output PDF files were already written to disk and are non-empty.
      const wsTmpFallback = path.join(tmpOutputDir, `${cleanPrefix}_DeBai.pdf`);
      const ansTmpFallback = path.join(tmpOutputDir, `${cleanPrefix}_DapAn.pdf`);
      if (existsSync(wsTmpFallback) && existsSync(ansTmpFallback)) {
        const wsS = await fs.stat(wsTmpFallback).catch(() => null);
        const ansS = await fs.stat(ansTmpFallback).catch(() => null);
        if (wsS && wsS.size > 2000 && ansS && ansS.size > 2000) {
          logger.warn({ jobId, engineErr }, 'Recovered quiz output files from disk despite engine exit error');
          resultMeta = {
            success: true,
            worksheet_pdf: wsTmpFallback,
            answer_pdf: ansTmpFallback,
            worksheet_pages: 1,
            answer_pages: 1,
            questions_count: count
          };
        } else {
          throw engineErr;
        }
      } else {
        throw engineErr;
      }
    }

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

    logger.info({ jobId, wsFileId, ansFileId, questionsCount: resultPayload.questionsCount }, 'Quiz job completed successfully');
    return resultPayload;
  } catch (err: unknown) {
    isFinished = true;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const errorMessage = cleanQuizErrorMessage(rawMessage);
    const errorCode = (err as any)?.errorCode || 'INTERNAL_ERROR';
    const diagnosticLayer = (err as any)?.diagnosticLayer || null;
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage }
    }).catch(() => {});
    await publishJobEvent(jobId, 'failed', {
      jobId,
      error: errorMessage,
      errorCode,
      diagnosticLayer,
      timestamp: Math.floor(Date.now() / 1000)
    });
    logger.error({ jobId, err, errorMessage, errorCode, diagnosticLayer }, 'Quiz job execution failed');
    throw new Error(errorMessage);
  } finally {
    if (tmpOutputDir) {
      await fs.rm(tmpOutputDir, { recursive: true, force: true }).catch(() => {});
    }
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
