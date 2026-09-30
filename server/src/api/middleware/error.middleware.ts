/**
 * Global Fastify Error Handling Middleware
 * Converts AppError and uncaught exceptions into uniform JSON format
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) {
  const timestamp = new Date().toISOString();
  const requestId = (request.id as string) || `req_${Date.now()}`;

  // Handle known AppError
  if (error instanceof AppError) {
    logger.warn({
      requestId,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    }, 'Application business error');

    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
        timestamp
      }
    });
  }

  // Handle Zod Validation Error
  if (error instanceof ZodError) {
    logger.warn({ requestId, issues: error.issues }, 'Zod schema validation failed');

    return reply.status(400).send({
      success: false,
      error: {
        code: 'BAD_REQUEST_PAYLOAD',
        message: 'Schema validation error',
        details: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        })),
        requestId,
        timestamp
      }
    });
  }

  // Handle Fastify schema validation errors
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'BAD_REQUEST_PAYLOAD',
        message: error.message,
        details: error.validation,
        requestId,
        timestamp
      }
    });
  }

  // Handle client-level HTTP errors (4xx) with defined statusCode
  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
    logger.warn({ requestId, statusCode: error.statusCode, err: error.message }, 'Client request rejected');
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: (error as any).code || 'CLIENT_ERROR',
        message: error.message,
        requestId,
        timestamp
      }
    });
  }

  // Unhandled / Internal Server Error
  logger.error({ requestId, err: error }, 'Unhandled internal server error');

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred.',
      requestId,
      timestamp
    }
  });
}
