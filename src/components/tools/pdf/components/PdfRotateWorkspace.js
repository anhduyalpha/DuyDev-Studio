/**
 * PdfRotateWorkspace Component (< 160 lines)
 * Visual Page Grid (4x2 Pagination) & Direct Interaction Workspace for PDF Rotation
 * Integrates with PdfPreviewCanvas for continuous thumbnail display and 0ms cache restoration.
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPreviewCanvasBox, renderWorkspaceThumbnails } from './PdfPreviewCanvas.js';

export const PAGE_SIZE = 8;

/**
 * Generates markup for the interactive PDF rotation grid workspace with 4x2 pagination
 */
export function renderPdfRotateWorkspace({ file, pageRotations = {}, totalPages = 0, thumbnailPage = 0 } = {}) {
  if (!file) return '';

  const rotatedCount = Object.values(pageRotations).filter((deg) => (deg % 360) !== 0).length;
  const count = totalPages || file.pages || 0;
  const totalPagesCount = Math.ceil(count / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(0, thumbnailPage || 0), totalPagesCount - 1);
  const startIdx = safePage * PAGE_SIZE;
  const endIdx = Math.min(count, startIdx + PAGE_SIZE);
  const visiblePages = count > 0 ? Array.from({ length: Math.max(0, endIdx - startIdx) }, (_, i) => startIdx + i) : [0];

  return `
    <div id="pdfRotateWorkspaceRoot" class="space-y-4">
      <!-- File Metadata & Actions Bar -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="rotate-cw" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">${file.name}</span>
              <span class="badge-page-count px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                ${count > 0 ? `${count} trang` : 'Đang đọc...'}
              </span>
            </div>
            <p class="text-xs font-mono text-zinc-500 mt-0.5 flex items-center gap-2">
              <span>${formatBytes(file.size)}</span>
              <span id="pdfRotatedSummary">${rotatedCount > 0 ? `• Đã xoay <strong class="text-amber-500 font-bold">${rotatedCount}</strong> trang` : ''}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button id="btnChangeRotateFile" type="button" class="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <i data-lucide="file-up" class="w-3.5 h-3.5"></i>
            <span>Đổi tệp</span>
          </button>
        </div>
      </div>

      <!-- Quick Action Toolbar -->
      <div class="p-2 sm:p-2.5 rounded-xl bg-zinc-100/80 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <button id="btnRotateAllCW" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
            <i data-lucide="rotate-cw" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Xoay (+90°)</span>
          </button>
          <button id="btnRotateAllCCW" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Xoay (-90°)</span>
          </button>
          <button id="btnResetRotations" type="button" class="min-h-[40px] px-3 py-2 rounded-lg text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 text-xs font-medium flex items-center gap-1 transition cursor-pointer ${rotatedCount > 0 ? '' : 'hidden'}">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      <!-- Pagination Navigation Bar (Shown when total pages > PAGE_SIZE) -->
      ${count > PAGE_SIZE ? `
        <div id="pdfRotatePaginationBar" class="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 shadow-2xs">
          <button id="btnPrevRotatePage" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${safePage === 0 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            <span>Trang trước</span>
          </button>

          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="font-bold text-zinc-900 dark:text-zinc-100">Trang ${safePage + 1} / ${totalPagesCount}</span>
            <span class="text-zinc-400 hidden sm:inline">Hiển thị ${startIdx + 1} - ${endIdx} / ${count} trang</span>
          </div>

          <button id="btnNextRotatePage" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${safePage >= totalPagesCount - 1 ? 'disabled' : ''}>
            <span>Trang sau</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      ` : ''}

      <!-- 4x2 Page Grid Container (4 columns on desktop, 2 rows of 4 items) -->
      <div id="pdfRotateGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 p-1">
        ${visiblePages.map((idx) => {
          const deg = (pageRotations[idx] || 0) % 360;
          return `
            <div data-page-index="${idx}" class="btn-page-card group relative flex flex-col rounded-2xl border ${deg ? 'border-amber-500 dark:border-amber-500/80 bg-amber-500/[0.03]' : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121215]'} hover:border-amber-500/80 transition-all p-3 shadow-2xs cursor-pointer select-none">
              <!-- Thumbnail Box -->
              ${renderPreviewCanvasBox({
                file,
                pageIndex: idx,
                rotation: deg,
                canvasId: `pdfRotateCanvas_${idx}`,
                skeletonId: `pdfRotateSkeleton_${idx}`,
                eyePosition: 'right'
              })}

              <!-- Page Footer Controls -->
              <div class="mt-2.5 flex items-center justify-between gap-1 text-xs">
                <span class="font-mono font-semibold text-zinc-700 dark:text-zinc-300">Trang ${idx + 1}</span>
                <div class="page-footer-ctrls flex items-center gap-1.5">
                  ${deg ? `<span class="badge-rot px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">${deg}°</span>` : ''}
                  <button type="button" data-rotate-single="${idx}" class="w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center justify-center transition cursor-pointer" title="Xoay +90°">
                    <i data-lucide="rotate-cw" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

/**
 * Loads and renders thumbnails for the active visible pages (pageSize = 8)
 * Leverages PdfPreviewCanvas for synchronous cache restoration and background loading.
 */
export async function loadAndRenderPdfThumbnails(file, onDocLoaded, pageIndex = 0, pageSize = PAGE_SIZE) {
  return renderWorkspaceThumbnails({
    file,
    onDocLoaded,
    pageIndex,
    pageSize,
    idPrefix: 'pdfRotate'
  });
}
