/**
 * DuyDev Studio - Application Bootstrapper & Router
 * Dark Professional Minimalism
 */

import { initTheme, updateThemeUI, getStoredTheme } from './hooks/useTheme.js';
import { soundEngine } from './utilities/soundEngine.js';
import { toolRegistry } from './hooks/useToolRegistry.js';
import { clearModuleState, clearAllModuleStates } from './utilities/moduleState.js';

// Layout components
import { renderHeader, attachHeaderListeners, syncHeaderUserProfile } from './components/layout/Header.js';
import { renderBottomNav } from './components/layout/BottomNav.js';
import { renderFooter } from './components/layout/Footer.js';
import { initGlobalTaskDock } from './components/layout/GlobalTaskDock.js';
import { taskCoordinator } from './utilities/taskCoordinator.js';

// Core initial view & helpers (all heavy secondary routes/modals lazy-loaded via loadModule)
import { renderDashboardPage, attachDashboardListeners } from './pages/DashboardPage.js';
import { detectSmartRoute, handoffSmartUrl } from './utilities/smartUrlRouter.js';
import { renderSlideConfirmModal } from './components/common/SlideConfirmModal.js';
import { peekPendingSharedPayload, consumePendingSharedPayload } from './utilities/shareTargetHelper.js';
import { initRustCore } from './utilities/rustCore.js';

const _lazyModules = Object.create(null);
const _resolvedModules = Object.create(null);
function loadModule(key, importer) {
  if (_resolvedModules[key]) {
    return Promise.resolve(_resolvedModules[key]);
  }
  return (_lazyModules[key] ??= importer()
    .then((mod) => {
      _resolvedModules[key] = mod;
      return mod;
    })
    .catch((err) => {
      delete _lazyModules[key];
      delete _resolvedModules[key];
      throw err;
    }));
}
let _stopAdminPolling = null;

function getShareTargetModal() {
  return loadModule('shareTargetModal', () => import('./components/common/ShareTargetModal.js'));
}

// Native Android IPC liveness ping (immediate 0ms response expected by MainActivity watchdog within 350ms)
if (typeof window !== 'undefined') {
  window.__dsAlivePing = () => 'ok';
}
import { showToast } from './utilities/toast.js';
import { getDeviceId } from './utilities/deviceId.js';
import { isAdminAuthenticated, getAdminToken } from './utilities/adminAuth.js';
import { initSecurityShield } from './utilities/securityShield.js';
import { isProfileConfigured, syncProfileWithServer, getUserProfile } from './utilities/userProfile.js';
import { storage } from './utilities/storage.js';

/**
 * Global fetch interceptor ensuring all /api/v1/* requests attach X-Device-Id, X-DS-CSRF, and auth credentials
 */
function setupGlobalApiFetchInterceptor() {
  if (typeof window === 'undefined' || !window.fetch) return;
  const originalFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    try {
      const urlStr = typeof input === 'string' ? input : (input?.url || '');
      if (urlStr.includes('/api/v1/') || urlStr.startsWith('/api/') || urlStr.startsWith('api/')) {
        const deviceId = getDeviceId();
        const isAdmin = isAdminAuthenticated();
        const adminToken = getAdminToken();

        // Extract CSRF token from document.cookie
        const csrfMatch = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)ds_csrf=([^;]*)/) : null;
        const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

        // Ensure credentials are sent with requests
        if (!init.credentials) {
          init.credentials = 'same-origin';
        }

        let headers = init.headers;
        if (!headers) {
          headers = {};
        }

        if (headers instanceof Headers) {
          if (!headers.has('X-Device-Id')) headers.set('X-Device-Id', deviceId);
          if (csrfToken && !headers.has('X-DS-CSRF')) headers.set('X-DS-CSRF', csrfToken);
          if (isAdmin && !headers.has('X-Is-Admin')) headers.set('X-Is-Admin', 'true');
          if (adminToken && !headers.has('x-storage-auth')) headers.set('x-storage-auth', adminToken);
        } else if (Array.isArray(headers)) {
          if (!headers.some(([k]) => k.toLowerCase() === 'x-device-id')) {
            headers.push(['X-Device-Id', deviceId]);
          }
          if (csrfToken && !headers.some(([k]) => k.toLowerCase() === 'x-ds-csrf')) {
            headers.push(['X-DS-CSRF', csrfToken]);
          }
          if (isAdmin && !headers.some(([k]) => k.toLowerCase() === 'x-is-admin')) {
            headers.push(['X-Is-Admin', 'true']);
          }
          if (adminToken && !headers.some(([k]) => k.toLowerCase() === 'x-storage-auth')) {
            headers.push(['x-storage-auth', adminToken]);
          }
        } else if (typeof headers === 'object') {
          if (!headers['X-Device-Id'] && !headers['x-device-id']) {
            headers['X-Device-Id'] = deviceId;
          }
          if (csrfToken && !headers['X-DS-CSRF'] && !headers['x-ds-csrf']) {
            headers['X-DS-CSRF'] = csrfToken;
          }
          if (isAdmin && !headers['X-Is-Admin'] && !headers['x-is-admin']) {
            headers['X-Is-Admin'] = 'true';
          }
          if (adminToken && !headers['x-storage-auth']) {
            headers['x-storage-auth'] = adminToken;
          }
        }
        init.headers = headers;
      }
    } catch {}
    return originalFetch.call(this, input, init);
  };
}

class App {
  constructor() {
    this.currentCleanups = [];
    this.appRoot = document.getElementById('app');
    this._navigationSeq = 0;
    this._checkingShareTarget = false;
  }

