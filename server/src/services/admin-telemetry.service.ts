/**
 * Admin Telemetry Service - Comprehensive System & Resource Inspector
 * Aggregates OS hardware, disk storage, database, Redis, BullMQ, Cloudflare R2, AI metrics, and traffic telemetry.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { redisConnection, taskQueue, converterQueue, quizQueue } from '../queues/task.queue.js';
import { telemetryTracker } from '../api/middleware/telemetry.middleware.js';
import { aiMetricsService } from './ai-metrics.service.js';
import { R2Service } from './r2.service.js';
import { logger } from '../lib/logger.js';
import { env, resolvedStoragePaths } from '../config/env.config.js';
import { StorageManager } from '../storage/storage.manager.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import type { R2TransitObjectInfo } from './r2.service.js';

/**
 * Normalizes error messages (especially external/foreign/Turkish/Vietnamese raw errors) into standard technical English
 */
export function normalizeErrorMessageToEnglish(rawMsg: string | null | undefined): string {
  if (!rawMsg || !rawMsg.trim()) {
    return 'Unknown error occurred.';
  }
  const trimmed = rawMsg.trim();
  const lower = trimmed.toLowerCase();

  // 1. CairoSVG missing
  if (lower.includes('cairosvg') && (lower.includes('yüklü değil') || lower.includes('yüklü') || lower.includes('not installed'))) {
    return "CairoSVG library is not installed: SVG conversion requires CairoSVG ('pip install cairosvg').";
  }

  // 2. Image conversion error
  if (lower.includes('resim dönüşüm hatası') || lower.includes('resim donusum hatasi') || (lower.includes('resim') && lower.includes('dönüşüm'))) {
    const details = trimmed.split(':').slice(1).join(':').trim();
    return details
      ? `Image conversion error: Failed to process source image (${details}).`
      : 'Image conversion error: Failed to process source image.';
  }

  // 3. FFmpeg encoding error
  if (lower.includes('ffmpeg hatası') || lower.includes('ffmpeg hatasi')) {
    const details = trimmed.split(':').slice(1).join(':').trim();
    return details
      ? `FFmpeg encoding error: Media stream conversion failed (${details}).`
      : 'FFmpeg encoding error: Media stream conversion failed.';
  }

  // 4. Page rendering error
  if (lower.includes('sayfa dönüştürülemedi') || lower.includes('sayfa donusturulemedi')) {
    return 'Page rendering error: Could not convert document page.';
  }

  // 5. File not found
  if (lower.includes('dosya bulunamadı') || lower.includes('dosya bulunamadi')) {
    return 'File not found: Source path does not exist.';
  }

  // 6. Invalid format
  if (lower.includes('geçersiz dosya formatı') || lower.includes('gecersiz dosya formati')) {
    return 'Invalid file format: Unrecognized or unsupported file type.';
  }

  // 7. Out of memory
  if (lower.includes('bellek yetersiz') || lower.includes('yetersiz bellek')) {
    return 'Out of memory: Insufficient RAM for processing.';
  }

  // 8. Timeout
  if (lower.includes('zaman aşımı') || lower.includes('zaman asimi')) {
    return 'Operation timed out: Process exceeded maximum execution time.';
  }

  // 9. Vietnamese error translations
  if (lower.includes('lỗi không xác định')) {
    return 'Unknown error occurred.';
  }
  if (lower.includes('không thể đưa tác vụ') && lower.includes('vào hàng đợi')) {
    return 'Queue failure: Unable to enqueue processing task. Please try again.';
  }
  if (lower.includes('không thể xếp hàng tạo bài tập trắc nghiệm')) {
    return 'Queue failure: Unable to enqueue quiz generation task. Please try again.';
  }

  return trimmed;
}

export interface SemanticErrorDetail {
  category: string;
  rootCauseTitle: string;
  normalizedSummary: string;
  fullErrorSnippet: string;
  signature: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'TIMEOUT' | 'NETWORK';
  suggestedFix: string;
}

/**
 * Smart error signature extractor that extracts the true root cause from tracebacks,
 * normalizes dynamic IDs/numbers, and groups errors by underlying defect.
 */
