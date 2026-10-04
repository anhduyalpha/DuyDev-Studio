import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '../../lib/prisma.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { limits, isPermanentRetention, computeExpiresAt } from '../../config/limits.config.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { fileIdParamSchema, uploadPurposeSchema, fileDownloadQuerySchema } from '../../schemas/files.schema.js';
import { getMimeTypeForExt } from '../../schemas/converter.schema.js';
import { logger } from '../../lib/logger.js';

export async function uploadFile(request: FastifyRequest, reply: FastifyReply) {
  const data = await request.file();

  if (!data) {
    throw new BadRequestError('No file provided in multipart body');
  }

  // Extract optional purpose field from multipart or query
  let rawPurpose: unknown = (request.query as Record<string, unknown>)?.purpose;
  if (!rawPurpose && data.fields?.purpose) {
    const purposeField = data.fields.purpose;
    rawPurpose = typeof purposeField === 'object' && 'value' in purposeField ? purposeField.value : purposeField;
  }

  const purposeParse = uploadPurposeSchema.safeParse(rawPurpose || 'pdf-convert');
  const purpose = purposeParse.success ? purposeParse.data : 'pdf-convert';

  const fileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const ext = path.extname(data.filename) || '.bin';
  const targetPath = StorageManager.getUploadPath(fileId, ext);

  const hash = crypto.createHash('sha256');
  let byteCount = 0;

  const hashingStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteCount += chunk.length;
      hash.update(chunk);
      callback(null, chunk);
    }
  });

  const writeStream = fs.createWriteStream(targetPath, { highWaterMark: 4 * 1024 * 1024 });

  try {
    await pipeline(data.file, hashingStream, writeStream);
  } catch (err) {
    await StorageManager.unlinkSafe(targetPath);
    throw err;
  }

  if (byteCount === 0) {
    await StorageManager.unlinkSafe(targetPath);
    throw new BadRequestError('Uploaded file is empty');
  }

  const hashSha256 = hash.digest('hex');
  const expiresAt = computeExpiresAt();

  const fileRecord = await prisma.fileRecord.create({
    data: {
      id: fileId,
      purpose: 'UPLOAD',
      originalName: data.filename,
      storagePath: targetPath,
      mimeType: data.mimetype || 'application/octet-stream',
      sizeBytes: BigInt(byteCount),
      hashSha256,
      isPurged: false,
      expiresAt
    }
  });

  logger.info(
    { fileId: fileRecord.id, originalName: fileRecord.originalName, sizeBytes: byteCount, purpose },
    'File uploaded successfully'
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

async function handleFileSend(request: FastifyRequest, reply: FastifyReply, forceInline = false) {
  const { fileId } = fileIdParamSchema.parse(request.params);
  const rawParams = request.params as Record<string, string | undefined>;
  const rawQuery = (request.query || {}) as Record<string, string | undefined>;
  const requestedName = (rawParams.filename || rawQuery.filename || '').trim();

  const { inline } = fileDownloadQuerySchema.parse(request.query || {});
  const isInline = forceInline || inline;

  const fileRecord = await prisma.fileRecord.findUnique({
    where: { id: fileId }
  });

  if (!fileRecord || fileRecord.isPurged) {
    throw new NotFoundError(`File with ID ${fileId} not found or has been purged`);
  }

  // If expired according to raw timestamp, verify if preserved in HistoryRecord (history or trash)
  if (!isPermanentRetention && fileRecord.expiresAt <= new Date()) {
    const isPreserved = await prisma.historyRecord.findFirst({
      where: {
        OR: [
          { resultFileId: fileId },
          { downloadUrl: { contains: fileId } }
        ]
      }
    });
    if (!isPreserved) {
      throw new NotFoundError(`File with ID ${fileId} has expired`);
    }
  }

  if (!fs.existsSync(fileRecord.storagePath)) {
    throw new NotFoundError(`Physical file for ID ${fileId} is missing on disk`);
  }

  const stat = await fs.promises.stat(fileRecord.storagePath);
  const totalSize = stat.size;
  const effectiveName = requestedName || fileRecord.originalName;
  const ext = path.extname(effectiveName).toLowerCase() || path.extname(fileRecord.originalName).toLowerCase();
  const mimeType = (fileRecord.mimeType && fileRecord.mimeType !== 'application/octet-stream')
    ? fileRecord.mimeType
    : getMimeTypeForExt(ext);

  const encodedFilename = encodeURIComponent(effectiveName);
  const asciiName = effectiveName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  reply.header('Content-Type', mimeType);
  if (isInline) {
    reply.header('Content-Disposition', 'inline');
  } else {
    reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedFilename}`);
  }
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Cache-Control', 'public, max-age=3600');

  // Handle Range requests (HTTP 206 Partial Content) according to RFC 7233
  const rangeHeader = request.headers.range;
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').trim().split('-');
    let start: number;
    let end: number;

    if (parts[0] === '' && parts[1]) {
      // Suffix byte range: bytes=-N (e.g. bytes=-65536)
      const suffix = parseInt(parts[1], 10);
      if (isNaN(suffix) || suffix <= 0) {
        reply.status(416);
        reply.header('Content-Range', `bytes */${totalSize}`);
        return reply.send();
      }
      start = Math.max(0, totalSize - suffix);
      end = totalSize - 1;
    } else {
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    }

    if (isNaN(start) || isNaN(end) || start >= totalSize || end < start) {
      reply.status(416);
      reply.header('Content-Range', `bytes */${totalSize}`);
      return reply.send();
    }

    const clampedEnd = Math.min(end, totalSize - 1);
    const chunkSize = (clampedEnd - start) + 1;

    reply.status(206);
    reply.header('Content-Range', `bytes ${start}-${clampedEnd}/${totalSize}`);
    reply.header('Content-Length', chunkSize.toString());
    return reply.send(fs.createReadStream(fileRecord.storagePath, { start, end: clampedEnd }));
  }

  reply.header('Content-Length', totalSize.toString());
  return reply.send(fs.createReadStream(fileRecord.storagePath));
}

export async function downloadFile(request: FastifyRequest, reply: FastifyReply) {
  return handleFileSend(request, reply, false);
}

export async function viewFile(request: FastifyRequest, reply: FastifyReply) {
  return handleFileSend(request, reply, true);
}

