import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';

describe('Studocu Document Stream Hardened Headers', () => {
  let app: FastifyInstance;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
    await closeTaskQueue();
  });

  it('enforces Content-Type: application/pdf and pure Content-Disposition: inline without filename=', async () => {
    // Mock upstream Python backend returning application/x-viewer-data
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/document-stream')) {
        return new Response(Buffer.from('%PDF-1.4 dummy pdf content'), {
          status: 200,
          headers: {
            'Content-Type': 'application/x-viewer-data',
            'Content-Length': '28',
            'Accept-Ranges': 'bytes',
            'Content-Disposition': 'inline'
          }
        });
      }
      return originalFetch(url);
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/studocu/stream?id=testdoc12345678&file=BaoCaoTotNghiep.pdf'
    });

    expect(res.statusCode).toBe(200);

    // CRITICAL LOCKDOWN ASSERTIONS:
    // 1. Content-Type must be overridden from application/x-viewer-data to application/pdf
    expect(res.headers['content-type']).toBe('application/pdf');

    // 2. Content-Disposition must strictly be 'inline' (never 'attachment' and never containing 'filename=')
    expect(res.headers['content-disposition']).toBe('inline');
    expect(res.headers['content-disposition']).not.toContain('attachment');
    expect(res.headers['content-disposition']).not.toContain('filename=');

    // 3. Byte range support preserved
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('serves markdown files with text/plain and pure inline disposition', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/document-stream')) {
        return new Response('# Markdown Document Content', {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            'Accept-Ranges': 'bytes'
          }
        });
      }
      return originalFetch(url);
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/studocu/stream?id=testdoc12345678&file=Readme.md'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('inline');
    expect(res.headers['content-disposition']).not.toContain('filename=');
  });

  it('handles trash restore POST with empty body, json body, and wildcard params', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/trash/restore/')) {
        return new Response(JSON.stringify({ success: true, action: 'restored' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(url, init);
    });

    // 1. Send POST with wildcard URL param
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/studocu/trash/restore/testdoc.pdf'
    });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.body).success).toBe(true);

    // 2. Send POST with JSON body
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/studocu/trash/restore',
      headers: { 'Content-Type': 'application/json' },
      payload: { filename: 'testdoc.pdf' }
    });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.body).success).toBe(true);
  });

  it('enforces attachment Content-Disposition on file download route', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/downloads/')) {
        return new Response(Buffer.from('%PDF-1.4 dummy pdf'), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': '19'
          }
        });
      }
      return originalFetch(url, init);
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/studocu/download/testdoc.pdf'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('filename="testdoc.pdf"');
  });
});
