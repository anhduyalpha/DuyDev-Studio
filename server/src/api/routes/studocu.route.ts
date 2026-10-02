/**
 * Studocu Fastify Gateway Route
 * Seamlessly proxies requests to internal Python engine (127.0.0.1:8090)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import path from 'path';
import { StudocuDaemonService } from '../../services/studocu-daemon.service.js';

const BACKEND_URL = 'http://127.0.0.1:8090';

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

export async function studocuRoute(app: FastifyInstance): Promise<void> {
  // 1. Health & status check
  app.get('/api/v1/studocu/status', async () => {
    const status = await StudocuDaemonService.getStatus();
    return { success: true, data: status, timestamp: new Date().toISOString() };
  });

  // 2. Start download job
  app.post('/api/v1/studocu/download', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {})
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 3. Get job status
  app.get('/api/v1/studocu/status/:jobId', async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/status/${req.params.jobId}`);
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 4. Cancel job
  app.post('/api/v1/studocu/cancel/:jobId', async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/cancel/${req.params.jobId}`, { method: 'POST' });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 5. List active files
  app.get('/api/v1/studocu/files', async (_req, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/files`);
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 6. List trash files
  app.get('/api/v1/studocu/trash', async (_req, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/trash`);
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 7. Move file to trash (soft delete)
  app.delete('/api/v1/studocu/files/*', async (req: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    try {
      const filename = encodeURIComponent(req.params['*']);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/files/${filename}`, { method: 'DELETE' });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 8. Restore file from trash
  app.post('/api/v1/studocu/trash/restore/*', async (req: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    try {
      const filename = encodeURIComponent(req.params['*']);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/trash/restore/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 9. Permanent delete or empty trash
  app.delete('/api/v1/studocu/trash/*', async (req: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    try {
      const param = req.params['*'];
      const target = param === 'empty' ? 'empty' : encodeURIComponent(param);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/trash/${target}`, { method: 'DELETE' });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 10. Document Stream with Range Support (Universal Viewer & Tab preview compatible)
  async function handleDocumentStream(req: FastifyRequest<{ Params?: { '*'?: string }; Querystring: { id?: string; file?: string } }>, reply: FastifyReply) {
    try {
      const pathFile = req.params?.['*'];
      const query = new URLSearchParams();
      if (req.query.id) query.set('id', req.query.id);
      const effectiveFile = req.query.file || pathFile;
      if (effectiveFile) query.set('file', effectiveFile);
      if (req.query.id && !effectiveFile && !/^[0-9a-f]{16}$/i.test(req.query.id)) {
        query.set('file', req.query.id);
      }

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

      const filename = effectiveFile || 'document.pdf';
      const isMd = filename.toLowerCase().endsWith('.md');
      // HARDENED LOCK: Enforce standard inline MIME and pure 'inline' disposition.
      // Omit filename= parameter to prevent browser download managers and IDM from auto-downloading.
      reply.header('Content-Type', isMd ? 'text/plain; charset=utf-8' : 'application/pdf');
      reply.header('Content-Disposition', 'inline');

      if (res.body) {
        const stream = Readable.fromWeb(res.body as any);
        return reply.send(stream);
      }
      return reply.send();
    } catch (err: any) {
      return reply.status(502).send('Studocu stream error: ' + err.message);
    }
  }

  app.get('/api/v1/studocu/stream', handleDocumentStream);
  app.get('/api/v1/studocu/stream/*', handleDocumentStream);

  // 11. Download File Attachment
  app.get('/api/v1/studocu/download/*', async (req: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
    try {
      const filename = req.params['*'];
      const res = await fetch(`${BACKEND_URL}/downloads/${encodeURIComponent(filename)}`);
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

      const cleanName = path.basename(filename);
      reply.header('Content-Disposition', `attachment; filename="${cleanName}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`);

      if (res.body) {
        const stream = Readable.fromWeb(res.body as any);
        return reply.send(stream);
      }
      return reply.send();
    } catch (err: any) {
      return reply.status(502).send('Download error: ' + err.message);
    }
  });

  // 12. Reset Session
  app.post('/api/v1/studocu/reset-session', async (_req, reply: FastifyReply) => {
    try {
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/reset-session`, { method: 'POST' });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Reset session failed: ' + err.message });
    }
  });
}
