/**
 * Resumable Chunked Upload Controller
 * Handles atomic chunk ingestion, status checks, streaming backpressure assembly,
 * incremental disk reclaiming, and CasaOS storage drive integration.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { prisma } from '../../lib/prisma.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { DriveService } from '../../services/drive.service.js';
import { computeExpiresAt } from '../../config/limits.config.js';
import { resolvedStoragePaths } from '../../config/env.config.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export function getChunkDir(uploadId: string): string {
  const sanitized = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(resolvedStoragePaths.temp, 'chunks', sanitized);
}

export async function initChunkUpload(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    fileName: string;
    fileSize: number;
    totalChunks: number;
    chunkSize?: number;
    purpose?: string;
    targetDir?: string;
    strictSizeCheck?: boolean;
  };

  if (!body?.fileName || typeof body.fileSize !== 'number' || !body.totalChunks) {
    throw new BadRequestError('Missing fileName, fileSize, or totalChunks');
  }

  const uploadId = `upl_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const chunkDir = getChunkDir(uploadId);
  await fsPromises.mkdir(chunkDir, { recursive: true });

  const metadata = {
    uploadId,
    fileName: path.basename(body.fileName),
    fileSize: body.fileSize,
    totalChunks: body.totalChunks,
    chunkSize: body.chunkSize || 5 * 1024 * 1024,
    purpose: body.purpose || 'archive-inspect',
    targetDir: body.targetDir || '/',
    strictSizeCheck: body.strictSizeCheck ?? false,
    createdAt: Date.now()
  };

  await fsPromises.writeFile(path.join(chunkDir, 'meta.json'), JSON.stringify(metadata), 'utf-8');

  return reply.status(200).send({
    success: true,
    data: {
      uploadId,
      chunkSize: metadata.chunkSize,
      totalChunks: body.totalChunks,
      uploadedChunks: []
    }
  });
}

export async function uploadChunkPart(request: FastifyRequest, reply: FastifyReply) {
  const data = await request.file();
  if (!data) throw new BadRequestError('No chunk payload found');

  const query = (request.query || {}) as Record<string, string>;
  const fields = (data.fields || {}) as Record<string, any>;

  const uploadId = String(query.uploadId || fields.uploadId?.value || '');
  const chunkIndex = Number(query.chunkIndex ?? fields.chunkIndex?.value);

  if (!uploadId || isNaN(chunkIndex)) {
    throw new BadRequestError('uploadId and chunkIndex are required');
  }

  const chunkDir = getChunkDir(uploadId);
  if (!fs.existsSync(chunkDir)) {
    throw new NotFoundError(`Upload session '${uploadId}' expired or not found`);
  }

  const finalChunkPath = path.join(chunkDir, `chunk_${chunkIndex}.part`);
  const tempChunkPath = path.join(chunkDir, `chunk_${chunkIndex}.part.tmp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
  const writeStream = fs.createWriteStream(tempChunkPath, { highWaterMark: 4 * 1024 * 1024 });

  let bytesReceived = 0;
  const countStream = new Transform({
    transform(chunk, _encoding, callback) {
      bytesReceived += chunk.length;
      callback(null, chunk);
    }
  });

  try {
    await pipeline(data.file, countStream, writeStream);
    // Atomic rename only when payload stream is completely written without errors
    await fsPromises.rename(tempChunkPath, finalChunkPath);
  } catch (err) {
    await StorageManager.unlinkSafe(tempChunkPath);
    throw err;
  }

  return reply.status(200).send({
    success: true,
    data: { uploadId, chunkIndex, bytesReceived }
  });
}

export async function getChunkStatus(request: FastifyRequest, reply: FastifyReply) {
  const { uploadId } = request.params as { uploadId: string };
  const chunkDir = getChunkDir(uploadId);

  if (!fs.existsSync(chunkDir)) {
    return reply.status(200).send({
      success: true,
      data: { exists: false, uploadedChunks: [] }
    });
  }

  const metaPath = path.join(chunkDir, 'meta.json');
  let meta: any = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf-8'));
    } catch (_) {}
  }

  const entries = await fsPromises.readdir(chunkDir);
  const uploadedChunks: number[] = [];
  for (const entry of entries) {
    const match = entry.match(/^chunk_(\d+)\.part$/);
    if (match) uploadedChunks.push(parseInt(match[1], 10));
  }
  uploadedChunks.sort((a, b) => a - b);

  return reply.status(200).send({
    success: true,
    data: {
      exists: true,
      uploadId,
      fileName: meta.fileName || '',
      fileSize: meta.fileSize || 0,
      totalChunks: meta.totalChunks || 0,
      purpose: meta.purpose || '',
      uploadedChunks
    }
  });
}

export async function completeChunkUpload(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as { uploadId: string };
  if (!body?.uploadId) throw new BadRequestError('uploadId is required');

  const chunkDir = getChunkDir(body.uploadId);
  if (!fs.existsSync(chunkDir)) {
    throw new NotFoundError(`Upload session '${body.uploadId}' does not exist`);
  }

  const metaPath = path.join(chunkDir, 'meta.json');
  if (!fs.existsSync(metaPath)) throw new BadRequestError('Missing metadata for upload session');

  const meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf-8'));
  const totalChunks = meta.totalChunks as number;
  const isStorageDrive = meta.purpose === 'storage-drive';

  // 1. Verify all chunk parts exist before starting assembly
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}.part`);
    if (!fs.existsSync(chunkPath)) {
      throw new BadRequestError(`Missing chunk #${i}`);
    }
  }

  const fileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const ext = path.extname(meta.fileName) || '.bin';

  let targetPath = '';
  let finalFileName = meta.fileName;
  let itemRelPath = '';

  if (isStorageDrive) {
    const rawTargetDir = meta.targetDir || '/';
    const diskDir = DriveService.getDiskPath(rawTargetDir);
    if (!fs.existsSync(diskDir)) {
      await fsPromises.mkdir(diskDir, { recursive: true });
    }

    const originalName = path.basename(meta.fileName).replace(/[\\/:*?"<>|]/g, '_') || 'file.bin';
    const base = path.basename(originalName, ext);
    let candidateName = originalName;
    let candidatePath = path.join(diskDir, candidateName);
    let counter = 1;

    while (fs.existsSync(candidatePath)) {
      candidateName = `${base} (${counter})${ext}`;
      candidatePath = path.join(diskDir, candidateName);
      counter++;
    }

    StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, candidatePath));
    targetPath = candidatePath;
    finalFileName = candidateName;
    itemRelPath = rawTargetDir === '/' ? `/${finalFileName}` : `${DriveService.normalizeRelativePath(rawTargetDir)}/${finalFileName}`;
  } else {
    targetPath = StorageManager.getUploadPath(fileId, ext);
  }

  const writeStream = fs.createWriteStream(targetPath, { highWaterMark: 4 * 1024 * 1024 });
  const hash = crypto.createHash('sha256');
  let totalBytes = 0;

  try {
    // Stream each chunk sequentially with backpressure, deleting chunk immediately to reclaim disk space
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}.part`);
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath, { highWaterMark: 4 * 1024 * 1024 });
        readStream.on('data', (chunk: Buffer | string) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buf.length;
          hash.update(buf);
          if (!writeStream.write(buf)) {
            readStream.pause();
            writeStream.once('drain', () => readStream.resume());
          }
        });
        readStream.on('end', () => resolve());
        readStream.on('error', (err) => reject(err));
      });

      // Incremental disk reclaim: delete chunk immediately after it has been written
      await StorageManager.unlinkSafe(chunkPath);
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.once('finish', () => resolve());
      writeStream.once('error', reject);
    });

    if (meta.strictSizeCheck && meta.fileSize && totalBytes !== Number(meta.fileSize)) {
      throw new Error(`Kích thước tệp không khớp (nhận ${totalBytes} bytes, kỳ vọng ${meta.fileSize} bytes)`);
    }
  } catch (err) {
    writeStream.destroy();
    await StorageManager.unlinkSafe(targetPath);
    throw err;
  }

  // Cleanup session directory
  await fsPromises.rm(chunkDir, { recursive: true, force: true }).catch(() => {});

  const hashSha256 = hash.digest('hex');
  const expiresAt = computeExpiresAt();

  if (isStorageDrive) {
    logger.info({ finalFileName, targetPath, sizeBytes: totalBytes }, 'Storage drive chunked upload complete');
    return reply.status(201).send({
      success: true,
      data: {
        fileId,
        name: finalFileName,
        originalName: finalFileName,
        path: itemRelPath,
        sizeBytes: totalBytes,
        hashSha256
      }
    });
  }

  const fileRecord = await prisma.fileRecord.create({
    data: {
      id: fileId,
      purpose: meta.purpose || 'UPLOAD',
      originalName: meta.fileName,
      storagePath: targetPath,
      mimeType: 'application/octet-stream',
      sizeBytes: BigInt(totalBytes),
      hashSha256,
      isPurged: false,
      expiresAt
    }
  });

  logger.info({ fileId, originalName: meta.fileName, sizeBytes: totalBytes }, 'Chunked file assembly complete');

  return reply.status(201).send({
    success: true,
    data: {
      fileId: fileRecord.id,
      originalName: fileRecord.originalName,
      sizeBytes: Number(fileRecord.sizeBytes),
      hashSha256: fileRecord.hashSha256,
      expiresAt: fileRecord.expiresAt.toISOString()
    }
  });
}

export async function abortChunkUpload(request: FastifyRequest, reply: FastifyReply) {
  const { uploadId } = request.params as { uploadId: string };
  const chunkDir = getChunkDir(uploadId);
  await fsPromises.rm(chunkDir, { recursive: true, force: true }).catch(() => {});
  return reply.status(200).send({ success: true, message: 'Upload session deleted' });
}
