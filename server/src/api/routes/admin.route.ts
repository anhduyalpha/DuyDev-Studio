/**
 * Admin Routes - Protected Endpoints for System Telemetry & AI Control Center
 */

import { FastifyInstance } from 'fastify';
import { adminAuthGuard } from '../controllers/auth.controller.js';
import {
  getAdminTelemetryHandler,
  getAiMetricsHandler,
  updateAiKeyHandler,
  deleteAiKeyHandler,
  testAiKeyHandler,
  cleanTempStorageHandler,
  cleanR2OrphansHandler,
  cleanQueuesHandler,
  optimizeDatabaseHandler,
  cleanHistoryHandler,
  getFailedJobsHandler,
  clearFailedJobsHandler,
  exportErrorLogsTxtHandler,
  inspectStorageHandler,
  deleteStorageFileHandler,
  inspectR2TransitHandler,
  deleteR2ObjectHandler,
  inspectBullMqQueuesHandler,
  deleteQueueJobHandler,
  inspectTrashHistoryHandler,
  restoreTrashRecordHandler,
  deleteTrashRecordHandler,
  inspectSqliteDbHandler,
  getIpTrafficClientsHandler,
  getIpTrafficLogsHandler,
  getEngineTimeoutsHandler,
  updateEngineTimeoutsHandler,
  retryJobHandler,
  retryAllFailedJobsHandler
} from '../controllers/admin.controller.js';

export async function adminRoute(app: FastifyInstance) {
  // Telemetry Snapshot
  app.get('/api/v1/admin/telemetry', { preHandler: adminAuthGuard }, getAdminTelemetryHandler);

  // Dynamic Engine Timeouts
  app.get('/api/v1/admin/config/engine-timeouts', { preHandler: adminAuthGuard }, getEngineTimeoutsHandler);
  app.put('/api/v1/admin/config/engine-timeouts', { preHandler: adminAuthGuard }, updateEngineTimeoutsHandler);

  // Failed Jobs & Error Logs
  app.get('/api/v1/admin/logs/failed-jobs', { preHandler: adminAuthGuard }, getFailedJobsHandler);
  app.get('/api/v1/admin/logs/export-txt', { preHandler: adminAuthGuard }, exportErrorLogsTxtHandler);
  app.post('/api/v1/admin/logs/clear-failed', { preHandler: adminAuthGuard }, clearFailedJobsHandler);
  app.post('/api/v1/admin/logs/retry-job/:jobId', { preHandler: adminAuthGuard }, retryJobHandler);
  app.post('/api/v1/admin/logs/retry-all-failed', { preHandler: adminAuthGuard }, retryAllFailedJobsHandler);

  // Storage Inspection & Item Management
  app.get('/api/v1/admin/storage/inspect', { preHandler: adminAuthGuard }, inspectStorageHandler);
  app.post('/api/v1/admin/storage/delete-file', { preHandler: adminAuthGuard }, deleteStorageFileHandler);

  // AI Agents Metrics & Keys
  app.get('/api/v1/admin/ai/metrics', { preHandler: adminAuthGuard }, getAiMetricsHandler);
  app.post('/api/v1/admin/ai/keys', { preHandler: adminAuthGuard }, updateAiKeyHandler);
  app.delete('/api/v1/admin/ai/keys/:id', { preHandler: adminAuthGuard }, deleteAiKeyHandler);
  app.post('/api/v1/admin/ai/keys/delete', { preHandler: adminAuthGuard }, deleteAiKeyHandler);
  app.post('/api/v1/admin/ai/test-key', { preHandler: adminAuthGuard }, testAiKeyHandler);

  // Box Inspectors & Fine-Grained Actions
  app.get('/api/v1/admin/actions/inspect-r2', { preHandler: adminAuthGuard }, inspectR2TransitHandler);
  app.post('/api/v1/admin/actions/delete-r2-object', { preHandler: adminAuthGuard }, deleteR2ObjectHandler);
  app.get('/api/v1/admin/actions/inspect-queues', { preHandler: adminAuthGuard }, inspectBullMqQueuesHandler);
  app.post('/api/v1/admin/actions/delete-queue-job', { preHandler: adminAuthGuard }, deleteQueueJobHandler);
  app.get('/api/v1/admin/actions/inspect-trash', { preHandler: adminAuthGuard }, inspectTrashHistoryHandler);
  app.post('/api/v1/admin/actions/restore-trash-record', { preHandler: adminAuthGuard }, restoreTrashRecordHandler);
  app.post('/api/v1/admin/actions/delete-trash-record', { preHandler: adminAuthGuard }, deleteTrashRecordHandler);
  app.get('/api/v1/admin/actions/inspect-db', { preHandler: adminAuthGuard }, inspectSqliteDbHandler);

  // Quick Actions & Maintenance
  app.post('/api/v1/admin/actions/clean-temp', { preHandler: adminAuthGuard }, cleanTempStorageHandler);
  app.post('/api/v1/admin/actions/clean-r2', { preHandler: adminAuthGuard }, cleanR2OrphansHandler);
  app.post('/api/v1/admin/actions/clean-queues', { preHandler: adminAuthGuard }, cleanQueuesHandler);
  app.post('/api/v1/admin/actions/optimize-db', { preHandler: adminAuthGuard }, optimizeDatabaseHandler);
  app.post('/api/v1/admin/actions/clean-history', { preHandler: adminAuthGuard }, cleanHistoryHandler);

  // User & IP Traffic Management
  app.get('/api/v1/admin/traffic/ips', { preHandler: adminAuthGuard }, getIpTrafficClientsHandler);
  app.get('/api/v1/admin/traffic/ips/:ip/logs', { preHandler: adminAuthGuard }, getIpTrafficLogsHandler);
}
