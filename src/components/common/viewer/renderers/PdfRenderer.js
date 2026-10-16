/**
 * PdfRenderer Component (< 230 lines)
 * Modern Native DD Studio Canvas PDF Reader Orchestrator v2.0
 */

import { renderFloatingDock, attachFloatingDockListeners, updateFloatingDockState } from './pdf/PdfFloatingDock.js';
import { renderSidebarDrawer, toggleSidebarDrawer, attachSidebarListeners, updateActiveSidebarPage, destroySidebarDrawer } from './pdf/PdfSidebarDrawer.js';
import { renderSearchBar, toggleSearchBar, updateSearchBarMatchCount, attachSearchBarListeners, PdfSearchEngine } from './pdf/PdfSearchBar.js';
import { renderPasswordModal, promptPdfPassword, closePasswordModal } from './pdf/PdfPasswordModal.js';
import { PdfCanvasViewer } from './pdf/PdfCanvasViewer.js';
import { ensurePdfJsLoaded } from '../../../../utilities/pdfJsHelper.js';

async function resolveOutlinePages(doc, items) {
  if (!items || !Array.isArray(items)) return [];
  const result = [];
  for (const item of items) {
    let pageNum = null;
    try {
      let dest = item.dest;
      if (typeof dest === 'string') dest = await doc.getDestination(dest);
      if (Array.isArray(dest) && dest[0]) {
        const pageIdx = await doc.getPageIndex(dest[0]);
        pageNum = pageIdx + 1;
      }
    } catch {}
    const sub = item.items?.length ? await resolveOutlinePages(doc, item.items) : [];
    result.push({ title: item.title, pageNumber: pageNum, items: sub });
  }
  return result;
}

export function renderPdfViewer(state) {
  return `
    <div id="pdfViewerRoot" class="relative w-full h-[78vh] sm:h-[84vh] bg-zinc-100 dark:bg-[#09090b] overflow-hidden flex flex-col rounded-xl select-none">
      <!-- Scrollable Pages Viewport -->
      <div id="pdfScrollHost" class="w-full h-full overflow-y-auto custom-scrollbar flex flex-col items-center py-6 px-2 sm:px-6">
        <div id="pdfLoadingSpinner" class="flex flex-col items-center justify-center py-24 gap-3 text-zinc-500 dark:text-zinc-400">
          <div class="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          <span class="text-xs font-mono">Đang tải tài liệu PDF...</span>
        </div>
      </div>

      <!-- In-Document Floating Search Bar -->
      ${renderSearchBar()}

      <!-- Floating Dock HUD -->
      ${renderFloatingDock(1, 1, 100)}

      <!-- Multi-Tab Sidebar Drawer (TOC & Thumbnails) -->
      ${renderSidebarDrawer()}

      <!-- Password Prompt Modal -->
      ${renderPasswordModal()}
    </div>
  `;
}

