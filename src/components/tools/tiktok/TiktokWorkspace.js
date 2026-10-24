/**
 * TikTok Workspace Component
 * Native high-performance TikTok Downloader & Drive Saver for DD Studio.
 * Zero-flicker selective DOM updates eliminating input focus loss and mobile clipboard freeze.
 * Features dirty-text URL extraction, Drive-linked history, and batch queue with taskCoordinator.
 */

import { tiktokManager, extractTiktokUrls } from './hooks/useTiktok.js';
import { tiktokApi } from './services/tiktokApi.js';
import { showToast } from '../../../utilities/toast.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { StorageService } from '../../../services/storageService.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { readText } from '../../../utilities/clipboard.js';

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
  const { url, isLoading, error, videoData, isSavingDrive, savedDriveResult, recentHistory, existingInDrive, isForceResave, duplicatePreCheck, batchQueue } = state;
  const hasUrl = Boolean(url && url.length > 0);

  return `
    <div id="tiktokWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-12 md:pb-16">
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
            <i data-lucide="check" class="w-3 h-3"></i> Video & Album Ảnh Không Logo
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
              type="text"
              placeholder="Dán liên kết TikTok (Video hoặc Album ảnh)..."
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
              <span id="btnResolveText">${url && url.includes('/photo/') ? 'Tải Album Ảnh' : 'Tải Video / Album Ảnh'}</span>
            `}
          </button>
        </div>

        <!-- Batch Progress Banner -->
        <div id="tiktokBatchProgressBanner" class="${batchQueue && batchQueue.isActive ? '' : 'hidden'} mt-3 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3 animate-fadeIn">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-2.5 h-2.5 rounded-full bg-indigo-500 ${batchQueue && batchQueue.isActive ? 'animate-ping' : ''} shadow-[0_0_8px_rgba(99,102,241,0.6)] shrink-0"></div>
            <div class="min-w-0">
              <p class="font-semibold truncate">
                Đang lưu hàng loạt vào Drive: <span id="tiktokBatchCountText">${batchQueue?.current || 0}/${batchQueue?.total || 0}</span>
              </p>
              <p id="tiktokBatchStageText" class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                ${escapeHtml(batchQueue?.currentTitle || 'Đang xử lý...')}
              </p>
            </div>
          </div>
          <button
            id="btnCancelTiktokBatch"
            type="button"
            class="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 font-medium text-[11px] transition cursor-pointer shrink-0"
          >
            Dừng
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
          <span class="err-msg">${escapeHtml(typeof error === 'string' && error !== '[object Object]' ? error : (error?.message || ''))}</span>
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
  const isSlideshow = Boolean(video.isSlideshow && video.images && video.images.length > 0);
  const images = isSlideshow ? video.images : [];

  const streamUrl = tiktokApi.getStreamUrl(video.videoUrl, `tiktok_${video.id}.mp4`);
  const streamHdUrl = video.videoHdUrl ? tiktokApi.getStreamUrl(video.videoHdUrl, `tiktok_${video.id}_HD.mp4`) : '';
  const downloadUrl = tiktokApi.getStreamUrl(video.videoUrl, `tiktok_${video.id}.mp4`, true);
  const downloadHdUrl = video.videoHdUrl ? tiktokApi.getStreamUrl(video.videoHdUrl, `tiktok_${video.id}_HD.mp4`, true) : '';
  const audioDownloadUrl = video.audioUrl ? tiktokApi.getStreamUrl(video.audioUrl, `tiktok_${video.id}_audio.mp3`, true) : '';
  const audioStreamUrl = video.audioUrl ? tiktokApi.getStreamUrl(video.audioUrl, `tiktok_${video.id}_audio.mp3`) : '';

  const firstSlideStream = images.length > 0 ? tiktokApi.getStreamUrl(images[0], `slide_01.jpg`) : '';
  const firstSlideDownload = images.length > 0 ? tiktokApi.getStreamUrl(images[0], `slide_01.jpg`, true) : '';

  return `
    <div id="tiktokResultCard" class="p-4 sm:p-6 rounded-2xl bg-white/90 dark:bg-[#121215]/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm backdrop-blur-xl space-y-6 animate-fadeIn">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <!-- Column 1: Media Preview (5 cols) -->
        <div class="md:col-span-5 flex flex-col items-center w-full">
          ${isSlideshow ? `
            <div class="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-lg border border-zinc-200/60 dark:border-zinc-800/80 group select-none flex items-center justify-center">
              <img
                id="tiktokSlideImage"
                src="${firstSlideStream}"
                alt="TikTok Slide"
                data-current-index="0"
                decoding="async"
                class="w-full h-full object-contain transition-opacity duration-200"
              />

              <!-- Top badges -->
              <span id="tiktokSlideCounterBadge" class="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-mono font-semibold border border-white/10 z-10">
                1 / ${images.length}
              </span>

              <span class="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 z-10 shadow-xs">
                <i data-lucide="images" class="w-3 h-3"></i> Album
              </span>

              <!-- Navigation arrows -->
              ${images.length > 1 ? `
                <button
                  id="btnPrevTiktokSlide"
                  type="button"
                  class="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition opacity-80 hover:opacity-100 cursor-pointer z-10"
                  title="Ảnh trước"
                >
                  <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>
                <button
                  id="btnNextTiktokSlide"
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition opacity-80 hover:opacity-100 cursor-pointer z-10"
                  title="Ảnh tiếp"
                >
                  <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
              ` : ''}

              <!-- View Full Slide / Open in New Tab -->
              <a
                id="btnViewFullSlide"
                href="${firstSlideStream}"
                target="_blank"
                rel="noopener noreferrer"
                class="absolute bottom-12 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition opacity-80 hover:opacity-100 cursor-pointer z-10"
                title="Mở ảnh kích thước gốc"
              >
                <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
              </a>

              <!-- Thumbnails strip overlay at bottom -->
              ${images.length > 1 ? `
                <div id="tiktokThumbStrip" class="absolute bottom-2 inset-x-2 flex items-center justify-start gap-1.5 overflow-x-auto py-1 px-1 bg-black/70 backdrop-blur-md rounded-xl z-10 scrollbar-none">
                  ${images.map((img, idx) => `
                    <button
                      type="button"
                      data-slide-index="${idx}"
                      class="tiktok-thumb-btn w-6 h-9 rounded-md overflow-hidden border ${idx === 0 ? 'border-rose-500 ring-1 ring-rose-500 scale-105' : 'border-white/30 opacity-60 hover:opacity-100'} transition shrink-0 cursor-pointer"
                    >
                      <img src="${tiktokApi.getStreamUrl(img, `slide_${idx + 1}.jpg`)}" class="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <!-- Background Music Player for Slideshow -->
            ${video.audioUrl ? `
              <div class="w-full max-w-[280px] sm:max-w-[320px] mt-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2.5">
                <div class="flex items-center gap-2 min-w-0">
                  <button
                    id="btnToggleTiktokAudio"
                    type="button"
                    class="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition cursor-pointer shrink-0 shadow-xs active:scale-95"
                    title="Phát / Dừng nhạc nền"
                  >
                    <i id="tiktokAudioIcon" data-lucide="play" class="w-3.5 h-3.5 ml-0.5"></i>
                  </button>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">Nhạc nền TikTok</p>
                    <p id="tiktokAudioTimeText" class="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">0:00 / ${formatDuration(video.duration)}</p>
                  </div>
                </div>
                <audio id="tiktokAudioPlayer" src="${audioStreamUrl}" preload="none" class="hidden"></audio>
                <a
                  id="btnDownloadSlideshowAudio"
                  href="${audioDownloadUrl}"
                  download
                  class="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10 transition cursor-pointer shrink-0"
                  title="Tải audio (mp3)"
                >
                  <i data-lucide="download" class="w-4 h-4"></i>
                </a>
              </div>
            ` : ''}
          ` : `
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
          `}
        </div>

        <!-- Column 2: Metadata & Download Actions (7 cols) -->
        <div class="md:col-span-7 space-y-4">
          <!-- Author Header -->
          <div class="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            ${video.author?.avatar ? `
              <img src="${video.author.avatar}" alt="${escapeHtml(video.author.nickname)}" class="w-11 h-11 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" loading="lazy" decoding="async" onerror="this.style.display='none'"/>
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
              ${isSlideshow ? `${images.length} Ảnh` : formatDuration(video.duration)}
            </div>
          </div>

          <!-- Video Title / Caption -->
          <div class="p-3 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-24 overflow-y-auto">
            ${escapeHtml(video.title)}
          </div>

          <!-- Metrics Row -->
          <div class="grid grid-cols-4 gap-2 text-center py-2 px-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-zinc-800/60">
            <div>
              <p class="text-[10px] text-zinc-400 uppercase tracking-wider">Lượt xem</p>
              <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mt-0.5">${formatCompactNumber(video.stats?.views ?? video.stats?.playCount)}</p>
            </div>
            <div>
              <p class="text-[10px] text-zinc-400 uppercase tracking-wider">Thích</p>
              <p class="text-xs font-semibold text-rose-500 mt-0.5">${formatCompactNumber(video.stats?.likes ?? video.stats?.diggCount)}</p>
            </div>
            <div>
              <p class="text-[10px] text-zinc-400 uppercase tracking-wider">Bình luận</p>
              <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mt-0.5">${formatCompactNumber(video.stats?.comments ?? video.stats?.commentCount)}</p>
            </div>
            <div>
              <p class="text-[10px] text-zinc-400 uppercase tracking-wider">Chia sẻ</p>
              <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mt-0.5">${formatCompactNumber(video.stats?.shares ?? video.stats?.shareCount)}</p>
            </div>
          </div>

          <!-- Action Buttons Group -->
          <div class="space-y-2 pt-2">
            ${isSlideshow ? `
              <!-- 1. Download Full Album ZIP -->
              <button
                id="btnDownloadSlideshowZip"
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-75 disabled:cursor-wait"
              >
                <i data-lucide="archive" class="w-4 h-4"></i>
                <span class="zip-progress-text">Tải Toàn Bộ Album (${images.length} Ảnh) + Nhạc (.ZIP)</span>
              </button>

              <!-- 2. Download Current Slide Image -->
              <a
                id="btnDownloadSingleSlide"
                href="${firstSlideDownload}"
                download="tiktok_slide_01.jpg"
                class="w-full py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/15 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <i data-lucide="image" class="w-3.5 h-3.5 text-amber-400"></i>
                <span class="slide-dl-text">Tải Ảnh Này (slide 1/${images.length})</span>
              </a>
            ` : `
              <!-- 1. Download Standard Video -->
              <a
                id="btnDownloadStandard"
                href="${downloadUrl}"
                download
                class="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <i data-lucide="download" class="w-4 h-4"></i>
                <span>Tải Video (Gốc)</span>
              </a>

              <!-- 2. Download HD Video (if available) -->
              ${video.videoHdUrl ? `
                <a
                  id="btnDownloadHd"
                  href="${downloadHdUrl}"
                  download
                  class="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/15 active:scale-[0.99] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <i data-lucide="sparkles" class="w-4 h-4 text-amber-400"></i>
                  <span>Tải Video (Chất Lượng Cao HD)</span>
                </a>
              ` : ''}
            `}

            <!-- 3. Download Audio MP3 -->
            ${video.audioUrl ? `
              <a
                id="btnDownloadAudio"
                href="${audioDownloadUrl}"
                download
                class="w-full py-2 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-[0.99] text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <i data-lucide="music" class="w-3.5 h-3.5 text-emerald-500"></i>
                <span>Tải Audio (mp3)</span>
              </a>
            ` : ''}

            <!-- Duplicate Warning Alert Box (when exists in Drive) -->
            ${existingInDrive ? `
              <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-400 flex items-center justify-between gap-3 animate-fadeIn">
                <div class="flex items-center gap-2 min-w-0">
                  <i data-lucide="check-circle" class="w-4 h-4 text-amber-500 shrink-0"></i>
                  <span class="truncate">${isSlideshow ? 'Album ảnh này' : 'Video này'} đã có trong Studio Drive (${escapeHtml(existingInDrive.fileName || '')})</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <a href="#storage?path=/tiktok" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition">
                    Mở trong Drive
                  </a>
                  <button id="btnForceResaveTiktok" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium transition cursor-pointer">
                    Tải lại
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- 4. Save Directly to Studio Drive Button -->
            ${existingInDrive && !isForceResave ? `
              <button
                type="button"
                disabled
                class="w-full py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed border border-zinc-200/50 dark:border-zinc-800/50"
              >
                <i data-lucide="check-check" class="w-4 h-4 text-emerald-500"></i>
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
                  <span>${isSlideshow ? 'Đang ghi đè album vào Drive...' : 'Đang ghi đè vào Drive...'}</span>
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
                  <span>${isSlideshow ? 'Đang đóng gói và lưu vào Drive...' : 'Đang lưu vào Drive...'}</span>
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
                <span>Sao chép link stream</span>
              </button>

              <button
                id="btnCopyCaption"
                type="button"
                data-caption="${escapeHtml(video.title || '')}"
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
        ${history.map((it) => {
          const hasDrive = Boolean(it.driveRelPath);
          const driveDownloadUrl = hasDrive ? StorageService.getDownloadUrl(it.driveRelPath, false) : '';
          const isSlide = Boolean(it.isSlideshow);

          return `
            <div class="py-2.5 flex items-center justify-between gap-3 group">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                ${it.cover ? `
                  <img src="${it.cover}" alt="cover" class="w-10 h-10 rounded-lg object-cover bg-zinc-800 shrink-0" loading="lazy" decoding="async" onerror="this.style.display='none'"/>
                ` : `
                  <div class="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                    <i data-lucide="${isSlide ? 'images' : 'video'}" class="w-4 h-4"></i>
                  </div>
                `}
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <p class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">${escapeHtml(it.title || (isSlide ? 'TikTok Album' : 'TikTok Video'))}</p>
                    ${isSlide ? `
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0 flex items-center gap-1">
                        <i data-lucide="images" class="w-2.5 h-2.5"></i> Album
                      </span>
                    ` : ''}
                    ${hasDrive ? `
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 flex items-center gap-1">
                        <i data-lucide="check" class="w-2.5 h-2.5"></i> Đã lưu Drive
                      </span>
                    ` : ''}
                  </div>
                  <p class="text-[11px] text-zinc-400 truncate mt-0.5">@${escapeHtml(it.author || 'tiktok')} • ${isSlide ? `${it.slideCount || 'Album'} Ảnh` : formatDuration(it.duration)}</p>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                ${hasDrive ? `
                  <button
                    type="button"
                    data-preview-drive-path="${escapeHtml(it.driveRelPath)}"
                    data-item-title="${escapeHtml(it.title || (isSlide ? 'album.zip' : 'video.mp4'))}"
                    class="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs transition cursor-pointer"
                    title="${isSlide ? 'Xem tệp trong Drive' : 'Xem trước video'}"
                  >
                    <i data-lucide="${isSlide ? 'archive' : 'eye'}" class="w-3.5 h-3.5"></i>
                  </button>
                  <a
                    href="${driveDownloadUrl}"
                    download
                    class="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-600 dark:text-zinc-300 text-xs transition cursor-pointer flex items-center justify-center"
                    title="Tải từ Studio Drive (Không bao giờ hết hạn)"
                  >
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  </a>
                  <a
                    href="#storage?path=/tiktok"
                    class="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-600 dark:text-zinc-300 text-xs transition cursor-pointer flex items-center justify-center"
                    title="Mở trong Studio Drive"
                  >
                    <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
                  </a>
                ` : ''}

                <button
                  type="button"
                  data-re-resolve-url="${escapeHtml(it.url)}"
                  class="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-600 hover:text-white text-zinc-600 dark:text-zinc-300 text-xs font-medium transition cursor-pointer shrink-0"
                  title="Lấy lại link TikTok"
                >
                  Mở lại
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `.trim();
}

/**
 * Lazily ensure JSZip library is available in the window context
 */
async function ensureJSZip() {
  if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="jszip"]');
    if (existing) {
      if (window.JSZip) return resolve(window.JSZip);
      existing.addEventListener('load', () => resolve(window.JSZip));
      existing.addEventListener('error', () => reject(new Error('Không thể nạp thư viện JSZip')));
      return;
    }
    const script = document.createElement('script');
    script.src = '/src/vendor/jszip.min.js';
    script.onload = () => {
      if (window.JSZip) resolve(window.JSZip);
      else reject(new Error('JSZip không khởi tạo được trên trình duyệt'));
    };
    script.onerror = () => reject(new Error('Không thể nạp thư viện JSZip từ máy chủ'));
    document.head.appendChild(script);
  });
}

/**
 * Bundle all slideshow images + background MP3 audio into a single client-side .ZIP
 */
async function downloadSlideshowZip(video) {
  const btn = document.getElementById('btnDownloadSlideshowZip');
  const textSpan = btn?.querySelector('.zip-progress-text');
  const originalHtml = btn?.innerHTML || '';

  try {
    if (btn) btn.disabled = true;
    if (textSpan) textSpan.textContent = 'Đang khởi tạo thư viện nén...';

    const JSZipLib = await ensureJSZip();
    const zip = new JSZipLib();
    const images = Array.isArray(video.images) ? video.images : [];

    if (images.length === 0) {
      throw new Error('Không tìm thấy danh sách ảnh trong album');
    }

    // 1. Fetch each slide image via proxy to avoid CORS blocks
    for (let i = 0; i < images.length; i++) {
      const pad = String(i + 1).padStart(2, '0');
      if (textSpan) textSpan.textContent = `Đang tải ảnh ${i + 1}/${images.length}...`;
      const proxiedUrl = tiktokApi.getStreamUrl(images[i], `slide_${pad}.jpg`);
      const res = await fetch(proxiedUrl);
      if (!res.ok) throw new Error(`Lỗi tải ảnh slide ${i + 1} (${res.status})`);
      const blob = await res.blob();
      zip.file(`slide_${pad}.jpg`, blob);
    }

    // 2. Fetch background audio if present
    if (video.audioUrl) {
      if (textSpan) textSpan.textContent = 'Đang tải nhạc nền...';
      try {
        const audioProxiedUrl = tiktokApi.getStreamUrl(video.audioUrl, 'audio.mp3');
        const audioRes = await fetch(audioProxiedUrl);
        if (audioRes.ok) {
          const audioBlob = await audioRes.blob();
          zip.file('audio.mp3', audioBlob);
        }
      } catch (audioErr) {
        console.warn('[TikTok] Background audio fetch failed:', audioErr);
      }
    }

    // 3. Compress into .ZIP file
    if (textSpan) textSpan.textContent = 'Đang đóng gói file .ZIP...';
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      if (textSpan && typeof metadata.percent === 'number') {
        textSpan.textContent = `Đang nén ${Math.round(metadata.percent)}%...`;
      }
    });

    // 4. Trigger browser download or native Android APK save
    const cleanTitle = (video.title || 'tiktok_album').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40).trim();
    const zipFileName = `[TikTok]_${cleanTitle || 'album'}_${video.id || Date.now()}.zip`;

    if (window.AndroidBridge?.saveBase64File) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = (reader.result || '').split(',')[1] || '';
        if (base64data) {
          window.AndroidBridge.saveBase64File(base64data, zipFileName, 'application/zip');
          showToast('Đã lưu album ZIP vào máy!', 'success');
        }
      };
      reader.readAsDataURL(zipBlob);
    } else {
      const blobUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      showToast('Tải album ảnh + nhạc thành công!', 'success');
    }
  } catch (err) {
    console.error('[TikTok] ZIP download error:', err);
    showToast(err.message || 'Lỗi khi đóng gói album ZIP', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
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
  const batchBanner = document.getElementById('tiktokBatchProgressBanner');
  const btnCancelBatch = document.getElementById('btnCancelTiktokBatch');

  function syncInputButtons(val) {
    const hasValue = Boolean(val && val.length > 0);
    if (btnClear) btnClear.classList.toggle('hidden', !hasValue);
    if (btnPaste) btnPaste.classList.toggle('hidden', hasValue);

    const btnText = document.getElementById('btnResolveText');
    if (btnText) {
      if (val && val.includes('/photo/')) {
        btnText.textContent = 'Tải Album Ảnh';
      } else {
        btnText.textContent = 'Tải Video / Album Ảnh';
      }
    }
  }

  function attachResultCardListeners() {
    const state = tiktokManager.getState();
    const video = state.videoData;
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

    // Slideshow Gallery Controls (if photo mode)
    if (video?.isSlideshow && Array.isArray(video.images) && video.images.length > 0) {
      let currentSlideIndex = 0;
      const totalSlides = video.images.length;

      function goToSlide(idx) {
        if (idx < 0) idx = totalSlides - 1;
        if (idx >= totalSlides) idx = 0;
        currentSlideIndex = idx;

        const slideImg = document.getElementById('tiktokSlideImage');
        const counterBadge = document.getElementById('tiktokSlideCounterBadge');
        const btnSingleDl = document.getElementById('btnDownloadSingleSlide');
        const btnViewFull = document.getElementById('btnViewFullSlide');

        const pad = String(idx + 1).padStart(2, '0');
        const targetImgUrl = video.images[idx];
        const proxiedStreamUrl = tiktokApi.getStreamUrl(targetImgUrl, `slide_${pad}.jpg`);
        const proxiedDownloadUrl = tiktokApi.getStreamUrl(targetImgUrl, `slide_${pad}.jpg`, true);

        if (slideImg) {
          slideImg.src = proxiedStreamUrl;
          slideImg.setAttribute('data-current-index', String(idx));
        }
        if (counterBadge) {
          counterBadge.textContent = `${idx + 1} / ${totalSlides}`;
        }
        if (btnViewFull) {
          btnViewFull.href = proxiedStreamUrl;
        }
        if (btnSingleDl) {
          btnSingleDl.href = proxiedDownloadUrl;
          btnSingleDl.download = `tiktok_slide_${pad}.jpg`;
          const textEl = btnSingleDl.querySelector('.slide-dl-text');
          if (textEl) {
            textEl.textContent = `Tải Ảnh Này (slide ${idx + 1}/${totalSlides})`;
          }
        }
        if (btnCopyDirect) {
          btnCopyDirect.setAttribute('data-stream-url', proxiedStreamUrl);
          const copyText = btnCopyDirect.querySelector('span');
          if (copyText) copyText.textContent = `Sao chép link ảnh ${idx + 1}`;
        }

        // Highlight active thumbnail in strip
        const thumbBtns = document.querySelectorAll('.tiktok-thumb-btn');
        thumbBtns.forEach((tb) => {
          const tbIdx = parseInt(tb.getAttribute('data-slide-index') || '0', 10);
          if (tbIdx === currentSlideIndex) {
            tb.className = 'tiktok-thumb-btn w-6 h-9 rounded-md overflow-hidden border border-rose-500 ring-1 ring-rose-500 scale-105 transition shrink-0 cursor-pointer';
            tb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } else {
            tb.className = 'tiktok-thumb-btn w-6 h-9 rounded-md overflow-hidden border border-white/30 opacity-60 hover:opacity-100 transition shrink-0 cursor-pointer';
          }
        });
      }

      const btnPrevSlide = document.getElementById('btnPrevTiktokSlide');
      const btnNextSlide = document.getElementById('btnNextTiktokSlide');
      if (btnPrevSlide) {
        btnPrevSlide.onclick = () => goToSlide(currentSlideIndex - 1);
      }
      if (btnNextSlide) {
        btnNextSlide.onclick = () => goToSlide(currentSlideIndex + 1);
      }

      document.querySelectorAll('.tiktok-thumb-btn').forEach((btn) => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute('data-slide-index') || '0', 10);
          goToSlide(idx);
        };
      });

      // Mobile touch swipe gestures (left/right) on slide gallery
      const slideImgEl = document.getElementById('tiktokSlideImage');
      const slideContainer = slideImgEl?.parentElement;
      if (slideContainer) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        slideContainer.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
          }
        }, { passive: true });

        slideContainer.addEventListener('touchend', (e) => {
          if (e.changedTouches.length === 1) {
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            const deltaTime = Date.now() - touchStartTime;

            // Horizontal swipe with minimum distance and velocity, ignoring vertical scroll
            if (Math.abs(deltaX) > 40 && Math.abs(deltaY) < 70 && deltaTime < 600) {
              if (deltaX < 0) {
                goToSlide(currentSlideIndex + 1);
              } else {
                goToSlide(currentSlideIndex - 1);
              }
            }
          }
        }, { passive: true });
      }

      // Background audio toggle & time update
      const audioPlayer = document.getElementById('tiktokAudioPlayer');
      const btnToggleAudio = document.getElementById('btnToggleTiktokAudio');
      const audioIcon = document.getElementById('tiktokAudioIcon');
      const audioTimeText = document.getElementById('tiktokAudioTimeText');

      if (audioPlayer && btnToggleAudio) {
        btnToggleAudio.onclick = () => {
          if (audioPlayer.paused) {
            audioPlayer.play().catch((err) => {
              console.warn('[TikTok] Audio play error:', err);
            });
          } else {
            audioPlayer.pause();
          }
        };

        audioPlayer.onplay = () => {
          if (audioIcon) {
            audioIcon.setAttribute('data-lucide', 'pause');
            if (window.lucide?.createIcons) window.lucide.createIcons();
          }
        };

        audioPlayer.onpause = () => {
          if (audioIcon) {
            audioIcon.setAttribute('data-lucide', 'play');
            if (window.lucide?.createIcons) window.lucide.createIcons();
          }
        };

        audioPlayer.ontimeupdate = () => {
          if (audioTimeText && audioPlayer.duration) {
            audioTimeText.textContent = `${formatDuration(audioPlayer.currentTime)} / ${formatDuration(audioPlayer.duration)}`;
          }
        };
      }

      // Download Slideshow ZIP button
      const btnDlZip = document.getElementById('btnDownloadSlideshowZip');
      if (btnDlZip) {
        btnDlZip.onclick = async () => {
          await downloadSlideshowZip(video);
        };
      }
    }

    // Native Android APK Gallery Download Interceptor
    if (window.AndroidBridge?.downloadFile) {
      const btnStandard = document.getElementById('btnDownloadStandard');
      if (btnStandard) {
        btnStandard.onclick = (e) => {
          e.preventDefault();
          const href = btnStandard.getAttribute('href');
          const fileName = `tiktok_${video.id || Date.now()}.mp4`;
          window.AndroidBridge.downloadFile(href, fileName, 'video/mp4');
          showToast('Đang tải video về máy...', 'info');
        };
      }

      const btnHd = document.getElementById('btnDownloadHd');
      if (btnHd) {
        btnHd.onclick = (e) => {
          e.preventDefault();
          const href = btnHd.getAttribute('href');
          const fileName = `tiktok_${video.id || Date.now()}_HD.mp4`;
          window.AndroidBridge.downloadFile(href, fileName, 'video/mp4');
          showToast('Đang tải video HD về máy...', 'info');
        };
      }

      const btnAudio = document.getElementById('btnDownloadAudio');
      if (btnAudio) {
        btnAudio.onclick = (e) => {
          e.preventDefault();
          const href = btnAudio.getAttribute('href');
          const fileName = `tiktok_${video.id || Date.now()}_audio.mp3`;
          window.AndroidBridge.downloadFile(href, fileName, 'audio/mpeg');
          showToast('Đang tải nhạc TikTok về máy...', 'info');
        };
      }

      const btnSlideAudio = document.getElementById('btnDownloadSlideshowAudio');
      if (btnSlideAudio) {
        btnSlideAudio.onclick = (e) => {
          e.preventDefault();
          const href = btnSlideAudio.getAttribute('href');
          const fileName = `tiktok_${video.id || Date.now()}_audio.mp3`;
          window.AndroidBridge.downloadFile(href, fileName, 'audio/mpeg');
          showToast('Đang tải nhạc TikTok về máy...', 'info');
        };
      }

      const btnSlideDl = document.getElementById('btnDownloadSingleSlide');
      if (btnSlideDl) {
        btnSlideDl.onclick = (e) => {
          e.preventDefault();
          const href = btnSlideDl.getAttribute('href');
          const fileName = btnSlideDl.getAttribute('download') || `tiktok_slide_${Date.now()}.jpg`;
          window.AndroidBridge.downloadFile(href, fileName, 'image/jpeg');
          showToast('Đang tải ảnh về máy...', 'info');
        };
      }
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

    document.querySelectorAll('[data-preview-drive-path]').forEach((btn) => {
      btn.onclick = () => {
        const path = btn.getAttribute('data-preview-drive-path');
        const title = btn.getAttribute('data-item-title') || 'video.mp4';
        if (path) {
          ViewerConnector.preview({ path, name: title });
        }
      };
    });

    const btnClearHistory = document.getElementById('btnClearTiktokHistory');
    if (btnClearHistory) {
      btnClearHistory.onclick = () => {
        soundEngine.playDeleteAll();
        tiktokManager.clearHistory();
        showToast('Đã xóa lịch sử gần đây', 'deleteAll', 2500, { silent: true });
      };
    }

    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  // Subscribe to state changes for SURGICAL in-place updates (Zero full-DOM destruction)
  const unsubscribe = tiktokManager.subscribe((state, event) => {
    // 1. Loading state on button and input
    if (btnResolve) {
      btnResolve.disabled = state.isLoading;
      const isPhoto = Boolean(state.url?.includes('/photo/') || input?.value?.includes('/photo/'));
      const defaultText = isPhoto ? 'Tải Album Ảnh' : 'Tải Video / Album Ảnh';
      btnResolve.innerHTML = state.isLoading
        ? '<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Đang xử lý...</span>'
        : `<i data-lucide="sparkles" class="w-4 h-4"></i><span id="btnResolveText">${defaultText}</span>`;
    }
    if (input) {
      input.disabled = state.isLoading;
      if (state.url && input.value !== state.url && !state.batchQueue?.isActive) {
        input.value = state.url;
        syncInputButtons(state.url);
      }
    }

    // 2. Error banner
    if (errBanner) {
      if (state.error) {
        errBanner.classList.remove('hidden');
        const msgEl = errBanner.querySelector('.err-msg');
        let raw = state.error;
        if (typeof raw === 'object' && raw !== null) {
          raw = raw.message || raw.error || JSON.stringify(raw);
        }
        const text = typeof raw === 'string' && raw !== '[object Object]' && raw.trim()
          ? raw
          : 'Đã xảy ra lỗi khi xử lý liên kết TikTok';
        if (msgEl) msgEl.textContent = text;
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

    // 2.2 Batch Progress Banner
    const currentBatchBanner = document.getElementById('tiktokBatchProgressBanner');
    const batchCount = document.getElementById('tiktokBatchCountText');
    const batchStage = document.getElementById('tiktokBatchStageText');
    if (currentBatchBanner) {
      currentBatchBanner.classList.toggle('hidden', !state.batchQueue?.isActive);
    }
    if (batchCount && state.batchQueue?.isActive) {
      batchCount.textContent = `${state.batchQueue.current}/${state.batchQueue.total}`;
    }
    if (batchStage && state.batchQueue?.isActive) {
      batchStage.textContent = state.batchQueue.currentTitle || 'Đang xử lý...';
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

  // Cancel Batch Button
  if (btnCancelBatch) {
    btnCancelBatch.onclick = () => {
      tiktokManager.cancelBatch();
    };
  }

  // Unified trigger handler for button click or Enter key
  const handleResolveTrigger = () => {
    const val = input ? input.value.trim() : '';
    if (!val) {
      showToast('Vui lòng nhập hoặc dán liên kết video TikTok', 'error');
      return;
    }
    const extracted = extractTiktokUrls(val);
    if (extracted.length >= 2) {
      tiktokManager.startBatchSave(extracted);
    } else if (extracted.length === 1) {
      if (input && input.value !== extracted[0]) {
        input.value = extracted[0];
        syncInputButtons(extracted[0]);
      }
      tiktokManager.resolve(extracted[0]);
    } else {
      tiktokManager.resolve(val);
    }
  };

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

    // Native Paste Interceptor: Auto-cleans dirty text & detects batch URLs
    input.addEventListener('paste', (e) => {
      const pastedText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (!pastedText) return;
      const extracted = extractTiktokUrls(pastedText);
      if (extracted.length >= 2) {
        e.preventDefault();
        input.value = extracted.join('\n');
        syncInputButtons(input.value);
        tiktokManager.startBatchSave(extracted);
      } else if (extracted.length === 1 && pastedText.trim() !== extracted[0]) {
        e.preventDefault();
        input.value = extracted[0];
        syncInputButtons(extracted[0]);
        tiktokManager.setUrl(extracted[0], false);
        tiktokManager.resolve(extracted[0]);
      }
    });

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(preCheckTimer);
        handleResolveTrigger();
      }
    };
  }

  // Resolve click
  if (btnResolve) {
    btnResolve.onclick = () => {
      handleResolveTrigger();
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

  // Universal Mobile & Desktop Clipboard Paste with AndroidBridge & Dirty-Text Extractor
  if (btnPaste) {
    btnPaste.onclick = async () => {
      if (tiktokManager.getState().isLoading) return;

      try { soundEngine?.play('click'); } catch (_) {}

      const pastedText = await readText();

      if (pastedText && typeof pastedText === 'string' && pastedText.trim()) {
        const extracted = extractTiktokUrls(pastedText);
        if (extracted.length === 1) {
          const cleanUrl = extracted[0];
          if (input) {
            input.value = cleanUrl;
            syncInputButtons(cleanUrl);
          }
          showToast('Đã dán liên kết từ clipboard', 'info');
          tiktokManager.setUrl(cleanUrl, false);
          tiktokManager.resolve(cleanUrl);
          return;
        } else if (extracted.length >= 2) {
          if (input) {
            input.value = extracted.join('\n');
            syncInputButtons(input.value);
          }
          showToast(`Đã dán ${extracted.length} liên kết TikTok từ clipboard`, 'info');
          tiktokManager.startBatchSave(extracted);
          return;
        } else {
          const clean = pastedText.trim();
          if (input) {
            input.value = clean;
            syncInputButtons(clean);
          }
          showToast('Đã dán nội dung từ clipboard', 'info');
          tiktokManager.setUrl(clean, false);
          tiktokManager.resolve(clean);
          return;
        }
      }

      // If clipboard was empty or blocked, focus input for native long-press paste
      if (input) {
        input.focus();
        input.select();
      }
      showToast('Nhấn giữ ô nhập để dán liên kết', 'info');
    };
  }

  // Auto-Start Consumer: check if navigated here with a fresh pending TikTok URL
  const pendingUrl = consumePendingAutoStart('tiktok');
  if (pendingUrl) {
    if (input) {
      input.value = pendingUrl;
      syncInputButtons(pendingUrl);
    }
    tiktokManager.setUrl(pendingUrl, false);
    setTimeout(() => {
      tiktokManager.resolve(pendingUrl);
    }, 50);
  }

  function handlePendingAutoStart(e) {
    if (e.detail?.toolId === 'tiktok' && e.detail.url) {
      const clean = e.detail.url.trim();
      if (input) {
        input.value = clean;
        syncInputButtons(clean);
      }
      tiktokManager.setUrl(clean, false);
      tiktokManager.resolve(clean);
    }
  }
  window.addEventListener('ds:pending-autostart-ready', handlePendingAutoStart);

  return () => {
    unsubscribe();
    window.removeEventListener('ds:pending-autostart-ready', handlePendingAutoStart);
  };
}
