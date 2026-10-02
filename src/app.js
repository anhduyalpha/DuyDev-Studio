/**
 * DuyDev Studio - Application Bootstrapper & Router
 * Dark Professional Minimalism
 */

import { initTheme, updateThemeUI, getStoredTheme } from './hooks/useTheme.js';
import { registerServiceWorker } from './utilities/pwa.js';
import { toolRegistry } from './hooks/useToolRegistry.js';
import { clearModuleState, clearAllModuleStates } from './utilities/moduleState.js';

// Layout components
import { renderHeader, attachHeaderListeners } from './components/layout/Header.js';
import { renderBottomNav } from './components/layout/BottomNav.js';
import { renderFooter } from './components/layout/Footer.js';
import { initGlobalTaskDock } from './components/layout/GlobalTaskDock.js';
import { taskCoordinator } from './utilities/taskCoordinator.js';

// Pages
import { renderDashboardPage, attachDashboardListeners } from './pages/DashboardPage.js';
import { renderToolPage, attachToolPageListeners } from './pages/ToolPage.js';
import { renderArchivePage, attachArchivePageListeners } from './pages/ArchivePage.js';
import { renderArchiveCompressWorkspace, attachArchiveCompressListeners } from './components/tools/archive/ArchiveCompressWorkspace.js';
import { renderHistoryPage, attachHistoryPageListeners } from './pages/HistoryPage.js';
import { renderServerPage, attachServerPageListeners } from './pages/ServerPage.js';
import { renderStoragePage, attachStoragePageListeners } from './pages/StoragePage.js';
import { renderTermsPage, attachTermsPageListeners } from './pages/TermsPage.js';
import { ViewerConnector } from './components/common/viewer/FileViewerConnector.js';
import { closeFileViewer } from './components/common/viewer/FileViewerCore.js';
import { renderSlideConfirmModal } from './components/common/SlideConfirmModal.js';
import { retrievePendingSharedData } from './utilities/shareTargetHelper.js';
import { openShareTargetModal } from './components/common/ShareTargetModal.js';

class App {
  constructor() {
    this.currentCleanups = [];
    this.appRoot = document.getElementById('app');
  }

