import { z } from 'zod';

export const pdfOperationSchema = z.enum([
  'compress', 'convert', 'merge', 'split', 'lock', 'unlock',
  'rotate', 'images_to_pdf', 'watermark', 'extract_images',
  'organize', 'pdf_to_docx'
]);
export type PdfOperation = z.infer<typeof pdfOperationSchema>;

export const pdfCompressionLevelSchema = z.enum(['low', 'medium', 'high']);
export type PdfCompressionLevel = z.infer<typeof pdfCompressionLevelSchema>;

export const pdfJobOptionsSchema = z
  .object({
    compressionLevel: pdfCompressionLevelSchema.optional(),
    targetDpi: z.number().int().positive().optional(),
    stripMetadata: z.boolean().optional(),
    password: z.string().optional(),
    targetFormat: z.string().optional(),
    angle: z.number().optional(),
    pages: z.string().optional(),
    order: z.array(z.number()).optional(),
    watermarkText: z.string().optional(),
    watermarkPosition: z.enum(['center', 'top', 'bottom']).optional(),
    watermarkOpacity: z.number().min(0).max(1).optional(),
    pageNumbers: z.boolean().optional(),
    rotations: z.record(z.string(), z.number()).optional(),
    fileIds: z.array(z.string()).optional(),
    streamTable: z.boolean().optional(),
    forceStreamTable: z.boolean().optional()
  })
  .optional()
  .default({});

export type PdfJobOptions = z.infer<typeof pdfJobOptionsSchema>;

export const enqueuePdfJobSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  operation: pdfOperationSchema,
  options: pdfJobOptionsSchema
});

export type EnqueuePdfJobInput = z.infer<typeof enqueuePdfJobSchema>;

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1, 'jobId is required')
});

export type JobIdParam = z.infer<typeof jobIdParamSchema>;
