/**
 * Admin Routes - Protected Endpoints for System Telemetry & AI Control Center
 */

import { FastifyInstance } from 'fastify';
import { adminAuthGuard } from '../controllers/auth.controller.js';
import {
  getToolLayoutHandler,
  updateToolLayoutHandler,
  resetToolLayoutHandler
} from '../controllers/tool-layout.controller.js';
import {
  getAdminTelemetryHandler,
  getAiMetricsHandler,
  updateAiKeyHandler,
  deleteAiKeyHandler,
  toggleAiKeyHandler,
  testAiKeyHandler,
  cleanTempStorageHandler,
  cleanR2OrphansHandler,
  cleanQueuesHandler,
  optimizeDatabaseHandler,
  cleanHistoryHandler,
  getFailedJobsHandler,
  clearFailedJobsHandler,
  exportErrorLogsTxtHandler,
  exportErrorLogsJsonHandler,
  exportErrorLogsMdHandler,
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
  getVisitorSessionsHandler,
  getVisitorDevicesHandler,
  updateDeviceAliasHandler,
  toggleDeviceBlockHandler,
  setDeviceOwnerHandler,
  deleteDeviceHandler,
  deleteUserDevicesHandler,
  pruneDuplicateDevicesHandler,
  pruneStaleDevicesHandler,
  getSessionLifecycleEventsHandler,
  clearSessionLifecycleEventsHandler,
  getEngineTimeoutsHandler,
  updateEngineTimeoutsHandler,
  retryJobHandler,
  retryAllFailedJobsHandler,
  getAdminUsersHandler,
  createAdminUserHandler,
  updateAdminUserHandler,
  deleteAdminUserHandler,
  resetUserApiKeyHandler,
  getIpRulesHandler,
  upsertIpRuleHandler,
  deleteIpRuleHandler,
  toggleIpBlockHandler,
  setIpRateLimitHandler,
  resetIpTrafficHandler,
  resetTrafficHandler,
  controlQuizClassifierHandler,
  getAvailableAiModelsHandler
} from '../controllers/admin.controller.js';

