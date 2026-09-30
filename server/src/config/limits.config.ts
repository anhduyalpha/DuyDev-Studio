/**
 * Operational Limits & System Constraints
 * Permanent retention until user explicitly deletes (FILE_TTL_MINUTES <= 0)
 */

import { env } from './env.config.js';

export const isPermanentRetention = env.FILE_TTL_MINUTES <= 0;

export function computeExpiresAt(): Date {
  if (isPermanentRetention) {
    return new Date('2099-12-31T23:59:59.999Z');
  }
  return new Date(Date.now() + env.FILE_TTL_MINUTES * 60 * 1000);
}

export const limits = {
  maxUploadSizeBytes: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  fileTtlMs: isPermanentRetention ? 100 * 365 * 24 * 3600 * 1000 : env.FILE_TTL_MINUTES * 60 * 1000,
  janitorIntervalMs: env.JANITOR_INTERVAL_MINUTES * 60 * 1000,
  maxPdfPagesPreview: 50,
  workerConcurrency: {
    pdf: 4,
    media: 3
  },
  timeouts: {
    pdfProcessMs: 1800_000,     // 30 minutes
    mediaTranscodeMs: 3600_000  // 60 minutes
  }
};
