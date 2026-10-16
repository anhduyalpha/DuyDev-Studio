/**
 * FileViewerCore Component (< 190 lines)
 * Central High-Density Orchestrator for DD Studio Universal File Viewer
 */

export const FILE_CATEGORIES = {
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  PDF: 'pdf',
  WORD: 'word',
  SHEET: 'sheet',
  PRESENTATION: 'presentation',
  HTML: 'html',
  FONT: 'font',
  TEXT: 'text',
  ARCHIVE: 'archive',
  FALLBACK: 'fallback'
};

import { renderImageViewer, attachImageListeners } from './renderers/ImageRenderer.js';
import { renderAudioViewer, attachAudioListeners } from './renderers/AudioRenderer.js';
import { renderVideoViewer, attachVideoListeners } from './renderers/VideoRenderer.js';
import { renderPdfViewer, attachPdfListeners } from './renderers/PdfRenderer.js';
import { renderDocxViewer, attachDocxListeners } from './renderers/DocxRenderer.js';
import { renderSpreadsheetViewer, attachSpreadsheetListeners } from './renderers/SpreadsheetRenderer.js';
import { renderHtmlViewer, attachHtmlListeners } from './renderers/HtmlRenderer.js';
import { renderFontViewer, attachFontListeners } from './renderers/FontRenderer.js';
import { renderTextViewer, attachTextListeners } from './renderers/TextRenderer.js';
import { renderArchiveViewer, attachArchiveViewerListeners } from './renderers/ArchiveRenderer.js';
import { renderFallbackViewer, attachFallbackListeners } from './renderers/FallbackRenderer.js';
import { formatBytes } from '../../../utilities/formatters.js';
import { copyText } from '../../../utilities/clipboard.js';
import { showToast } from '../../../utilities/toast.js';

let currentSessionId = 0;
let currentAbortController = null;
let activeCleanups = [];
let savedScrollY = 0;
let currentViewerState = null;

function getOpenTabDetails(state) {
  const isPdf = state.category === FILE_CATEGORIES.PDF || state.category === FILE_CATEGORIES.PRESENTATION;
  const isArchive = state.category === FILE_CATEGORIES.ARCHIVE;
  const rawUrl = state.viewUrl || state.downloadUrl;
  const canOpenInTab = Boolean(state.viewUrl && !state.viewUrl.includes('/api/v1/files/download/') && !state.viewUrl.includes('/api/v1/studocu/'));
  const openTabUrl = isPdf
    ? `/#view/pdf?file=${encodeURIComponent(state.viewUrl || rawUrl)}&name=${encodeURIComponent(state.name || '')}`
    : isArchive ? `/#archive` : (state.viewUrl || '');
  return { canOpenInTab, openTabUrl };
}

export function cleanupCurrentView() {
  if (currentAbortController) {
    try { currentAbortController.abort(); } catch {}
    currentAbortController = null;
  }

  // 1. Quét và giải phóng cưỡng chế toàn bộ thẻ audio và video trong DOM
  const mediaElements = document.querySelectorAll('audio, video');
  mediaElements.forEach((el) => {
    try {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute('src');
      el.load(); // Buộc giải phóng native media decoder pipeline
    } catch {}
  });

  // 2. Dọn sạch src của iframe để ngắt hoàn toàn embedded players
  const iframes = document.querySelectorAll('#fileViewerCoreModal iframe');
  iframes.forEach((ifr) => {
    try { ifr.src = 'about:blank'; } catch {}
  });

  // 3. Thực thi các hàm cleanup đăng ký riêng của từng renderer
  while (activeCleanups.length > 0) {
    const fn = activeCleanups.pop();
    try { fn(); } catch {}
  }
}