export function extractSemanticErrorDetails(rawMsg: string | null | undefined, jobType: string): SemanticErrorDetail {
  const trimmed = String(rawMsg || '').trim();
  const lower = trimmed.toLowerCase();

  // Determine High-Level Category from jobType
  let category = 'Universal Converter';
  const jt = (jobType || '').toLowerCase();
  if (jt.includes('pdf')) {
    category = 'PDF Studio Pro';
  } else if (jt.includes('quiz')) {
    category = 'Quiz Generator';
  } else if (jt.includes('convert') || jt.includes('media')) {
    category = 'Universal Converter';
  }

  // 1. CairoSVG Missing
  if (lower.includes('cairosvg')) {
    return {
      category: 'Universal Converter',
      rootCauseTitle: 'CairoSVG Library Missing (Thiếu thư viện CairoSVG)',
      normalizedSummary: "CairoSVG library is not installed: SVG conversion requires CairoSVG ('pip install cairosvg').",
      fullErrorSnippet: trimmed,
      signature: 'converter::cairosvg_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt 'pip install cairosvg' trong môi trường Python của server, hoặc chuyển hướng tệp SVG sang bộ render PyMuPDF/Playwright client-side không phụ thuộc CairoSVG."
    };
  }

  // 2. PyPDF2 Missing
  if (lower.includes('pypdf2')) {
    return {
      category: 'Universal Converter',
      rootCauseTitle: 'PyPDF2 Library Missing (Thiếu thư viện PyPDF2)',
      normalizedSummary: "PyPDF2 is not installed in server Python environment ('pip install PyPDF2').",
      fullErrorSnippet: trimmed,
      signature: 'converter::pypdf2_missing',
      severity: 'CRITICAL',
      suggestedFix: "Chạy 'pip install PyPDF2' trên máy chủ, hoặc refactor các hàm đọc PDF sang PyMuPDF (fitz) có sẵn."
    };
  }

  // 3. LibreOffice / PowerPoint Missing
  if (lower.includes('libreoffice') || lower.includes('powerpoint')) {
    return {
      category: 'Universal Converter',
      rootCauseTitle: 'LibreOffice Missing (Thiếu LibreOffice headless để chuyển đổi tài liệu Office)',
      normalizedSummary: 'Office document conversion requires LibreOffice headless installed and available in PATH.',
      fullErrorSnippet: trimmed,
      signature: 'converter::libreoffice_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt LibreOffice trên máy chủ ('sudo apt install libreoffice-headless libreoffice-writer libreoffice-calc')."
    };
  }

  // 4. pdf2docx Missing
  if (lower.includes('pdf2docx')) {
    return {
      category: 'PDF Studio Pro',
      rootCauseTitle: 'pdf2docx Library Missing (Thiếu thư viện pdf2docx)',
      normalizedSummary: "pdf2docx library is required for PDF to DOCX conversion ('pip install pdf2docx').",
      fullErrorSnippet: trimmed,
      signature: 'pdf::pdf2docx_missing',
      severity: 'CRITICAL',
      suggestedFix: "Cài đặt pdf2docx trong môi trường Python: 'pip install pdf2docx'."
    };
  }

  // 5. Python NameError 'Any'
  if (lower.includes("name 'any' is not defined") || lower.includes("nameerror: name 'any'")) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: "Python NameError: 'Any' Not Defined",
      normalizedSummary: "NameError: name 'Any' is not defined in quiz engine Python script.",
      fullErrorSnippet: trimmed,
      signature: 'quiz::nameerror_any',
      severity: 'ERROR',
      suggestedFix: "Thêm 'from typing import Any' vào đầu file Python bị lỗi (engines/quiz/quiz_pipeline.py hoặc orchestrator)."
    };
  }

  // 6. AttributeError 'DiagnosticLayer'
  if (lower.includes('diagnosticlayer') && lower.includes('reconstruction_failure')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: "Python AttributeError: 'DiagnosticLayer.RECONSTRUCTION_FAILURE' Missing",
      normalizedSummary: "AttributeError: type object 'DiagnosticLayer' has no attribute 'RECONSTRUCTION_FAILURE'.",
      fullErrorSnippet: trimmed,
      signature: 'quiz::diagnostic_layer_reconstruction_failure',
      severity: 'ERROR',
      suggestedFix: "Định nghĩa enum / hằng số RECONSTRUCTION_FAILURE trong class DiagnosticLayer hoặc import đúng module."
    };
  }

  // 7. Agnes AI API Connection / Read Timeout
  if (lower.includes('agnes ai api') || lower.includes('the read operation timed out') || lower.includes('timeouterror')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'Agnes AI API Gateway Timeout / Network Read Timeout',
      normalizedSummary: 'TimeoutError: The read operation timed out while communicating with Agnes AI API.',
      fullErrorSnippet: trimmed,
      signature: 'quiz::agnes_timeout',
      severity: 'TIMEOUT',
      suggestedFix: "Kiểm tra độ trễ mạng đến endpoint Agnes AI, mở rộng timeout (vd: 35s lên 60s) hoặc kích hoạt fallback API Key dự phòng (Gemini/OpenAI)."
    };
  }

  // 8. Google Drive Download Error (HTTP 404 / Private Link)
  if (lower.includes('google drive') || lower.includes('download_gdrive') || lower.includes('gdrive')) {
    return {
      category: 'Quiz / Drive Import',
      rootCauseTitle: 'Google Drive Download Failure (HTTP 404 / Quyền truy cập riêng tư)',
      normalizedSummary: 'Cannot download file from Google Drive: HTTP 404 Not Found or link is not public.',
      fullErrorSnippet: trimmed,
      signature: 'quiz::gdrive_download_404',
      severity: 'NETWORK',
      suggestedFix: "Đảm bảo liên kết Google Drive được bật chia sẻ công khai ('Bất kỳ ai có đường liên kết đều có thể xem') và kiểm tra fileId hợp lệ."
    };
  }

  // 9. Prisma Database Query Error
  if (lower.includes('filerecordwhereuniqueinput') || lower.includes('filerecord.findunique')) {
    return {
      category: 'System Backend',
      rootCauseTitle: 'Prisma Query Error: FileRecord where.id is undefined',
      normalizedSummary: 'Argument where of type FileRecordWhereUniqueInput received undefined id.',
      fullErrorSnippet: trimmed,
      signature: 'backend::prisma_filerecord_undefined',
      severity: 'ERROR',
      suggestedFix: "Kiểm tra logic gọi prisma.fileRecord.findUnique: đảm bảo tham số fileId đã được truyền và khác undefined trước khi query."
    };
  }

  // 10. Question Range Mismatch (Dải câu hỏi không khớp / không đủ câu)
  if (lower.includes('dải câu hỏi') || lower.includes('không thấy đủ số câu') || lower.includes('chưa thấy đủ số câu') || lower.includes('nghía lại số trang')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'Question Count Range Mismatch (Dải câu hỏi trích xuất không khớp)',
      normalizedSummary: 'Extracted question count does not match user requested range. Page numbers or question stems missing.',
      fullErrorSnippet: trimmed,
      signature: 'quiz::question_count_mismatch',
      severity: 'WARNING',
      suggestedFix: "Kiểm tra định dạng đề thi PDF (số câu, thứ tự cột) hoặc kiểm tra lại khoảng trang người dùng đã chỉ định."
    };
  }

  // 11. No Questions Detected on Page
  if (lower.includes('không có câu hỏi trong trang') || lower.includes('không tìm thấy câu hỏi')) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'No Questions Detected on Selected Page (Không tìm thấy câu hỏi trên trang)',
      normalizedSummary: 'No multiple-choice questions found within the selected document pages.',
      fullErrorSnippet: trimmed,
      signature: 'quiz::no_questions_on_page',
      severity: 'WARNING',
      suggestedFix: "Kiểm tra xem trang đã chọn có chứa văn bản thuần hay là trang bìa/mục lục không chứa câu hỏi."
    };
  }

  // 12. Question Option Text Is Empty
  if (lower.includes('has empty text for option') || (lower.includes('câu') && lower.includes('option') && lower.includes('empty'))) {
    return {
      category: 'Quiz Generator',
      rootCauseTitle: 'Question Option Text Empty (Lựa chọn A/B/C/D bị rỗng)',
      normalizedSummary: "Extracted question has empty option text (e.g. Option 'A' is blank).",
      fullErrorSnippet: trimmed,
      signature: 'quiz::empty_option_text',
      severity: 'WARNING',
      suggestedFix: "Cải thiện regex bóc tách phương án lựa chọn trong quiz_pipeline.py đối với các câu hỏi có bảng hoặc hình ảnh đè lên chữ."
    };
  }

  // 13. Execution Timeout (120s / 180s)
  if (lower.includes('vượt quá giới hạn thời gian') || lower.includes('quá hạn') || lower.includes('timed out') || lower.includes('zaman aşımı')) {
    return {
      category,
      rootCauseTitle: 'Worker Execution Timeout (Tác vụ vượt quá giới hạn thời gian)',
      normalizedSummary: 'Operation timed out: Process exceeded maximum execution time watchdog.',
      fullErrorSnippet: trimmed,
      signature: `${category.toLowerCase().replace(/\s+/g, '_')}::timeout`,
      severity: 'TIMEOUT',
      suggestedFix: "Tối ưu hóa thuật toán xử lý hoặc tăng ngưỡng giới hạn watchdog timeout đối với các tệp dung lượng lớn."
    };
  }

  // 14. Fallback: Generic or normalized error
  const normalized = normalizeErrorMessageToEnglish(trimmed);
  const sig = `${category.toLowerCase().replace(/\s+/g, '_')}::${normalized.toLowerCase().slice(0, 50).replace(/[^a-z0-9]/g, '_')}`;
  return {
    category,
    rootCauseTitle: normalized.slice(0, 70),
    normalizedSummary: normalized,
    fullErrorSnippet: trimmed,
    signature: sig,
    severity: 'ERROR',
    suggestedFix: 'Kiểm tra log chi tiết và optionsJson để tái hiện lỗi.'
  };
}

