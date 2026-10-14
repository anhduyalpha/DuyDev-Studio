import { FastifyInstance } from 'fastify';
import {
  resolveTikTokHandler,
  streamTikTokHandler,
  saveToDriveTikTokHandler,
  checkDuplicateTikTokHandler
} from '../controllers/tiktok.controller.js';

export async function tiktokRoute(app: FastifyInstance) {
  app.post('/api/v1/tiktok/resolve', resolveTikTokHandler);
  app.post('/api/v1/tiktok/check-duplicate', checkDuplicateTikTokHandler);
  app.get('/api/v1/tiktok/stream', streamTikTokHandler);
  app.post('/api/v1/tiktok/save-drive', saveToDriveTikTokHandler);
}
