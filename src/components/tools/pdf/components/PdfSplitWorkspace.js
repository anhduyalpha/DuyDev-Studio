/**
 * PdfSplitWorkspace Component
 * Visual Page Selection & Range Extraction Workspace for PDF Splitting
 * Unified Hero Workspace Header & Micro-Control Thumbnails
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPreviewCanvasBox, renderWorkspaceThumbnails } from './PdfPreviewCanvas.js';
import { getToolTheme } from '../services/pdfThemes.js';

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

  const theme = getToolTheme('split');
  const count = totalPages || file.pages || 0;
  const totalPagesCount = Math.ceil(count / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(0, thumbnailPage || 0), totalPagesCount - 1);
  const startIdx = safePage * PAGE_SIZE;
  const endIdx = Math.min(count, startIdx + PAGE_SIZE);
  const visiblePages = count > 0 ? Array.from({ length: Math.max(0, endIdx - startIdx) }, (_, i) => startIdx + i) : [0];
  const selectedCount = selectedPages.size;

  return `
    <div id="pdfSplitWorkspaceRoot" class="space-y-4 select-none">
      <!-- Unified Hero Workspace Header & Toolbar -->
      <div class="rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs overflow-hidden">
        <!-- Top File Metadata Bar -->
        <div class="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-white/[0.06]">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-11 h-11 rounded-xl ${theme.bgSoft} border ${theme.borderColor} ${theme.textSoft} flex items-center justify-center shrink-0 shadow-2xs">
              <i data-lucide="${theme.icon}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">${file.name}</span>
                <span class="badge-page-count px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${theme.badgeBg} shrink-0">
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

        <!-- Integrated Action Toolbar & Pagination -->
        <div class="p-2 sm:p-2.5 bg-zinc-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2.5">
          <!-- Segmented Pills for Quick Selection -->
          <div class="flex flex-wrap items-center gap-1 bg-zinc-200/60 dark:bg-white/[0.04] p-1 rounded-xl border border-zinc-200/50 dark:border-white/[0.04]">
            <button id="btnSelectAllPages" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-zinc-50 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-2xs transition cursor-pointer">
              Tất cả
            </button>
            <button id="btnSelectOddPages" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition cursor-pointer">
              Trang lẻ
            </button>
            <button id="btnSelectEvenPages" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition cursor-pointer">
              Trang chẵn
            </button>
            <button id="btnDeselectAllPages" type="button" class="min-h-[34px] px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 text-xs font-medium transition cursor-pointer ${selectedCount > 0 ? '' : 'hidden'}">
              Bỏ chọn
            </button>
          </div>

          <!-- Range Input & Pagination Controls -->
          <div class="flex items-center gap-2 ml-auto flex-1 max-w-sm justify-end">
            <div class="flex-1 max-w-[170px] sm:max-w-[190px] relative">
              <input type="text" id="inputPdfPages" value="${pagesInput}" placeholder="Ví dụ: 1-3, 5"
                class="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#18181B] border ${splitRangeError ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-700/60 focus:ring-amber-500'} text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 shadow-2xs" />
              ${splitRangeError ? `<p id="pdfSplitRangeError" class="absolute -bottom-4 right-0 text-[10px] font-mono text-red-500 font-semibold truncate">${splitRangeError}</p>` : ''}
            </div>

            ${count > PAGE_SIZE ? `
              <div id="pdfSplitPaginationBar" class="flex items-center gap-1 bg-white dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] p-1 rounded-xl shadow-2xs shrink-0">
                <button id="btnPrevSplitPage" type="button" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition" title="Trang trước" ${safePage === 0 ? 'disabled' : ''}>
                  <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <span class="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 px-1.5">
                  ${safePage + 1}/${totalPagesCount}
                </span>
                <button id="btnNextSplitPage" type="button" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition" title="Trang sau" ${safePage >= totalPagesCount - 1 ? 'disabled' : ''}>
                  <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- 4x2 Interactive Page Grid Container with High Contrast Micro-Controls -->
      <div id="pdfSplitGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 p-1">
        ${visiblePages.map((idx) => {
          const isSelected = selectedPages.has(idx);
          return `
            <div data-split-index="${idx}" class="btn-split-card group relative flex flex-col rounded-2xl border transition-all duration-150 p-3 shadow-2xs cursor-pointer select-none ${
              isSelected
                ? 'border-amber-500 dark:border-amber-500 ring-2 ring-amber-500 bg-amber-500/5 dark:bg-amber-500/[0.08]'
                : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121215] hover:border-amber-500/60'
            }">
              <!-- High-Contrast Selection Checkbox Badge (Top Right) -->
              <div class="absolute top-2 right-2 z-10 w-9 h-9 flex items-center justify-center pointer-events-none">
                <div class="split-chkbox w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold scale-105'
                    : 'bg-white/90 dark:bg-black/60 border border-zinc-300 dark:border-white/20 text-transparent'
                }">
                  <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
                </div>
              </div>

              <!-- Thumbnail Canvas Box -->
              ${renderPreviewCanvasBox({
                file,
                pageIndex: idx,
                canvasId: `pdfSplitCanvas_${idx}`,
                skeletonId: `pdfSplitSkeleton_${idx}`,
                eyePosition: 'left'
              })}

              <!-- Page Footer with Clear Status Badge -->
              <div class="mt-2.5 flex items-center justify-between text-xs">
                <span class="font-mono font-bold ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}">
                  Trang ${idx + 1}
                </span>
                <span class="split-status-text font-mono text-[10px] font-bold ${
                  isSelected
                    ? 'px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                    : 'text-zinc-400'
                }">
                  ${isSelected ? 'Đã chọn' : ''}
                </span>
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
