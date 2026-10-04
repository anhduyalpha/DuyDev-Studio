/**
 * Application Error Architecture
 * Standardized Exception classes and error code registry
 */

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly details: unknown = null
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const ErrorCodes = {
  BAD_REQUEST_PAYLOAD: 'BAD_REQUEST_PAYLOAD',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  FILE_SIZE_LIMIT_EXCEEDED: 'FILE_SIZE_LIMIT_EXCEEDED',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  SECURITY_EXCEPTION: 'SECURITY_EXCEPTION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const QuizErrorCodes = {
  PDF_INVALID: 'PDF_INVALID',
  SOURCE_FETCH_FAILED: 'SOURCE_FETCH_FAILED',
  PDF_UNSUPPORTED: 'PDF_UNSUPPORTED',
  PDF_SCAN_TOO_LOW_QUALITY: 'PDF_SCAN_TOO_LOW_QUALITY',
  NO_QUESTIONS_FOUND: 'NO_QUESTIONS_FOUND',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_INVALID_OUTPUT: 'AI_INVALID_OUTPUT',
  RENDER_FAILED: 'RENDER_FAILED',
  QA_FAILED: 'QA_FAILED',
} as const;

export class BadRequestError extends AppError {
  constructor(message: string, details: unknown = null) {
    super(message, 400, ErrorCodes.BAD_REQUEST_PAYLOAD, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access', details: unknown = null) {
    super(message, 401, ErrorCodes.UNAUTHORIZED_ACCESS, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details: unknown = null) {
    super(message, 404, ErrorCodes.RESOURCE_NOT_FOUND, details);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Unsupported media type', details: unknown = null) {
    super(message, 415, ErrorCodes.UNSUPPORTED_MEDIA_TYPE, details);
  }
}

export class FileCorruptedError extends AppError {
  constructor(message: string = 'File structure is corrupted or invalid', details: unknown = null) {
    super(message, 422, ErrorCodes.FILE_CORRUPTED, details);
  }
}

export class FileSizeLimitError extends AppError {
  constructor(message: string = 'File size exceeds maximum limit', details: unknown = null) {
    super(message, 413, ErrorCodes.FILE_SIZE_LIMIT_EXCEEDED, details);
  }
}

export class SecurityException extends AppError {
  constructor(message: string = 'Security violation detected', details: unknown = null) {
    super(message, 403, ErrorCodes.SECURITY_EXCEPTION, details);
  }
}
