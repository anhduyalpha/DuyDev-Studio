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

let activeCleanups = [];
let savedScrollY = 0;

export function closeFileViewer() {
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
}

if (typeof window !== 'undefined') {
  window.closeFileViewer = closeFileViewer;
}

export function openFileViewer(state) {
  const currentScroll = window.scrollY;
  closeFileViewer();
  savedScrollY = currentScroll;

  const ext = state.name && state.name.includes('.')
    ? (state.name.split('.').pop()?.toUpperCase() || 'FILE')
    : (state.mimeType ? state.mimeType.split('/')[1]?.toUpperCase() : (state.category?.toUpperCase() || 'FILE'));
  const registerCleanup = (fn) => activeCleanups.push(fn);

  if (state.isBlob && state.viewUrl) {
    registerCleanup(() => URL.revokeObjectURL(state.viewUrl));
  }

  let bodyHtml = '';
  switch (state.category) {
    case FILE_CATEGORIES.IMAGE: bodyHtml = renderImageViewer(state); break;
    case FILE_CATEGORIES.AUDIO: bodyHtml = renderAudioViewer(state); break;
    case FILE_CATEGORIES.VIDEO: bodyHtml = renderVideoViewer(state); break;
    case FILE_CATEGORIES.PDF:
    case FILE_CATEGORIES.PRESENTATION:
      bodyHtml = renderPdfViewer(state); break;
    case FILE_CATEGORIES.WORD: bodyHtml = renderDocxViewer(state); break;
    case FILE_CATEGORIES.SHEET: bodyHtml = renderSpreadsheetViewer(state); break;
    case FILE_CATEGORIES.HTML: bodyHtml = renderHtmlViewer(state); break;
    case FILE_CATEGORIES.FONT: bodyHtml = renderFontViewer(state); break;
    case FILE_CATEGORIES.TEXT: bodyHtml = renderTextViewer(state); break;
    case FILE_CATEGORIES.ARCHIVE: bodyHtml = renderArchiveViewer(state); break;
    default: bodyHtml = renderFallbackViewer(state); break;
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

  const isPdf = state.category === FILE_CATEGORIES.PDF;
  const isArchive = state.category === FILE_CATEGORIES.ARCHIVE;
  const rawUrl = state.viewUrl || state.downloadUrl;
  const canOpenInTab = Boolean(state.viewUrl && !state.viewUrl.includes('/api/v1/files/download/') && !state.viewUrl.includes('/api/v1/studocu/'));
  const openTabUrl = isPdf
    ? `/#view/pdf?file=${encodeURIComponent(state.viewUrl || rawUrl)}&name=${encodeURIComponent(state.name || '')}`
    : isArchive ? `/#archive` : (state.viewUrl || '');

  const modalHtml = `
    <div id="fileViewerCoreModal" class="fixed inset-0 z-50 flex items-center justify-center ${isFullHeight ? 'p-0 sm:p-4' : 'p-2.5 sm:p-5'} bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div class="${isFullHeight ? 'relative w-full h-full sm:h-auto sm:max-h-[95vh] max-w-6xl bg-white dark:bg-[#121215] rounded-none sm:rounded-2xl border-0 sm:border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col' : 'relative w-full max-w-5xl bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]'}">
        
        <!-- Header Bar -->
        <div class="px-4 sm:px-5 py-3 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-white/[0.02] shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              ${ext}
            </span>
            <span class="font-medium text-sm text-zinc-900 dark:text-white truncate font-mono">${state.name}</span>
            ${state.size > 0 ? `<span class="text-xs text-zinc-400 font-mono hidden sm:inline">(${formatBytes(state.size)})</span>` : ''}
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button id="btnCopyViewerLink" type="button" class="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer" title="Sao chép liên kết">
              <i data-lucide="link" class="w-4 h-4"></i>
            </button>
            ${canOpenInTab && openTabUrl ? `
              <a href="${openTabUrl}" target="_blank" class="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition" title="Mở tab mới">
                <i data-lucide="external-link" class="w-4 h-4"></i>
              </a>
            ` : ''}
            <a href="${state.downloadUrl}" download="${state.name}" class="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition" title="Tải về">
              <i data-lucide="download" class="w-4 h-4"></i>
            </a>
            <div class="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-1"></div>
            <button id="btnCloseFileViewer" type="button" class="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition cursor-pointer" title="Đóng">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Body Viewport -->
        <div id="fileViewerBody" class="${isFullHeight ? 'p-0 flex-1 overflow-hidden flex flex-col' : 'p-3 sm:p-5 flex-1 overflow-auto custom-scrollbar flex flex-col justify-center'}">
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
    const fullUrl = state.downloadUrl.startsWith('http') ? state.downloadUrl : `${window.location.origin}${state.downloadUrl}`;
    const ok = await copyText(fullUrl);
    showToast(ok ? 'Đã sao chép liên kết' : 'Lỗi sao chép', ok ? 'success' : 'error');
  });

  // Attach Specific Renderer Listeners
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
}
