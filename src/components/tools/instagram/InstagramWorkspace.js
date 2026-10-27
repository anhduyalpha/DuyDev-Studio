/**
 * Instagram Downloader Workspace Component
 * High-performance UI for resolving, playing, and downloading Instagram Reels, Posts & Stories
 * Native port of n8n Instagram Downloader workflow
 */

import { instagramApi } from './services/instagramApi.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { storage } from '../../../utilities/storage.js';
import { renderMediaHistorySection, attachMediaHistoryListeners } from '../common/MediaHistorySection.js';

export class InstagramWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.url = '';
    this.loading = false;
    this.error = null;
    this.mediaData = null;
    this.savingToDrive = false;
    this.selectedMediaIndex = 0;
    this.handlePendingEvent = null;
    this.historyTab = 'history';

    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  mount() {
    this.render();

    storage.fetchHistory().then(() => {
      this.renderHistory();
    }).catch(() => {});

    const pendingUrl = consumePendingAutoStart('instagram');
    if (pendingUrl) {
      this.url = pendingUrl;
      const input = this.container.querySelector('#igUrlInput');
      if (input) input.value = pendingUrl;
      setTimeout(() => this.resolveMedia(), 60);
    }

    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === 'instagram' && e.detail.url) {
        this.url = e.detail.url.trim();
        const input = this.container.querySelector('#igUrlInput');
        if (input) input.value = this.url;
        setTimeout(() => this.resolveMedia(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }
    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }
    this.container.innerHTML = '';
  }

  handleInput(e) {
    if (e.target.id === 'igUrlInput') {
      this.url = e.target.value;
    }
  }

  handleKeyDown(e) {
    if (e.target.id === 'igUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      this.resolveMedia();
    }
  }

  async resolveMedia() {
    const cleanUrl = (this.url || '').trim();
    if (!cleanUrl) {
      showToast('Vui lòng dán liên kết Instagram Post, Reel hoặc Story', 'warning');
      return;
    }

    this.loading = true;
    this.error = null;
    this.mediaData = null;
    this.selectedMediaIndex = 0;
    this.render();

    try {
      soundEngine?.play('click');
      const data = await instagramApi.resolveVideo(cleanUrl);
      this.mediaData = data;
      soundEngine?.play('success');
      showToast('Trích xuất nội dung Instagram thành công!', 'success');

      const firstMedia = data.medias?.[0];
      const isVideo = firstMedia?.type === 'video' || (!firstMedia?.type && Boolean(data.videoUrl));
      const targetUrl = firstMedia?.url || data.videoUrl || '';
      const isCarousel = Boolean(data.medias && data.medias.length > 1);
      const mediaType = isCarousel ? 'carousel' : (isVideo ? 'video' : 'photo');
      const quality = isCarousel ? `${data.medias.length} Tệp` : (isVideo ? 'HD Video' : 'HQ Photo');

      const streamUrl = targetUrl
        ? instagramApi.getStreamUrl(targetUrl, `${data.title || 'instagram_media'}.${isVideo ? 'mp4' : 'jpg'}`, false)
        : '';

      const authorStr = typeof data.author === 'string'
        ? data.author
        : (data.author?.username || data.author?.name || 'instagram');

      storage.recordCompletedJob({
        id: `ig-${data.id || Date.now()}`,
        toolId: 'instagram-downloader',
        toolTitle: 'Instagram Downloader',
        tool: 'Instagram Downloader',
        fileName: `${data.title || 'instagram_media'}.${isVideo ? 'mp4' : 'jpg'}`,
        title: data.title || 'Instagram Media',
        author: authorStr,
        cover: data.cover || (data.medias && data.medias[0]?.thumbnail) || null,
        thumbnail: data.cover || (data.medias && data.medias[0]?.thumbnail) || null,
        duration: data.duration || null,
        downloadUrl: targetUrl,
        viewUrl: streamUrl,
        originalUrl: cleanUrl,
        quality,
        mediaType,
        driveRelPath: data.existingInDrive ? (data.existingInDrive.relPath || data.existingInDrive.path) : null,
        resultSize: data.sizeBytes || 0
      });
    } catch (err) {
      this.error = err.message || 'Lỗi khi trích xuất video Instagram';
      soundEngine?.play('error');
      showToast(this.error, 'error');
    } finally {
      this.loading = false;
      this.render();
    }
  }

  async saveToDrive() {
    if (!this.mediaData) return;
    const currentItem = this.mediaData.medias?.[this.selectedMediaIndex] || { url: this.mediaData.videoUrl, type: 'video' };
    const targetUrl = currentItem.url || this.mediaData.videoUrl;

    if (!targetUrl) {
      showToast('Không tìm thấy đường dẫn tệp để lưu', 'error');
      return;
    }

    this.savingToDrive = true;
    this.render();

    const taskId = `ig_save_${Date.now()}`;
    taskCoordinator?.createTask?.(taskId, {
      title: `Lưu Instagram: ${this.mediaData.title || 'Media'}`,
      type: 'drive-upload',
      progress: 20
    });

    try {
      soundEngine?.play('click');
      const res = await instagramApi.saveToDrive({
        url: targetUrl,
        title: this.mediaData.title,
        id: this.mediaData.id,
        originalUrl: this.url,
        cover: this.mediaData.cover,
        author: this.mediaData.author,
        duration: this.mediaData.duration,
        overwrite: true
      });

      soundEngine?.play('success');
      showToast('Đã lưu nội dung Instagram vào Studio Drive!', 'success');
      taskCoordinator?.updateTask?.(taskId, { progress: 100, status: 'completed' });

      if (this.mediaData) {
        this.mediaData.existingInDrive = {
          fileName: res.data.fileName,
          relPath: res.data.relPath,
          sizeBytes: res.data.sizeBytes
        };
      }

      if (res.data?.relPath) {
        storage.updateItemDrivePath(targetUrl, res.data.relPath);
      }
    } catch (err) {
      soundEngine?.play('error');
      showToast(err.message || 'Lỗi khi lưu vào Drive', 'error');
      taskCoordinator?.updateTask?.(taskId, { status: 'failed', error: err.message });
    } finally {
      this.savingToDrive = false;
      this.render();
    }
  }

  async saveHistoryItemToDrive(historyItem) {
    if (!historyItem || !historyItem.downloadUrl) return;
    try {
      showToast('Đang lưu nội dung vào Studio Drive...', 'info');
      const res = await instagramApi.saveToDrive({
        url: historyItem.downloadUrl,
        title: historyItem.title || historyItem.fileName,
        id: historyItem.id,
        originalUrl: historyItem.originalUrl || this.url,
        cover: historyItem.cover,
        author: historyItem.author,
        duration: historyItem.duration,
        overwrite: true
      });
      if (res.data?.relPath) {
        storage.updateItemDrivePath(historyItem.id || historyItem.downloadUrl, res.data.relPath);
        showToast('Đã lưu nội dung vào Studio Drive!', 'success');
        this.renderHistory();
      }
    } catch (e) {
      showToast(e.message || 'Lỗi khi lưu vào Drive', 'error');
    }
  }

  previewInApp() {
    if (!this.mediaData) return;
    const currentItem = this.mediaData.medias?.[this.selectedMediaIndex] || { url: this.mediaData.videoUrl, type: 'video' };
    const isVideo = currentItem.type === 'video' || (!currentItem.type && this.mediaData.videoUrl);
    const targetUrl = currentItem.url || this.mediaData.videoUrl;

    const streamUrl = instagramApi.getStreamUrl(
      targetUrl,
      `${this.mediaData.title || 'instagram_media'}.${isVideo ? 'mp4' : 'jpg'}`,
      false
    );

    ViewerConnector.preview({
      name: `${this.mediaData.title || 'Instagram Media'}.${isVideo ? 'mp4' : 'jpg'}`,
      fileName: `${this.mediaData.title || 'Instagram Media'}.${isVideo ? 'mp4' : 'jpg'}`,
      category: isVideo ? 'video' : 'image',
      mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
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
        this.resolveMedia();
        break;

      case 'paste-url': {
        const text = await readText();
        if (text) {
          this.url = text.trim();
          const input = this.container.querySelector('#igUrlInput');
          if (input) input.value = this.url;
          this.resolveMedia();
        }
        break;
      }

      case 'clear-input':
        this.url = '';
        this.mediaData = null;
        this.error = null;
        this.render();
        break;

      case 'select-media': {
        const idx = parseInt(btn.dataset.index, 10);
        if (!isNaN(idx)) {
          this.selectedMediaIndex = idx;
          this.render();
        }
        break;
      }

      case 'save-drive':
        this.saveToDrive();
        break;

      case 'preview':
        this.previewInApp();
        break;
    }
  }

  render() {
    const currentItem = this.mediaData?.medias?.[this.selectedMediaIndex] || {
      url: this.mediaData?.videoUrl,
      type: 'video'
    };
    const isVideo = currentItem?.type === 'video' || (!currentItem?.type && this.mediaData?.videoUrl);
    const activeUrl = currentItem?.url || this.mediaData?.videoUrl || '';

    const proxyStreamUrl = activeUrl
      ? instagramApi.getStreamUrl(activeUrl, `${this.mediaData?.title || 'instagram_media'}.${isVideo ? 'mp4' : 'jpg'}`, false)
      : '';

    const proxyDownloadUrl = activeUrl
      ? instagramApi.getStreamUrl(activeUrl, `${this.mediaData?.title || 'instagram_media'}.${isVideo ? 'mp4' : 'jpg'}`, true)
      : '';

    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
        
        <!-- Breadcrumb Bar -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs min-h-[44px]">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
            </a>
            <span class="text-zinc-400 dark:text-zinc-600">/</span>
            <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-[#E1306C]"></span>
              Instagram Downloader
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-[#E1306C] border border-rose-500/20">
              <i data-lucide="check" class="w-3 h-3"></i> Reels & Story MP4
            </span>
          </div>
        </div>

        <!-- Input Box -->
        <div class="linear-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-3">
          <label for="igUrlInput" class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Liên kết bài viết, Reel hoặc Story Instagram
          </label>
          <div class="relative flex items-center">
            <input
              type="text"
              id="igUrlInput"
              value="${this.url}"
              placeholder="https://www.instagram.com/reel/... hoặc https://www.instagram.com/p/..."
              class="w-full pl-3.5 pr-24 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-300 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#E1306C]/60 focus:border-transparent transition"
            />
            <div class="absolute right-1.5 flex items-center gap-1">
              ${this.url ? `
                <button type="button" data-action="clear-input" class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/10 transition cursor-pointer" title="Xóa">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : `
                <button type="button" data-action="paste-url" class="px-2 py-1 text-xs font-medium text-[#E1306C] hover:bg-[#E1306C]/10 rounded-lg transition cursor-pointer flex items-center gap-1">
                  <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                  <span>Dán</span>
                </button>
              `}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-500"></i>
              Bảo mật, tải trực tiếp không cần đăng nhập
            </span>
            <button
              type="button"
              data-action="resolve"
              ${this.loading ? 'disabled' : ''}
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E1306C] to-[#FD1D1D] hover:opacity-90 text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ${this.loading ? `
                <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                <span>Đang trích xuất...</span>
              ` : `
                <i data-lucide="sparkles" class="w-4 h-4"></i>
                <span>Trích xuất nội dung</span>
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
        ${this.mediaData ? `
          <div class="linear-card p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-5">
            
            <!-- Video Title & Author Bar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-white/5">
              <div class="space-y-1 min-w-0">
                <h2 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2">${this.mediaData.title}</h2>
                <div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span class="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                    <i data-lucide="instagram" class="w-3.5 h-3.5 text-[#E1306C]"></i>
                    @${this.mediaData.author?.username || 'instagram_user'}
                  </span>
                  ${this.mediaData.duration ? `
                    <span>•</span>
                    <span>${Math.floor(this.mediaData.duration / 60)}:${String(Math.floor(this.mediaData.duration % 60)).padStart(2, '0')}</span>
                  ` : ''}
                </div>
              </div>

              ${this.mediaData.existingInDrive ? `
                <div class="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                  <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                  <span>Đã lưu trong Drive</span>
                </div>
              ` : ''}
            </div>

            <!-- Carousel Gallery Selector if multiple items -->
            ${this.mediaData.medias?.length > 1 ? `
              <div class="space-y-2">
                <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Album đa phương tiện (${this.mediaData.medias.length} tệp):</span>
                <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  ${this.mediaData.medias.map((m, idx) => `
                    <button
                      type="button"
                      data-action="select-media"
                      data-index="${idx}"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                        idx === this.selectedMediaIndex
                          ? 'border-[#E1306C] bg-[#E1306C]/10 text-[#E1306C] font-semibold'
                          : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5'
                      }"
                    >
                      <i data-lucide="${m.type === 'video' ? 'play' : 'image'}" class="w-3 h-3"></i>
                      <span>Mục ${idx + 1}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Player & Controls Grid -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              <!-- Video / Image Preview Area -->
              <div class="md:col-span-7 bg-black rounded-xl overflow-hidden shadow-inner aspect-[4/5] sm:aspect-video flex items-center justify-center relative group">
                ${isVideo ? `
                  <video
                    src="${proxyStreamUrl}"
                    controls
                    playsinline
                    poster="${this.mediaData.cover || ''}"
                    class="w-full h-full object-contain"
                  ></video>
                ` : `
                  <img
                    src="${proxyStreamUrl}"
                    alt="Instagram Post"
                    class="w-full h-full object-contain"
                  />
                `}
              </div>

              <!-- Action Buttons -->
              <div class="md:col-span-5 flex flex-col justify-between space-y-4">
                
                <div class="space-y-3">
                  <span class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Định dạng trích xuất:</span>
                  <div class="p-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 text-xs space-y-1.5">
                    <div class="flex justify-between text-zinc-500 dark:text-zinc-400">
                      <span>Loại nội dung</span>
                      <span class="font-medium text-zinc-800 dark:text-white">${isVideo ? 'Video MP4 (H.264 / AAC)' : 'Hình ảnh JPEG'}</span>
                    </div>
                    <div class="flex justify-between text-zinc-500 dark:text-zinc-400">
                      <span>Chất lượng</span>
                      <span class="font-medium text-emerald-600 dark:text-emerald-400 font-semibold">Gốc (Không nén)</span>
                    </div>
                  </div>
                </div>

                <!-- Primary Action Buttons -->
                <div class="space-y-2 pt-2">
                  <a
                    href="${proxyDownloadUrl}"
                    download="${this.mediaData.title || 'instagram_media'}.${isVideo ? 'mp4' : 'jpg'}"
                    class="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#E1306C] to-[#FD1D1D] hover:opacity-90 text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-98 transition flex items-center justify-center gap-2 no-underline cursor-pointer"
                  >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>Tải về máy (.${isVideo ? 'MP4' : 'JPG'})</span>
                  </a>

                  <button
                    type="button"
                    data-action="save-drive"
                    ${this.savingToDrive ? 'disabled' : ''}
                    class="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    ${this.savingToDrive ? `
                      <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-[#E1306C]"></i>
                      <span>Đang lưu vào Drive...</span>
                    ` : `
                      <i data-lucide="hard-drive" class="w-4 h-4 text-[#E1306C]"></i>
                      <span>Lưu vào Studio Drive</span>
                    `}
                  </button>

                  <button
                    type="button"
                    data-action="preview"
                    class="w-full py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                    <span>Xem toàn màn hình</span>
                  </button>
                </div>

              </div>
            </div>

          </div>
        ` : ''}

        <!-- Media History Section -->
        <div id="mediaHistoryContainer">
          ${renderMediaHistorySection({
            toolId: 'instagram-downloader',
            title: 'Lịch Sử Tải Instagram',
            activeTab: this.historyTab,
            fallbackIcon: 'instagram',
            accentColor: '#E1306C',
            driveFolderPath: '/instagram'
          })}
        </div>

      </div>
    `;

    // Attach listeners
    const input = this.container.querySelector('#igUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.addEventListener('click', this.boundHandleClick);

    this.attachHistoryListeners();

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: this.container });
    }
  }

  attachHistoryListeners() {
    const historyContainer = this.container.querySelector('#mediaHistoryContainer');
    if (!historyContainer) return;

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    this.historyCleanup = attachMediaHistoryListeners({
      container: historyContainer,
      toolId: 'instagram-downloader',
      accentColor: '#E1306C',
      onTabChange: (tab) => {
        this.historyTab = tab;
        this.renderHistory();
      },
      onReResolve: (url) => {
        this.url = url;
        const inp = this.container.querySelector('#igUrlInput');
        if (inp) inp.value = url;
        this.resolveMedia();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onSaveDrive: (item) => {
        this.saveHistoryItemToDrive(item);
      },
      onHistoryChange: () => {
        this.renderHistory();
      }
    });

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: historyContainer });
    }
  }

  renderHistory() {
    const historyContainer = this.container.querySelector('#mediaHistoryContainer');
    if (!historyContainer) return;

    historyContainer.innerHTML = renderMediaHistorySection({
      toolId: 'instagram-downloader',
      title: 'Lịch Sử Tải Instagram',
      activeTab: this.historyTab,
      fallbackIcon: 'instagram',
      accentColor: '#E1306C',
      driveFolderPath: '/instagram'
    });

    this.attachHistoryListeners();
  }
}

let activeInstagramWorkspace = null;

export function renderInstagramWorkspace() {
  return '<div id="instagramWorkspaceContainer" class="w-full"></div>';
}

export function attachInstagramWorkspaceListeners(onReRender) {
  const container = document.getElementById('instagramWorkspaceContainer');
  if (!container) return;

  if (activeInstagramWorkspace) {
    activeInstagramWorkspace.unmount();
    activeInstagramWorkspace = null;
  }

  activeInstagramWorkspace = new InstagramWorkspace(container);
  activeInstagramWorkspace.mount();

  return () => {
    if (activeInstagramWorkspace) {
      activeInstagramWorkspace.unmount();
      activeInstagramWorkspace = null;
    }
  };
}
