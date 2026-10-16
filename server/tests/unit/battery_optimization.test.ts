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
  const globalTaskDockPath = path.join(rootDir, 'src/components/layout/GlobalTaskDock.js');
  const headerPath = path.join(rootDir, 'src/components/layout/Header.js');
  const adminPagePath = path.join(rootDir, 'src/pages/AdminPage.js');
  const visitorTrackerPath = path.join(rootDir, 'src/utilities/visitorTracker.js');
  const taskCoordinatorPath = path.join(rootDir, 'src/utilities/taskCoordinator.js');
  const adminIpTrafficPath = path.join(rootDir, 'src/components/admin/AdminIpTrafficManager.js');
  const formatSelectorPath = path.join(rootDir, 'src/components/tools/converter/components/FormatSelector.js');
  const viewSplitSliderOverlayPath = path.join(rootDir, 'src/components/tools/viewsplit/components/ViewSplitSliderOverlay.js');
  const viewSplitPanePath = path.join(rootDir, 'src/components/tools/viewsplit/components/ViewSplitPane.js');

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
  const globalTaskDockContent = fs.readFileSync(globalTaskDockPath, 'utf-8');
  const headerContent = fs.readFileSync(headerPath, 'utf-8');
  const adminPageContent = fs.readFileSync(adminPagePath, 'utf-8');
  const visitorTrackerContent = fs.readFileSync(visitorTrackerPath, 'utf-8');
  const taskCoordinatorContent = fs.readFileSync(taskCoordinatorPath, 'utf-8');
  const adminIpTrafficContent = fs.readFileSync(adminIpTrafficPath, 'utf-8');
  const formatSelectorContent = fs.readFileSync(formatSelectorPath, 'utf-8');
  const viewSplitSliderOverlayContent = fs.readFileSync(viewSplitSliderOverlayPath, 'utf-8');
  const viewSplitPaneContent = fs.readFileSync(viewSplitPanePath, 'utf-8');

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

    it('MainActivity.kt onPause and onStop must call webView.onPause(), pauseTimers(), and clear FLAG_KEEP_SCREEN_ON', () => {
      const pauseIdx = mainActivityContent.indexOf('override fun onPause()');
      const pauseBlock = mainActivityContent.slice(pauseIdx, pauseIdx + 600);
      expect(pauseBlock).toContain('webView.onPause()');
      expect(pauseBlock).toContain('webView.pauseTimers()');
      expect(pauseBlock).toContain('window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)');

      const stopIdx = mainActivityContent.indexOf('override fun onStop()');
      const stopBlock = mainActivityContent.slice(stopIdx, stopIdx + 600);
      expect(stopBlock).toContain('webView.onPause()');
      expect(stopBlock).toContain('webView.pauseTimers()');
      expect(stopBlock).toContain('window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)');
    });

    it('MainActivity.kt unlockHighRefreshRate must delegate to adaptive display mode 0 for LTPO power saving', () => {
      expect(mainActivityContent).toContain('unlockHighRefreshRate()');
      expect(mainActivityContent).toContain('params.preferredDisplayModeId = 0');
    });

    it('MainActivity.kt onDestroy must cleanly teardown and destroy WebView', () => {
      const destroyIdx = mainActivityContent.indexOf('override fun onDestroy()');
      expect(destroyIdx).toBeGreaterThan(-1);
      const destroyBlock = mainActivityContent.slice(destroyIdx, destroyIdx + 500);
      expect(destroyBlock).toContain('webView.destroy()');
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

    it('stitch-tokens.css body::before must NOT retain will-change: transform to save VRAM on idle layers', () => {
      const beforeIdx = stitchContent.indexOf('body::before {');
      expect(beforeIdx).toBeGreaterThan(-1);
      const beforeBlock = stitchContent.slice(beforeIdx, beforeIdx + 400);
      expect(beforeBlock).toContain('transform: translateZ(0);');
      expect(beforeBlock).not.toContain('will-change: transform;');

      // Sticky chrome headers and bottom navigation retain will-change
      expect(stitchContent).toContain('.glass-panel');
      expect(stitchContent).toContain('.glass-dock');
      expect(stitchContent).toContain('will-change: transform;');
    });

    it('stitch-tokens.css must define html.app-backgrounded rule pausing animations and transitions', () => {
      expect(stitchContent).toContain('html.app-backgrounded');
      expect(stitchContent).toContain('animation-play-state: paused !important;');
      expect(stitchContent).toContain('transition: none !important;');
    });

    it('GlobalTaskDock.js, AdminPage.js, and AdminIpTrafficManager.js must NOT use infinite animate-ping or animate-pulse on idle dots', () => {
      expect(globalTaskDockContent).not.toContain('animate-ping');
      expect(adminPageContent).not.toContain('animate-pulse');
      expect(adminIpTrafficContent).not.toContain('animate-pulse');
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

    it('studocu.css does not apply infinite border-beam-spin or filter blur in default idle state and gates under .is-processing', () => {
      expect(studocuContent).not.toMatch(/\.border-beam-card::before\s*\{[^}]*animation:\s*border-beam-spin/);
      expect(studocuContent).not.toMatch(/\.border-beam-card::after\s*\{[^}]*animation:\s*border-beam-spin/);
      expect(studocuContent).not.toContain('filter: blur(10px)');
      expect(studocuContent).not.toContain('@property --beam-angle');

      expect(studocuContent).toContain('.border-beam-card.is-processing::before');
      expect(studocuContent).toContain('.border-beam-card.is-processing::after');
      expect(studocuContent).toContain('animation: border-beam-spin');
      expect(studocuContent).toContain('animation: border-beam-entrance 1.6s');
    });

    it('FormatSelector.js, ViewSplitSliderOverlay.js, and ViewSplitPane.js contain zero idle animate-pulse classes and use specular status dots', () => {
      expect(formatSelectorContent).not.toContain('animate-pulse');
      expect(viewSplitSliderOverlayContent).not.toContain('animate-pulse');
      expect(viewSplitPaneContent).not.toContain('animate-pulse');

      expect(formatSelectorContent).toContain('specular-status-dot-indigo');
      expect(viewSplitSliderOverlayContent).toContain('specular-status-dot-cyan');
      expect(viewSplitPaneContent).toContain('specular-status-dot-cyan');
    });

    it('stitch-tokens.css provides 3-layer specular glowing orbs and tactile spring micro-physics', () => {
      expect(stitchContent).toContain('.specular-status-dot');
      expect(stitchContent).toContain('.specular-status-dot-emerald');
      expect(stitchContent).toContain('.specular-status-dot-indigo');
      expect(stitchContent).toContain('.specular-status-dot-cyan');
      expect(stitchContent).toContain('transform: scale(0.975)');
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

    it('app.js must handle visibilitychange and toggle app-backgrounded class', () => {
      expect(appJsContent).toContain("document.addEventListener('visibilitychange'");
      expect(appJsContent).toContain("document.documentElement.classList.toggle('app-backgrounded'");
      expect(appJsContent).toContain("ds:visibility-change");
    });

    it('visitorTracker.js must double interval on mobile/APK, pause on hidden document, and handle native lifecycle events', () => {
      expect(visitorTrackerContent).toContain('this.heartbeatIntervalMs = isMobileOrApk ? 50_000 : 25_000;');
      expect(visitorTrackerContent).toContain("document.hidden || document.visibilityState === 'hidden'");
      expect(visitorTrackerContent).toContain("window.addEventListener('ds:visibility-change'");
      expect(visitorTrackerContent).toContain("window.addEventListener('ds:native-app-paused'");
      expect(visitorTrackerContent).toContain("window.addEventListener('ds:native-app-resumed'");
    });

    it('AdminPage.js must suspend polling when document is hidden and remove visibility listener on stop', () => {
      expect(adminPageContent).toContain("document.hidden || document.visibilityState === 'hidden' || isPollingPaused");
      expect(adminPageContent).toContain("document.removeEventListener('visibilitychange', adminVisibilityHandler);");
      expect(adminPageContent).toContain("window.addEventListener('ds:visibility-change', adminVisibilityHandler);");
    });

    it('Header.js must double telemetry interval on mobile/APK to 60s and debounce resume sync', () => {
      expect(headerContent).toContain('const telemetryIntervalMs = isMobileOrApk ? 60000 : 30000;');
      expect(headerContent).toContain('triggerDebouncedResumeSync();');
      expect(headerContent).toContain("window.addEventListener('ds:visibility-change'");
    });

    it('taskCoordinator.js must throttle mobile heartbeat to 5000ms and govern Android screen wake-lock', () => {
      expect(taskCoordinatorContent).toContain('const intervalMs = isMobileOrApk ? 5000 : 2500;');
      expect(taskCoordinatorContent).toContain('window.AndroidBridge.setKeepScreenOn(!isHidden && hasRunning)');
      expect(taskCoordinatorContent).toContain('window.AndroidBridge.setKeepScreenOn(false)');
    });

    it('AdminIpTrafficManager.js must throttle sessions polling on mobile to 16s and suspend on hidden tab', () => {
      expect(adminIpTrafficContent).toContain('const sessionsIntervalMs = isMobileOrApk ? 16000 : 8000;');
      expect(adminIpTrafficContent).toContain("if (document.hidden || document.visibilityState === 'hidden') return;");
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
