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
import { soundEngine } from '../../../utilities/soundEngine.js';
import { getAdminToken } from '../../../utilities/adminAuth.js';

let currentSessionId = 0;
let currentAbortController = null;
let activeCleanups = [];
let savedScrollY = 0;
let currentViewerState = null;

/**
 * Reliable 16-byte magic number signature inspector
 * Detects %PDF, PK\x03\x04 (Docx/Xlsx/Zip), PNG, JPEG, GIF, WEBP, MP3, MP4, WebM, RAR, 7z
 */
export function detectCategoryFromMagicBytes(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
    return FILE_CATEGORIES.PDF;
  }
  // PNG: \x89PNG (0x89, 0x50, 0x4E, 0x47)
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
    return FILE_CATEGORIES.IMAGE;
  }
  // JPEG: \xFF\xD8\xFF
  if (u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) {
    return FILE_CATEGORIES.IMAGE;
  }
  // GIF: GIF87a or GIF89a
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) {
    return FILE_CATEGORIES.IMAGE;
  }
  // WEBP: RIFF....WEBP (offset 8: 0x57, 0x45, 0x42, 0x50)
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8.length >= 12) {
    if (u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
      return FILE_CATEGORIES.IMAGE;
    }
  }
  // ZIP / Office OpenXML: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04) {
    try {
      let str = '';
      const len = Math.min(u8.length, 1024);
      for (let i = 0; i < len; i++) str += String.fromCharCode(u8[i]);
      if (str.includes('word/')) return FILE_CATEGORIES.WORD;
      if (str.includes('xl/')) return FILE_CATEGORIES.SHEET;
      if (str.includes('ppt/')) return FILE_CATEGORIES.PDF;
    } catch {}
    return FILE_CATEGORIES.ARCHIVE;
  }
  // MP3: ID3 (0x49, 0x44, 0x33) or MPEG sync word 0xFF 0xFB/0xFA/0xF3/0xF2
  if ((u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) || (u8[0] === 0xFF && (u8[1] & 0xE0) === 0xE0)) {
    return FILE_CATEGORIES.AUDIO;
  }
  // MP4 / MOV: bytes 4-7 = 'ftyp' (0x66, 0x74, 0x79, 0x70)
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    return FILE_CATEGORIES.VIDEO;
  }
  // WebM / MKV: 0x1A, 0x45, 0xDF, 0xA3
  if (u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3) {
    return FILE_CATEGORIES.VIDEO;
  }
  // RAR: Rar! (0x52, 0x61, 0x72, 0x21)
  if (u8[0] === 0x52 && u8[1] === 0x61 && u8[2] === 0x72 && u8[3] === 0x21) {
    return FILE_CATEGORIES.ARCHIVE;
  }
  // 7Z: 7z (0x37, 0x7A, 0xBC, 0xAF)
  if (u8[0] === 0x37 && u8[1] === 0x7A && u8[2] === 0xBC && u8[3] === 0xAF) {
    return FILE_CATEGORIES.ARCHIVE;
  }
  return null;
}

/**
 * Unified authenticated fetch helper for DD Studio Universal Viewer
 * Automatically attaches X-Device-Id, x-storage-auth, and Bearer tokens for internal routes
 */
export async function viewerFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  let isInternal = false;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000');
    isInternal = typeof window !== 'undefined' ? (parsed.origin === window.location.origin) : true;
    if (typeof url === 'string' && (url.startsWith('/api/') || url.startsWith('/downloads/'))) isInternal = true;
  } catch {
    if (typeof url === 'string' && (url.startsWith('/') || url.startsWith('./'))) isInternal = true;
  }

  if (isInternal && typeof window !== 'undefined') {
    const deviceId = localStorage.getItem('ds_device_id') || window.__ddDeviceId || '';
    if (deviceId && !headers.has('x-device-id')) {
      headers.set('x-device-id', deviceId);
    }
    const token = getAdminToken();
    if (token) {
      if (!headers.has('x-storage-auth')) headers.set('x-storage-auth', token);
      if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
    }
  }

  return fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers
  });
}

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
  soundEngine.playToggle();
  currentSessionId++;
  cleanupCurrentView();

  if (typeof window !== 'undefined') {
    window.__ddFileViewerOpen = false;
    window.__ddActiveViewerState = null;
  }

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
  window.__ddCloseFileViewer = closeFileViewer;
  window.openFileViewer = openFileViewer;
  window.viewerFetch = viewerFetch;
  window.__ddViewerFetch = viewerFetch;
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

