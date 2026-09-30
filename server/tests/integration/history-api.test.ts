import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

describe('History & Trash Bin API Integration Tests', () => {
  let app: FastifyInstance;
  let testRecordId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.historyRecord.deleteMany({
        where: { id: { in: createdIds } }
      });
    }
    await app.close();
  });

  it('POST /api/v1/history should create a history item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/history',
      payload: {
        toolId: 'universal-converter',
        toolTitle: 'File Converter Pro',
        fileName: 'report_converted.webp',
        originalSize: 102400,
        resultSize: 45000,
        downloadUrl: '/api/v1/files/download/test123'
      }
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.fileName).toBe('report_converted.webp');
    expect(json.data.originalSize).toBe(102400);
    expect(json.data.resultSize).toBe(45000);
    expect(json.data.isDeleted).toBe(false);
    testRecordId = json.data.id;
    createdIds.push(testRecordId);
  });

  it('GET /api/v1/history should return active history items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/history'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.items.some((item: any) => item.id === testRecordId)).toBe(true);
  });

  it('DELETE /api/v1/history/:id should soft-delete item to trash', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/history/${testRecordId}`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.isDeleted).toBe(true);
  });

  it('GET /api/v1/history should not return soft-deleted items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/history'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.data.items.some((item: any) => item.id === testRecordId)).toBe(false);
  });

  it('GET /api/v1/trash should return soft-deleted items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trash'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.items.some((item: any) => item.id === testRecordId)).toBe(true);
  });

  it('POST /api/v1/trash/:id/restore should restore item from trash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trash/${testRecordId}/restore`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.isDeleted).toBe(false);

    // Verify back in history
    const histRes = await app.inject({ method: 'GET', url: '/api/v1/history' });
    expect(JSON.parse(histRes.body).data.items.some((item: any) => item.id === testRecordId)).toBe(true);
  });

  it('DELETE /api/v1/trash/:id should permanently delete item', async () => {
    // Soft delete first
    await app.inject({ method: 'DELETE', url: `/api/v1/history/${testRecordId}` });

    // Permanently delete
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trash/${testRecordId}`
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);

    // Verify gone from both
    const histRes = await app.inject({ method: 'GET', url: '/api/v1/history' });
    expect(JSON.parse(histRes.body).data.items.some((item: any) => item.id === testRecordId)).toBe(false);
    const trashRes = await app.inject({ method: 'GET', url: '/api/v1/trash' });
    expect(JSON.parse(trashRes.body).data.items.some((item: any) => item.id === testRecordId)).toBe(false);
  });
});
