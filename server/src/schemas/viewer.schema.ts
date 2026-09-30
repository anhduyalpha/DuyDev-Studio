import { z } from 'zod';

export const previewPdfQuerySchema = z.object({
  fileId: z.string().optional(),
  path: z.string().optional(),
  auth: z.string().optional(),
  token: z.string().optional()
});

export type PreviewPdfQuery = z.infer<typeof previewPdfQuerySchema>;