export interface FailedJobItem {
  id: string;
  type: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  options: any;
  optionsRaw: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

export interface DeduplicatedErrorGroup {
  signature: string;
  category: string;
  rootCauseTitle: string;
  normalizedSummary: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'TIMEOUT' | 'NETWORK';
  suggestedFix: string;
  types: Set<string>;
  rawErrors: Set<string>;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  jobIds: string[];
  fileNames: Set<string>;
  sampleOptions: any;
  durationsMs: number[];
}

export interface ErrorExportResult {
  text: string;
  fileName: string;
  totalErrors: number;
  uniqueErrors: number;
  duplicateCount: number;
  reductionPercentage: number;
}

export interface InspectedQueueJob {
  id: string;
  name: string;
  queueName: 'pdf' | 'converter' | 'quiz';
  queueLabel: string;
  status: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed' | 'unknown';
  timestamp: string;
  failedReason: string | null;
  data: any;
  progress: any;
}

export interface InspectedTrashRecord {
  id: string;
  toolId: string;
  toolTitle: string;
  fileName: string;
  originalSize: number;
  resultSize: number;
  resultFileId: string | null;
  downloadUrl: string | null;
  status: string;
  detailsJson: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export interface InspectedSqliteDb {
  files: Array<{ name: string; path: string; sizeBytes: number; sizeFormatted: string; exists: boolean }>;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  tables: {
    users: number;
    jobs: number;
    files: number;
    historyRecords: number;
    dynamicQrs: number;
    qrScanLogs: number;
  };
  pragma: {
    journalMode: string;
    pageSize: number;
    pageCount: number;
    freelistCount: number;
  };
}

export interface StorageInspectedFile {
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  mtime: string;
  birthtime: string;
  ageMs: number;
  originalName: string | null;
  mimeType: string | null;
}

export interface StorageInspectionResult {
  folder: string;
  folderPath: string;
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMb: number;
  files: StorageInspectedFile[];
}

interface FolderSizeInfo {
  sizeBytes: number;
  sizeMb: number;
  fileCount: number;
}

function getFolderStats(dirPath: string): FolderSizeInfo {
  let sizeBytes = 0;
  let fileCount = 0;

  try {
    if (!fs.existsSync(dirPath)) {
      return { sizeBytes: 0, sizeMb: 0, fileCount: 0 };
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          sizeBytes += stat.size;
          fileCount++;
        } else if (entry.isDirectory()) {
          const sub = getFolderStats(fullPath);
          sizeBytes += sub.sizeBytes;
          fileCount += sub.fileCount;
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Ignore folder error
  }

  return {
    sizeBytes,
    sizeMb: Math.round((sizeBytes / (1024 * 1024)) * 10) / 10,
    fileCount
  };
}

export class AdminTelemetryService {
  private static instance: AdminTelemetryService;

  private constructor() {}

  public static getInstance(): AdminTelemetryService {
    if (!AdminTelemetryService.instance) {
      AdminTelemetryService.instance = new AdminTelemetryService();
    }
    return AdminTelemetryService.instance;
  }

  public async getCompleteTelemetry() {
    // 1. Host OS & Hardware Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.min(100, Math.round((usedMem / totalMem) * 100));

    const procMem = process.memoryUsage();
    const procRssMb = Math.round(procMem.rss / (1024 * 1024));
    const procHeapUsedMb = Math.round(procMem.heapUsed / (1024 * 1024));
    const procHeapTotalMb = Math.round(procMem.heapTotal / (1024 * 1024));

    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    const cpuCount = cpus.length;

    // 2. Disk Storage Analysis
    const uploadsStats = getFolderStats(resolvedStoragePaths.uploads);
    const processedStats = getFolderStats(resolvedStoragePaths.processed);
    const tempStats = getFolderStats(resolvedStoragePaths.temp);
    const driveStats = getFolderStats(resolvedStoragePaths.drive);

    const totalStorageBytes = uploadsStats.sizeBytes + processedStats.sizeBytes + tempStats.sizeBytes + driveStats.sizeBytes;
    const totalStorageMb = Math.round((totalStorageBytes / (1024 * 1024)) * 10) / 10;
    const totalStorageFiles = uploadsStats.fileCount + processedStats.fileCount + tempStats.fileCount + driveStats.fileCount;

    // 3. Database (SQLite) & Records
    let dbSizeBytes = 0;
    let dbWalSizeBytes = 0;

    const candidateDbPaths = [
      path.resolve(process.cwd(), 'dev.db'),
      path.resolve(process.cwd(), 'server', 'dev.db'),
      path.resolve(process.cwd(), 'prisma', 'dev.db'),
      path.resolve(process.cwd(), 'server', 'prisma', 'dev.db')
    ];

    for (const p of candidateDbPaths) {
      if (fs.existsSync(p)) {
        try {
          dbSizeBytes = fs.statSync(p).size;
          const walPath = `${p}-wal`;
          if (fs.existsSync(walPath)) {
            dbWalSizeBytes = fs.statSync(walPath).size;
          }
          break;
        } catch {}
      }
    }

    const [jobCount, fileRecordCount, dynamicQrCount, historyCount] = await Promise.all([
      prisma.job.count().catch(() => 0),
      prisma.fileRecord.count().catch(() => 0),
      prisma.dynamicQr.count().catch(() => 0),
      prisma.historyRecord.count().catch(() => 0)
    ]);

    // 4. Redis Memory & Keys
    let redisMemoryHuman = 'N/A';
    let redisKeyCount = 0;
    const isRedisReady = redisConnection.status === 'ready' || redisConnection.status === 'connect';

    if (isRedisReady) {
      try {
        const info = await redisConnection.info('memory').catch(() => '');
        const match = info.match(/used_memory_human:([^\r\n]+)/);
        if (match) redisMemoryHuman = match[1].trim();
        redisKeyCount = await redisConnection.dbsize().catch(() => 0);
      } catch {}
    }

    // 5. BullMQ Queues
    const [
      pdfWaiting, pdfActive, pdfCompleted, pdfFailed,
      convWaiting, convActive, convCompleted, convFailed,
      quizWaiting, quizActive, quizCompleted, quizFailed
    ] = await Promise.all([
      taskQueue.getWaitingCount().catch(() => 0),
      taskQueue.getActiveCount().catch(() => 0),
      taskQueue.getCompletedCount().catch(() => 0),
      taskQueue.getFailedCount().catch(() => 0),
      converterQueue.getWaitingCount().catch(() => 0),
      converterQueue.getActiveCount().catch(() => 0),
      converterQueue.getCompletedCount().catch(() => 0),
      converterQueue.getFailedCount().catch(() => 0),
      quizQueue.getWaitingCount().catch(() => 0),
      quizQueue.getActiveCount().catch(() => 0),
      quizQueue.getCompletedCount().catch(() => 0),
      quizQueue.getFailedCount().catch(() => 0)
    ]);

    // 6. Cloudflare R2
    let r2Metrics: any = null;
    try {
      const r2MetricsPath = path.resolve(process.cwd(), 'data', 'r2_metrics.json');
      if (fs.existsSync(r2MetricsPath)) {
        r2Metrics = JSON.parse(fs.readFileSync(r2MetricsPath, 'utf-8'));
      }
    } catch {}

    // 7. AI Metrics
    const aiData = aiMetricsService.getTelemetryData();

    // 8. Network Traffic Snapshot
    const trafficSnapshot = telemetryTracker.getSnapshot();

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      host: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        loadAverage: [
          Math.round(loadAvg[0] * 100) / 100,
          Math.round(loadAvg[1] * 100) / 100,
          Math.round(loadAvg[2] * 100) / 100
        ],
        cpuCores: cpuCount,
        cpuModel: cpus[0]?.model || 'Generic CPU',
        memory: {
          totalMb: Math.round(totalMem / (1024 * 1024)),
          usedMb: Math.round(usedMem / (1024 * 1024)),
          freeMb: Math.round(freeMem / (1024 * 1024)),
          percent: memPercent
        },
        processMemory: {
          rssMb: procRssMb,
          heapUsedMb: procHeapUsedMb,
          heapTotalMb: procHeapTotalMb
        }
      },
      storage: {
        totalMb: totalStorageMb,
        totalFiles: totalStorageFiles,
        breakdown: {
          uploads: uploadsStats,
          processed: processedStats,
          temp: tempStats,
          drive: driveStats
        },
        database: {
          dbSizeMb: Math.round((dbSizeBytes / (1024 * 1024)) * 100) / 100,
          walSizeMb: Math.round((dbWalSizeBytes / (1024 * 1024)) * 100) / 100,
          records: {
            jobs: jobCount,
            fileRecords: fileRecordCount,
            dynamicQrs: dynamicQrCount,
            history: historyCount
          }
        },
        redis: {
          status: isRedisReady ? 'connected' : 'offline',
          usedMemory: redisMemoryHuman,
          keyCount: redisKeyCount
        }
      },
      queues: {
        pdf: { waiting: pdfWaiting, active: pdfActive, completed: pdfCompleted, failed: pdfFailed },
        converter: { waiting: convWaiting, active: convActive, completed: convCompleted, failed: convFailed },
        quiz: { waiting: quizWaiting, active: quizActive, completed: quizCompleted, failed: quizFailed },
        totalActive: pdfActive + convActive + quizActive,
        totalWaiting: pdfWaiting + convWaiting + quizWaiting
      },
      cloudflare: {
        tunnel: {
          status: 'online',
          protocol: 'http2',
          domain: 'studio.duydev.cloud'
        },
        r2: {
          enabled: env.R2_ENABLED,
          bucket: env.R2_BUCKET_NAME,
          monthlyLimit: env.R2_MAX_MONTHLY_REQUESTS,
          currentRequests: r2Metrics?.class_a_requests || 0,
          percentUsed: Math.min(100, Math.round(((r2Metrics?.class_a_requests || 0) / env.R2_MAX_MONTHLY_REQUESTS) * 100))
        }
      },
      ai: aiData,
      traffic: trafficSnapshot
    };
  }

