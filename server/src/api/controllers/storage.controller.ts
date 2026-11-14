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
import { checkETagMatch } from '../../lib/http.utils.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

// Schemas
const listQuerySchema = z.object({
  path: z.string().optional().default('/')
});

const mkdirBodySchema = z.object({
  path: z.string().optional().default('/'),
  name: z.string().min(1, 'Folder name is required')
});

const deleteBodySchema = z.object({
  path: z.string().optional(),
  paths: z.array(z.string()).optional()
}).refine(data => Boolean(data.path || (data.paths && data.paths.length > 0)), {
  message: 'Path or paths is required'
});

const renameBodySchema = z.object({
  path: z.string().min(1, 'Path is required'),
  newName: z.string().min(1, 'New name is required')
});

const moveBodySchema = z.object({
  path: z.string().optional(),
  paths: z.array(z.string()).optional(),
  destinationDir: z.string().min(1, 'Destination directory is required')
}).refine(data => Boolean(data.path || (data.paths && data.paths.length > 0)), {
  message: 'Path or paths is required'
});

const copyBodySchema = z.object({
  path: z.string().optional(),
  paths: z.array(z.string()).optional(),
  destinationDir: z.string().min(1, 'Destination directory is required')
}).refine(data => Boolean(data.path || (data.paths && data.paths.length > 0)), {
  message: 'Path or paths is required'
});

/**
 * Authentication PreHandler Guard for Storage Endpoints
 */
export async function storageAuthGuard(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as Record<string, string>;
  const relPath = query?.path || '';

  // Whitelist public tool downloads and previews (/slideshare/, /academia/, /researchgate/)
  const routerUrl = request.routeOptions?.url || request.routerPath;
  if (routerUrl === '/api/v1/storage/download' && /^(?:\/)?(?:slideshare|academia|researchgate)\//i.test(relPath)) {
    return;
  }

  const authHeader = (request.headers['x-storage-auth'] as string) || (request.headers.authorization as string) || '';
  const queryToken = query?.auth || query?.token || '';
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
  const query = (request.query as Record<string, string>) || {};
  const targetRelPath = query.path || query.targetDir || '/';
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

      const normTarget = DriveService.normalizeRelativePath(targetRelPath);
      const itemRelPath = normTarget === '/' ? `/${finalName}` : `${normTarget}/${finalName}`;
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

  DriveService.invalidateStatsCache();
  return reply.status(201).send({
    success: true,
    data: {
      uploaded: uploadedFiles,
      count: uploadedFiles.length
    }
  });
}

/**
 * Download file, download entire folder as ZIP, or batch download selected items as ZIP
 */
