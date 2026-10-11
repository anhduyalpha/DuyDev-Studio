/**
 * Admin Routes - Protected Endpoints for System Telemetry & AI Control Center
 */

import { FastifyInstance } from 'fastify';
import { adminAuthGuard } from '../controllers/auth.controller.js';
import {
  getAdminTelemetryHandler,
  getAiMetricsHandler,
  updateAiKeyHandler,
  testAiKeyHandler,
  cleanTempStorageHandler,
  cleanR2OrphansHandler,
  cleanQueuesHandler,
  optimizeDatabaseHandler,
  cleanHistoryHandler,
  getFailedJobsHandler,
  clearFailedJobsHandler,
  inspectStorageHandler,
  deleteStorageFileHandler
} from '../controllers/admin.controller.js';

export async function adminRoute(app: FastifyInstance) {
  // Telemetry Snapshot
  app.get('/api/v1/admin/telemetry', { preHandler: adminAuthGuard }, getAdminTelemetryHandler);

  // Failed Jobs & Error Logs
  app.get('/api/v1/admin/logs/failed-jobs', { preHandler: adminAuthGuard }, getFailedJobsHandler);
  app.post('/api/v1/admin/logs/clear-failed', { preHandler: adminAuthGuard }, clearFailedJobsHandler);

  // Storage Inspection & Item Management
  app.get('/api/v1/admin/storage/inspect', { preHandler: adminAuthGuard }, inspectStorageHandler);
  app.post('/api/v1/admin/storage/delete-file', { preHandler: adminAuthGuard }, deleteStorageFileHandler);

  // AI Agents Metrics & Keys
  app.get('/api/v1/admin/ai/metrics', { preHandler: adminAuthGuard }, getAiMetricsHandler);
  app.post('/api/v1/admin/ai/keys', { preHandler: adminAuthGuard }, updateAiKeyHandler);
  app.post('/api/v1/admin/ai/test-key', { preHandler: adminAuthGuard }, testAiKeyHandler);

  // Quick Actions & Maintenance
  app.post('/api/v1/admin/actions/clean-temp', { preHandler: adminAuthGuard }, cleanTempStorageHandler);
  app.post('/api/v1/admin/actions/clean-r2', { preHandler: adminAuthGuard }, cleanR2OrphansHandler);
  app.post('/api/v1/admin/actions/clean-queues', { preHandler: adminAuthGuard }, cleanQueuesHandler);
  app.post('/api/v1/admin/actions/optimize-db', { preHandler: adminAuthGuard }, optimizeDatabaseHandler);
  app.post('/api/v1/admin/actions/clean-history', { preHandler: adminAuthGuard }, cleanHistoryHandler);
}