  public async cleanTempStorage(): Promise<{ cleanedFiles: number; freedMb: number }> {
    const tempDir = resolvedStoragePaths.temp;
    let cleanedFiles = 0;
    let freedBytes = 0;

    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const fullPath = path.join(tempDir, file);
        try {
          const stat = fs.statSync(fullPath);
          freedBytes += stat.size;
          fs.unlinkSync(fullPath);
          cleanedFiles++;
        } catch {}
      }
    }

    return {
      cleanedFiles,
      freedMb: Math.round((freedBytes / (1024 * 1024)) * 100) / 100
    };
  }

  public async cleanQueues(): Promise<{ cleanedJobs: number }> {
    let cleaned = 0;
    try {
      const p1 = await taskQueue.clean(0, 1000, 'completed').catch(() => []);
      const p2 = await taskQueue.clean(0, 1000, 'failed').catch(() => []);
      const c1 = await converterQueue.clean(0, 1000, 'completed').catch(() => []);
      const c2 = await converterQueue.clean(0, 1000, 'failed').catch(() => []);
      const q1 = await quizQueue.clean(0, 1000, 'completed').catch(() => []);
      const q2 = await quizQueue.clean(0, 1000, 'failed').catch(() => []);

      cleaned = (p1?.length || 0) + (p2?.length || 0) + (c1?.length || 0) + (c2?.length || 0) + (q1?.length || 0) + (q2?.length || 0);
    } catch (err) {
      logger.warn({ err }, 'Failed to clean some queue jobs');
    }

    return { cleanedJobs: cleaned };
  }

  public async optimizeDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
      await prisma.$executeRawUnsafe('PRAGMA optimize;');
      return { success: true, message: 'Đã tối ưu hóa và checkpoint SQLite thành công' };
    } catch (err: any) {
      logger.error({ err }, 'Failed to optimize SQLite database');
      return { success: false, message: `Lỗi tối ưu database: ${err?.message || 'Không xác định'}` };
    }
  }

  public async cleanHistoryRecords(): Promise<{ deletedCount: number }> {
    try {
      const res = await prisma.historyRecord.deleteMany({
        where: { isDeleted: true }
      });
      return { deletedCount: res.count };
    } catch (err: any) {
      logger.error({ err }, 'Failed to clean history records');
      return { deletedCount: 0 };
    }
  }

  /**
   * Retrieves detailed list of failed processing jobs with error reasons and payloads
   */
  public async getFailedJobs(limit = 50, type?: string): Promise<FailedJobItem[]> {
    try {
      const jobs = await prisma.job.findMany({
        where: {
          status: 'FAILED',
          ...(type ? { type } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(1, Number(limit) || 50), 100),
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          errorMessage: true,
          optionsJson: true,
          createdAt: true,
          startedAt: true,
          completedAt: true
        }
      });

      return jobs.map(j => {
        let parsedOptions: any = null;
        try {
          parsedOptions = JSON.parse(j.optionsJson);
        } catch {
          parsedOptions = j.optionsJson;
        }

        let durationMs: number | null = null;
        if (j.startedAt && j.completedAt) {
          durationMs = j.completedAt.getTime() - j.startedAt.getTime();
        } else if (j.startedAt) {
          durationMs = Math.max(0, Date.now() - j.startedAt.getTime());
        }

        return {
          id: j.id,
          type: j.type,
          status: j.status,
          progress: j.progress,
          errorMessage: normalizeErrorMessageToEnglish(j.errorMessage),
          options: parsedOptions,
          optionsRaw: j.optionsJson,
          createdAt: j.createdAt.toISOString(),
          startedAt: j.startedAt ? j.startedAt.toISOString() : null,
          completedAt: j.completedAt ? j.completedAt.toISOString() : null,
          durationMs
        };
      });
    } catch (err: any) {
      logger.error({ err }, 'Failed to retrieve failed jobs log');
      return [];
    }
  }

  /**
   * Exports full error logs with deduplication, grouping identical root causes and compiling a detailed TXT audit report.
   */
  public async exportErrorLogsAsText(options: { type?: string; dedupe?: boolean } = {}): Promise<ErrorExportResult> {
    const isDedupe = options.dedupe !== false;
    const typeFilter = options.type;

    // 1. Fetch all failed jobs (up to 5000 records)
    const jobs = await prisma.job.findMany({
      where: {
        status: 'FAILED',
        ...(typeFilter ? { type: typeFilter } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: {
        files: {
          select: {
            originalName: true,
            mimeType: true,
            sizeBytes: true
          }
        }
      }
    });

    const now = new Date();
    const isoString = now.toISOString();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const fileTimestamp = isoString.replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `duydev-studio-error-logs-${fileTimestamp}.txt`;

    // 2. Fetch AI agent failure logs if any
    let failedAiLogs: any[] = [];
    try {
      const aiTelemetry = aiMetricsService.getTelemetryData();
      failedAiLogs = (aiTelemetry.recentLogs || []).filter(
        l => (l.statusCode && l.statusCode >= 400) || l.errorDetails || l.errorMsg
      );
    } catch {}

    const totalErrors = jobs.length;

    // 3. Deduplication Algorithm
    const groupMap = new Map<string, DeduplicatedErrorGroup>();

    for (const j of jobs) {
      const semantic = extractSemanticErrorDetails(j.errorMessage, j.type);
      const signature = isDedupe ? semantic.signature : `job::${j.id}`;

      let parsedOptions: any = null;
      try {
        parsedOptions = JSON.parse(j.optionsJson);
      } catch {
        parsedOptions = j.optionsJson;
      }

      // Extract file names
      const fileNames: string[] = [];
      if (Array.isArray(j.files) && j.files.length > 0) {
        for (const f of j.files) {
          if (f.originalName) fileNames.push(f.originalName);
        }
      }
      if (typeof parsedOptions === 'object' && parsedOptions !== null) {
        const candidate = parsedOptions.fileName || parsedOptions.filename || parsedOptions.name || parsedOptions.file;
        if (candidate && typeof candidate === 'string') {
          fileNames.push(candidate);
        }
      }

      let durationMs: number | null = null;
      if (j.startedAt && j.completedAt) {
        durationMs = j.completedAt.getTime() - j.startedAt.getTime();
      }

      if (!groupMap.has(signature)) {
        groupMap.set(signature, {
          signature,
          category: semantic.category,
          rootCauseTitle: semantic.rootCauseTitle,
          normalizedSummary: semantic.normalizedSummary,
          severity: semantic.severity,
          suggestedFix: semantic.suggestedFix,
          types: new Set(j.type ? [j.type] : []),
          rawErrors: new Set(j.errorMessage ? [j.errorMessage] : []),
          count: 1,
          firstSeen: j.createdAt,
          lastSeen: j.createdAt,
          jobIds: [j.id],
          fileNames: new Set(fileNames),
          sampleOptions: parsedOptions,
          durationsMs: durationMs !== null ? [durationMs] : []
        });
      } else {
        const g = groupMap.get(signature)!;
        g.count++;
        if (j.type) g.types.add(j.type);
        if (j.createdAt < g.firstSeen) g.firstSeen = j.createdAt;
        if (j.createdAt > g.lastSeen) g.lastSeen = j.createdAt;
        g.jobIds.push(j.id);
        if (j.errorMessage) g.rawErrors.add(j.errorMessage);
        for (const fn of fileNames) g.fileNames.add(fn);
        if (durationMs !== null) g.durationsMs.push(durationMs);
        if (!g.sampleOptions && parsedOptions) g.sampleOptions = parsedOptions;
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
    const uniqueErrors = groups.length;
    const duplicateCount = Math.max(0, totalErrors - uniqueErrors);
    const reductionPercentage = totalErrors > 0 ? Math.round((duplicateCount / totalErrors) * 1000) / 10 : 0;

    // Build TXT Document
    const sep100 = '='.repeat(100);
    const sepDash = '-'.repeat(100);
    const lines: string[] = [];

    // Header
    lines.push(sep100);
    lines.push('           DUYDEV STUDIO - SYSTEM ERROR DIAGNOSTICS & AUDIT LOG REPORT');
    lines.push('                     [DEDUPLICATED & CONSOLIDATED LOG EXPORT]');
    lines.push(sep100);
    lines.push(`Generated Date       : ${dateFormatted} (Local Server Time)`);
    lines.push(`ISO Timestamp        : ${isoString}`);
    lines.push(`Server Host          : ${os.hostname()} (${os.platform()} ${os.arch()})`);
    lines.push(`Total Raw Failures   : ${totalErrors} records`);
    lines.push(`Unique Root Causes   : ${uniqueErrors} distinct error signatures`);
    lines.push(`Duplicates Merged    : ${duplicateCount} redundant records eliminated (${reductionPercentage}% noise reduction)`);
    lines.push(`Engine Filter        : ${typeFilter || 'ALL ENGINES (Universal Converter, PDF Studio, Quiz Generator)'}`);
    lines.push(`Deduplication Mode   : ${isDedupe ? 'ENABLED (Grouped by Engine + Normalized Root Cause)' : 'DISABLED'}`);
    lines.push(sep100);
    lines.push('');

    if (totalErrors === 0) {
      lines.push('>>> TRẠNG THÁI HỆ THỐNG HOÀN TOÀN KHỎE MẠNH (ALL SYSTEMS HEALTHY) <<<');
      lines.push('Không có tác vụ nào bị lỗi trong cơ sở dữ liệu. Toàn bộ worker đang hoạt động bình thường.');
      lines.push(sep100);
      return {
        text: lines.join('\n'),
        fileName,
        totalErrors: 0,
        uniqueErrors: 0,
        duplicateCount: 0,
        reductionPercentage: 0
      };
    }

    // Section 1: Bug Triage Summary Table
    lines.push(sepDash);
    lines.push('[1] MỤC LỤC & BẢNG PHÂN LOẠI LỖI (BUG TRIAGE SUMMARY TABLE)');
    lines.push(sepDash);
    lines.push(
      'Index | Engine / Module       | Severity | Count | Share (%) | Root Cause Summary'
    );
    lines.push(
      '------+-----------------------+----------+-------+-----------+---------------------------------------------------'
    );

    groups.forEach((g, idx) => {
      const idxStr = `#${String(idx + 1).padStart(2, '0')}`;
      const engineStr = (g.category || Array.from(g.types)[0] || 'unknown').padEnd(21).slice(0, 21);
      const sevStr = g.severity.padEnd(8).slice(0, 8);
      const countStr = String(g.count).padStart(5);
      const share = totalErrors > 0 ? ((g.count / totalErrors) * 100).toFixed(1) : '0.0';
      const shareStr = `${share}%`.padStart(9);
      const summaryStr = (g.rootCauseTitle || g.normalizedSummary).slice(0, 49);
      lines.push(`${idxStr}   | ${engineStr} | ${sevStr} | ${countStr} | ${shareStr} | ${summaryStr}`);
    });
    lines.push(sepDash);
    lines.push('');

    // Section 2: Actionable Bug Fix Tickets
    lines.push(sepDash);
    lines.push('[2] CHI TIẾT TỪNG PHIẾU LỖI ĐÃ GOM TRÙNG ĐỂ FIX (ACTIONABLE BUG FIX TICKETS)');
    lines.push('    (Được tối ưu cho kỹ sư / lập trình viên kiểm tra nguyên nhân gốc rễ và sửa code)');
    lines.push(sepDash);

    groups.forEach((g, idx) => {
      const share = totalErrors > 0 ? ((g.count / totalErrors) * 100).toFixed(1) : '0.0';
      const avgDuration = g.durationsMs.length > 0
        ? Math.round(g.durationsMs.reduce((a, b) => a + b, 0) / g.durationsMs.length)
        : null;
      const minDuration = g.durationsMs.length > 0 ? Math.min(...g.durationsMs) : null;
      const maxDuration = g.durationsMs.length > 0 ? Math.max(...g.durationsMs) : null;
      const typesList = Array.from(g.types).join(', ') || 'n/a';
      const firstStr = g.firstSeen.toISOString().replace('T', ' ').slice(0, 19);
      const lastStr = g.lastSeen.toISOString().replace('T', ' ').slice(0, 19);

      lines.push('');
      lines.push(sep100);
      lines.push(`[PHIẾU LỖI #${String(idx + 1).padStart(2, '0')} / ${String(uniqueErrors).padStart(2, '0')}] ${g.rootCauseTitle}`);
      lines.push(sepDash);
      lines.push(`* Phân hệ (Engine)    : ${g.category} (Job types: ${typesList})`);
      lines.push(`* Mức độ nghiêm trọng : [${g.severity}]`);
      lines.push(`* Tần suất xuất hiện  : ${g.count} lần (${share}% tổng số lỗi hệ thống)`);
      lines.push(`* Thời điểm ghi nhận  : Từ ${firstStr} đến ${lastStr}`);
      if (avgDuration !== null) {
        lines.push(`* Độ trễ thực thi     : Avg ${avgDuration}ms (Min: ${minDuration}ms, Max: ${maxDuration}ms)`);
      }
      lines.push(`* Tóm tắt lỗi chuẩn   : ${g.normalizedSummary}`);
      lines.push(`* GỢI Ý KHẮC PHỤC     : >>> ${g.suggestedFix} <<<`);

      const filesList = Array.from(g.fileNames);
      if (filesList.length > 0) {
        lines.push(`* Tệp bị ảnh hưởng (${filesList.length}) : ${filesList.slice(0, 12).join(', ')}${filesList.length > 12 ? ` ... (+${filesList.length - 12} tệp khác)` : ''}`);
      }

      lines.push(`* Danh sách Job IDs   : ${g.jobIds.slice(0, 8).map(id => `#${id.slice(0, 12)}`).join(', ')}${g.jobIds.length > 8 ? ` ... (+${g.jobIds.length - 8} jobs khác)` : ''}`);

      if (g.sampleOptions) {
        lines.push('* Tham số mẫu (Input) :');
        try {
          const pretty = JSON.stringify(g.sampleOptions, null, 2)
            .split('\n')
            .map(l => `    ${l}`)
            .join('\n');
          lines.push(pretty);
        } catch {
          lines.push(`    ${String(g.sampleOptions)}`);
        }
      }

      const rawList = Array.from(g.rawErrors);
      if (rawList.length > 0) {
        lines.push('* Chi tiết Traceback / Thông báo lỗi gốc :');
        rawList.slice(0, 3).forEach((raw, rIdx) => {
          const cleanRaw = raw.trim();
          lines.push(`    [Mẫu #${rIdx + 1}] ${cleanRaw.replace(/\n/g, '\n        ')}`);
        });
        if (rawList.length > 3) {
          lines.push(`    ... (+${rawList.length - 3} biến thể lỗi khác có cùng bản chất)`);
        }
      }

      lines.push(sepDash);
    });

    // Section 3: AI Failures (if any)
    if (failedAiLogs.length > 0) {
      lines.push('');
      lines.push(sepDash);
      lines.push('[3] NHẬT KÝ LỖI GỌI AI AGENT / MÔ HÌNH NGÔN NGỮ (AI INVOCATIONS - DEDUPLICATED)');
      lines.push(sepDash);
      lines.push(`Total AI Failures    : ${failedAiLogs.length} calls`);

      const aiMap = new Map<string, { count: number; log: any }>();
      for (const al of failedAiLogs) {
        const sig = `${al.keyName || 'Unknown'}::${al.statusCode || 0}::${al.errorDetails || al.errorMsg || 'Timeout'}`;
        if (!aiMap.has(sig)) {
          aiMap.set(sig, { count: 1, log: al });
        } else {
          aiMap.get(sig)!.count++;
        }
      }

      Array.from(aiMap.values()).forEach((item, aIdx) => {
        lines.push(`\n>>> AI ERROR #${aIdx + 1} (Occurrences: ${item.count}) <<<`);
        lines.push(`Key Name / Provider  : ${item.log.keyName || 'Default'} (${item.log.keyId || 'n/a'})`);
        lines.push(`Status Code          : ${item.log.statusCode || 500}`);
        lines.push(`Latency              : ${item.log.latencyMs || 0}ms`);
        lines.push(`Error Details        : ${item.log.errorDetails || item.log.errorMsg || 'Unknown AI error'}`);
        if (item.log.promptSnippet) {
          lines.push(`Prompt Snippet       : "${item.log.promptSnippet.replace(/\n/g, ' ').slice(0, 120)}..."`);
        }
      });
      lines.push(sepDash);
    }

    // Section 4: Chronological Audit Trail (Sample up to 100 recent entries)
    lines.push('');
    lines.push(sepDash);
    lines.push('[4] NHẬT KÝ TRUY VẾT THEO DÒNG THỜI GIAN (CHRONOLOGICAL EVENT AUDIT TRAIL)');
    lines.push('    (Hiển thị tối đa 100 bản ghi lỗi gần nhất)');
    lines.push(sepDash);

    const recentJobs = jobs.slice(0, 100);
    recentJobs.forEach((rj, rIdx) => {
      const timeStr = rj.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      const durStr = (rj.startedAt && rj.completedAt)
        ? `${((rj.completedAt.getTime() - rj.startedAt.getTime()) / 1000).toFixed(2)}s`
        : '--';
      const cleanErr = normalizeErrorMessageToEnglish(rj.errorMessage);
      lines.push(`[#${String(rIdx + 1).padStart(3, '0')}] ${timeStr} | ${rj.type.padEnd(10)} | ID: ${rj.id} | Duration: ${durStr}`);
      lines.push(`      Lỗi   : ${cleanErr}`);
      lines.push(sepDash);
    });

    lines.push('');
    lines.push(sep100);
    lines.push('END OF DUYDEV STUDIO SYSTEM ERROR AUDIT REPORT');
    lines.push(sep100);

    const fullText = lines.join('\n');

    return {
      text: fullText,
      fileName,
      totalErrors,
      uniqueErrors,
      duplicateCount,
      reductionPercentage
    };
  }

  /**
   * Clears failed jobs from both SQLite database and Redis BullMQ queues
   */
  public async clearFailedJobs(): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    try {
      const res = await prisma.job.deleteMany({
        where: { status: 'FAILED' }
      });
      deletedCount = res.count;

      await Promise.all([
        taskQueue.clean(0, 1000, 'failed').catch(() => []),
        converterQueue.clean(0, 1000, 'failed').catch(() => []),
        quizQueue.clean(0, 1000, 'failed').catch(() => [])
      ]);
    } catch (err: any) {
      logger.error({ err }, 'Failed to clear failed jobs');
    }
    return { deletedCount };
  }

  /**
   * Inspects files physically stored on disk in the specified storage directory
   */
  public async inspectStorageFolder(folderKey: 'temp' | 'uploads' | 'processed' | 'drive'): Promise<StorageInspectionResult> {
    const validFolders = ['temp', 'uploads', 'processed', 'drive'] as const;
    if (!validFolders.includes(folderKey as any)) {
      throw new BadRequestError(`Thư mục không hợp lệ: ${folderKey}. Chỉ chấp nhận: temp, uploads, processed, drive`);
    }

    const targetDir = resolvedStoragePaths[folderKey];
    if (!fs.existsSync(targetDir)) {
      return {
        folder: folderKey,
        folderPath: targetDir,
        totalFiles: 0,
        totalSizeBytes: 0,
        totalSizeMb: 0,
        files: []
      };
    }

    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const fileList: StorageInspectedFile[] = [];
    let totalBytes = 0;

    const candidateFileEntries = entries.filter(e => e.isFile());
    const candidateNames = candidateFileEntries.map(e => e.name);

    // Cross-reference with database FileRecords to fetch original file names and MIME types
    const fileRecords = candidateNames.length > 0 ? await prisma.fileRecord.findMany({
      where: {
        OR: candidateNames.map(name => ({ storagePath: { contains: name } }))
      },
      select: {
        storagePath: true,
        originalName: true,
        mimeType: true
      }
    }).catch(() => []) : [];

    const recordMap = new Map<string, { originalName: string; mimeType: string }>();
    for (const fr of fileRecords) {
      const base = path.basename(fr.storagePath);
      recordMap.set(base, { originalName: fr.originalName, mimeType: fr.mimeType });
    }

    const now = Date.now();
    for (const entry of candidateFileEntries) {
      const fullPath = path.join(targetDir, entry.name);
      try {
        const stat = await fs.promises.stat(fullPath);
        totalBytes += stat.size;
        const match = recordMap.get(entry.name);

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = stat.size === 0 ? 0 : Math.floor(Math.log(stat.size) / Math.log(k));
        const formatted = `${(stat.size / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;

        fileList.push({
          name: entry.name,
          sizeBytes: stat.size,
          sizeFormatted: formatted,
          mtime: stat.mtime.toISOString(),
          birthtime: stat.birthtime.toISOString(),
          ageMs: Math.max(0, now - stat.mtime.getTime()),
          originalName: match?.originalName || null,
          mimeType: match?.mimeType || null
        });
      } catch {
        // Skip unreadable files
      }
    }

    // Sort newest files first
    fileList.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

    return {
      folder: folderKey,
      folderPath: targetDir,
      totalFiles: fileList.length,
      totalSizeBytes: totalBytes,
      totalSizeMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
      files: fileList
    };
  }

  /**
   * Safely deletes an individual physical file from server storage with path traversal guards
   */
  public async deleteStorageFile(
    folderKey: 'temp' | 'uploads' | 'processed' | 'drive',
    fileName: string
  ): Promise<{ success: boolean; fileName: string; freedBytes: number; freedMb: number }> {
    const validFolders = ['temp', 'uploads', 'processed', 'drive'] as const;
    if (!validFolders.includes(folderKey as any)) {
      throw new BadRequestError(`Thư mục không hợp lệ: ${folderKey}`);
    }
    if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName === '..' || fileName === '.') {
      throw new BadRequestError('Tên tệp không hợp lệ');
    }

    const targetDir = resolvedStoragePaths[folderKey];
    const safePath = StorageManager.sanitizeSafePath(targetDir, fileName);

    if (!fs.existsSync(safePath)) {
      throw new NotFoundError(`Không tìm thấy tệp: ${fileName}`);
    }

    const stat = await fs.promises.stat(safePath);
    const freedBytes = stat.size;
    await fs.promises.unlink(safePath);

    // Remove or mark matching fileRecords
    try {
      await prisma.fileRecord.deleteMany({
        where: { storagePath: { contains: fileName } }
      });
    } catch {}

    return {
      success: true,
      fileName,
      freedBytes,
      freedMb: Math.round((freedBytes / (1024 * 1024)) * 100) / 100
    };
  }

  /**
   * Lists objects currently in Cloudflare R2 transit/ prefix
   */
  public async inspectR2Transit(): Promise<{ objects: R2TransitObjectInfo[]; totalCount: number; totalSizeBytes: number; totalSizeFormatted: string }> {
    const objects = await R2Service.listTransitObjects();
    const totalSizeBytes = objects.reduce((acc, o) => acc + o.sizeBytes, 0);
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = totalSizeBytes === 0 ? 0 : Math.floor(Math.log(totalSizeBytes) / Math.log(k));
    const totalSizeFormatted = `${(totalSizeBytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;

    return {
      objects,
      totalCount: objects.length,
      totalSizeBytes,
      totalSizeFormatted
    };
  }

  /**
   * Deletes an individual object from Cloudflare R2 transit/ prefix
   */
  public async deleteR2Object(key: string): Promise<{ success: boolean; key: string }> {
    if (!key || !key.startsWith('transit/')) {
      throw new BadRequestError('Object key không hợp lệ hoặc không nằm trong thư mục transit/');
    }
    const success = await R2Service.deleteTransitObject(key);
    if (!success) {
      throw new BadRequestError(`Không thể xóa object ${key} trên Cloudflare R2`);
    }
    return { success: true, key };
  }

  /**
   * Inspects jobs across BullMQ queues (PDF Studio, Universal Converter, Quiz Generator)
   */
  public async inspectBullMqQueues(): Promise<{ jobs: InspectedQueueJob[]; totalCount: number; countsByQueue: Record<string, number> }> {
    const queueConfigs = [
      { q: taskQueue, name: 'pdf' as const, label: 'PDF Studio' },
      { q: converterQueue, name: 'converter' as const, label: 'Universal Converter' },
      { q: quizQueue, name: 'quiz' as const, label: 'Quiz Generator' }
    ];

    const jobsList: InspectedQueueJob[] = [];
    const countsByQueue: Record<string, number> = { pdf: 0, converter: 0, quiz: 0 };

    for (const { q, name, label } of queueConfigs) {
      try {
        const jobs = await q.getJobs(['active', 'waiting', 'completed', 'failed', 'delayed'], 0, 50, true);
        countsByQueue[name] = jobs.length;
        for (const j of jobs) {
          if (!j) continue;
          const state = await j.getState().catch(() => 'unknown');
          jobsList.push({
            id: String(j.id || ''),
            name: j.name,
            queueName: name,
            queueLabel: label,
            status: state as any,
            timestamp: j.timestamp ? new Date(j.timestamp).toISOString() : new Date().toISOString(),
            failedReason: j.failedReason ? normalizeErrorMessageToEnglish(j.failedReason) : null,
            data: j.data,
            progress: j.progress
          });
        }
      } catch (err) {
        logger.warn({ err, name }, 'Failed to inspect queue jobs');
      }
    }

    // Sort newest jobs first
    jobsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      jobs: jobsList,
      totalCount: jobsList.length,
      countsByQueue
    };
  }

  /**
   * Deletes a single job from a BullMQ queue
   */
  public async deleteQueueJob(queueName: string, jobId: string): Promise<{ success: boolean; queueName: string; jobId: string }> {
    let targetQueue: any = null;
    if (queueName === 'pdf' || queueName === 'ds-tasks') targetQueue = taskQueue;
    else if (queueName === 'converter' || queueName === 'ds-converter-tasks') targetQueue = converterQueue;
    else if (queueName === 'quiz' || queueName === 'ds-quiz-tasks') targetQueue = quizQueue;

    if (!targetQueue) {
      throw new BadRequestError(`Hàng đợi không hợp lệ: ${queueName}. Chỉ chấp nhận: pdf, converter, quiz`);
    }
    const job = await targetQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundError(`Không tìm thấy tác vụ ${jobId} trong hàng đợi ${queueName}`);
    }
    await job.remove();
    return { success: true, queueName, jobId };
  }

  /**
   * Inspects soft-deleted records in SQLite trash (historyRecord with isDeleted: true)
   */
  public async inspectTrashHistory(): Promise<{ records: InspectedTrashRecord[]; totalCount: number }> {
    const trashed = await prisma.historyRecord.findMany({
      where: { isDeleted: true },
      orderBy: { deletedAt: 'desc' },
      take: 200
    });

    const records: InspectedTrashRecord[] = trashed.map(r => ({
      id: r.id,
      toolId: r.toolId,
      toolTitle: r.toolTitle,
      fileName: r.fileName,
      originalSize: Number(r.originalSize || 0),
      resultSize: Number(r.resultSize || 0),
      resultFileId: r.resultFileId,
      downloadUrl: r.downloadUrl,
      status: r.status,
      detailsJson: r.detailsJson,
      isDeleted: r.isDeleted,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString()
    }));

    return {
      records,
      totalCount: records.length
    };
  }

  /**
   * Restores a soft-deleted history record
   */
  public async restoreTrashRecord(id: string): Promise<{ success: boolean; id: string }> {
    const record = await prisma.historyRecord.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundError(`Không tìm thấy bản ghi lịch sử: ${id}`);
    }
    await prisma.historyRecord.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null }
    });
    return { success: true, id };
  }

  /**
   * Permanently deletes a single trash history record
   */
  public async deleteTrashRecord(id: string): Promise<{ success: boolean; id: string }> {
    const record = await prisma.historyRecord.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundError(`Không tìm thấy bản ghi lịch sử: ${id}`);
    }
    await prisma.historyRecord.delete({ where: { id } });
    return { success: true, id };
  }

  /**
   * Inspects SQLite database file sizes, table counts, and PRAGMA settings
   */
  public async inspectSqliteDatabase(): Promise<InspectedSqliteDb> {
    const candidateDirs = [
      path.resolve(process.cwd(), 'server', 'prisma'),
      path.resolve(process.cwd(), 'prisma'),
      path.resolve(process.cwd(), 'server'),
      path.resolve(process.cwd())
    ];

    let chosenDir = candidateDirs[0];
    for (const dir of candidateDirs) {
      const dbPath = path.join(dir, 'dev.db');
      if (fs.existsSync(dbPath)) {
        try {
          const stat = fs.statSync(dbPath);
          if (stat.size > 0) {
            chosenDir = dir;
            break;
          }
        } catch {}
      }
    }

    const candidatePaths = [
      { name: 'dev.db', path: path.join(chosenDir, 'dev.db') },
      { name: 'dev.db-wal', path: path.join(chosenDir, 'dev.db-wal') },
      { name: 'dev.db-shm', path: path.join(chosenDir, 'dev.db-shm') }
    ];

    const files: Array<{ name: string; path: string; sizeBytes: number; sizeFormatted: string; exists: boolean }> = [];
    let totalSizeBytes = 0;

    for (const item of candidatePaths) {
      let size = 0;
      let exists = false;
      try {
        if (fs.existsSync(item.path)) {
          const stat = fs.statSync(item.path);
          size = stat.size;
          exists = true;
          totalSizeBytes += size;
        }
      } catch {}

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(k));
      const sizeFormatted = `${(size / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;

      files.push({
        name: item.name,
        path: item.path,
        sizeBytes: size,
        sizeFormatted,
        exists
      });
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = totalSizeBytes === 0 ? 0 : Math.floor(Math.log(totalSizeBytes) / Math.log(k));
    const totalSizeFormatted = `${(totalSizeBytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] || 'MB'}`;

    // Table counts
    const [users, jobs, fileRecords, historyRecords, dynamicQrs, qrScanLogs] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.job.count().catch(() => 0),
      prisma.fileRecord.count().catch(() => 0),
      prisma.historyRecord.count().catch(() => 0),
      prisma.dynamicQr.count().catch(() => 0),
      prisma.qrScanLog.count().catch(() => 0)
    ]);

    // PRAGMAs
    let journalMode = 'wal';
    let pageSize = 4096;
    let pageCount = 0;
    let freelistCount = 0;

    try {
      const jm: any = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
      if (Array.isArray(jm) && jm[0]?.journal_mode) journalMode = jm[0].journal_mode;

      const ps: any = await prisma.$queryRawUnsafe('PRAGMA page_size;');
      if (Array.isArray(ps) && ps[0]?.page_size) pageSize = Number(ps[0].page_size);

      const pc: any = await prisma.$queryRawUnsafe('PRAGMA page_count;');
      if (Array.isArray(pc) && pc[0]?.page_count) pageCount = Number(pc[0].page_count);

      const fc: any = await prisma.$queryRawUnsafe('PRAGMA freelist_count;');
      if (Array.isArray(fc) && fc[0]?.freelist_count) freelistCount = Number(fc[0].freelist_count);
    } catch (err) {
      logger.warn({ err }, 'Failed to query some SQLite PRAGMA settings');
    }

    return {
      files,
      totalSizeBytes,
      totalSizeFormatted,
      tables: {
        users,
        jobs,
        files: fileRecords,
        historyRecords,
        dynamicQrs,
        qrScanLogs
      },
      pragma: {
        journalMode,
        pageSize,
        pageCount,
        freelistCount
      }
    };
  }
}

export const adminTelemetryService = AdminTelemetryService.getInstance();
