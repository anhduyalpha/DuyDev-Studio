/**
 * ViewerController (< 120 lines)
 * Fastify controller for on-the-fly PDF document preview pipeline
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { existsSync, createReadStream, statSync } from 'fs';
import { prisma } from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { isPermanentRetention } from '../../config/limits.config.js';
import { DriveService } from '../../services/drive.service.js';
import { AuthService } from '../../services/auth.service.js';
import { ViewerService } from '../../services/viewer.service.js';
import { previewPdfQuerySchema } from '../../schemas/viewer.schema.js';

function verifyStorageAdminAuth(request: FastifyRequest): boolean {
  const authHeader = (request.headers['x-storage-auth'] as string) || (request.headers.authorization as string) || '';
  const queryToken = (request.query as Record<string, string>)?.auth || (request.query as Record<string, string>)?.token || '';
  const candidate = authHeader || queryToken;
  if (candidate) {
    if (AuthService.validateToken(candidate)) return true;
  }
  return false;
}

export async function previewPdfHandler(request: FastifyRequest, reply: FastifyReply) {
  const { fileId, path: relPath } = previewPdfQuerySchema.parse(request.query || {});

  if (!fileId && !relPath) {
    throw new BadRequestError('Cần cung cấp ít nhất fileId hoặc path để xem trước tệp');
  }

  let sourcePath = '';

  if (relPath) {
    if (!verifyStorageAdminAuth(request)) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu quyền quản trị để xem trước tệp trong kho lưu trữ'
      });
    }

    sourcePath = DriveService.getDiskPath(relPath);
    if (!existsSync(sourcePath)) {
      throw new NotFoundError(`Tệp '${relPath}' không tồn tại trên hệ thống`);
    }
  } else if (fileId) {
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId }
    });

    if (!fileRecord || fileRecord.isPurged) {
      throw new NotFoundError(`Tệp ID ${fileId} không tồn tại hoặc đã bị xóa`);
    }

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
        throw new NotFoundError(`Tệp ID ${fileId} đã hết hạn lưu trữ`);
      }
    }

    if (!existsSync(fileRecord.storagePath)) {
      throw new NotFoundError(`Tệp vật lý cho ID ${fileId} không tồn tại trên đĩa`);
    }

    sourcePath = fileRecord.storagePath;
  }

  const pdfPath = await ViewerService.getPreviewPdfPath(sourcePath);
  const stat = statSync(pdfPath);
  const totalSize = stat.size;

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', 'inline; filename="preview.pdf"');
  reply.header('Cache-Control', 'public, max-age=86400');
  reply.header('Accept-Ranges', 'bytes');

  const rangeHeader = request.headers.range;
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (!isNaN(start) && start < totalSize && end >= start) {
      const clampedEnd = Math.min(end, totalSize - 1);
      const chunkSize = (clampedEnd - start) + 1;

      reply.status(206);
      reply.header('Content-Range', `bytes ${start}-${clampedEnd}/${totalSize}`);
      reply.header('Content-Length', chunkSize.toString());
      return reply.send(createReadStream(pdfPath, { start, end: clampedEnd }));
    }
  }

  reply.header('Content-Length', totalSize.toString());
  return reply.send(createReadStream(pdfPath));
}
