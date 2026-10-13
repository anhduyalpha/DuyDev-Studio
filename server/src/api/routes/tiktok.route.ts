import { FastifyInstance } from 'fastify';
import {
  resolveTikTokHandler,
  streamTikTokHandler,
  saveToDriveTikTokHandler
} from '../controllers/tiktok.controller.js';

export async function tiktokRoute(app: FastifyInstance) {
  app.post('/api/v1/tiktok/resolve', resolveTikTokHandler);
  app.get('/api/v1/tiktok/stream', streamTikTokHandler);
  app.post('/api/v1/tiktok/save-drive', saveToDriveTikTokHandler);
}
