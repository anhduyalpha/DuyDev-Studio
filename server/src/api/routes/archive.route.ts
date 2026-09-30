import { FastifyInstance } from 'fastify';
import {
  inspectArchiveHandler,
  inspectNestedArchiveHandler,
  extractFileHandler,
  compressArchiveHandler
} from '../controllers/archive.controller.js';

export async function archiveRoute(app: FastifyInstance) {
  app.post('/api/v1/archive/inspect', inspectArchiveHandler);
  app.post('/api/v1/archive/inspect-nested', inspectNestedArchiveHandler);
  app.get('/api/v1/archive/extract-file', extractFileHandler);
  app.post('/api/v1/archive/compress', compressArchiveHandler);
}
