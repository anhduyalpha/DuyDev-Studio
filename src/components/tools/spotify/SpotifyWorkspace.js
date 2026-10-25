/**
 * Spotify Downloader Workspace Component
 * High-fidelity UI for resolving, streaming, and downloading Spotify audio tracks
 * Native port of n8n Spotify Downloader workflow with exact Code node size parity
 */

import { spotifyApi } from './services/spotifyApi.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';

export class SpotifyWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.url = '';
    this.loading = false;
    this.error = null;
    this.trackData = null;
    this.savingToDrive = false;
    this.saveResult = null;
    this.handlePendingEvent = null;

    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  mount() {
    this.render();

    const pendingUrl = consumePendingAutoStart('spotify');
    if (pendingUrl) {
      this.url = pendingUrl;
      const input = this.container.querySelector('#spUrlInput');
      if (input) input.value = pendingUrl;
      setTimeout(() => this.resolveTrack(), 60);
    }

    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === 'spotify' && e.detail.url) {
        this.url = e.detail.url.trim();
        const input = this.container.querySelector('#spUrlInput');
        if (input) input.value = this.url;
        setTimeout(() => this.resolveTrack(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }
    this.container.innerHTML = '';
  }

  handleInput(e) {
    if (e.target.id === 'spUrlInput') {
      this.url = e.target.value;
    }
  }

  handleKeyDown(e) {
    if (e.target.id === 'spUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      this.resolveTrack();
    }
  }

  async resolveTrack() {
    const cleanUrl = (this.url || '').trim();
    if (!cleanUrl) {
      showToast('Vui lòng dán liên kết bài hát Spotify', 'warning');
      return;
    }

    this.loading = true;
    this.error = null;
    this.trackData = null;
    this.saveResult = null;
    this.render();

    try {
      soundEngine?.play('click');
      const data = await spotifyApi.resolveTrack(cleanUrl);
      this.trackData = data;
      soundEngine?.play('success');
      showToast('Trích xuất bài hát Spotify thành công!', 'success');
    } catch (err) {
      this.error = err.message || 'Lỗi khi trích xuất bài hát Spotify';
      soundEngine?.play('error');
      showToast(this.error, 'error');
    } finally {
      this.loading = false;
      this.render();
    }
  }

  async saveToDrive() {
    if (!this.trackData) return;

    this.savingToDrive = true;
    this.render();

    const taskId = `sp_save_${Date.now()}`;
    taskCoordinator?.createTask?.(taskId, {
      title: `Lưu Spotify: ${this.trackData.artist} - ${this.trackData.title}`,
      type: 'drive-upload',
      progress: 20
    });

    try {
      soundEngine?.play('click');
      const res = await spotifyApi.saveToDrive({
        url: this.trackData.url,
        title: this.trackData.title,
        artist: this.trackData.artist,
        album: this.trackData.album,
        cover: this.trackData.cover,
        duration: this.trackData.duration,
        audioUrl: this.trackData.downloadUrl,
        overwrite: true
      });

      this.saveResult = res.data;
      soundEngine?.play('success');
      showToast('Đã lưu bài hát vào Studio Drive thành công!', 'success');
      taskCoordinator?.updateTask?.(taskId, { progress: 100, status: 'completed' });

      if (this.trackData) {
        this.trackData.existingInDrive = {
          fileName: res.data.fileName,
          relPath: res.data.relPath,
          sizeBytes: res.data.sizeBytes,
          fileSizeInMb: res.data.fileSizeInMb
        };
      }
    } catch (err) {
      soundEngine?.play('error');
      showToast(err.message || 'Lỗi khi lưu bài hát vào Drive', 'error');
      taskCoordinator?.updateTask?.(taskId, { status: 'failed', error: err.message });
    } finally {
      this.savingToDrive = false;
      this.render();
    }
  }

  previewInApp() {
    if (!this.trackData) return;
    const streamUrl = spotifyApi.getStreamUrl(
      this.trackData.downloadUrl || '',
      `${this.trackData.artist} - ${this.trackData.title}.mp3`,
      false
    );

    ViewerConnector.preview({
      name: `${this.trackData.artist} - ${this.trackData.title}.mp3`,
      fileName: `${this.trackData.artist} - ${this.trackData.title}.mp3`,
      category: 'audio',
      mimeType: 'audio/mpeg',
      viewUrl: streamUrl,
      downloadUrl: streamUrl.replace('download=0', 'download=1')
    });
  }

  async handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    switch (action) {
      case 'resolve':
        this.resolveTrack();
        break;

      case 'paste-url': {
        const text = await readText();
        if (text) {
          this.url = text.trim();
          const input = this.container.querySelector('#spUrlInput');
          if (input) input.value = this.url;
          this.resolveTrack();
        }
        break;
      }

      case 'clear-input':
        this.url = '';
        this.trackData = null;
        this.error = null;
        this.saveResult = null;
        this.render();
        break;

      case 'save-drive':
        this.saveToDrive();
        break;

      case 'preview':
        this.previewInApp();
        break;
    }
  }

  render() {
    const streamUrl = this.trackData?.downloadUrl
      ? spotifyApi.getStreamUrl(this.trackData.downloadUrl, `${this.trackData.artist} - ${this.trackData.title}.mp3`, false)
      : '';

    const downloadUrl = this.trackData?.downloadUrl
      ? spotifyApi.getStreamUrl(this.trackData.downloadUrl, `${this.trackData.artist} - ${this.trackData.title}.mp3`, true)
      : '';

    const displaySize = this.trackData?.fileSizeInMb
      ? `${this.trackData.fileSizeInMb} MB`
      : (this.trackData?.existingInDrive?.fileSizeInMb ? `${this.trackData.existingInDrive.fileSizeInMb} MB` : '320kbps MP3');

    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#1DB954]/10 dark:bg-[#1DB954]/20 flex items-center justify-center text-[#1DB954]">
              <i data-lucide="music" class="w-5 h-5"></i>
            </div>
            <div>
              <h1 class="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Spotify Downloader</h1>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Tải bài hát Spotify sang MP3 chất lượng cao 320kbps, kèm ảnh bìa album và lưu trực tiếp vào Drive</p>
            </div>
          </div>
          <a href="#" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Quay lại</span>
          </a>
        </div>

        <!-- Input Box -->
        <div class="linear-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-3">
          <label for="spUrlInput" class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Liên kết bài hát Spotify
          </label>
          <div class="relative flex items-center">
            <input
              type="text"
              id="spUrlInput"
              value="${this.url}"
              placeholder="https://open.spotify.com/track/..."
              class="w-full pl-3.5 pr-24 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-300 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/60 focus:border-transparent transition"
            />
            <div class="absolute right-1.5 flex items-center gap-1">
              ${this.url ? `
                <button type="button" data-action="clear-input" class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/10 transition cursor-pointer" title="Xóa">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : `
                <button type="button" data-action="paste-url" class="px-2 py-1 text-xs font-medium text-[#1DB954] hover:bg-[#1DB954]/10 rounded-lg transition cursor-pointer flex items-center gap-1">
                  <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                  <span>Dán</span>
                </button>
              `}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-500"></i>
              Âm thanh chuẩn studio 320kbps kèm bìa album
            </span>
            <button
              type="button"
              data-action="resolve"
              ${this.loading ? 'disabled' : ''}
              class="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1AA34A] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ${this.loading ? `
                <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                <span>Đang trích xuất...</span>
              ` : `
                <i data-lucide="sparkles" class="w-4 h-4"></i>
                <span>Trích xuất âm thanh</span>
              `}
            </button>
          </div>
        </div>

        <!-- Error Alert -->
        ${this.error ? `
          <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2.5">
            <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
            <span>${this.error}</span>
          </div>
        ` : ''}

        <!-- Resolved Media Workspace -->
        ${this.trackData ? `
          <div class="linear-card p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-5">
            
            <!-- Track Header & Cover Bar -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-zinc-100 dark:border-white/5">
              
              <!-- Album Artwork -->
              <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md shrink-0 bg-zinc-900 border border-white/10 flex items-center justify-center relative">
                ${this.trackData.cover ? `
                  <img src="${this.trackData.cover}" alt="Album Cover" class="w-full h-full object-cover" />
                ` : `
                  <i data-lucide="disc" class="w-10 h-10 text-zinc-600 animate-spin"></i>
                `}
              </div>

              <!-- Metadata Info -->
              <div class="space-y-1.5 flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1DB954]/15 text-[#1DB954] uppercase tracking-wider">Spotify Track</span>
                  ${this.trackData.existingInDrive ? `
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <i data-lucide="check" class="w-3 h-3"></i> Đã lưu trong Drive
                    </span>
                  ` : ''}
                </div>
                <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white truncate">${this.trackData.title}</h2>
                <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                  <i data-lucide="user" class="w-3.5 h-3.5 text-[#1DB954]"></i>
                  ${this.trackData.artist}
                </p>
                <div class="flex items-center gap-3 text-xs text-zinc-400 pt-0.5">
                  <span class="font-mono text-zinc-600 dark:text-zinc-300 font-semibold">${displaySize}</span>
                  <span>•</span>
                  <span>MP3 320kbps CBR</span>
                </div>
              </div>

            </div>

            <!-- Audio Player & Controls -->
            <div class="space-y-4">
              
              <!-- In-App Audio Player -->
              <div class="p-3.5 rounded-2xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/5 space-y-2">
                <div class="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
                  <span class="flex items-center gap-1.5 font-medium">
                    <i data-lucide="volume-2" class="w-3.5 h-3.5 text-[#1DB954]"></i>
                    Nghe thử trực tiếp
                  </span>
                  <span class="font-mono text-[11px] text-[#1DB954]">HQ Streaming</span>
                </div>
                <audio
                  src="${streamUrl}"
                  controls
                  class="w-full h-10 focus:outline-none"
                ></audio>
              </div>

              <!-- Action Buttons -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                
                <a
                  href="${downloadUrl}"
                  download="${this.trackData.artist} - ${this.trackData.title}.mp3"
                  class="py-2.5 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1AA34A] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-98 transition flex items-center justify-center gap-2 no-underline cursor-pointer"
                >
                  <i data-lucide="download" class="w-4 h-4"></i>
                  <span>Tải bài hát (.MP3 320k)</span>
                </a>

                <button
                  type="button"
                  data-action="save-drive"
                  ${this.savingToDrive ? 'disabled' : ''}
                  class="py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  ${this.savingToDrive ? `
                    <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-[#1DB954]"></i>
                    <span>Đang lưu vào Drive...</span>
                  ` : `
                    <i data-lucide="hard-drive" class="w-4 h-4 text-[#1DB954]"></i>
                    <span>Lưu vào Studio Drive</span>
                  `}
                </button>

              </div>

              <div class="text-center pt-1">
                <button
                  type="button"
                  data-action="preview"
                  class="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                  <span>Xem chi tiết trình phát âm thanh toàn màn hình</span>
                </button>
              </div>

            </div>

          </div>
        ` : ''}

      </div>
    `;

    // Attach listeners
    const input = this.container.querySelector('#spUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.addEventListener('click', this.boundHandleClick);

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: this.container });
    }
  }
}

let activeSpotifyWorkspace = null;

export function renderSpotifyWorkspace() {
  return '<div id="spotifyWorkspaceContainer" class="w-full"></div>';
}

export function attachSpotifyWorkspaceListeners(onReRender) {
  const container = document.getElementById('spotifyWorkspaceContainer');
  if (!container) return;

  if (activeSpotifyWorkspace) {
    activeSpotifyWorkspace.unmount();
    activeSpotifyWorkspace = null;
  }

  activeSpotifyWorkspace = new SpotifyWorkspace(container);
  activeSpotifyWorkspace.mount();

  return () => {
    if (activeSpotifyWorkspace) {
      activeSpotifyWorkspace.unmount();
      activeSpotifyWorkspace = null;
    }
  };
}
