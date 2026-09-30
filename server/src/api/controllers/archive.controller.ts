import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { limits, isPermanentRetention, computeExpiresAt } from '../../config/limits.config.js';
import {
  inspectArchiveSchema,
  inspectNestedArchiveSchema,
  extractFileQuerySchema,
  compressArchiveSchema
} from '../../schemas/archive.schema.js';
import { getMimeTypeForExt } from '../../schemas/converter.schema.js';
import { ArchiveService } from '../../services/archive.service.js';
import { DriveService } from '../../services/drive.service.js';
import { AuthService } from '../../services/auth.service.js';

function verifyArchiveAdminAuth(request: FastifyRequest): boolean {
  const authHeader = (request.headers['x-storage-auth'] as string) || (request.headers.authorization as string) || '';
  const queryToken = (request.query as Record<string, string>)?.auth || (request.query as Record<string, string>)?.token || '';
  const bodyToken = (request.body as Record<string, string>)?.auth || (request.body as Record<string, string>)?.token || '';
  const candidate = authHeader || queryToken || bodyToken;
  if (candidate) {
    if (AuthService.validateToken(candidate)) return true;
  }
  return false;
}

export async function inspectArchiveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { fileId, drivePath } = inspectArchiveSchema.parse(request.body);

  if (drivePath) {
    if (!verifyArchiveAdminAuth(request)) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu quyền quản trị để xem tệp nén trong kho lưu trữ'
      });
    }

    const diskPath = DriveService.getDiskPath(drivePath);
    if (!fs.existsSync(diskPath)) {
      throw new NotFoundError(`Tệp nén '${drivePath}' không tồn tại trên máy chủ`);
    }

    const result = await ArchiveService.inspectArchive(diskPath);
    result.archiveName = path.basename(diskPath);

    return reply.send({
      success: true,
      data: {
        ...result,
        drivePath
      }
    });
  }

  if (!fileId) {
    throw new BadRequestError('fileId is required');
  }

  const fileRecord = await prisma.fileRecord.findUnique({
    where: { id: fileId }
  });

  if (!fileRecord || fileRecord.isPurged || (!isPermanentRetention && fileRecord.expiresAt <= new Date())) {
    throw new NotFoundError(`Archive file ${fileId} not found or has expired`);
  }

  const result = await ArchiveService.inspectArchive(fileRecord.storagePath);
  if (fileRecord.originalName) {
    result.archiveName = fileRecord.originalName;
  }

  return reply.send({
    success: true,
    data: result
  });
}

