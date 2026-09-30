/**
 * PdfPageLightboxModal Component (< 250 lines)
 * Fullscreen High-Resolution Inspection Lightbox for PDF Pages
 * Features: Touch/Pointer Swipe Page Flipping, Backdrop Dismiss, Body Scroll Lock,
 * Keyboard Shortcuts (Esc, ArrowLeft, ArrowRight), and Angle-Preserving Navigation.
 */

import { ensurePdfJsLoaded } from '../../../../utilities/pdfJsHelper.js';
import { triggerHaptic } from '../../../../utilities/swipeGesture.js';

let activeLightboxKeydownHandler = null;
let activeRenderToken = 0;
let prevBodyOverflow = '';

/**
 * Closes the active PDF page lightbox modal, unlocks body scrolling, and removes listeners.
 */
export function closePdfPageLightbox() {
  const modal = typeof document !== 'undefined' ? document.getElementById('pdfPageLightboxModal') : null;
  if (modal) modal.remove();

  if (activeLightboxKeydownHandler) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', activeLightboxKeydownHandler);
    }
    activeLightboxKeydownHandler = null;
  }

  if (typeof document !== 'undefined' && document.body && document.body.style) {
    document.body.style.overflow = prevBodyOverflow || '';
  }
}

/**
 * Resolves the target rotation angle for a page when navigating in the lightbox.
 * Honors manual overrides if specified; otherwise queries getRotationCallback or defaults to 0.
 *
 * @param {number} pageIndex - The 0-based page index
 * @param {number} [overrideRotation] - Explicit override angle if user rotated within modal
 * @param {Function} [getRotationCallback] - Callback returning current angle for page index
 * @returns {number} Normalized rotation angle (e.g. 0, 90, 180, 270)
 */
export function resolveLightboxRotation(pageIndex, overrideRotation, getRotationCallback) {
  if (overrideRotation !== undefined && overrideRotation !== null) return overrideRotation;
  if (typeof getRotationCallback === 'function') {
    const rot = getRotationCallback(pageIndex);
    if (typeof rot === 'number') return rot;
  }
  return 0;
}

/**
 * Renders a specific page at high resolution inside the lightbox canvas.
 */
