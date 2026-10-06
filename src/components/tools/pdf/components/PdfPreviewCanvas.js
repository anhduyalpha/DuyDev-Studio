/**
 * PdfPreviewCanvas Component (< 200 lines)
 * Reusable thumbnail canvas renderer with synchronous 0ms bitmap cache restoration
 * Provides continuous canvas display without blanking or infinite spinner deadlocks.
 */

import { pdfPageCache } from '../services/PdfPageCache.js';
import { ensurePdfJsLoaded, renderPageThumbnail } from '../../../../utilities/pdfJsHelper.js';

let activeRenderSessionToken = 0;

/**
 * Generates markup for a single PDF page preview box with pre-hidden skeleton if cached.
 *
 * @param {object} options
 * @param {object} options.file Target file object
 * @param {number} options.pageIndex 0-based page index
 * @param {number} [options.rotation=0] Visual rotation angle in degrees
 * @param {string} options.canvasId DOM id for the canvas element
 * @param {string} options.skeletonId DOM id for the skeleton loader
 * @param {string} [options.eyePosition='left'] Eye button placement ('left' or 'right')
 * @param {string} [options.customCanvasClass=''] Extra classes for canvas
 * @returns {string} HTML markup string
 */
export function renderPreviewCanvasBox({
  file,
  pageIndex,
  rotation = 0,
  canvasId,
  skeletonId,
  eyePosition = 'left',
  customCanvasClass = ''
}) {
  const cacheKey = pdfPageCache.buildKey(file, pageIndex, 0, 1);
  const isCached = pdfPageCache.has(cacheKey);
  const rotDeg = (rotation || 0) % 360;
  const rotStyle = rotDeg ? `transform: rotate(${rotDeg}deg);` : '';
  const rotClass = rotDeg ? 'transition-transform duration-200 ease-out' : '';
  const eyePosClass = eyePosition === 'right' ? 'top-2 right-2' : 'top-2 left-2';

  return `
    <div class="relative w-full aspect-[1/1.414] bg-zinc-100 dark:bg-black/40 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-200/50 dark:border-white/[0.04]">
      <canvas id="${canvasId}" data-cache-key="${cacheKey}" data-page-index="${pageIndex}" class="pdf-thumb-canvas max-w-full max-h-full object-contain ${rotClass} ${customCanvasClass}" style="${rotStyle}"></canvas>
      <div id="${skeletonId}" class="pdf-thumb-skeleton absolute inset-0 flex items-center justify-center text-zinc-400 ${isCached ? 'hidden' : ''}">
        <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
      </div>
      <button type="button" data-preview-page="${pageIndex}" class="btn-preview-page absolute ${eyePosClass} z-10 w-8 h-8 rounded-lg bg-black/50 hover:bg-black/85 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-2xs cursor-pointer opacity-80 hover:opacity-100 hover:scale-105 active:scale-95" title="Xem toàn màn hình trang ${pageIndex + 1}">
        <i data-lucide="eye" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `.trim();
}

/**
 * Synchronously restores a cached bitmap onto a canvas element with 0ms latency.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} [cacheKey] Optional cache key (reads data-cache-key if omitted)
 * @returns {boolean} True if successfully restored from cache
 */
export function restoreCanvasFromCache(canvas, cacheKey) {
  if (!canvas) return false;
  const key = cacheKey || canvas.dataset.cacheKey;
  if (!key) return false;

  const entry = pdfPageCache.get(key);
  if (!entry?.bitmap) return false;

  canvas.width = entry.width;
  canvas.height = entry.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(entry.bitmap, 0, 0);
  }

  canvas.dataset.rendered = 'true';
  canvas.dataset.renderedKey = key;

  const skeletonId = canvas.id.replace('Canvas', 'Skeleton');
  const skeleton = document.getElementById(skeletonId) || canvas.parentElement?.querySelector('.pdf-thumb-skeleton');
  if (skeleton) {
    skeleton.classList.add('hidden');
  }

  return true;
}

/**
 * Synchronously scans a DOM container and immediately paints all cached thumbnails.
 * Runs instantly upon mounting to eliminate any flash of empty canvas or spinner.
 *
 * @param {HTMLElement} container
 * @param {object} [file] File object for fallback key resolution
 * @returns {number} Number of canvases restored
 */
export function restoreThumbnailsSynchronously(container, file) {
  if (!container) return 0;
  const canvases = container.querySelectorAll('canvas.pdf-thumb-canvas, canvas[id^="pdfSplitCanvas_"], canvas[id^="pdfRotateCanvas_"], canvas[id^="pdfOrganizeCanvas_"]');
  let restored = 0;

  canvases.forEach((canvas) => {
    const pageIndex = canvas.dataset.pageIndex ?? canvas.id.split('_')[1];
    const key = canvas.dataset.cacheKey || (file ? pdfPageCache.buildKey(file, pageIndex, 0, 1) : null);
    if (key && pdfPageCache.has(key)) {
      if (restoreCanvasFromCache(canvas, key)) {
        restored++;
      }
    }
  });

  return restored;
}

/**
 * Asynchronously renders thumbnails for visible workspace pages,
 * caching rendered bitmaps to enable continuous display on future visits.
 *
 * @param {object} options
 * @param {object} options.file Target file
 * @param {Function} [options.onDocLoaded] Callback when total pages are resolved
 * @param {number} [options.pageIndex=0] Pagination page index (0-based)
 * @param {number} [options.pageSize=8] Visible page size
 * @param {string} [options.idPrefix='pdfSplit'] Prefix for element IDs ('pdfSplit', 'pdfRotate', or 'pdfOrganize')
 * @param {Array<number>} [options.pageIndices] Explicit list of page indices to render (for organize reordering)
 */
