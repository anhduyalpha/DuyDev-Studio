import { FastifyInstance } from 'fastify';
import { uploadFile, downloadFile, viewFile } from '../controllers/files.controller.js';

export async function filesRoute(app: FastifyInstance) {
  app.post('/api/v1/files/upload', uploadFile);
  app.get('/api/v1/files/download/:fileId', downloadFile);
  app.get('/api/v1/files/view/:fileId', viewFile);
  app.get('/api/v1/files/:fileId', downloadFile);
}