async function probeAndUpgradeCategory(state, sessionId, abortSignal) {
  if (sessionId !== currentSessionId || abortSignal.aborted) return;
  try {
    let probeBuffer = null;
    let contentType = state.mimeType || '';
    let contentDisp = '';

    if (state.rawFile instanceof Blob) {
      probeBuffer = await state.rawFile.slice(0, 1024).arrayBuffer();
      contentType = state.rawFile.type || contentType;
    } else if (state.viewUrl) {
      const res = await viewerFetch(state.viewUrl, {
        headers: { Range: 'bytes=0-1023' },
        signal: abortSignal
      });
      if (res.ok || res.status === 206) {
        contentType = res.headers.get('content-type') || contentType;
        contentDisp = res.headers.get('content-disposition') || '';
        probeBuffer = await res.arrayBuffer();
      }
    }

    if (sessionId !== currentSessionId || abortSignal.aborted) return;

    let detectedCat = null;
    if (probeBuffer) {
      detectedCat = detectCategoryFromMagicBytes(new Uint8Array(probeBuffer));
    }

    if (!detectedCat && contentType) {
      const lower = contentType.toLowerCase();
      if (lower.includes('application/pdf')) detectedCat = FILE_CATEGORIES.PDF;
      else if (lower.startsWith('image/')) detectedCat = FILE_CATEGORIES.IMAGE;
      else if (lower.startsWith('video/')) detectedCat = FILE_CATEGORIES.VIDEO;
      else if (lower.startsWith('audio/')) detectedCat = FILE_CATEGORIES.AUDIO;
      else if (lower.includes('wordprocessingml') || lower.includes('msword')) detectedCat = FILE_CATEGORIES.WORD;
      else if (lower.includes('spreadsheetml') || lower.includes('excel')) detectedCat = FILE_CATEGORIES.SHEET;
      else if (lower.includes('zip') || lower.includes('tar') || lower.includes('compressed')) detectedCat = FILE_CATEGORIES.ARCHIVE;
    }

    if (contentDisp) {
      const match = contentDisp.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        try {
          const fn = decodeURIComponent(match[1].trim());
          if (fn && (!state.name || state.name === 'Tài liệu' || state.name.endsWith('.bin'))) {
            state.name = fn;
            const nameEl = document.getElementById('viewerFileName');
            if (nameEl) nameEl.textContent = fn;
          }
        } catch {}
      }
    }

    if (detectedCat && detectedCat !== FILE_CATEGORIES.FALLBACK && detectedCat !== state.category) {
      state.category = detectedCat;
      const ext = state.name && state.name.includes('.')
        ? (state.name.split('.').pop()?.toUpperCase() || 'FILE')
        : detectedCat.toUpperCase();
      const badge = document.getElementById('viewerFileExtBadge');
      if (badge) badge.textContent = ext;

      const isFullHeight = [
        FILE_CATEGORIES.PDF,
        FILE_CATEGORIES.PRESENTATION,
        FILE_CATEGORIES.WORD,
        FILE_CATEGORIES.SHEET,
        FILE_CATEGORIES.HTML,
        FILE_CATEGORIES.FONT,
        FILE_CATEGORIES.ARCHIVE
      ].includes(state.category);

      const modalBox = document.querySelector('#fileViewerCoreModal > div');
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
      }
      if (window.lucide) window.lucide.createIcons({ root: document.getElementById('fileViewerCoreModal') });

      // Clean up previous listeners (e.g. fallback handlers) before attaching new category
      while (activeCleanups.length > 0) {
        const fn = activeCleanups.pop();
        try { fn(); } catch {}
      }

      // Update open in new tab details for upgraded category
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

      const registerCleanup = (fn) => activeCleanups.push(fn);
      attachCategoryListeners(state, registerCleanup);
    }
  } catch (err) {
    console.warn('[FileViewerCore] Magic-byte probe failed:', err);
  }
}

