import { FastifyInstance } from 'fastify';
import {
  verifyPasswordHandler,
  changePasswordHandler,
  authStatusHandler,
  adminAuthGuard,
  r2StatsHandler
} from '../controllers/auth.controller.js';

export async function authRoute(app: FastifyInstance) {
  app.post('/api/v1/auth/verify', verifyPasswordHandler);
  app.post('/api/v1/auth/change-password', changePasswordHandler);
  app.get('/api/v1/auth/status', authStatusHandler);
  app.get('/api/v1/auth/r2-stats', { preHandler: adminAuthGuard }, r2StatsHandler);
  app.get('/api/v1/admin/r2-stats', { preHandler: adminAuthGuard }, r2StatsHandler);
}