export function closeFileViewer() {
  currentSessionId++;
  cleanupCurrentView();

  // Restore scroll lock on body & html
  try {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  } catch {}

  // 4. Xóa modal khỏi DOM
  const modal = document.getElementById('fileViewerCoreModal');
  if (modal) modal.remove();
  const mount = document.getElementById('globalFileViewerMount');
  if (mount) mount.innerHTML = '';

  if (window.location.hash.startsWith('#view/pdf') || window.location.hash.startsWith('#preview/pdf') || window.location.hash.startsWith('#reader/pdf')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  if (savedScrollY > 0) {
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    savedScrollY = 0;
  }
  currentViewerState = null;
}

if (typeof window !== 'undefined') {
  window.closeFileViewer = closeFileViewer;
}

export function renderFallbackErrorCard(state, reason = '', details = '') {
  const ext = (state.name?.split('.').pop() || 'FILE').toUpperCase();
  const displayReason = reason || 'Định dạng này không hỗ trợ xem trực tiếp hoặc tệp bị lỗi cấu trúc';
  const downloadUrl = state.downloadUrl || state.viewUrl || '#';
  const fileSizeStr = state.size > 0 ? `(${formatBytes(state.size)})` : '';

  return `
    <div id="viewerFallbackCard" class="py-12 sm:py-16 px-4 max-w-lg mx-auto w-full text-center space-y-5 animate-fadeIn">
      <div class="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner">
        <i data-lucide="alert-triangle" class="w-7 h-7"></i>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-zinc-200/80 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
            ${ext}
          </span>
          <h3 class="font-semibold text-sm sm:text-base text-zinc-900 dark:text-white truncate max-w-[280px] font-mono">
            ${state.name || 'Tài liệu'}
          </h3>
        </div>
        ${fileSizeStr ? `<p class="text-xs font-mono text-zinc-400 dark:text-zinc-500">${fileSizeStr}</p>` : ''}
        <p class="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto pt-1 leading-relaxed">
          ${displayReason}
        </p>
        ${details ? `<p class="text-[11px] font-mono text-rose-500/90 dark:text-rose-400/90 break-words max-w-md mx-auto pt-0.5">${details}</p>` : ''}
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2.5 pt-2">
        <button id="btnSwitchToHexDump" type="button" class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs">
          <i data-lucide="binary" class="w-4 h-4"></i>
          <span>Xem dạng Mã Hex / Văn bản thô</span>
        </button>
        <a id="btnFallbackDirectDownload" href="${downloadUrl}" download="${state.name}" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition shadow-xs cursor-pointer">
          <i data-lucide="download" class="w-4 h-4"></i>
          <span>Tải tệp xuống máy</span>
        </a>
      </div>
    </div>
  `;
}

export function showViewerFallbackCard(state, reason = '', details = '') {
  const viewerBody = document.getElementById('fileViewerBody');
  if (!viewerBody) return;
  viewerBody.className = 'p-3 sm:p-5 flex-1 overflow-auto custom-scrollbar flex flex-col justify-center bg-zinc-50/50 dark:bg-[#0e0e11]';
  viewerBody.innerHTML = renderFallbackErrorCard(state, reason, details);
  if (window.lucide) window.lucide.createIcons({ root: viewerBody });

  const hexBtn = document.getElementById('btnSwitchToHexDump');
  hexBtn?.addEventListener('click', () => {
    cleanupCurrentView();

    currentSessionId++;
    const sessionId = currentSessionId;
    currentAbortController = new AbortController();
    const abortSignal = currentAbortController.signal;

    state.category = FILE_CATEGORIES.FALLBACK;
    state.sessionId = sessionId;
    state.abortSignal = abortSignal;
    state.isCurrentSession = () => sessionId === currentSessionId && !abortSignal.aborted;
    state.showErrorFallback = (r, d) => {
      if (state.isCurrentSession()) {
        showViewerFallbackCard(state, r, d);
      }
    };
    currentViewerState = state;

    const badge = document.getElementById('viewerFileExtBadge');
    if (badge) badge.textContent = 'HEX';

    viewerBody.className = 'p-3 sm:p-5 flex-1 overflow-auto custom-scrollbar flex flex-col justify-center bg-zinc-50/50 dark:bg-[#0e0e11]';
    viewerBody.innerHTML = renderCategoryBody(state);
    if (window.lucide) window.lucide.createIcons({ root: viewerBody });
    const registerCleanup = (fn) => activeCleanups.push(fn);
    attachCategoryListeners(state, registerCleanup);
  });
}

function renderCategoryBody(state) {
  try {
    switch (state.category) {
      case FILE_CATEGORIES.IMAGE: return renderImageViewer(state);
      case FILE_CATEGORIES.AUDIO: return renderAudioViewer(state);
      case FILE_CATEGORIES.VIDEO: return renderVideoViewer(state);
      case FILE_CATEGORIES.PDF:
      case FILE_CATEGORIES.PRESENTATION:
        return renderPdfViewer(state);
      case FILE_CATEGORIES.WORD: return renderDocxViewer(state);
      case FILE_CATEGORIES.SHEET: return renderSpreadsheetViewer(state);
      case FILE_CATEGORIES.HTML: return renderHtmlViewer(state);
      case FILE_CATEGORIES.FONT: return renderFontViewer(state);
      case FILE_CATEGORIES.TEXT: return renderTextViewer(state);
      case FILE_CATEGORIES.ARCHIVE: return renderArchiveViewer(state);
      default: return renderFallbackViewer(state);
    }
  } catch (err) {
    console.error('[FileViewerCore] Render category error:', err);
    return renderFallbackErrorCard(state, 'Không thể khởi tạo giao diện xem trước', err?.message || '');
  }
}

function attachCategoryListeners(state, registerCleanup) {
  try {
    switch (state.category) {
      case FILE_CATEGORIES.IMAGE: attachImageListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.AUDIO: attachAudioListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.VIDEO: attachVideoListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.PDF:
      case FILE_CATEGORIES.PRESENTATION:
        attachPdfListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.WORD: attachDocxListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.SHEET: attachSpreadsheetListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.HTML: attachHtmlListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.FONT: attachFontListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.TEXT: attachTextListeners(state, registerCleanup); break;
      case FILE_CATEGORIES.ARCHIVE: attachArchiveViewerListeners(state, registerCleanup); break;
      default: attachFallbackListeners(state, registerCleanup); break;
    }
  } catch (err) {
    console.error('[FileViewerCore] Attach listeners error:', err);
    showViewerFallbackCard(state, 'Lỗi khi kích hoạt bộ đọc tệp', err?.message || '');
  }
}

export function openFileViewer(state) {
  const existingModal = document.getElementById('fileViewerCoreModal');
  if (existingModal && state.direction) {
    cleanupCurrentView();
    currentViewerState = state;

    currentSessionId++;
    const sessionId = currentSessionId;
    if (currentAbortController) {
      try { currentAbortController.abort(); } catch {}
    }
    currentAbortController = new AbortController();
    const abortSignal = currentAbortController.signal;

    state.sessionId = sessionId;
    state.abortSignal = abortSignal;
    state.isCurrentSession = () => sessionId === currentSessionId && !abortSignal.aborted;
    state.showErrorFallback = (reason, details) => {
      if (state.isCurrentSession()) {
        showViewerFallbackCard(state, reason, details);
      }
    };

    const ext = state.name && state.name.includes('.')
      ? (state.name.split('.').pop()?.toUpperCase() || 'FILE')
      : (state.mimeType ? state.mimeType.split('/')[1]?.toUpperCase() : (state.category?.toUpperCase() || 'FILE'));
    const registerCleanup = (fn) => activeCleanups.push(fn);

    if (state.isBlob && state.viewUrl) {
      registerCleanup(() => URL.revokeObjectURL(state.viewUrl));
    }

    // Re-bind Escape key listener
    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        closeFileViewer();
        window.removeEventListener('keydown', onKeydown);
      }
    };
    window.addEventListener('keydown', onKeydown);
    registerCleanup(() => window.removeEventListener('keydown', onKeydown));

    // Update Header elements
    const extBadge = document.getElementById('viewerFileExtBadge');
    if (extBadge) extBadge.textContent = ext;
    const nameEl = document.getElementById('viewerFileName');
    if (nameEl) nameEl.textContent = state.name;
    const sizeEl = document.getElementById('viewerFileSize');
    if (sizeEl) sizeEl.textContent = state.size > 0 ? `(${formatBytes(state.size)})` : '';
    const downloadBtn = document.getElementById('btnDownloadViewerFile');
    if (downloadBtn) {
      downloadBtn.href = state.downloadUrl;
      downloadBtn.download = state.name;
    }

    const { canOpenInTab, openTabUrl } = getOpenTabDetails(state);
    const openTabBtn = document.getElementById('btnOpenViewerTab');
    if (openTabBtn) {
      if (canOpenInTab && openTabUrl) {
        openTabBtn.href = openTabUrl;
        openTabBtn.classList.remove('hidden');
        openTabBtn.classList.add('flex');
      } else {
        openTabBtn.classList.add('hidden');
        openTabBtn.classList.remove('flex');
      }
    }

    const isFullHeight = [
      FILE_CATEGORIES.PDF,
      FILE_CATEGORIES.PRESENTATION,
      FILE_CATEGORIES.WORD,
      FILE_CATEGORIES.SHEET,
      FILE_CATEGORIES.HTML,
      FILE_CATEGORIES.FONT,
      FILE_CATEGORIES.ARCHIVE
    ].includes(state.category);

    const modalBox = existingModal.firstElementChild;
    if (modalBox) {
      modalBox.className = isFullHeight
        ? 'relative w-full h-full sm:h-auto sm:max-h-[95vh] max-w-6xl bg-white dark:bg-[#121215] rounded-none sm:rounded-2xl border-0 sm:border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col'
        : 'relative w-full max-w-5xl bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]';
    }

    const viewerBody = document.getElementById('fileViewerBody');
    if (viewerBody) {
      viewerBody.className = isFullHeight
        ? 'p-0 flex-1 overflow-hidden flex flex-col bg-zinc-100/70 dark:bg-[#09090b]'
        : 'p-3 sm:p-5 flex-1 overflow-auto custom-scrollbar flex flex-col justify-center bg-zinc-50/50 dark:bg-[#0e0e11]';
      viewerBody.innerHTML = renderCategoryBody(state);
      const animClass = state.direction === 'prev' ? 'animate-slideDown' : 'animate-slideUp';
      viewerBody.classList.remove('animate-slideUp', 'animate-slideDown');
      void viewerBody.offsetWidth; // trigger reflow
      viewerBody.classList.add(animClass);
    }

    if (window.lucide) window.lucide.createIcons({ root: existingModal });

    // Attach specific renderer listeners for active category
    attachCategoryListeners(state, registerCleanup);
    return;
  }

  const currentScroll = window.scrollY;
  closeFileViewer();
  savedScrollY = currentScroll;
  currentViewerState = state;

  // Lock scrolling while modal is open
  try {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  } catch {}

  currentSessionId++;
  const sessionId = currentSessionId;
  if (currentAbortController) {
    try { currentAbortController.abort(); } catch {}
  }
  currentAbortController = new AbortController();
  const abortSignal = currentAbortController.signal;

  state.sessionId = sessionId;
  state.abortSignal = abortSignal;
  state.isCurrentSession = () => sessionId === currentSessionId && !abortSignal.aborted;
  state.showErrorFallback = (reason, details) => {
    if (state.isCurrentSession()) {
      showViewerFallbackCard(state, reason, details);
    }
  };

  const ext = state.name && state.name.includes('.')
    ? (state.name.split('.').pop()?.toUpperCase() || 'FILE')
    : (state.mimeType ? state.mimeType.split('/')[1]?.toUpperCase() : (state.category?.toUpperCase() || 'FILE'));
  const registerCleanup = (fn) => activeCleanups.push(fn);

  if (state.isBlob && state.viewUrl) {
    registerCleanup(() => URL.revokeObjectURL(state.viewUrl));
  }

  const bodyHtml = renderCategoryBody(state);

  const isFullHeight = [
    FILE_CATEGORIES.PDF,
    FILE_CATEGORIES.PRESENTATION,
    FILE_CATEGORIES.WORD,
    FILE_CATEGORIES.SHEET,
    FILE_CATEGORIES.HTML,
    FILE_CATEGORIES.FONT,
    FILE_CATEGORIES.ARCHIVE
  ].includes(state.category);

  const { canOpenInTab, openTabUrl } = getOpenTabDetails(state);

  const modalHtml = `
    <div id="fileViewerCoreModal" class="fixed inset-0 z-50 flex items-center justify-center ${isFullHeight ? 'p-0 sm:p-4' : 'p-2.5 sm:p-5'} bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div class="${isFullHeight ? 'relative w-full h-full sm:h-auto sm:max-h-[95vh] max-w-6xl bg-white dark:bg-[#121215] rounded-none sm:rounded-2xl border-0 sm:border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col' : 'relative w-full max-w-5xl bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]'}">
        
        <!-- Header Bar -->
        <div class="px-4 sm:px-5 py-3 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-zinc-50/80 dark:bg-[#16161a] shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <span id="viewerFileExtBadge" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              ${ext}
            </span>
            <span id="viewerFileName" class="font-medium text-sm text-zinc-900 dark:text-white truncate font-mono">${state.name}</span>
            <span id="viewerFileSize" class="text-xs text-zinc-400 dark:text-zinc-500 font-mono hidden sm:inline">${state.size > 0 ? `(${formatBytes(state.size)})` : ''}</span>
          </div>

          <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button id="btnCopyViewerLink" type="button" class="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer" title="Sao chép liên kết">
              <i data-lucide="link" class="w-4 h-4"></i>
            </button>
            <a id="btnOpenViewerTab" href="${openTabUrl}" target="_blank" class="${canOpenInTab && openTabUrl ? 'flex' : 'hidden'} min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white items-center justify-center transition" title="Mở tab mới">
              <i data-lucide="external-link" class="w-4 h-4"></i>
            </a>
            <a id="btnDownloadViewerFile" href="${state.downloadUrl}" download="${state.name}" class="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition" title="Tải về">
              <i data-lucide="download" class="w-4 h-4"></i>
            </a>
            <div class="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-0.5 sm:mx-1"></div>
            <button id="btnCloseFileViewer" type="button" class="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 flex items-center justify-center transition cursor-pointer" title="Đóng">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Body Viewport -->
        <div id="fileViewerBody" class="${isFullHeight ? 'p-0 flex-1 overflow-hidden flex flex-col bg-zinc-100/70 dark:bg-[#09090b]' : 'p-3 sm:p-5 flex-1 overflow-auto custom-scrollbar flex flex-col justify-center bg-zinc-50/50 dark:bg-[#0e0e11]'}">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `.trim();

  let container = document.getElementById('globalFileViewerMount');
  if (!container) {
    container = document.createElement('div');
    container.id = 'globalFileViewerMount';
    document.body.appendChild(container);
  }
  container.innerHTML = modalHtml;
  if (window.lucide) window.lucide.createIcons({ root: container });

  // Attach Core Listeners
  document.getElementById('btnCloseFileViewer')?.addEventListener('click', closeFileViewer);
  document.getElementById('fileViewerCoreModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'fileViewerCoreModal') closeFileViewer();
  });

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      closeFileViewer();
      window.removeEventListener('keydown', onKeydown);
    }
  };
  window.addEventListener('keydown', onKeydown);
  registerCleanup(() => window.removeEventListener('keydown', onKeydown));

  document.getElementById('btnCopyViewerLink')?.addEventListener('click', async () => {
    const active = currentViewerState || state;
    const targetUrl = active.downloadUrl || active.viewUrl || '';
    const fullUrl = targetUrl.startsWith('http') ? targetUrl : `${window.location.origin}${targetUrl}`;
    const ok = await copyText(fullUrl);
    showToast(ok ? 'Đã sao chép liên kết' : 'Lỗi sao chép', ok ? 'success' : 'error');
  });

  // Attach Specific Renderer Listeners
  attachCategoryListeners(state, registerCleanup);
}
