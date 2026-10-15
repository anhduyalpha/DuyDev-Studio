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

      <form id="scribdDownloadForm" class="pt-1" onsubmit="event.preventDefault(); return false;">
        <input type="hidden" id="scribdUrlInput" name="url" value="" />

        <!-- Centered Petite Pill Paste Button -->
        <div class="flex justify-center items-center">
          <button
            type="button"
            id="scribdPasteBtn"
            class="btn-hero-paste btn-hero-paste-scribd ${isDownloading ? 'btn-hero-downloading' : ''}"
            ${isDownloading ? 'disabled' : ''}
            title="Dán link"
          >
            <div id="scribdPasteBtnIcon" class="w-4 h-4 flex items-center justify-center">
              ${isDownloading
                ? '<canvas id="scribdThinkingOrbCanvas" width="20" height="20"></canvas>'
                : '<i data-lucide="clipboard" class="w-3.5 h-3.5"></i>'}
            </div>
            <span id="scribdPasteBtnTitle">
              ${isDownloading ? 'Đang tải...' : 'Dán link & Tải'}
            </span>
          </button>
        </div>

        <!-- Cancel button when downloading -->
        ${isDownloading ? `
          <div class="flex justify-center pt-2.5 animate-fadeIn" id="scribdHeroCancelContainer">
            <button
              type="button"
              id="scribdHeroCancelBtn"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-rose-500 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/40 transition shadow-xs cursor-pointer select-none"
              title="Hủy tải"
            >
              <i data-lucide="circle-x" class="w-3.5 h-3.5"></i>
              <span>Hủy tải</span>
            </button>
          </div>
        ` : ''}

        <!-- Advanced Collapsible Options -->
        <div class="pt-2 max-w-md mx-auto">
          <button
            type="button"
            id="scribdToggleOptionsBtn"
            class="text-xs text-zinc-500 hover:text-teal-600 dark:text-zinc-400 dark:hover:text-teal-300 transition flex items-center justify-center gap-1.5 mx-auto py-1 cursor-pointer"
          >
            <i data-lucide="chevron-down" id="scribdOptionsChevron" class="w-3 h-3 transition-transform duration-200"></i>
            <span>Tùy chọn nâng cao</span>
          </button>

          <div id="scribdOptionsDrawer" class="hidden text-left mt-2.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <label class="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none cursor-pointer">
              <input type="checkbox" id="chkScribdForceReload" class="rounded border-zinc-300 dark:border-zinc-700 text-teal-600 focus:ring-teal-500" />
              <span class="font-medium">Tải lại bản mới</span>
              <span class="text-zinc-400 dark:text-zinc-500 text-[11px]">(Bỏ qua bản đã lưu)</span>
            </label>

            <div>
              <label class="block text-xs font-mono text-zinc-700 dark:text-zinc-300 mb-1">Nhập link hoặc ID tài liệu</label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  id="scribdManualUrlInput"
                  placeholder="Dán link tài liệu vào đây hoặc nhập ID..."
                  class="flex-1 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition"
                />
                <button
                  type="button"
                  id="btnScribdManualStart"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 transition cursor-pointer shrink-0"
                >
                  Bắt đầu
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  `.trim();
}
