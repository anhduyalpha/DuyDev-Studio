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
import { env } from '../config/env.config.js';

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
    const storageRoot = path.resolve(process.cwd(), env.STORAGE_ROOT);
    const uploadsStats = getFolderStats(path.join(storageRoot, 'uploads'));
    const processedStats = getFolderStats(path.join(storageRoot, 'processed'));
    const tempStats = getFolderStats(path.join(storageRoot, 'temp'));
    const driveStats = getFolderStats(path.join(storageRoot, 'drive'));

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
    const storageRoot = path.resolve(process.cwd(), env.STORAGE_ROOT);
    const tempDir = path.join(storageRoot, 'temp');
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
}

export const adminTelemetryService = AdminTelemetryService.getInstance();
