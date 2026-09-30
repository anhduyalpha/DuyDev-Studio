import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { BadRequestError, NotFoundError, AppError } from '../lib/errors.js';
import { CreateDynamicQrInput, UpdateDynamicQrInput } from '../schemas/dynamic-qr.schema.js';
import { formatDynamicQrAnalytics, recordScanTelemetry } from './dynamic-qr-analytics.helper.js';
import { generateRandomBase62Slug } from './slug-generator.helper.js';

interface CachedSlug {
  id: string;
  targetUrl: string;
  isActive: boolean;
}

export interface ClientMetadata {
  userAgent?: string | null;
  referer?: string | null;
  ipAddress?: string | null;
}

export class DynamicQrService {
  /**
   * In-memory cache for ultra-fast slug resolution (sub-millisecond HTTP 302 redirects)
   */
  private static cache: Map<string, CachedSlug> = new Map();

  /**
   * Generates a collision-resistant 6-character Base62 slug with a bounded retry limit
   */
  static async generateRandomSlug(length: number = 6, maxRetries: number = 5): Promise<string> {
    return generateRandomBase62Slug(length, maxRetries, (s) => this.cache.has(s));
  }

  /**
   * Creates a new Dynamic QR record
   */
  static async createDynamicQr(input: CreateDynamicQrInput, baseUrl: string) {
    let slug: string;

    if (input.customSlug && input.customSlug.trim()) {
      const cleanSlug = input.customSlug.trim();
      const existing = await prisma.dynamicQr.findUnique({
        where: { slug: cleanSlug },
        select: { id: true }
      });
      if (existing) {
        throw new BadRequestError(`Mã slug "${cleanSlug}" đã tồn tại trên hệ thống, vui lòng chọn mã khác.`);
      }
      slug = cleanSlug;
    } else {
      slug = await this.generateRandomSlug(6, 5);
    }

    const cleanTargetUrl = input.targetUrl.trim();

    const record = await prisma.dynamicQr.create({
      data: {
        slug,
        targetUrl: cleanTargetUrl,
        title: input.title ? input.title.trim() : null,
        scanCount: 0,
        isActive: true
      }
    });

    // Populate in-memory cache
    this.cache.set(slug, {
      id: record.id,
      targetUrl: record.targetUrl,
      isActive: record.isActive
    });

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const shortUrl = `${cleanBase}/q/${slug}`;

    return {
      id: record.id,
      slug: record.slug,
      shortUrl,
      targetUrl: record.targetUrl,
      title: record.title,
      scanCount: record.scanCount,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  /**
   * Resolves target URL for public redirect, performing atomic scan count increment and hashed telemetry logging
   */
  static async resolveAndLogScan(slug: string, client: ClientMetadata): Promise<string | null> {
    let cached = this.cache.get(slug);

    if (!cached) {
      const record = await prisma.dynamicQr.findUnique({
        where: { slug },
        select: { id: true, targetUrl: true, isActive: true }
      });

      if (!record) {
        return null;
      }

      cached = {
        id: record.id,
        targetUrl: record.targetUrl,
        isActive: record.isActive
      };
      this.cache.set(slug, cached);
    }

    if (!cached.isActive) {
      return null;
    }

    // Asynchronously update telemetry in background without blocking redirect response
    recordScanTelemetry(cached.id, slug, client, prisma, logger, crypto);

    return cached.targetUrl;
  }

  /**
   * Retrieves comprehensive analytics for a dynamic QR code
   */
  static async getAnalytics(slug: string, baseUrl?: string) {
    const record = await prisma.dynamicQr.findUnique({
      where: { slug },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 50
        }
      }
    });

    if (!record) {
      throw new NotFoundError(`Mã QR động với slug "${slug}" không tồn tại.`);
    }

    // Compute last 30 days daily scan breakdown
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await prisma.qrScanLog.findMany({
      where: {
        dynamicQrId: record.id,
        scannedAt: { gte: thirtyDaysAgo }
      },
      select: { scannedAt: true }
    });

    return formatDynamicQrAnalytics(record, recentLogs, baseUrl);
  }

  /**
   * Lists recently created dynamic QR codes
   */
  static async listRecent(baseUrl: string, limit: number = 50) {
    const records = await prisma.dynamicQr.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const cleanBase = baseUrl.replace(/\/+$/, '');
    return records.map((r) => ({
      id: r.id,
      slug: r.slug,
      shortUrl: `${cleanBase}/q/${r.slug}`,
      targetUrl: r.targetUrl,
      title: r.title,
      scanCount: r.scanCount,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lastScannedAt: r.lastScannedAt
    }));
  }

  /**
   * Updates destination targetUrl, title, or active status without changing the printed QR code
   */
  static async updateDestination(slug: string, input: UpdateDynamicQrInput) {
    const existing = await prisma.dynamicQr.findUnique({
      where: { slug }
    });

    if (!existing) {
      throw new NotFoundError(`Mã QR động với slug "${slug}" không tồn tại.`);
    }

    const data: { targetUrl?: string; title?: string | null; isActive?: boolean } = {};
    if (input.targetUrl !== undefined) data.targetUrl = input.targetUrl.trim();
    if (input.title !== undefined) data.title = input.title ? input.title.trim() : null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const updated = await prisma.dynamicQr.update({
      where: { slug },
      data
    });

    // Invalidate/refresh in-memory cache
    this.cache.set(slug, {
      id: updated.id,
      targetUrl: updated.targetUrl,
      isActive: updated.isActive
    });

    return updated;
  }

  /**
   * Deletes dynamic QR code and associated scan logs
   */
  static async deleteDynamicQr(slug: string) {
    const existing = await prisma.dynamicQr.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundError(`Mã QR động với slug "${slug}" không tồn tại.`);
    }

    await prisma.dynamicQr.delete({
      where: { slug }
    });

    // Invalidate cache
    this.cache.delete(slug);

    return { success: true, slug };
  }

  /**
   * Clears internal memory cache (useful for testing)
   */
  static clearCache() {
    this.cache.clear();
  }
}
