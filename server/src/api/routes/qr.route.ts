import { FastifyInstance } from 'fastify';
import { generateQrHandler, decodeQrHandler } from '../controllers/qr.controller.js';

export async function qrRoute(app: FastifyInstance) {
  app.post('/api/v1/qr/generate', generateQrHandler);
  app.post('/api/v1/qr/decode', decodeQrHandler);
}
