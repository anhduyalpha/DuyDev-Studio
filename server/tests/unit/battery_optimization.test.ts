import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { buildApp } from '../../src/app.js';
import { CURRENT_PWA_VERSION } from '../../../src/utilities/pwa.js';

describe('Battery & Hardware Power Optimization Verification Suite', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const swPath = path.join(rootDir, 'sw.js');
  const indexPath = path.join(rootDir, 'index.html');
  const stitchTokensPath = path.join(rootDir, 'src/styles/stitch-tokens.css');
  const studocuCssPath = path.join(rootDir, 'src/styles/studocu.css');
  const orbsPath = path.join(rootDir, 'src/vendor/thinking-orbs.js');
  const dashboardPagePath = path.join(rootDir, 'src/pages/DashboardPage.js');
  const jobWatcherPath = path.join(rootDir, 'src/utilities/jobWatcher.js');
  const quizApiPath = path.join(rootDir, 'src/components/tools/quiz/hooks/quizApi.js');
  const appJsPath = path.join(rootDir, 'src/app.js');
  const mainActivityPath = path.join(rootDir, 'android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt');

  const swContent = fs.readFileSync(swPath, 'utf-8');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  const stitchContent = fs.readFileSync(stitchTokensPath, 'utf-8');
  const studocuContent = fs.readFileSync(studocuCssPath, 'utf-8');
  const orbsContent = fs.readFileSync(orbsPath, 'utf-8');
  const dashboardContent = fs.readFileSync(dashboardPagePath, 'utf-8');
  const jobWatcherContent = fs.readFileSync(jobWatcherPath, 'utf-8');
  const quizApiContent = fs.readFileSync(quizApiPath, 'utf-8');
  const appJsContent = fs.readFileSync(appJsPath, 'utf-8');
  const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');

  describe('1. Fastify Static Tiered Caching & ETag (Pillar 1)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('index.html must return no-cache, must-revalidate and never no-store or Expires: 0', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/index.html'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('must-revalidate');
      expect(cacheControl).not.toContain('no-store');
      expect(res.headers['expires']).toBeUndefined();
      expect(res.headers.etag).toBeDefined();
    });

    it('sw.js must return no-cache, must-revalidate with Service-Worker-Allowed: /', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/sw.js'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('must-revalidate');
      expect(cacheControl).not.toContain('no-store');
      expect(res.headers['service-worker-allowed']).toBe('/');
    });

    it('versioned assets with ?v= must return public, max-age=31536000, immutable and ETag', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/src/styles/stitch-tokens.css?v=21.0'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toBe('public, max-age=31536000, immutable');
      expect(res.headers.etag).toBeDefined();
    });

    it('versioned assets must support HTTP 304 Not Modified when ETag matches', async () => {
      const initial = await app.inject({
        method: 'GET',
        url: '/src/styles/stitch-tokens.css?v=21.0'
      });
      expect(initial.statusCode).toBe(200);
      const etag = initial.headers.etag as string;
      expect(etag).toBeTruthy();

      const revalidated = await app.inject({
        method: 'GET',
        url: '/src/styles/stitch-tokens.css?v=21.0',
        headers: {
          'if-none-match': etag
        }
      });
      expect(revalidated.statusCode).toBe(304);
      expect(revalidated.body).toBe('');
    });

    it('vendor library files must return public, max-age=31536000, immutable', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/src/vendor/thinking-orbs.js'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toBe('public, max-age=31536000, immutable');
    });

    it('unversioned internal modules must return no-cache, must-revalidate and support ETag 304', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/src/utilities/pwa.js'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toBe('no-cache, must-revalidate');
      const etag = res.headers.etag as string;
      expect(etag).toBeTruthy();

      const revalidated = await app.inject({
        method: 'GET',
        url: '/src/utilities/pwa.js',
        headers: {
          'if-none-match': etag
        }
      });
      expect(revalidated.statusCode).toBe(304);
      expect(revalidated.body).toBe('');
    });

    it('static media and icons must return max-age=2592000, stale-while-revalidate=86400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/src/assets/logo-ds.svg'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toBe('public, max-age=2592000, stale-while-revalidate=86400');
    });

    it('SPA navigation fallback must return index.html with no-cache, must-revalidate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/pdf'
      });

      expect(res.statusCode).toBe(200);
      const cacheControl = res.headers['cache-control'] as string;
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('must-revalidate');
      expect(cacheControl).not.toContain('no-store');
    });
  });

  describe('2. Android Native Power & Lifecycle (Pillar 2)', () => {
    it('MainActivity.kt must set mediaPlaybackRequiresUserGesture = true', () => {
      expect(mainActivityContent).toMatch(/settings\.mediaPlaybackRequiresUserGesture\s*=\s*true/);
    });

    it('MainActivity.kt must set safeBrowsingEnabled = false to eliminate telemetry wakeups', () => {
      expect(mainActivityContent).toMatch(/settings\.safeBrowsingEnabled\s*=\s*false/);
    });

    it('MainActivity.kt onPause must dispatch ds:native-app-paused before pausing timers', () => {
      const pauseIdx = mainActivityContent.indexOf('override fun onPause()');
      expect(pauseIdx).toBeGreaterThan(-1);
      const pauseBlock = mainActivityContent.slice(pauseIdx, pauseIdx + 600);
      expect(pauseBlock).toContain("window.dispatchEvent(new CustomEvent('ds:native-app-paused'))");
      const eventIdx = pauseBlock.indexOf("ds:native-app-paused");
      const webViewPauseIdx = pauseBlock.indexOf("webView.onPause()");
      expect(eventIdx).toBeLessThan(webViewPauseIdx);
    });

    it('MainActivity.kt must define onStop() with cookie flush', () => {
      const stopIdx = mainActivityContent.indexOf('override fun onStop()');
      expect(stopIdx).toBeGreaterThan(-1);
      const stopBlock = mainActivityContent.slice(stopIdx, stopIdx + 400);
      expect(stopBlock).toContain('CookieManager.getInstance().flush()');
    });
  });

  describe('3. GPU Compositor & Shader Throttling (Pillar 3)', () => {
    it('stitch-tokens.css .quiz-border-completed must have animation: none and no rotating loop', () => {
      const completedIdx = stitchContent.indexOf('.quiz-border-completed {');
      expect(completedIdx).toBeGreaterThan(-1);
      const completedBlock = stitchContent.slice(completedIdx, completedIdx + 300);
      expect(completedBlock).toContain('animation: none;');
      expect(completedBlock).not.toContain('animation: quiz-border-rotate');
    });

    it('stitch-tokens.css body::before must isolate fixed background to dedicated GPU layer', () => {
      const beforeIdx = stitchContent.indexOf('body::before {');
      expect(beforeIdx).toBeGreaterThan(-1);
      const beforeBlock = stitchContent.slice(beforeIdx, beforeIdx + 400);
      expect(beforeBlock).toContain('transform: translateZ(0);');
      expect(beforeBlock).toContain('will-change: transform;');
    });

    it('studocu.css must include prefers-reduced-motion: reduce rule for border-beam-card', () => {
      expect(studocuContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(studocuContent).toContain('.border-beam-card::before');
      expect(studocuContent).toContain('animation: none');
    });

    it('thinking-orbs.js loop must throttle on disconnected canvas and hidden document', () => {
      expect(orbsContent).toContain('if (!isRunning || (canvas && !canvas.isConnected) || (typeof document !== \'undefined\' && document.hidden))');
      expect(orbsContent).toContain("document.addEventListener('visibilitychange'");
      expect(orbsContent).toContain("document.removeEventListener('visibilitychange'");
    });

    it('DashboardPage.js must NOT use animate-ping for background animation', () => {
      expect(dashboardContent).not.toContain('animate-ping');
    });
  });

  describe('4. Polling Throttling & SSE Lifecycle (Pillar 4)', () => {
    it('jobWatcher.js must NOT start pollTimer concurrently alongside EventSource by default', () => {
      expect(jobWatcherContent).not.toMatch(/pollTimer\s*=\s*setInterval\(pollStatus,\s*2000\)/);
      expect(jobWatcherContent).toContain('startFallbackPolling');
      expect(jobWatcherContent).toContain('stopFallbackPolling');
    });

    it('quizApi.js must NOT start concurrent pollTimer alongside EventSource', () => {
      expect(quizApiContent).not.toMatch(/const\s+pollTimer\s*=\s*setInterval/);
      expect(quizApiContent).toContain('startFallbackPolling');
    });

    it('app.js must handle ds:native-app-paused and ds:native-app-resumed', () => {
      expect(appJsContent).toContain("window.addEventListener('ds:native-app-paused'");
      expect(appJsContent).toContain('taskCoordinator.stopHeartbeat()');
      expect(appJsContent).toContain("window.addEventListener('ds:native-app-resumed'");
      expect(appJsContent).toContain('taskCoordinator.updateHeartbeatState()');
    });
  });

  describe('5. Service Worker & Cache Version Alignment (Pillar 5)', () => {
    it('CURRENT_PWA_VERSION must match CACHE_NAME across sw.js and pwa.js', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
      expect(CURRENT_PWA_VERSION).toBe(match![1]);
    });

    it('index.html must reference matching version for all critical CSS and app.js bundles', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]duydev-studio-v(\d+\.\d+)['"]/);
      const v = match ? match[1] : '21.3';
      expect(indexContent).toContain(`href="src/styles/stitch-tokens.css?v=${v}"`);
      expect(indexContent).toContain(`href="src/styles/studocu.css?v=${v}"`);
      expect(indexContent).toContain(`href="src/styles/highlight-theme.css?v=${v}"`);
      expect(indexContent).toContain(`src="src/app.js?v=${v}"`);
    });

    it('sw.js ASSETS_TO_PRECACHE must reference matching version', () => {
      const match = swContent.match(/const CACHE_NAME = ['"]duydev-studio-v(\d+\.\d+)['"]/);
      const v = match ? match[1] : '21.3';
      expect(swContent).toContain(`'./src/styles/stitch-tokens.css?v=${v}'`);
      expect(swContent).toContain(`'./src/styles/studocu.css?v=${v}'`);
      expect(swContent).toContain(`'./src/styles/highlight-theme.css?v=${v}'`);
      expect(swContent).toContain(`'./src/app.js?v=${v}'`);
    });

    it('sw.js same-origin script/style fetch handler must enforce conditional revalidation with no-cache', () => {
      const sameOriginSection = swContent.slice(swContent.indexOf('// 3. Same-origin assets:'));
      expect(sameOriginSection).toContain("fetch(event.request, { cache: 'no-cache' })");
      expect(sameOriginSection).toContain("fetch(event.request)");
    });
  });
});
