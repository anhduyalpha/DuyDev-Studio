/**
 * Cloudflare R2 Transit Service
 * Provides dual-account (Primary + Fallback) presigned URL generation,
 * atomic object ingestion, automatic R2 purging, and persistent Circuit Breaker quota guards.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import fsp from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Transform, Readable } from 'stream';
import crypto from 'crypto';
import path from 'path';
import { env, resolvedStoragePaths } from '../config/env.config.js';
import { limits } from '../config/limits.config.js';
import { BadRequestError, FileSizeLimitError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export interface AccountMetrics {
  classA: number;
  classB: number;
  totalRequests: number;
}

export interface R2Metrics {
  month: string;
  classA: number;
  classB: number;
  totalRequests: number;
  primary?: AccountMetrics;
  fallback?: AccountMetrics;
  updatedAt: string;
}

export class R2Service {
  private static primaryClient: S3Client | null = null;
  private static fallbackClient: S3Client | null = null;
  private static cachedMetrics: R2Metrics | null = null;
  private static activeIngestions: Map<string, Promise<{ byteCount: number; hashSha256: string }>> = new Map();
  private static completedIngestions: Map<string, { byteCount: number; hashSha256: string; timestamp: number }> = new Map();

  static getMetricsFilePath(): string {
    const serverDataDir = path.resolve(process.cwd(), 'server', 'data');
    if (fs.existsSync(serverDataDir)) {
      return path.join(serverDataDir, 'r2_metrics.json');
    }
    const directDataDir = path.resolve(process.cwd(), 'data');
    if (fs.existsSync(directDataDir)) {
      return path.join(directDataDir, 'r2_metrics.json');
    }
    return path.resolve(resolvedStoragePaths.root, '..', 'r2_metrics.json');
  }

  static isFallbackConfigured(): boolean {
    return Boolean(
      env.R2_FALLBACK_ACCOUNT_ID &&
      env.R2_FALLBACK_ACCESS_KEY_ID &&
      env.R2_FALLBACK_SECRET_ACCESS_KEY &&
      env.R2_FALLBACK_BUCKET_NAME
    );
  }

  static getClient(target: 'primary' | 'fallback' = 'primary'): S3Client {
    if (target === 'fallback') {
      if (!this.fallbackClient) {
        this.fallbackClient = new S3Client({
          region: 'auto',
          endpoint: `https://${env.R2_FALLBACK_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.R2_FALLBACK_ACCESS_KEY_ID,
            secretAccessKey: env.R2_FALLBACK_SECRET_ACCESS_KEY
          }
        });
      }
      return this.fallbackClient;
    }

    if (!this.primaryClient) {
      this.primaryClient = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY
        }
      });
    }
    return this.primaryClient;
  }

  static getMetrics(): R2Metrics {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const metricsFilePath = this.getMetricsFilePath();
    if (!this.cachedMetrics) {
      try {
        if (fs.existsSync(metricsFilePath)) {
          const raw = fs.readFileSync(metricsFilePath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && data.month === currentMonth) {
            this.cachedMetrics = data;
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to read r2_metrics.json, initializing fresh');
      }
    }

    if (!this.cachedMetrics || this.cachedMetrics.month !== currentMonth) {
      this.cachedMetrics = {
        month: currentMonth,
        classA: 0,
        classB: 0,
        totalRequests: 0,
        primary: { classA: 0, classB: 0, totalRequests: 0 },
        fallback: { classA: 0, classB: 0, totalRequests: 0 },
        updatedAt: new Date().toISOString()
      };
      this.persistMetrics();
    } else {
      // Ensure primary and fallback sub-objects exist
      let modified = false;
      if (!this.cachedMetrics.primary) {
        this.cachedMetrics.primary = { classA: 0, classB: 0, totalRequests: 0 };
        modified = true;
      }
      if (!this.cachedMetrics.fallback) {
        // If transitioning from legacy single account, allocate previous counts to fallback (old account)
        this.cachedMetrics.fallback = {
          classA: this.cachedMetrics.classA || 0,
          classB: this.cachedMetrics.classB || 0,
          totalRequests: this.cachedMetrics.totalRequests || 0
        };
        modified = true;
      }
      if (modified) {
        this.persistMetrics();
      }
    }

    return this.cachedMetrics;
  }

  static recordRequest(type: 'classA' | 'classB', target: 'primary' | 'fallback' = 'primary'): void {
    const metrics = this.getMetrics();
    if (!metrics.primary) {
      metrics.primary = { classA: 0, classB: 0, totalRequests: 0 };
    }
    if (!metrics.fallback) {
      metrics.fallback = { classA: 0, classB: 0, totalRequests: 0 };
    }

    const account = target === 'primary' ? metrics.primary : metrics.fallback;
    if (type === 'classA') {
      account.classA++;
    } else {
      account.classB++;
    }
    account.totalRequests = account.classA + account.classB;

    metrics.classA = metrics.primary.classA + metrics.fallback.classA;
    metrics.classB = metrics.primary.classB + metrics.fallback.classB;
    metrics.totalRequests = metrics.classA + metrics.classB;
    metrics.updatedAt = new Date().toISOString();
    this.persistMetrics();
  }

  private static persistMetrics(): void {
    if (!this.cachedMetrics) return;
    try {
      const metricsFilePath = this.getMetricsFilePath();
      const dataDir = path.dirname(metricsFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const tmpPath = `${metricsFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.cachedMetrics, null, 2), 'utf-8');
      fs.renameSync(tmpPath, metricsFilePath);
    } catch (err) {
      logger.warn({ err }, 'Failed to persist r2_metrics.json');
    }
  }

  static isPrimaryAvailable(): boolean {
    if (
      !env.R2_ENABLED ||
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET_NAME
    ) {
      return false;
    }

    const metrics = this.getMetrics();
    const primaryTotal = metrics.primary?.totalRequests ?? 0;
    if (primaryTotal >= env.R2_MAX_MONTHLY_REQUESTS) {
      logger.warn(
        { total: primaryTotal, max: env.R2_MAX_MONTHLY_REQUESTS },
        'Primary R2 Circuit Breaker tripped: monthly request limit reached'
      );
      return false;
    }

    return true;
  }

  static isFallbackAvailable(): boolean {
    if (!env.R2_ENABLED || !this.isFallbackConfigured()) {
      return false;
    }

    const metrics = this.getMetrics();
    const fallbackTotal = metrics.fallback?.totalRequests ?? 0;
    if (fallbackTotal >= env.R2_FALLBACK_MAX_MONTHLY_REQUESTS) {
      logger.warn(
        { total: fallbackTotal, max: env.R2_FALLBACK_MAX_MONTHLY_REQUESTS },
        'Fallback R2 Circuit Breaker tripped: monthly request limit reached'
      );
      return false;
    }

    return true;
  }

  static isAvailable(): boolean {
    return this.isPrimaryAvailable() || this.isFallbackAvailable();
  }

  static getActiveAccount(): 'primary' | 'fallback' | null {
    if (this.isPrimaryAvailable()) return 'primary';
    if (this.isFallbackAvailable()) return 'fallback';
    return null;
  }

  static async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    sizeBytes?: number
  ): Promise<{ presignedUrl: string; fileKey: string; fileId: string; sanitizedName: string; provider: 'primary' | 'fallback' }> {
    if (sizeBytes && sizeBytes > limits.maxUploadSizeBytes) {
      throw new FileSizeLimitError(`File exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB`);
    }

    const targetAccount = this.getActiveAccount();
    if (!targetAccount) {
      throw new BadRequestError('All Cloudflare R2 storage accounts are currently unavailable or over quota');
    }

    const fileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const prefix = targetAccount === 'fallback' ? 'transit/fb_' : 'transit/';
    const fileKey = `${prefix}${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}_${sanitizedName}`;

    const client = this.getClient(targetAccount);
    const bucket = targetAccount === 'fallback' ? env.R2_FALLBACK_BUCKET_NAME : env.R2_BUCKET_NAME;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      ContentType: mimeType || 'application/octet-stream'
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 600 });
    this.recordRequest('classA', targetAccount);

    if (targetAccount === 'fallback') {
      logger.info({ fileId, fileKey }, 'Using Secondary/Fallback R2 account (Primary exhausted or unavailable)');
    }

    return { presignedUrl, fileKey, fileId, sanitizedName, provider: targetAccount };
  }

  static getAccountForFileKey(fileKey: string): { target: 'primary' | 'fallback'; bucket: string } {
    if (fileKey.startsWith('transit/fb_') && this.isFallbackConfigured()) {
      return { target: 'fallback', bucket: env.R2_FALLBACK_BUCKET_NAME };
    }
    return { target: 'primary', bucket: env.R2_BUCKET_NAME };
  }

  static async ingestAndPurgeTransitObject(
    fileKey: string,
    targetPath: string
  ): Promise<{ byteCount: number; hashSha256: string }> {
    let { target, bucket } = this.getAccountForFileKey(fileKey);
    let client = this.getClient(target);
    let getObjectResponse: any = null;

    // Retry up to 3 attempts with exponential backoff for eventual consistency
    const retryDelays = [150, 300, 600];
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        getObjectResponse = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: fileKey
          })
        );
        break;
      } catch (err: any) {
        // If not found on initial target, attempt alternative account once if configured
        if (err?.name === 'NoSuchKey' || err?.name === 'NotFound') {
          const altTarget: 'primary' | 'fallback' = target === 'primary' ? 'fallback' : 'primary';
          const isAltConfigured = altTarget === 'fallback' ? this.isFallbackConfigured() : true;
          if (isAltConfigured) {
            try {
              const altBucket = altTarget === 'fallback' ? env.R2_FALLBACK_BUCKET_NAME : env.R2_BUCKET_NAME;
              const altClient = this.getClient(altTarget);
              getObjectResponse = await altClient.send(
                new GetObjectCommand({
                  Bucket: altBucket,
                  Key: fileKey
                })
              );
              target = altTarget;
              bucket = altBucket;
              client = altClient;
              break;
            } catch (_) {}
          }
        }

        if (attempt < retryDelays.length) {
          logger.debug({ fileKey, target, attempt, err: err?.name }, 'R2 GetObject retry wait...');
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        } else {
          logger.error({ fileKey, target, err }, 'Failed to retrieve transit object from R2 after retries');
          throw new NotFoundError(`Transit object ${fileKey} not found or inaccessible on R2 (${target})`);
        }
      }
    }

    this.recordRequest('classB', target);

    await fsp.mkdir(resolvedStoragePaths.temp, { recursive: true });
    const tempPath = path.join(
      resolvedStoragePaths.temp,
      `transit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.tmp`
    );

    let byteCount = 0;
    const hash = crypto.createHash('sha256');
    const hashingStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteCount += chunk.length;
        if (byteCount > limits.maxUploadSizeBytes) {
          callback(new FileSizeLimitError(`File exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB`));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    const writeStream = fs.createWriteStream(tempPath, { highWaterMark: 4 * 1024 * 1024 });

    try {
      const sourceStream = getObjectResponse.Body as Readable;
      await pipeline(sourceStream, hashingStream, writeStream);

      if (byteCount === 0) {
        throw new BadRequestError('Transit object on R2 is empty');
      }

      // Atomic rename to final target path
      const targetDir = path.dirname(targetPath);
      await fsp.mkdir(targetDir, { recursive: true });
      await fsp.rename(tempPath, targetPath);

      // Purge immediately from R2
      await this.deleteTransitObject(fileKey, target);

      return {
        byteCount,
        hashSha256: hash.digest('hex')
      };
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        await fsp.unlink(tempPath).catch(() => {});
      }
      await this.deleteTransitObject(fileKey, target).catch(() => {});
      throw err;
    }
  }

  static startAsyncIngestion(
    fileId: string,
    fileKey: string,
    targetPath: string
  ): Promise<{ byteCount: number; hashSha256: string }> {
    if (this.activeIngestions.has(fileId)) {
      return this.activeIngestions.get(fileId)!;
    }

    const ingestionPromise = (async () => {
      try {
        const result = await this.ingestAndPurgeTransitObject(fileKey, targetPath);

        // Cache completed result for 2 minutes to eliminate race conditions
        this.completedIngestions.set(fileId, {
          ...result,
          timestamp: Date.now()
        });

        // Prune old entries in completedIngestions older than 2 minutes
        const now = Date.now();
        for (const [id, item] of this.completedIngestions.entries()) {
          if (now - item.timestamp > 120_000) {
            this.completedIngestions.delete(id);
          }
        }

        // Retry updating database record in case it was created concurrently
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const { prisma } = await import('../lib/prisma.js');
            await prisma.fileRecord.update({
              where: { id: fileId },
              data: {
                sizeBytes: BigInt(result.byteCount),
                hashSha256: result.hashSha256
              }
            });
            break;
          } catch (dbErr) {
            if (attempt === 3) {
              logger.warn({ fileId, dbErr }, 'Could not update FileRecord after async R2 ingestion');
            } else {
              await new Promise((r) => setTimeout(r, 50 * attempt));
            }
          }
        }
        return result;
      } catch (err) {
        logger.error({ fileId, fileKey, err }, 'Async R2 ingestion failed');
        throw err;
      }
    })().finally(() => {
      this.activeIngestions.delete(fileId);
    });

    this.activeIngestions.set(fileId, ingestionPromise);
    ingestionPromise.catch(() => {});
    return ingestionPromise;
  }

  static isIngesting(fileId: string): boolean {
    return this.activeIngestions.has(fileId);
  }

  static async waitForIngestion(fileId: string): Promise<{ byteCount: number; hashSha256: string }> {
    if (this.completedIngestions.has(fileId)) {
      const cached = this.completedIngestions.get(fileId)!;
      return { byteCount: cached.byteCount, hashSha256: cached.hashSha256 };
    }
    const promise = this.activeIngestions.get(fileId);
    if (!promise) {
      return { byteCount: 0, hashSha256: '' };
    }
    return await promise;
  }

  static async deleteTransitObject(fileKey: string, specificTarget?: 'primary' | 'fallback'): Promise<boolean> {
    const target = specificTarget || this.getAccountForFileKey(fileKey).target;
    const bucket = target === 'fallback' ? env.R2_FALLBACK_BUCKET_NAME : env.R2_BUCKET_NAME;
    try {
      const client = this.getClient(target);
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: fileKey
        })
      );
      return true;
    } catch (err) {
      logger.warn({ fileKey, target, err }, 'Failed to delete transit object from R2');
      return false;
    }
  }

  private static async cleanOrphanedFromBucket(
    target: 'primary' | 'fallback',
    bucket: string,
    maxAgeMs: number
  ): Promise<number> {
    let purgedCount = 0;
    try {
      const client = this.getClient(target);
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'transit/'
      });

      const response = await client.send(listCommand);
      this.recordRequest('classA', target);

      if (!response.Contents || response.Contents.length === 0) {
        return 0;
      }

      const cutoffTime = Date.now() - maxAgeMs;
      for (const obj of response.Contents) {
        if (obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoffTime) {
          logger.info(
            { key: obj.Key, target, ageMs: Date.now() - obj.LastModified.getTime() },
            'Purging orphaned R2 transit object'
          );
          await this.deleteTransitObject(obj.Key, target);
          purgedCount++;
        }
      }
    } catch (err) {
      logger.error({ err, target, bucket }, 'Failed to clean orphaned transit objects from R2 bucket');
    }
    return purgedCount;
  }

  static async cleanOrphanedTransitObjects(maxAgeMs: number = 3600 * 1000): Promise<number> {
    if (!this.isAvailable()) return 0;

    let purgedCount = 0;
    if (this.isPrimaryAvailable()) {
      purgedCount += await this.cleanOrphanedFromBucket('primary', env.R2_BUCKET_NAME, maxAgeMs);
    }
    if (this.isFallbackConfigured() && this.isFallbackAvailable()) {
      purgedCount += await this.cleanOrphanedFromBucket('fallback', env.R2_FALLBACK_BUCKET_NAME, maxAgeMs);
    }

    return purgedCount;
  }

  static async getTelemetrySummary(): Promise<any> {
    const metrics = this.getMetrics();
    const primaryMax = env.R2_MAX_MONTHLY_REQUESTS || 900000;
    const fallbackMax = env.R2_FALLBACK_MAX_MONTHLY_REQUESTS || 900000;

    const primaryRequests = metrics.primary?.totalRequests ?? 0;
    const fallbackRequests = metrics.fallback?.totalRequests ?? 0;

    const summary: any = {
      enabled: env.R2_ENABLED,
      activeAccount: this.getActiveAccount(),
      primary: {
        accountId: env.R2_ACCOUNT_ID,
        bucketName: env.R2_BUCKET_NAME,
        classA: metrics.primary?.classA ?? 0,
        classB: metrics.primary?.classB ?? 0,
        totalRequests: primaryRequests,
        maxMonthlyRequests: primaryMax,
        remainingRequests: Math.max(0, primaryMax - primaryRequests),
        percentUsed: Number(((primaryRequests / primaryMax) * 100).toFixed(2)),
        isAvailable: this.isPrimaryAvailable()
      },
      fallback: {
        configured: this.isFallbackConfigured(),
        accountId: env.R2_FALLBACK_ACCOUNT_ID,
        bucketName: env.R2_FALLBACK_BUCKET_NAME,
        classA: metrics.fallback?.classA ?? 0,
        classB: metrics.fallback?.classB ?? 0,
        totalRequests: fallbackRequests,
        maxMonthlyRequests: fallbackMax,
        remainingRequests: Math.max(0, fallbackMax - fallbackRequests),
        percentUsed: Number(((fallbackRequests / fallbackMax) * 100).toFixed(2)),
        isAvailable: this.isFallbackAvailable()
      },
      month: metrics.month,
      totalCombinedRequests: metrics.totalRequests,
      updatedAt: metrics.updatedAt
    };

    return summary;
  }
}
