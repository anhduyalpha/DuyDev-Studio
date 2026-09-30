/**
 * PdfOrganizeWorkspace Component (< 180 lines)
 * Visual Page Reordering, Deletion, and Rotation Workspace for PDF Studio Pro
 * Integrates with PdfPreviewCanvas for continuous thumbnail display and 0ms cache restoration.
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPreviewCanvasBox, renderWorkspaceThumbnails } from './PdfPreviewCanvas.js';

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
    <div id="pdfOrganizeWorkspaceRoot" class="space-y-4">
      <!-- File Metadata & Actions Bar -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="layout-grid" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">${file.name}</span>
              <span class="badge-page-count px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
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

      <!-- Quick Action Toolbar -->
      <div class="p-2 sm:p-2.5 rounded-xl bg-zinc-100/80 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <button id="btnReverseOrganize" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
            <i data-lucide="arrow-down-up" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Đảo ngược thứ tự</span>
          </button>
          <button id="btnResetOrganize" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.06] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200/80 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Khôi phục gốc</span>
          </button>
        </div>
        <div class="text-xs font-mono text-zinc-500">
          Kéo thả để sắp xếp lại trang
        </div>
      </div>

      <!-- Pagination Navigation Bar (Shown when total pages > PAGE_SIZE) -->
      ${count > PAGE_SIZE ? `
        <div id="pdfOrganizePaginationBar" class="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 shadow-2xs">
          <button id="btnPrevOrganizePage" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${safePage === 0 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            <span>Trang trước</span>
          </button>

          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="font-bold text-zinc-900 dark:text-zinc-100">Trang ${safePage + 1} / ${totalPagesCount}</span>
            <span class="text-zinc-400 hidden sm:inline">Hiển thị ${startIdx + 1} - ${endIdx} / ${count} trang</span>
          </div>

          <button id="btnNextOrganizePage" type="button" class="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" ${safePage >= totalPagesCount - 1 ? 'disabled' : ''}>
            <span>Trang sau</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      ` : ''}

      <!-- 4x2 Page Grid Container with Drag-and-Drop Reordering -->
      <div id="pdfOrganizeGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 p-1">
        ${visibleSlots.map((origIdx, slotOffset) => {
          const globalSlotIdx = startIdx + slotOffset;
          const isDeleted = deletedSet.has(origIdx);
          const deg = (organizeRotations[origIdx] || 0) % 360;

          return `
            <div data-reorder-item="true" data-slot-index="${globalSlotIdx}" data-page-index="${origIdx}"
              class="pdf-organize-card group relative flex flex-col rounded-2xl border transition-all p-3 shadow-2xs select-none ${
                isDeleted
                  ? 'border-red-500/40 bg-red-500/[0.04] opacity-45'
                  : deg
                  ? 'border-amber-500/70 dark:border-amber-500/70 bg-amber-500/[0.02]'
                  : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121215] hover:border-amber-500/60'
              }">
              
              <!-- Card Header: Drag Grip & Page Position Badges -->
              <div class="flex items-center justify-between gap-1 mb-2.5">
                <div class="flex items-center gap-1.5 min-w-0">
                  <button type="button" data-drag-handle="true"
                    class="drag-grip-handle p-1 text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400 cursor-grab active:cursor-grabbing touch-none shrink-0 rounded transition"
                    title="Kéo thả đổi vị trí">
                    <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
                  </button>
                  <span class="w-6 h-6 rounded-md bg-zinc-100 dark:bg-white/10 text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    ${globalSlotIdx + 1}
                  </span>
                  ${globalSlotIdx !== origIdx ? `
                    <span class="text-[10px] font-mono text-zinc-400 truncate" title="Trang gốc ${origIdx + 1}">
                      (Gốc: ${origIdx + 1})
                    </span>
                  ` : ''}
                </div>

                ${isDeleted ? `
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    Đã xóa
                  </span>
                ` : deg ? `
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    ${deg}°
                  </span>
                ` : ''}
              </div>

              <!-- Thumbnail Canvas Box -->
              ${renderPreviewCanvasBox({
                file,
                pageIndex: origIdx,
                rotation: deg,
                canvasId: `organizeCanvas_${origIdx}`,
                skeletonId: `organizeSkeleton_${origIdx}`,
                eyePosition: 'left'
              })}

              <!-- Card Action Footer: Rotate & Delete/Restore -->
              <div class="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-zinc-100 dark:border-white/[0.05]">
                <button type="button" data-rotate-organize="${origIdx}"
                  class="btn-rotate-organize min-h-[32px] px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  title="Xoay trang này 90°">
                  <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                  <span class="text-[11px]">Xoay</span>
                </button>

                <button type="button" data-delete-organize="${origIdx}"
                  class="btn-delete-organize min-h-[32px] px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                    isDeleted
                      ? 'hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'hover:bg-red-500/10 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400'
                  }"
                  title="${isDeleted ? 'Khôi phục trang này' : 'Xóa trang này khỏi tài liệu'}">
                  <i data-lucide="${isDeleted ? 'rotate-ccw' : 'trash-2'}" class="w-3.5 h-3.5"></i>
                  <span class="text-[11px]">${isDeleted ? 'Khôi phục' : 'Xóa'}</span>
                </button>
              </div>
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
export async function loadAndRenderOrganizeThumbnails(file, onTotalPages, pageNumber = 0, pageSize = PAGE_SIZE) {
  return renderWorkspaceThumbnails(file, onTotalPages, pageNumber, pageSize, '#pdfOrganizeGrid', 'organize');
}
