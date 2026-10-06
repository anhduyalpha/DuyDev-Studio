/**
 * PdfRotateWorkspace Component
 * Visual Page Grid & Direct Interaction Workspace for PDF Rotation
 * Unified Hero Workspace Header & Prominent Sky Blue Micro-Controls
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { renderPreviewCanvasBox, renderWorkspaceThumbnails } from './PdfPreviewCanvas.js';
import { getToolTheme } from '../services/pdfThemes.js';

export const PAGE_SIZE = 8;

/**
 * Generates markup for the interactive PDF rotation grid workspace with 4x2 pagination
 */
export function renderPdfRotateWorkspace({ file, pageRotations = {}, totalPages = 0, thumbnailPage = 0 } = {}) {
  if (!file) return '';

  const theme = getToolTheme('rotate');
  const rotatedCount = Object.values(pageRotations).filter((deg) => (deg % 360) !== 0).length;
  const count = totalPages || file.pages || 0;
  const totalPagesCount = Math.ceil(count / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(0, thumbnailPage || 0), totalPagesCount - 1);
  const startIdx = safePage * PAGE_SIZE;
  const endIdx = Math.min(count, startIdx + PAGE_SIZE);
  const visiblePages = count > 0 ? Array.from({ length: Math.max(0, endIdx - startIdx) }, (_, i) => startIdx + i) : [0];

  return `
    <div id="pdfRotateWorkspaceRoot" class="space-y-4 select-none">
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
                <span id="pdfRotatedSummary">${rotatedCount > 0 ? `• Đã xoay <strong class="text-sky-500 font-bold">${rotatedCount}</strong> trang` : ''}</span>
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

        <!-- Integrated Action Toolbar & Pagination -->
        <div class="p-2 sm:p-2.5 bg-zinc-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2.5">
          <!-- Segmented Pills for Bulk Rotation -->
          <div class="flex flex-wrap items-center gap-1 bg-zinc-200/60 dark:bg-white/[0.04] p-1 rounded-xl border border-zinc-200/50 dark:border-white/[0.04]">
            <button id="btnRotateAllCW" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 hover:bg-zinc-50 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="rotate-cw" class="w-3.5 h-3.5 text-sky-500"></i>
              <span>Xoay (+90°)</span>
            </button>
            <button id="btnRotateAllCCW" type="button" class="min-h-[34px] px-3 py-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-sky-500"></i>
              <span>Xoay (-90°)</span>
            </button>
            <button id="btnResetRotations" type="button" class="min-h-[34px] px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 text-xs font-medium flex items-center gap-1 transition cursor-pointer ${rotatedCount > 0 ? '' : 'hidden'}">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span>Khôi phục</span>
            </button>
          </div>

          <!-- Pagination Navigation -->
          <div class="flex items-center gap-2 ml-auto">
            ${count > PAGE_SIZE ? `
              <div id="pdfRotatePaginationBar" class="flex items-center gap-1 bg-white dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] p-1 rounded-xl shadow-2xs shrink-0">
                <button id="btnPrevRotatePage" type="button" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition" title="Trang trước" ${safePage === 0 ? 'disabled' : ''}>
                  <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <span class="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 px-1.5">
                  ${safePage + 1}/${totalPagesCount}
                </span>
                <button id="btnNextRotatePage" type="button" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition" title="Trang sau" ${safePage >= totalPagesCount - 1 ? 'disabled' : ''}>
                  <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- 4x2 Page Grid Container with Sky Blue Themed Cards -->
      <div id="pdfRotateGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 p-1">
        ${visiblePages.map((idx) => {
          const deg = (pageRotations[idx] || 0) % 360;
          return `
            <div data-page-index="${idx}" class="btn-page-card group relative flex flex-col rounded-2xl border transition-all duration-150 p-3 shadow-2xs select-none ${
              deg
                ? 'border-sky-500 dark:border-sky-500 bg-sky-500/[0.03] ring-2 ring-sky-500/20'
                : 'border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121215] hover:border-sky-500/60'
            }">
              <!-- Cumulative Rotation Angle Badge (Top Right) -->
              ${deg ? `
                <div class="badge-rot absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-sky-500 text-zinc-950 shadow-xs border border-sky-400 pointer-events-none">
                  +${deg}°
                </div>
              ` : ''}

              <!-- Thumbnail Canvas Box -->
              ${renderPreviewCanvasBox({
                file,
                pageIndex: idx,
                rotation: deg,
                canvasId: `pdfRotateCanvas_${idx}`,
                skeletonId: `pdfRotateSkeleton_${idx}`,
                eyePosition: 'left'
              })}

              <!-- Page Footer: Page Number & Large Sky Rotate CTA Button -->
              <div class="mt-2.5 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-mono font-semibold ${deg ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-zinc-700 dark:text-zinc-300'}">
                    Trang ${idx + 1}
                  </span>
                  <div class="page-footer-ctrls">
                    ${deg ? `<span class="badge-rot-sub text-[10px] font-mono text-zinc-400">${deg}°</span>` : ''}
                  </div>
                </div>

                <!-- Wide Sky Blue Rotate Micro-Control -->
                <button type="button" data-rotate-single="${idx}"
                  class="btn-rotate-single w-full py-2 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/25 hover:border-sky-500/40 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
                  title="Xoay +90°">
                  <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                  <span>Xoay 90°</span>
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