  async init() {
    if (typeof window !== 'undefined') {
      window.__dsAlivePing = () => 'ok';
    }

    if (typeof window !== 'undefined' && window.__IS_DEPRECATED_DOMAIN) {
      console.warn('[DS] Deprecated domain detected. App execution halted in favor of migration screen.');
      return;
    }

    setupGlobalApiFetchInterceptor();
    initSecurityShield();
    initTheme();
    initRustCore().catch(() => {});
    taskCoordinator.init();

    // Clean up cache-busting parameter from URL if present (_ds_fresh)
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('_ds_fresh')) {
        url.searchParams.delete('_ds_fresh');
        const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {}

    // Check URL parameters for fast debug reset (?reset=1 or ?clear=1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('reset') || urlParams.has('clear')) {
      clearAllModuleStates();
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    // Purge legacy last_route lock from prior versions
    try {
      localStorage.removeItem('ds_last_route');
    } catch {}

    // Listen to hash changes for client-side SPA routing
    window.addEventListener('hashchange', () => this.handleRoute());

    // Global re-render event dispatcher
    window.addEventListener('ds:re-render', () => this.renderCurrentView(true));

    // Initial render
    this.renderShell();
    const host = (window.location.hostname || '').toLowerCase();
    const migrationHint = `${window.location.search || ''}${window.location.hash || ''}`;
    if (host.includes('alphadaniel') || migrationHint.includes('migration')) {
      loadModule('migrationNotice', () => import('./components/common/MigrationNoticeModal.js'))
        .then((m) => m.checkAndRenderMigrationNotice())
        .catch(() => {});
    }
    initGlobalTaskDock();
    await this.handleRoute();
    try { sessionStorage.removeItem('ds_auto_recovered'); } catch {}

    // Signal app readiness and boot hydration
    window.__DS_APP_HYDRATED = true;
    window.__dsAppReady = true;
    window.dispatchEvent(new CustomEvent('ds:app-ready'));
    if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.notifyAppReady === 'function') {
      try {
        window.AndroidBridge.notifyAppReady();
      } catch (err) {
        console.warn('[AndroidBridge] notifyAppReady error:', err);
      }
    }
    const startupHint = document.getElementById('appStartupTimeoutHint');
    if (startupHint) startupHint.remove();

    // Defer PWA registration, update announcement & visitor telemetry until interactive
    loadModule('pwa', () => import('./utilities/pwa.js'))
      .then(({ registerServiceWorker, CURRENT_PWA_VERSION }) => {
        registerServiceWorker();
        try {
          const isHardPurged = sessionStorage.getItem('ds_hard_purged') === 'true';
          const lastSeenVersion = localStorage.getItem('ds_last_seen_version');

          if (isHardPurged || (lastSeenVersion && lastSeenVersion !== CURRENT_PWA_VERSION)) {
            if (isHardPurged) sessionStorage.removeItem('ds_hard_purged');
            localStorage.setItem('ds_last_seen_version', CURRENT_PWA_VERSION);
            setTimeout(() => {
              soundEngine.playAppUpdate();
              const displayVer = CURRENT_PWA_VERSION.replace('duydev-studio-', '');
              showToast(`Đã cập nhật lên phiên bản ${displayVer} thành công`, 'success');
            }, 500);
          } else if (!lastSeenVersion) {
            localStorage.setItem('ds_last_seen_version', CURRENT_PWA_VERSION);
          }
        } catch {}
      })
      .catch(() => {});

    loadModule('visitorTracker', () => import('./utilities/visitorTracker.js'))
      .then(({ visitorTracker }) => {
        visitorTracker.init();
        visitorTracker.notifyRouteChange(window.location.hash || '#dashboard');
      })
      .catch(() => {});

    // Background sync user profile and check for onboarding prompt
    syncProfileWithServer().finally(() => {
      this.checkAndPromptOnboardingProfile();
      storage.syncAllWithServer().catch(() => {});
    });

    // Cold-start share target check (handles Android native intent and Service Worker shares)
    this.checkAndOpenShareTarget();

    // Pointer/touch early pre-trigger + post-Frame-0 RAM preloader for 0ms module switching
    this.attachPointerPreloader();
    setTimeout(() => {
      this.warmAllAppModules();
    }, 40);