export async function downloadStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as Record<string, string>;
  const relPath = query?.path || '';
  const pathsParam = query?.paths;
  const inline = query?.inline === 'true';

  // 1. Batch download multiple selected items as a single ZIP
  if (pathsParam) {
    let pathsList: string[] = [];
    try {
      pathsList = pathsParam.startsWith('[') ? JSON.parse(pathsParam) : pathsParam.split(',').filter(Boolean);
    } catch {
      pathsList = pathsParam.split(',').filter(Boolean);
    }

    if (!Array.isArray(pathsList) || pathsList.length === 0) {
      throw new BadRequestError('Danh sách tệp tải về không hợp lệ');
    }

    const { zipPath, zipName } = await DriveService.archiveItemsToZip(pathsList);
    const zipStat = await fsPromises.stat(zipPath);

    reply.header('Content-Type', 'application/zip');
    const encodedZipName = encodeURIComponent(zipName);
    const asciiZipName = zipName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
    reply.header('Content-Disposition', `attachment; filename="${asciiZipName}"; filename*=UTF-8''${encodedZipName}`);
    reply.header('Content-Length', zipStat.size);

    const stream = fs.createReadStream(zipPath);
    stream.on('close', () => {
      StorageManager.unlinkSafe(zipPath).catch(() => {});
    });
    return reply.send(stream);
  }

  // 2. Single item or directory download
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
    const encodedZipName = encodeURIComponent(zipName);
    const asciiZipName = zipName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
    reply.header('Content-Disposition', `attachment; filename="${asciiZipName}"; filename*=UTF-8''${encodedZipName}`);
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
  reply.header('X-Content-Type-Options', 'nosniff');
  const encodedName = encodeURIComponent(fileName);
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  if (inline) {
    reply.header('Content-Disposition', 'inline');
  } else {
    reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  }
  reply.header('Accept-Ranges', 'bytes');

  const etag = `"${stat.mtimeMs.toString(36)}-${fileSize.toString(36)}"`;
  reply.header('ETag', etag);

  // RFC 7232: 304 Not Modified evaluated first
  if (checkETagMatch(request.headers['if-none-match'], etag)) {
    reply.status(304);
    return reply.send();
  }

  // Handle Range Header for video/audio seeking and chunked viewing
  const rangeHeader = request.headers.range;
  const ifRange = request.headers['if-range'];
  const ifRangeMatches = !ifRange || checkETagMatch(ifRange, etag);

  if (rangeHeader && rangeHeader.startsWith('bytes=') && ifRangeMatches) {
    if (fileSize === 0) {
      reply.header('Content-Range', 'bytes */0');
      return reply.status(416).send('Requested Range Not Satisfiable');
    }

    const parts = rangeHeader.replace(/bytes=/, '').trim().split('-');
    let start: number;
    let end: number;

    if (parts[0] === '' && parts[1]) {
      const suffix = parseInt(parts[1], 10);
      if (isNaN(suffix) || suffix <= 0) {
        reply.header('Content-Range', `bytes */${fileSize}`);
        return reply.status(416).send('Requested Range Not Satisfiable');
      }
      start = Math.max(0, fileSize - suffix);
      end = fileSize - 1;
    } else {
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    }

    if (isNaN(start) || isNaN(end) || start < 0 || start >= fileSize || end < start) {
      reply.header('Content-Range', `bytes */${fileSize}`);
      return reply.status(416).send('Requested Range Not Satisfiable');
    }

    const clampedEnd = Math.min(end, fileSize - 1);
    const chunksize = clampedEnd - start + 1;
    reply.status(206);
    reply.header('Content-Range', `bytes ${start}-${clampedEnd}/${fileSize}`);
    reply.header('Content-Length', chunksize);
    reply.header('Cache-Control', 'no-cache');

    const stream = fs.createReadStream(diskPath, { start, end: clampedEnd });
    return reply.send(stream);
  }

  // 200 OK Full content
  reply.header('Cache-Control', 'public, max-age=600, must-revalidate');
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
 * Delete file or directory (supports single path or batch paths array)
 */
export async function deleteStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: targetPath, paths: targetPaths } = deleteBodySchema.parse(request.body || {});
  if (targetPaths && targetPaths.length > 0) {
    let deletedCount = 0;
    for (const p of targetPaths) {
      try {
        await DriveService.deleteItem(p);
        deletedCount++;
      } catch (err: any) {
        // If already unlinked or child of already deleted parent, continue without aborting whole batch
        if (err instanceof NotFoundError || err?.statusCode === 404) {
          continue;
        }
        throw err;
      }
    }
    return reply.send({
      success: true,
      message: `Đã xóa thành công ${deletedCount} mục`
    });
  }
  if (targetPath) {
    await DriveService.deleteItem(targetPath);
  }
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
 * Move file or directory (supports single path or batch paths array)
 */
export async function moveStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: targetPath, paths: targetPaths, destinationDir } = moveBodySchema.parse(request.body || {});
  if (targetPaths && targetPaths.length > 0) {
    const results = [];
    for (const p of targetPaths) {
      results.push(await DriveService.moveItem(p, destinationDir));
    }
    return reply.send({
      success: true,
      data: results,
      message: `Đã di chuyển thành công ${results.length} mục`
    });
  }
  if (targetPath) {
    const moved = await DriveService.moveItem(targetPath, destinationDir);
    return reply.send({
      success: true,
      data: moved
    });
  }
}

/**
 * Copy file or directory (supports single path or batch paths array)
 */
