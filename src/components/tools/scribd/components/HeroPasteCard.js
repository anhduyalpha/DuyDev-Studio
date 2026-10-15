/**
 * HeroPasteCard Component for Scribd Downloader
 * Centered BorderBeam card with petite pill paste button & collapsible advanced options.
 * Matches Studocu Downloader specifications 100%.
 */

export function renderHeroPasteCard(state) {
  const isDownloading = Boolean(state.isDownloading);

  return `
    <div class="border-beam-card-scribd bg-white dark:bg-[#111114] text-center space-y-3.5">
      <!-- Title & Subtitle with Teal Identity -->
      <div class="space-y-1.5">
        <!-- Platform Micro-Pill Badge -->
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/25 select-none shadow-2xs">
          <i data-lucide="sparkles" class="w-3 h-3 text-teal-500"></i>
          <span>SCRIBD · PDF &amp; SLIDES</span>
        </div>

        <h2 class="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center justify-center gap-2">
          <i data-lucide="book-open" class="w-5 h-5 text-teal-600 dark:text-teal-400"></i>
          <span>Scribd Downloader</span>
        </h2>
        <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Tải tài liệu &amp; slide Scribd sang file PDF rõ nét. Dán link hoặc nhấn <kbd class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-mono text-[11px] border border-zinc-200 dark:border-zinc-700">Ctrl + V</kbd>.
        </p>

        <!-- Supported Format Chips -->
        <div class="flex items-center justify-center gap-1.5 pt-0.5 select-none flex-wrap">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
            <span>📄</span> <span>Document</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
            <span>📊</span> <span>Presentation</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
            <span>📖</span> <span>E-Book</span>
          </span>
        </div>
      </div>

      <form id="scribdDownloadForm" class="pt-2 max-w-xl mx-auto space-y-2.5 text-left" onsubmit="event.preventDefault(); return false;">
        <!-- Unified Input Bar with Integrated Action Buttons -->
        <div class="relative flex items-center bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition shadow-xs">
          <!-- Leading Icon -->
          <div class="pl-2.5 pr-2 text-zinc-400 dark:text-zinc-500 flex items-center select-none">
            <i data-lucide="link-2" class="w-4 h-4 text-teal-600 dark:text-teal-400"></i>
          </div>

          <!-- Direct Visible URL Input -->
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

          <!-- Quick Clear Button (hidden when empty) -->
          <button
            type="button"
            id="btnClearScribdUrl"
            class="hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition mr-1 cursor-pointer select-none"
            title="Xóa ô nhập"
          >
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>

          <!-- Quick Paste from Clipboard Pill Button -->
          <button
            type="button"
            id="btnQuickPasteScribd"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition shadow-2xs mr-1.5 cursor-pointer shrink-0 select-none min-h-[36px]"
            title="Dán từ Clipboard"
          >
            <i data-lucide="clipboard" class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400"></i>
            <span class="hidden sm:inline">Dán</span>
          </button>

          <!-- Primary Submit / Download Button -->
          <button
            type="submit"
            id="scribdPasteBtn"
            class="btn-hero-paste-scribd inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 active:scale-[0.98] transition shadow-xs cursor-pointer shrink-0 select-none min-h-[36px]"
            title="${isDownloading ? 'Đang tải tài liệu' : 'Bắt đầu tải PDF'}"
          >
            <div id="scribdPasteBtnIcon" class="w-4 h-4 flex items-center justify-center">
              ${isDownloading
                ? '<canvas id="scribdThinkingOrbCanvas" width="20" height="20"></canvas>'
                : '<i data-lucide="arrow-down-to-line" class="w-4 h-4"></i>'}
            </div>
            <span id="scribdPasteBtnTitle">
              ${isDownloading ? 'Đang tải...' : 'Tải PDF'}
            </span>
          </button>
        </div>

        <!-- Secondary Controls: Force Reload & Reset Options -->
        <div class="flex items-center justify-between px-2 pt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <label class="flex items-center gap-1.5 select-none cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition">
            <input type="checkbox" id="chkScribdForceReload" class="rounded border-zinc-300 dark:border-zinc-700 text-teal-600 focus:ring-teal-500 cursor-pointer" />
            <span class="font-medium text-[11px] sm:text-xs">Tải lại bản mới</span>
            <span class="text-zinc-400 dark:text-zinc-500 text-[10px] hidden sm:inline">(Bỏ qua bản đã lưu)</span>
          </label>

          ${isDownloading ? `
            <button
              type="button"
              id="scribdHeroCancelBtn"
              class="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition cursor-pointer select-none py-1"
              title="Hủy tiến trình tải hiện tại"
            >
              <i data-lucide="circle-x" class="w-3.5 h-3.5"></i>
              <span>Hủy tải</span>
            </button>
          ` : `
            <button
              type="button"
              id="btnResetScribdState"
              class="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition cursor-pointer select-none py-1"
              title="Đặt lại trạng thái và xóa bộ nhớ đệm"
            >
              <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
              <span>Đặt lại</span>
            </button>
          `}
        </div>
      </form>
    </div>
  `.trim();
}
