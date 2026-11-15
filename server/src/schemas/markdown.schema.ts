import { z } from 'zod';
import path from 'path';

export const markdownExportSchema = z.object({
  format: z.enum(['docx', 'pdf']),
  markdown: z
    .string()
    .trim()
    .min(1, 'Markdown content cannot be empty')
    .max(10 * 1024 * 1024, 'Markdown content exceeds maximum limit (10MB)'),
  filename: z.string().optional()
});

export type MarkdownExportInput = z.infer<typeof markdownExportSchema>;

/**
 * Sanitizes user-provided filename preventing path traversal, null-byte injection,
 * and Windows/POSIX illegal characters.
 */
export function sanitizeMarkdownFilename(raw?: string): string {
  if (!raw || typeof raw !== 'string') {
    return 'document';
  }

  // Strip null bytes and control chars
  let clean = raw.replace(/[\x00-\x1f\x7f]/g, '');

  // Extract basename across both Windows and POSIX path separators in case path traversal was attempted
  clean = path.posix.basename(clean.replace(/\\/g, '/'));

  // Strip illegal Windows / POSIX file characters: : * ? " < > | / \
  clean = clean.replace(/[:*?"<>|/\\]/g, '');

  // Strip any trailing extension if caller passed it with extension
  clean = clean.replace(/\.(docx|pdf|md|markdown|txt|html)$/i, '');

  // Strip leading and trailing periods, spaces
  clean = clean.trim().replace(/^\.+|\.+$/g, '');

  if (!clean || clean.length === 0) {
    return 'document';
  }

  return clean.slice(0, 100);
}
