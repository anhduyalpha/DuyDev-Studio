import { FastifyInstance } from 'fastify';
import { previewPdfHandler } from '../controllers/viewer.controller.js';

export async function viewerRoute(app: FastifyInstance) {
  app.get('/api/v1/viewer/preview-pdf', previewPdfHandler);
}
