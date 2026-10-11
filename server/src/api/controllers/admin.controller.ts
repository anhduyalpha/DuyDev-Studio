/**
 * Admin Controller - System Telemetry, AI Key & Quota Management, Quick Actions
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminTelemetryService } from '../../services/admin-telemetry.service.js';
import { aiMetricsService } from '../../services/ai-metrics.service.js';
import { JanitorService } from '../../services/janitor.service.js';
import { telemetryTracker } from '../middleware/telemetry.middleware.js';
import { BadRequestError } from '../../lib/errors.js';

const updateKeySchema = z.object({
  id: z.string().min(1, 'Key ID is required'),
  name: z.string().optional(),
  provider: z.enum(['agnes', 'gemini', 'openai', 'custom']).optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  priority: z.coerce.number().min(1).optional(),
  isActive: z.boolean().optional()
});

const deleteKeySchema = z.object({
  id: z.string().min(1, 'Key ID is required')
});

const testKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required')
});

const getFailedJobsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  type: z.string().optional()
});

const inspectStorageQuerySchema = z.object({
  folder: z.enum(['temp', 'uploads', 'processed', 'drive'])
});

const deleteStorageFileBodySchema = z.object({
  folder: z.enum(['temp', 'uploads', 'processed', 'drive']),
  fileName: z.string().min(1, 'fileName is required')
});

/**
 * GET /api/v1/admin/telemetry
 * Returns comprehensive telemetry snapshot
 */
export async function getAdminTelemetryHandler(_request: FastifyRequest, reply: FastifyReply) {
  const telemetry = await adminTelemetryService.getCompleteTelemetry();
  return reply.send({
    success: true,
    data: telemetry
  });
}

/**
 * GET /api/v1/admin/ai/metrics
 * Returns detailed AI metrics, rate limits, masked keys, and invocation logs
 */
export async function getAiMetricsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const metrics = aiMetricsService.getTelemetryData();
  return reply.send({
    success: true,
    data: metrics
  });
}

/**
 * POST /api/v1/admin/ai/keys
 * Updates or registers an AI agent key configuration
 */
export async function updateAiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = updateKeySchema.safeParse(request.body);
  if (!parseResult.success) {
    const msg = parseResult.error.errors[0]?.message || 'Dữ liệu không hợp lệ';
    throw new BadRequestError(msg);
  }

  const updatedKey = aiMetricsService.updateKey(parseResult.data);
  return reply.send({
    success: true,
    message: 'Cập nhật API Key thành công',
    data: {
      id: updatedKey.id,
      name: updatedKey.name,
      provider: updatedKey.provider,
      baseUrl: updatedKey.baseUrl,
      model: updatedKey.model,
      priority: updatedKey.priority,
      apiKeyMasked: aiMetricsService.maskKey(updatedKey.apiKey),
      isActive: updatedKey.isActive
    }
  });
}

/**
 * DELETE /api/v1/admin/ai/keys/:id
 * POST /api/v1/admin/ai/keys/delete
 * Deletes an AI agent fallback key configuration
 */
export async function deleteAiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramId = (request.params as any)?.id;
  const bodyId = (request.body as any)?.id;
  const keyId = paramId || bodyId;

  if (!keyId) {
    throw new BadRequestError('Vui lòng cung cấp keyId cần xóa');
  }

  const result = aiMetricsService.deleteKey(keyId);
  return reply.send({
    success: true,
    message: result.message,
    data: result
  });
}

/**
 * POST /api/v1/admin/ai/test-key
 * Pings the AI agent endpoint with current credentials to measure latency and test validity
 */
export async function testAiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = testKeySchema.safeParse(request.body);
  if (!parseResult.success) {
    const msg = parseResult.error.errors[0]?.message || 'Vui lòng cung cấp keyId để kiểm tra';
    throw new BadRequestError(msg);
  }

  const result = await aiMetricsService.testPingKey(parseResult.data.keyId);
  return reply.send({
    success: result.success,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/clean-temp
 * Purges disk temporary files in storage/temp
 */
export async function cleanTempStorageHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.cleanTempStorage();
  return reply.send({
    success: true,
    message: `Đã dọn dẹp ${result.cleanedFiles} tệp tạm (Giải phóng ${result.freedMb} MB)`,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/clean-r2
 * Purges orphaned objects in Cloudflare R2 transit/ prefix
 */
export async function cleanR2OrphansHandler(_request: FastifyRequest, reply: FastifyReply) {
  const purgedCount = await JanitorService.cleanOrphanedR2TransitObjects();
  return reply.send({
    success: true,
    message: `Đã dọn dẹp ${purgedCount} tệp mồ côi trên Cloudflare R2 transit`,
    data: { purgedCount }
  });
}

/**
 * POST /api/v1/admin/actions/clean-queues
 * Cleans completed and failed jobs in Redis BullMQ queues
 */
export async function cleanQueuesHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.cleanQueues();
  return reply.send({
    success: true,
    message: `Đã dọn dẹp ${result.cleanedJobs} tác vụ cũ trong Redis queues`,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/optimize-db
 * Runs SQLite WAL checkpoint and optimization
 */
export async function optimizeDatabaseHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.optimizeDatabase();
  return reply.send({
    success: result.success,
    message: result.message
  });
}

/**
 * POST /api/v1/admin/actions/clean-history
 * Purges deleted history records across database
 */
export async function cleanHistoryHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.cleanHistoryRecords();
  return reply.send({
    success: true,
    message: `Đã dọn dẹp ${result.deletedCount} bản ghi lịch sử đã xóa`,
    data: result
  });
}

/**
 * GET /api/v1/admin/logs/failed-jobs
 * Retrieves detailed log of failed processing jobs
 */
export async function getFailedJobsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = getFailedJobsQuerySchema.safeParse(request.query);
  const { limit, type } = parseResult.success ? parseResult.data : { limit: 50, type: undefined };
  const jobs = await adminTelemetryService.getFailedJobs(limit, type);
  return reply.send({
    success: true,
    data: {
      total: jobs.length,
      jobs
    }
  });
}

/**
 * POST /api/v1/admin/logs/clear-failed
 * Cleans all failed job logs and Redis failed jobs
 */
export async function clearFailedJobsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.clearFailedJobs();
  return reply.send({
    success: true,
    message: `Đã dọn dẹp ${result.deletedCount} nhật ký tác vụ thất bại`,
    data: result
  });
}

/**
 * GET /api/v1/admin/storage/inspect
 * Inspects physical files on disk in the specified folder
 */
export async function inspectStorageHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = inspectStorageQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    const msg = parseResult.error.errors[0]?.message || 'Thư mục không hợp lệ (temp, uploads, processed, drive)';
    throw new BadRequestError(msg);
  }
  const result = await adminTelemetryService.inspectStorageFolder(parseResult.data.folder);
  return reply.send({
    success: true,
    data: result
  });
}

