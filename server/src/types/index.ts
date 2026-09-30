/**
 * Shared Type Definitions & Domain Interfaces
 * DuyDev Studio Backend Service
 */

export type JobStatusType = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
export type FilePurposeType = 'UPLOAD' | 'PROCESSED_ARTIFACT' | 'TEMPORARY_SCRATCH';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorResponse;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface JobProgressEvent {
  jobId: string;
  percentage: number;
  stage: string;
  timestamp: number;
}

export interface JobCompletedEvent {
  jobId: string;
  percentage: number;
  resultFileId: string;
  resultSizeBytes: number;
  originalSizeBytes: number;
  savingsPct?: number;
  downloadUrl: string;
}

export interface JobFailedEvent {
  jobId: string;
  error: string;
  timestamp: number;
}

export interface ArchiveFileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  compressedBytes: number;
  compressionRatio: number;
  crc32?: string;
  lastModified?: string;
}

export interface ArchiveInspectionResult {
  archiveName: string;
  totalFiles: number;
  totalUncompressedBytes: number;
  totalCompressedBytes: number;
  format: string;
  tree: ArchiveFileEntry[];
  entries: ArchiveFileEntry[];
}