  init() {
    initTheme();
    registerServiceWorker();
    taskCoordinator.init();

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
    initGlobalTaskDock();
    this.handleRoute();
    try { sessionStorage.removeItem('ds_auto_recovered'); } catch {}

    // Signal app readiness for any fast-path queued interactions
    window.__dsAppReady = true;
    window.dispatchEvent(new CustomEvent('ds:app-ready'));

    // Web Share Target: listen for payloads from Service Worker
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'DS_SHARE_TARGET_PAYLOAD' && e.data.payload) {
        if (!document.getElementById('shareTargetPanel')) {
          openShareTargetModal(e.data.payload);
        }
      } else if (e.data?.type === 'DS_SHARE_TARGET_ARRIVED') {
        this.checkAndOpenShareTarget();
      }
    });

    // Native Android wrapper: listen for payloads arriving via AndroidBridge
    if (typeof window !== 'undefined') {
      window.addEventListener('ds:native-share-arrived', () => {
        this.checkAndOpenShareTarget();
      });

      // Pause active media when browser/tab/app moves to background
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          document.querySelectorAll('audio, video').forEach((media) => {
            try { media.pause(); } catch {}
          });
        }
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

      // 2. Poll IndexedDB with backoff if this is a share event (prevents race condition with SW write)
      let payload = await retrievePendingSharedData();
      if (!payload && isShareRoute) {
        for (let i = 0; i < 4; i++) {
          if (document.getElementById('shareTargetPanel')) return;
          await new Promise(r => setTimeout(r, 120));
          payload = await retrievePendingSharedData();
          if (payload) break;
        }
      }

      // Check again if modal was opened while waiting
      if (document.getElementById('shareTargetPanel')) return;

      // 3. Fallback to URL parameters if IndexedDB had no files
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

      if (!document.getElementById('shareTargetPanel')) {
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

    this.appRoot.innerHTML = `
      <div class="min-h-screen flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200 w-full max-w-full overflow-x-hidden">
        <div id="headerContainer" class="w-full"></div>
        <main id="mainContent" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 pt-4 pb-36 sm:py-8 min-w-0 overflow-x-hidden"></main>
        <div id="footerContainer" class="w-full"></div>
        <div id="bottomNavContainer"></div>
        <div id="globalPreviewContainer"></div>
        <div id="globalTaskDockContainer"></div>
        <div id="globalSlideConfirmContainer">${renderSlideConfirmModal()}</div>
      </div>
    `;

    // Render header and footer
    document.getElementById('headerContainer').innerHTML = renderHeader();
    document.getElementById('footerContainer').innerHTML = renderFooter();

    attachHeaderListeners((query) => {
      toolRegistry.setSearchQuery(query);
      if (window.location.hash !== '' && window.location.hash !== '#') {
        window.location.hash = '';
      } else {
        this.renderCurrentView();
      }
    });
  }

  handleRoute() {
    try {
      const hash = window.location.hash;
      const isPdfView = hash.startsWith('#view/pdf') || hash.startsWith('#preview/pdf') || hash.startsWith('#reader/pdf');
      if (!isPdfView) {
        closeFileViewer();
      }
      this.cleanupCurrentView();

      // Web Share Target route — open modal over base dashboard view
      if (hash === '#share-target' || hash.startsWith('#share-target?')) {
        this.renderCurrentView();
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
            ViewerConnector.preview({
              name: fileName,
              fileName,
              category: 'pdf',
              mimeType: 'application/pdf',
              viewUrl: fileUrl,
              downloadUrl
            });
          } catch (deepLinkErr) {
            console.warn('[Router] Failed to parse PDF deep-link URL:', deepLinkErr);
          }
        }
      }

      // Update bottom nav active state
      const bottomNav = document.getElementById('bottomNavContainer');
      if (bottomNav) bottomNav.innerHTML = renderBottomNav(hash);

      this.renderCurrentView();
      updateThemeUI(getStoredTheme());
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.lucide) window.lucide.createIcons();
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
    this.currentCleanups.forEach(fn => typeof fn === 'function' && fn());
    this.currentCleanups = [];
  }

  renderCurrentView(isSoftUpdate = false) {
    this.cleanupCurrentView();
    const hash = window.location.hash;
    if (hash === '#image' || hash === '#media' || hash === '#tool/image-converter' || hash === '#tool/video-audio') {
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
      if (isSoftUpdate && prevScrollY > 0) {
        window.scrollTo({ top: prevScrollY, behavior: 'instant' });
      }
    };
    const dispatchTool = (id, sub = null) => {
      setView(renderToolPage(id, sub), () => attachToolPageListeners(onSoftReRender));
    };

    if (!hash || hash === '#' || hash === '#dashboard' || hash === '#share-target' || hash.startsWith('#share-target?') || hash.startsWith('#view/pdf') || hash.startsWith('#preview/pdf') || hash.startsWith('#reader/pdf')) {
      setView(renderDashboardPage(), () => attachDashboardListeners(onSoftReRender));
    } else if (hash.startsWith('#tool/')) {
      const parts = hash.replace('#tool/', '').split('/');
      dispatchTool(parts[0], parts[1] || null);
    } else if (hash === '#qr' || hash.startsWith('#qr/')) {
      dispatchTool('qr-multi', hash.startsWith('#qr/') ? hash.replace('#qr/', '') : null);
    } else if (hash === '#scan' || hash === '#qr-scan') {
      dispatchTool('qr-scan');
    } else if (hash === '#hash') {
      dispatchTool('hash-checksum');
    } else if (hash === '#markdown') {
      dispatchTool('markdown-docs');
    } else if (hash === '#pdf' || hash === '#pdf-studio' || hash.startsWith('#pdf/')) {
      dispatchTool('pdf-studio', hash.startsWith('#pdf/') ? hash.replace('#pdf/', '') : null);
    } else if (hash === '#converter' || hash === '#universal-converter') {
      dispatchTool('universal-converter');
    } else if (hash === '#studocu' || hash === '#studocu-dl') {
      dispatchTool('studocu-dl');
    } else if (hash === '#quiz' || hash === '#quiz-generator' || hash === '#tao-bai-tap' || hash === '#tao-bai-tap-trac-nghiem') {
      dispatchTool('quiz-generator');
    } else if (hash === '#archive' || hash === '#archive-inspect') {
      setView(renderArchivePage(), () => attachArchivePageListeners(onSoftReRender));
    } else if (hash === '#server-archive' || hash === '#compress-archive') {
      setView(renderArchiveCompressWorkspace(), () => attachArchiveCompressListeners(onSoftReRender));
    } else if (hash === '#history' || hash === '#trash') {
      setView(renderHistoryPage(hash === '#trash' ? 'trash' : 'history'), () => attachHistoryPageListeners(onSoftReRender));
    } else if (hash === '#storage' || hash.startsWith('#storage/') || hash.startsWith('#storage?')) {
      setView(renderStoragePage(), () => attachStoragePageListeners(onSoftReRender));
    } else if (hash === '#settings' || hash === '#server' || hash === '#admin') {
      setView(renderServerPage(), () => attachServerPageListeners(onSoftReRender));
    } else if (hash === '#terms' || hash === '#terms-of-service' || hash === '#dieu-khoan') {
      setView(renderTermsPage(), () => attachTermsPageListeners(onSoftReRender));
    } else {
      setView(renderDashboardPage(), () => attachDashboardListeners(onSoftReRender));
    }

    if (cleanup) this.currentCleanups.push(cleanup);
    if (window.lucide) window.lucide.createIcons();
  }
}

// Start Application on DOM Ready
function boot() {
  try {
    const app = new App();
    app.init();
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
