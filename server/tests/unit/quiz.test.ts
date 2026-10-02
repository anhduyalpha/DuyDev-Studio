import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createQuizJobSchema,
  parsePromptSchema,
  quizQuestionSchema,
  quizJobResultSchema
} from '../../src/schemas/quiz.schema.js';
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
        count: 10,
        prefix: 'HoaHoc_12'
      };
      const result = createQuizJobSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(10);
        expect(result.data.startNum).toBe(1);
        expect(result.data.gdriveUrl).toBe(payload.driveUrl);
        expect(result.data.prefix).toBe('HoaHoc_12');
      }
    });

    it('rejects a payload when prefix is missing or empty', () => {
      const payload = {
        fileId: 'fil_test_123',
        pages: '1',
        prefix: ''
      };
      const result = createQuizJobSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Tên File (Bắt buộc)');
      }
    });

    it('rejects a payload when both fileId and driveUrl are missing', () => {
      const payload = {
        pages: '1,2,3',
        count: 20,
        prefix: 'Test'
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

    it('validates multi-format question schemas (MCQ, True/False, Short Answer)', () => {
      // 1. MCQ
      const mcq = {
        number: 1,
        type: 'mcq',
        question: 'Este nào sau đây có mùi chuối chín?',
        image_ref: 'fig_p1_1.png',
        options: { A: 'Isoamyl axetat', B: 'Etyl fomat', C: 'Benzyl axetat', D: 'Metyl acrylat' },
        answer: 'A',
        explanation: 'Isoamyl axetat có mùi chuối chín đặc trưng.'
      };
      expect(quizQuestionSchema.safeParse(mcq).success).toBe(true);

      // 2. True/False Group
      const tf = {
        number: 2,
        type: 'true_false_group',
        question: 'Cho các phát biểu sau về kim loại kiềm:',
        image_ref: null,
        statements: {
          a: { text: 'Đều có mạng tinh thể lập phương tâm khối', is_correct: true },
          b: { text: 'Nhiệt độ nóng chảy tăng dần từ Li đến Cs', is_correct: false },
          c: { text: 'Đều có tính khử mạnh', is_correct: true },
          d: { text: 'Phản ứng mãnh liệt với nước', is_correct: true }
        },
        answer: 'a-Đ, b-S, c-Đ, d-Đ',
        explanation: 'Nhiệt độ nóng chảy giảm dần từ Li đến Cs.'
      };
      expect(quizQuestionSchema.safeParse(tf).success).toBe(true);

      // 3. Short Answer
      const sa = {
        number: 3,
        type: 'short_answer',
        question: 'Tính khối lượng mol phân tử (g/mol) của C4H8O2.',
        answer: '88',
        explanation: 'M = 12*4 + 8 + 32 = 88.'
      };
      expect(quizQuestionSchema.safeParse(sa).success).toBe(true);
    });

    it('validates full quizJobResultSchema with telemetry metrics', () => {
      const resultPayload = {
        jobId: 'job_test_123',
        percentage: 100,
        worksheet: {
          fileId: 'fil_ws_1',
          fileName: 'HoaHoc12_DeBai.pdf',
          sizeBytes: 120450,
          pages: 3,
          downloadUrl: '/api/v1/files/download/fil_ws_1/HoaHoc12_DeBai.pdf',
          viewUrl: '/api/v1/files/view/fil_ws_1'
        },
        answer: {
          fileId: 'fil_ans_1',
          fileName: 'HoaHoc12_DapAn.pdf',
          sizeBytes: 95000,
          pages: 2,
          downloadUrl: '/api/v1/files/download/fil_ans_1/HoaHoc12_DapAn.pdf',
          viewUrl: '/api/v1/files/view/fil_ans_1'
        },
        questionsCount: 28,
        extractedImagesCount: 4,
        questionTypes: {
          mcq: 18,
          true_false: 4,
          short_answer: 6
        }
      };
      const parsed = quizJobResultSchema.safeParse(resultPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.extractedImagesCount).toBe(4);
        expect(parsed.data.questionTypes.mcq).toBe(18);
        expect(parsed.data.questionTypes.true_false).toBe(4);
        expect(parsed.data.questionTypes.short_answer).toBe(6);
      }
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
      expect(['ai', 'regex']).toContain(json.data.source);
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
      expect(['ai', 'regex']).toContain(json.data.source);
    });

    it('parses topic prefix and generates title from prompt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/quiz/parse-prompt',
        payload: {
          prompt: 'Trang 12, 11 câu, từ câu 18, Ester Lipid'
        }
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.data.pages).toBe('12');
      expect(json.data.count).toBe(11);
      expect(json.data.start).toBe(18);
      expect(typeof json.data.prefix).toBe('string');
      expect(json.data.prefix.length).toBeGreaterThan(0);
      expect(json.data.title).toMatch(/BÀI TẬP TRẮC NGHIỆM.*12/i);
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
