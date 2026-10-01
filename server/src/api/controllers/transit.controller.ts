/**
 * Transit Controller
 * Orchestrates Cloudflare R2 presigned uploads, LAN bypass routing,
 * and atomic server ingestion with instant R2 purging.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import { prisma } from '../../lib/prisma.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { computeExpiresAt, limits } from '../../config/limits.config.js';
import { env } from '../../config/env.config.js';
import { BadRequestError, FileSizeLimitError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { R2Service } from '../../services/r2.service.js';
import { presignTransitBodySchema, completeTransitBodySchema } from '../../schemas/files.schema.js';

export function isLanRequest(request: FastifyRequest): boolean {
  // If CF-Connecting-IP header is present, request entered via Cloudflare Edge (WAN)
  const cfConnectingIp = request.headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return false;
  }

  const hostHeader = (request.headers['host'] || request.hostname || '').toLowerCase();
  if (hostHeader.includes('alphadaniel.io.vn') || hostHeader.includes('cloudflare')) {
    return false;
  }

  const rawIp = request.ip || request.socket.remoteAddress || '';
  const cleanIp = rawIp.replace(/^::ffff:/, '');
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp) ||
    hostHeader.startsWith('192.168.') ||
    hostHeader.startsWith('localhost') ||
    hostHeader.startsWith('127.0.0.1')
  ) {
    return true;
  }

  return false;
}

export async function presignTransitUpload(request: FastifyRequest, reply: FastifyReply) {
  const body = presignTransitBodySchema.parse(request.body);
  const { fileName, fileSize, mimeType, purpose } = body;
  const isForceR2 = (request.query as Record<string, unknown>)?.forceR2 === 'true';

  if (fileSize && fileSize > limits.maxUploadSizeBytes) {
    throw new FileSizeLimitError(`File exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB`);
  }

  // 1. LAN Auto-Bypass: If request is within local network, return direct upload endpoint to save R2 quota
  if (!isForceR2 && isLanRequest(request)) {
    logger.debug({ ip: request.ip, host: request.headers.host }, 'LAN detected: routing to direct upload');
    return reply.status(200).send({
      success: true,
      data: {
        mode: 'direct',
        uploadUrl: `/api/v1/files/upload?purpose=${encodeURIComponent(purpose || 'pdf-convert')}`
      }
    });
  }

  // 2. Check if R2 is enabled and circuit breaker quota has not tripped
  if (!R2Service.isAvailable()) {
    logger.info('R2 unavailable or quota exceeded: falling back to direct upload');
    return reply.status(200).send({
      success: true,
      data: {
        mode: 'direct',
        uploadUrl: `/api/v1/files/upload?purpose=${encodeURIComponent(purpose || 'pdf-convert')}`
      }
    });
  }

  // 3. Generate Cloudflare R2 Presigned Upload URL
  const { presignedUrl, fileKey, fileId, sanitizedName } = await R2Service.generatePresignedUploadUrl(
    fileName,
    mimeType || 'application/octet-stream',
    fileSize
  );

  return reply.status(200).send({
    success: true,
    data: {
      mode: 'r2',
      presignedUrl,
      fileKey,
      fileId,
      sanitizedName
    }
  });
}

export async function completeTransitUpload(request: FastifyRequest, reply: FastifyReply) {
  const body = completeTransitBodySchema.parse(request.body);
  const { fileKey, fileId, originalName, mimeType, purpose, sizeBytes } = body;

  // Security guard against path traversal or non-transit key manipulation
  if (!fileKey.startsWith('transit/') || fileKey.includes('..')) {
    throw new BadRequestError('Invalid or unauthorized transit fileKey');
  }

  if (!/^fil_[a-zA-Z0-9_]+$/.test(fileId)) {
    throw new BadRequestError('Invalid fileId format');
  }

  if (sizeBytes && sizeBytes > limits.maxUploadSizeBytes) {
    throw new FileSizeLimitError(`File exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB`);
  }

  const safeOriginalName = path.basename(originalName) || 'file.bin';
  const ext = path.extname(safeOriginalName) || '.bin';
  const targetPath = StorageManager.getUploadPath(fileId, ext);

  // Ingest stream from R2 directly to disk and delete from R2 upon success
  const { byteCount, hashSha256 } = await R2Service.ingestAndPurgeTransitObject(fileKey, targetPath);

  const expiresAt = computeExpiresAt();

  const fileRecord = await prisma.fileRecord.create({
    data: {
      id: fileId,
      purpose: 'UPLOAD',
      originalName: safeOriginalName,
      storagePath: targetPath,
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: BigInt(byteCount),
      hashSha256,
      isPurged: false,
      expiresAt
    }
  });

  logger.info(
    { fileId: fileRecord.id, originalName: fileRecord.originalName, sizeBytes: byteCount, purpose },
    'R2 transit upload ingested and purged successfully'
  );

  return reply.status(201).send({
    success: true,
    data: {
      fileId: fileRecord.id,
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      sizeBytes: Number(fileRecord.sizeBytes),
      hashSha256: fileRecord.hashSha256,
      expiresAt: fileRecord.expiresAt.toISOString()
    }
  });
}