    // Web Share Target: listen for payloads from Service Worker
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'DS_SHARE_TARGET_PAYLOAD' && e.data.payload) {
        if (!document.getElementById('shareTargetPanel')) {
          getShareTargetModal().then(({ openShareTargetModal }) => {
            openShareTargetModal(e.data.payload);
          });
        }
      } else if (e.data?.type === 'DS_SHARE_TARGET_ARRIVED') {
        this.checkAndOpenShareTarget();
      }
    });

    // Native Android wrapper: listen for payloads arriving via AndroidBridge
    if (typeof window !== 'undefined') {
      window.addEventListener('ds:native-share-arrived', async () => {
        const panel = document.getElementById('shareTargetPanel');
        if (!panel) {
          this.checkAndOpenShareTarget();
        } else {
          const newPayload = await peekPendingSharedPayload();
          if (newPayload) {
            const { openShareTargetModal } = await getShareTargetModal();
            openShareTargetModal(newPayload);
          }
        }
      });

      // Clear any stale paused states if document is currently visible on startup
      const initialHidden = typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden');
      document.documentElement.classList.toggle('app-backgrounded', initialHidden);
      document.documentElement.classList.toggle('ds-animations-paused', initialHidden);

      // Native Android lifecycle: suspend audio/video and stop coordinator heartbeat when app pauses
      window.addEventListener('ds:native-app-paused', () => {
        document.documentElement.classList.add('app-backgrounded');
        document.documentElement.classList.add('ds-animations-paused');
        document.querySelectorAll('audio, video').forEach((media) => {
          try { media.pause(); } catch {}
        });
        taskCoordinator.stopHeartbeat();
        window.dispatchEvent(new CustomEvent('ds:visibility-change', { detail: { hidden: true } }));
      });

      // Native Android lifecycle: resume heartbeat when app returns to foreground
      window.addEventListener('ds:native-app-resumed', () => {
        document.documentElement.classList.remove('app-backgrounded');
        document.documentElement.classList.remove('ds-animations-paused');
        taskCoordinator.updateHeartbeatState();
        window.dispatchEvent(new CustomEvent('ds:visibility-change', { detail: { hidden: false } }));
      });

      // Global Page Visibility Governor: freeze animations, pause media, toggle app-backgrounded
      document.addEventListener('visibilitychange', () => {
        const isHidden = document.hidden || document.visibilityState === 'hidden';
        document.documentElement.classList.toggle('app-backgrounded', isHidden);
        document.documentElement.classList.toggle('ds-animations-paused', isHidden);
        if (isHidden) {
          document.querySelectorAll('audio, video').forEach((media) => {
            try { media.pause(); } catch {}
          });
          taskCoordinator.stopHeartbeat();
        } else {
          taskCoordinator.updateHeartbeatState();
          // Debounced multi-device history sync when user returns to app tab
          const now = Date.now();
          if (!this._lastTabSync || now - this._lastTabSync > 20000) {
            this._lastTabSync = now;
            storage.syncAllWithServer().catch(() => {});
          }
        }
        window.dispatchEvent(new CustomEvent('ds:visibility-change', { detail: { hidden: isHidden } }));
      });
    }

    // Check for pending share payload on startup
    this.checkAndOpenShareTarget();

    // Schedule non-intrusive background janitor to prune obsolete cache & orphaned shares (idle after 4s)
    setTimeout(async () => {
      try {
        const { runStorageJanitor } = await import('./utilities/storageJanitor.js');
        runStorageJanitor();
      } catch {}
    }, 4000);
  }

  attachPointerPreloader() {
    if (typeof document === 'undefined' || this._pointerPreloaderBound) return;
    this._pointerPreloaderBound = true;
    const prewarmFromEvent = (e) => {
      const target = e.target?.closest?.('a[href^="#"], [data-tool-id]');
      if (!target) return;
      const href = target.getAttribute('href') || '';
      const rawToolId = target.dataset?.toolId || (href.startsWith('#tool/') ? href.slice(6).split(/[/?]/)[0] : '');
      if (rawToolId) {
        loadModule('toolPage', () => import('./pages/ToolPage.js'))
          .then((m) => m.preloadToolModule?.(rawToolId))
          .catch(() => {});
        return;
      }
      if (href === '#storage') loadModule('storage', () => import('./pages/StoragePage.js')).catch(() => {});
      else if (href === '#history' || href === '#trash') loadModule('history', () => import('./pages/HistoryPage.js')).catch(() => {});
      else if (href === '#archive' || href === '#archive-inspect') loadModule('archive', () => import('./pages/ArchivePage.js')).catch(() => {});
      else if (href === '#settings' || href === '#server') loadModule('server', () => import('./pages/ServerPage.js')).catch(() => {});
      else if (href === '#terms') loadModule('terms', () => import('./pages/TermsPage.js')).catch(() => {});
      else if (href === '#admin') loadModule('admin', () => import('./pages/AdminPage.js')).catch(() => {});
    };
    document.addEventListener('pointerdown', prewarmFromEvent, { passive: true });
    document.addEventListener('mouseover', prewarmFromEvent, { passive: true });
  }

  async warmAllAppModules() {
    if (this._warmAllStarted) return;
    this._warmAllStarted = true;
    try {
      const toolPageMod = await loadModule('toolPage', () => import('./pages/ToolPage.js')).catch(() => null);
      const toolPreload = toolPageMod?.preloadAllToolModules ? toolPageMod.preloadAllToolModules() : Promise.resolve();
      const secondaryPreload = Promise.allSettled([
        loadModule('storage', () => import('./pages/StoragePage.js')),
        loadModule('history', () => import('./pages/HistoryPage.js')),
        loadModule('archive', () => import('./pages/ArchivePage.js')),
        loadModule('archiveCompress', () => import('./components/tools/archive/ArchiveCompressWorkspace.js')),
        loadModule('admin', () => import('./pages/AdminPage.js')),
        loadModule('server', () => import('./pages/ServerPage.js')),
        loadModule('terms', () => import('./pages/TermsPage.js')),
        loadModule('viewerConnector', () => import('./components/common/viewer/FileViewerConnector.js')),
        loadModule('viewerCore', () => import('./components/common/viewer/FileViewerCore.js')),
        loadModule('profileModal', () => import('./components/common/ProfileModal.js')),
        getShareTargetModal()
      ]);
      await Promise.allSettled([toolPreload, secondaryPreload]);
    } catch {}
  }

  checkAndPromptOnboardingProfile() {
    if (isProfileConfigured()) {
      try { localStorage.removeItem('ds_profile_needs_onboarding'); } catch {}
      syncHeaderUserProfile();
      return;
    }
    try {
      if (sessionStorage.getItem('ds_profile_prompt_dismissed') === '1') return;
    } catch {}

    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isShare = hash.startsWith('#share-target') || search.includes('hasFiles=1') || search.includes('url=') || search.includes('text=') || Boolean(typeof window !== 'undefined' && window.AndroidBridge?.getSharedPayload?.());
    const isApk = typeof window !== 'undefined' && (Boolean(window.AndroidBridge) || (typeof navigator !== 'undefined' && navigator.userAgent.includes('DuyDevStudio')) || Boolean(window.__DS_IS_APK));
    const isDeepLink = hash && hash !== '#' && hash !== '#dashboard';

    // Non-blocking deep-link, share target, and APK launch onboarding:
    // Do NOT interrupt with blocking ProfileModal. Persist flag for Header.js dot instead.
    if (isShare || isApk || isDeepLink) {
      try {
        localStorage.setItem('ds_profile_needs_onboarding', '1');
      } catch {}
      syncHeaderUserProfile();
      return;
    }

    if (document.getElementById('shareTargetPanel') || document.getElementById('dsProfileModalOverlay')) {
      return;
    }

    if (document.getElementById('dsMigrationNoticeModal')) {
      window.addEventListener('ds:modal-closed', () => this.checkAndPromptOnboardingProfile(), { once: true });
      return;
    }

    setTimeout(() => {
      if (isProfileConfigured()) return;
      if (document.getElementById('shareTargetPanel') || document.getElementById('dsProfileModalOverlay')) {
        return;
      }
      loadModule('profileModal', () => import('./components/common/ProfileModal.js'))
        .then(({ openProfileModal }) => {
          if (!document.getElementById('shareTargetPanel') && !document.getElementById('dsProfileModalOverlay') && !isProfileConfigured()) {
            openProfileModal({ isOnboarding: true });
          }
        })
        .catch(() => {});
    }, 150);
  }

  async checkAndOpenShareTarget() {
    // If modal is already open in DOM, avoid duplicate work
    if (document.getElementById('shareTargetPanel')) return;
    if (this._checkingShareTarget) return;
    this._checkingShareTarget = true;

    try {
      // 1. Extract query params from both window.location.search and window.location.hash
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const queryIndex = hash.indexOf('?');
      const hashParams = queryIndex !== -1 ? new URLSearchParams(hash.substring(queryIndex + 1)) : new URLSearchParams();

      const url = searchParams.get('url') || hashParams.get('url') || '';
      const text = searchParams.get('text') || hashParams.get('text') || '';
      const title = searchParams.get('title') || hashParams.get('title') || '';
      const hasFiles = searchParams.get('hasFiles') === '1' || hashParams.get('hasFiles') === '1';
      const isShareRoute = hash.startsWith('#share-target') || window.location.pathname.endsWith('/share-target') || hasFiles || Boolean(url || text);

      // 2. Poll with backoff if this is a share event (peeks without consuming until modal/tool consumes)
      let payload = await peekPendingSharedPayload();
      if (!payload && isShareRoute) {
        for (let i = 0; i < 4; i++) {
          if (document.getElementById('shareTargetPanel')) return;
          await new Promise(r => setTimeout(r, 120));
          payload = await peekPendingSharedPayload();
          if (payload) break;
        }
      }

      // Check again if modal was opened while waiting
      if (document.getElementById('shareTargetPanel')) return;

      // 3. Fallback to URL parameters if no stored payload
      if (!payload && (url || text || title)) {
        payload = { url, text, title, files: [] };
      }

      // 4. Merge URL parameters into payload if missing
      if (payload) {
        if (!payload.url && url) payload.url = url;
        if (!payload.text && text) payload.text = text;
        if (!payload.title && title) payload.title = title;
      }

      if (!payload) {
        if (!document.getElementById('fastPathSharePlaceholder') &&
            (window.location.hash === '#share-target' || window.location.hash.startsWith('#share-target?'))) {
          history.replaceState(null, '', window.location.pathname);
        }
        return;
      }

      // Fast-path: When sharing plain-text Scribd or TikTok URL, bypass manual modal friction
      if (!payload.files || payload.files.length === 0) {
        const smart = detectSmartRoute(payload.url || payload.text || '');
        if (smart) {
          if (payload.payloadId) {
            consumePendingSharedPayload(payload.payloadId);
          }
          if (window.location.hash.startsWith('#share-target')) {
            history.replaceState(null, '', window.location.pathname);
          }
          handoffSmartUrl(smart);
          return;
        }
      }

      if (!document.getElementById('shareTargetPanel')) {
        const { openShareTargetModal } = await getShareTargetModal();
        openShareTargetModal(payload);
      }
    } finally {
      this._checkingShareTarget = false;
    }
  }

  renderShell() {
    // Ensure globalShareTargetContainer exists on body outside appRoot so modal survives route re-renders
    if (!document.getElementById('globalShareTargetContainer')) {
      const shareTargetEl = document.createElement('div');
      shareTargetEl.id = 'globalShareTargetContainer';
      document.body.appendChild(shareTargetEl);
    }

    // Ensure globalSlideConfirmContainer exists on body outside appRoot so modal is never trapped in containing blocks
    if (!document.getElementById('globalSlideConfirmContainer')) {
      const slideConfirmEl = document.createElement('div');
      slideConfirmEl.id = 'globalSlideConfirmContainer';
      slideConfirmEl.innerHTML = renderSlideConfirmModal();
      document.body.appendChild(slideConfirmEl);
    }

    // Zero-Swap In-Place Hydration Check:
    // If the pixel-identical instant shell is already pre-rendered into the DOM (from index.html),
    // preserve the entire DOM tree and attach event listeners in-place without flashing.
    const existingHeader = document.getElementById('headerContainer');
    const existingMain = document.getElementById('mainContent');
    const existingFooter = document.getElementById('footerContainer');
    const isShellPreRendered = existingHeader && existingMain && existingFooter && existingHeader.children.length > 0;

    if (!isShellPreRendered) {
      this.appRoot.innerHTML = `
        <div class="min-h-screen flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200 w-full max-w-full overflow-x-clip">
          <div id="headerContainer" class="w-full"></div>
          <main id="mainContent" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 pt-4 pb-36 sm:pt-8 sm:pb-20 lg:pb-24 min-w-0 overflow-x-clip"></main>
          <div id="footerContainer" class="w-full"></div>
          <div id="bottomNavContainer"></div>
          <div id="globalPreviewContainer"></div>
          <div id="globalTaskDockContainer"></div>
        </div>
      `;

      // Render header and footer
      document.getElementById('headerContainer').innerHTML = renderHeader();
      document.getElementById('footerContainer').innerHTML = renderFooter();
    } else {
      // Refresh header markup & profile state in-place
      try {
        existingHeader.innerHTML = renderHeader();
        syncHeaderUserProfile();
      } catch (_) {}
    }

    attachHeaderListeners((query) => {
      toolRegistry.setSearchQuery(query);
      if (window.location.hash !== '' && window.location.hash !== '#') {
        window.location.hash = '';
      } else {
        this.renderCurrentView();
      }
    });
  }

  async handleRoute() {
    try {
      const hash = window.location.hash;
      if (_lazyModules.visitorTracker) {
        _lazyModules.visitorTracker
          .then(({ visitorTracker }) => visitorTracker.notifyRouteChange(hash || '#dashboard'))
          .catch(() => {});
      }
      const isPdfView = hash.startsWith('#view/pdf') || hash.startsWith('#preview/pdf') || hash.startsWith('#reader/pdf');
      if (!isPdfView && (_lazyModules.viewerConnector || _lazyModules.viewerCore)) {
        loadModule('viewerCore', () => import('./components/common/viewer/FileViewerCore.js'))
          .then(({ closeFileViewer }) => closeFileViewer())
          .catch(() => {});
      }
      this.cleanupCurrentView();
      this.checkAndPromptOnboardingProfile();

      // Web Share Target route — open modal over base dashboard view
      if (hash === '#share-target' || hash.startsWith('#share-target?')) {
        await this.renderCurrentView();
        this.checkAndOpenShareTarget();
        return;
      }

      // Direct Deep-Link to DD Studio Core PDF Reader (#view/pdf?file=...)
      if (hash.startsWith('#view/pdf') || hash.startsWith('#preview/pdf') || hash.startsWith('#reader/pdf')) {
        const queryStr = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
        const params = new URLSearchParams(queryStr);
        const fileParam = params.get('file') || '';
        const nameParam = params.get('name') || '';
        if (fileParam) {
          try {
            const fileUrl = fileParam;
            const qMatch = fileUrl.match(/[?&]file=([^&#]+)/);
            let rawName = nameParam || (qMatch ? qMatch[1] : (fileUrl.split('/').pop()?.split('?')[0] || 'Tài liệu PDF'));
            let fileName = rawName;
            try { fileName = decodeURIComponent(rawName); } catch {}
            if (!fileName.includes('.')) fileName += '.pdf';
            let downloadUrl = fileUrl;
            if (fileUrl.includes('/api/v1/studocu/')) {
              downloadUrl = `/api/v1/studocu/download/${encodeURIComponent(fileName)}`;
            } else if (fileUrl.includes('/api/v1/storage/download')) {
              downloadUrl = fileUrl.replace(/([?&])inline=true(&|$)/, (m, p1, p2) => {
                if (p1 === '?' && p2 === '&') return '?';
                if (p1 === '&') return p2 ? '&' : '';
                return '';
              });
            } else {
              downloadUrl = fileUrl.replace('/api/v1/files/view/', '/api/v1/files/download/');
            }
            loadModule('viewerConnector', () => import('./components/common/viewer/FileViewerConnector.js'))
              .then(({ ViewerConnector }) => ViewerConnector.preview({
                name: fileName,
                fileName,
                category: 'pdf',
                mimeType: 'application/pdf',
                viewUrl: fileUrl,
                downloadUrl
              }))
              .catch(() => {});
          } catch (deepLinkErr) {
            console.warn('[Router] Failed to parse PDF deep-link URL:', deepLinkErr);
          }
        }
      }

      // Update bottom nav active state (Preserve pre-rendered bottom nav on initial dashboard load)
      const bottomNav = document.getElementById('bottomNavContainer');
      const isDashboardRoute = (!hash || hash === '#' || hash === '#dashboard');
      if (bottomNav) {
        if (!isDashboardRoute || bottomNav.children.length === 0) {
          bottomNav.innerHTML = renderBottomNav(hash);
        }
      }

      await this.renderCurrentView();
      updateThemeUI(getStoredTheme());
      window.scrollTo(0, 0);
      if (window.lucide) {
        try { window.lucide.createIcons(); } catch {}
      }
    } catch (err) {
      console.error('[Router] Error rendering route:', err);
      const mainContainer = document.getElementById('mainContent');
      if (mainContainer) {
        const errorMsg = err?.stack || err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || 'Lỗi không xác định';
        mainContainer.innerHTML = `
          <div class="p-6 rounded-2xl bg-white dark:bg-[#121215] border border-red-500/30 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
            <h3 class="text-red-500 font-bold text-base">Lỗi hiển thị trang</h3>
            <div class="p-3 bg-zinc-100 dark:bg-black/40 rounded-xl text-left font-mono text-xs text-zinc-700 dark:text-zinc-300 max-h-40 overflow-y-auto break-all">
              ${errorMsg}
            </div>
            <div class="flex items-center justify-center gap-3">
              <button onclick="localStorage.removeItem('ds_last_route'); window.location.hash = ''; window.location.reload();" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer">Về trang chủ</button>
              <button onclick="window.location.reload()" class="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-white text-xs font-semibold cursor-pointer">Tải lại</button>
            </div>
          </div>
        `;
      }
    }
  }

  cleanupCurrentView() {
    if (typeof _stopAdminPolling === 'function') _stopAdminPolling();
    if (typeof window !== 'undefined' && typeof window.__unmountCurrentTool === 'function') {
      try {
        window.__unmountCurrentTool();
        window.__unmountCurrentTool = null;
      } catch (e) {
        console.warn('[Router] unmountCurrentTool error:', e);
      }
    }
    if (toolRegistry && typeof toolRegistry.disconnectResizeObserver === 'function') {
      toolRegistry.disconnectResizeObserver();
    }
    this.currentCleanups.forEach(fn => typeof fn === 'function' && fn());
    this.currentCleanups = [];
  }

  async renderCurrentView(isSoftUpdate = false) {
    this.cleanupCurrentView();
    this._navigationSeq = (this._navigationSeq || 0) + 1;
    const currentSeq = this._navigationSeq;

    const hash = window.location.hash;
    if (hash === '#image' || hash === '#tool/image-converter' || hash === '#tool/video-audio') {
      window.location.replace('#tool/universal-converter');
      return;
    }
    if (hash === '#tool/pdf-merge' || hash === '#pdf/merge') return window.location.replace('#tool/pdf-studio/merge');
    if (hash === '#tool/pdf-lock' || hash === '#pdf/security' || hash === '#pdf/lock') return window.location.replace('#tool/pdf-studio/security');
    if (hash === '#tool/pdf-split' || hash === '#pdf/split') return window.location.replace('#tool/pdf-studio/split');
    if (hash === '#pdf' || hash === '#tool/pdf-convert') return window.location.replace('#tool/pdf-studio');
    const mainContainer = document.getElementById('mainContent');
    const onSoftReRender = () => this.renderCurrentView(true);

    let cleanup = null;
    const setView = (content, attachFn = null) => {
      const prevScrollY = isSoftUpdate ? window.scrollY : 0;
      mainContainer.innerHTML = isSoftUpdate ? content.replace(/\banimate-fadeIn\b/g, '') : content;
      cleanup = typeof attachFn === 'function' ? attachFn() : attachFn;
      if (cleanup && !this.currentCleanups.includes(cleanup)) {
        this.currentCleanups.push(cleanup);
      }
      if (isSoftUpdate && prevScrollY > 0) {
        window.scrollTo({ top: prevScrollY, behavior: 'instant' });
      }
    };
    const dispatchTool = async (id, sub = null) => {
      const toolPageMod = _resolvedModules.toolPage;
      if (toolPageMod && toolPageMod.getResolvedToolModule?.(id)) {
        const syncContent = toolPageMod.renderToolPageSync(id, sub);
        if (syncContent !== null) {
          setView(syncContent, () => toolPageMod.attachToolPageListeners(onSoftReRender));
          if (window.lucide) {
            try { window.lucide.createIcons({ root: mainContainer }); } catch { window.lucide.createIcons(); }
          }
          return;
        }
      }

      const tool = toolRegistry.getToolById(id);
      if (!isSoftUpdate && mainContainer) {
        if (toolPageMod?.renderToolLoadingSkeleton) {
          mainContainer.innerHTML = toolPageMod.renderToolLoadingSkeleton(tool);
        } else if (_lazyModules.toolPage) {
          try {
            const { renderToolLoadingSkeleton } = await _lazyModules.toolPage;
            mainContainer.innerHTML = renderToolLoadingSkeleton(tool);
          } catch {}
        } else {
          mainContainer.innerHTML = `
            <div class="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <div class="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <span class="text-xs font-mono">Đang tải ${tool?.name || 'công cụ'}...</span>
            </div>
          `;
        }
        if (window.lucide) {
          try { window.lucide.createIcons({ root: mainContainer }); } catch { window.lucide.createIcons(); }
        }
      }

      try {
        const { renderToolPage, attachToolPageListeners } = await loadModule('toolPage', () => import('./pages/ToolPage.js'));
        if (currentSeq !== this._navigationSeq) return;
        const content = await renderToolPage(id, sub);
        if (currentSeq !== this._navigationSeq) return;
        setView(content, () => attachToolPageListeners(onSoftReRender));
        if (window.lucide) {
          try { window.lucide.createIcons({ root: mainContainer }); } catch { window.lucide.createIcons(); }
        }
      } catch (err) {
        if (currentSeq !== this._navigationSeq) return;
        console.error('[Router] Error loading tool:', id, err);
      }
    };

    const mountLazyView = async (key, importer, getHtml, getAttach) => {
      if (_resolvedModules[key]) {
        const mod = _resolvedModules[key];
        setView(getHtml(mod), getAttach(mod));
        return;
      }
      if (!isSoftUpdate && mainContainer) {
        mainContainer.innerHTML = `
          <div class="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div class="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <span class="text-xs font-mono">Đang tải...</span>
          </div>
        `;
      }
      const mod = await loadModule(key, importer);
      if (currentSeq !== this._navigationSeq) return;
      setView(getHtml(mod), getAttach(mod));
    };

    if (!hash || hash === '#' || hash === '#dashboard' || hash === '#share-target' || hash.startsWith('#share-target?') || hash.startsWith('#view/pdf') || hash.startsWith('#preview/pdf') || hash.startsWith('#reader/pdf')) {
      // In-place zero-swap hydration: if dashboard is already mounted statically in mainContainer and this is not a soft update
      const existingGrid = !isSoftUpdate && mainContainer && mainContainer.querySelector('#toolsGridContainer');
      if (existingGrid) {
        cleanup = attachDashboardListeners(onSoftReRender);
        if (cleanup && !this.currentCleanups.includes(cleanup)) this.currentCleanups.push(cleanup);
        return;
      }
      setView(renderDashboardPage(), () => attachDashboardListeners(onSoftReRender));
    } else if (hash.startsWith('#tool/')) {
      const cleanHash = hash.replace('#tool/', '');
      const [pathPart, queryPart] = cleanHash.split('?');
      const parts = pathPart.split('/');
      await dispatchTool(parts[0], parts[1] || null);
      if (parts[0] === 'tiktok-downloader' || parts[0] === 'tiktok') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          import('./components/tools/tiktok/hooks/useTiktok.js').then(({ tiktokManager }) => {
            tiktokManager.setUrl(targetUrl, false);
            tiktokManager.resolve(targetUrl);
          });
        }
      } else if (parts[0] === 'youtube-downloader' || parts[0] === 'youtube') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          import('./components/tools/youtube/hooks/useYoutube.js').then(({ youtubeManager }) => {
            youtubeManager.setUrl(targetUrl);
            youtubeManager.resolve(targetUrl);
          });
        }
      } else if (parts[0] === 'facebook-downloader' || parts[0] === 'facebook') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          setTimeout(() => {
            const input = document.getElementById('fbUrlInput');
            if (input) {
              input.value = targetUrl;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const btn = document.querySelector('[data-action="resolve"]');
              if (btn) btn.click();
            }
          }, 100);
        }
      } else if (parts[0] === 'instagram-downloader' || parts[0] === 'instagram') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          setTimeout(() => {
            const input = document.getElementById('igUrlInput');
            if (input) {
              input.value = targetUrl;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const btn = document.querySelector('[data-action="resolve"]');
              if (btn) btn.click();
            }
          }, 100);
        }
      } else if (parts[0] === 'spotify-downloader' || parts[0] === 'spotify') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          setTimeout(() => {
            const input = document.getElementById('spUrlInput');
            if (input) {
              input.value = targetUrl;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const btn = document.querySelector('[data-action="resolve"]');
              if (btn) btn.click();
            }
          }, 100);
        }
      } else if (parts[0] === 'academia-downloader' || parts[0] === 'academia') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          setTimeout(() => {
            const input = document.getElementById('acUrlInput');
            if (input) {
              input.value = targetUrl;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const btn = document.getElementById('btnResolveAc');
              if (btn) btn.click();
            }
          }, 100);
        }
      } else if (parts[0] === 'researchgate-downloader' || parts[0] === 'researchgate') {
        const queryParams = new URLSearchParams(queryPart || window.location.search);
        const targetUrl = queryParams.get('url');
        if (targetUrl) {
          setTimeout(() => {
            const input = document.getElementById('rgUrlInput');
            if (input) {
              input.value = targetUrl;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const btn = document.getElementById('btnResolveRg');
              if (btn) btn.click();
            }
          }, 100);
        }
      }
    } else if (hash === '#qr' || hash.startsWith('#qr/')) {
      await dispatchTool('qr-multi', hash.startsWith('#qr/') ? hash.replace('#qr/', '') : null);
    } else if (hash === '#scan' || hash === '#qr-scan') {
      await dispatchTool('qr-scan');
    } else if (hash === '#hash') {
      await dispatchTool('hash-checksum');
    } else if (hash === '#markdown') {
      await dispatchTool('markdown-docs');
    } else if (hash === '#pdf' || hash === '#pdf-studio' || hash.startsWith('#pdf/')) {
      await dispatchTool('pdf-studio', hash.startsWith('#pdf/') ? hash.replace('#pdf/', '') : null);
    } else if (hash === '#converter' || hash === '#universal-converter') {
      await dispatchTool('universal-converter');
    } else if (hash === '#studocu' || hash === '#studocu-dl') {
      await dispatchTool('studocu-dl');
    } else if (hash === '#scribd' || hash === '#scribd-archiver' || hash.startsWith('#scribd?') || hash.startsWith('#scribd-archiver?')) {
      await dispatchTool('scribd');
    } else if (hash === '#tiktok' || hash === '#tiktok-downloader' || hash.startsWith('#tiktok?') || hash.startsWith('#tiktok-downloader?')) {
      await dispatchTool('tiktok-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        import('./components/tools/tiktok/hooks/useTiktok.js').then(({ tiktokManager }) => {
          tiktokManager.setUrl(targetUrl, false);
          tiktokManager.resolve(targetUrl);
        });
      }
    } else if (hash === '#youtube' || hash === '#youtube-downloader' || hash.startsWith('#youtube?') || hash.startsWith('#youtube-downloader?')) {
      await dispatchTool('youtube-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        import('./components/tools/youtube/hooks/useYoutube.js').then(({ youtubeManager }) => {
          youtubeManager.setUrl(targetUrl);
          youtubeManager.resolve(targetUrl);
        });
      }
    } else if (hash === '#facebook' || hash === '#facebook-downloader' || hash.startsWith('#facebook?') || hash.startsWith('#facebook-downloader?')) {
      await dispatchTool('facebook-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        setTimeout(() => {
          const input = document.getElementById('fbUrlInput');
          if (input) {
            input.value = targetUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = document.querySelector('[data-action="resolve"]');
            if (btn) btn.click();
          }
        }, 100);
      }
    } else if (hash === '#instagram' || hash === '#instagram-downloader' || hash.startsWith('#instagram?') || hash.startsWith('#instagram-downloader?')) {
      await dispatchTool('instagram-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        setTimeout(() => {
          const input = document.getElementById('igUrlInput');
          if (input) {
            input.value = targetUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = document.querySelector('[data-action="resolve"]');
            if (btn) btn.click();
          }
        }, 100);
      }
    } else if (hash === '#spotify' || hash === '#spotify-downloader' || hash.startsWith('#spotify?') || hash.startsWith('#spotify-downloader?')) {
      await dispatchTool('spotify-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        setTimeout(() => {
          const input = document.getElementById('spUrlInput');
          if (input) {
            input.value = targetUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = document.querySelector('[data-action="resolve"]');
            if (btn) btn.click();
          }
        }, 100);
      }
    } else if (hash === '#slideshare' || hash === '#slideshare-downloader' || hash.startsWith('#slideshare?') || hash.startsWith('#slideshare-downloader?')) {
      await dispatchTool('slideshare-downloader');
    } else if (hash === '#academia' || hash === '#academia-downloader' || hash.startsWith('#academia?') || hash.startsWith('#academia-downloader?')) {
      await dispatchTool('academia-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        setTimeout(() => {
          const input = document.getElementById('acUrlInput');
          if (input) {
            input.value = targetUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = document.getElementById('btnResolveAc');
            if (btn) btn.click();
          }
        }, 100);
      }
    } else if (hash === '#researchgate' || hash === '#researchgate-downloader' || hash.startsWith('#researchgate?') || hash.startsWith('#researchgate-downloader?')) {
      await dispatchTool('researchgate-downloader');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : window.location.search;
      const queryParams = new URLSearchParams(queryPart);
      const targetUrl = queryParams.get('url');
      if (targetUrl) {
        setTimeout(() => {
          const input = document.getElementById('rgUrlInput');
          if (input) {
            input.value = targetUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const btn = document.getElementById('btnResolveRg');
            if (btn) btn.click();
          }
        }, 100);
      }
    } else if (hash === '#view-split' || hash.startsWith('#view-split/') || hash === '#split' || hash.startsWith('#split/')) {
      await dispatchTool('view-split', hash.includes('/') ? hash.split('/')[1] : null);
    } else if (hash === '#quiz' || hash === '#quiz-generator' || hash === '#tao-bai-tap' || hash === '#tao-bai-tap-trac-nghiem') {
      await dispatchTool('quiz-generator');
    } else if (hash === '#archive' || hash === '#archive-inspect') {
      await mountLazyView('archive', () => import('./pages/ArchivePage.js'), (m) => m.renderArchivePage(), (m) => () => m.attachArchivePageListeners(onSoftReRender));
    } else if (hash === '#server-archive' || hash === '#compress-archive') {
      await mountLazyView('archiveCompress', () => import('./components/tools/archive/ArchiveCompressWorkspace.js'), (m) => m.renderArchiveCompressWorkspace(), (m) => () => m.attachArchiveCompressListeners(onSoftReRender));
    } else if (hash === '#history' || hash === '#trash') {
      await mountLazyView('history', () => import('./pages/HistoryPage.js'), (m) => m.renderHistoryPage(hash === '#trash' ? 'trash' : 'history'), (m) => () => m.attachHistoryPageListeners(onSoftReRender));
    } else if (hash === '#storage' || hash.startsWith('#storage/') || hash.startsWith('#storage?')) {
      await mountLazyView('storage', () => import('./pages/StoragePage.js'), (m) => m.renderStoragePage(), (m) => () => m.attachStoragePageListeners(onSoftReRender));
    } else if (hash === '#admin' || hash === '#admin-dashboard' || hash === '#telemetry' || hash === '#monitoring') {
      await mountLazyView('admin', () => import('./pages/AdminPage.js'), (m) => { _stopAdminPolling = m.stopAdminPolling; return m.renderAdminPage(); }, (m) => () => m.attachAdminPageListeners(onSoftReRender));
    } else if (hash === '#settings' || hash === '#server') {
      await mountLazyView('server', () => import('./pages/ServerPage.js'), (m) => m.renderServerPage(), (m) => () => m.attachServerPageListeners(onSoftReRender));
    } else if (hash === '#terms' || hash === '#terms-of-service' || hash === '#dieu-khoan') {
      await mountLazyView('terms', () => import('./pages/TermsPage.js'), (m) => m.renderTermsPage(), (m) => () => m.attachTermsPageListeners(onSoftReRender));
    } else {
      const canHydrateInPlace =
        !isSoftUpdate &&
        !this._dashboardHydratedOnce &&
        toolRegistry.currentCategory === 'all' &&
        !toolRegistry.searchQuery &&
        document.getElementById('toolsGridContainer') &&
        document.getElementById('dashboardCategoryBarContainer');

      if (canHydrateInPlace) {
        cleanup = attachDashboardListeners(onSoftReRender);
        if (cleanup && !this.currentCleanups.includes(cleanup)) {
          this.currentCleanups.push(cleanup);
        }
      } else {
        setView(renderDashboardPage(), () => attachDashboardListeners(onSoftReRender));
      }
      this._dashboardHydratedOnce = true;
    }

    if (cleanup && !this.currentCleanups.includes(cleanup)) this.currentCleanups.push(cleanup);
    if (window.lucide) {
      try { window.lucide.createIcons(); } catch {}
    }
  }
}

