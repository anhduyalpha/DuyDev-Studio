/**
 * ConverterDropzone Component (Multi-file Support)
 * Drag-and-drop file ingestion supporting both single and batch uploads.
 * Progressive Disclosure: Spacious empty state vs. Compact top action strip.
 */

import { formatBytes } from '../../../../utilities/formatters.js';

export function renderConverterDropzone(state) {
  const items = state.items || [];
  const hasItems = items.length > 0;
  const totalSize = items.reduce((acc, it) => acc + (it.detectedMeta?.size || it.file?.size || 0), 0);

  return `
    <div class="rounded-2xl transition overflow-hidden">
      <!-- 1. Refined Empty State Dropzone (When Queue is Empty) -->
      <div id="dropzoneIdleView" class="${hasItems ? 'hidden' : ''} relative group border-2 border-dashed border-zinc-200 dark:border-white/[0.08] hover:border-indigo-500/60 dark:hover:border-indigo-400/50 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[260px] bg-white dark:bg-[#121215] hover:bg-indigo-500/[0.02] shadow-xs">
        <input type="file" id="converterDropzone_input" class="hidden" multiple accept="*/*">
        
        <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-indigo-500/10 transition-all duration-300">
          <i data-lucide="upload-cloud" class="w-8 h-8"></i>
        </div>

        <h3 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Chọn hoặc kéo thả tệp vào đây</h3>
        <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-sm">Chuyển đổi tức thì hình ảnh, âm thanh, video và tài liệu đa định dạng</p>
        
        <div class="flex flex-wrap items-center justify-center gap-1.5 mt-4 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06]">Ảnh</span>
          <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06]">Tài liệu</span>
          <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06]">Âm thanh</span>
          <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06]">Video</span>
          <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06]">Tệp nén</span>
        </div>

        <div class="mt-6 flex items-center gap-2">
          <button type="button" id="btnBrowseConverterFile" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2 active:scale-95">
            <i data-lucide="folder-open" class="w-4 h-4"></i>
            <span>Chọn tệp từ thiết bị</span>
          </button>
        </div>
      </div>

      <!-- 2. Sleek Compact Action Strip (When Queue has Files) -->
      <div id="dropzoneCompactView" class="${hasItems ? '' : 'hidden'} p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <i data-lucide="layers" class="w-4 h-4"></i>
          </div>
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              ${items.length} tệp
            </span>
            <span class="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
              ${formatBytes(totalSize)}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button type="button" id="btnAddMoreConverterFiles" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95">
            <i data-lucide="folder-plus" class="w-4 h-4"></i>
            <span>Thêm tệp</span>
          </button>
          <input type="file" id="converterAddMoreInput" class="hidden" multiple accept="*/*">
        </div>
      </div>
    </div>
  `.trim();
}
