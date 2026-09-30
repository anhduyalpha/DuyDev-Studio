import { z } from 'zod';

export const inspectArchiveSchema = z.object({
  fileId: z.string().optional(),
  drivePath: z.string().optional(),
  auth: z.string().optional()
}).refine((data) => Boolean(data.fileId || data.drivePath), {
  message: 'fileId or drivePath is required'
});

export type InspectArchiveInput = z.infer<typeof inspectArchiveSchema>;

export const inspectNestedArchiveSchema = z.object({
  parentFileId: z.string().min(1, 'parentFileId is required'),
  memberPath: z.string().min(1, 'memberPath is required')
});

export type InspectNestedArchiveInput = z.infer<typeof inspectNestedArchiveSchema>;

export const extractFileQuerySchema = z.object({
  fileId: z.string().optional(),
  drivePath: z.string().optional(),
  memberPath: z.string().min(1, 'memberPath is required'),
  inline: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false),
  auth: z.string().optional(),
  token: z.string().optional()
}).refine((data) => Boolean(data.fileId || data.drivePath), {
  message: 'fileId or drivePath is required'
});

export type ExtractFileQueryInput = z.infer<typeof extractFileQuerySchema>;

export const compressArchiveSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1, 'At least one file is required to create an archive'),
  archiveName: z.string().optional().default('archive.zip'),
  format: z.enum(['zip', 'tar', '7z', 'tar.gz']).optional().default('zip'),
  compressionLevel: z.enum(['fast', 'normal', 'maximum']).optional().default('normal')
});

export type CompressArchiveInput = z.infer<typeof compressArchiveSchema>;