export function attachPdfListeners(state, registerCleanup) {
  const fileUrl = state.viewUrl || '';
  const scrollHost = document.getElementById('pdfScrollHost');
  if (!fileUrl || !scrollHost) return;

  let isDestroyed = false;
  let canvasViewer = null;
  let activeLoadingTask = null;
  let loadedDoc = null;
  let searchEngine = null;
  let cleanupDock = null;

  const cMapUrl = new URL('/pdfjs/web/cmaps/', window.location.origin).href;
  const standardFontDataUrl = new URL('/pdfjs/web/standard_fonts/', window.location.origin).href;

  // Keyboard shortcut listener
  const handleKeydown = (e) => {
    const isInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

    // Ctrl + F: Search in document
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      toggleSearchBar();
      return;
    }

    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      canvasViewer?.zoomIn();
      if (canvasViewer) updateFloatingDockState({ zoomPct: Math.round(canvasViewer.scale * 100) });
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      canvasViewer?.zoomOut();
      if (canvasViewer) updateFloatingDockState({ zoomPct: Math.round(canvasViewer.scale * 100) });
    } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      canvasViewer?.zoomFit();
      updateFloatingDockState({ zoomPct: 100 });
    } else if (e.key === 'ArrowLeft' || e.key === 'j') {
      e.preventDefault();
      if (canvasViewer) canvasViewer.jumpToPage(canvasViewer.currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'k') {
      e.preventDefault();
      if (canvasViewer) canvasViewer.jumpToPage(canvasViewer.currentPage + 1);
    }
  };

  window.addEventListener('keydown', handleKeydown);

  ensurePdfJsLoaded()
    .then(async (pdfjsLib) => {
      if (isDestroyed || (state.isCurrentSession && !state.isCurrentSession())) return;
      let pdfDoc;

      // Dynamic Password Callback Handler
      const handlePassword = async (updatePassword, reason) => {
        const isIncorrect = reason === (pdfjsLib.PasswordResponses?.INCORRECT_PASSWORD || 2);
        const pass = await promptPdfPassword(isIncorrect);
        if (pass !== null) {
          updatePassword(pass);
        } else {
          updatePassword(new Error('Người dùng đã hủy nhập mật khẩu'));
        }
      };

      try {
        let pdfData = null;
        if (state.rawFile instanceof Blob) {
          pdfData = await state.rawFile.arrayBuffer();
        } else if (fileUrl.startsWith('data:application/pdf') || fileUrl.startsWith('data:application/octet-stream')) {
          const base64 = fileUrl.split(',')[1] || '';
          const binaryStr = atob(base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          pdfData = bytes.buffer;
        } else {
          const fetchUrl = (fileUrl.startsWith('blob:') || fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))
            ? fileUrl
            : new URL(fileUrl, window.location.href).href;

          const resp = await fetch(fetchUrl, {
            credentials: 'same-origin',
            headers: { 'Accept': 'application/pdf, */*' },
            signal: state.abortSignal
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          pdfData = await resp.arrayBuffer();
        }

        if (isDestroyed || (state.isCurrentSession && !state.isCurrentSession())) return;
        if (!pdfData || pdfData.byteLength === 0) {
          throw new Error('Tệp PDF trống hoặc không thể tải nội dung');
        }

        const bufferTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfData),
          cMapUrl,
          cMapPacked: true,
          standardFontDataUrl,
          onPassword: handlePassword
        });
        activeLoadingTask = bufferTask;
        pdfDoc = await bufferTask.promise;
        loadedDoc = pdfDoc;
      } catch (primaryErr) {
        if (isDestroyed || (state.isCurrentSession && !state.isCurrentSession())) return;
        const errMsg = (primaryErr?.message || '').toLowerCase();
        if (primaryErr?.name === 'PasswordException' || errMsg.includes('password') || errMsg.includes('mật khẩu')) {
          throw primaryErr;
        }
        console.warn('[PdfRenderer] Primary binary buffer load failed, trying direct URL streaming:', primaryErr);
        const absoluteUrl = (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:'))
          ? fileUrl
          : new URL(fileUrl, window.location.href).href;

        const loadingTask = pdfjsLib.getDocument({
          url: absoluteUrl,
          cMapUrl,
          cMapPacked: true,
          standardFontDataUrl,
          onPassword: handlePassword
        });
        activeLoadingTask = loadingTask;
        pdfDoc = await loadingTask.promise;
        loadedDoc = pdfDoc;
      }

      if (isDestroyed || (state.isCurrentSession && !state.isCurrentSession())) return;

      canvasViewer = new PdfCanvasViewer(
        scrollHost,
        (page, total) => {
          updateFloatingDockState({ currentPage: page, totalPages: total });
          updateActiveSidebarPage(page);
        },
        (scale) => {
          updateFloatingDockState({ zoomPct: Math.round(scale * 100) });
        }
      );

      await canvasViewer.loadDocument(pdfDoc);

      updateFloatingDockState({
        currentPage: 1,
        totalPages: canvasViewer.totalPages,
        zoomPct: Math.round(canvasViewer.scale * 100)
      });

      // Wire Floating Dock
      cleanupDock = attachFloatingDockListeners({
        onPrev: () => canvasViewer.jumpToPage(canvasViewer.currentPage - 1),
        onNext: () => canvasViewer.jumpToPage(canvasViewer.currentPage + 1),
        onJump: (page) => canvasViewer.jumpToPage(page),
        onZoomIn: () => {
          canvasViewer.zoomIn();
          updateFloatingDockState({ zoomPct: Math.round(canvasViewer.scale * 100) });
        },
        onZoomOut: () => {
          canvasViewer.zoomOut();
          updateFloatingDockState({ zoomPct: Math.round(canvasViewer.scale * 100) });
        },
        onZoomFit: () => {
          canvasViewer.zoomFit();
          updateFloatingDockState({ zoomPct: Math.round(canvasViewer.scale * 100) });
        },
        onToggleSidebar: () => toggleSidebarDrawer(),
        onToggleOutline: () => toggleSidebarDrawer('outline'),
        onToggleSearch: () => toggleSearchBar(),
        onRotate: () => {
          canvasViewer.rotateClockwise();
          updateFloatingDockState({ zoomPct: Math.round(canvasViewer.scale * 100) });
        },
        onToggleNight: () => {
          const mode = canvasViewer.toggleNightMode();
          updateFloatingDockState({ nightMode: mode });
        },
        onPrint: () => window.print(),
        scrollHost
      });

      // Wire In-Document Search Bar
      searchEngine = new PdfSearchEngine(pdfDoc);
      attachSearchBarListeners({
        onSearch: async (query) => {
          const result = await searchEngine.search(query);
          updateSearchBarMatchCount(result.current, result.total);
          if (result.activeMatch) {
            await canvasViewer.navigateToMatch(result.activeMatch, query, result.matches);
          } else {
            canvasViewer.clearSearchResults();
          }
        },
        onNext: () => {
          const next = searchEngine.nextMatch();
          if (next) {
            updateSearchBarMatchCount(next.current, next.total);
            canvasViewer.navigateToMatch(next.match);
          }
        },
        onPrev: () => {
          const prev = searchEngine.prevMatch();
          if (prev) {
            updateSearchBarMatchCount(prev.current, prev.total);
            canvasViewer.navigateToMatch(prev.match);
          }
        },
        onClose: () => {
          updateSearchBarMatchCount(0, 0);
          canvasViewer.clearSearchResults();
        }
      });

      // Load & Wire Sidebar (TOC & Thumbnails Grid)
      pdfDoc.getOutline().then(async (rawOutline) => {
        if (isDestroyed || (state.isCurrentSession && !state.isCurrentSession())) return;
        const resolvedOutline = await resolveOutlinePages(pdfDoc, rawOutline);
        const hasTOC = resolvedOutline && resolvedOutline.length > 0;
        updateFloatingDockState({ sidebarTab: hasTOC ? 'outline' : 'thumbnails' });
        attachSidebarListeners({
          outlineItems: resolvedOutline,
          pdfDoc,
          totalPages: canvasViewer.totalPages,
          currentPage: 1,
          onJumpPage: (destPage) => canvasViewer.jumpToPage(destPage),
          onTabChange: (tab) => updateFloatingDockState({ sidebarTab: tab })
        });
      }).catch(() => {
        updateFloatingDockState({ sidebarTab: 'thumbnails' });
        attachSidebarListeners({
          outlineItems: [],
          pdfDoc,
          totalPages: canvasViewer.totalPages,
          currentPage: 1,
          onJumpPage: (destPage) => canvasViewer.jumpToPage(destPage),
          onTabChange: (tab) => updateFloatingDockState({ sidebarTab: tab })
        });
      });

      if (window.lucide) window.lucide.createIcons({ root: document.getElementById('pdfViewerRoot') });
    })
    .catch((err) => {
      if (err?.name === 'AbortError' || isDestroyed) return;
      if (state.showErrorFallback) {
        state.showErrorFallback('Không thể tải hoặc hiển thị tệp PDF', err.message);
      } else if (scrollHost && !isDestroyed) {
        scrollHost.innerHTML = `
          <div class="py-20 text-center space-y-3">
            <p class="text-xs text-rose-500 font-mono font-medium">Lỗi hiển thị PDF: ${err.message}</p>
            <a href="${state.downloadUrl}" download="${state.name}" class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-semibold inline-block shadow-sm transition">
              Tải về PDF
            </a>
          </div>
        `;
      }
    });

  registerCleanup(() => {
    isDestroyed = true;
    window.removeEventListener('keydown', handleKeydown);
    closePasswordModal();
    try { cleanupDock?.(); } catch {}
    try { destroySidebarDrawer(); } catch {}
    try { searchEngine?.destroy(); } catch {}
    try { activeLoadingTask?.destroy(); } catch {}
    try { loadedDoc?.destroy(); } catch {}
    if (canvasViewer) canvasViewer.destroy();
  });
}
