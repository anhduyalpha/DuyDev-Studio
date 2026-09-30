import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { DynamicQrService } from '../../src/services/dynamic-qr.service.js';
import { prisma } from '../../src/lib/prisma.js';

describe('DynamicQrService Unit Tests', () => {
  beforeAll(async () => {
    await prisma.qrScanLog.deleteMany({});
    await prisma.dynamicQr.deleteMany({
      where: {
        slug: { in: ['test-custom-1', 'test-custom-2', 'test-update-1'] }
      }
    });
  });

  beforeEach(async () => {
    DynamicQrService.clearCache();
  });

  afterAll(async () => {
    // Clean up created test records
    await prisma.qrScanLog.deleteMany({});
    await prisma.dynamicQr.deleteMany({
      where: {
        slug: { in: ['test-custom-1', 'test-custom-2', 'test-update-1'] }
      }
    });
  });

  it('should generate a valid 6-character Base62 random slug', async () => {
    const slug = await DynamicQrService.generateRandomSlug(6);
    expect(slug).toBeTypeOf('string');
    expect(slug).toHaveLength(6);
    expect(slug).toMatch(/^[a-zA-Z0-9]{6}$/);
  });

  it('should create a dynamic QR with auto-generated slug', async () => {
    const result = await DynamicQrService.createDynamicQr(
      {
        targetUrl: 'https://example.com/original-page',
        title: 'Auto Slug Test'
      },
      'http://localhost:3000'
    );

    expect(result.id).toBeDefined();
    expect(result.slug).toHaveLength(6);
    expect(result.shortUrl).toBe(`http://localhost:3000/q/${result.slug}`);
    expect(result.targetUrl).toBe('https://example.com/original-page');
    expect(result.title).toBe('Auto Slug Test');
    expect(result.scanCount).toBe(0);
    expect(result.isActive).toBe(true);

    // Clean up
    await prisma.dynamicQr.delete({ where: { id: result.id } });
  });

  it('should create a dynamic QR with a custom slug and reject duplicates', async () => {
    const slug = 'test-custom-1';
    const result = await DynamicQrService.createDynamicQr(
      {
        targetUrl: 'https://example.com/custom-page',
        title: 'Custom Slug Test',
        customSlug: slug
      },
      'http://localhost:3000'
    );

    expect(result.slug).toBe(slug);
    expect(result.shortUrl).toBe(`http://localhost:3000/q/${slug}`);

    // Duplicate creation must throw BadRequestError
    await expect(
      DynamicQrService.createDynamicQr(
        {
          targetUrl: 'https://example.com/another-page',
          customSlug: slug
        },
        'http://localhost:3000'
      )
    ).rejects.toThrow(/đã tồn tại/);
  });

  it('should resolve targetUrl, log scans, and update telemetry via in-memory cache', async () => {
    const slug = 'test-custom-2';
    const created = await DynamicQrService.createDynamicQr(
      {
        targetUrl: 'https://example.com/redirect-target',
        title: 'Redirect Test',
        customSlug: slug
      },
      'http://localhost:3000'
    );

    // First scan (cached)
    const resolvedUrl1 = await DynamicQrService.resolveAndLogScan(slug, {
      userAgent: 'Mozilla/5.0 Test Browser',
      referer: 'https://referrer.example.com',
      ipAddress: '192.168.1.100'
    });
    expect(resolvedUrl1).toBe('https://example.com/redirect-target');

    // Second scan
    const resolvedUrl2 = await DynamicQrService.resolveAndLogScan(slug, {
      userAgent: 'Mobile Safari',
      referer: null,
      ipAddress: '10.0.0.1'
    });
    expect(resolvedUrl2).toBe('https://example.com/redirect-target');

    // Allow background async updates to settle
    await new Promise((r) => setTimeout(r, 200));

    const analytics = await DynamicQrService.getAnalytics(slug, 'http://localhost:3000');
    expect(analytics.scanCount).toBe(2);
    expect(analytics.recentScans.length).toBeGreaterThanOrEqual(2);
    expect(analytics.recentScans[0].anonymizedIp).toBeDefined();
    // IP must be hashed, not raw
    expect(analytics.recentScans[0].anonymizedIp).not.toBe('192.168.1.100');
    expect(analytics.recentScans[0].anonymizedIp).not.toBe('10.0.0.1');
  });

  it('should update destination targetUrl without changing slug and invalidate cache', async () => {
    const slug = 'test-update-1';
    await DynamicQrService.createDynamicQr(
      {
        targetUrl: 'https://example.com/old-destination',
        title: 'Initial Title',
        customSlug: slug
      },
      'http://localhost:3000'
    );

    const updated = await DynamicQrService.updateDestination(slug, {
      targetUrl: 'https://example.com/new-destination-2026',
      title: 'Updated Title'
    });
    expect(updated.targetUrl).toBe('https://example.com/new-destination-2026');
    expect(updated.title).toBe('Updated Title');

    // Immediate resolution must reflect new destination
    const resolved = await DynamicQrService.resolveAndLogScan(slug, {});
    expect(resolved).toBe('https://example.com/new-destination-2026');
  });

  it('should return null for non-existent or inactive slugs', async () => {
    const nonExistent = await DynamicQrService.resolveAndLogScan('missing_slug_xyz', {});
    expect(nonExistent).toBeNull();
  });
});