export async function copyStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const { path: targetPath, paths: targetPaths, destinationDir } = copyBodySchema.parse(request.body || {});
  if (targetPaths && targetPaths.length > 0) {
    const results = [];
    for (const p of targetPaths) {
      results.push(await DriveService.copyItem(p, destinationDir));
    }
    return reply.send({
      success: true,
      data: results,
      message: `Đã sao chép thành công ${results.length} mục`
    });
  }
  if (targetPath) {
    const copied = await DriveService.copyItem(targetPath, destinationDir);
    return reply.send({
      success: true,
      data: copied
    });
  }
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

/**
 * Target folder allowlist for artifact persistence.
 * Strictly limited to authorized destination folders.
 */
export const ALLOWED_ARTIFACT_FOLDERS = ['/pdf', '/converted', '/archives', '/images', '/documents'] as const;

const saveArtifactJsonSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  targetFolder: z.string().min(1, 'targetFolder is required'),
  fileName: z.string().optional(),
  overwrite: z.boolean().optional().default(false),
  metadata: z.record(z.any()).optional()
});

/**
 * Handle multipart artifact saving
 */
async function handleMultipartSaveArtifact(request: FastifyRequest, reply: FastifyReply) {
  const query = (request.query as Record<string, string>) || {};
  let targetFolder = query.targetFolder || query.path || '';
  let fileName = query.fileName || '';
  let overwrite = query.overwrite === 'true';
  let metadata: Record<string, any> = {};

  const tempFilePath = path.join(resolvedStoragePaths.temp, `art_up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.tmp`);
  let bytesWritten = 0;
  let fileReceived = false;

  const parts = request.parts({ limits: { fileSize: 100 * 1024 * 1024 } });
  try {
    for await (const part of parts) {
      if (part.type === 'file') {
        if (!fileReceived) {
          fileReceived = true;
          if (!fileName && part.filename) {
            fileName = part.filename;
          }
          const writeStream = fs.createWriteStream(tempFilePath);
          await pipeline(part.file, writeStream);
          const stat = await fsPromises.stat(tempFilePath);
          bytesWritten = stat.size;
        } else {
          await part.file.resume();
        }
      } else {
        if (part.fieldname === 'targetFolder') {
          targetFolder = String(part.value || '');
        } else if (part.fieldname === 'fileName') {
          fileName = String(part.value || '');
        } else if (part.fieldname === 'overwrite') {
          overwrite = String(part.value) === 'true';
        } else if (part.fieldname === 'metadata') {
          try {
            metadata = JSON.parse(String(part.value || '{}'));
          } catch {}
        }
      }
    }
  } catch (err: any) {
    if (fs.existsSync(tempFilePath)) {
      await fsPromises.unlink(tempFilePath).catch(() => {});
    }
    throw err;
  }

  if (!fileReceived || bytesWritten === 0) {
    if (fs.existsSync(tempFilePath)) {
      await fsPromises.unlink(tempFilePath).catch(() => {});
    }
    throw new BadRequestError('Tệp tải lên rỗng hoặc không tìm thấy tệp');
  }

  const normFolder = DriveService.normalizeRelativePath(targetFolder);
  if (!ALLOWED_ARTIFACT_FOLDERS.includes(normFolder as any)) {
    if (fs.existsSync(tempFilePath)) {
      await fsPromises.unlink(tempFilePath).catch(() => {});
    }
    throw new BadRequestError(`Thư mục đích không hợp lệ. Chỉ chấp nhận: ${ALLOWED_ARTIFACT_FOLDERS.join(', ')}`);
  }

  const targetDiskDir = DriveService.getDiskPath(normFolder);
  if (!fs.existsSync(targetDiskDir)) {
    await fsPromises.mkdir(targetDiskDir, { recursive: true });
  }

  const candidateName = (fileName || 'artifact').trim();
  const originalName = path.basename(candidateName).replace(/[\\/:*?"<>|\0]/g, '_') || 'artifact';

  let finalName = originalName;
  let targetFilePath = path.join(targetDiskDir, finalName);

  if (!overwrite) {
    let counter = 1;
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    while (fs.existsSync(targetFilePath)) {
      finalName = `${base} (${counter})${ext}`;
      targetFilePath = path.join(targetDiskDir, finalName);
      counter++;
    }
  }

  StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, targetFilePath));
  await fsPromises.rename(tempFilePath, targetFilePath);

  const metaFilePath = targetFilePath.replace(/\.[^.]+$/, '') + '.meta.json';
  const ext = path.extname(targetFilePath).toLowerCase().replace(/^\./, '');
  const mimeType = getMimeTypeForExt(ext);
  const sidecarMeta = {
    savedAt: new Date().toISOString(),
    originalName: finalName,
    sizeBytes: bytesWritten,
    mimeType,
    ...metadata
  };
  await fsPromises.writeFile(metaFilePath, JSON.stringify(sidecarMeta, null, 2), 'utf8');

  DriveService.invalidateStatsCache();

  const itemRelPath = normFolder === '/' ? `/${finalName}` : `${normFolder}/${finalName}`;
  return reply.status(201).send({
    success: true,
    data: {
      path: itemRelPath,
      name: finalName,
      sizeBytes: bytesWritten
    }
  });
}

