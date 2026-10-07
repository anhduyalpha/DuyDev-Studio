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

export const presignTransitBodySchema = z.object({
  fileName: z.string().min(1, 'fileName is required'),
  fileSize: z.number().nonnegative().optional(),
  mimeType: z.string().optional(),
  purpose: z.string().optional().default('pdf-convert'),
  targetDir: z.string().optional(),
  forceR2: z.boolean().optional().default(false)
});

export type PresignTransitBody = z.infer<typeof presignTransitBodySchema>;

export const batchPresignBodySchema = z.object({
  files: z.array(presignTransitBodySchema).min(1).max(50)
});

export type BatchPresignBody = z.infer<typeof batchPresignBodySchema>;

export const completeTransitBodySchema = z.object({
  fileKey: z.string().min(1, 'fileKey is required'),
  fileId: z.string().regex(/^fil_[a-zA-Z0-9_]+$/, 'Invalid fileId format'),
  originalName: z.string().min(1, 'originalName is required'),
  mimeType: z.string().optional(),
  purpose: z.string().optional().default('pdf-convert'),
  targetDir: z.string().optional(),
  sizeBytes: z.number().nonnegative().optional()
});

export type CompleteTransitBody = z.infer<typeof completeTransitBodySchema>;

export const importDriveBodySchema = z.object({
  url: z.string().min(1, 'URL Google Drive là bắt buộc'),
  purpose: uploadPurposeSchema.optional().default('pdf-convert')
});

export type ImportDriveBody = z.infer<typeof importDriveBodySchema>;