async function renderLightboxPage({ file, pageIndex, rotation = 0 }) {
  const currentToken = ++activeRenderToken;
  const canvas = document.getElementById('pdfLightboxCanvas');
  const spinner = document.getElementById('pdfLightboxSpinner');
  const rotBadge = document.getElementById('pdfLightboxRotBadge');
  if (!canvas) return;

  if (spinner) spinner.classList.remove('hidden');
  canvas.classList.add('opacity-0');
  canvas.style.transform = `rotate(${rotation}deg)`;
  if (rotBadge) {
    rotBadge.textContent = rotation ? `${rotation}°` : '';
    rotBadge.classList.toggle('hidden', !rotation);
  }

  try {
    const pdfjs = await ensurePdfJsLoaded();
    let pdfDoc = file.cachedDoc;
    if (!pdfDoc) {
      const targetBlob = file.rawFile || file;
      const arrayBuffer = await targetBlob.arrayBuffer();
      if (currentToken !== activeRenderToken) return;
      pdfDoc = await pdfjs.getDocument({
        data: arrayBuffer,
        cMapUrl: '/pdfjs/web/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/web/standard_fonts/'
      }).promise;
      file.cachedDoc = pdfDoc;
    }
    if (currentToken !== activeRenderToken) return;

    const page = await pdfDoc.getPage(pageIndex + 1);
    if (currentToken !== activeRenderToken) return;

    const baseViewport = page.getViewport({ scale: 1.0 });
    const maxWidth = Math.max(300, window.innerWidth * 0.85);
    const maxHeight = Math.max(300, window.innerHeight * 0.78);
    const scaleRatio = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height, 2.5);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const finalScale = Math.max(1.0, scaleRatio * dpr);

    const viewport = page.getViewport({ scale: finalScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.maxWidth = `${Math.min(maxWidth, baseViewport.width * scaleRatio)}px`;
    canvas.style.maxHeight = `${Math.min(maxHeight, baseViewport.height * scaleRatio)}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (currentToken !== activeRenderToken) return;
    if (spinner) spinner.classList.add('hidden');
    canvas.classList.remove('opacity-0');
  } catch (err) {
    if (currentToken === activeRenderToken) {
      console.error('Failed to render lightbox page:', err);
      if (spinner) {
        spinner.innerHTML = '<span class="text-xs text-red-400">Không thể tải trang này</span>';
      }
    }
  }
}

/**
 * Opens a full-screen high-resolution lightbox for a given PDF page.
 */
export function openPdfPageLightbox({
  file,
  pageIndex = 0,
  rotation = 0,
  totalPages = 0,
  onRotateChange = null,
  onPageChange = null,
  getRotation = null
}) {
  closePdfPageLightbox();

  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let currentPage = Number(pageIndex);
  const total = totalPages || file.pages || 1;

  let currentRot = Number(rotation) || resolveLightboxRotation(currentPage, undefined, getRotation);

  const modalHtml = `
    <div id="pdfPageLightboxModal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-fadeIn">
      <!-- Top Bar -->
      <div id="pdfLightboxHeader" class="flex items-center justify-between gap-3 text-white shrink-0 px-2 sm:px-4 py-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Trang <span id="pdfLightboxPageNum">${currentPage + 1}</span> / ${total}
          </span>
          <span id="pdfLightboxRotBadge" class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-zinc-300 border border-white/20 ${currentRot ? '' : 'hidden'}">
            ${currentRot ? `${currentRot}°` : ''}
          </span>
          <span class="text-xs sm:text-sm font-medium text-zinc-300 truncate max-w-[200px] sm:max-w-md">${file.name}</span>
        </div>

        <button id="btnClosePdfLightbox" type="button" class="w-10 h-10 min-w-[40px] min-h-[40px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer" title="Đóng (Esc)">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Main High-Res Canvas Viewport with Touch-Pan -->
      <div id="pdfLightboxViewport" class="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4 touch-pan-y">
        <div id="pdfLightboxSpinner" class="absolute flex flex-col items-center justify-center gap-2 text-zinc-400 z-10 pointer-events-none">
          <i data-lucide="loader-2" class="w-8 h-8 animate-spin text-amber-500"></i>
          <span class="text-xs font-mono">Đang tải trang độ nét cao...</span>
        </div>
        <canvas id="pdfLightboxCanvas" class="object-contain shadow-2xl rounded-lg transition-transform duration-200 ease-out"></canvas>
      </div>

      <!-- Bottom Navigation Dock -->
      <div id="pdfLightboxNavDock" class="flex items-center justify-center gap-2 sm:gap-3 py-2 shrink-0">
        <button id="btnLightboxPrev" type="button" class="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${currentPage === 0 ? 'disabled' : ''}>
          <i data-lucide="chevron-left" class="w-4 h-4"></i>
          <span class="hidden sm:inline">Trang trước</span>
        </button>

        ${onRotateChange ? `
          <button id="btnLightboxRotate" type="button" class="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
            <i data-lucide="rotate-cw" class="w-4 h-4"></i>
            <span>Xoay (+90°)</span>
          </button>
        ` : ''}

        <button id="btnLightboxNext" type="button" class="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${currentPage >= total - 1 ? 'disabled' : ''}>
          <span class="hidden sm:inline">Trang sau</span>
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (window.lucide) window.lucide.createIcons({ root: document.getElementById('pdfPageLightboxModal') });

  const updateNavButtons = () => {
    const prevBtn = document.getElementById('btnLightboxPrev');
    const nextBtn = document.getElementById('btnLightboxNext');
    const pageNumEl = document.getElementById('pdfLightboxPageNum');
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= total - 1;
    if (pageNumEl) pageNumEl.textContent = `${currentPage + 1}`;
  };

  const navigateToPage = (newPage, newRot = undefined) => {
    if (newPage < 0 || newPage >= total) return;
    currentPage = newPage;
    currentRot = resolveLightboxRotation(currentPage, newRot, getRotation);
    updateNavButtons();
    renderLightboxPage({ file, pageIndex: currentPage, rotation: currentRot });
    if (onPageChange) onPageChange(currentPage);
  };

  document.getElementById('btnClosePdfLightbox')?.addEventListener('click', closePdfPageLightbox);

  // Backdrop click dismiss (outside interactive elements and canvas)
  const modalEl = document.getElementById('pdfPageLightboxModal');
  modalEl?.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('#pdfLightboxCanvas') || e.target.closest('#pdfLightboxHeader') || e.target.closest('#pdfLightboxNavDock')) return;
    closePdfPageLightbox();
  });

  document.getElementById('btnLightboxPrev')?.addEventListener('click', () => {
    if (currentPage > 0) navigateToPage(currentPage - 1);
  });

  document.getElementById('btnLightboxNext')?.addEventListener('click', () => {
    if (currentPage < total - 1) navigateToPage(currentPage + 1);
  });

  document.getElementById('btnLightboxRotate')?.addEventListener('click', () => {
    currentRot = (currentRot + 90) % 360;
    const canvas = document.getElementById('pdfLightboxCanvas');
    if (canvas) canvas.style.transform = `rotate(${currentRot}deg)`;
    const rotBadge = document.getElementById('pdfLightboxRotBadge');
    if (rotBadge) {
      rotBadge.textContent = currentRot ? `${currentRot}°` : '';
      rotBadge.classList.toggle('hidden', !currentRot);
    }
    if (onRotateChange) onRotateChange(currentPage, 90);
  });

  // Touch & Pointer Swipe Navigation across Viewport
  const viewport = document.getElementById('pdfLightboxViewport');
  let vStartX = 0;
  let vStartY = 0;
  let vPointerId = null;
  let vIsTracking = false;

  const onViewportPointerDown = (e) => {
    if (e.target.closest('button, input, a')) return;
    vStartX = e.clientX;
    vStartY = e.clientY;
    vPointerId = e.pointerId;
    vIsTracking = true;
  };

  const onViewportPointerUp = (e) => {
    if (!vIsTracking || e.pointerId !== vPointerId) return;
    vIsTracking = false;
    const dx = e.clientX - vStartX;
    const dy = e.clientY - vStartY;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && currentPage < total - 1) {
        triggerHaptic(15);
        navigateToPage(currentPage + 1);
      } else if (dx > 0 && currentPage > 0) {
        triggerHaptic(15);
        navigateToPage(currentPage - 1);
      }
    }
  };

  viewport?.addEventListener('pointerdown', onViewportPointerDown);
  viewport?.addEventListener('pointerup', onViewportPointerUp);
  viewport?.addEventListener('pointercancel', () => { vIsTracking = false; });

  activeLightboxKeydownHandler = (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closePdfPageLightbox();
    } else if (e.key === 'ArrowLeft' && currentPage > 0) {
      e.preventDefault();
      navigateToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight' && currentPage < total - 1) {
      e.preventDefault();
      navigateToPage(currentPage + 1);
    }
  };
  window.addEventListener('keydown', activeLightboxKeydownHandler);

  renderLightboxPage({ file, pageIndex: currentPage, rotation: currentRot });
}
