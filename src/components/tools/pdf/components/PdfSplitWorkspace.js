/**
 * PdfSplitWorkspace Component (< 160 lines)
 * Visual Page Selection (4x2 Pagination) & Range Extraction Workspace for PDF Splitting
 * Integrates with PdfPreviewCanvas for continuous thumbnail display and 0ms cache restoration.
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPreviewCanvasBox, renderWorkspaceThumbnails } from './PdfPreviewCanvas.js';

export const PAGE_SIZE = 8;

/**
 * Generates markup for the interactive PDF split page selector workspace with 4x2 pagination
 */
export function renderPdfSplitWorkspace({
  file,
  selectedPages = new Set(),
  splitRangeError = null,
  totalPages = 0,
  pagesInput = '',
  thumbnailPage = 0
} = {}) {
  if (!file) return '';

  const count = totalPages || file.pages || 0;
  const totalPagesCount = Math.ceil(count / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(0, thumbnailPage || 0), totalPagesCount - 1);
  const startIdx = safePage * PAGE_SIZE;
  const endIdx = Math.min(count, startIdx + PAGE_SIZE);
  const visiblePages = count > 0 ? Array.from({ length: Math.max(0, endIdx - startIdx) }, (_, i) => startIdx + i) : [0];
  const selectedCount = selectedPages.size;

  return `
    <div id="pdfSplitWorkspaceRoot" class="space-y-4">
      <!-- File Metadata & Actions Bar -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="scissors" class="w-5 h-5"></i>
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
              <span id="pdfSplitSummary">• Đã chọn <strong class="text-amber-500 font-bold">${selectedCount}</strong> trang</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button id="btnChangeSplitFile" type="button" class="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <i data-lucide="file-up" class="w-3.5 h-3.5"></i>
            <span>Đổi tệp</span>
          </button>
        </div>
      </div>

      <!-- Quick Action Toolbar & Range Input -->
      <div class="p-3 rounded-xl bg-zinc-100/80 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <button id="btnSelectAllPages" type="button" class="min-h-[40px] px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] transition cursor-pointer shadow-2xs">
            Tất cả
          </button>
          <button id="btnSelectOddPages" type="button" class="min-h-[40px] px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] transition cursor-pointer shadow-2xs">
            Trang lẻ
          </button>
          <button id="btnSelectEvenPages" type="button" class="min-h-[40px] px-3 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] transition cursor-pointer shadow-2xs">
            Trang chẵn
          </button>
          <button id="btnDeselectAllPages" type="button" class="min-h-[40px] px-3 py-2 rounded-lg text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 text-xs font-medium transition cursor-pointer ${selectedCount > 0 ? '' : 'hidden'}">
            Bỏ chọn
          </button>
        </div>

        <div class="flex-1 max-w-xs ml-auto space-y-1">
          <input type="text" id="inputPdfPages" value="${pagesInput}" placeholder="Ví dụ: 1-3, 5"
            class="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181B] border ${splitRangeError ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-700/60 focus:ring-amber-500'} text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 shadow-2xs" />
          ${splitRangeError ? `<p id="pdfSplitRangeError" class="text-[11px] font-mono text-red-500 font-semibold">${splitRangeError}</p>` : ''}
        </div>
      </div>

      <!-- Pagination Navigation Bar (Shown when total pages > PAGE_SIZE) -->
      ${count > PAGE_SIZE ? `
        <div id="pdfSplitPaginationBar" class="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 shadow-2xs">
          <button id="btnPrevSplitPage" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${safePage === 0 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            <span>Trang trước</span>
          </button>

          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="font-bold text-zinc-900 dark:text-zinc-100">Trang ${safePage + 1} / ${totalPagesCount}</span>
            <span class="text-zinc-400 hidden sm:inline">Hiển thị ${startIdx + 1} - ${endIdx} / ${count} trang</span>
          </div>

          <button id="btnNextSplitPage" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${safePage >= totalPagesCount - 1 ? 'disabled' : ''}>
            <span>Trang sau</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      ` : ''}

      <!-- 4x2 Page Grid Container (4 columns on desktop, 2 rows of 4 items) -->
      <div id="pdfSplitGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 p-1">
        ${visiblePages.map((idx) => {
          const isSelected = selectedPages.has(idx);
          return `
            <div data-split-index="${idx}" class="btn-split-card group relative flex flex-col rounded-2xl border ${isSelected ? 'border-amber-500 dark:border-amber-500/80 bg-amber-500/[0.04] ring-2 ring-amber-500/20' : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121215]'} hover:border-amber-500/80 transition-all p-3 shadow-2xs cursor-pointer select-none">
              <!-- Selection Checkbox Badge (Top Right) -->
              <div class="absolute top-2 right-2 z-10 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center">
                <div class="split-chkbox w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isSelected ? 'bg-amber-500 text-zinc-950 shadow-2xs' : 'bg-white/80 dark:bg-black/50 border border-zinc-300 dark:border-white/20 text-transparent'}">
                  <i data-lucide="check" class="w-4 h-4"></i>
                </div>
              </div>

              <!-- Thumbnail Box -->
              ${renderPreviewCanvasBox({
                file,
                pageIndex: idx,
                canvasId: `pdfSplitCanvas_${idx}`,
                skeletonId: `pdfSplitSkeleton_${idx}`,
                eyePosition: 'left'
              })}

              <!-- Page Footer -->
              <div class="mt-2.5 flex items-center justify-between text-xs">
                <span class="font-mono font-semibold ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}">
                  Trang ${idx + 1}
                </span>
                <span class="split-status-text text-[11px] font-mono text-zinc-400">${isSelected ? 'Đã chọn' : ''}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

/**
 * Loads and renders thumbnails for the active visible split pages (pageSize = 8)
 * Leverages PdfPreviewCanvas for synchronous cache restoration and background loading.
 */
export async function loadAndRenderSplitThumbnails(file, onDocLoaded, pageIndex = 0, pageSize = PAGE_SIZE) {
  return renderWorkspaceThumbnails({
    file,
    onDocLoaded,
    pageIndex,
    pageSize,
    idPrefix: 'pdfSplit'
  });
}