// Expose global Universal File Viewer lazy bridge for tools and deep-links
const getViewerConnector = () =>
  loadModule('viewerConnector', () => import('./components/common/viewer/FileViewerConnector.js'))
    .then((m) => m.ViewerConnector);

if (typeof window !== 'undefined') {
  window.ViewerConnector = {
    preview: (...args) => getViewerConnector().then((vc) => vc.preview(...args)),
    open: (...args) => getViewerConnector().then((vc) => vc.open(...args)),
    openViewer: (...args) => getViewerConnector().then((vc) => vc.openViewer(...args)),
    previewBlob: (...args) => getViewerConnector().then((vc) => vc.previewBlob(...args)),
    viewerFetch: (...args) => getViewerConnector().then((vc) => vc.viewerFetch(...args))
  };
  window.openFileViewer = (item, options) => window.ViewerConnector.preview(item, options);
  window.__ds_fileViewer = {
    open: (item, options) => window.ViewerConnector.preview(item, options),
    preview: (item, options) => window.ViewerConnector.preview(item, options)
  };

  // Android Native bridge: Intercept any <a download> clicks to route through AndroidBridge.downloadFile
  let lastNativeDownloadTimestamp = 0;
  let lastNativeDownloadHref = '';
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;

    const link = e.target.closest('a[download]');
    if (link && window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const now = Date.now();
        if (now - lastNativeDownloadTimestamp < 1500 && lastNativeDownloadHref === href) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        lastNativeDownloadTimestamp = now;
        lastNativeDownloadHref = href;

        e.preventDefault();
        e.stopPropagation();

        let fileName = link.getAttribute('download') || link.download;
        if (!fileName || fileName === 'true' || fileName === 'download') {
          try {
            const urlObj = new URL(href, window.location.href);
            const queryName = urlObj.searchParams.get('filename') || urlObj.searchParams.get('name') || urlObj.searchParams.get('file');
            if (queryName) {
              fileName = queryName;
            } else {
              fileName = urlObj.pathname.split('/').filter(Boolean).pop() || 'download';
            }
          } catch (_) {
            fileName = href.split('/').pop()?.split('?')[0] || 'download';
          }
        }
        window.AndroidBridge.downloadFile(href, fileName);
      }
    }
  });
}

// Start Application on DOM Ready
async function boot() {
  try {
    const app = new App();
    await app.init();
  } catch (err) {
    console.error('App initialization error:', err);
    const root = document.getElementById('app');
    if (root) {
      const errorMsg = err?.stack || err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || 'Lỗi không xác định';
      root.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white font-mono">
          <div class="max-w-md w-full p-6 rounded-2xl bg-zinc-900 border border-red-500/30 text-center space-y-4 shadow-xl">
            <h2 class="text-red-400 font-bold text-lg">Lỗi khởi động giao diện</h2>
            <div class="p-3 bg-black/50 rounded-xl border border-white/10 text-left overflow-x-auto max-h-48 text-[11px] text-red-300 font-mono select-all break-all leading-relaxed">
              ${errorMsg}
            </div>
            <div class="flex items-center justify-center gap-2 pt-2">
              <button onclick="localStorage.removeItem('ds_last_route'); localStorage.removeItem('ds_state_qr'); window.location.hash = ''; window.location.reload();" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold cursor-pointer transition">
                Về trang chủ
              </button>
              <button onclick="window.location.reload()" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white cursor-pointer transition">
                Tải lại
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
