/**
 * Cloudflare R2 Transit Service
 * Provides presigned URL generation, atomic object ingestion, automatic R2 purging,
 * and a persistent Circuit Breaker quota guard.
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

export interface R2Metrics {
  month: string;
  classA: number;
  classB: number;
  totalRequests: number;
  updatedAt: string;
}

export class R2Service {
  private static s3Client: S3Client | null = null;
  private static metricsFilePath = path.resolve(process.cwd(), 'data', 'r2_metrics.json');
  private static cachedMetrics: R2Metrics | null = null;

  static getClient(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY
        }
      });
    }
    return this.s3Client;
  }

  static getMetrics(): R2Metrics {
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (!this.cachedMetrics) {
      try {
        if (fs.existsSync(this.metricsFilePath)) {
          const raw = fs.readFileSync(this.metricsFilePath, 'utf-8');
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
        updatedAt: new Date().toISOString()
      };
      this.persistMetrics();
    }

    return this.cachedMetrics;
  }

  static recordRequest(type: 'classA' | 'classB'): void {
    const metrics = this.getMetrics();
    if (type === 'classA') {
      metrics.classA++;
    } else {
      metrics.classB++;
    }
    metrics.totalRequests = metrics.classA + metrics.classB;
    metrics.updatedAt = new Date().toISOString();
    this.persistMetrics();
  }

  private static persistMetrics(): void {
    if (!this.cachedMetrics) return;
    try {
      const dataDir = path.dirname(this.metricsFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const tmpPath = `${this.metricsFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.cachedMetrics, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.metricsFilePath);
    } catch (err) {
      logger.warn({ err }, 'Failed to persist r2_metrics.json');
    }
  }

  static isAvailable(): boolean {
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
    if (metrics.totalRequests >= env.R2_MAX_MONTHLY_REQUESTS) {
      logger.warn(
        { total: metrics.totalRequests, max: env.R2_MAX_MONTHLY_REQUESTS },
        'R2 Circuit Breaker tripped: monthly request limit reached'
      );
      return false;
    }

    return true;
  }

  static async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    _sizeBytes?: number
  ): Promise<{ presignedUrl: string; fileKey: string; fileId: string; sanitizedName: string }> {
    const fileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = `transit/${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}_${sanitizedName}`;

    const client = this.getClient();
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: mimeType || 'application/octet-stream'
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 600 });
    this.recordRequest('classA');

    return { presignedUrl, fileKey, fileId, sanitizedName };
  }

  static async ingestAndPurgeTransitObject(
    fileKey: string,
    targetPath: string
  ): Promise<{ byteCount: number; hashSha256: string }> {
    const client = this.getClient();
    let getObjectResponse: any = null;

    // Retry up to 3 attempts with exponential backoff for eventual consistency
    const retryDelays = [150, 300, 600];
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        getObjectResponse = await client.send(
          new GetObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: fileKey
          })
        );
        break;
      } catch (err: any) {
        if (attempt < retryDelays.length) {
          logger.debug({ fileKey, attempt, err: err?.name }, 'R2 GetObject retry wait...');
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        } else {
          logger.error({ fileKey, err }, 'Failed to retrieve transit object from R2 after retries');
          throw new NotFoundError(`Transit object ${fileKey} not found or inaccessible on R2`);
        }
      }
    }

    this.recordRequest('classB');

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
      await this.deleteTransitObject(fileKey);

      return {
        byteCount,
        hashSha256: hash.digest('hex')
      };
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        await fsp.unlink(tempPath).catch(() => {});
      }
      await this.deleteTransitObject(fileKey).catch(() => {});
      throw err;
    }
  }

  static async deleteTransitObject(fileKey: string): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: fileKey
        })
      );
      return true;
    } catch (err) {
      logger.warn({ fileKey, err }, 'Failed to delete transit object from R2');
      return false;
    }
  }

  static async cleanOrphanedTransitObjects(maxAgeMs: number = 3600 * 1000): Promise<number> {
    if (!this.isAvailable()) return 0;

    let purgedCount = 0;
    try {
      const client = this.getClient();
      const listCommand = new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME,
        Prefix: 'transit/'
      });

      const response = await client.send(listCommand);
      this.recordRequest('classA');

      if (!response.Contents || response.Contents.length === 0) {
        return 0;
      }

      const cutoffTime = Date.now() - maxAgeMs;
      for (const obj of response.Contents) {
        if (obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoffTime) {
          logger.info(
            { key: obj.Key, ageMs: Date.now() - obj.LastModified.getTime() },
            'Purging orphaned R2 transit object'
          );
          await this.deleteTransitObject(obj.Key);
          purgedCount++;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to clean orphaned transit objects from R2');
    }

    return purgedCount;
  }
}
