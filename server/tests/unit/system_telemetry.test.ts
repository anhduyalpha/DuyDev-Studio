import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';

describe('System Telemetry Route (/api/v1/system/telemetry)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();
  });

  it('returns valid system telemetry with uptime, memory, redis, and queue stats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/system/telemetry'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const data = body.data;
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.memoryMb).toBe('number');
    expect(typeof data.redis).toBe('string');
    expect(data.queues).toBeDefined();
    expect(typeof data.queues.totalActive).toBe('number');
  });
});
