/**
 * History & Trash Bin Controller
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import {
  createHistorySchema,
  bulkHistorySchema,
  historyQuerySchema,
  historyIdParamSchema
} from '../../schemas/history.schema.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { deviceRegistryService } from '../../services/device-registry.service.js';

function extractDeviceAndAdmin(req: FastifyRequest): {
  deviceId: string | null;
  isAdmin: boolean;
  groupDeviceIds: string[];
} {
  const deviceIdHeader = (req.headers['x-device-id'] as string) || (req.query as any)?.deviceId;
  const deviceId = deviceIdHeader ? String(deviceIdHeader).trim() : null;
  const isAdmin = (req as any).isAdmin === true || req.headers['x-is-admin'] === 'true' || Boolean(req.headers['x-admin-token']);
  const groupDeviceIds = deviceId ? deviceRegistryService.getSyncGroupDeviceIds(deviceId) : [];
  return { deviceId, isAdmin, groupDeviceIds };
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);

  // Scoped query: regular guests and paired sync groups see records matching their devices
  const whereClause: any = { isDeleted: false };
  let effectiveGroup = groupDeviceIds;
  if (effectiveGroup.length <= 1 && query.deviceId) {
    const qGroup = deviceRegistryService.getSyncGroupDeviceIds(query.deviceId);
    if (qGroup.length > 1) {
      effectiveGroup = qGroup;
    }
  }

  if (effectiveGroup.length > 1) {
    whereClause.deviceId = { in: effectiveGroup };
  } else if (!isAdmin) {
    whereClause.deviceId = deviceId || query.deviceId || '__unidentified_guest__';
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
  const { deviceId, groupDeviceIds } = extractDeviceAndAdmin(req);
  const targetDeviceId = deviceId || body.deviceId || null;
  const targetDeviceIds = groupDeviceIds.length > 0 ? groupDeviceIds : (targetDeviceId ? [targetDeviceId] : []);

  if (body.id || body.resultFileId || body.downloadUrl) {
    const existing = await prisma.historyRecord.findFirst({
      where: {
        ...(targetDeviceIds.length > 0 ? { OR: [{ deviceId: { in: targetDeviceIds } }, { deviceId: null }] } : {}),
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

export async function createBulkHistoryItems(req: FastifyRequest, reply: FastifyReply) {
  const body = bulkHistorySchema.parse(req.body);
  const { deviceId, groupDeviceIds } = extractDeviceAndAdmin(req);
  const targetDeviceId = deviceId || null;
  const targetDeviceIds = groupDeviceIds.length > 0 ? groupDeviceIds : (targetDeviceId ? [targetDeviceId] : []);

  const results: any[] = [];

  for (const item of body.items) {
    const itemTargetDeviceId = targetDeviceId || item.deviceId || null;
    let existing: any = null;

    if (item.id || item.resultFileId || item.downloadUrl) {
      existing = await prisma.historyRecord.findFirst({
        where: {
          ...(targetDeviceIds.length > 0 ? { OR: [{ deviceId: { in: targetDeviceIds } }, { deviceId: null }] } : {}),
          AND: [
            {
              OR: [
                ...(item.id ? [{ id: item.id }] : []),
                ...(item.resultFileId ? [{ resultFileId: item.resultFileId }] : []),
                ...(item.downloadUrl ? [{ downloadUrl: item.downloadUrl }] : [])
              ]
            }
          ]
        }
      });
    }

    if (existing) {
      const updateData: any = {};
      if (!existing.deviceId && itemTargetDeviceId) {
        updateData.deviceId = itemTargetDeviceId;
        existing.deviceId = itemTargetDeviceId;
      }
      if (item.detailsJson && item.detailsJson !== existing.detailsJson) {
        updateData.detailsJson = item.detailsJson;
        existing.detailsJson = item.detailsJson;
      }
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
      results.push(formatHistoryRecord(existing));
    } else {
      const created = await prisma.historyRecord.create({
        data: {
          ...(item.id ? { id: item.id } : {}),
          deviceId: itemTargetDeviceId,
          toolId: item.toolId,
          toolTitle: item.toolTitle,
          fileName: item.fileName,
          originalSize: BigInt(Math.max(0, Math.round(Number(item.originalSize) || 0))),
          resultSize: BigInt(Math.max(0, Math.round(Number(item.resultSize) || 0))),
          resultFileId: item.resultFileId || null,
          downloadUrl: item.downloadUrl || null,
          status: item.status || 'success',
          detailsJson: item.detailsJson || null
        }
      });
      results.push(formatHistoryRecord(created));
    }
  }

  return reply.status(200).send({
    success: true,
    data: {
      count: results.length,
      items: results
    }
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`History item ${id} not found`);

  // Guard: if guest and record has a deviceId, ensure it matches either deviceId or belongs to the sync group
  if (!isAdmin && existing.deviceId && deviceId && !groupDeviceIds.includes(existing.deviceId)) {
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);
  const toolId = (req.query as any)?.toolId || (req.body as any)?.toolId;
  const whereClause: any = { isDeleted: false };
  if (groupDeviceIds.length > 1) {
    whereClause.deviceId = { in: groupDeviceIds };
  } else if (!isAdmin) {
    whereClause.deviceId = deviceId || '__unidentified_guest__';
  } else if (deviceId) {
    whereClause.deviceId = deviceId;
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);

  const whereClause: any = { isDeleted: true };
  let effectiveGroup = groupDeviceIds;
  if (effectiveGroup.length <= 1 && query.deviceId) {
    const qGroup = deviceRegistryService.getSyncGroupDeviceIds(query.deviceId);
    if (qGroup.length > 1) {
      effectiveGroup = qGroup;
    }
  }

  if (effectiveGroup.length > 1) {
    whereClause.deviceId = { in: effectiveGroup };
  } else if (!isAdmin) {
    whereClause.deviceId = deviceId || query.deviceId || '__unidentified_guest__';
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`Trash item ${id} not found`);

  if (!isAdmin && existing.deviceId && deviceId && !groupDeviceIds.includes(existing.deviceId)) {
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);
  const toolId = (req.query as any)?.toolId || (req.body as any)?.toolId;
  const whereClause: any = { isDeleted: true };
  if (groupDeviceIds.length > 1) {
    whereClause.deviceId = { in: groupDeviceIds };
  } else if (!isAdmin) {
    whereClause.deviceId = deviceId || '__unidentified_guest__';
  } else if (deviceId) {
    whereClause.deviceId = deviceId;
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`Item ${id} not found`);

  if (!isAdmin && existing.deviceId && deviceId && !groupDeviceIds.includes(existing.deviceId)) {
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
  const { deviceId, isAdmin, groupDeviceIds } = extractDeviceAndAdmin(req);
  const toolId = (req.query as any)?.toolId || (req.body as any)?.toolId;
  const whereClause: any = { isDeleted: true };
  if (groupDeviceIds.length > 1) {
    whereClause.deviceId = { in: groupDeviceIds };
  } else if (!isAdmin) {
    whereClause.deviceId = deviceId || '__unidentified_guest__';
  } else if (deviceId) {
    whereClause.deviceId = deviceId;
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
