import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { z } from 'zod';
import { DriveService } from '../../services/drive.service.js';
import { AuthService } from '../../services/auth.service.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { resolvedStoragePaths } from '../../config/env.config.js';
import { getMimeTypeForExt } from '../../schemas/converter.schema.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

// Schemas
const listQuerySchema = z.object({
  path: z.string().optional().default('/')
});

const mkdirBodySchema = z.object({
  path: z.string().optional().default('/'),
  name: z.string().min(1, 'Folder name is required')
});

const deleteBodySchema = z.object({
  path: z.string().min(1, 'Path is required')
});

const renameBodySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  newName: z.string().min(1, 'New name is required')
});

/**
 * Authentication PreHandler Guard for Storage Endpoints
 */
export async function storageAuthGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = (request.headers['x-storage-auth'] as string) || (request.headers.authorization as string) || '';
  const queryToken = (request.query as Record<string, string>)?.auth || (request.query as Record<string, string>)?.token || '';
  const candidate = authHeader || queryToken;

  if (candidate) {
    if (AuthService.validateToken(candidate)) {
      return;
    }
    // Also allow raw password verification
    const isPasswordValid = await AuthService.verifyPassword(candidate.replace(/^Bearer\s+/i, '').trim());
    if (isPasswordValid) {
      return;
    }
  }

  return reply.status(401).send({
    success: false,
    error: 'UNAUTHORIZED',
    message: 'Yêu cầu mật khẩu quản trị để truy cập kho lưu trữ.'
  });
}

/**
 * List files and directories
 */
export async function listStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: relPath } = listQuerySchema.parse(request.query || {});
  const result = await DriveService.listFiles(relPath);
  return reply.send({
    success: true,
    data: result
  });
}

/**
 * Upload one or multiple files into destination directory
 */
export async function uploadStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const targetRelPath = (request.query as Record<string, string>)?.path || '/';
  const targetDiskDir = DriveService.getDiskPath(targetRelPath);

  if (!fs.existsSync(targetDiskDir)) {
    await fsPromises.mkdir(targetDiskDir, { recursive: true });
  }

  const uploadedFiles: Array<{ name: string; sizeBytes: number; path: string }> = [];

  // Check if request is multipart
  if (!request.isMultipart()) {
    throw new BadRequestError('Request must be multipart/form-data');
  }

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      const originalName = path.basename(part.filename).replace(/[\\/:*?"<>|]/g, '_');
      if (!originalName) continue;

      let finalName = originalName;
      let targetFilePath = path.join(targetDiskDir, finalName);

      // Handle duplicate names gracefully by appending (1), (2), etc.
      let counter = 1;
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext);
      while (fs.existsSync(targetFilePath)) {
        finalName = `${base} (${counter})${ext}`;
        targetFilePath = path.join(targetDiskDir, finalName);
        counter++;
      }

      // Ensure file stays in sandbox
      StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, targetFilePath));

      let bytesWritten = 0;
      const tempFilePath = `${targetFilePath}.tmp_${Date.now()}_${counter}`;
      const writeStream = fs.createWriteStream(tempFilePath);

      try {
        await pipeline(part.file, writeStream);
        const stat = await fsPromises.stat(tempFilePath);
        bytesWritten = stat.size;
        await fsPromises.rename(tempFilePath, targetFilePath);
      } catch (err) {
        await StorageManager.unlinkSafe(tempFilePath);
        throw err;
      }

      const itemRelPath = targetRelPath === '/' ? `/${finalName}` : `${DriveService.normalizeRelativePath(targetRelPath)}/${finalName}`;
      uploadedFiles.push({
        name: finalName,
        sizeBytes: bytesWritten,
        path: itemRelPath
      });
    }
  }

  if (uploadedFiles.length === 0) {
    throw new BadRequestError('Không tìm thấy tệp nào trong yêu cầu tải lên');
  }

  return reply.status(201).send({
    success: true,
    data: {
      uploaded: uploadedFiles,
      count: uploadedFiles.length
    }
  });
}

/**
 * Download file or download entire folder as ZIP
 */
export async function downloadStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as Record<string, string>;
  const relPath = query?.path || '';
  const inline = query?.inline === 'true';

  if (!relPath) {
    throw new BadRequestError('Thiếu tham số path');
  }

  const diskPath = DriveService.getDiskPath(relPath);
  if (!fs.existsSync(diskPath)) {
    throw new NotFoundError(`Mục '${relPath}' không tồn tại trên máy chủ`);
  }

  const stat = await fsPromises.stat(diskPath);

  // If directory -> compress to ZIP on the fly and stream
  if (stat.isDirectory()) {
    const { zipPath, zipName } = await DriveService.archiveFolderToZip(relPath);
    const zipStat = await fsPromises.stat(zipPath);

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);
    reply.header('Content-Length', zipStat.size);

    const stream = fs.createReadStream(zipPath);
    stream.on('close', () => {
      StorageManager.unlinkSafe(zipPath).catch(() => {});
    });
    return reply.send(stream);
  }

  // If single file -> stream with Range request support
  const fileName = path.basename(diskPath);
  const ext = path.extname(diskPath).toLowerCase().replace(/^\./, '');
  const mimeType = getMimeTypeForExt(ext);
  const fileSize = stat.size;
  reply.header('Content-Type', mimeType);
  const encodedName = encodeURIComponent(fileName);
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  if (inline) {
    reply.header('Content-Disposition', 'inline');
  } else {
    reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  }
  reply.header('Accept-Ranges', 'bytes');

  // Handle Range Header for video/audio seeking
  const rangeHeader = request.headers.range;
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      reply.header('Content-Range', `bytes */${fileSize}`);
      return reply.status(416).send('Requested Range Not Satisfiable');
    }

    const chunksize = end - start + 1;
    reply.status(206);
    reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    reply.header('Content-Length', chunksize);

    const stream = fs.createReadStream(diskPath, { start, end });
    return reply.send(stream);
  }

  reply.header('Content-Length', fileSize);
  return reply.send(fs.createReadStream(diskPath));
}

/**
 * Create new directory
 */
export async function mkdirStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: parentPath, name } = mkdirBodySchema.parse(request.body || {});
  const folder = await DriveService.createFolder(parentPath, name);
  return reply.status(201).send({
    success: true,
    data: folder
  });
}

/**
 * Delete file or directory
 */
export async function deleteStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: targetPath } = deleteBodySchema.parse(request.body || {});
  await DriveService.deleteItem(targetPath);
  return reply.send({
    success: true,
    message: 'Đã xóa thành công'
  });
}

/**
 * Rename file or directory
 */
export async function renameStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: targetPath, newName } = renameBodySchema.parse(request.body || {});
  const renamed = await DriveService.renameItem(targetPath, newName);
  return reply.send({
    success: true,
    data: renamed
  });
}

/**
 * Get storage & disk capacity statistics
 */
export async function statsStorageHandler(_request: FastifyRequest, reply: FastifyReply) {
  const stats = await DriveService.getDriveStats();
  return reply.send({
    success: true,
    data: stats
  });
}
