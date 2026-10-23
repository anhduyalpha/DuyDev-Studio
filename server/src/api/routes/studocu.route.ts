/**
 * Studocu Fastify Gateway Route
 * Seamlessly proxies requests to internal Python engine (127.0.0.1:8090)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import path from 'path';
import { StudocuDaemonService } from '../../services/studocu-daemon.service.js';
import { env } from '../../config/env.config.js';
import crypto from 'crypto';
import { deviceRegistryService } from '../../services/device-registry.service.js';
import { extractClientIp, parseDeviceSummary } from '../middleware/telemetry.middleware.js';

const BACKEND_URL = env.STUDOCU_API_URL;

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

const CACHED_JOB_RESULTS = new Map<string, any>();

function matchesDocumentId(file: any, targetDocId: string): boolean {
  if (!file || !targetDocId) return false;

  // 1. Direct ID match
  if (file.id === targetDocId) return true;

  // 2. Exact doc ID match from source/original URL
  const urlsToCheck = [file.original_url, file.source_url];
  if (typeof file.url === 'string' && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
    urlsToCheck.push(file.url);
  }
  for (const u of urlsToCheck) {
    if (typeof u === 'string') {
      const m = u.match(/\/(\d{5,15})(?:[/?#]|$)/);
      if (m && m[1] === targetDocId) return true;
    }
  }

  // 3. Exact bounded numeric match in filename (prevents substring collisions like 12345 in 12345678)
  if (typeof file.name === 'string') {
    const boundaryRegex = new RegExp(`(^|\\D)${targetDocId}(\\D|$)`);
    if (boundaryRegex.test(file.name)) return true;
  }

  return false;
}

export async function studocuRoute(app: FastifyInstance): Promise<void> {
  // 1. Health & status check
  app.get('/api/v1/studocu/status', async () => {
    const status = await StudocuDaemonService.getStatus();
    return { success: true, data: status, timestamp: new Date().toISOString() };
  });

  // Helper: Verification layer for Studocu URLs
  function validateStudocuDocumentUrl(url: string): { valid: boolean; error?: string } {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { valid: false, error: 'Thiếu liên kết Studocu cần tải' };
    }
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.toLowerCase();
      const isStudocu = host === 'studocu.com' ||
        host.endsWith('.studocu.com') ||
        host === 'studocu.vn' ||
        host.endsWith('.studocu.vn') ||
        host === 'studeersnel.nl' ||
        host.endsWith('.studeersnel.nl');

      if (!isStudocu) {
        return { valid: false, error: 'Liên kết không thuộc Studocu. Vui lòng dán link từ studocu.com hoặc studocu.vn' };
      }

      const pathname = parsed.pathname.toLowerCase();
      if (/\/(?:course|courses)\//i.test(pathname)) {
        return {
          valid: false,
          error: 'Đây là liên kết môn học/thư mục (chứa danh sách nhiều tài liệu). Vui lòng mở 1 tài liệu cụ thể trong môn này để lấy link tải.'
        };
      }
      if (/\/(?:institution|univ|school|university)\//i.test(pathname)) {
        return {
          valid: false,
          error: 'Đây là liên kết trường học/học viện. Vui lòng mở 1 tài liệu cụ thể để lấy link tải.'
        };
      }
      if (pathname.includes('/search') || parsed.searchParams.has('search')) {
        return {
          valid: false,
          error: 'Đây là liên kết trang tìm kiếm. Vui lòng chọn và mở 1 tài liệu cụ thể để lấy link tải.'
        };
      }
      if (/\/(?:user|profile)\//i.test(pathname)) {
        return {
          valid: false,
          error: 'Đây là liên kết trang cá nhân. Vui lòng dán liên kết của tài liệu cụ thể.'
        };
      }
      if (!/\/(?:document|doc)\//i.test(pathname) && !/\/d\/\d+/i.test(pathname)) {
        return {
          valid: false,
          error: 'Liên kết không phải là trang tài liệu Studocu hợp lệ (link tài liệu phải chứa /document/).'
        };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: 'Định dạng liên kết không hợp lệ' };
    }
  }

  // 2. Start download job
  app.post('/api/v1/studocu/download', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = (req.body || {}) as any;
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      const forceReload = Boolean(body.force_reload || body.bypass_cache);

      // Verification Layer: Ensure URL points to a specific document, not course/search/institution
      const validation = validateStudocuDocumentUrl(url);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: validation.error
        });
      }

      // Fast pre-check: if doc ID exists in URL and not force_reload, check active files cache
      if (url && !forceReload) {
        const docIdMatch = url.match(/\/(\d{5,15})(?:[/?#]|$)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          try {
            const filesRes = await safeJsonFetch(`${BACKEND_URL}/api/files`);
            if (filesRes.status === 200 && Array.isArray(filesRes.data)) {
              const matched = filesRes.data.find((f: any) => matchesDocumentId(f, docId));

              if (matched) {
                const isPdf = matched.format === 'pdf' || matched.is_pdf || matched.name?.toLowerCase().endsWith('.pdf');
                const resultPayload: any = {
                  title: matched.title || matched.name,
                  pages: matched.pages,
                  from_cache: true
                };

                if (isPdf) {
                  resultPayload.pdf = {
                    id: matched.id,
                    name: matched.name,
                    download_url: matched.download_url || matched.url || `/downloads/${encodeURIComponent(matched.name)}`,
                    view_url: matched.view_url,
                    stream_url: matched.stream_url,
                    viewer_url: matched.viewer_url,
                    size_mb: matched.size_mb
                  };
                } else {
                  resultPayload.md = {
                    id: matched.id,
                    name: matched.name,
                    download_url: matched.download_url || matched.url || `/downloads/${encodeURIComponent(matched.name)}`,
                    view_url: matched.view_url,
                    size_kb: matched.size_bytes ? Math.round(matched.size_bytes / 1024) : undefined
                  };
                }

                const cachedJobId = `cached_${matched.id || docId}`;
                // Keep cache bounded to 100 entries
                if (CACHED_JOB_RESULTS.size > 100) {
                  const firstKey = CACHED_JOB_RESULTS.keys().next().value;
                  if (firstKey) CACHED_JOB_RESULTS.delete(firstKey);
                }
                CACHED_JOB_RESULTS.set(cachedJobId, resultPayload);

                return reply.status(200).send({
                  success: true,
                  from_cache: true,
                  job_id: cachedJobId,
                  status: 'completed',
                  result: resultPayload
                });
              }
            }
          } catch {
            // Fail open: continue to forward to python engine
          }
        }
      }

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
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  });

  // 3. Get job status
  app.get('/api/v1/studocu/status/:jobId', async (req: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const jobId = req.params.jobId;
      if (jobId.startsWith('cached_')) {
        const cachedResult = CACHED_JOB_RESULTS.get(jobId);
        const pageCount = cachedResult?.pages || cachedResult?.pdf?.pages || 0;
        return reply.status(200).send({
          id: jobId,
          status: 'completed',
          from_cache: true,
          result: cachedResult,
          progress: {
            phase: 'completed',
            current_page: pageCount,
            total_pages: pageCount,
            percent: 100,
            message: 'Tài liệu đã có sẵn trên máy chủ'
          },
          logs: ['Tài liệu đã có sẵn trên máy chủ']
        });
      }
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/status/${jobId}`);
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
  const handleMoveToTrash = async (req: FastifyRequest<{ Params?: { '*'?: string }; Body?: { filename?: string; file?: string } }>, reply: FastifyReply) => {
    try {
      const rawName = (req.body as any)?.filename || (req.body as any)?.file || req.params?.['*'] || '';
      const filename = encodeURIComponent(rawName);
      const { status, data } = await safeJsonFetch(`${BACKEND_URL}/api/files/${filename}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: rawName })
      });
      return reply.status(status).send(data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  };

  app.delete('/api/v1/studocu/files/*', handleMoveToTrash);
  app.post('/api/v1/studocu/files/trash', handleMoveToTrash);

  // 8. Restore file from trash
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
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  };

  app.post('/api/v1/studocu/trash/restore/*', handleRestore);
  app.post('/api/v1/studocu/trash/restore', handleRestore);

  // 9. Permanent delete or empty trash
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
      return reply.status(502).send({ error: 'Studocu engine unavailable: ' + err.message });
    }
  };

  app.delete('/api/v1/studocu/trash/*', handleDeletePermanent);
  app.post('/api/v1/studocu/trash/delete', handleDeletePermanent);

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

function formatContentDisposition(filename: string): string {
  const cleanName = path.basename(filename);
  const asciiFallback = cleanName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_') || 'document';
  const rfc5987Encoded = encodeURIComponent(cleanName)
    .replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987Encoded}`;
}

  app.get('/api/v1/studocu/stream', handleDocumentStream);
  app.get('/api/v1/studocu/stream/*', handleDocumentStream);
  app.head('/api/v1/studocu/stream', handleDocumentStream);
  app.head('/api/v1/studocu/stream/*', handleDocumentStream);

  // 11. Download File Attachment
  const handleDownload = async (req: FastifyRequest<{ Params: { '*': string } }>, reply: FastifyReply) => {
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

  app.get('/api/v1/studocu/download/*', handleDownload);
  app.head('/api/v1/studocu/download/*', handleDownload);

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
