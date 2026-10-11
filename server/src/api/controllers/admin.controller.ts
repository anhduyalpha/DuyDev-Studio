/**
 * Admin Controller - System Telemetry, AI Key & Quota Management, Quick Actions
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminTelemetryService } from '../../services/admin-telemetry.service.js';
import { aiMetricsService } from '../../services/ai-metrics.service.js';
import { JanitorService } from '../../services/janitor.service.js';
import { adminUsersService } from '../../services/admin-users.service.js';
import { ipAccessService } from '../../services/ip-access.service.js';
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
  limit: z.coerce.number().min(1).max(2000).default(50),
  type: z.string().optional()
});

const exportErrorLogsQuerySchema = z.object({
  type: z.string().optional(),
  dedupe: z.coerce.boolean().optional()
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
 * GET /api/v1/admin/logs/export-txt
 * Exports all system error logs to formatted TXT with deduplication
 */
export async function exportErrorLogsTxtHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = exportErrorLogsQuerySchema.safeParse(request.query);
  const { type, dedupe } = parseResult.success ? parseResult.data : { type: undefined, dedupe: true };

  const result = await adminTelemetryService.exportErrorLogsAsText({ type, dedupe });

  reply.header('Content-Type', 'text/plain; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${result.fileName}"`);
  reply.header('X-Total-Errors', String(result.totalErrors));
  reply.header('X-Unique-Errors', String(result.uniqueErrors));
  reply.header('X-Duplicates-Removed', String(result.duplicateCount));
  reply.header('X-Reduction-Percent', String(result.reductionPercentage));

  return reply.send(result.text);
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

const updateEngineTimeoutsBodySchema = z.object({
  aiCallSec: z.number().min(10).max(600).optional(),
  chromePdfSec: z.number().min(10).max(300).optional(),
  pdfHeavyTaskSec: z.number().min(30).max(1800).optional(),
  converterTaskSec: z.number().min(30).max(3600).optional()
});

const retryJobParamsSchema = z.object({
  jobId: z.string().min(1, 'jobId không được để trống')
});

/**
 * GET /api/v1/admin/config/engine-timeouts
 * Returns dynamic engine timeouts
 */
export async function getEngineTimeoutsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const data = await adminTelemetryService.getEngineTimeouts();
  return reply.send({
    success: true,
    data
  });
}

/**
 * PUT /api/v1/admin/config/engine-timeouts
 * Updates dynamic engine timeouts
 */
export async function updateEngineTimeoutsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = updateEngineTimeoutsBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'Dữ liệu cấu hình timeout không hợp lệ');
  }
  const data = await adminTelemetryService.updateEngineTimeouts(parseResult.data);
  return reply.send({
    success: true,
    message: 'Đã cập nhật thời gian chờ (timeout) cho các công cụ xử lý',
    data
  });
}

/**
 * POST /api/v1/admin/logs/retry-job/:jobId
 * Retries a specific failed job
 */
export async function retryJobHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = retryJobParamsSchema.safeParse(request.params);
  if (!parseResult.success) {
    throw new BadRequestError('jobId không hợp lệ');
  }
  const result = await adminTelemetryService.retryFailedJob(parseResult.data.jobId);
  return reply.send({
    success: true,
    message: result.message,
    data: result
  });
}

/**
 * POST /api/v1/admin/logs/retry-all-failed
 * Retries all failed jobs in batch
 */
export async function retryAllFailedJobsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const result = await adminTelemetryService.retryAllFailedJobs();
  return reply.send({
    success: true,
    message: `Đã kích hoạt thử lại cho ${result.retriedCount}/${result.totalFailed} tác vụ thất bại`,
    data: result
  });
}

// ==========================================
// USER ACCOUNTS SCHEMAS & CONTROLLERS
// ==========================================

const createUserBodySchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  password: z.string().min(4, 'Mật khẩu phải có ít nhất 4 ký tự'),
  role: z.enum(['admin', 'user']).optional().default('user'),
  rateLimitRpm: z.coerce.number().min(0).max(10000).optional().default(0),
  notes: z.string().max(500).optional(),
  generateApiKey: z.boolean().optional().default(false)
});

const updateUserBodySchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(4).optional(),
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'blocked']).optional(),
  rateLimitRpm: z.coerce.number().min(0).max(10000).optional(),
  notes: z.string().max(500).optional(),
  resetApiKey: z.boolean().optional(),
  removeApiKey: z.boolean().optional()
});

const userIdParamsSchema = z.object({
  id: z.string().min(1, 'ID người dùng không được để trống')
});

/**
 * GET /api/v1/admin/users
 * Returns list of registered database users
 */
export async function getAdminUsersHandler(_request: FastifyRequest, reply: FastifyReply) {
  const users = await adminUsersService.listUsers();
  return reply.send({
    success: true,
    data: users
  });
}

/**
 * POST /api/v1/admin/users
 * Creates a new user account
 */
export async function createAdminUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = createUserBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'Dữ liệu người dùng không hợp lệ');
  }
  const user = await adminUsersService.createUser(parseResult.data);
  return reply.status(201).send({
    success: true,
    message: `Đã tạo tài khoản '${user.username}' thành công`,
    data: user
  });
}

/**
 * PUT /api/v1/admin/users/:id
 * Updates an existing user account
 */
export async function updateAdminUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = userIdParamsSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('ID người dùng không hợp lệ');
  }
  const bodyResult = updateUserBodySchema.safeParse(request.body);
  if (!bodyResult.success) {
    throw new BadRequestError(bodyResult.error.errors[0]?.message || 'Dữ liệu cập nhật không hợp lệ');
  }

  const user = await adminUsersService.updateUser(paramResult.data.id, bodyResult.data);
  return reply.send({
    success: true,
    message: `Đã cập nhật thông tin tài khoản '${user.username}'`,
    data: user
  });
}

