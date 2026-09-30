import { z } from 'zod';

export const uploadPurposeSchema = z.enum([
  'pdf-convert',
  'archive-inspect',
  'archive-compress',
  'media-transcode',
  'universal-converter'
]);
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

export const uploadFileQuerySchema = z.object({
  purpose: uploadPurposeSchema.optional().default('pdf-convert')
});

export const fileIdParamSchema = z.object({
  fileId: z.string().min(1, 'fileId is required')
});

export type FileIdParam = z.infer<typeof fileIdParamSchema>;

export const fileDownloadQuerySchema = z.object({
  inline: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false)
});

export type FileDownloadQuery = z.infer<typeof fileDownloadQuerySchema>;