export function openFileViewer(state) {
  soundEngine.playToggle();
  if (typeof window !== 'undefined') {
    window.__ddFileViewerOpen = true;
    window.__ddActiveViewerState = state;
  }

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

    if (state.category === FILE_CATEGORIES.FALLBACK) {
      probeAndUpgradeCategory(state, sessionId, abortSignal);
    }
    return;
  }

  const currentScroll = window.scrollY;
  closeFileViewer();
  savedScrollY = currentScroll;
  currentViewerState = state;

  if (typeof window !== 'undefined') {
    window.__ddFileViewerOpen = true;
    window.__ddActiveViewerState = state;
  }

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
    <div id="fileViewerCoreModal" style="position: fixed; inset: 0; z-index: 99999;" class="fixed inset-0 z-[99999] flex items-center justify-center ${isFullHeight ? 'p-0 sm:p-4' : 'p-2.5 sm:p-5'} bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div class="${isFullHeight ? 'relative w-full h-full sm:h-auto sm:max-h-[95vh] max-w-6xl bg-white dark:bg-[#121215] rounded-none sm:rounded-2xl border-0 sm:border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col' : 'relative w-full max-w-5xl bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]'}">
        
        <!-- Header Bar -->
        <div class="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-2 sm:gap-3 bg-zinc-50/90 dark:bg-[#16161a] shrink-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span id="viewerFileExtBadge" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              ${ext}
            </span>
            <span id="viewerFileName" class="font-medium text-xs sm:text-sm text-zinc-900 dark:text-white truncate font-mono min-w-0 flex-1">${state.name}</span>
            <span id="viewerFileSize" class="text-xs text-zinc-400 dark:text-zinc-500 font-mono hidden md:inline shrink-0">${state.size > 0 ? `(${formatBytes(state.size)})` : ''}</span>
          </div>

          <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button id="btnCopyViewerLink" type="button" class="w-10 h-10 sm:w-8 sm:h-8 p-2 sm:p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer" title="Sao chép liên kết">
              <i data-lucide="link" class="w-4 h-4"></i>
            </button>
            <a id="btnOpenViewerTab" href="${openTabUrl}" target="_blank" class="${canOpenInTab && openTabUrl ? 'flex' : 'hidden'} w-10 h-10 sm:w-8 sm:h-8 p-2 sm:p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white items-center justify-center transition" title="Mở tab mới">
              <i data-lucide="external-link" class="w-4 h-4"></i>
            </a>
            <a id="btnDownloadViewerFile" href="${state.downloadUrl}" download="${state.name}" class="w-10 h-10 sm:w-8 sm:h-8 p-2 sm:p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition" title="Tải về">
              <i data-lucide="download" class="w-4 h-4"></i>
            </a>
            <div class="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-0.5"></div>
            <button id="btnCloseFileViewer" type="button" class="w-10 h-10 sm:w-8 sm:h-8 p-2 sm:p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 flex items-center justify-center transition cursor-pointer" title="Đóng">
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

  // Root Portal Mounting: Escapes any CSS transform / contain: paint traps
  let container = document.getElementById('globalFileViewerMount');
  if (!container) {
    container = document.createElement('div');
    container.id = 'globalFileViewerMount';
    document.body.appendChild(container);
  } else if (container.parentElement !== document.body) {
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

  if (state.category === FILE_CATEGORIES.FALLBACK) {
    probeAndUpgradeCategory(state, sessionId, abortSignal);
  }
}
