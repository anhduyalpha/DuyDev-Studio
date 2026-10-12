import { FastifyInstance } from 'fastify';
import {
  storageAuthGuard,
  listStorageHandler,
  uploadStorageHandler,
  downloadStorageHandler,
  mkdirStorageHandler,
  deleteStorageHandler,
  renameStorageHandler,
  moveStorageHandler,
  copyStorageHandler,
  statsStorageHandler
} from '../controllers/storage.controller.js';

export async function storageRoute(app: FastifyInstance) {
  // All storage endpoints require authentication
  app.addHook('preHandler', storageAuthGuard);

  app.get('/api/v1/storage/list', listStorageHandler);
  app.post('/api/v1/storage/upload', uploadStorageHandler);
  app.get('/api/v1/storage/download', downloadStorageHandler);
  app.post('/api/v1/storage/mkdir', mkdirStorageHandler);
  app.delete('/api/v1/storage/delete', deleteStorageHandler);
  app.post('/api/v1/storage/rename', renameStorageHandler);
  app.post('/api/v1/storage/move', moveStorageHandler);
  app.post('/api/v1/storage/copy', copyStorageHandler);
  app.get('/api/v1/storage/stats', statsStorageHandler);
}
