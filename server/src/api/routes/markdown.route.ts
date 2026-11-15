import { FastifyInstance } from 'fastify';
import { exportMarkdownHandler } from '../controllers/markdown.controller.js';

export async function markdownRoute(app: FastifyInstance) {
  app.post('/api/v1/markdown/export', exportMarkdownHandler);
}
