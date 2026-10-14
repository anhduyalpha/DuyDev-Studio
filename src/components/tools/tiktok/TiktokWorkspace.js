/**
 * TikTok Workspace Component
 * Native high-performance TikTok Downloader & Drive Saver for DD Studio.
 * Zero-flicker selective DOM updates eliminating input focus loss and mobile clipboard freeze.
 */

import { tiktokManager } from './hooks/useTiktok.js';
import { tiktokApi } from './services/tiktokApi.js';
import { showToast } from '../../../utilities/toast.js';

function formatCompactNumber(num) {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTiktokWorkspace() {
  const state = tiktokManager.getState();
  const { url, isLoading, error, videoData, isSavingDrive, savedDriveResult, recentHistory, existingInDrive, isForceResave, duplicatePreCheck } = state;
  const hasUrl = Boolean(url && url.length > 0);

  return `
    <div id="tiktokWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-12">
      <!-- Breadcrumb Bar -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-[#EE1D52]"></span>
            TikTok Downloader
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <i data-lucide="check" class="w-3 h-3"></i> Không Logo
          </span>
        </div>
      </div>

      <!-- Hero Input Card (Permanent DOM Node - Never fully destroyed) -->
      <div id="tiktokHeroCard" class="relative p-4 sm:p-6 rounded-2xl bg-white/90 dark:bg-[#121215]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm backdrop-blur-xl">
        <div class="flex flex-col sm:flex-row items-center gap-3">
          <div class="relative flex-1 w-full">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <i data-lucide="link-2" class="w-4 h-4"></i>
            </div>
            <input
              id="tiktokUrlInput"
              type="url"
              placeholder="Dán liên kết TikTok (vd: https://vt.tiktok.com/... hoặc tiktok.com/@user/video/...)"
              value="${escapeHtml(url)}"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              class="w-full pl-10 pr-20 py-3 rounded-xl text-sm bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 transition"
              ${isLoading ? 'disabled' : ''}
            />
            <div class="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
              <button
                id="btnClearTiktokUrl"
                type="button"
                class="${hasUrl ? '' : 'hidden'} p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
                title="Xóa"
              >
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>

              <button
                id="btnPasteTiktokClipboard"
                type="button"
                class="${hasUrl ? 'hidden' : ''} px-2.5 py-1.5 rounded-lg bg-zinc-200/60 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer active:scale-95"
                title="Dán từ Clipboard"
              >
                <i data-lucide="clipboard" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Dán</span>
              </button>
            </div>
          </div>

          <button
            id="btnResolveTiktok"
            type="button"
            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white text-sm font-semibold shadow-sm hover:shadow-rose-600/20 transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            ${isLoading ? 'disabled' : ''}
          >
            ${isLoading ? `
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Đang xử lý...</span>
            ` : `
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>Tải Video</span>
            `}
          </button>
        </div>

        <!-- Duplicate Pre-Check Banner -->
        <div id="tiktokDuplicatePreCheckBanner" class="${duplicatePreCheck && !videoData ? '' : 'hidden'} mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="info" class="w-4 h-4 shrink-0 text-amber-500"></i>
            <span class="truncate">Video này đã có trong Studio Drive: <strong class="dup-name">${escapeHtml(duplicatePreCheck?.fileName || '')}</strong></span>
          </div>
          <a href="#storage?path=/tiktok" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold shrink-0 transition">
            Mở trong Drive
          </a>
        </div>

        <!-- Inline Error Banner -->
        <div id="tiktokErrorBanner" class="${error ? '' : 'hidden'} mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
          <span class="err-msg">${escapeHtml(error || '')}</span>
        </div>
      </div>

      <!-- Result Container (Surgically Updated) -->
      <div id="tiktokResultContainer">
        ${videoData ? renderResultCard(videoData, isSavingDrive, savedDriveResult, existingInDrive, isForceResave) : ''}
      </div>

      <!-- Recent History Container (Surgically Updated) -->
      <div id="tiktokHistoryContainer">
        ${recentHistory && recentHistory.length > 0 ? renderRecentHistoryCard(recentHistory) : ''}
      </div>
    </div>
  `.trim();
}

function renderResultCard(video, isSavingDrive, savedDriveResult, existingInDriveParam, isForceResave = false) {
  const existingInDrive = existingInDriveParam || video.existingInDrive;
  const streamUrl = tiktokApi.getStreamUrl(video.videoUrl, `tiktok_${video.id}.mp4`);
  const streamHdUrl = video.videoHdUrl ? tiktokApi.getStreamUrl(video.videoHdUrl, `tiktok_${video.id}_HD.mp4`) : '';
  const downloadUrl = tiktokApi.getStreamUrl(video.videoUrl, `tiktok_${video.id}.mp4`, true);
  const downloadHdUrl = video.videoHdUrl ? tiktokApi.getStreamUrl(video.videoHdUrl, `tiktok_${video.id}_HD.mp4`, true) : '';
  const audioDownloadUrl = video.audioUrl ? tiktokApi.getStreamUrl(video.audioUrl, `tiktok_${video.id}_audio.mp3`, true) : '';

  return `
    <div id="tiktokResultCard" class="p-4 sm:p-6 rounded-2xl bg-white/90 dark:bg-[#121215]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm backdrop-blur-xl space-y-6 animate-fadeIn">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <!-- Column 1: Video Player (5 cols) -->
        <div class="md:col-span-5 flex flex-col items-center">
          <div class="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-lg border border-zinc-200/60 dark:border-zinc-800/80">
            <video
              id="tiktokPlayer"
              src="${streamUrl}"
              poster="${video.cover}"
              controls
              playsinline
              loop
              preload="metadata"
              class="w-full h-full object-contain"
            ></video>
          </div>
        </div>

        <!-- Column 2: Metadata & Download Actions (7 cols) -->
        <div class="md:col-span-7 space-y-4">
          <!-- Author Header -->
          <div class="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            ${video.author?.avatar ? `
              <img src="${video.author.avatar}" alt="${escapeHtml(video.author.nickname)}" class="w-11 h-11 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" onerror="this.style.display='none'"/>
            ` : `
              <div class="w-11 h-11 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-sm shrink-0">
                ${(video.author?.nickname || 'TT').slice(0, 2).toUpperCase()}
              </div>
            `}
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">${escapeHtml(video.author?.nickname || 'Người dùng TikTok')}</h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">@${escapeHtml(video.author?.uniqueId || 'tiktok_user')}</p>
            </div>
            <div class="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 shrink-0">
              ${formatDuration(video.duration)}
            </div>
          </div>

          <!-- Video Title / Caption -->
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-24 overflow-y-auto">
            ${escapeHtml(video.title)}
          </div>

          <!-- Metrics Row -->
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
              <span class="block text-[10px] text-zinc-400 uppercase">Lượt xem</span>
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">${formatCompactNumber(video.stats?.views)}</span>
            </div>
            <div class="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
              <span class="block text-[10px] text-zinc-400 uppercase">Thích</span>
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">${formatCompactNumber(video.stats?.likes)}</span>
            </div>
            <div class="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
              <span class="block text-[10px] text-zinc-400 uppercase">Bình luận</span>
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">${formatCompactNumber(video.stats?.comments)}</span>
            </div>
            <div class="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60">
              <span class="block text-[10px] text-zinc-400 uppercase">Chia sẻ</span>
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">${formatCompactNumber(video.stats?.shares)}</span>
            </div>
          </div>

          <!-- Duplicate in Storage Alert -->
          ${existingInDrive ? `
            <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div class="flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400 min-w-0">
                <i data-lucide="alert-circle" class="w-4 h-4 shrink-0 text-amber-500"></i>
                <span class="truncate">Video này đã có trong Studio Drive (<strong>${escapeHtml(existingInDrive.fileName)}</strong>)</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a
                  href="#storage?path=/tiktok"
                  class="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                  <span>Mở trong Drive</span>
                </a>
                <button
                  id="btnForceResaveTiktok"
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg ${isForceResave ? 'bg-rose-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'} text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  title="Cho phép ghi đè và lưu lại vào Drive"
                >
                  <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                  <span>${isForceResave ? 'Đang bật ghi đè' : 'Tải lại'}</span>
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Action Buttons Grid -->
          <div class="space-y-2 pt-2">
            <!-- 1. Primary Download Video -->
            <a
              href="${downloadUrl}"
              class="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Tải Video MP4 (Không Logo)</span>
            </a>

            <!-- 2. HD Download (If available) -->
            ${downloadHdUrl ? `
              <a
                href="${downloadHdUrl}"
                class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <i data-lucide="sparkles" class="w-4 h-4"></i>
                <span>Tải Bản Độ Phân Giải Cao (HD)</span>
              </a>
            ` : ''}

            <!-- 3. MP3 Audio Download -->
            ${audioDownloadUrl ? `
              <a
                href="${audioDownloadUrl}"
                class="w-full py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 active:scale-[0.99] text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer border border-zinc-200 dark:border-zinc-700"
              >
                <i data-lucide="music" class="w-4 h-4"></i>
                <span>Tải Audio (mp3)</span>
              </a>
            ` : ''}

            <!-- 4. Save to Studio Drive -->
            ${existingInDrive && !isForceResave ? `
              <button
                id="btnSaveTiktokDrive"
                type="button"
                disabled
                class="w-full py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 text-zinc-400 dark:text-zinc-500 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>
                <span>Đã lưu trong Drive</span>
              </button>
            ` : isForceResave ? `
              <button
                id="btnSaveTiktokDrive"
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                ${isSavingDrive ? 'disabled' : ''}
              >
                ${isSavingDrive ? `
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Đang ghi đè vào Drive...</span>
                ` : `
                  <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                  <span>Ghi Đè & Lưu Lại Vào Studio Drive</span>
                `}
              </button>
            ` : `
              <button
                id="btnSaveTiktokDrive"
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.99] border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                ${isSavingDrive ? 'disabled' : ''}
              >
                ${isSavingDrive ? `
                  <div class="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
                  <span>Đang lưu vào Drive...</span>
                ` : `
                  <i data-lucide="hard-drive" class="w-4 h-4"></i>
                  <span>Lưu Trực Tiếp Vào Studio Drive</span>
                `}
              </button>
            `}

            <!-- 5. Secondary Quick Links Row -->
            <div class="flex items-center justify-between gap-2 pt-2">
              <button
                id="btnCopyTiktokDirectLink"
                type="button"
                data-stream-url="${streamUrl}"
                class="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>Sao chép link tải</span>
              </button>

              <button
                id="btnCopyCaption"
                type="button"
                data-caption="${escapeHtml(video.title)}"
                class="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                <span>Sao chép caption</span>
              </button>
            </div>

            <!-- Saved Drive Feedback Banner -->
            ${savedDriveResult ? `
              <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 animate-fadeIn">
                <div class="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <i data-lucide="check-circle" class="w-4 h-4 shrink-0"></i>
                  <span class="truncate">Đã lưu: <strong>${escapeHtml(savedDriveResult.fileName)}</strong></span>
                </div>
                <a
                  href="#storage?path=/tiktok"
                  class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold shrink-0 transition"
                >
                  Mở Thư Mục
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function renderRecentHistoryCard(history) {
  return `
    <div class="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-[#121215]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm backdrop-blur-xl space-y-3 animate-fadeIn">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-zinc-400"></i>
          Lịch Sử Tải Xuống
        </h4>
        <button
          id="btnClearTiktokHistory"
          type="button"
          class="text-[11px] text-zinc-400 hover:text-red-500 transition cursor-pointer"
        >
          Xóa lịch sử
        </button>
      </div>

      <div class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        ${history.map((it) => `
          <div class="py-2.5 flex items-center justify-between gap-3 group">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              ${it.cover ? `
                <img src="${it.cover}" alt="cover" class="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0" onerror="this.style.display='none'"/>
              ` : `
                <div class="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <i data-lucide="video" class="w-4 h-4"></i>
                </div>
              `}
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">${escapeHtml(it.title || 'TikTok Video')}</p>
                <p class="text-[11px] text-zinc-400 truncate">@${escapeHtml(it.author || 'tiktok')} • ${formatDuration(it.duration)}</p>
              </div>
            </div>

            <button
              type="button"
              data-re-resolve-url="${escapeHtml(it.url)}"
              class="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-600 hover:text-white text-zinc-600 dark:text-zinc-300 text-xs font-medium transition cursor-pointer shrink-0"
            >
              Mở lại
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `.trim();
}

export function attachTiktokWorkspaceListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();

  const input = document.getElementById('tiktokUrlInput');
  const btnResolve = document.getElementById('btnResolveTiktok');
  const btnPaste = document.getElementById('btnPasteTiktokClipboard');
  const btnClear = document.getElementById('btnClearTiktokUrl');
  const errBanner = document.getElementById('tiktokErrorBanner');
  const resultContainer = document.getElementById('tiktokResultContainer');
  const historyContainer = document.getElementById('tiktokHistoryContainer');

  function syncInputButtons(val) {
    const hasValue = Boolean(val && val.length > 0);
    if (btnClear) btnClear.classList.toggle('hidden', !hasValue);
    if (btnPaste) btnPaste.classList.toggle('hidden', hasValue);
  }

  function attachResultCardListeners() {
    const btnSaveDrive = document.getElementById('btnSaveTiktokDrive');
    const btnForceResave = document.getElementById('btnForceResaveTiktok');
    const btnCopyDirect = document.getElementById('btnCopyTiktokDirectLink');
    const btnCopyCaption = document.getElementById('btnCopyCaption');

    if (btnSaveDrive) {
      btnSaveDrive.onclick = () => {
        tiktokManager.saveCurrentToDrive();
      };
    }

    if (btnForceResave) {
      btnForceResave.onclick = () => {
        tiktokManager.setForceResave(true);
      };
    }

    if (btnCopyDirect) {
      btnCopyDirect.onclick = async () => {
        const url = btnCopyDirect.getAttribute('data-stream-url');
        if (url) {
          const fullUrl = window.location.origin + url;
          try {
            await navigator.clipboard.writeText(fullUrl);
            showToast('Đã sao chép link stream video', 'success');
          } catch {
            showToast('Không thể sao chép link', 'error');
          }
        }
      };
    }

    if (btnCopyCaption) {
      btnCopyCaption.onclick = async () => {
        const caption = btnCopyCaption.getAttribute('data-caption');
        if (caption) {
          try {
            await navigator.clipboard.writeText(caption);
            showToast('Đã sao chép caption', 'success');
          } catch {
            showToast('Không thể sao chép caption', 'error');
          }
        }
      };
    }

    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function attachHistoryListeners() {
    document.querySelectorAll('[data-re-resolve-url]').forEach((btn) => {
      btn.onclick = () => {
        const targetUrl = btn.getAttribute('data-re-resolve-url');
        if (targetUrl) {
          if (input) {
            input.value = targetUrl;
            syncInputButtons(targetUrl);
          }
          tiktokManager.setUrl(targetUrl, false);
          tiktokManager.resolve(targetUrl);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    });

    const btnClearHistory = document.getElementById('btnClearTiktokHistory');
    if (btnClearHistory) {
      btnClearHistory.onclick = () => {
        tiktokManager.clearHistory();
        showToast('Đã xóa lịch sử gần đây', 'info');
      };
    }

    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  // Subscribe to state changes for SURGICAL in-place updates (Zero full-DOM destruction)
  const unsubscribe = tiktokManager.subscribe((state, event) => {
    // 1. Loading state on button and input
    if (btnResolve) {
      btnResolve.disabled = state.isLoading;
      btnResolve.innerHTML = state.isLoading
        ? '<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Đang xử lý...</span>'
        : '<i data-lucide="sparkles" class="w-4 h-4"></i><span>Tải Video</span>';
    }
    if (input) {
      input.disabled = state.isLoading;
      if (state.url && input.value !== state.url) {
        input.value = state.url;
        syncInputButtons(state.url);
      }
    }

    // 2. Error banner
    if (errBanner) {
      if (state.error) {
        errBanner.classList.remove('hidden');
        const msgEl = errBanner.querySelector('.err-msg');
        if (msgEl) msgEl.textContent = state.error;
      } else {
        errBanner.classList.add('hidden');
      }
    }

    // 2.1 Duplicate pre-check banner
    const preCheckBanner = document.getElementById('tiktokDuplicatePreCheckBanner');
    if (preCheckBanner) {
      if (state.duplicatePreCheck && !state.videoData) {
        preCheckBanner.classList.remove('hidden');
        const nameEl = preCheckBanner.querySelector('.dup-name');
        if (nameEl) nameEl.textContent = state.duplicatePreCheck.fileName;
      } else {
        preCheckBanner.classList.add('hidden');
      }
    }

    // 3. Result Container
    if (resultContainer) {
      if (state.videoData) {
        resultContainer.innerHTML = renderResultCard(state.videoData, state.isSavingDrive, state.savedDriveResult, state.existingInDrive, state.isForceResave);
        attachResultCardListeners();
      } else {
        resultContainer.innerHTML = '';
      }
    }

    // 4. History Container
    if (historyContainer) {
      historyContainer.innerHTML = state.recentHistory?.length > 0 ? renderRecentHistoryCard(state.recentHistory) : '';
      attachHistoryListeners();
    }

    if (window.lucide?.createIcons) window.lucide.createIcons();
  });

  // Attach listeners to current results and history
  attachResultCardListeners();
  attachHistoryListeners();

  // Input typing (NEVER re-renders the input!)
  let preCheckTimer = null;
  if (input) {
    input.oninput = (e) => {
      const val = e.target.value;
      syncInputButtons(val);
      tiktokManager.setUrl(val, false);
      clearTimeout(preCheckTimer);
      if (val && val.length > 12) {
        preCheckTimer = setTimeout(() => {
          tiktokManager.checkDuplicateUrl(val);
        }, 400);
      } else {
        const preCheckBanner = document.getElementById('tiktokDuplicatePreCheckBanner');
        if (preCheckBanner) preCheckBanner.classList.add('hidden');
      }
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(preCheckTimer);
        tiktokManager.resolve(input.value);
      }
    };
  }

  // Resolve click
  if (btnResolve) {
    btnResolve.onclick = () => {
      const val = input?.value || tiktokManager.getState().url;
      tiktokManager.resolve(val);
    };
  }

  // Clear button
  if (btnClear) {
    btnClear.onclick = () => {
      if (input) {
        input.value = '';
        input.focus();
      }
      syncInputButtons('');
      tiktokManager.clear();
    };
  }

  // Non-blocking Mobile Clipboard Paste with Timeout & Focus Fallback
  if (btnPaste) {
    btnPaste.onclick = async () => {
      if (tiktokManager.getState().isLoading) return;

      let pastedText = '';
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        try {
          const clipPromise = navigator.clipboard.readText();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('CLIPBOARD_TIMEOUT')), 1200)
          );
          pastedText = await Promise.race([clipPromise, timeoutPromise]);
        } catch (err) {
          // Gracefully caught: Permission denied, dialog dismiss, or timeout on Android
          console.warn('[TikTok] Clipboard access failed or timed out:', err);
        }
      }

      if (pastedText && typeof pastedText === 'string' && pastedText.trim()) {
        const clean = pastedText.trim();
        if (input) {
          input.value = clean;
          syncInputButtons(clean);
        }
        tiktokManager.setUrl(clean, false);
        tiktokManager.resolve(clean);
        return;
      }

      // If clipboard was empty or blocked, focus input for native long-press paste
      if (input) {
        input.focus();
        input.select();
      }
      showToast('Nhấn giữ ô nhập để dán liên kết', 'info');
    };
  }

  return () => {
    unsubscribe();
  };
}
