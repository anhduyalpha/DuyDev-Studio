/**
 * ConverterDropzone Component (Multi-file Support)
 * Drag-and-drop file ingestion supporting both single and batch uploads.
 */

export function renderConverterDropzone(state) {
  const items = state.items || [];
  const hasItems = items.length > 0;

  return `
    <div class="rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] shadow-sm transition overflow-hidden">
      <!-- 1. Full Dropzone View (When Queue is Empty) -->
      <div id="dropzoneIdleView" class="${hasItems ? 'hidden' : ''} relative group border-2 border-dashed border-zinc-300 hover:border-zinc-400 dark:border-white/[0.12] dark:hover:border-white/30 rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px]">
        <input type="file" id="converterDropzone_input" class="hidden" multiple accept="*/*">
        <div class="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-zinc-300 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition duration-200">
          <i data-lucide="upload-cloud" class="w-6 h-6"></i>
        </div>
        <h4 class="text-base font-bold text-zinc-900 dark:text-white">Kéo thả hoặc tải tệp lên</h4>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">Hình ảnh, Video, Âm thanh, Tài liệu</p>
        <div class="mt-4 flex items-center gap-2">
          <button type="button" id="btnBrowseConverterFile" class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold shadow-xs transition">
            Chọn tệp từ máy
          </button>
        </div>
      </div>

      <!-- 2. Compact Add-More View (When Queue has Files) -->
      <div id="dropzoneCompactView" class="${hasItems ? '' : 'hidden'} p-4 sm:p-5 flex items-center justify-between gap-4 border-2 border-dashed border-zinc-200 dark:border-white/[0.08] rounded-2xl m-2">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <i data-lucide="plus-circle" class="w-5 h-5"></i>
          </div>
          <div>
            <p class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white">Thêm tệp vào hàng đợi</p>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Kéo thả hoặc chọn tệp từ máy</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="btnAddMoreConverterFiles" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 shrink-0">
            <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
            <span>Thêm tệp</span>
          </button>
          <input type="file" id="converterAddMoreInput" class="hidden" multiple accept="*/*">
        </div>
      </div>
    </div>
  `.trim();
}