/**
 * POST /api/v1/admin/storage/delete-file
 * Deletes an individual file from disk with verification
 */
export async function deleteStorageFileHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = deleteStorageFileBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    const msg = parseResult.error.errors[0]?.message || 'Tham số xóa tệp không hợp lệ';
    throw new BadRequestError(msg);
  }
  const result = await adminTelemetryService.deleteStorageFile(
    parseResult.data.folder,
    parseResult.data.fileName
  );
  return reply.send({
    success: true,
    message: `Đã xóa tệp ${result.fileName} (Giải phóng ${result.freedMb} MB)`,
    data: result
  });
}

const deleteR2ObjectBodySchema = z.object({
  key: z.string().min(1, 'key is required')
});

const deleteQueueJobBodySchema = z.object({
  queueName: z.string().min(1, 'queueName is required'),
  jobId: z.string().min(1, 'jobId is required')
});

const trashRecordBodySchema = z.object({
  id: z.string().min(1, 'id is required')
});

/**
 * GET /api/v1/admin/actions/inspect-r2
 * Lists objects in Cloudflare R2 transit/ prefix
 */
export async function inspectR2TransitHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.inspectR2Transit();
  return reply.send({
    success: true,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/delete-r2-object
 * Deletes an individual object from R2 transit
 */
export async function deleteR2ObjectHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = deleteR2ObjectBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'key không hợp lệ');
  }
  const result = await adminTelemetryService.deleteR2Object(parseResult.data.key);
  return reply.send({
    success: true,
    message: `Đã xóa object ${result.key} trên R2 transit`,
    data: result
  });
}

/**
 * GET /api/v1/admin/actions/inspect-queues
 * Lists jobs across BullMQ queues (PDF Studio, Converter, Quiz)
 */
export async function inspectBullMqQueuesHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.inspectBullMqQueues();
  return reply.send({
    success: true,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/delete-queue-job
 * Removes an individual job from a BullMQ queue
 */
export async function deleteQueueJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = deleteQueueJobBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'Tham số queueName/jobId không hợp lệ');
  }
  const result = await adminTelemetryService.deleteQueueJob(parseResult.data.queueName, parseResult.data.jobId);
  return reply.send({
    success: true,
    message: `Đã xóa tác vụ ${result.jobId} khỏi hàng đợi ${result.queueName}`,
    data: result
  });
}

/**
 * GET /api/v1/admin/actions/inspect-trash
 * Lists soft-deleted records in SQLite trash
 */
export async function inspectTrashHistoryHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.inspectTrashHistory();
  return reply.send({
    success: true,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/restore-trash-record
 * Restores a record from trash
 */
export async function restoreTrashRecordHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = trashRecordBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'id không hợp lệ');
  }
  const result = await adminTelemetryService.restoreTrashRecord(parseResult.data.id);
  return reply.send({
    success: true,
    message: `Đã khôi phục bản ghi ${result.id}`,
    data: result
  });
}

/**
 * POST /api/v1/admin/actions/delete-trash-record
 * Permanently deletes a record from trash
 */
export async function deleteTrashRecordHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = trashRecordBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'id không hợp lệ');
  }
  const result = await adminTelemetryService.deleteTrashRecord(parseResult.data.id);
  return reply.send({
    success: true,
    message: `Đã xóa vĩnh viễn bản ghi ${result.id}`,
    data: result
  });
}

/**
 * GET /api/v1/admin/actions/inspect-db
 * Returns SQLite database file sizes, table counts, and PRAGMA settings
 */
export async function inspectSqliteDbHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.inspectSqliteDatabase();
  return reply.send({
    success: true,
    data: result
  });
}

/**
 * GET /api/v1/admin/traffic/ips
 * Returns list of client IPs with metrics
 */
export async function getIpTrafficClientsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const clients = telemetryTracker.getIpClientsList();
  return reply.send({
    success: true,
    data: {
      totalClients: clients.length,
      clients
    }
  });
}

/**
 * GET /api/v1/admin/traffic/ips/:ip/logs
 * Returns detailed request stream logs for a specific IP
 */
export async function getIpTrafficLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  const ipParam = (request.params as any)?.ip;
  if (!ipParam) {
    throw new BadRequestError('Vui lòng cung cấp địa chỉ IP');
  }
  const result = telemetryTracker.getIpRequestLogs(ipParam);
  return reply.send({
    success: true,
    data: result
  });
}
