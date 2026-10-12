import { z } from 'zod';

export const createQuizJobSchema = z
  .object({
    fileId: z.string().optional(),
    gdriveUrl: z.string().optional(),
    driveUrl: z.string().optional(),
    pages: z.string().min(1, 'Vui lòng cung cấp phạm vi trang cần trích xuất'),
    count: z.number().int().min(1).max(100).default(20),
    startNum: z.number().int().min(1).optional(),
    start: z.number().int().min(1).optional(),
    title: z.string().min(1).default('BÀI TẬP TRẮC NGHIỆM HÓA HỌC 12'),
    subtitle: z.string().optional().default(''),
    prefix: z.string().trim().min(1, 'Vui lòng nhập Tên File (Bắt buộc)'),
    duration: z.string().optional(),
    apiKey: z.string().optional(),
    stylePresetId: z.string().optional().default('blue_black_classic'),
    parity_filter: z.enum(['all', 'odd', 'even']).optional(),
    parityFilter: z.enum(['all', 'odd', 'even']).optional(),
    section_filter: z.enum(['all', 'part_i', 'part_ii', 'part_iii']).optional(),
    sectionFilter: z.enum(['all', 'part_i', 'part_ii', 'part_iii']).optional(),
    detected_questions: z.array(z.number().int()).optional(),
    detectedQuestions: z.array(z.number().int()).optional(),
    instruction: z.string().optional()
  })
  .transform((data) => ({
    ...data,
    gdriveUrl: data.gdriveUrl || data.driveUrl,
    startNum: data.startNum || data.start || 1,
    parity_filter: data.parity_filter || data.parityFilter || 'all',
    parityFilter: data.parity_filter || data.parityFilter || 'all',
    section_filter: data.section_filter || data.sectionFilter || 'all',
    sectionFilter: data.section_filter || data.sectionFilter || 'all',
    detected_questions: data.detected_questions || data.detectedQuestions,
    detectedQuestions: data.detected_questions || data.detectedQuestions
  }))
  .refine((data) => Boolean(data.fileId || data.gdriveUrl), {
    message: 'Cần cung cấp tệp PDF nguồn (fileId) hoặc liên kết Google Drive (gdriveUrl)'
  });

export type CreateQuizJobInput = z.infer<typeof createQuizJobSchema>;

export const parsePromptSchema = z
  .object({
    prompt: z.string().optional(),
    instruction: z.string().optional(),
    fileId: z.string().optional(),
    gdriveUrl: z.string().optional()
  })
  .refine((data) => Boolean(data.prompt?.trim() || data.instruction?.trim()), {
    message: 'Vui lòng nhập câu lệnh prompt'
  });

export type ParsePromptInput = z.infer<typeof parsePromptSchema>;

export const questionTypeSchema = z.enum(['mcq', 'true_false_group', 'short_answer']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const trueFalseStatementSchema = z.object({
  text: z.string(),
  is_correct: z.boolean()
});

export const quizQuestionSchema = z.object({
  number: z.number().int(),
  type: questionTypeSchema.default('mcq'),
  question: z.string(),
  image_ref: z.string().nullable().optional(),
  options: z.record(z.string()).optional(),
  statements: z.record(trueFalseStatementSchema).optional(),
  answer: z.string(),
  explanation: z.string().optional()
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizJobResultSchema = z.object({
  jobId: z.string(),
  percentage: z.number(),
  worksheet: z.object({
    fileId: z.string(),
    fileName: z.string(),
    sizeBytes: z.number(),
    pages: z.number(),
    downloadUrl: z.string(),
    viewUrl: z.string()
  }),
  answer: z.object({
    fileId: z.string(),
    fileName: z.string(),
    sizeBytes: z.number(),
    pages: z.number(),
    downloadUrl: z.string(),
    viewUrl: z.string()
  }),
  questionsCount: z.number(),
  extractedImagesCount: z.number().default(0),
  questionTypes: z.object({
    mcq: z.number().default(0),
    true_false: z.number().default(0),
    short_answer: z.number().default(0)
  })
});

export type QuizJobResult = z.infer<typeof quizJobResultSchema>;
