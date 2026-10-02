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
    apiKey: z.string().optional()
  })
  .transform((data) => ({
    ...data,
    gdriveUrl: data.gdriveUrl || data.driveUrl,
    startNum: data.startNum || data.start || 1
  }))
  .refine((data) => Boolean(data.fileId || data.gdriveUrl), {
    message: 'Cần cung cấp tệp PDF nguồn (fileId) hoặc liên kết Google Drive (gdriveUrl)'
  });

export type CreateQuizJobInput = z.infer<typeof createQuizJobSchema>;

export const parsePromptSchema = z.object({
  prompt: z.string().min(1, 'Vui lòng nhập câu lệnh prompt')
});

export type ParsePromptInput = z.infer<typeof parsePromptSchema>;
