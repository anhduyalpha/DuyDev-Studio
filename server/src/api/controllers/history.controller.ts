/**
 * History & Trash Bin Controller
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import {
  createHistorySchema,
  historyQuerySchema,
  historyIdParamSchema
} from '../../schemas/history.schema.js';
import { StorageManager } from '../../storage/storage.manager.js';

function extractDeviceAndAdmin(req: FastifyRequest): { deviceId: string | null; isAdmin: boolean } {
  const deviceIdHeader = (req.headers['x-device-id'] as string) || (req.query as any)?.deviceId;
  const deviceId = deviceIdHeader ? String(deviceIdHeader).trim() : null;
  const isAdmin = req.headers['x-is-admin'] === 'true' || Boolean(req.headers['x-admin-token']);
  return { deviceId, isAdmin };
}

function formatHistoryRecord(r: {
  id: string;
  deviceId?: string | null;
  toolId: string;
  toolTitle: string;
  fileName: string;
  originalSize: bigint;
  resultSize: bigint;
  resultFileId: string | null;
  downloadUrl: string | null;
  status: string;
  detailsJson: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...r,
    originalSize: Number(r.originalSize),
    resultSize: Number(r.resultSize)
  };
}

export async function getHistory(req: FastifyRequest, reply: FastifyReply) {
  const query = historyQuerySchema.parse(req.query || {});
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);

  // Scoped query: regular guests only see their own records matching their deviceId
  const whereClause: any = { isDeleted: false };
  if (!isAdmin) {
    if (deviceId) {
      whereClause.deviceId = deviceId;
    } else {
      whereClause.deviceId = '__unidentified_guest__';
    }
  } else if (query.deviceId) {
    whereClause.deviceId = query.deviceId;
  }

  if (query.toolId) {
    const baseTool = String(query.toolId).replace(/-downloader$/, '');
    whereClause.toolId = { in: [query.toolId, baseTool, `${baseTool}-downloader`] };
  }

  const [items, total] = await Promise.all([
    prisma.historyRecord.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset
    }),
    prisma.historyRecord.count({ where: whereClause })
  ]);

  return reply.send({
    success: true,
    data: {
      items: items.map(formatHistoryRecord),
      total
    }
  });
}

export async function createHistoryItem(req: FastifyRequest, reply: FastifyReply) {
  const body = createHistorySchema.parse(req.body);
  const { deviceId } = extractDeviceAndAdmin(req);
  const targetDeviceId = deviceId || body.deviceId || null;

  if (body.id || body.resultFileId || body.downloadUrl) {
    const existing = await prisma.historyRecord.findFirst({
      where: {
        ...(targetDeviceId ? { OR: [{ deviceId: targetDeviceId }, { deviceId: null }] } : {}),
        AND: [
          {
            OR: [
              ...(body.id ? [{ id: body.id }] : []),
              ...(body.resultFileId ? [{ resultFileId: body.resultFileId }] : []),
              ...(body.downloadUrl ? [{ downloadUrl: body.downloadUrl }] : [])
            ]
          }
        ]
      }
    });
    if (existing) {
      const updateData: any = {};
      if (!existing.deviceId && targetDeviceId) {
        updateData.deviceId = targetDeviceId;
        existing.deviceId = targetDeviceId;
      }
      if (body.detailsJson && body.detailsJson !== existing.detailsJson) {
        updateData.detailsJson = body.detailsJson;
        existing.detailsJson = body.detailsJson;
      }
      // If re-recorded or re-downloaded, ensure it's not marked as deleted
      if (existing.isDeleted) {
        updateData.isDeleted = false;
        updateData.deletedAt = null;
        existing.isDeleted = false;
        existing.deletedAt = null;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.historyRecord.update({
          where: { id: existing.id },
          data: updateData
        }).catch(() => {});
      }
      return reply.send({
        success: true,
        data: formatHistoryRecord(existing)
      });
    }
  }

  const created = await prisma.historyRecord.create({
    data: {
      ...(body.id ? { id: body.id } : {}),
      deviceId: targetDeviceId,
      toolId: body.toolId,
      toolTitle: body.toolTitle,
      fileName: body.fileName,
      originalSize: BigInt(body.originalSize || 0),
      resultSize: BigInt(body.resultSize || 0),
      resultFileId: body.resultFileId || null,
      downloadUrl: body.downloadUrl || null,
      status: body.status || 'success',
      detailsJson: body.detailsJson || null
    }
  });

  return reply.status(201).send({
    success: true,
    data: formatHistoryRecord(created)
  });
}

async function findHistoryRecordByIdOrUrl(id: string) {
  if (!id) return null;
  let existing = await prisma.historyRecord.findUnique({ where: { id } }).catch(() => null);
  if (!existing) {
    existing = await prisma.historyRecord.findFirst({
      where: {
        OR: [
          { resultFileId: id },
          { downloadUrl: id },
          { downloadUrl: `/api/v1/files/download/${id}` },
          { downloadUrl: { contains: id } },
          { detailsJson: { contains: id } }
        ]
      }
    });
  }
  return existing;
}

export async function softDeleteHistoryItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = historyIdParamSchema.parse(req.params);
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`History item ${id} not found`);

  // Guard: if guest and record has a deviceId, ensure it matches
  if (!isAdmin && existing.deviceId && deviceId && existing.deviceId !== deviceId) {
    throw new NotFoundError(`History item ${id} not found`);
  }

  const updated = await prisma.historyRecord.update({
    where: { id: existing.id },
    data: { isDeleted: true, deletedAt: new Date() }
  });

  return reply.send({
    success: true,
    data: formatHistoryRecord(updated)
  });
}

export async function clearHistoryToTrash(req: FastifyRequest, reply: FastifyReply) {
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);
  const toolId = (req.query as any)?.toolId || (req.body as any)?.toolId;
  const whereClause: any = { isDeleted: false };
  if (!isAdmin) {
    whereClause.deviceId = deviceId || '__unidentified_guest__';
  }
  if (toolId) {
    const baseTool = String(toolId).replace(/-downloader$/, '');
    whereClause.toolId = { in: [toolId, baseTool, `${baseTool}-downloader`] };
  }

  const res = await prisma.historyRecord.updateMany({
    where: whereClause,
    data: { isDeleted: true, deletedAt: new Date() }
  });

  return reply.send({
    success: true,
    count: res.count
  });
}

export async function getTrashItems(req: FastifyRequest, reply: FastifyReply) {
  const query = historyQuerySchema.parse(req.query || {});
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);

  const whereClause: any = { isDeleted: true };
  if (!isAdmin) {
    if (deviceId) {
      whereClause.deviceId = deviceId;
    } else {
      whereClause.deviceId = '__unidentified_guest__';
    }
  } else if (query.deviceId) {
    whereClause.deviceId = query.deviceId;
  }

  if (query.toolId) {
    const baseTool = String(query.toolId).replace(/-downloader$/, '');
    whereClause.toolId = { in: [query.toolId, baseTool, `${baseTool}-downloader`] };
  }

  const [items, total] = await Promise.all([
    prisma.historyRecord.findMany({
      where: whereClause,
      orderBy: { deletedAt: 'desc' },
      take: query.limit,
      skip: query.offset
    }),
    prisma.historyRecord.count({ where: whereClause })
  ]);

  return reply.send({
    success: true,
    data: {
      items: items.map(formatHistoryRecord),
      total
    }
  });
}

export async function restoreTrashItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = historyIdParamSchema.parse(req.params);
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`Trash item ${id} not found`);

  if (!isAdmin && existing.deviceId && deviceId && existing.deviceId !== deviceId) {
    throw new NotFoundError(`Trash item ${id} not found`);
  }

  const restored = await prisma.historyRecord.update({
    where: { id: existing.id },
    data: { isDeleted: false, deletedAt: null }
  });

  return reply.send({
    success: true,
    data: formatHistoryRecord(restored)
  });
}

export async function restoreAllTrash(req: FastifyRequest, reply: FastifyReply) {
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);
  const toolId = (req.query as any)?.toolId || (req.body as any)?.toolId;
  const whereClause: any = { isDeleted: true };
  if (!isAdmin) {
    whereClause.deviceId = deviceId || '__unidentified_guest__';
  }
  if (toolId) {
    const baseTool = String(toolId).replace(/-downloader$/, '');
    whereClause.toolId = { in: [toolId, baseTool, `${baseTool}-downloader`] };
  }

  const res = await prisma.historyRecord.updateMany({
    where: whereClause,
    data: { isDeleted: false, deletedAt: null }
  });

  return reply.send({
    success: true,
    count: res.count
  });
}

export async function permanentlyDeleteTrashItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = historyIdParamSchema.parse(req.params);
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`Item ${id} not found`);

  if (!isAdmin && existing.deviceId && deviceId && existing.deviceId !== deviceId) {
    throw new NotFoundError(`Item ${id} not found`);
  }

  const fileId = existing.resultFileId || existing.downloadUrl?.match(/fil_[a-zA-Z0-9_]+/)?.[0];
  if (fileId && typeof fileId === 'string' && fileId.trim() !== '') {
    const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } }).catch(() => null);
    if (fileRecord?.storagePath) await StorageManager.unlinkSafe(fileRecord.storagePath);
    await prisma.fileRecord.delete({ where: { id: fileId } }).catch(() => {});
  }

  await prisma.historyRecord.delete({ where: { id: existing.id } });
  return reply.send({ success: true, message: 'Item permanently deleted' });
}

export async function emptyTrash(req: FastifyRequest, reply: FastifyReply) {
  const { deviceId, isAdmin } = extractDeviceAndAdmin(req);
  const toolId = (req.query as any)?.toolId || (req.body as any)?.toolId;
  const whereClause: any = { isDeleted: true };
  if (!isAdmin) {
    whereClause.deviceId = deviceId || '__unidentified_guest__';
  }
  if (toolId) {
    const baseTool = String(toolId).replace(/-downloader$/, '');
    whereClause.toolId = { in: [toolId, baseTool, `${baseTool}-downloader`] };
  }

  const trashedItems = await prisma.historyRecord.findMany({
    where: whereClause,
    select: { resultFileId: true, downloadUrl: true }
  });

  const fileIds = new Set<string>();
  for (const item of trashedItems) {
    const fileId = item.resultFileId || item.downloadUrl?.match(/fil_[a-zA-Z0-9_]+/)?.[0];
    if (fileId) fileIds.add(fileId);
  }

  if (fileIds.size > 0) {
    const idsArray = Array.from(fileIds);
    const fileRecords = await prisma.fileRecord.findMany({
      where: { id: { in: idsArray } },
      select: { id: true, storagePath: true }
    });

    await Promise.all(
      fileRecords
        .filter((f) => f.storagePath)
        .map((f) => StorageManager.unlinkSafe(f.storagePath).catch(() => {}))
    );

    await prisma.fileRecord.deleteMany({
      where: { id: { in: idsArray } }
    }).catch(() => {});
  }

  const res = await prisma.historyRecord.deleteMany({ where: whereClause });
  return reply.send({ success: true, count: res.count });
}
