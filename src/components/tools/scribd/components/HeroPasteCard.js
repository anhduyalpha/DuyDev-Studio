/**
 * HeroPasteCard Component - Stitch Editorial Bento Command Deck
 * Scoped for Scribd Document Archiver.
 * Implements 1-click clipboard paste, unified recessed Omnibar, dynamic ID preview,
 * and seamless loading transformation with integrated cancel button.
 */

export function renderHeroPasteCard(state) {
  const isDownloading = Boolean(state.isDownloading);

  if (isDownloading) {
    return `
      <div class="scribd-command-deck space-y-3.5 relative overflow-hidden select-none">
        <!-- Deck Header Row (Left-Aligned Editorial Header + Active Status) -->
        <div class="flex items-center gap-3 pt-0.5">
          <div class="w-[42px] h-[42px] rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0 text-[#EA580C] dark:text-orange-400 shadow-2xs">
            <i data-lucide="book-open" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                Scribd Downloader
              </h2>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/15 text-[#EA580C] dark:text-orange-400 border border-orange-500/30 animate-pulse">
                ĐANG XỬ LÝ
              </span>
            </div>
            <p id="scribdHeroDocTitle" class="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-md">
              ${state.currentDocTitle || 'Đang tải tài liệu Scribd...'}
            </p>
          </div>
        </div>

        <!-- Recessed Omnibar in Processing State with Spinner & Integrated Cancel Button -->
        <div class="scribd-omnibar opacity-95">
          <span id="scribdIdBadge" class="scribd-id-badge active shrink-0">
            ${state.currentJobId ? `ID #${state.currentJobId.slice(0, 8)}` : 'SCRIBD'}
          </span>
          <div class="flex-1 px-3 py-2 text-xs sm:text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate min-w-0">
            ${state.currentDocTitle || 'Tiến trình xuất PDF đang hoạt động...'}
          </div>
          <!-- Right Integrated Action Button: "Đang xử lý..." Alongside Compact "Hủy" Button -->
          <div class="flex items-center gap-2 shrink-0">
            <div class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#EA580C] shadow-2xs select-none min-h-[44px]">
              <svg class="animate-spin w-4 h-4 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span id="scribdPasteBtnTitle">Đang xử lý...</span>
            </div>
            <button
              type="button"
              id="scribdHeroCancelBtn"
              class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition active:scale-[0.98] cursor-pointer min-h-[44px] touch-manipulation"
              title="Hủy tiến trình tải"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
              <span>Hủy</span>
            </button>
          </div>
        </div>
      </div>
    `.trim();
  }

  return `
    <div class="scribd-command-deck space-y-3.5 relative overflow-hidden">
      <!-- Deck Header Row (Sculpted Icon Tile + Editorial Title & Subtitle) -->
      <div class="flex items-center gap-3 pt-0.5">
        <div class="w-[42px] h-[42px] rounded-xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0 text-[#EA580C] dark:text-orange-400 shadow-2xs">
          <i data-lucide="book-open" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <h2 class="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            Scribd Downloader
          </h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            Lưu tài liệu &amp; sách Scribd sang PDF nguyên bản
          </p>
        </div>
      </div>

      <!-- Unified Stitch Command Omnibar -->
      <form id="scribdDownloadForm" class="m-0 p-0" onsubmit="event.preventDefault(); return false;">
        <div class="scribd-omnibar">
          <!-- Left Prefix: Dynamic Monospace Pill -->
          <span id="scribdIdBadge" class="scribd-id-badge shrink-0" title="Định danh nguồn tài liệu Scribd">
            SCRIBD
          </span>

          <!-- Center: Clean Borderless Input -->
          <input
            type="text"
            id="scribdUrlInput"
            name="url"
            value=""
            autocomplete="off"
            spellcheck="false"
            placeholder="Dán link Scribd hoặc nhấn nút bên cạnh..."
            class="flex-1 bg-transparent border-0 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none px-3 py-2 min-w-0"
          />

          <!-- Clear Input Button -->
          <button
            type="button"
            id="btnClearScribdUrl"
            class="hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition mr-1 cursor-pointer select-none min-h-[44px] min-w-[44px] inline-flex items-center justify-center touch-manipulation"
            title="Xóa nội dung nhập"
          >
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>

          <!-- Right Integrated Action Button: 1-Click Paste & Start OR Submit -->
          <div class="flex items-center shrink-0">
            <!-- 1. Paste & Download Button (Default when empty) -->
            <button
              type="button"
              id="scribdPasteBtn"
              class="btn-omnibar-action inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-2xs select-none min-h-[44px] touch-manipulation cursor-pointer"
              title="Dán liên kết từ clipboard và tải ngay"
            >
              <i data-lucide="clipboard" class="w-4 h-4"></i>
              <span id="scribdPasteBtnTitle">Dán &amp; Tải</span>
            </button>

            <!-- 2. Manual Submit Button (Revealed when text is entered) -->
            <button
              type="submit"
              id="btnManualSubmitScribd"
              class="btn-omnibar-action hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-2xs select-none min-h-[44px] touch-manipulation cursor-pointer"
              title="Bắt đầu tải tài liệu"
            >
              <span>Tải PDF &rarr;</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  `.trim();
}
