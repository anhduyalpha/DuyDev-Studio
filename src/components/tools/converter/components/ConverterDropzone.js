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
      <div id="dropzoneIdleView" class="${hasItems ? 'hidden' : ''} relative group border-2 border-dashed border-zinc-300/80 hover:border-indigo-500/70 dark:border-white/[0.12] dark:hover:border-indigo-400/60 rounded-2xl p-6 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] bg-zinc-50/30 dark:bg-white/[0.01] hover:bg-indigo-500/[0.02]">
        <input type="file" id="converterDropzone_input" class="hidden" multiple accept="*/*">
        <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-200 shadow-inner">
          <i data-lucide="upload-cloud" class="w-7 h-7"></i>
        </div>
        <h4 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Kéo thả hoặc tải tệp lên</h4>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">Hỗ trợ đa tệp đồng thời: Hình ảnh, Video, Âm thanh, Tài liệu</p>
        
        <div class="flex flex-wrap items-center justify-center gap-1.5 mt-3">
          <span class="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06]">PNG, JPG, WEBP, SVG</span>
          <span class="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06]">MP4, MKV, AVI, GIF</span>
          <span class="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06]">MP3, WAV, FLAC, AAC</span>
          <span class="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06]">PDF, DOCX, XLSX, TXT</span>
        </div>

        <div class="mt-5 flex items-center gap-2">
          <button type="button" id="btnBrowseConverterFile" class="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer flex items-center gap-2 active:scale-95">
            <i data-lucide="folder-open" class="w-4 h-4"></i>
            <span>Chọn tệp từ thiết bị</span>
          </button>
        </div>
      </div>

      <!-- 2. Compact Add-More View (When Queue has Files) -->
      <div id="dropzoneCompactView" class="${hasItems ? '' : 'hidden'} p-4 sm:p-5 flex items-center justify-between gap-4 border-2 border-dashed border-zinc-200 dark:border-white/[0.08] hover:border-indigo-500/50 rounded-2xl m-2 bg-zinc-50/50 dark:bg-white/[0.01]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <i data-lucide="plus-circle" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white truncate">Thêm tệp vào hàng đợi</p>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Kéo thả thêm tệp hoặc bấm nút bên phải</p>
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
