import { FastifyInstance } from 'fastify';
import {
  resolveFacebookHandler,
  checkDuplicateFacebookHandler,
  streamFacebookHandler,
  saveToDriveFacebookHandler
} from '../controllers/facebook.controller.js';

export async function facebookRoute(app: FastifyInstance) {
  app.post('/api/v1/facebook/resolve', resolveFacebookHandler);
  app.post('/api/v1/facebook/check-duplicate', checkDuplicateFacebookHandler);
  app.get('/api/v1/facebook/stream', streamFacebookHandler);
  app.post('/api/v1/facebook/save-drive', saveToDriveFacebookHandler);
}
