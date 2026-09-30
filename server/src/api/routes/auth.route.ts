import { FastifyInstance } from 'fastify';
import { verifyPasswordHandler, changePasswordHandler, authStatusHandler } from '../controllers/auth.controller.js';

export async function authRoute(app: FastifyInstance) {
  app.post('/api/v1/auth/verify', verifyPasswordHandler);
  app.post('/api/v1/auth/change-password', changePasswordHandler);
  app.get('/api/v1/auth/status', authStatusHandler);
}
