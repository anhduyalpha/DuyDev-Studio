import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { StorageManager } from '../storage/storage.manager.js';
import { limits, isPermanentRetention } from '../config/limits.config.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { R2Service } from './r2.service.js';

export interface JanitorPurgeResult {
  purgedCount: number;
  reclaimedBytes: number;
  errorsCount: number;
}

export class JanitorService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Cleans up orphaned chunk directories in temp/chunks older than 2 hours
   */
  static async cleanupOrphanedChunks(): Promise<number> {
    const chunksBaseDir = path.join(resolvedStoragePaths.temp, 'chunks');
    if (!existsSync(chunksBaseDir)) return 0;

    let purgedCount = 0;
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000;

    try {
      const entries = await fs.readdir(chunksBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const chunkDirPath = path.join(chunksBaseDir, entry.name);
          try {
            const stats = await fs.stat(chunkDirPath);
            if (stats.mtimeMs < twoHoursAgo) {
              await fs.rm(chunkDirPath, { recursive: true, force: true });
              purgedCount++;
              logger.info({ chunkDirPath }, 'Janitor: Purged orphaned chunk directory');
            }
          } catch (err) {
            logger.warn({ chunkDirPath, err }, 'Janitor: Failed to stat/rm chunk directory');
          }
        }
      }
    } catch (err) {
      logger.warn({ chunksBaseDir, err }, 'Janitor: Failed to read chunks directory');
    }
    return purgedCount;
  }

  /**
   * Removes quiz pipeline cache entries (extract + AI batch) older than 7 days
   */
  static async cleanupQuizCache(): Promise<number> {
    const defaultCacheDir = existsSync(path.resolve(process.cwd(), 'data', 'cache', 'quiz'))
      ? path.resolve(process.cwd(), 'data', 'cache', 'quiz')
      : (existsSync(path.resolve(process.cwd(), '..', 'data', 'cache', 'quiz'))
        ? path.resolve(process.cwd(), '..', 'data', 'cache', 'quiz')
        : path.resolve(process.cwd(), 'data', 'cache', 'quiz'));

    const cacheDir = process.env.QUIZ_CACHE_DIR ? path.resolve(process.env.QUIZ_CACHE_DIR) : defaultCacheDir;
    if (!existsSync(cacheDir)) return 0;

    let purgedCount = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;

    try {
      const entries = await fs.readdir(cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        const itemPath = path.join(cacheDir, entry.name);
        try {
          const isTargetFile = entry.isFile() && (entry.name.startsWith('extract_') || entry.name.startsWith('ai_')) && entry.name.endsWith('.json');
          const isTargetDir = entry.isDirectory() && entry.name.startsWith('assets_');

          if (isTargetFile || isTargetDir) {
            const stats = await fs.stat(itemPath);
            if (stats.mtimeMs < sevenDaysAgo) {
              await fs.rm(itemPath, { recursive: true, force: true });
              purgedCount++;
              logger.info({ itemPath }, 'Janitor: Purged expired quiz cache entry');
            }
          }
        } catch (err) {
          logger.warn({ itemPath, err }, 'Janitor: Failed to stat/rm quiz cache item');
        }
      }
    } catch (err) {
      logger.warn({ cacheDir, err }, 'Janitor: Failed to read quiz cache directory');
    }

    return purgedCount;
  }

  /**
   * Cleans up orphaned objects in R2 transit/ prefix older than 1 hour
   */
  static async cleanOrphanedR2TransitObjects(): Promise<number> {
    try {
      const purged = await R2Service.cleanOrphanedTransitObjects();
      if (purged > 0) {
        logger.info({ purged }, 'Janitor: Purged orphaned R2 transit objects');
      }
      return purged;
    } catch (err) {
      logger.warn({ err }, 'Janitor: Failed to clean orphaned R2 transit objects');
      return 0;
    }
  }

  /**
   * Runs a single purge pass over all expired, unpurged file records
   */
  static async runJanitorOnce(options: { forceExpiredCheck?: boolean } = {}): Promise<JanitorPurgeResult> {
    if (this.isRunning) {
      logger.debug('Janitor run already in progress, skipping tick');
      return { purgedCount: 0, reclaimedBytes: 0, errorsCount: 0 };
    }

    this.isRunning = true;
    const now = new Date();
    let purgedCount = 0;
    let reclaimedBytes = 0;
    let errorsCount = 0;

    try {
      await this.cleanupOrphanedChunks();
      await this.cleanOrphanedR2TransitObjects();
      await this.cleanupQuizCache();

      if (isPermanentRetention && !options.forceExpiredCheck) {
        logger.debug('Janitor: Permanent retention enabled, skipping file auto-purge');
        return { purgedCount, reclaimedBytes, errorsCount };
      }

      const expiredFiles = await prisma.fileRecord.findMany({
        where: {
          expiresAt: { lte: now },
          isPurged: false
        }
      });

      if (expiredFiles.length === 0) {
        logger.debug('Janitor: No expired files to purge');
        return { purgedCount, reclaimedBytes, errorsCount };
      }

      // Preserve files linked to any HistoryRecord (active or in trash)
      const historyItems = await prisma.historyRecord.findMany({
        select: { resultFileId: true, downloadUrl: true }
      });
      const preservedFileIds = new Set<string>();
      for (const h of historyItems) {
        if (h.resultFileId) preservedFileIds.add(h.resultFileId);
        if (h.downloadUrl) {
          const match = h.downloadUrl.match(/fil_[a-zA-Z0-9_]+/);
          if (match) preservedFileIds.add(match[0]);
        }
      }

      const filesToPurge = expiredFiles.filter(f => !preservedFileIds.has(f.id));

      if (filesToPurge.length === 0) {
        logger.debug('Janitor: All expired files are preserved in history/trash');
        return { purgedCount, reclaimedBytes, errorsCount };
      }

      logger.info({ count: filesToPurge.length }, 'Janitor: Starting cleanup pass for expired files');

      for (const file of filesToPurge) {
        try {
          if (file.storagePath) {
            await StorageManager.unlinkSafe(file.storagePath);
          }

          await prisma.fileRecord.update({
            where: { id: file.id },
            data: {
              isPurged: true,
              storagePath: ''
            }
          });

          purgedCount++;
          reclaimedBytes += Number(file.sizeBytes);
        } catch (fileErr) {
          errorsCount++;
          logger.error({ fileId: file.id, err: fileErr }, 'Janitor: Failed to purge file record');
        }
      }

      logger.info(
        { purgedCount, reclaimedBytes, errorsCount },
        'Janitor: Cleanup pass completed'
      );
    } catch (err) {
      logger.error({ err }, 'Janitor: Unhandled error during cleanup pass');
    } finally {
      this.isRunning = false;
    }

    return { purgedCount, reclaimedBytes, errorsCount };
  }

  /**
   * Starts background interval daemon
   */
  static startJanitor(intervalMs: number = limits.janitorIntervalMs): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    logger.info({ intervalMinutes: intervalMs / (60 * 1000) }, 'Starting Ephemeral File Janitor Daemon');

    // Run initial pass shortly after boot
    setTimeout(() => {
      this.runJanitorOnce().catch((err) => {
        logger.error({ err }, 'Initial Janitor pass failed');
      });
    }, 5000);

    this.timer = setInterval(() => {
      this.runJanitorOnce().catch((err) => {
        logger.error({ err }, 'Scheduled Janitor pass failed');
      });
    }, intervalMs);

    // Prevent timer from hanging process during shutdown/tests
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stops background interval daemon
   */
  static stopJanitor(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Ephemeral File Janitor Daemon stopped');
    }
  }
}
