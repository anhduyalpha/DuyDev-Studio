import { FastifyInstance } from 'fastify';
import {
  resolveYouTubeHandler,
  downloadYouTubeHandler,
  streamYouTubeHandler,
  saveToDriveYouTubeHandler
} from '../controllers/youtube.controller.js';

export async function youtubeRoute(app: FastifyInstance) {
  app.post('/api/v1/youtube/resolve', resolveYouTubeHandler);
  app.post('/api/v1/youtube/download', downloadYouTubeHandler);
  app.get('/api/v1/youtube/stream/:filename', streamYouTubeHandler);
  app.post('/api/v1/youtube/save-drive', saveToDriveYouTubeHandler);
}
