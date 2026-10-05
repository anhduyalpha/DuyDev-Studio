/**
 * PdfMultiFileWorkspace Component (< 200 lines)
 * Reorderable Card Workspace for Merge PDF and Images-to-PDF
 * Enhanced with Slide-to-Clear Toolbar, Drag Reorder Grips, and Swipe-to-Dismiss.
 */

import { formatBytes } from '../../../../utilities/formatters.js';

/**
 * Generates markup for the reorderable multi-file workspace
 */
export function renderPdfMultiFileWorkspace({ mode = 'merge', files = [] } = {}) {
  const isImages = mode === 'images_to_pdf';
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return `
    <div id="pdfMultiFileWorkspaceRoot" class="space-y-4">
      <!-- Header Bar with Stats, Add More Files, and Slide-to-Clear Track -->
      <div class="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="${isImages ? 'image' : 'layers'}" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ${isImages ? 'Danh sách ảnh' : 'Danh sách tệp'}
              </span>
              <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                ${files.length} tệp
              </span>
            </div>
            <p class="text-xs font-mono text-zinc-500 mt-0.5">
              ${formatBytes(totalSize)}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <label class="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Thêm tệp</span>
            <input type="file" id="inputAddMoreFiles" ${isImages ? 'accept="image/*"' : 'accept=".pdf,application/pdf"'} multiple class="hidden" />
          </label>

          ${files.length > 0 ? `
            <!-- Slide-to-Clear Toolbar Track -->
            <div id="slideClearTrack" class="relative flex items-center h-10 w-44 sm:w-52 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/[0.08] overflow-hidden select-none cursor-pointer group" title="Kéo sang phải để xóa tất cả">
              <div id="slideClearFill" class="absolute inset-y-0 left-0 bg-red-500/15 dark:bg-red-500/20 w-0 transition-colors pointer-events-none"></div>
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none px-7">
                <span id="slideClearLabel" class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate tracking-tight transition-opacity duration-150">Vuốt để xóa hết</span>
              </div>
              <div id="slideClearThumb" class="absolute left-1 top-1 bottom-1 w-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 shadow-xs flex items-center justify-center text-zinc-500 dark:text-zinc-400 group-hover:text-red-500 transition-colors cursor-grab active:cursor-grabbing touch-none z-10">
                <i data-lucide="chevrons-right" class="w-4 h-4"></i>
              </div>
            </div>
            <!-- Accessible / programmatic fallback button -->
            <button id="btnClearAllMultiFiles" type="button" class="sr-only">Xóa tất cả</button>
          ` : ''}
        </div>
      </div>

      <!-- Reorderable & Swipable List of Files -->
      <div id="pdfMultiFileList" class="space-y-2.5 max-h-[62vh] overflow-y-auto custom-scrollbar p-1">
        ${files.map((f, idx) => `
          <div class="pdf-file-row-wrapper relative overflow-hidden rounded-2xl transition-all duration-200" data-file-id="${f.id}" data-file-index="${idx}" data-reorder-item="true">
            <!-- Hidden Red Destructive Trash Background (Revealed on Swipe Left) -->
            <div class="swipe-trash-bg absolute inset-0 bg-red-500/15 dark:bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-end px-5 gap-2 text-red-600 dark:text-red-400 pointer-events-none">
              <span class="text-xs font-semibold uppercase tracking-wider">Xóa</span>
              <i data-lucide="trash-2" class="w-5 h-5 transition-transform duration-150"></i>
            </div>

            <!-- Foreground Swipable Row with Drag Grip Handle -->
            <div class="pdf-file-row relative flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] hover:border-amber-500/60 dark:hover:border-amber-500/60 transition-colors gap-3 shadow-2xs touch-pan-y" data-file-id="${f.id}" data-file-index="${idx}">
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <!-- Pointer Drag Grip Handle -->
                <button type="button" class="drag-grip-handle p-1.5 -ml-1 text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400 cursor-grab active:cursor-grabbing touch-none shrink-0 rounded-lg transition" title="Kéo để đổi thứ tự" aria-label="Kéo để đổi thứ tự" data-drag-handle="true">
                  <i data-lucide="grip-vertical" class="w-4 h-4"></i>
                </button>

                <!-- Sequential Number Badge -->
                <span class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/10 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-white/[0.06]">
                  ${idx + 1}
                </span>

                <!-- Thumbnail / Icon -->
                ${isImages && f.localUrl ? `
                  <div class="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-black/40 overflow-hidden border border-zinc-200/60 dark:border-white/[0.06] shrink-0 flex items-center justify-center">
                    <img src="${f.localUrl}" alt="${f.name}" class="w-full h-full object-cover" />
                  </div>
                ` : `
                  <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <i data-lucide="${isImages ? 'image' : 'file-text'}" class="w-5 h-5"></i>
                  </div>
                `}

                <!-- Name & Meta -->
                <div class="min-w-0">
                  <p class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">${f.name}</p>
                  <p class="text-[11px] font-mono text-zinc-500 mt-0.5">
                    ${formatBytes(f.size)} ${f.pages ? `• ${f.pages} trang` : ''}
                  </p>
                </div>
              </div>

              <!-- Reorder & Action Controls -->
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" data-move-up="${idx}" title="Lên"
                  class="btn-file-move-up w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition cursor-pointer ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}">
                  <i data-lucide="arrow-up" class="w-4 h-4"></i>
                </button>
                <button type="button" data-move-down="${idx}" title="Xuống"
                  class="btn-file-move-down w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition cursor-pointer ${idx === files.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}">
                  <i data-lucide="arrow-down" class="w-4 h-4"></i>
                </button>
                <button type="button" data-remove-multi-id="${f.id}" title="Xóa"
                  class="btn-file-remove w-10 h-10 min-w-[40px] min-h-[40px] p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 flex items-center justify-center transition cursor-pointer ml-1">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      ${!isImages ? `
        <!-- Google Drive Import Bar for Merge Mode -->
        <div class="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <i data-lucide="link" class="w-4 h-4 text-amber-500"></i>
              Thêm tệp PDF từ Google Drive
            </span>
            <span class="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Nạp trực tiếp vào danh sách ghép</span>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <i data-lucide="cloud" class="w-4 h-4"></i>
              </div>
              <input type="url" id="inputPdfMultiDriveLink" placeholder="https://drive.google.com/file/d/.../view"
                class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/90 dark:border-white/[0.08] text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition font-mono" />
            </div>
            <button type="button" id="btnImportPdfMultiDrive"
              class="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs shrink-0 active:scale-[0.98]">
              <i data-lucide="arrow-down-to-dot" class="w-4 h-4 text-amber-400 dark:text-amber-500"></i>
              <span>Nạp tệp</span>
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `.trim();
}
