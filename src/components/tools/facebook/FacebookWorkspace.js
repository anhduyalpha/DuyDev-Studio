/**
 * Facebook Downloader Workspace Component
 * High-performance UI for resolving, playing, and downloading Facebook videos and Reels
 * Native port of n8n Facebook Downloader workflow
 */

import { facebookApi } from './services/facebookApi.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { storage } from '../../../utilities/storage.js';
import { renderMediaHistorySection, attachMediaHistoryListeners, escapeHtml } from '../common/MediaHistorySection.js';

export class FacebookWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.url = '';
    this.loading = false;
    this.error = null;
    this.videoData = null;
    this.selectedQuality = 'hd';
    this.savingToDrive = false;
    this.saveResult = null;
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

    const pendingUrl = consumePendingAutoStart('facebook');
    if (pendingUrl) {
      this.url = pendingUrl;
      const input = this.container.querySelector('#fbUrlInput');
      if (input) input.value = pendingUrl;
      setTimeout(() => this.resolveVideo(), 60);
    }

    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === 'facebook' && e.detail.url) {
        this.url = e.detail.url.trim();
        const input = this.container.querySelector('#fbUrlInput');
        if (input) input.value = this.url;
        setTimeout(() => this.resolveVideo(), 60);
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
    if (e.target.id === 'fbUrlInput') {
      this.url = e.target.value;
    }
  }

  handleKeyDown(e) {
    if (e.target.id === 'fbUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      this.resolveVideo();
    }
  }

  async resolveVideo() {
    const cleanUrl = (this.url || '').trim();
    if (!cleanUrl) {
      showToast('Vui lòng dán liên kết Facebook, Reel hoặc bài viết', 'warning');
      return;
    }

    this.loading = true;
    this.error = null;
    this.videoData = null;
    this.saveResult = null;
    this.render();

    try {
      soundEngine?.play('click');
      const data = await facebookApi.resolveVideo(cleanUrl);
      this.videoData = data;
      const isImage = data.mediaType === 'image';
      this.selectedQuality = isImage
        ? (data.formats?.[0]?.quality || 'photo_1')
        : (data.videoHdUrl ? 'hd' : 'sd');
      soundEngine?.play('success');
      showToast(isImage ? 'Trích xuất bài viết Facebook thành công!' : 'Trích xuất video Facebook thành công!', 'success');

      let targetMediaUrl = '';
      if (isImage) {
        const selFmt = data.formats?.find(f => f.quality === this.selectedQuality) || data.formats?.[0];
        targetMediaUrl = selFmt?.url || data.cover || '';
      } else {
        targetMediaUrl = (this.selectedQuality === 'hd' && data.videoHdUrl) ? data.videoHdUrl : (data.videoSdUrl || data.videoHdUrl || '');
      }

      const fileExt = isImage ? 'jpg' : 'mp4';
      const streamUrl = targetMediaUrl
        ? facebookApi.getStreamUrl(targetMediaUrl, `${data.title || (isImage ? 'facebook_photo' : 'facebook_video')}.${fileExt}`, false)
        : '';

      const authorStr = typeof data.author === 'string'
        ? data.author
        : (data.author?.name || data.author?.username || data.author?.channel || 'facebook');

      storage.recordCompletedJob({
        id: `fb-${data.id || Date.now()}`,
        toolId: 'facebook-downloader',
        toolTitle: 'Facebook Downloader',
        tool: 'Facebook Downloader',
        fileName: `${data.title || (isImage ? 'facebook_photo' : 'facebook_video')}.${fileExt}`,
        title: data.title || (isImage ? 'Facebook Post' : 'Facebook Video'),
        author: authorStr,
        cover: data.cover || null,
        thumbnail: data.cover || null,
        duration: data.duration || null,
        downloadUrl: targetMediaUrl,
        videoHdUrl: data.videoHdUrl || null,
        videoSdUrl: data.videoSdUrl || null,
        viewUrl: streamUrl,
        originalUrl: cleanUrl,
        quality: isImage ? 'Ảnh Gốc HD' : (data.videoHdUrl ? 'HD Video' : 'SD Video'),
        mediaType: isImage ? 'image' : 'video',
        driveRelPath: data.existingInDrive ? (data.existingInDrive.relPath || data.existingInDrive.path) : null,
        resultSize: data.sizeBytes || 0
      });
    } catch (err) {
      this.error = err.message || 'Lỗi khi trích xuất nội dung Facebook';
      soundEngine?.play('error');
      showToast(this.error, 'error');
    } finally {
      this.loading = false;
      this.render();
    }
  }

  async saveToDrive() {
    if (!this.videoData) return;
    const isImage = this.videoData.mediaType === 'image';
    let targetMediaUrl = '';
    let targetExt = isImage ? 'jpg' : 'mp4';

    if (isImage) {
      const selFmt = this.videoData.formats?.find(f => f.quality === this.selectedQuality) || this.videoData.formats?.[0];
      targetMediaUrl = selFmt?.url || this.videoData.cover;
      targetExt = selFmt?.ext || 'jpg';
    } else {
      targetMediaUrl = this.selectedQuality === 'hd' && this.videoData.videoHdUrl
        ? this.videoData.videoHdUrl
        : (this.videoData.videoSdUrl || this.videoData.videoHdUrl);
    }

    if (!targetMediaUrl) {
      showToast(isImage ? 'Không tìm thấy ảnh để lưu' : 'Không tìm thấy luồng video để lưu', 'error');
      return;
    }

    this.savingToDrive = true;
    this.render();

    const taskId = `fb_save_${Date.now()}`;
    taskCoordinator?.createTask?.(taskId, {
      title: isImage ? `Lưu Ảnh Facebook: ${this.videoData.title || 'Photo'}` : `Lưu Facebook: ${this.videoData.title || 'Video'}`,
      type: 'drive-upload',
      progress: 20
    });

    try {
      soundEngine?.play('click');
      const res = await facebookApi.saveToDrive({
        url: targetMediaUrl,
        title: this.videoData.title,
        id: this.videoData.id,
        originalUrl: this.url,
        cover: this.videoData.cover,
        author: this.videoData.author,
        duration: this.videoData.duration,
        quality: isImage ? 'HD' : this.selectedQuality.toUpperCase(),
        mediaType: isImage ? 'image' : 'video',
        ext: targetExt,
        overwrite: true
      });

      this.saveResult = res.data;
      soundEngine?.play('success');
      showToast(isImage ? 'Đã lưu ảnh bài viết vào Studio Drive thành công!' : 'Đã lưu video vào Studio Drive thành công!', 'success');
      taskCoordinator?.updateTask?.(taskId, { progress: 100, status: 'completed' });

      // Refresh duplicate check state
      if (this.videoData) {
        this.videoData.existingInDrive = {
          fileName: res.data.fileName,
          relPath: res.data.relPath,
          sizeBytes: res.data.sizeBytes
        };
      }

      if (res.data?.relPath) {
        storage.updateItemDrivePath(targetMediaUrl, res.data.relPath);
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
      const isImg = historyItem.mediaType === 'image' || historyItem.fileName?.endsWith('.jpg') || historyItem.fileName?.endsWith('.png');
      showToast(isImg ? 'Đang lưu ảnh vào Studio Drive...' : 'Đang lưu video vào Studio Drive...', 'info');
      const res = await facebookApi.saveToDrive({
        url: historyItem.downloadUrl,
        title: historyItem.title || historyItem.fileName,
        id: historyItem.id,
        originalUrl: historyItem.originalUrl || this.url,
        cover: historyItem.cover,
        author: historyItem.author,
        duration: historyItem.duration,
        quality: isImg ? 'HD' : (historyItem.quality?.includes('HD') ? 'HD' : 'SD'),
        mediaType: isImg ? 'image' : 'video',
        ext: isImg ? 'jpg' : 'mp4',
        overwrite: true
      });
      if (res.data?.relPath) {
        storage.updateItemDrivePath(historyItem.id || historyItem.downloadUrl, res.data.relPath);
        showToast('Đã lưu vào Studio Drive!', 'success');
        this.renderHistory();
      }
    } catch (e) {
      showToast(e.message || 'Lỗi khi lưu vào Drive', 'error');
    }
  }

  previewInApp() {
    if (!this.videoData) return;
    const isImage = this.videoData.mediaType === 'image';
    let targetMediaUrl = '';
    let ext = isImage ? 'jpg' : 'mp4';

    if (isImage) {
      const selFmt = this.videoData.formats?.find(f => f.quality === this.selectedQuality) || this.videoData.formats?.[0];
      targetMediaUrl = selFmt?.url || this.videoData.cover;
      ext = selFmt?.ext || 'jpg';
    } else {
      targetMediaUrl = this.selectedQuality === 'hd' && this.videoData.videoHdUrl
        ? this.videoData.videoHdUrl
        : (this.videoData.videoSdUrl || this.videoData.videoHdUrl);
    }

    const safeTitle = this.videoData.title || (isImage ? 'Facebook Photo' : 'Facebook Video');
    const fileName = `${safeTitle}.${ext}`;
    const streamUrl = facebookApi.getStreamUrl(targetMediaUrl, fileName, false);

    ViewerConnector.preview({
      name: fileName,
      fileName,
      category: isImage ? 'image' : 'video',
      mimeType: isImage ? 'image/jpeg' : 'video/mp4',
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
        this.resolveVideo();
        break;

      case 'paste-url': {
        const text = await readText();
        if (text) {
          this.url = text.trim();
          const input = this.container.querySelector('#fbUrlInput');
          if (input) input.value = this.url;
          this.resolveVideo();
        }
        break;
      }

      case 'clear-input':
        this.url = '';
        this.videoData = null;
        this.error = null;
        this.saveResult = null;
        this.render();
        break;

      case 'select-quality':
        this.selectedQuality = btn.dataset.quality;
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
    const isImage = this.videoData?.mediaType === 'image';
    let activeStreamUrl = '';
    let fileExt = isImage ? 'jpg' : 'mp4';

    if (isImage) {
      const selFmt = this.videoData.formats?.find(f => f.quality === this.selectedQuality) || this.videoData.formats?.[0];
      activeStreamUrl = selFmt?.url || this.videoData.cover || '';
      fileExt = selFmt?.ext || 'jpg';
    } else if (this.videoData) {
      activeStreamUrl = (this.selectedQuality === 'hd' && this.videoData.videoHdUrl)
        ? this.videoData.videoHdUrl
        : (this.videoData.videoSdUrl || this.videoData.videoHdUrl || '');
    }

    const defaultFileName = `${this.videoData?.title || (isImage ? 'facebook_photo' : 'facebook_video')}.${fileExt}`;
    const proxyStreamUrl = activeStreamUrl ? facebookApi.getStreamUrl(activeStreamUrl, defaultFileName, false) : '';
    const proxyDownloadUrl = activeStreamUrl ? facebookApi.getStreamUrl(activeStreamUrl, defaultFileName, true) : '';

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
              <span class="w-2 h-2 rounded-full bg-[#1877F2]"></span>
              Facebook Downloader
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <i data-lucide="check" class="w-3 h-3"></i> Video, Reel & Bài viết
            </span>
          </div>
        </div>

        <!-- Input Box -->
        <div class="linear-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-3">
          <label for="fbUrlInput" class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Liên kết video, Reel hoặc bài viết Facebook
          </label>
          <div class="relative flex items-center">
            <input
              type="text"
              id="fbUrlInput"
              value="${escapeHtml(this.url)}"
              placeholder="Dán liên kết bài viết, video hoặc Reel Facebook (https://www.facebook.com/...)"
              class="w-full pl-3.5 pr-24 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-300 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/60 focus:border-transparent transition"
            />
            <div class="absolute right-1.5 flex items-center gap-1">
              ${this.url ? `
                <button type="button" data-action="clear-input" class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/10 transition cursor-pointer" title="Xóa">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : `
                <button type="button" data-action="paste-url" class="px-2 py-1 text-xs font-medium text-[#1877F2] hover:bg-[#1877F2]/10 rounded-lg transition cursor-pointer flex items-center gap-1">
                  <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                  <span>Dán</span>
                </button>
              `}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-500"></i>
              Bảo mật, không lưu cookie tài khoản
            </span>
            <button
              type="button"
              data-action="resolve"
              ${this.loading ? 'disabled' : ''}
              class="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span>${escapeHtml(this.error)}</span>
          </div>
        ` : ''}

        <!-- Resolved Media Workspace -->
        ${this.videoData ? `
          <div class="linear-card p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-5">
            
            <!-- Video/Post Title & Author Bar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-white/5">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${isImage ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'}">
                    ${isImage ? 'Bài viết / Ảnh' : 'Video / Reel'}
                  </span>
                  <h2 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2">${escapeHtml(this.videoData.title)}</h2>
                </div>
                <div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span class="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                    <i data-lucide="user" class="w-3.5 h-3.5 text-[#1877F2]"></i>
                    ${escapeHtml(this.videoData.author?.name || 'Facebook User')}
                  </span>
                  ${this.videoData.duration ? `
                    <span>•</span>
                    <span>${Math.floor(this.videoData.duration / 60)}:${String(Math.floor(this.videoData.duration % 60)).padStart(2, '0')}</span>
                  ` : ''}
                </div>
              </div>

              ${this.videoData.existingInDrive ? `
                <div class="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                  <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                  <span>Đã lưu trong Drive</span>
                </div>
              ` : ''}
            </div>

            <!-- Post Caption (if present) -->
            ${this.videoData.caption ? `
              <div class="p-3.5 rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-sans">
                ${escapeHtml(this.videoData.caption)}
              </div>
            ` : ''}

            <!-- Player & Controls Grid -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              <!-- Media Player / Image Display -->
              ${isImage ? `
                <div class="md:col-span-7 bg-zinc-950/80 rounded-xl overflow-hidden shadow-inner aspect-[4/3] sm:aspect-video flex items-center justify-center relative group p-2">
                  <img
                    src="${proxyStreamUrl}"
                    alt="${escapeHtml(this.videoData.title)}"
                    class="w-full h-full object-contain rounded-lg"
                  />
                  <button
                    type="button"
                    data-action="preview"
                    class="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-medium backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                    <span>Xem ảnh đầy đủ</span>
                  </button>
                </div>
              ` : `
                <div class="md:col-span-7 bg-black rounded-xl overflow-hidden shadow-inner aspect-video flex items-center justify-center relative group">
                  <video
                    src="${proxyStreamUrl}"
                    controls
                    playsinline
                    poster="${this.videoData.cover || ''}"
                    class="w-full h-full object-contain"
                  ></video>
                </div>
              `}

              <!-- Quality / Photo Selector & Actions -->
              <div class="md:col-span-5 flex flex-col justify-between space-y-4">
                
                <div class="space-y-3">
                  ${isImage ? `
                    ${this.videoData.formats && this.videoData.formats.length > 1 ? `
                      <span class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Chọn ảnh (${this.videoData.formats.length} ảnh):</span>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${this.videoData.formats.map((fmt, idx) => `
                          <button
                            type="button"
                            data-action="select-quality"
                            data-quality="${fmt.quality}"
                            class="p-2 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              this.selectedQuality === fmt.quality
                                ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2] shadow-xs'
                                : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400'
                            }"
                          >
                            <i data-lucide="image" class="w-3.5 h-3.5"></i>
                            <span>${fmt.label || `Ảnh ${idx + 1}`}</span>
                          </button>
                        `).join('')}
                      </div>
                    ` : `
                      <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-2">
                        <i data-lucide="image" class="w-4 h-4 shrink-0"></i>
                        <span>Ảnh bài viết chất lượng gốc Full HD (1080p)</span>
                      </div>
                    `}
                  ` : `
                    <span class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Chọn chất lượng tải về:</span>
                    <div class="grid grid-cols-2 gap-2">
                      ${this.videoData.videoHdUrl ? `
                        <button
                          type="button"
                          data-action="select-quality"
                          data-quality="hd"
                          class="p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            this.selectedQuality === 'hd'
                              ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2] shadow-xs'
                              : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400'
                          }"
                        >
                          <span class="font-bold">HD 720p / 1080p</span>
                          <span class="text-[10px] opacity-75">Độ nét cao</span>
                        </button>
                      ` : ''}

                      ${this.videoData.videoSdUrl ? `
                        <button
                          type="button"
                          data-action="select-quality"
                          data-quality="sd"
                          class="p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            this.selectedQuality === 'sd' || !this.videoData.videoHdUrl
                              ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2] shadow-xs'
                              : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400'
                          }"
                        >
                          <span class="font-bold">SD 360p / 480p</span>
                          <span class="text-[10px] opacity-75">Tiết kiệm dữ liệu</span>
                        </button>
                      ` : ''}
                    </div>
                  `}
                </div>

                <!-- Primary Action Buttons -->
                <div class="space-y-2 pt-2">
                  <a
                    href="${proxyDownloadUrl}"
                    download="${defaultFileName}"
                    class="w-full py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-98 transition flex items-center justify-center gap-2 no-underline cursor-pointer"
                  >
                    <i data-lucide="download" class="w-4 h-4"></i>
                    <span>${isImage ? 'Tải ảnh về máy (.JPG)' : 'Tải về máy (.MP4)'}</span>
                  </a>

                  <button
                    type="button"
                    data-action="save-drive"
                    ${this.savingToDrive ? 'disabled' : ''}
                    class="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    ${this.savingToDrive ? `
                      <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-[#1877F2]"></i>
                      <span>Đang lưu vào Drive...</span>
                    ` : `
                      <i data-lucide="hard-drive" class="w-4 h-4 text-[#1877F2]"></i>
                      <span>${isImage ? 'Lưu ảnh vào Studio Drive' : 'Lưu vào Studio Drive'}</span>
                    `}
                  </button>

                  <button
                    type="button"
                    data-action="preview"
                    class="w-full py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                    <span>${isImage ? 'Xem ảnh trong Studio' : 'Xem toàn màn hình'}</span>
                  </button>
                </div>

              </div>
            </div>

          </div>
        ` : ''}

        <!-- Media History Section -->
        <div id="mediaHistoryContainer">
          ${renderMediaHistorySection({
            toolId: 'facebook-downloader',
            title: 'Lịch Sử Tải Facebook',
            activeTab: this.historyTab,
            fallbackIcon: 'facebook',
            accentColor: '#1877F2',
            driveFolderPath: '/facebook'
          })}
        </div>

      </div>
    `;

    // Attach listeners
    const input = this.container.querySelector('#fbUrlInput');
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
      toolId: 'facebook-downloader',
      accentColor: '#1877F2',
      onTabChange: (tab) => {
        this.historyTab = tab;
        this.renderHistory();
      },
      onReResolve: (url) => {
        this.url = url;
        const inp = this.container.querySelector('#fbUrlInput');
        if (inp) inp.value = url;
        this.resolveVideo();
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
      toolId: 'facebook-downloader',
      title: 'Lịch Sử Tải Video Facebook',
      activeTab: this.historyTab,
      fallbackIcon: 'facebook',
      accentColor: '#1877F2',
      driveFolderPath: '/facebook'
    });

    this.attachHistoryListeners();
  }
}

let activeFacebookWorkspace = null;

export function renderFacebookWorkspace() {
  return '<div id="facebookWorkspaceContainer" class="w-full"></div>';
}

export function attachFacebookWorkspaceListeners(onReRender) {
  const container = document.getElementById('facebookWorkspaceContainer');
  if (!container) return;

  if (activeFacebookWorkspace) {
    activeFacebookWorkspace.unmount();
    activeFacebookWorkspace = null;
  }

  activeFacebookWorkspace = new FacebookWorkspace(container);
  activeFacebookWorkspace.mount();

  return () => {
    if (activeFacebookWorkspace) {
      activeFacebookWorkspace.unmount();
      activeFacebookWorkspace = null;
    }
  };
}
