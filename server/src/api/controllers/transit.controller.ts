/**
 * Transit Controller
 * Orchestrates Cloudflare R2 presigned uploads, LAN bypass routing,
 * and atomic server ingestion with instant R2 purging.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { prisma } from '../../lib/prisma.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { computeExpiresAt, limits } from '../../config/limits.config.js';
import { env } from '../../config/env.config.js';
import { BadRequestError, FileSizeLimitError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { R2Service } from '../../services/r2.service.js';
import { DriveService } from '../../services/drive.service.js';
import { presignTransitBodySchema, completeTransitBodySchema, batchPresignBodySchema } from '../../schemas/files.schema.js';

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
  const { fileName, fileSize, mimeType, purpose, forceR2 } = body;
  const isForceR2 = (request.query as Record<string, unknown>)?.forceR2 === 'true' || forceR2 === true;

  if (fileSize && fileSize > limits.maxUploadSizeBytes) {
    throw new FileSizeLimitError(`File exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB`);
  }

  const uploadUrl = purpose === 'storage-drive'
    ? `/api/v1/storage/upload?path=${encodeURIComponent(body.targetDir || '/')}`
    : `/api/v1/files/upload?purpose=${encodeURIComponent(purpose || 'pdf-convert')}`;

  // 1. Fast-Path: If fileSize <= 50MB and not forced R2, route to direct upload (<1s!)
  if (!isForceR2 && fileSize && fileSize <= 50 * 1024 * 1024) {
    logger.debug({ fileSize, fileName }, 'Fast-Path (<= 50MB): routing to direct upload');
    return reply.status(200).send({
      success: true,
      data: {
        mode: 'direct',
        uploadUrl
      }
    });
  }

  // 2. LAN Auto-Bypass: If request is within local network, return direct upload endpoint to save R2 quota
  if (!isForceR2 && isLanRequest(request)) {
    logger.debug({ ip: request.ip, host: request.headers.host }, 'LAN detected: routing to direct upload');
    return reply.status(200).send({
      success: true,
      data: {
        mode: 'direct',
        uploadUrl
      }
    });
  }

  // 3. Check if R2 is enabled and circuit breaker quota has not tripped
  if (!R2Service.isAvailable()) {
    logger.info('R2 unavailable or quota exceeded: falling back to direct upload');
    return reply.status(200).send({
      success: true,
      data: {
        mode: 'direct',
        uploadUrl
      }
    });
  }

  // 4. Generate Cloudflare R2 Presigned Upload URL
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

export async function batchPresignTransitUpload(request: FastifyRequest, reply: FastifyReply) {
  const body = batchPresignBodySchema.parse(request.body);
  const isQueryForceR2 = (request.query as Record<string, unknown>)?.forceR2 === 'true';
  const isLan = isLanRequest(request);
  const r2Available = R2Service.isAvailable();

  const items = await Promise.all(
    body.files.map(async (fileItem) => {
      const { fileName, fileSize, mimeType, purpose, targetDir, forceR2 } = fileItem;
      const isForceR2 = isQueryForceR2 || forceR2 === true;

      if (fileSize && fileSize > limits.maxUploadSizeBytes) {
        throw new FileSizeLimitError(`File "${fileName}" exceeds maximum size of ${env.MAX_UPLOAD_SIZE_MB}MB`);
      }

      const uploadUrl = purpose === 'storage-drive'
        ? `/api/v1/storage/upload?path=${encodeURIComponent(targetDir || '/')}`
        : `/api/v1/files/upload?purpose=${encodeURIComponent(purpose || 'pdf-convert')}`;

      // 1. Fast-Path (<= 50MB) and not forced R2
      if (!isForceR2 && fileSize && fileSize <= 50 * 1024 * 1024) {
        return {
          fileName,
          mode: 'direct' as const,
          uploadUrl
        };
      }

      // 2. LAN auto-bypass
      if (!isForceR2 && isLan) {
        return {
          fileName,
          mode: 'direct' as const,
          uploadUrl
        };
      }

      // 3. R2 availability
      if (!r2Available) {
        return {
          fileName,
          mode: 'direct' as const,
          uploadUrl
        };
      }

      // 4. R2 presigned url
      const { presignedUrl, fileKey, fileId, sanitizedName } = await R2Service.generatePresignedUploadUrl(
        fileName,
        mimeType || 'application/octet-stream',
        fileSize
      );

      return {
        fileName,
        mode: 'r2' as const,
        presignedUrl,
        fileKey,
        fileId,
        sanitizedName
      };
    })
  );

  return reply.status(200).send({
    success: true,
    data: items
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

  // For processing tasks (pdf-convert, universal-converter, media-transcode, archive-inspect):
  // Non-blocking async ingestion stream from R2 to disk.
  // Immediate HTTP 200 returned in <50ms without blocking client!
  if (purpose !== 'storage-drive') {
    R2Service.startAsyncIngestion(fileId, fileKey, targetPath);

    const expiresAt = computeExpiresAt();
    const fileRecord = await prisma.fileRecord.create({
      data: {
        id: fileId,
        purpose: 'UPLOAD',
        originalName: safeOriginalName,
        storagePath: targetPath,
        mimeType: mimeType || 'application/octet-stream',
        sizeBytes: BigInt(sizeBytes || 0),
        hashSha256: '',
        isPurged: false,
        expiresAt
      }
    });

    logger.info(
      { fileId: fileRecord.id, originalName: fileRecord.originalName, purpose },
      'R2 transit upload initiated async ingestion; returned instant response'
    );

    return reply.status(200).send({
      success: true,
      data: {
        fileId: fileRecord.id,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        sizeBytes: Number(fileRecord.sizeBytes),
        hashSha256: fileRecord.hashSha256,
        expiresAt: fileRecord.expiresAt.toISOString(),
        status: 'ingesting'
      }
    });
  }

  // For storage-drive: synchronous ingestion before copying into user's drive directory
  const { byteCount, hashSha256 } = await R2Service.ingestAndPurgeTransitObject(fileKey, targetPath);

  const fileRecord = await prisma.fileRecord.create({
    data: {
      id: fileId,
      purpose: 'DRIVE',
      originalName: safeOriginalName,
      storagePath: targetPath,
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: BigInt(byteCount),
      hashSha256,
      isPurged: false,
      expiresAt: new Date('2099-12-31T23:59:59.999Z')
    }
  });

  const targetDir = body.targetDir || '/';
  const targetDiskDir = DriveService.getDiskPath(targetDir);
  await fsPromises.mkdir(targetDiskDir, { recursive: true });

  let finalName = safeOriginalName;
  let targetFilePath = path.join(targetDiskDir, finalName);
  let counter = 1;
  const base = path.basename(safeOriginalName, ext);
  while (fs.existsSync(targetFilePath)) {
    finalName = `${base} (${counter})${ext}`;
    targetFilePath = path.join(targetDiskDir, finalName);
    counter++;
  }
  await fsPromises.copyFile(targetPath, targetFilePath);
  const driveItemPath = targetDir === '/' ? `/${finalName}` : `${DriveService.normalizeRelativePath(targetDir)}/${finalName}`;

  logger.info(
    { fileId: fileRecord.id, originalName: fileRecord.originalName, sizeBytes: byteCount, purpose, driveItemPath },
    'R2 transit drive upload ingested and placed successfully'
  );

  return reply.status(201).send({
    success: true,
    data: {
      fileId: fileRecord.id,
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      sizeBytes: Number(fileRecord.sizeBytes),
      hashSha256: fileRecord.hashSha256,
      expiresAt: fileRecord.expiresAt.toISOString(),
      driveItemPath,
      uploaded: [{ name: path.basename(driveItemPath), sizeBytes: Number(fileRecord.sizeBytes), path: driveItemPath }]
    }
  });
}

