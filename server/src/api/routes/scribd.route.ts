/**
 * Scribd Document Archiver Fastify API Routes
 * Handles proxying to Python Scribd Engine, SSE log streaming,
 * universal PDF viewing & downloading, and saving directly to Studio Drive.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { ScribdDaemonService } from '../../services/scribd-daemon.service.js';
import { env, resolvedStoragePaths } from '../../config/env.config.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { deviceRegistryService } from '../../services/device-registry.service.js';
import { extractClientIp, parseDeviceSummary } from '../middleware/telemetry.middleware.js';

const BACKEND_URL = env.SCRIBD_API_URL;

async function safeJsonFetch(url: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text || `HTTP ${res.status}` };
  }
  return { status: res.status, data };
}

function formatContentDisposition(filename: string): string {
  const cleanName = path.basename(filename);
  const asciiFallback = cleanName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_') || 'document.pdf';
  const rfc5987Encoded = encodeURIComponent(cleanName)
    .replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987Encoded}`;
}

export async function scribdRoute(app: FastifyInstance): Promise<void> {
  // 1. Health & status check
  app.get('/api/v1/scribd/status', async () => {
    const status = await ScribdDaemonService.getStatus();
    return { success: true, data: status, timestamp: new Date().toISOString() };
  });

  // 2. Start download job
  app.post('/api/v1/scribd/download', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (req.body as any) || {};
      const url = body.url;
      if (!url || typeof url !== 'string' || !url.trim()) {
        return reply.status(400).send({ error: 'Thiếu liên kết tài liệu Scribd' });
      }

      if (/scribd\.com\/search(?:\/|\?|$)/i.test(url.trim())) {
        return reply.status(400).send({
          error: 'Đây là link tìm kiếm. Vui lòng mở tài liệu cụ thể trên Scribd rồi sao chép link!'
        });
      }

      const clean = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
      if (clean.toLowerCase() === 'scribd.com') {
        return reply.status(400).send({
          error: 'Đây là trang chủ Scribd. Vui lòng mở tài liệu cụ thể trên Scribd rồi sao chép link!'
        });
      }

      await ScribdDaemonService.ensureDaemonRunning();

      // Extract client identification & real IP for authentic downloader tracking
      const { ip: clientIp, isLan } = extractClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const deviceId = (body.deviceId as string) || (req.headers['x-device-id'] as string) || '';

      let uploaderName = '';
      if (deviceId) {
        const dev = deviceRegistryService.getDevice(deviceId);
        if (dev?.alias) {
          uploaderName = dev.alias;
        } else if (dev?.isOwner) {
          uploaderName = '👑 Máy của Duy';
        } else {
          uploaderName = `Khách #${deviceId.slice(-6)}`;
        }
      } else if (isLan) {
        uploaderName = '👑 Máy của Duy';
      } else {
        const hash = crypto.createHash('md5').update(clientIp + userAgent).digest('hex').slice(0, 6);
        uploaderName = `Khách #${hash}`;
      }

      const deviceSummary = parseDeviceSummary(userAgent);
      const forwardBody = {
        ...body,
        user_name: uploaderName,
        downloaded_by: {
          name: uploaderName,
          ip: clientIp,
          device: deviceSummary
        }
      };

      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': clientIp,
          'User-Agent': userAgent,
          'X-Device-Id': deviceId
        },
        body: JSON.stringify(forwardBody)
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  });

  // 3. Get job status
  app.get('/api/v1/scribd/status/:jobId', async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const jobId = req.params.jobId;
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/status/${jobId}`);
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  });

  // 4. Real-time SSE streaming logs & progress
  app.get('/api/v1/scribd/events/:jobId', async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const jobId = req.params.jobId;
    try {
      await ScribdDaemonService.ensureDaemonRunning();
      const res = await fetch(`${BACKEND_URL}/api/events/${jobId}`);
      if (!res.ok) {
        return reply.status(res.status).send({ error: `Engine error: HTTP ${res.status}` });
      }

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      if (res.body) {
        const stream = Readable.fromWeb(res.body as any);
        stream.pipe(reply.raw);

        req.raw.on('close', () => {
          stream.destroy();
        });
      } else {
        reply.raw.end();
      }
    } catch (err: any) {
      reply.raw.writeHead(502, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({ error: 'Scribd SSE connection failed: ' + err.message }));
    }
  });

  // 5. Cancel job
  app.post('/api/v1/scribd/cancel/:jobId', async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/cancel/${req.params.jobId}`, { method: 'POST' });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  });

  // 6. List active files
  app.get('/api/v1/scribd/files', async (_req, reply: FastifyReply) => {
    try {
      await ScribdDaemonService.ensureDaemonRunning();
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/files`);
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  });

  // 7. List trash files
  app.get('/api/v1/scribd/trash', async (_req, reply: FastifyReply) => {
    try {
      await ScribdDaemonService.ensureDaemonRunning();
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/trash`);
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  });

  // 8. Move file to trash (soft delete / bulk move all to trash)
  const handleMoveToTrash = async (req: FastifyRequest<{ Params?: { '*'?: string }; Body?: { filename?: string; file?: string } }>, reply: FastifyReply) => {
    try {
      const rawName = (req.body as any)?.filename || (req.body as any)?.file || req.params?.['*'] || '';
      const filename = rawName === 'all' || rawName === 'trash-all' ? 'all' : encodeURIComponent(rawName);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/files/${filename}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: rawName })
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  };

  app.delete('/api/v1/scribd/files/*', handleMoveToTrash);
  app.post('/api/v1/scribd/files/trash', handleMoveToTrash);
  app.delete('/api/v1/scribd/files/all', handleMoveToTrash);
  app.post('/api/v1/scribd/files/trash-all', handleMoveToTrash);

  // 9. Restore file from trash
  const handleRestore = async (req: FastifyRequest<{ Params?: { '*'?: string }; Body?: { filename?: string; file?: string } }>, reply: FastifyReply) => {
    try {
      const rawName = (req.body as any)?.filename || (req.body as any)?.file || req.params?.['*'] || '';
      const filename = encodeURIComponent(rawName);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/trash/restore/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: rawName })
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  };

  app.post('/api/v1/scribd/trash/restore/*', handleRestore);
  app.post('/api/v1/scribd/trash/restore', handleRestore);

  // 10. Permanently delete file from trash
  const handleDeletePermanent = async (req: FastifyRequest<{ Params?: { '*'?: string }; Body?: { filename?: string; file?: string } }>, reply: FastifyReply) => {
    try {
      const param = req.params?.['*'];
      const rawName = param || (req.body as any)?.filename || (req.body as any)?.file || '';
      const target = rawName === 'empty' ? 'empty' : encodeURIComponent(rawName);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/trash/${target}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: rawName })
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Scribd engine unavailable: ' + err.message });
    }
  };

  app.delete('/api/v1/scribd/trash/*', handleDeletePermanent);
  app.post('/api/v1/scribd/trash/delete', handleDeletePermanent);

  // 11. Document Stream with Range Support (Universal Viewer & Tab preview compatible)
  async function handleDocumentStream(req: FastifyRequest<{ Params?: { '*'?: string }; Querystring: { id?: string; file?: string } }>, reply: FastifyReply) {
    try {
      const pathFile = req.params?.['*'];
      const query = new URLSearchParams();
      if (req.query.id) query.set('id', req.query.id);
      const effectiveFile = req.query.file || pathFile;
      if (effectiveFile) query.set('file', effectiveFile);

      const headers: Record<string, string> = {};
      if (req.headers.range) headers['Range'] = req.headers.range;

      const res = await fetch(`${BACKEND_URL}/api/document-stream?${query.toString()}`, { headers });
      if (!res.ok && res.status !== 206) {
        return reply.status(res.status).send('Document not found');
      }

      reply.status(res.status);
      res.headers.forEach((val, key) => {
        const lower = key.toLowerCase();
        if (
          !lower.startsWith('access-control-') &&
          !['transfer-encoding', 'connection', 'content-type', 'content-disposition'].includes(lower)
        ) {
          reply.header(key, val);
        }
      });

      // Strict Anti-IDM standard: Content-Type application/pdf & Content-Disposition: inline
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'inline');

      if (res.body) {
        const stream = Readable.fromWeb(res.body as any);
        return reply.send(stream);
      }
      return reply.send();
    } catch (err: any) {
      return reply.status(502).send('Scribd stream error: ' + err.message);
    }
  }

  app.get('/api/v1/scribd/stream', handleDocumentStream);
  app.get('/api/v1/scribd/stream/*', handleDocumentStream);
  app.head('/api/v1/scribd/stream', handleDocumentStream);
  app.head('/api/v1/scribd/stream/*', handleDocumentStream);

  // 12. Download File Attachment
  const handleDownload = async (req: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    try {
      const rawParam = req.params['*'] || '';
      let filename = rawParam;
      try {
        filename = decodeURIComponent(rawParam);
      } catch {}

      await ScribdDaemonService.ensureDaemonRunning();

      let res = await fetch(`${BACKEND_URL}/downloads/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        res = await fetch(`${BACKEND_URL}/downloads/${encodeURI(filename)}`);
      }
      if (!res.ok) return reply.status(res.status).send('File not found');

      reply.status(res.status);
      res.headers.forEach((val, key) => {
        const lower = key.toLowerCase();
        if (
          !lower.startsWith('access-control-') &&
          !['transfer-encoding', 'connection', 'content-disposition'].includes(lower)
        ) {
          reply.header(key, val);
        }
      });

      reply.header('Content-Disposition', formatContentDisposition(filename));

      if (req.method === 'HEAD') {
        return reply.send();
      }

      if (res.body) {
        const stream = Readable.fromWeb(res.body as any);
        return reply.send(stream);
      }
      return reply.send();
    } catch (err: any) {
      return reply.status(502).send('Download error: ' + err.message);
    }
  };

  app.get('/api/v1/scribd/download/*', handleDownload);
  app.head('/api/v1/scribd/download/*', handleDownload);

  // 13. Save directly to Studio Drive & record HistoryRecord
  app.post('/api/v1/scribd/save-drive', async (req: FastifyRequest<{ Body: { filename: string; targetDir?: string; title?: string } }>, reply: FastifyReply) => {
    try {
      const { filename, targetDir = 'scribd', title = '' } = (req.body || {}) as any;
      if (!filename) {
        return reply.status(400).send({ success: false, error: 'Thiếu tên tập tin (filename)' });
      }

      // Check daemon & fetch file
      await ScribdDaemonService.ensureDaemonRunning();
      const fileRes = await fetch(`${BACKEND_URL}/downloads/${encodeURIComponent(filename)}`);
      if (!fileRes.ok) {
        return reply.status(404).send({ success: false, error: 'Không tìm thấy tệp tin từ Scribd engine' });
      }

      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const safeDirName = (targetDir || 'scribd').replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetFolder = path.join(resolvedStoragePaths.drive, safeDirName);

      if (!fs.existsSync(targetFolder)) {
        await fsPromises.mkdir(targetFolder, { recursive: true });
      }

      const destPath = path.join(targetFolder, filename);
      await fsPromises.writeFile(destPath, fileBuffer);

      // Extract client identification & real IP for authentic downloader tracking
      const { ip: clientIp, isLan } = extractClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const deviceId = (req.headers['x-device-id'] as string) || null;

      let uploaderName = '';
      if (deviceId) {
        const dev = deviceRegistryService.getDevice(deviceId);
        if (dev?.alias) {
          uploaderName = dev.alias;
        } else if (dev?.isOwner) {
          uploaderName = '👑 Máy của Duy';
        } else {
          uploaderName = `Khách #${deviceId.slice(-6)}`;
        }
      } else if (isLan) {
        uploaderName = '👑 Máy của Duy';
      } else {
        const hash = crypto.createHash('md5').update(clientIp + userAgent).digest('hex').slice(0, 6);
        uploaderName = `Khách #${hash}`;
      }

      // Create .meta.json sidecar
      const metaPath = destPath.replace(/\.pdf$/i, '.meta.json');
      const meta = {
        name: filename,
        title: title || filename.replace(/_\d+\.pdf$/i, '').replace(/_/g, ' '),
        source: 'Scribd Archiver',
        category: 'documents',
        savedAt: new Date().toISOString(),
        sizeBytes: fileBuffer.length,
        downloaded_by: {
          name: uploaderName,
          ip: clientIp
        }
      };
      await fsPromises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

      // Record to HistoryRecord with deviceId
      try {
        await prisma.historyRecord.create({
          data: {
            deviceId,
            toolId: 'scribd-archiver',
            toolTitle: 'Scribd Archiver',
            fileName: filename,
            originalSize: BigInt(fileBuffer.length),
            resultSize: BigInt(fileBuffer.length),
            downloadUrl: `/api/v1/scribd/download/${encodeURIComponent(filename)}`,
            status: 'success',
            detailsJson: JSON.stringify({
              drivePath: `/${safeDirName}/${filename}`,
              title: meta.title
            })
          }
        });
      } catch (dbErr) {
        logger.warn({ dbErr }, 'Failed to record HistoryRecord for Scribd Drive save');
      }

      return reply.send({
        success: true,
        message: 'Đã lưu tài liệu vào Studio Drive thành công',
        fileName: filename,
        relPath: `/${safeDirName}/${filename}`,
        sizeBytes: fileBuffer.length
      });
    } catch (err: any) {
      logger.error({ err }, 'Error saving Scribd document to Drive');
      return reply.status(500).send({ success: false, error: 'Lỗi lưu Studio Drive: ' + err.message });
    }
  });
}
