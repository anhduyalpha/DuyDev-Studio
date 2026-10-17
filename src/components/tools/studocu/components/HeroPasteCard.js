/**
 * HeroPasteCard Component (< 100 lines)
 * Renders the BorderBeam-animated card with petite pill paste button & collapsible cookie drawer.
 */

export function renderHeroPasteCard(state) {
  const isDownloading = Boolean(state.isDownloading);

  return `
    <div class="border-beam-card ${isDownloading ? 'is-processing' : ''} bg-white dark:bg-[#111114] text-center space-y-4">
      <!-- Title & Subtitle -->
      <div class="space-y-1">
        <h2 class="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center justify-center gap-2">
          <i data-lucide="file-down" class="w-5 h-5 text-sky-500 dark:text-sky-400"></i>
          <span>Studocu Downloader</span>
        </h2>
        <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Tải giáo trình &amp; tài liệu Studocu sang PDF rõ nét. Dán link hoặc nhấn <kbd class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-mono text-[11px] border border-zinc-200 dark:border-zinc-700">Ctrl + V</kbd>.
        </p>
      </div>

      <form id="studocuDownloadForm" class="pt-1 space-y-3 max-w-lg mx-auto" onsubmit="event.preventDefault(); return false;">
        <!-- URL Input Text Box -->
        <div class="relative w-full text-left">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
            <i data-lucide="link" class="w-4 h-4"></i>
          </div>
          <input
            type="url"
            id="studocuUrlInput"
            name="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="Dán hoặc nhập liên kết Studocu (https://www.studocu.com/...)"
            ${isDownloading ? 'disabled' : ''}
            class="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm font-sans bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-sky-500 dark:focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
          />
          <button
            type="button"
            id="btnClearStudocuUrl"
            class="hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition cursor-pointer"
            title="Xóa link"
          >
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Centered Petite Pill Paste Button -->
        <div class="flex justify-center items-center">
          <button
            type="button"
            id="studocuPasteBtn"
            class="btn-hero-paste ${isDownloading ? 'btn-hero-downloading' : ''}"
            ${isDownloading ? 'disabled' : ''}
            title="Dán link & Tải"
          >
            <div id="studocuPasteBtnIcon" class="w-4 h-4 flex items-center justify-center">
              ${isDownloading
                ? '<canvas id="thinkingOrbCanvas" width="20" height="20"></canvas>'
                : '<i data-lucide="clipboard" class="w-3.5 h-3.5"></i>'}
            </div>
            <span id="studocuPasteBtnTitle">
              ${isDownloading ? 'Đang tải...' : 'Dán link & Tải'}
            </span>
          </button>
        </div>

        <!-- Cancel button when downloading -->
        ${isDownloading ? `
          <div class="flex justify-center pt-1 animate-fadeIn" id="studocuHeroCancelContainer">
            <button
              type="button"
              id="studocuHeroCancelBtn"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-rose-500 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/40 transition shadow-xs cursor-pointer select-none"
              title="Hủy tải"
            >
              <i data-lucide="circle-x" class="w-3.5 h-3.5"></i>
              <span>Hủy tải</span>
            </button>
          </div>
        ` : ''}
      </form>
    </div>
  `.trim();
}
