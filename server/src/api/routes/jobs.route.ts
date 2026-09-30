import { FastifyInstance } from 'fastify';
import { enqueuePdfJob, getJobEvents, getJobStatus } from '../controllers/jobs.controller.js';

export async function jobsRoute(app: FastifyInstance) {
  app.post('/api/v1/jobs/pdf', enqueuePdfJob);
  app.get('/api/v1/jobs/:jobId/events', getJobEvents);
  app.get('/api/v1/jobs/:jobId', getJobStatus);
}
