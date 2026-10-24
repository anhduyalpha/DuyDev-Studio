import { FastifyInstance } from 'fastify';
import { getToolLayoutHandler } from '../controllers/tool-layout.controller.js';
import { redisConnection, taskQueue, converterQueue } from '../../queues/task.queue.js';
import {
  extractClientIp,
  visitorSessionManager
} from '../middleware/telemetry.middleware.js';
import { deviceRegistryService } from '../../services/device-registry.service.js';

export async function systemRoute(app: FastifyInstance) {
  // Public Tool Layout (Category & Ordering per Tool Card)
  app.get('/api/v1/system/tool-layout', getToolLayoutHandler);

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

      const deviceIdHeader = (req.headers['x-device-id'] as string) || body.deviceId;
      const deviceId = deviceIdHeader ? String(deviceIdHeader).trim() : undefined;
      const isAdmin = req.headers['x-is-admin'] === 'true' || Boolean(body.isAdmin);

      const sessionId = String(body.sessionId || '').trim() || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const session = visitorSessionManager.registerEnter({
        sessionId,
        visitorId: body.visitorId ? String(body.visitorId) : undefined,
        deviceId,
        isAdmin,
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

      const deviceIdHeader = (req.headers['x-device-id'] as string) || body.deviceId;
      const deviceId = deviceIdHeader ? String(deviceIdHeader).trim() : undefined;
      const isAdmin = req.headers['x-is-admin'] === 'true' || Boolean(body.isAdmin);

      const session = visitorSessionManager.registerHeartbeat({
        sessionId,
        deviceId,
        isAdmin,
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

  // Client Device Profile (Tên & Avatar Người Dùng)
  app.get('/api/v1/device/profile', async (req, reply) => {
    try {
      const q = (req.query as any) || {};
      const deviceIdHeader = (req.headers['x-device-id'] as string) || q.deviceId;
      const deviceId = deviceIdHeader ? String(deviceIdHeader).trim() : '';

      if (!deviceId) {
        return reply.status(400).send({ success: false, error: 'Thiếu mã thiết bị (deviceId)' });
      }

      const dev = deviceRegistryService.getDevice(deviceId);
      return reply.send({
        success: true,
        data: {
          deviceId,
          alias: dev?.alias || '',
          avatar: dev?.avatar || '',
          isOwner: Boolean(dev?.isOwner),
          isConfigured: Boolean(dev?.alias && dev.alias.trim().length > 0)
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err?.message || 'Lỗi đọc hồ sơ thiết bị' });
    }
  });

  app.post('/api/v1/device/profile', async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const deviceIdHeader = (req.headers['x-device-id'] as string) || body.deviceId;
      const deviceId = deviceIdHeader ? String(deviceIdHeader).trim() : '';

      if (!deviceId) {
        return reply.status(400).send({ success: false, error: 'Thiếu mã thiết bị (deviceId)' });
      }

      let alias = body.alias;
      if (typeof alias === 'string') {
        alias = alias.trim().slice(0, 50); // Giới hạn 50 ký tự
      }

      let avatar = body.avatar;
      if (typeof avatar === 'string') {
        // Hỗ trợ preset name, emoji, hoặc data:image url (tối đa 150KB)
        avatar = avatar.trim().slice(0, 150000);
      }

      const updatedDev = deviceRegistryService.setProfile(deviceId, {
        alias: alias !== undefined ? alias : undefined,
        avatar: avatar !== undefined ? avatar : undefined
      });

      return reply.send({
        success: true,
        message: 'Đã cập nhật hồ sơ thiết bị thành công',
        data: {
          deviceId,
          alias: updatedDev?.alias || '',
          avatar: updatedDev?.avatar || '',
          isOwner: Boolean(updatedDev?.isOwner),
          isConfigured: Boolean(updatedDev?.alias && updatedDev.alias.trim().length > 0)
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err?.message || 'Lỗi cập nhật hồ sơ thiết bị' });
    }
  });
}
