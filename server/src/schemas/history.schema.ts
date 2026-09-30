import { z } from 'zod';

export const createHistorySchema = z.object({
  toolId: z.string().min(1, 'toolId is required'),
  toolTitle: z.string().min(1, 'toolTitle is required'),
  fileName: z.string().min(1, 'fileName is required'),
  originalSize: z.number().int().nonnegative().optional().default(0),
  resultSize: z.number().int().nonnegative().optional().default(0),
  resultFileId: z.string().optional().nullable(),
  downloadUrl: z.string().optional().nullable(),
  status: z.string().optional().default('success'),
  detailsJson: z.string().optional().nullable()
});

export type CreateHistoryInput = z.infer<typeof createHistorySchema>;

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0)
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;

export const historyIdParamSchema = z.object({
  id: z.string().min(1, 'id is required')
});

export type HistoryIdParam = z.infer<typeof historyIdParamSchema>;
