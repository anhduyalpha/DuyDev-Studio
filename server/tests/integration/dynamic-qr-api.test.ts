import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Dynamic QR API Integration Tests', () => {
  let app: FastifyInstance;
  let createdSlug: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (createdSlug) {
      await prisma.qrScanLog.deleteMany({});
      await prisma.dynamicQr.deleteMany({
        where: { slug: createdSlug }
      });
    }
    await app.close();
  });

  it('POST /api/v1/qr/dynamic should reject dangerous URL protocols (security boundary)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/qr/dynamic',
      payload: {
        targetUrl: 'javascript:alert("XSS")',
        title: 'Dangerous Payload'
      }
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
  });

  it('POST /api/v1/qr/dynamic should create a dynamic QR with valid http/https URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/qr/dynamic',
      payload: {
        targetUrl: 'https://docs.google.com/spreadsheets/d/1234567890/edit',
        title: 'Google Sheet Marketing Campaign'
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.slug).toBeDefined();
    expect(json.data.shortUrl).toContain(`/q/${json.data.slug}`);
    expect(json.data.targetUrl).toBe('https://docs.google.com/spreadsheets/d/1234567890/edit');

    createdSlug = json.data.slug;
  });

  it('GET /q/:slug should perform HTTP 302 redirect to targetUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/q/${createdSlug}`,
      headers: {
        'user-agent': 'Integration Test Agent',
        referer: 'https://campaign.example.com'
      }
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://docs.google.com/spreadsheets/d/1234567890/edit');
  });

  it('GET /q/:nonexistent should return 404 with styled HTML page', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/q/nonexistent_slug_404'
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Mã QR Không Khả Dụng');
  });

  it('GET /api/v1/qr/dynamic/:slug/analytics should return scan count and telemetry', async () => {
    // Wait for async logging to settle
    await new Promise((r) => setTimeout(r, 150));

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/qr/dynamic/${createdSlug}/analytics`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.scanCount).toBeGreaterThanOrEqual(1);
    expect(json.data.recentScans.length).toBeGreaterThanOrEqual(1);
    expect(json.data.recentScans[0].userAgent).toBe('Integration Test Agent');
  });

  it('PATCH /api/v1/qr/dynamic/:slug should update destination targetUrl seamlessly', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/qr/dynamic/${createdSlug}`,
      payload: {
        targetUrl: 'https://newdestination.com/summer-sale-2026'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.targetUrl).toBe('https://newdestination.com/summer-sale-2026');

    // Follow redirect again to verify new target is served
    const redirectRes = await app.inject({
      method: 'GET',
      url: `/q/${createdSlug}`
    });
    expect(redirectRes.statusCode).toBe(302);
    expect(redirectRes.headers.location).toBe('https://newdestination.com/summer-sale-2026');
  });

  it('GET /api/v1/qr/dynamic should list recently created dynamic QRs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/qr/dynamic'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.some((item: any) => item.slug === createdSlug)).toBe(true);
  });

  it('DELETE /api/v1/qr/dynamic/:slug should remove dynamic QR', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/qr/dynamic/${createdSlug}`
    });

    expect(res.statusCode).toBe(200);

    // After deletion, redirect must return 404
    const redirectRes = await app.inject({
      method: 'GET',
      url: `/q/${createdSlug}`
    });
    expect(redirectRes.statusCode).toBe(404);
  });
});
