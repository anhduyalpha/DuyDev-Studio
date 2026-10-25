import { FastifyInstance } from 'fastify';
import {
  resolveSpotifyHandler,
  checkDuplicateSpotifyHandler,
  streamSpotifyHandler,
  saveToDriveSpotifyHandler
} from '../controllers/spotify.controller.js';

export async function spotifyRoute(app: FastifyInstance) {
  app.post('/api/v1/spotify/resolve', resolveSpotifyHandler);
  app.post('/api/v1/spotify/check-duplicate', checkDuplicateSpotifyHandler);
  app.get('/api/v1/spotify/stream', streamSpotifyHandler);
  app.post('/api/v1/spotify/save-drive', saveToDriveSpotifyHandler);
}
