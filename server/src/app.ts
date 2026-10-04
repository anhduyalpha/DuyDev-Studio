/**
 * DuyDev Studio Backend Server Application Entry Point
 * Built on Fastify v4 + TypeScript + Prisma SQLite WAL
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import https from 'https';
import { existsSync, readFileSync } from 'fs';
import { env } from './config/env.config.js';
import { limits } from './config/limits.config.js';
import { logger } from './lib/logger.js';
import { initSqlitePragmas, prisma } from './lib/prisma.js';
import { StorageManager } from './storage/storage.manager.js';
import { errorHandler } from './api/middleware/error.middleware.js';
import { filesRoute } from './api/routes/files.route.js';
import { chunkUploadRoute } from './api/routes/chunk-upload.route.js';
import { jobsRoute } from './api/routes/jobs.route.js';
import { archiveRoute } from './api/routes/archive.route.js';
import { qrRoute } from './api/routes/qr.route.js';
import { dynamicQrRoute } from './api/routes/dynamic-qr.route.js';
import { converterRoute } from './api/routes/converter.route.js';
import { historyRoute } from './api/routes/history.route.js';
import { studocuRoute } from './api/routes/studocu.route.js';
import { authRoute } from './api/routes/auth.route.js';
import { storageRoute } from './api/routes/storage.route.js';
import { viewerRoute } from './api/routes/viewer.route.js';
import { JanitorService } from './services/janitor.service.js';
import { StudocuDaemonService } from './services/studocu-daemon.service.js';
import { getPdfWorker, closePdfWorker } from './workers/pdf.worker.js';
import { getConverterWorker, closeConverterWorker } from './workers/converter.worker.js';
import { quizRoute } from './api/routes/quiz.route.js';
import { getQuizWorker, closeQuizWorker } from './workers/quiz.worker.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use custom Pino logger
    disableRequestLogging: true,
    bodyLimit: 50 * 1024 * 1024 * 1024,
    connectionTimeout: 0,
    keepAliveTimeout: 300_000,
    requestTimeout: 0
  });

  // 1. Register Global Error Handler
  app.setErrorHandler(errorHandler);

  // 2. Register CORS (Uncapped LAN & Local Access)
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges']
  });

  // 3. Register Multipart Streaming (Uncapped Upload Limits)
  await app.register(multipart, {
    limits: {
      fileSize: limits.maxUploadSizeBytes,
      files: 100,
      fieldSize: 10 * 1024 * 1024
    },
    highWaterMark: 4 * 1024 * 1024,
    fileHwm: 4 * 1024 * 1024
  } as any);

  // 3.1. Raw Binary Streaming Content-Type Parser (Direct WinSCP/SFTP socket ingestion)
  app.addContentTypeParser(
    ['application/octet-stream', 'application/x-binary'],
    (_request, payload, done) => {
      done(null, payload);
    }
  );

  // 3.2. Resilient JSON Parser (Gracefully handles empty body without syntax error)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // 4. Register Request Logging & Default Content-Type Hook
  app.addHook('onRequest', async (req) => {
    if (!req.headers['content-type'] && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      req.headers['content-type'] = 'application/json';
    }
    logger.debug({ reqId: req.id, method: req.method, url: req.url, range: req.headers.range }, 'Incoming request');
  });

  app.addHook('onResponse', async (req, reply) => {
    if (req.url.startsWith('/api/v1/files/')) {
      logger.info({
        reqId: req.id,
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        range: req.headers.range,
        contentRange: reply.getHeader('content-range'),
        contentLength: reply.getHeader('content-length'),
        contentType: reply.getHeader('content-type')
      }, 'Outgoing response');
    }
  });

  // 5. Base Health Check Routes
  app.get('/health', async () => ({ status: 'UP', timestamp: new Date().toISOString() }));
  app.get('/api/v1/health', async () => ({
    status: 'UP',
    version: '1.0.0',
    runtime: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));

  // 6. Register Feature Routes
  await app.register(filesRoute);
  await app.register(chunkUploadRoute);
  await app.register(jobsRoute);
  await app.register(archiveRoute);
  await app.register(qrRoute);
  await app.register(dynamicQrRoute);
  await app.register(converterRoute);
  await app.register(historyRoute);
  await app.register(studocuRoute);
  await app.register(authRoute);
  await app.register(storageRoute);
  await app.register(viewerRoute);
  await app.register(quizRoute);

  // 6.1 Web Share Target Fallback Routes
  // POST fallback (OS Share Sheet multipart POST when SW is not yet active)
  app.post('/share-target', async (req, reply) => {
    const params = new URLSearchParams();
    const query = (req.query as Record<string, string>) || {};
    if (query.url) params.set('url', query.url);
    if (query.text) params.set('text', query.text);
    if (query.title) params.set('title', query.title);

    if (req.isMultipart()) {
      try {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'field') {
            const val = typeof part.value === 'string' ? part.value.trim() : '';
            if (val) {
              if (part.fieldname === 'url') params.set('url', val);
              else if (part.fieldname === 'text') params.set('text', val);
              else if (part.fieldname === 'title') params.set('title', val);
            }
          } else if (part.type === 'file') {
            part.file.resume();
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Error parsing fallback multipart share target');
      }
    } else if (req.body && typeof req.body === 'object') {
      const body = req.body as Record<string, string>;
      if (body.url) params.set('url', body.url);
      if (body.text) params.set('text', body.text);
      if (body.title) params.set('title', body.title);
    }

    const paramStr = params.toString();
    return reply.redirect(paramStr ? `/#share-target?${paramStr}` : '/#share-target', 303);
  });

  // GET fallback for text/URL share (iOS Safari PWA)
  app.get('/share-target', async (req, reply) => {
    const { url, text, title } = (req.query as Record<string, string>) || {};
    const params = new URLSearchParams();
    if (url) params.set('url', url);
    if (text) params.set('text', text);
    if (title) params.set('title', title);
    const paramStr = params.toString();
    return reply.redirect(paramStr ? `/#share-target?${paramStr}` : '/#share-target', 303);
  });

function normalizeSafePath(pathname: string): string {
  try {
    const norm = decodeURIComponent(pathname).replace(/\\/g, '/');
    return path.posix.normalize(norm.startsWith('/') ? norm : `/${norm}`);
  } catch {
    return '/__blocked_invalid_encoding__';
  }
}

function isBlockedSensitivePath(pathname: string): boolean {
  const clean = normalizeSafePath(pathname).toLowerCase();
  return (
    clean.startsWith('/server') || clean.startsWith('/data') || clean.startsWith('/engines') ||
    clean.startsWith('/certs') || clean.startsWith('/.git') || clean.startsWith('/.agents') ||
    clean.startsWith('/.tmp') || clean.startsWith('/docs') || clean.startsWith('/scratch') ||
    clean.startsWith('/tests') || clean.startsWith('/scripts') || clean.includes('/..') ||
    /(?:^|\/)\.env/i.test(clean) || /\.(env|db|sqlite|key|crt|pem|log|bak)/i.test(clean)
  );
}

function isAllowedStaticAsset(pathname: string): boolean {
  if (isBlockedSensitivePath(pathname)) return false;
  const clean = normalizeSafePath(pathname).toLowerCase();
  return (
    clean === '/' || clean === '/index.html' || clean === '/manifest.webmanifest' ||
    clean === '/sw.js' || clean === '/favicon.ico' || clean.startsWith('/src/') ||
    clean.startsWith('/static/') || clean.startsWith('/pdfjs/')
  );
}

  // 7. Unified Server: Serve PWA Frontend (Single-Port Hosting)
  const clientRoot = existsSync(path.resolve(process.cwd(), 'index.html'))
    ? process.cwd()
    : path.resolve(process.cwd(), '..');

  if (existsSync(clientRoot)) {
    await app.register(fastifyStatic, {
      root: clientRoot,
      prefix: '/',
      index: ['index.html'],
      maxAge: 0,
      allowedPath: (pathname) => isAllowedStaticAsset(pathname),
      setHeaders(res, pathName) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        if (pathName.endsWith('sw.js')) {
          res.setHeader('Service-Worker-Allowed', '/');
        } else {
          res.setHeader('Expires', '0');
        }
      }
    });

    // SPA Fallback: Unknown non-API GET/HEAD routes serve index.html
    app.setNotFoundHandler((req, reply) => {
      const rawUrl = req.raw.url || '';
      const pathname = rawUrl.split('?')[0];
      const ext = path.extname(pathname);

      if (
        (req.method !== 'GET' && req.method !== 'HEAD') ||
        rawUrl.startsWith('/api/') ||
        isBlockedSensitivePath(pathname) ||
        (ext !== '' && ext !== '.html')
      ) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: `Route ${req.method} ${req.raw.url} not found`,
            timestamp: new Date().toISOString()
          }
        });
      }
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
      return reply.sendFile('index.html', clientRoot);
    });
  }

  return app;
}

async function startServer(): Promise<void> {
  try {
    // A. Ensure Ephemeral Storage Directories Exist
    await StorageManager.initStorage();

    // B. Initialize Database & SQLite WAL Pragmas
    await initSqlitePragmas();

    // C. Start Ephemeral File Janitor Daemon
    JanitorService.startJanitor();

    // D. Start BullMQ Background Processing Workers & Companion Daemons
    getPdfWorker();
    logger.info('⚙️ PDF Processing BullMQ Worker initialized');
    getConverterWorker();
    logger.info('⚙️ Universal Converter BullMQ Worker initialized');
    getQuizWorker();
    logger.info('⚙️ AI Quiz BullMQ Worker initialized');
    StudocuDaemonService.ensureDaemonRunning().catch((err) => {
      logger.warn({ err }, 'Background Studocu daemon startup warning');
    });

    // E. Build and listen
    const server = await buildApp();

    await server.listen({
      port: env.PORT,
      host: env.HOST
    });

    logger.info(`🚀 DuyDev Studio Unified Server running at http://${env.HOST}:${env.PORT}`);
    logger.info(`📦 Ephemeral Storage Root: ${env.STORAGE_ROOT}`);
    logger.info(`🔒 Auth Mode: ${env.AUTH_MODE}`);

    // F. Optional HTTPS Companion Server for Secure Context (Clipboard API, PWA)
    const certDir = path.resolve(process.cwd(), 'certs');
    const keyPath = path.join(certDir, 'server.key');
    const certPath = path.join(certDir, 'server.crt');
    let httpsServer: https.Server | null = null;

    if (existsSync(keyPath) && existsSync(certPath)) {
      try {
        httpsServer = https.createServer(
          { key: readFileSync(keyPath), cert: readFileSync(certPath) },
          (req, res) => { server.routing(req, res); }
        );
        httpsServer.listen(env.HTTPS_PORT, env.HOST, () => {
          logger.info(`🔒 DuyDev Studio HTTPS Server running at https://${env.HOST}:${env.HTTPS_PORT}`);
        });
      } catch (sslErr) {
        logger.warn({ sslErr }, 'Failed to start HTTPS companion server');
      }
    }

    // Graceful Shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        JanitorService.stopJanitor();
        if (httpsServer) httpsServer.close();
        await Promise.allSettled([
          closePdfWorker(),
          closeConverterWorker(),
          closeQuizWorker(),
          StudocuDaemonService.stopDaemon()
        ]);
        await server.close();
        await prisma.$disconnect();
        process.exit(0);
      });
    }
  } catch (err) {
    logger.fatal({ err }, 'Server failed to start');
    process.exit(1);
  }
}

// Start if executed directly
if (process.argv[1] && (process.argv[1].endsWith('app.ts') || process.argv[1].endsWith('app.js'))) {
  startServer();
}