/**
 * Auth-Gated Universal Save Artifact to Drive
 * Handles copying by fileId or direct multipart upload into /pdf, /converted, /archives, /images, /documents
 */
export async function saveArtifactHandler(request: FastifyRequest, reply: FastifyReply) {
  if (request.isMultipart()) {
    return handleMultipartSaveArtifact(request, reply);
  }

  const body = saveArtifactJsonSchema.parse(request.body || {});
  const normFolder = DriveService.normalizeRelativePath(body.targetFolder);

  if (!ALLOWED_ARTIFACT_FOLDERS.includes(normFolder as any)) {
    throw new BadRequestError(`Thư mục đích không hợp lệ. Chỉ chấp nhận: ${ALLOWED_ARTIFACT_FOLDERS.join(', ')}`);
  }

  const fileRecord = await prisma.fileRecord.findUnique({
    where: { id: body.fileId.trim() }
  });

  if (!fileRecord || fileRecord.isPurged || !fs.existsSync(fileRecord.storagePath)) {
    throw new NotFoundError(`Tệp nguồn không tồn tại hoặc đã bị xóa`);
  }

  const targetDiskDir = DriveService.getDiskPath(normFolder);
  if (!fs.existsSync(targetDiskDir)) {
    await fsPromises.mkdir(targetDiskDir, { recursive: true });
  }

  const candidateName = (body.fileName || fileRecord.originalName || 'artifact').trim();
  const originalName = path.basename(candidateName).replace(/[\\/:*?"<>|\0]/g, '_') || 'artifact';

  let finalName = originalName;
  let targetFilePath = path.join(targetDiskDir, finalName);

  if (!body.overwrite) {
    let counter = 1;
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    while (fs.existsSync(targetFilePath)) {
      finalName = `${base} (${counter})${ext}`;
      targetFilePath = path.join(targetDiskDir, finalName);
      counter++;
    }
  }

  StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, targetFilePath));
  await fsPromises.copyFile(fileRecord.storagePath, targetFilePath);
  const stat = await fsPromises.stat(targetFilePath);

  const metaFilePath = targetFilePath.replace(/\.[^.]+$/, '') + '.meta.json';
  const sidecarMeta = {
    savedAt: new Date().toISOString(),
    sourceFileId: fileRecord.id,
    originalName: fileRecord.originalName,
    sizeBytes: stat.size,
    mimeType: fileRecord.mimeType,
    ...(body.metadata || {})
  };
  await fsPromises.writeFile(metaFilePath, JSON.stringify(sidecarMeta, null, 2), 'utf8');

  DriveService.invalidateStatsCache();

  const itemRelPath = normFolder === '/' ? `/${finalName}` : `${normFolder}/${finalName}`;
  return reply.status(201).send({
    success: true,
    data: {
      path: itemRelPath,
      name: finalName,
      sizeBytes: stat.size
    }
  });
}
