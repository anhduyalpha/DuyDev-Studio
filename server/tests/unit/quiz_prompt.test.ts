import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('Quiz Prompt Intent Extraction Unit Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('correctly extracts pages, question range (start & count = end - start + 1), and prefix for "trang 12 câu 18 đến 28"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quiz/parse-prompt',
      payload: {
        prompt: 'trang 12 câu 18 đến 28'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.pages).toBe('12');
    expect(json.data.start).toBe(18);
    expect(json.data.count).toBe(11); // 28 - 18 + 1 = 11
    expect(json.data.prefix).toBe('Trang_12_Cau_18_28');
  });

  it('correctly extracts pages, start, count from "lấy 25 câu từ câu 5 trang 3"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quiz/parse-prompt',
      payload: {
        prompt: 'lấy 25 câu từ câu 5 trang 3'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.pages).toBe('3');
    expect(json.data.start).toBe(5);
    expect(json.data.count).toBe(25);
  });

  it('correctly extracts "từ câu 1 đến 20 trang 11"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quiz/parse-prompt',
      payload: {
        prompt: 'từ câu 1 đến 20 trang 11'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.pages).toBe('11');
    expect(json.data.start).toBe(1);
    expect(json.data.count).toBe(20);
    expect(json.data.prefix).toBe('Trang_11_Cau_1_20');
  });

  it('handles prompt with only page number safely with defaults', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quiz/parse-prompt',
      payload: {
        prompt: 'trang 15'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.pages).toBe('15');
    expect(json.data.start).toBe(1);
    expect(json.data.count).toBe(20);
  });

  it('rejects empty prompt with 400 validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quiz/parse-prompt',
      payload: {
        prompt: ''
      }
    });

    expect(res.statusCode).toBe(400);
  });
});