export async function inspectNestedArchiveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { parentFileId, memberPath } = inspectNestedArchiveSchema.parse(request.body);

  const parentRecord = await prisma.fileRecord.findUnique({
    where: { id: parentFileId }
  });

  if (!parentRecord || parentRecord.isPurged || (!isPermanentRetention && parentRecord.expiresAt <= new Date())) {
    throw new NotFoundError(`Parent archive ${parentFileId} not found or has expired`);
  }

  const extracted = await ArchiveService.extractSingleMember(parentRecord.storagePath, memberPath);
  const ext = path.extname(extracted.name).toLowerCase() || '.zip';
  const nestedFileId = `fil_nested_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const targetPath = StorageManager.getProcessedPath(nestedFileId, ext);

  const writeStream = fs.createWriteStream(targetPath);
  await new Promise<void>((resolve, reject) => {
    extracted.stream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve());
    extracted.stream.pipe(writeStream);
  });
  await extracted.close?.().catch(() => {});

  const sizeBytes = fs.statSync(targetPath).size;
  const expiresAt = computeExpiresAt();

  const nestedRecord = await prisma.fileRecord.create({
    data: {
      id: nestedFileId,
      purpose: 'archive-nested',
      originalName: extracted.name,
      storagePath: targetPath,
      mimeType: getMimeTypeForExt(ext),
      sizeBytes: BigInt(sizeBytes),
      hashSha256: crypto.createHash('sha256').update(targetPath).digest('hex'),
      isPurged: false,
      expiresAt
    }
  });

  const result = await ArchiveService.inspectArchive(targetPath);
  if (extracted.name) {
    result.archiveName = extracted.name;
  }

  return reply.send({
    success: true,
    data: {
      ...result,
      fileId: nestedRecord.id,
      parentFileId: parentRecord.id,
      nestedName: extracted.name
    }
  });
}

export async function extractFileHandler(request: FastifyRequest, reply: FastifyReply) {
  const { fileId, drivePath, memberPath, inline } = extractFileQuerySchema.parse(request.query);

  let archiveDiskPath = '';
  if (drivePath) {
    if (!verifyArchiveAdminAuth(request)) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Yêu cầu quyền quản trị để trích xuất tệp nén trong kho lưu trữ'
      });
    }
    archiveDiskPath = DriveService.getDiskPath(drivePath);
    if (!fs.existsSync(archiveDiskPath)) {
      throw new NotFoundError(`Tệp nén '${drivePath}' không tồn tại trên máy chủ`);
    }
  } else if (fileId) {
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId }
    });

    if (!fileRecord || fileRecord.isPurged || (!isPermanentRetention && fileRecord.expiresAt <= new Date())) {
      throw new NotFoundError(`Archive file ${fileId} not found or has expired`);
    }
    archiveDiskPath = fileRecord.storagePath;
  } else {
    throw new BadRequestError('fileId or drivePath is required');
  }

  const safeMemberPath = memberPath.replace(/^\/+/, '');
  const extracted = await ArchiveService.extractSingleMember(archiveDiskPath, safeMemberPath);
  const encodedName = encodeURIComponent(extracted.name);
  const asciiName = extracted.name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  const ext = path.extname(extracted.name).toLowerCase();
  const mimeType = getMimeTypeForExt(ext);
  reply.header('Content-Type', mimeType);
  if (inline) {
    reply.header('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  } else {
    reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  }
  reply.header('Accept-Ranges', 'bytes');

  request.raw.on('close', () => {
    extracted.close?.().catch(() => {});
  });
  extracted.stream.on('error', () => {
    extracted.close?.().catch(() => {});
  });

  if (extracted.sizeBytes > 0) {
    reply.header('Content-Length', extracted.sizeBytes.toString());
  }

  return reply.send(extracted.stream);
}

export async function compressArchiveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { fileIds, archiveName, format, compressionLevel } = compressArchiveSchema.parse(request.body);

  const files = await prisma.fileRecord.findMany({
    where: {
      id: { in: fileIds },
      isPurged: false,
      ...(isPermanentRetention ? {} : { expiresAt: { gt: new Date() } })
    }
  });

  if (files.length === 0) {
    throw new BadRequestError('No valid files found to compress');
  }

  const items = files.map((f) => ({
    filePath: f.storagePath,
    originalName: f.originalName
  }));

  const resultFileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const outExt = format === 'tar.gz' ? '.tar.gz' : `.${format}`;
  const targetPath = StorageManager.getProcessedPath(resultFileId, outExt);

  const { sizeBytes } = await ArchiveService.compressFiles(items, targetPath, format, compressionLevel);

  const finalName = archiveName.endsWith(outExt) ? archiveName : `${archiveName.replace(/\.[^/.]+$/, '')}${outExt}`;
  const expiresAt = computeExpiresAt();

  const artifactRecord = await prisma.fileRecord.create({
    data: {
      id: resultFileId,
      purpose: 'PROCESSED_ARTIFACT',
      originalName: finalName,
      storagePath: targetPath,
      mimeType: getMimeTypeForExt(outExt),
      sizeBytes: BigInt(sizeBytes),
      hashSha256: crypto.createHash('sha256').update(targetPath).digest('hex'),
      isPurged: false,
      expiresAt
    }
  });

  return reply.status(201).send({
    success: true,
    data: {
      fileId: artifactRecord.id,
      archiveName: artifactRecord.originalName,
      sizeBytes: Number(artifactRecord.sizeBytes),
      downloadUrl: `/api/v1/files/download/${artifactRecord.id}`,
      totalFiles: items.length
    }
  });
}
