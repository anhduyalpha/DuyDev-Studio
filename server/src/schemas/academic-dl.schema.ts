import { z } from 'zod';

export const academicResolveBodySchema = z.object({
  url: z.string().min(1, 'URL không được để trống').url('URL không hợp lệ')
});

export const academicStreamQuerySchema = z.object({
  url: z.string().min(1, 'URL không được để trống'),
  download: z.union([z.boolean(), z.string()]).optional(),
  filename: z.string().optional()
});

export const academicSaveDriveBodySchema = z.object({
  url: z.string().min(1, 'URL không được để trống'),
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  id: z.string().min(1, 'ID không được để trống'),
  originalUrl: z.string().optional(),
  cover: z.string().optional(),
  author: z.string().optional(),
  slideImages: z.array(z.string()).optional(),
  pageCount: z.number().int().nonnegative().optional(),
  overwrite: z.boolean().optional(),
  category: z.enum(['slideshare', 'academia', 'researchgate']).default('slideshare')
});

export const academicCheckDuplicateSchema = z.object({
  id: z.string().min(1, 'ID không được để trống'),
  url: z.string().optional(),
  category: z.enum(['slideshare', 'academia', 'researchgate']).default('slideshare')
});
