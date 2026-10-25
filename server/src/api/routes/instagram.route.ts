import { FastifyInstance } from 'fastify';
import {
  resolveInstagramHandler,
  checkDuplicateInstagramHandler,
  streamInstagramHandler,
  saveToDriveInstagramHandler
} from '../controllers/instagram.controller.js';

export async function instagramRoute(app: FastifyInstance) {
  app.post('/api/v1/instagram/resolve', resolveInstagramHandler);
  app.post('/api/v1/instagram/check-duplicate', checkDuplicateInstagramHandler);
  app.get('/api/v1/instagram/stream', streamInstagramHandler);
  app.post('/api/v1/instagram/save-drive', saveToDriveInstagramHandler);
}
