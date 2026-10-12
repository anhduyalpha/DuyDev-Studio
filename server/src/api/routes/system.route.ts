import { FastifyInstance } from 'fastify';
import { redisConnection, taskQueue, converterQueue } from '../../queues/task.queue.js';
import {
  extractClientIp,
  visitorSessionManager
} from '../middleware/telemetry.middleware.js';

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

  // Visitor Session Lifecycle Telemetry ("Vào web ra web cũng log được")
  app.post('/api/v1/telemetry/session/enter', async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const { ip, isLan } = extractClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
      const countryHeader = req.headers['cf-ipcountry'] as string;
      const country = countryHeader || (isLan ? 'LAN' : 'VN');

      const sessionId = String(body.sessionId || '').trim() || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const session = visitorSessionManager.registerEnter({
        sessionId,
        visitorId: body.visitorId ? String(body.visitorId) : undefined,
        ip,
        isLan,
        country,
        userAgent,
        route: body.route ? String(body.route) : undefined,
        pwaMode: Boolean(body.pwaMode),
        screen: body.screen ? String(body.screen) : undefined
      });

      return reply.send({ success: true, data: { sessionId: session.sessionId, status: session.status } });
    } catch (err: any) {
      return reply.status(200).send({ success: false, message: err?.message || 'Error recording session enter' });
    }
  });

  app.post('/api/v1/telemetry/session/heartbeat', async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const sessionId = String(body.sessionId || '').trim();
      if (!sessionId) {
        return reply.status(200).send({ success: false, message: 'Missing sessionId' });
      }

      const session = visitorSessionManager.registerHeartbeat({
        sessionId,
        route: body.route ? String(body.route) : undefined
      });

      return reply.send({ success: true, data: { active: Boolean(session), status: session?.status || 'UNKNOWN' } });
    } catch (err: any) {
      return reply.status(200).send({ success: false, message: err?.message || 'Error recording heartbeat' });
    }
  });

  app.post('/api/v1/telemetry/session/leave', async (req, reply) => {
    try {
      let body: any = {};
      if (typeof req.body === 'string') {
        try { body = JSON.parse(req.body); } catch { body = { sessionId: req.body }; }
      } else if (req.body && typeof req.body === 'object') {
        body = req.body;
      }

      const sessionId = String(body.sessionId || '').trim();
      if (!sessionId) {
        return reply.status(200).send({ success: false, message: 'Missing sessionId' });
      }

      const durationSec = typeof body.durationSec === 'number' ? body.durationSec : undefined;
      const lastRoute = body.lastRoute ? String(body.lastRoute) : undefined;

      const session = visitorSessionManager.registerLeave({
        sessionId,
        durationSec,
        lastRoute
      });

      return reply.send({ success: true, data: { left: Boolean(session) } });
    } catch (err: any) {
      return reply.status(200).send({ success: false, message: err?.message || 'Error recording session leave' });
    }
  });
}