export async function adminRoute(app: FastifyInstance) {
  // Telemetry Snapshot
  app.get('/api/v1/admin/telemetry', { preHandler: adminAuthGuard }, getAdminTelemetryHandler);

  // Dynamic Engine Timeouts
  app.get('/api/v1/admin/config/engine-timeouts', { preHandler: adminAuthGuard }, getEngineTimeoutsHandler);
  app.put('/api/v1/admin/config/engine-timeouts', { preHandler: adminAuthGuard }, updateEngineTimeoutsHandler);

  // Tool Card Layout & Category Manager
  app.get('/api/v1/admin/tool-layout', { preHandler: adminAuthGuard }, getToolLayoutHandler);
  app.put('/api/v1/admin/tool-layout', { preHandler: adminAuthGuard }, updateToolLayoutHandler);
  app.post('/api/v1/admin/tool-layout/reset', { preHandler: adminAuthGuard }, resetToolLayoutHandler);

  // Failed Jobs & Error Logs
  app.get('/api/v1/admin/logs/failed-jobs', { preHandler: adminAuthGuard }, getFailedJobsHandler);
  app.get('/api/v1/admin/logs/export-txt', { preHandler: adminAuthGuard }, exportErrorLogsTxtHandler);
  app.get('/api/v1/admin/logs/export-json', { preHandler: adminAuthGuard }, exportErrorLogsJsonHandler);
  app.get('/api/v1/admin/logs/export-md', { preHandler: adminAuthGuard }, exportErrorLogsMdHandler);
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
  app.post('/api/v1/admin/ai/keys/:id/toggle', { preHandler: adminAuthGuard }, toggleAiKeyHandler);
  app.post('/api/v1/admin/ai/keys/toggle', { preHandler: adminAuthGuard }, toggleAiKeyHandler);
  app.post('/api/v1/admin/ai/test-key', { preHandler: adminAuthGuard }, testAiKeyHandler);
  app.post('/api/v1/admin/ai/models', { preHandler: adminAuthGuard }, getAvailableAiModelsHandler);
  app.post('/api/v1/admin/ai/classifier/action', { preHandler: adminAuthGuard }, controlQuizClassifierHandler);

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
  app.post('/api/v1/admin/actions/reset-traffic', { preHandler: adminAuthGuard }, resetTrafficHandler);

  // User Accounts Management (Prisma User)
  app.get('/api/v1/admin/users', { preHandler: adminAuthGuard }, getAdminUsersHandler);
  app.post('/api/v1/admin/users', { preHandler: adminAuthGuard }, createAdminUserHandler);
  app.put('/api/v1/admin/users/:id', { preHandler: adminAuthGuard }, updateAdminUserHandler);
  app.delete('/api/v1/admin/users/:id', { preHandler: adminAuthGuard }, deleteAdminUserHandler);
  app.post('/api/v1/admin/users/:id/reset-api-key', { preHandler: adminAuthGuard }, resetUserApiKeyHandler);

  // IP Traffic & Access Control Rules
  app.get('/api/v1/admin/traffic/ips', { preHandler: adminAuthGuard }, getIpTrafficClientsHandler);
  app.get('/api/v1/admin/traffic/ips/:ip/logs', { preHandler: adminAuthGuard }, getIpTrafficLogsHandler);
  app.get('/api/v1/admin/traffic/sessions', { preHandler: adminAuthGuard }, getVisitorSessionsHandler);
  app.get('/api/v1/admin/traffic/devices', { preHandler: adminAuthGuard }, getVisitorDevicesHandler);
  app.post('/api/v1/admin/traffic/devices/:deviceId/alias', { preHandler: adminAuthGuard }, updateDeviceAliasHandler);
  app.post('/api/v1/admin/traffic/devices/:deviceId/toggle-block', { preHandler: adminAuthGuard }, toggleDeviceBlockHandler);
  app.post('/api/v1/admin/traffic/devices/:deviceId/set-owner', { preHandler: adminAuthGuard }, setDeviceOwnerHandler);
  app.delete('/api/v1/admin/traffic/devices/:deviceId', { preHandler: adminAuthGuard }, deleteDeviceHandler);
  app.delete('/api/v1/admin/traffic/users/:userIdentifier', { preHandler: adminAuthGuard }, deleteUserDevicesHandler);
  app.post('/api/v1/admin/traffic/devices/prune-duplicates', { preHandler: adminAuthGuard }, pruneDuplicateDevicesHandler);
  app.post('/api/v1/admin/traffic/devices/prune-stale', { preHandler: adminAuthGuard }, pruneStaleDevicesHandler);
  app.get('/api/v1/admin/traffic/events', { preHandler: adminAuthGuard }, getSessionLifecycleEventsHandler);
  app.post('/api/v1/admin/traffic/events/clear', { preHandler: adminAuthGuard }, clearSessionLifecycleEventsHandler);
  app.get('/api/v1/admin/traffic/rules', { preHandler: adminAuthGuard }, getIpRulesHandler);
  app.post('/api/v1/admin/traffic/rules', { preHandler: adminAuthGuard }, upsertIpRuleHandler);
  app.delete('/api/v1/admin/traffic/rules/:ip', { preHandler: adminAuthGuard }, deleteIpRuleHandler);
  app.post('/api/v1/admin/traffic/ips/:ip/toggle-block', { preHandler: adminAuthGuard }, toggleIpBlockHandler);
  app.post('/api/v1/admin/traffic/ips/:ip/set-rate-limit', { preHandler: adminAuthGuard }, setIpRateLimitHandler);
  app.post('/api/v1/admin/traffic/ips/:ip/reset', { preHandler: adminAuthGuard }, resetIpTrafficHandler);
}
