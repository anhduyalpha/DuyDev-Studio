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

function formatHistoryRecord(r: {
  id: string;
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
  const [items, total] = await Promise.all([
    prisma.historyRecord.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset
    }),
    prisma.historyRecord.count({ where: { isDeleted: false } })
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

  if (body.resultFileId || body.downloadUrl) {
    const existing = await prisma.historyRecord.findFirst({
      where: {
        OR: [
          ...(body.resultFileId ? [{ resultFileId: body.resultFileId }] : []),
          ...(body.downloadUrl ? [{ downloadUrl: body.downloadUrl }] : [])
        ]
      }
    });
    if (existing) {
      return reply.send({
        success: true,
        data: formatHistoryRecord(existing)
      });
    }
  }

  const created = await prisma.historyRecord.create({
    data: {
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
  let existing = await prisma.historyRecord.findUnique({ where: { id } }).catch(() => null);
  if (!existing) {
    existing = await prisma.historyRecord.findFirst({
      where: {
        OR: [
          { resultFileId: id },
          { downloadUrl: id },
          { downloadUrl: `/api/v1/files/download/${id}` }
        ]
      }
    });
  }
  return existing;
}

export async function softDeleteHistoryItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = historyIdParamSchema.parse(req.params);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`History item ${id} not found`);

  const updated = await prisma.historyRecord.update({
    where: { id: existing.id },
    data: { isDeleted: true, deletedAt: new Date() }
  });

  return reply.send({
    success: true,
    data: formatHistoryRecord(updated)
  });
}

export async function clearHistoryToTrash(_req: FastifyRequest, reply: FastifyReply) {
  const res = await prisma.historyRecord.updateMany({
    where: { isDeleted: false },
    data: { isDeleted: true, deletedAt: new Date() }
  });

  return reply.send({
    success: true,
    count: res.count
  });
}

export async function getTrashItems(req: FastifyRequest, reply: FastifyReply) {
  const query = historyQuerySchema.parse(req.query || {});
  const [items, total] = await Promise.all([
    prisma.historyRecord.findMany({
      where: { isDeleted: true },
      orderBy: { deletedAt: 'desc' },
      take: query.limit,
      skip: query.offset
    }),
    prisma.historyRecord.count({ where: { isDeleted: true } })
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
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`Trash item ${id} not found`);

  const restored = await prisma.historyRecord.update({
    where: { id: existing.id },
    data: { isDeleted: false, deletedAt: null }
  });

  return reply.send({
    success: true,
    data: formatHistoryRecord(restored)
  });
}

export async function restoreAllTrash(_req: FastifyRequest, reply: FastifyReply) {
  const res = await prisma.historyRecord.updateMany({
    where: { isDeleted: true },
    data: { isDeleted: false, deletedAt: null }
  });

  return reply.send({
    success: true,
    count: res.count
  });
}

export async function permanentlyDeleteTrashItem(req: FastifyRequest, reply: FastifyReply) {
  const { id } = historyIdParamSchema.parse(req.params);
  const existing = await findHistoryRecordByIdOrUrl(id);
  if (!existing) throw new NotFoundError(`Item ${id} not found`);

  const fileId = existing.resultFileId || existing.downloadUrl?.match(/fil_[a-zA-Z0-9_]+/)?.[0];
  if (fileId) {
    const fileRecord = await prisma.fileRecord.findUnique({ where: { id: fileId } }).catch(() => null);
    if (fileRecord?.storagePath) await StorageManager.unlinkSafe(fileRecord.storagePath);
    await prisma.fileRecord.delete({ where: { id: fileId } }).catch(() => {});
  }

  await prisma.historyRecord.delete({ where: { id: existing.id } });
  return reply.send({ success: true, message: 'Item permanently deleted' });
}

export async function emptyTrash(_req: FastifyRequest, reply: FastifyReply) {
  const trashedItems = await prisma.historyRecord.findMany({
    where: { isDeleted: true },
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

  const res = await prisma.historyRecord.deleteMany({ where: { isDeleted: true } });
  return reply.send({ success: true, count: res.count });
}
