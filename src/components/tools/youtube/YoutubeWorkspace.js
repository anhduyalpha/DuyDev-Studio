/**
 * YouTube Downloader Workspace Component
 * High-performance UI for resolving, downloading, and converting YouTube media
 * Supports 1080p/4K Video (MP4) and High-Fidelity Audio (MP3 320kbps / M4A AAC)
 * Fully compliant with Light Mode / Dark Mode parity and Impeccable Design standards
 */

import { youtubeManager, extractYoutubeUrl, formatDuration, formatViewCount, formatBytes } from './hooks/useYoutube.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';

export class YoutubeWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.unsubscribe = null;
    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandlePaste = this.handlePaste.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  mount() {
    this.unsubscribe = youtubeManager.subscribe(() => {
      this.render();
    });
    this.render();
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  handleInput(e) {
    if (e.target.id === 'ytUrlInput') {
      youtubeManager.setUrl(e.target.value);
    }
  }

  handleKeyDown(e) {
    if (e.target.id === 'ytUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      try { soundEngine?.play('click'); } catch {}
      youtubeManager.resolve();
    }
  }

  handlePaste(e) {
    if (e.target.id === 'ytUrlInput') {
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (pasted) {
        const clean = extractYoutubeUrl(pasted);
        if (clean && clean !== pasted.trim()) {
          e.preventDefault();
          e.target.value = clean;
          youtubeManager.setUrl(clean);
          youtubeManager.resolve(clean);
        }
      }
    }
  }

  async handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    try { soundEngine?.play('click'); } catch {}

    switch (action) {
      case 'resolve': {
        youtubeManager.resolve();
        break;
      }
      case 'clear-input': {
        youtubeManager.clear();
        break;
      }
      case 'paste-url': {
        const input = this.container.querySelector('#ytUrlInput');
        const text = await readText();
        const trimmed = (text || '').trim();

        if (trimmed) {
          const ytUrl = extractYoutubeUrl(trimmed) || trimmed;
          if (input) {
            input.value = ytUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          youtubeManager.setUrl(ytUrl);
          showToast('Đã dán liên kết từ clipboard', 'info');
          youtubeManager.resolve(ytUrl);
        } else {
          // If clipboard was empty or blocked by browser permissions, focus input for native long-press paste
          if (input) {
            input.focus();
            input.select();
          }
          showToast('Nhấn giữ ô nhập để dán liên kết', 'info');
        }
        break;
      }
      case 'set-type': {
        const type = btn.dataset.type;
        if (type) youtubeManager.setDownloadType(type);
        break;
      }
      case 'set-quality': {
        const quality = btn.dataset.quality;
        if (quality) youtubeManager.setQuality(quality);
        break;
      }
      case 'download': {
        youtubeManager.download();
        break;
      }
      case 'save-drive': {
        youtubeManager.saveToDrive();
        break;
      }
      case 'preview-stream': {
        const streamUrl = btn.dataset.url;
        const fileName = btn.dataset.filename || 'youtube_preview.mp4';
        const downloadUrl = btn.dataset.downloadUrl || streamUrl;
        if (typeof ViewerConnector?.preview === 'function') {
          ViewerConnector.preview({
            name: fileName,
            fileName,
            viewUrl: streamUrl,
            downloadUrl,
            category: fileName.endsWith('.mp3') || fileName.endsWith('.m4a') ? 'audio' : 'video'
          });
        } else if (window.__ds_fileViewer?.open) {
          window.__ds_fileViewer.open({ url: streamUrl, name: fileName, downloadUrl });
        } else {
          window.open(streamUrl, '_blank');
        }
        break;
      }
      case 'remove-history': {
        const id = btn.dataset.id;
        if (id) {
          soundEngine.playDelete();
          youtubeManager.removeHistoryItem(id);
        }
        break;
      }
      case 'clear-history': {
        soundEngine.playDeleteAll();
        youtubeManager.clearHistory();
        break;
      }
      case 're-download-history': {
        const url = btn.dataset.url;
        if (url) {
          youtubeManager.setUrl(url);
          youtubeManager.resolve(url);
        }
        break;
      }
    }
  }

  render() {
    const s = youtubeManager.state;
    const v = s.videoData;
    const isBusy = s.isLoading || s.isDownloading || s.isSavingDrive;

    const videoQualities = [
      { id: '1080p', label: '1080p Full HD', desc: 'Sắc nét cao' },
      { id: '720p', label: '720p HD', desc: 'Chuẩn HD' },
      { id: '480p', label: '480p', desc: 'Tiết kiệm dung lượng' },
      { id: '360p', label: '360p', desc: 'Cơ bản' }
    ];

    const audioQualities = [
      { id: 'mp3-320', label: 'MP3 320kbps', desc: 'Âm thanh chất lượng cao' },
      { id: 'm4a-aac', label: 'M4A AAC', desc: 'Nguyên bản không nén lại' }
    ];

    this.container.innerHTML = `
      <div id="youtubeWorkspaceRoot" class="max-w-4xl mx-auto space-y-6 pb-16 md:pb-20 animate-fadeIn">
        
        <!-- Breadcrumb Bar -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
            </a>
            <span class="text-zinc-400 dark:text-zinc-600">/</span>
            <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-[#FF0000]"></span>
              YouTube Downloader
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <i data-lucide="film" class="w-3 h-3"></i> MP4 & Âm thanh MP3
            </span>
          </div>
        </div>

        <!-- Hero Header Card -->
        <div class="relative overflow-hidden rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 md:p-8 backdrop-blur-xl shadow-xs space-y-6">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/25 ring-4 ring-red-500/10 flex-shrink-0">
                <svg class="w-8 h-8 fill-current text-white select-none" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div>
                <h1 class="text-xl md:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                  YouTube Downloader
                  <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/30">
                    Pro
                  </span>
                </h1>
                <p class="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Tải video Full HD/4K hoặc trích xuất âm thanh MP3 320kbps siêu tốc không quảng cáo
                </p>
              </div>
            </div>

            <!-- Quick Specs Badges -->
            <div class="flex items-center gap-2 flex-wrap text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-white/5 flex items-center gap-1.5">
                <i data-lucide="video" class="w-3.5 h-3.5 text-red-500"></i> MP4 1080p
              </span>
              <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-white/5 flex items-center gap-1.5">
                <i data-lucide="music" class="w-3.5 h-3.5 text-amber-500"></i> MP3 320kbps
              </span>
              <span class="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-white/5 flex items-center gap-1.5">
                <i data-lucide="cloud" class="w-3.5 h-3.5 text-blue-500"></i> Lưu vào Drive
              </span>
            </div>
          </div>

          <!-- URL Input Card -->
          <div class="mt-4">
            <div class="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-zinc-50 dark:bg-black/30 rounded-xl border border-zinc-200 dark:border-zinc-800 p-1.5 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 transition-all shadow-inner">
              <div class="flex items-center flex-1 px-3 py-2 sm:py-0">
                <i data-lucide="link" class="w-4 h-4 text-zinc-400 mr-2.5 flex-shrink-0"></i>
                <input 
                  type="text" 
                  id="ytUrlInput"
                  value="${s.url || ''}"
                  placeholder="Dán liên kết YouTube (ví dụ: https://www.youtube.com/watch?v=... hoặc Shorts, youtu.be)"
                  class="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                  autocomplete="off"
                  ${isBusy ? 'disabled' : ''}
                />
                ${s.url ? `
                  <button 
                    data-action="clear-input"
                    title="Xóa ô nhập" 
                    class="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors ml-1 cursor-pointer"
                  >
                    <i data-lucide="x" class="w-4 h-4"></i>
                  </button>
                ` : ''}
              </div>

              <div class="flex items-center gap-2 px-1 pb-1 sm:p-0">
                <button 
                  type="button"
                  data-action="paste-url"
                  class="px-3.5 py-2.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 border border-zinc-300/60 dark:border-white/10 transition-all flex items-center gap-1.5 flex-shrink-0 min-h-[44px] cursor-pointer active:scale-95"
                  ${isBusy ? 'disabled' : ''}
                >
                  <i data-lucide="clipboard-paste" class="w-4 h-4"></i>
                  <span>Dán</span>
                </button>

                <button 
                  type="button"
                  data-action="resolve"
                  class="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-md hover:shadow-red-600/25 flex items-center justify-center gap-2 flex-shrink-0 min-h-[44px] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  ${isBusy ? 'disabled' : ''}
                >
                  ${s.isLoading ? `
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Đang tìm...</span>
                  ` : `
                    <i data-lucide="search" class="w-4 h-4"></i>
                    <span>Phân tích</span>
                  `}
                </button>
              </div>
            </div>

            ${s.error ? `
              <div class="mt-3 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
                <span>${s.error}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Download Status Banner -->
        ${(s.isDownloading || s.isSavingDrive) ? `
          <div class="rounded-2xl bg-white dark:bg-zinc-900 border border-red-500/30 p-5 shadow-xs space-y-3">
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2.5 font-semibold text-zinc-900 dark:text-white">
                <div class="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                <span>${s.downloadStatusText || 'Đang xử lý phương tiện...'}</span>
              </div>
              <span class="text-xs text-zinc-400 dark:text-zinc-500 font-mono">yt-dlp Engine</span>
            </div>
            <div class="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div class="bg-red-600 dark:bg-red-500 h-full rounded-full animate-pulse" style="width: 100%"></div>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              Quá trình xử lý bao gồm tải các luồng video và âm thanh độ phân giải cao rồi ghép nối bằng FFmpeg.
            </p>
          </div>
        ` : ''}

        <!-- Resolved Video Metadata & Downloader Card -->
        ${v ? `
          <div class="rounded-2xl bg-white/95 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 p-5 md:p-6 backdrop-blur-xl shadow-xs space-y-6">
            <div class="flex flex-col md:flex-row gap-6">
              <!-- Thumbnail & Duration -->
              <div class="relative w-full md:w-80 aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 shadow-sm flex-shrink-0 group">
                <img 
                  src="${v.thumbnail || ''}" 
                  alt="${v.title || 'YouTube Thumbnail'}" 
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div class="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[11px] font-mono font-bold text-white border border-white/10">
                  ${v.durationString || formatDuration(v.duration)}
                </div>
                <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-red-600/95 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider shadow-xs">
                  HD
                </div>
              </div>

              <!-- Video Info -->
              <div class="flex-1 flex flex-col justify-between space-y-4">
                <div class="space-y-2">
                  <a 
                    href="${v.webpageUrl || s.url}" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    class="text-base md:text-lg font-bold text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors line-clamp-2"
                  >
                    ${v.title}
                  </a>
                  
                  <div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                    <span class="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-zinc-400"></i>
                      ${v.uploader || 'YouTube Channel'}
                    </span>
                    <span>•</span>
                    <span class="flex items-center gap-1">
                      <i data-lucide="eye" class="w-3.5 h-3.5 text-zinc-400"></i>
                      ${formatViewCount(v.viewCount)}
                    </span>
                    ${v.duration ? `
                      <span>•</span>
                      <span class="flex items-center gap-1 font-mono">
                        <i data-lucide="clock" class="w-3.5 h-3.5 text-zinc-400"></i>
                        ${formatDuration(v.duration)}
                      </span>
                    ` : ''}
                  </div>
                </div>

                <!-- Download Type Switcher (Video vs Audio) -->
                <div class="space-y-3 pt-2">
                  <div class="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-black/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800 w-full sm:w-fit">
                    <button 
                      type="button"
                      data-action="set-type" 
                      data-type="video"
                      class="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[40px] cursor-pointer ${
                        s.downloadType === 'video' 
                          ? 'bg-red-600 text-white shadow-xs' 
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/5'
                      }"
                    >
                      <i data-lucide="video" class="w-4 h-4"></i>
                      <span>Video MP4</span>
                    </button>

                    <button 
                      type="button"
                      data-action="set-type" 
                      data-type="audio"
                      class="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[40px] cursor-pointer ${
                        s.downloadType === 'audio' 
                          ? 'bg-red-600 text-white shadow-xs' 
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/5'
                      }"
                    >
                      <i data-lucide="music" class="w-4 h-4"></i>
                      <span>Âm thanh (Audio)</span>
                    </button>
                  </div>

                  <!-- Quality Selector Pills -->
                  <div class="space-y-1.5">
                    <label class="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">
                      Độ phân giải & Chất lượng
                    </label>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      ${(s.downloadType === 'video' ? videoQualities : audioQualities).map((q) => {
                        const isSelected = s.selectedQuality === q.id;
                        return `
                          <button 
                            type="button"
                            data-action="set-quality"
                            data-quality="${q.id}"
                            class="p-2.5 rounded-xl border text-left transition-all min-h-[48px] flex flex-col justify-center cursor-pointer ${
                              isSelected
                                ? 'bg-red-50 dark:bg-red-600/15 border-red-500 text-red-700 dark:text-white ring-1 ring-red-500/50 shadow-xs'
                                : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200/80 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                            }"
                          >
                            <span class="text-xs font-bold flex items-center justify-between">
                              ${q.label}
                              ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-red-600 dark:text-red-400"></i>' : ''}
                            </span>
                            <span class="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">${q.desc}</span>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>
                </div>

                <!-- Action CTAs -->
                <div class="flex items-center gap-3 pt-3 flex-wrap">
                  <button 
                    type="button"
                    data-action="download"
                    class="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs tracking-wide transition-all shadow-md hover:shadow-red-600/25 flex items-center justify-center gap-2 min-h-[48px] cursor-pointer disabled:opacity-50"
                    ${isBusy ? 'disabled' : ''}
                  >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Tải về máy</span>
                  </button>

                  <button 
                    type="button"
                    data-action="save-drive"
                    class="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 active:scale-95 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/10 font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer disabled:opacity-50"
                    ${isBusy ? 'disabled' : ''}
                  >
                    <i data-lucide="hard-drive" class="w-4 h-4 text-blue-500"></i>
                    <span>Lưu vào Drive</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Recent Result Card -->
        ${s.lastResult ? `
          <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-5 shadow-xs space-y-3">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-sm font-bold text-zinc-900 dark:text-white truncate">${s.lastResult.fileName}</h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    Dung lượng: ${formatBytes(s.lastResult.sizeBytes)} • Định dạng: ${s.lastResult.format?.toUpperCase()}
                    ${s.lastResult.savedToDrive ? ' • <span class="text-blue-500 font-medium">Đã lưu trong Drive/YouTube</span>' : ''}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <a 
                  href="${s.lastResult.downloadUrl}"
                  download="${s.lastResult.fileName}"
                  class="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
                >
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  <span>Tải lại</span>
                </a>

                <button 
                  type="button"
                  data-action="preview-stream"
                  data-url="${s.lastResult.viewUrl || s.lastResult.downloadUrl}"
                  data-download-url="${s.lastResult.downloadUrl}"
                  data-filename="${s.lastResult.fileName}"
                  class="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-transparent font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
                >
                  <i data-lucide="play" class="w-3.5 h-3.5"></i>
                  <span>Xem trước</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Recent History Section -->
        ${(s.recentHistory && s.recentHistory.length > 0) ? `
          <div class="rounded-2xl bg-white/90 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 p-5 md:p-6 backdrop-blur-xl shadow-xs space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i data-lucide="history" class="w-4 h-4 text-zinc-400"></i>
                <h2 class="text-sm font-bold text-zinc-900 dark:text-white tracking-wide">
                  Lịch sử tải gần đây (${s.recentHistory.length})
                </h2>
              </div>
              <button 
                data-action="clear-history" 
                class="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Xóa lịch sử</span>
              </button>
            </div>

            <div class="divide-y divide-zinc-200/80 dark:divide-white/5 overflow-hidden rounded-xl border border-zinc-200/80 dark:border-white/5">
              ${s.recentHistory.map((item) => `
                <div class="p-3.5 bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    ${item.thumbnail ? `
                      <img 
                        src="${item.thumbnail}" 
                        alt="${item.title}" 
                        class="w-16 h-10 object-cover rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 flex-shrink-0"
                        loading="lazy"
                      />
                    ` : `
                      <div class="w-16 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                        <i data-lucide="film" class="w-5 h-5"></i>
                      </div>
                    `}
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-semibold text-zinc-900 dark:text-white truncate" title="${item.title || item.fileName}">${item.title || item.fileName}</p>
                      <div class="flex items-center flex-wrap gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                        <span class="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono uppercase whitespace-nowrap">
                          ${item.type === 'audio' ? 'Audio' : 'Video'} • ${item.quality || '1080p'}
                        </span>
                        <span class="whitespace-nowrap">${formatBytes(item.sizeBytes)}</span>
                        ${item.savedToDrive ? '<span class="text-blue-500 font-medium whitespace-nowrap">Drive</span>' : ''}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-2 pt-1 sm:pt-0 border-t border-zinc-200/50 dark:border-white/5 sm:border-0 w-full sm:w-auto shrink-0">
                    <a 
                      href="${item.downloadUrl}"
                      download="${item.fileName}"
                      title="Tải lại"
                      class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-transparent transition-colors min-h-[36px] flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                      <span class="sm:hidden">Tải về</span>
                    </a>
                    <button 
                      data-action="preview-stream"
                      data-url="${item.viewUrl || item.downloadUrl}"
                      data-download-url="${item.downloadUrl}"
                      data-filename="${item.fileName}"
                      title="Xem trước"
                      class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-transparent transition-colors min-h-[36px] flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <i data-lucide="play" class="w-3.5 h-3.5"></i>
                      <span class="sm:hidden">Xem</span>
                    </button>
                    <button 
                      data-action="remove-history"
                      data-id="${item.id}"
                      title="Xóa mục này"
                      class="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                    >
                      <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    // Reattach listeners
    const input = this.container.querySelector('#ytUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
      input.removeEventListener('paste', this.boundHandlePaste);
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
      input.addEventListener('paste', this.boundHandlePaste);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.addEventListener('click', this.boundHandleClick);

    // Refresh Lucide icons
    if (window.lucide?.createIcons) {
      window.lucide.createIcons();
    }
  }
}

let activeYoutubeWorkspace = null;

export function renderYoutubeWorkspace() {
  return '<div id="youtubeWorkspaceContainer" class="w-full"></div>';
}

export function attachYoutubeWorkspaceListeners(onReRender) {
  const container = document.getElementById('youtubeWorkspaceContainer');
  if (!container) return;

  if (activeYoutubeWorkspace) {
    activeYoutubeWorkspace.unmount();
    activeYoutubeWorkspace = null;
  }

  activeYoutubeWorkspace = new YoutubeWorkspace(container);
  activeYoutubeWorkspace.mount();

  return () => {
    if (activeYoutubeWorkspace) {
      activeYoutubeWorkspace.unmount();
      activeYoutubeWorkspace = null;
    }
  };
}
