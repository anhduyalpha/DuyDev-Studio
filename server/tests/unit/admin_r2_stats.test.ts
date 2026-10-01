import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { AuthService } from '../../src/services/auth.service.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { R2Service } from '../../src/services/r2.service.js';

describe('Admin R2 Telemetry & Quota Endpoint Tests', () => {
  let app: FastifyInstance;
  let validToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    validToken = AuthService.generateSessionToken();
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();
  });

  it('rejects unauthenticated requests to /api/v1/admin/r2-stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/r2-stats'
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('rejects requests with invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/r2-stats',
      headers: {
        'x-storage-auth': 'invalid_token_123'
      }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
  });

  it('returns complete R2 metrics with valid x-storage-auth token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/r2-stats',
      headers: {
        'x-storage-auth': validToken
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const data = body.data;
    expect(data.month).toMatch(/^\d{4}-\d{2}$/);
    expect(typeof data.classA).toBe('number');
    expect(typeof data.classB).toBe('number');
    expect(typeof data.totalRequests).toBe('number');
    expect(typeof data.maxMonthlyRequests).toBe('number');
    expect(typeof data.remainingRequests).toBe('number');
    expect(typeof data.percentUsed).toBe('number');
    expect(data.freeTier).toEqual({
      maxMonthlyClassA: 1_000_000,
      maxMonthlyClassB: 10_000_000,
      maxStorageGb: 10
    });
    expect(data.liveStorage).toBeDefined();
  });

  it('returns identical telemetry via /api/v1/auth/r2-stats alias', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/r2-stats',
      headers: {
        'x-storage-auth': validToken
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.month).toBe(R2Service.getMetrics().month);
  });
});
