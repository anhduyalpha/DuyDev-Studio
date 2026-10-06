/**
 * PdfOrganizeWorkspace Component
 * Visual Page Reordering, Deletion, and Rotation Workspace for PDF Studio Pro
 * Unified Hero Workspace Header & Micro-Control Header Bars
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPreviewCanvasBox, renderWorkspaceThumbnails } from './PdfPreviewCanvas.js';
import { getToolTheme } from '../services/pdfThemes.js';

export const PAGE_SIZE = 8;

/**
 * Generates markup for the interactive PDF organize grid workspace with 4x2 pagination
 */
export function renderPdfOrganizeWorkspace({
  file,
  organizeOrder = [],
  organizeDeleted = new Set(),
  organizeRotations = {},
  totalPages = 0,
  thumbnailPage = 0
} = {}) {
  if (!file) return '';

  const theme = getToolTheme('organize');
  const count = totalPages || file.pages || organizeOrder.length || 0;
  const currentOrder = organizeOrder.length === count
    ? organizeOrder
    : Array.from({ length: count }, (_, i) => i);

  const deletedSet = organizeDeleted instanceof Set ? organizeDeleted : new Set(organizeDeleted || []);
  const activeCount = currentOrder.filter((idx) => !deletedSet.has(idx)).length;
  const deletedCount = deletedSet.size;

  const totalPagesCount = Math.ceil(currentOrder.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(0, thumbnailPage || 0), totalPagesCount - 1);
  const startIdx = safePage * PAGE_SIZE;
  const endIdx = Math.min(currentOrder.length, startIdx + PAGE_SIZE);
  const visibleSlots = currentOrder.slice(startIdx, endIdx);

  return `
    <div id="pdfOrganizeWorkspaceRoot" class="space-y-4 select-none">
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
                  ${activeCount} / ${count} trang
                </span>
              </div>
              <p class="text-xs font-mono text-zinc-500 mt-0.5 flex items-center gap-2">
                <span>${formatBytes(file.size)}</span>
                ${deletedCount > 0 ? `<span>• Đã loại bỏ <strong class="text-red-500 font-bold">${deletedCount}</strong> trang</span>` : ''}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button id="btnChangeOrganizeFile" type="button" class="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="file-up" class="w-3.5 h-3.5"></i>
              <span>Đổi tệp</span>
            </button>
          </div>
        </div>

        <!-- Integrated Action Toolbar & Pagination -->
        <div class="p-2 sm:p-2.5 bg-zinc-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2.5">
          <!-- Segmented Pills for Organization Actions -->
          <div class="flex flex-wrap items-center gap-1 bg-zinc-200/60 dark:bg-white/[0.04] p-1 rounded-xl border border-zinc-200/50 dark:border-white/[0.04]">
            <button id="btnReverseOrganize" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-zinc-50 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="arrow-down-up" class="w-3.5 h-3.5 text-violet-500"></i>
              <span>Đảo ngược</span>
            </button>
            <button id="btnResetOrganize" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-violet-500"></i>
              <span>Khôi phục gốc</span>
            </button>
          </div>

          <!-- Drag instructions & Pagination Controls -->
          <div class="flex items-center gap-3 ml-auto">
            <span class="text-xs font-mono text-zinc-400 hidden sm:inline">Kéo thả để sắp xếp lại trang</span>

            ${count > PAGE_SIZE ? `
              <div id="pdfOrganizePaginationBar" class="flex items-center gap-1 bg-white dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] p-1 rounded-xl shadow-2xs shrink-0">
                <button id="btnPrevOrganizePage" type="button" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition" title="Trang trước" ${safePage === 0 ? 'disabled' : ''}>
                  <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <span class="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 px-1.5">
                  ${safePage + 1}/${totalPagesCount}
                </span>
                <button id="btnNextOrganizePage" type="button" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition" title="Trang sau" ${safePage >= totalPagesCount - 1 ? 'disabled' : ''}>
                  <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- 4x2 Page Grid Container with Micro-Control Header Bars -->
      <div id="pdfOrganizeGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 p-1">
        ${visibleSlots.map((origIdx, slotOffset) => {
          const globalSlotIdx = startIdx + slotOffset;
          const isDeleted = deletedSet.has(origIdx);
          const deg = (organizeRotations[origIdx] || 0) % 360;

          return `
            <div data-reorder-item="true" data-slot-index="${globalSlotIdx}" data-page-index="${origIdx}"
              class="pdf-organize-card group relative flex flex-col rounded-2xl border transition-all duration-150 p-2.5 shadow-2xs select-none ${
                isDeleted
                  ? 'border-red-500/40 bg-red-500/[0.04] opacity-45'
                  : deg
                  ? 'border-violet-500 dark:border-violet-500 bg-violet-500/[0.03] ring-1 ring-violet-500/30'
                  : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121215] hover:border-violet-500/60'
              }">
              
              <!-- Card Header: Violet Micro-Control Bar (Drag Handle + Rotate 90° + Delete/Restore) -->
              <div class="flex items-center justify-between gap-1.5 p-1.5 mb-2 rounded-xl bg-violet-500/10 dark:bg-violet-500/15 border border-violet-500/20">
                <!-- Left: Drag Grip Handle & Sequence Index -->
                <div class="flex items-center gap-1.5 min-w-0">
                  <button type="button" data-drag-handle="true"
                    class="drag-grip-handle p-1 text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 cursor-grab active:cursor-grabbing touch-none shrink-0 rounded transition"
                    title="Kéo thả đổi vị trí">
                    <i data-lucide="grip-vertical" class="w-4 h-4"></i>
                  </button>
                  <span class="w-5 h-5 rounded-md bg-white dark:bg-zinc-800 text-[10px] font-mono font-bold text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0 border border-violet-500/30">
                    ${globalSlotIdx + 1}
                  </span>
                  ${globalSlotIdx !== origIdx ? `
                    <span class="text-[9px] font-mono text-zinc-400 truncate hidden xs:inline" title="Trang gốc ${origIdx + 1}">
                      (Gốc:${origIdx + 1})
                    </span>
                  ` : ''}
                </div>

                <!-- Right: Header Micro-Controls (Rotate & Delete/Restore) -->
                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" data-rotate-organize="${origIdx}"
                    class="btn-rotate-organize p-1 rounded-md text-zinc-600 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-white/80 dark:hover:bg-white/10 transition cursor-pointer flex items-center gap-0.5"
                    title="Xoay trang này 90°">
                    <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                    ${deg ? `<span class="text-[9px] font-mono font-bold text-violet-600 dark:text-violet-400">${deg}°</span>` : ''}
                  </button>

                  <button type="button" data-delete-organize="${origIdx}"
                    class="btn-delete-organize p-1 rounded-md transition cursor-pointer ${
                      isDeleted
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                        : 'text-zinc-400 hover:text-red-500 hover:bg-red-500/10'
                    }"
                    title="${isDeleted ? 'Khôi phục trang' : 'Xóa trang'}">
                    <i data-lucide="${isDeleted ? 'rotate-ccw' : 'trash-2'}" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>

              <!-- Thumbnail Canvas Box -->
              ${renderPreviewCanvasBox({
                file,
                pageIndex: origIdx,
                rotation: deg,
                canvasId: `pdfOrganizeCanvas_${origIdx}`,
                skeletonId: `pdfOrganizeSkeleton_${origIdx}`,
                eyePosition: 'left'
              })}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

/**
 * Loads thumbnails for the Organize workspace using shared LRU cache
 */
export async function loadAndRenderOrganizeThumbnails(file, onTotalPages, pageNumber = 0, pageSize = PAGE_SIZE, visibleSlots = null) {
  return renderWorkspaceThumbnails({
    file,
    onDocLoaded: onTotalPages,
    pageIndex: pageNumber,
    pageSize,
    idPrefix: 'pdfOrganize',
    pageIndices: visibleSlots
  });
}
