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

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use custom Pino logger
    disableRequestLogging: true,
    bodyLimit: 50 * 1024 * 1024,
    connectionTimeout: 0,
    keepAliveTimeout: 120_000
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
      files: 100
    },
    highWaterMark: 1024 * 1024,
    fileHwm: 1024 * 1024
  } as any);

  // 4. Register Request Logging Hook
  app.addHook('onRequest', async (req) => {
    logger.debug({ reqId: req.id, method: req.method, url: req.url }, 'Incoming request');
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
