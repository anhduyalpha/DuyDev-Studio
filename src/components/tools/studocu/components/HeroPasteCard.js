/**
 * HeroPasteCard Component (< 100 lines)
 * Renders the BorderBeam-animated card with petite pill paste button & collapsible cookie drawer.
 */

export function renderHeroPasteCard(state) {
  const isDownloading = Boolean(state.isDownloading);

  return `
    <div class="border-beam-card text-center space-y-4">
      <!-- Title & Subtitle -->
      <div class="space-y-1">
        <h2 class="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center justify-center gap-2">
          <i data-lucide="file-down" class="w-5 h-5 text-sky-500 dark:text-sky-400"></i>
          <span>Studocu Downloader</span>
        </h2>
        <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Trích xuất tài liệu Studocu sang PDF chất lượng cao. Dán liên kết hoặc nhấn <kbd class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-mono text-[11px] border border-zinc-200 dark:border-zinc-700">Ctrl + V</kbd>.
        </p>
      </div>

      <form id="studocuDownloadForm" class="pt-1" onsubmit="event.preventDefault(); return false;">
        <input type="hidden" id="studocuUrlInput" name="url" value="" />

        <!-- Centered Petite Pill Paste Button -->
        <div class="flex justify-center items-center">
          <button
            type="button"
            id="studocuPasteBtn"
            class="btn-hero-paste ${isDownloading ? 'btn-hero-downloading' : ''}"
            ${isDownloading ? 'disabled' : ''}
            title="Dán link"
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
          <div class="flex justify-center pt-2.5 animate-fadeIn" id="studocuHeroCancelContainer">
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

        <!-- Advanced Collapsible Cookie Options -->
        <div class="pt-2 max-w-md mx-auto">
          <button
            type="button"
            id="studocuToggleCookieBtn"
            class="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition flex items-center justify-center gap-1.5 mx-auto py-1 cursor-pointer"
          >
            <i data-lucide="chevron-down" id="studocuCookieChevron" class="w-3 h-3 transition-transform duration-200"></i>
            <span>Tùy chọn Cookie</span>
          </button>

          <div id="studocuCookieDrawer" class="hidden text-left mt-2.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div class="text-xs text-zinc-600 dark:text-zinc-400">
              <span class="text-sky-600 dark:text-sky-400 font-medium">Bypass Turnstile:</span> Hệ thống tự động giải mã Cloudflare trong 3-5s. Chỉ cần nhập cookie khi tài liệu yêu cầu Premium.
            </div>
            <div>
              <label class="block text-xs font-mono text-zinc-700 dark:text-zinc-300 mb-1">Chuỗi Cookie</label>
              <textarea
                id="studocuCookieInput"
                rows="2"
                placeholder="studocu_session=...; cf_clearance=..."
                class="w-full text-xs font-mono bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/60 rounded-lg p-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-sky-500 transition resize-none"
              ></textarea>
            </div>
            <div class="flex items-center justify-between pt-1">
              <button
                type="button"
                id="btnResetStudocuSession"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
              >
                <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                <span>Xóa session</span>
              </button>
              <span id="studocuResetStatus" class="text-xs font-mono text-emerald-500 dark:text-emerald-400"></span>
            </div>
          </div>
        </div>
      </form>
    </div>
  `.trim();
}
