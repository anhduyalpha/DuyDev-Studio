/**
 * PdfRenderer Component (< 160 lines)
 * Modern Native DD Studio Canvas PDF Reader Orchestrator
 */

import { renderFloatingDock, attachFloatingDockListeners, updateFloatingDockState } from './pdf/PdfFloatingDock.js';
import { renderOutlineDrawer, toggleOutlineDrawer, attachOutlineListeners } from './pdf/PdfOutlineDrawer.js';
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

      <!-- Floating Dock HUD -->
      ${renderFloatingDock(1, 1, 100)}

      <!-- Outline / Table of Contents Drawer -->
      ${renderOutlineDrawer()}
    </div>
  `;
}

export function attachPdfListeners(state, registerCleanup) {
  const fileUrl = state.viewUrl || '';
  const scrollHost = document.getElementById('pdfScrollHost');
  if (!fileUrl || !scrollHost) return;

  let isDestroyed = false;
  let canvasViewer = null;

  ensurePdfJsLoaded()
    .then(async (pdfjsLib) => {
      if (isDestroyed) return;
      let pdfDoc;

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
          // Resolve to absolute URL if needed for same-origin fetch
          const fetchUrl = (fileUrl.startsWith('blob:') || fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))
            ? fileUrl
            : new URL(fileUrl, window.location.href).href;

          const resp = await fetch(fetchUrl, {
            credentials: 'same-origin',
            headers: { 'Accept': 'application/pdf, */*' }
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          pdfData = await resp.arrayBuffer();
        }

        if (isDestroyed) return;
        if (!pdfData || pdfData.byteLength === 0) {
          throw new Error('Tệp PDF trống hoặc không thể tải nội dung');
        }

        const bufferTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfData),
          cMapUrl: '/pdfjs/web/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/web/standard_fonts/'
        });
        pdfDoc = await bufferTask.promise;
      } catch (primaryErr) {
        console.warn('[PdfRenderer] Primary binary buffer load failed, trying direct URL streaming:', primaryErr);
        const absoluteUrl = (fileUrl.startsWith('blob:') || fileUrl.startsWith('data:'))
          ? fileUrl
          : new URL(fileUrl, window.location.href).href;

        const loadingTask = pdfjsLib.getDocument({
          url: absoluteUrl,
          cMapUrl: '/pdfjs/web/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/web/standard_fonts/'
        });
        pdfDoc = await loadingTask.promise;
      }
      if (isDestroyed) return;

      canvasViewer = new PdfCanvasViewer(scrollHost, (page, total) => {
        updateFloatingDockState({ currentPage: page, totalPages: total });
      });

      await canvasViewer.loadDocument(pdfDoc);

      updateFloatingDockState({
        currentPage: 1,
        totalPages: canvasViewer.totalPages,
        zoomPct: 100
      });

      // Wire Floating Dock
      attachFloatingDockListeners({
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
          updateFloatingDockState({ zoomPct: 100 });
        },
        onToggleOutline: () => toggleOutlineDrawer(),
        onToggleNight: () => {
          const mode = canvasViewer.toggleNightMode();
          updateFloatingDockState({ nightMode: mode });
        }
      });

      // Load & Wire Outline
      pdfDoc.getOutline().then(async (rawOutline) => {
        if (isDestroyed) return;
        const resolvedOutline = await resolveOutlinePages(pdfDoc, rawOutline);
        attachOutlineListeners(resolvedOutline, (destPage) => {
          canvasViewer.jumpToPage(destPage);
        });
      }).catch(() => {
        attachOutlineListeners([], () => {});
      });

      if (window.lucide) window.lucide.createIcons({ root: document.getElementById('pdfViewerRoot') });
    })
    .catch((err) => {
      if (scrollHost && !isDestroyed) {
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
    if (canvasViewer) canvasViewer.destroy();
  });
}
