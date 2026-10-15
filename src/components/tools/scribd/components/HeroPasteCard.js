/**
 * HeroPasteCard Component for Scribd Downloader
 * Minimalist Editorial Warm Terracotta (#EA580C) aesthetic.
 * 1-click clipboard paste, collapsible manual input drawer, crisp white spinner.
 * Completely purged of emoji tags and cluttered pill badges.
 */

export function renderHeroPasteCard(state) {
  const isDownloading = Boolean(state.isDownloading);

  if (isDownloading) {
    return `
      <div class="border-beam-card-scribd bg-white dark:bg-[#111114] text-center space-y-4 relative overflow-hidden">
        <div class="scribd-hero-top-stripe"></div>

        <!-- Title & Document Info Header -->
        <div class="space-y-2 pt-1">
          <h2 class="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center justify-center gap-2">
            <i data-lucide="book-open" class="w-5 h-5 text-[#EA580C]"></i>
            <span>Scribd Downloader</span>
          </h2>

          <div class="flex items-center justify-center">
            <div class="inline-flex items-center gap-2 max-w-md mx-auto px-3.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs text-orange-950 dark:text-orange-200 select-none shadow-2xs min-w-0">
              <i data-lucide="file-text" class="w-3.5 h-3.5 text-[#EA580C] shrink-0"></i>
              <span class="font-medium truncate">${state.currentDocTitle || 'Tài liệu Scribd'}</span>
            </div>
          </div>
        </div>

        <!-- Balanced Action Controls: Crisp White Spinner + Cancel Button -->
        <div class="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            disabled
            class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#EA580C] shadow-xs cursor-default select-none min-h-[40px]"
          >
            <svg class="animate-spin w-4 h-4 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span id="scribdPasteBtnTitle">Đang xử lý...</span>
          </button>

          <button
            type="button"
            id="scribdHeroCancelBtn"
            class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition cursor-pointer select-none min-h-[40px] touch-manipulation"
            title="Hủy tiến trình tải hiện tại"
          >
            <i data-lucide="circle-x" class="w-4 h-4"></i>
            <span>Hủy tải</span>
          </button>
        </div>
      </div>
    `.trim();
  }

  return `
    <div class="border-beam-card-scribd bg-white dark:bg-[#111114] text-center space-y-4 relative overflow-hidden">
      <div class="scribd-hero-top-stripe"></div>

      <!-- Title & Minimalist 1-Line Description -->
      <div class="space-y-1 pt-1">
        <h2 class="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center justify-center gap-2">
          <i data-lucide="book-open" class="w-5 h-5 text-[#EA580C]"></i>
          <span>Scribd Downloader</span>
        </h2>
        <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Tải tài liệu &amp; slide Scribd sang file PDF rõ nét. Dán link hoặc nhấn <kbd class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-mono text-[11px] border border-zinc-200 dark:border-zinc-700">Ctrl + V</kbd>.
        </p>
      </div>

      <form id="scribdDownloadForm" class="pt-1 max-w-lg mx-auto space-y-3" onsubmit="event.preventDefault(); return false;">
        <!-- Centered Large 1-Click Paste & Download Button -->
        <div class="flex justify-center items-center">
          <button
            type="button"
            id="scribdPasteBtn"
            class="btn-hero-paste-scribd inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-md active:scale-[0.98] transition cursor-pointer select-none min-h-[46px] touch-manipulation"
            title="Dán link từ clipboard và tải ngay"
          >
            <i data-lucide="clipboard" class="w-4 h-4 text-white"></i>
            <span id="scribdPasteBtnTitle">Dán link &amp; Tải</span>
          </button>
        </div>

        <!-- Collapsible Manual Input / Options Drawer Toggle -->
        <div class="pt-1 max-w-md mx-auto">
          <button
            type="button"
            id="scribdToggleManualBtn"
            class="text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition inline-flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none touch-manipulation"
          >
            <i data-lucide="chevron-down" id="scribdManualChevron" class="w-3.5 h-3.5 transition-transform duration-200"></i>
            <span>Nhập link thủ công / Tùy chọn</span>
          </button>

          <!-- Collapsible Drawer -->
          <div id="scribdManualDrawer" class="hidden text-left mt-2.5 p-3 sm:p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-2.5 shadow-xs">
            <!-- 100% Full-width Input Bar (Never clipped on mobile) -->
            <div class="relative flex items-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-1 focus-within:border-[#EA580C] focus-within:ring-2 focus-within:ring-[#EA580C]/20 transition">
              <div class="pl-2.5 pr-2 text-zinc-400 dark:text-zinc-500 flex items-center select-none">
                <i data-lucide="link-2" class="w-4 h-4 text-[#EA580C]"></i>
              </div>

              <input
                type="text"
                id="scribdUrlInput"
                name="url"
                value=""
                autocomplete="off"
                spellcheck="false"
                placeholder="Dán liên kết tài liệu Scribd hoặc mã ID..."
                class="flex-1 bg-transparent border-0 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none py-1.5 px-1 min-w-0"
              />

              <button
                type="button"
                id="btnClearScribdUrl"
                class="hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition mr-1 cursor-pointer select-none"
                title="Xóa ô nhập"
              >
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
              </button>

              <button
                type="submit"
                id="btnManualSubmitScribd"
                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] transition cursor-pointer shrink-0 select-none min-h-[34px]"
              >
                <i data-lucide="arrow-down-to-line" class="w-3.5 h-3.5"></i>
                <span>Tải PDF</span>
              </button>
            </div>

            <!-- Secondary Options: Force Reload Checkbox & Reset Button -->
            <div class="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400">
              <label class="flex items-center gap-2 select-none cursor-pointer hover:text-[#EA580C] transition">
                <input type="checkbox" id="chkScribdForceReload" class="rounded border-zinc-300 dark:border-zinc-700 text-[#EA580C] focus:ring-[#EA580C] cursor-pointer" />
                <span class="font-medium text-[11px] sm:text-xs">Tải lại bản mới</span>
                <span class="text-zinc-400 dark:text-zinc-500 text-[10px] hidden sm:inline">(Bỏ qua bản đã lưu)</span>
              </label>

              <button
                type="button"
                id="btnResetScribdState"
                class="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-[#EA580C] transition cursor-pointer select-none py-1"
                title="Đặt lại trạng thái"
              >
                <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  `.trim();
}
