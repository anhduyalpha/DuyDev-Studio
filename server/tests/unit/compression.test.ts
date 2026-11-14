import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Fastify Compression & Caching Verification', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    // Register a test SSE endpoint to verify text/event-stream is never compressed
    app.get('/test-sse', async (req, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.write('event: test\ndata: {"status":"streaming"}\n\n');
      reply.raw.end();
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('compresses index.html with Brotli when accept-encoding includes br', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/index.html',
      headers: {
        'accept-encoding': 'br, gzip'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBe('br');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['cache-control']).toContain('must-revalidate');
  });

  it('compresses index.html with Gzip when accept-encoding includes only gzip', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/index.html',
      headers: {
        'accept-encoding': 'gzip'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('compresses static tailwind.generated.css with Brotli and preserves immutable cache header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/src/styles/tailwind.generated.css?v=25.0',
      headers: {
        'accept-encoding': 'br'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBe('br');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers.etag).toBeDefined();
  });

  it('unversioned /src/utilities/pwa.js preserves no-cache, must-revalidate and supports compression', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/src/utilities/pwa.js',
      headers: {
        'accept-encoding': 'br, gzip'
      }
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBe('br');
    expect(res.headers['cache-control']).toBe('no-cache, must-revalidate');
    expect(res.headers.etag).toBeDefined();
  });

  it('text/event-stream SSE endpoints are NEVER compressed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-sse',
      headers: {
        'accept-encoding': 'br, gzip'
      }
    });

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['content-type']).toContain('text/event-stream');
  });
});
