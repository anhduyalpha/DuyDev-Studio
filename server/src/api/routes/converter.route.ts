import { FastifyInstance } from 'fastify';
import { detectFormat, enqueueConverterTask } from '../controllers/converter.controller.js';

export async function converterRoute(app: FastifyInstance) {
  app.post('/api/v1/converter/detect', detectFormat);
  app.post('/api/v1/converter/job', enqueueConverterTask);
}