export async function renderWorkspaceThumbnails({
  file,
  onDocLoaded,
  pageIndex = 0,
  pageSize = 8,
  idPrefix = 'pdfSplit',
  pageIndices = null
}) {
  if (!file) return;
  const currentToken = ++activeRenderSessionToken;

  // Step 1: Instant synchronous paint for already-cached pages
  const rootContainer = document.getElementById(`${idPrefix}WorkspaceRoot`) || document.getElementById('pdfOrganizeWorkspaceRoot') || document.getElementById('pdfDropzoneContainer');
  restoreThumbnailsSynchronously(rootContainer, file);

  try {
    const pdfjs = await ensurePdfJsLoaded();
    let pdfDoc = file.cachedDoc;
    if (!pdfDoc) {
      const targetBlob = file.rawFile || file;
      const arrayBuffer = await targetBlob.arrayBuffer();
      if (activeRenderSessionToken !== currentToken) return;
      pdfDoc = await pdfjs.getDocument({
        data: arrayBuffer,
        cMapUrl: '/pdfjs/web/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/web/standard_fonts/'
      }).promise;
      file.cachedDoc = pdfDoc;
    }

    if (activeRenderSessionToken !== currentToken) return;
    const numPages = pdfDoc.numPages;
    if (onDocLoaded) {
      onDocLoaded(numPages);
    }

    let targetIndices = [];
    if (Array.isArray(pageIndices) && pageIndices.length > 0) {
      targetIndices = pageIndices;
    } else {
      const domCanvases = rootContainer?.querySelectorAll(`canvas[id^="${idPrefix}Canvas_"]`);
      if (domCanvases && domCanvases.length > 0) {
        targetIndices = Array.from(domCanvases)
          .map((c) => parseInt(c.dataset.pageIndex, 10))
          .filter((n) => !isNaN(n));
      }
      if (targetIndices.length === 0) {
        const startIdx = pageIndex * pageSize;
        const endIdx = Math.min(numPages, startIdx + pageSize);
        for (let i = startIdx; i < endIdx; i++) {
          targetIndices.push(i);
        }
      }
    }

    for (const pIdx of targetIndices) {
      if (activeRenderSessionToken !== currentToken) return;
      if (pIdx < 0 || pIdx >= numPages) continue;
      const canvas = document.getElementById(`${idPrefix}Canvas_${pIdx}`);
      const skeleton = document.getElementById(`${idPrefix}Skeleton_${pIdx}`) || canvas?.parentElement?.querySelector('.pdf-thumb-skeleton');
      if (!canvas) continue;

      const cacheKey = pdfPageCache.buildKey(file, pIdx, 0, 1);

      // Check cache in case it was hydrated while processing prior pages
      if (pdfPageCache.has(cacheKey) && restoreCanvasFromCache(canvas, cacheKey)) {
        continue;
      }

      // If already painted on this exact canvas DOM node, skip re-render
      if (canvas.dataset.rendered === 'true' && canvas.dataset.renderedKey === cacheKey) {
        if (skeleton) skeleton.classList.add('hidden');
        continue;
      }

      try {
        const pageNum = pIdx + 1; // PDF.js uses 1-based page numbers
        const page = await pdfDoc.getPage(pageNum);
        if (activeRenderSessionToken !== currentToken) return;
        await renderPageThumbnail(page, canvas, 240);
        if (activeRenderSessionToken !== currentToken) return;

        canvas.dataset.rendered = 'true';
        canvas.dataset.renderedKey = cacheKey;
        if (skeleton) skeleton.classList.add('hidden');

        // Store rendered bitmap into LRU page cache
        try {
          let bitmap;
          if (typeof createImageBitmap === 'function') {
            bitmap = await createImageBitmap(canvas);
          } else {
            const offscreen = document.createElement('canvas');
            offscreen.width = canvas.width;
            offscreen.height = canvas.height;
            const offCtx = offscreen.getContext('2d');
            if (offCtx) offCtx.drawImage(canvas, 0, 0);
            bitmap = offscreen;
          }
          pdfPageCache.set(cacheKey, {
            bitmap,
            width: canvas.width,
            height: canvas.height
          });
        } catch {
          // Offscreen canvas fallback on createImageBitmap failure
          try {
            const offscreen = document.createElement('canvas');
            offscreen.width = canvas.width;
            offscreen.height = canvas.height;
            const offCtx = offscreen.getContext('2d');
            if (offCtx) offCtx.drawImage(canvas, 0, 0);
            pdfPageCache.set(cacheKey, {
              bitmap: offscreen,
              width: canvas.width,
              height: canvas.height
            });
          } catch {}
        }
      } catch {
        if (skeleton) {
          skeleton.innerHTML = `<span class="text-[10px] font-mono text-zinc-400">Trang ${pIdx + 1}</span>`;
        }
      }
    }
  } catch (err) {
    if (activeRenderSessionToken === currentToken) {
      console.error(`[PdfPreviewCanvas] Error rendering ${idPrefix} thumbnails:`, err);
      // Defensively dismiss all skeletons to eliminate infinite spinner deadlock on document failure
      const skeletons = rootContainer?.querySelectorAll('.pdf-thumb-skeleton');
      skeletons?.forEach((sk) => {
        const pIdx = sk.id?.split('_')[1];
        const label = pIdx !== undefined && !isNaN(Number(pIdx)) ? `Trang ${Number(pIdx) + 1}` : 'Lỗi tải';
        sk.innerHTML = `<span class="text-[10px] font-mono text-zinc-400">${label}</span>`;
      });
    }
  }
}
