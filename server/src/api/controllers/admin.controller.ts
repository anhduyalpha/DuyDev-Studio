/**
 * Admin Controller - System Telemetry, AI Key & Quota Management, Quick Actions
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminTelemetryService } from '../../services/admin-telemetry.service.js';
import { aiMetricsService } from '../../services/ai-metrics.service.js';
import { JanitorService } from '../../services/janitor.service.js';
import { BadRequestError } from '../../lib/errors.js';

const updateKeySchema = z.object({
  id: z.string().min(1, 'Key ID is required'),
  name: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  isActive: z.boolean().optional()
});

const testKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required')
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
      apiKeyMasked: aiMetricsService.maskKey(updatedKey.apiKey),
      isActive: updatedKey.isActive
    }
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
