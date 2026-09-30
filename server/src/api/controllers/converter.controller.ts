import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import {
  converterDetectSchema,
  enqueueConverterJobSchema,
  CATEGORY_FORMATS,
  EXTENSION_CATEGORIES,
  getMimeTypeForExt,
  getCompatibleFormats,
  getDefaultTarget
} from '../../schemas/converter.schema.js';
import { enqueueConverterJob as queueConverterJob } from '../../queues/task.queue.js';
import { isPermanentRetention } from '../../config/limits.config.js';
import { logger } from '../../lib/logger.js';

async function sniffMagicBytes(filePath: string): Promise<string | null> {
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(16);
    await handle.read(buffer, 0, 16, 0);

    if (buffer.subarray(0, 4).toString('hex') === '89504e47') return 'png';
    if (buffer.subarray(0, 3).toString('hex') === 'ffd8ff') return 'jpg';
    if (buffer.subarray(0, 4).toString('utf8') === 'RIFF' && buffer.subarray(8, 12).toString('utf8') === 'WEBP') return 'webp';
    if (buffer.subarray(0, 4).toString('utf8') === '%PDF') return 'pdf';
    if (buffer.subarray(0, 4).toString('hex') === '504b0304') return 'zip';
    if (buffer.subarray(0, 6).toString('hex') === '377abcaf271c') return '7z';
    if (buffer.subarray(0, 3).toString('utf8') === 'GIF') return 'gif';
    if (buffer.subarray(4, 8).toString('utf8') === 'ftyp') return 'mp4';
    if (buffer.subarray(0, 3).toString('utf8') === 'ID3') return 'mp3';
    return null;
  } catch {
    return null;
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}

export async function detectFormat(request: FastifyRequest, reply: FastifyReply) {
  const body = converterDetectSchema.parse(request.body || {});
  let ext = '';
  let size = 0;
  let originalName = (body.fileName || '').trim();
  let mimeType = (body.mimeType || '').trim();

  if (body.fileId) {
    const fileRecord = await prisma.fileRecord.findUnique({ where: { id: body.fileId } });
    if (fileRecord && existsSync(fileRecord.storagePath)) {
      size = Number(fileRecord.sizeBytes);
      originalName = originalName || (fileRecord.originalName || '').trim();
      mimeType = mimeType || (fileRecord.mimeType || '').trim();

      // Extension-first: trust filename extension over magic bytes for Office documents / known formats
      const fileExt = path.extname(originalName).replace(/^\./, '').trim().toLowerCase();
      if (fileExt && EXTENSION_CATEGORIES[fileExt]) {
        ext = fileExt;
      } else {
        const detectedMagic = await sniffMagicBytes(fileRecord.storagePath);
        if (detectedMagic) ext = detectedMagic;
      }
    }
  }

  if (!ext && originalName) {
    ext = path.extname(originalName).replace(/^\./, '').trim().toLowerCase();
  }

  ext = ext.toLowerCase().trim();
  const categoryInfo = EXTENSION_CATEGORIES[ext] || { category: 'document', label: 'Tài liệu Văn bản' };
  const targetFormats = CATEGORY_FORMATS[categoryInfo.category] || CATEGORY_FORMATS.image;
  const compatibleFormats = getCompatibleFormats(ext);
  const defaultTarget = getDefaultTarget(ext);

  return reply.send({
    success: true,
    data: {
      extension: ext.toUpperCase() || 'BIN',
      category: categoryInfo.category,
      categoryLabel: categoryInfo.label,
      name: originalName || `file.${ext || 'bin'}`,
      size,
      mimeType: mimeType || getMimeTypeForExt(ext),
      targetFormats,
      compatibleFormats,
      defaultTarget
    }
  });
}

export async function enqueueConverterTask(request: FastifyRequest, reply: FastifyReply) {
  const body = enqueueConverterJobSchema.parse(request.body);
  const { fileId, targetFormat, options } = body;

  const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } });
  if (!fileRecord || fileRecord.isPurged || (!isPermanentRetention && fileRecord.expiresAt <= new Date())) {
    throw new NotFoundError(`Source file ${fileId} does not exist or has expired`);
  }

  const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const cleanTarget = targetFormat.toLowerCase().replace(/^\./, '');

  const job = await prisma.job.create({
    data: {
      id: jobId,
      type: `convert_${cleanTarget}`,
      status: 'QUEUED',
      progress: 0,
      optionsJson: JSON.stringify({ fileId, targetFormat: cleanTarget, options })
    }
  });

  try {
    await queueConverterJob({
      jobId: job.id,
      fileId,
      targetFormat: cleanTarget,
      options
    });
  } catch (queueErr) {
    logger.warn({ jobId: job.id, queueErr }, 'BullMQ enqueue failed, task remains QUEUED in database');
  }

  return reply.status(202).send({
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      eventsUrl: `/api/v1/jobs/${job.id}/events`,
      pollUrl: `/api/v1/jobs/${job.id}`
    }
  });
}
