import { z } from 'zod';

export const createDynamicQrSchema = z.object({
  targetUrl: z
    .string()
    .min(1, 'URL đích không được để trống')
    .refine((url) => /^https?:\/\//i.test(url.trim()), {
      message: 'URL phải bắt đầu bằng http:// hoặc https://'
    }),
  title: z.string().max(100, 'Tiêu đề không được vượt quá 100 ký tự').optional(),
  customSlug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/, 'Slug phải từ 3 đến 32 ký tự chữ, số hoặc gạch ngang')
    .optional()
});

export type CreateDynamicQrInput = z.infer<typeof createDynamicQrSchema>;

export const updateDynamicQrSchema = z.object({
  targetUrl: z
    .string()
    .refine((url) => /^https?:\/\//i.test(url.trim()), {
      message: 'URL phải bắt đầu bằng http:// hoặc https://'
    })
    .optional(),
  title: z.string().max(100, 'Tiêu đề không được vượt quá 100 ký tự').optional(),
  isActive: z.boolean().optional()
});

export type UpdateDynamicQrInput = z.infer<typeof updateDynamicQrSchema>;

export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug không được để trống')
});

export type SlugParam = z.infer<typeof slugParamSchema>;
