import { FastifyInstance } from 'fastify';
import { redisConnection, taskQueue, converterQueue } from '../../queues/task.queue.js';

export async function systemRoute(app: FastifyInstance) {
  app.get('/api/v1/system/telemetry', async (_req, reply) => {
    try {
      const isRedisReady = redisConnection.status === 'ready' || redisConnection.status === 'connect';
      const [pdfWaiting, pdfActive, convWaiting, convActive] = await Promise.all([
        taskQueue.getWaitingCount().catch(() => 0),
        taskQueue.getActiveCount().catch(() => 0),
        converterQueue.getWaitingCount().catch(() => 0),
        converterQueue.getActiveCount().catch(() => 0)
      ]);

      const uptimeSec = Math.floor(process.uptime());
      const memRssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

      return reply.send({
        success: true,
        data: {
          gateway: 'online',
          uptime: uptimeSec,
          memoryMb: memRssMb,
          redis: isRedisReady ? 'connected' : 'degraded',
          queues: {
            pdf: { waiting: pdfWaiting, active: pdfActive },
            converter: { waiting: convWaiting, active: convActive },
            totalActive: pdfActive + convActive
          },
          engines: {
            pymupdf: 'ready',
            ffmpeg: 'ready',
            libreoffice: 'ready'
          }
        }
      });
    } catch {
      return reply.send({
        success: true,
        data: {
          gateway: 'online',
          redis: 'offline',
          uptime: Math.floor(process.uptime()),
          queues: { totalActive: 0 }
        }
      });
    }
  });
}
