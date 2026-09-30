import { FastifyInstance } from 'fastify';
import {
  redirectHandler,
  createDynamicQrHandler,
  listDynamicQrsHandler,
  getAnalyticsHandler,
  updateDynamicQrHandler,
  deleteDynamicQrHandler
} from '../controllers/dynamic-qr.controller.js';

export async function dynamicQrRoute(app: FastifyInstance) {
  // 1. Root-level short URL redirect endpoint (e.g. http://domain/q/:slug)
  app.get('/q/:slug', redirectHandler);

  // 2. API v1 CRUD & Telemetry endpoints
  app.post('/api/v1/qr/dynamic', createDynamicQrHandler);
  app.get('/api/v1/qr/dynamic', listDynamicQrsHandler);
  app.get('/api/v1/qr/dynamic/:slug/analytics', getAnalyticsHandler);
  app.patch('/api/v1/qr/dynamic/:slug', updateDynamicQrHandler);
  app.delete('/api/v1/qr/dynamic/:slug', deleteDynamicQrHandler);
}