/**
 * DELETE /api/v1/admin/users/:id
 * Deletes a user account
 */
export async function deleteAdminUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = userIdParamsSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('ID người dùng không hợp lệ');
  }
  await adminUsersService.deleteUser(paramResult.data.id);
  return reply.send({
    success: true,
    message: 'Đã xóa tài khoản người dùng thành công'
  });
}

/**
 * POST /api/v1/admin/users/:id/reset-api-key
 * Regenerates an API key for a user
 */
export async function resetUserApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = userIdParamsSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('ID người dùng không hợp lệ');
  }
  const result = await adminUsersService.resetApiKey(paramResult.data.id);
  return reply.send({
    success: true,
    message: 'Đã sinh API Key mới thành công',
    data: result
  });
}

// ==========================================
// IP ACCESS RULES & RATE LIMITING SCHEMAS & CONTROLLERS
// ==========================================

const upsertIpRuleBodySchema = z.object({
  ip: z.string().min(1, 'Địa chỉ IP không được để trống'),
  alias: z.string().max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'blocked', 'whitelisted', 'rate_limited']).optional(),
  rateLimitRpm: z.coerce.number().min(0).max(10000).optional()
});

const ipParamSchema = z.object({
  ip: z.string().min(1, 'Địa chỉ IP không được để trống')
});

const setRateLimitBodySchema = z.object({
  rateLimitRpm: z.coerce.number().min(0).max(10000, 'Hạn mức tối đa 10000 req/phút')
});

/**
 * GET /api/v1/admin/traffic/rules
 * Returns all configured IP access rules
 */
export async function getIpRulesHandler(_request: FastifyRequest, reply: FastifyReply) {
  const rules = await ipAccessService.listRules();
  return reply.send({
    success: true,
    data: rules
  });
}

/**
 * POST /api/v1/admin/traffic/rules
 * Upserts an IP access rule
 */
export async function upsertIpRuleHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = upsertIpRuleBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'Dữ liệu quy tắc IP không hợp lệ');
  }
  const rule = await ipAccessService.upsertRule(parseResult.data.ip, parseResult.data);
  return reply.send({
    success: true,
    message: `Đã lưu quy tắc kiểm soát cho IP '${rule.ip}'`,
    data: rule
  });
}

/**
 * DELETE /api/v1/admin/traffic/rules/:ip
 * Deletes an IP access rule (reverting IP to default active)
 */
export async function deleteIpRuleHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = ipParamSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('Địa chỉ IP không hợp lệ');
  }
  const deleted = await ipAccessService.deleteRule(paramResult.data.ip);
  return reply.send({
    success: true,
    message: deleted ? `Đã xóa quy tắc kiểm soát cho IP '${paramResult.data.ip}'` : 'Không tìm thấy quy tắc cần xóa',
    data: { deleted }
  });
}

/**
 * POST /api/v1/admin/traffic/ips/:ip/toggle-block
 * Toggles blocking status for an IP
 */
export async function toggleIpBlockHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = ipParamSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('Địa chỉ IP không hợp lệ');
  }
  const rule = await ipAccessService.toggleBlock(paramResult.data.ip);
  const msg = rule.status === 'blocked'
    ? `Đã chặn toàn diện IP '${rule.ip}' (HTTP 403 Forbidden)`
    : `Đã mở khóa IP '${rule.ip}' (Hoạt động bình thường)`;
  return reply.send({
    success: true,
    message: msg,
    data: rule
  });
}

/**
 * POST /api/v1/admin/traffic/ips/:ip/set-rate-limit
 * Sets custom RPM rate limit for an IP
 */
export async function setIpRateLimitHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = ipParamSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('Địa chỉ IP không hợp lệ');
  }
  const bodyResult = setRateLimitBodySchema.safeParse(request.body);
  if (!bodyResult.success) {
    throw new BadRequestError(bodyResult.error.errors[0]?.message || 'Hạn mức rate limit không hợp lệ');
  }

  const rule = await ipAccessService.setRateLimit(paramResult.data.ip, bodyResult.data.rateLimitRpm);
  const msg = rule.rateLimitRpm > 0
    ? `Đã đặt giới hạn ${rule.rateLimitRpm} req/phút cho IP '${rule.ip}'`
    : `Đã hủy giới hạn rate limit cho IP '${rule.ip}' (Không giới hạn)`;
  return reply.send({
    success: true,
    message: msg,
    data: rule
  });
}

/**
 * POST /api/v1/admin/traffic/ips/:ip/reset
 * Resets traffic counter and cache for an IP
 */
export async function resetIpTrafficHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramResult = ipParamSchema.safeParse(request.params);
  if (!paramResult.success) {
    throw new BadRequestError('Địa chỉ IP không hợp lệ');
  }
  const cleanIp = paramResult.data.ip;
  ipAccessService.resetIpStats(cleanIp);
  telemetryTracker.resetClientIp(cleanIp);
  return reply.send({
    success: true,
    message: `Đã đặt lại bộ đếm lưu lượng cho IP '${cleanIp}'`
  });
}

/**
 * POST /api/v1/admin/actions/reset-traffic
 * Resets rolling traffic window buckets and cumulative metrics
 */
export async function resetTrafficHandler(_request: FastifyRequest, reply: FastifyReply) {
  telemetryTracker.resetBuckets();
  return reply.send({
    success: true,
    message: 'Đã đặt lại bộ đếm lưu lượng mạng và tỷ lệ lỗi thời gian thực'
  });
}


