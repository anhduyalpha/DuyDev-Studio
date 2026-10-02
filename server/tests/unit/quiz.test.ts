import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createQuizJobSchema, parsePromptSchema } from '../../src/schemas/quiz.schema.js';
import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';

describe('Quiz Module Unit & Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Zod Schema Validation', () => {
    it('validates a correct payload with fileId and parameters', () => {
      const payload = {
        fileId: 'fil_test_123',
        pages: '1,2,3',
        count: 20,
        startNum: 1,
        title: 'BÀI TẬP TRẮC NGHIỆM',
        subtitle: 'CHUYÊN ĐỀ HÓA HỌC',
        prefix: 'HoaHoc_12'
      };
      const result = createQuizJobSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(20);
        expect(result.data.startNum).toBe(1);
        expect(result.data.prefix).toBe('HoaHoc_12');
      }
    });

    it('validates a payload with driveUrl and alias defaults', () => {
      const payload = {
        driveUrl: 'https://drive.google.com/file/d/123456789/view?usp=sharing',
        pages: '1-5',
        count: 10
      };
      const result = createQuizJobSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(10);
        expect(result.data.startNum).toBe(1);
        expect(result.data.gdriveUrl).toBe(payload.driveUrl);
        expect(result.data.prefix).toBe('Quiz_A4');
      }
    });

    it('rejects a payload when both fileId and driveUrl are missing', () => {
      const payload = {
        pages: '1,2,3',
        count: 20
      };
      const result = createQuizJobSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Cần cung cấp tệp PDF nguồn');
      }
    });

    it('clamps count between 1 and 100', () => {
      const payloadTooHigh = {
        fileId: 'fil_test_123',
        pages: '1',
        count: 150
      };
      const result = createQuizJobSchema.safeParse(payloadTooHigh);
      expect(result.success).toBe(false);

      const payloadTooLow = {
        fileId: 'fil_test_123',
        pages: '1',
        count: 0
      };
      const result2 = createQuizJobSchema.safeParse(payloadTooLow);
      expect(result2.success).toBe(false);
    });

    it('validates parsePromptSchema', () => {
      expect(parsePromptSchema.safeParse({ prompt: 'Làm đề trang 11' }).success).toBe(true);
      expect(parsePromptSchema.safeParse({ prompt: '' }).success).toBe(false);
      expect(parsePromptSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('Prompt Intent Parser Endpoint', () => {
    it('parses page, start, and end range via Vietnamese regex', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/quiz/parse-prompt',
        payload: {
          prompt: 'Làm bài tập từ trang 11 từ câu 1 đến câu 20'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.pages).toBe('11');
      expect(json.data.start).toBe(1);
      expect(json.data.count).toBe(20);
      expect(json.data.source).toBe('regex');
    });

    it('parses comma-separated pages and explicit question count', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/quiz/parse-prompt',
        payload: {
          prompt: 'trang 4,5,6 làm 15 câu bắt đầu từ câu 10'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.pages).toBe('4,5,6');
      expect(json.data.count).toBe(15);
      expect(json.data.start).toBe(10);
      expect(json.data.source).toBe('regex');
    });

    it('returns 400 for empty prompt', async () => {
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

  describe('Generate Quiz Job Route', () => {
    it('returns 400 when missing source in generate request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/quiz/generate',
        payload: {
          pages: '1-5',
          count: 10
        }
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.body);
      expect(json.error).toBeDefined();
    });
  });
});
