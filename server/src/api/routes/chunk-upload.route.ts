/**
 * Chunked Resumable Upload Routes (< 50 lines)
 */

import { FastifyInstance } from 'fastify';
import {
  initChunkUpload,
  uploadChunkPart,
  getChunkStatus,
  completeChunkUpload,
  abortChunkUpload
} from '../controllers/chunk-upload.controller.js';

export async function chunkUploadRoute(app: FastifyInstance) {
  app.post('/api/v1/files/chunk/init', initChunkUpload);
  app.post('/api/v1/files/chunk/upload', uploadChunkPart);
  app.get('/api/v1/files/chunk/status/:uploadId', getChunkStatus);
  app.post('/api/v1/files/chunk/complete', completeChunkUpload);
  app.delete('/api/v1/files/chunk/:uploadId', abortChunkUpload);
}
