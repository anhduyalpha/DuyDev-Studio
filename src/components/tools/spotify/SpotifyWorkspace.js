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
import { storage } from '../../../utilities/storage.js';
import {
  renderMediaHistorySection,
  attachMediaHistoryListeners,
  escapeHtml
} from '../common/MediaHistorySection.js';

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
    this.historyTab = 'history';
    this.abortController = null;
    this.historyCleanup = null;

    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  mount() {
    this.render();

    storage.fetchHistory().then(() => {
      this.renderHistory();
    }).catch(() => {});

    const pendingUrl = consumePendingAutoStart('spotify');
    if (pendingUrl) {
      this.url = this.sanitizeUrl(pendingUrl) || pendingUrl;
      const input = this.container.querySelector('#spUrlInput');
      if (input) input.value = this.url;
      this.updateInputActions();
      setTimeout(() => this.resolveTrack(), 60);
    }

    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === 'spotify' && e.detail.url) {
        this.url = this.sanitizeUrl(e.detail.url) || e.detail.url.trim();
        const input = this.container.querySelector('#spUrlInput');
        if (input) input.value = this.url;
        this.updateInputActions();
        setTimeout(() => this.resolveTrack(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    const input = this.container.querySelector('#spUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.innerHTML = '';
  }

  /**
   * Sanitizes pasted text to a valid Spotify URL, stripping query tracking tags
   */
  sanitizeUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let text = raw.trim();

    if (/^(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist)\/[a-zA-Z0-9]+/i.test(text)) {
      text = `https://${text}`;
    }

    const match = text.match(/https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist)\/[a-zA-Z0-9]+/i);
    if (!match) return '';

    let clean = match[0].replace(/[.,;!?)"'\]>]+$/, '');
    try {
      const u = new URL(clean);
      const trackingParams = ['si', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'nd', 'context'];
      for (const p of trackingParams) {
        u.searchParams.delete(p);
      }
      return u.toString();
    } catch {
      return clean;
    }
  }

  handleInput(e) {
    if (e.target.id === 'spUrlInput') {
      this.url = e.target.value;
      this.updateInputActions();
    }
  }

  handleKeyDown(e) {
    if (e.target.id === 'spUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      this.resolveTrack();
    }
  }

  updateInputActions() {
    const actionContainer = this.container.querySelector('#spInputActionBtn');
    if (!actionContainer) return;

    if (this.url) {
      actionContainer.innerHTML = `
        <button type="button" data-action="clear-input" class="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/10 transition cursor-pointer" title="Xóa">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      `;
    } else {
      actionContainer.innerHTML = `
        <button type="button" data-action="paste-url" class="min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-semibold text-[#1DB954] hover:bg-[#1DB954]/10 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5" title="Dán từ bộ nhớ tạm">
          <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
          <span>Dán</span>
        </button>
      `;
    }

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: actionContainer });
    }
  }

  clearInput() {
    this.url = '';
    this.trackData = null;
    this.error = null;
    this.saveResult = null;

    const input = this.container.querySelector('#spUrlInput');
    if (input) {
      input.value = '';
      input.focus();
    }

    this.updateInputActions();
    this.renderAlert(null);
    this.renderResult();
  }

  updateSubmitBtn(isLoading) {
    const btn = this.container.querySelector('#spSubmitBtn');
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = `
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
        <span>Đang trích xuất...</span>
      `;
    } else {
      btn.innerHTML = `
        <i data-lucide="sparkles" class="w-4 h-4"></i>
        <span>Trích xuất âm thanh</span>
      `;
    }
    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: btn });
    }
  }

  renderAlert(errorMsg) {
    const alertContainer = this.container.querySelector('#spotifyAlertContainer');
    if (!alertContainer) return;
    if (!errorMsg) {
      alertContainer.innerHTML = '';
      return;
    }
    alertContainer.innerHTML = `
      <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center justify-between gap-3 animate-fadeIn">
        <div class="flex items-center gap-2.5 min-w-0">
          <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
          <span class="break-words">${escapeHtml(errorMsg)}</span>
        </div>
        <button type="button" data-action="dismiss-alert" class="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-red-500 hover:text-red-700 dark:hover:text-red-300 rounded-lg transition cursor-pointer shrink-0" title="Đóng">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: alertContainer });
    }
  }

  renderResult() {
    const resultContainer = this.container.querySelector('#spotifyResultContainer');
    if (!resultContainer) return;

    if (!this.trackData) {
      resultContainer.innerHTML = '';
      return;
    }

    const streamUrl = this.trackData.downloadUrl
      ? spotifyApi.getStreamUrl(this.trackData.downloadUrl, `${this.trackData.artist} - ${this.trackData.title}.mp3`, false)
      : '';

    const downloadUrl = this.trackData.downloadUrl
      ? spotifyApi.getStreamUrl(this.trackData.downloadUrl, `${this.trackData.artist} - ${this.trackData.title}.mp3`, true)
      : '';

    const displaySize = this.trackData.fileSizeInMb
      ? `${this.trackData.fileSizeInMb} MB`
      : (this.trackData.existingInDrive?.fileSizeInMb ? `${this.trackData.existingInDrive.fileSizeInMb} MB` : '320kbps MP3');

    resultContainer.innerHTML = `
      <div class="linear-card p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-5 animate-fadeIn">
        
        <!-- Track Header & Cover Bar -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-zinc-100 dark:border-white/5">
          
          <!-- Album Artwork -->
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md shrink-0 bg-zinc-900 border border-white/10 flex items-center justify-center relative">
            ${this.trackData.cover ? `
              <img src="${escapeHtml(this.trackData.cover)}" alt="Album Cover" class="w-full h-full object-cover" />
            ` : `
              <i data-lucide="disc" class="w-10 h-10 text-zinc-600 animate-spin"></i>
            `}
          </div>

          <!-- Metadata Info -->
          <div class="space-y-1.5 flex-1 min-w-0">
            <div id="spotifyTrackBadges" class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1DB954]/15 text-[#1DB954] uppercase tracking-wider">Spotify Track</span>
              ${this.trackData.existingInDrive ? `
                <span id="spotifyDriveBadge" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <i data-lucide="check" class="w-3 h-3"></i> Đã lưu trong Drive
                </span>
              ` : ''}
              ${this.trackData.sourceChannel ? `
                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                  <i data-lucide="disc" class="w-3 h-3 text-[#1DB954]"></i>
                  ${escapeHtml(this.trackData.sourceChannel)}
                </span>
              ` : ''}
              <button
                type="button"
                data-action="re-resolve"
                class="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 transition flex items-center gap-1.5 cursor-pointer"
                title="Tìm lại bài hát từ đầu bỏ qua bộ nhớ đệm"
              >
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Quét lại
              </button>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white truncate">${escapeHtml(this.trackData.title)}</h2>
            <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
              <i data-lucide="user" class="w-3.5 h-3.5 text-[#1DB954]"></i>
              ${escapeHtml(this.trackData.artist)}
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
          
          <!-- In-App Audio Player (Zero interruption during Drive save) -->
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
              download="${escapeHtml(this.trackData.artist)} - ${escapeHtml(this.trackData.title)}.mp3"
              class="min-h-[44px] py-2.5 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1AA34A] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-98 transition flex items-center justify-center gap-2 no-underline cursor-pointer"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span>Tải bài hát (.MP3 320k)</span>
            </a>

            <button
              id="spSaveDriveBtn"
              type="button"
              data-action="save-drive"
              ${this.savingToDrive ? 'disabled' : ''}
              class="min-h-[44px] py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-white text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
              class="min-h-[44px] px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
              <span>Xem chi tiết trình phát âm thanh toàn màn hình</span>
            </button>
          </div>

        </div>

      </div>
    `;

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: resultContainer });
    }
  }

  async resolveTrack(refresh = false) {
    const cleanUrl = this.sanitizeUrl(this.url) || (this.url || '').trim();
    if (!cleanUrl) {
      showToast('Vui lòng dán liên kết bài hát Spotify', 'warning');
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.loading = true;
    this.error = null;
    this.saveResult = null;
    this.updateSubmitBtn(true);
    this.renderAlert(null);

    try {
      soundEngine?.play('click');
      const data = await spotifyApi.resolveTrack(cleanUrl, refresh, { signal: this.abortController.signal });
      this.trackData = data;
      soundEngine?.play('success');
      showToast('Trích xuất bài hát Spotify thành công!', 'success');

      const streamUrl = spotifyApi.getStreamUrl(
        data.downloadUrl,
        `${data.artist} - ${data.title}.mp3`,
        false
      );

      storage.recordCompletedJob({
        id: `sp-${data.id || Date.now()}`,
        toolId: 'spotify-downloader',
        toolTitle: 'Spotify Downloader',
        tool: 'Spotify Downloader',
        fileName: `${data.artist} - ${data.title}.mp3`,
        title: data.title,
        artist: data.artist,
        cover: data.cover,
        thumbnail: data.cover,
        duration: data.duration,
        downloadUrl: data.downloadUrl,
        viewUrl: streamUrl,
        originalUrl: cleanUrl,
        quality: '320kbps MP3',
        mediaType: 'audio',
        driveRelPath: data.existingInDrive ? (data.existingInDrive.relPath || data.existingInDrive.path) : null,
        resultSize: data.sizeBytes || (data.fileSizeInMb ? Math.round(Number(data.fileSizeInMb) * 1024 * 1024) : 0)
      });

      this.renderResult();
      this.renderHistory();
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.error = err.message || 'Lỗi khi trích xuất bài hát Spotify';
      soundEngine?.play('error');
      showToast(this.error, 'error');
      this.renderAlert(this.error);
    } finally {
      this.loading = false;
      this.updateSubmitBtn(false);
    }
  }

  /**
   * Saves resolved track directly into DD Studio Drive with zero audio playback interruption
   */
  async saveToDrive() {
    if (!this.trackData) return;

    this.savingToDrive = true;
    const saveDriveBtn = this.container.querySelector('#spSaveDriveBtn');
    if (saveDriveBtn) {
      saveDriveBtn.disabled = true;
      saveDriveBtn.innerHTML = `
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-[#1DB954]"></i>
        <span>Đang lưu vào Drive...</span>
      `;
      if (window.lucide?.createIcons) window.lucide.createIcons({ root: saveDriveBtn });
    }

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

      if (res.data?.relPath) {
        storage.updateItemDrivePath(this.trackData.downloadUrl, res.data.relPath);
      }

      if (saveDriveBtn) {
        saveDriveBtn.disabled = false;
        saveDriveBtn.innerHTML = `
          <i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i>
          <span>Đã lưu vào Studio Drive</span>
        `;
        if (window.lucide?.createIcons) window.lucide.createIcons({ root: saveDriveBtn });
      }

      // In-place drive badge update in the track header
      const trackHeaderBadges = this.container.querySelector('#spotifyTrackBadges');
      if (trackHeaderBadges && !trackHeaderBadges.querySelector('#spotifyDriveBadge')) {
        const badgeSpan = document.createElement('span');
        badgeSpan.id = 'spotifyDriveBadge';
        badgeSpan.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1';
        badgeSpan.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Đã lưu trong Drive';
        trackHeaderBadges.appendChild(badgeSpan);
        if (window.lucide?.createIcons) window.lucide.createIcons({ root: badgeSpan });
      }

      this.renderHistory();
    } catch (err) {
      soundEngine?.play('error');
      showToast(err.message || 'Lỗi khi lưu bài hát vào Drive', 'error');
      taskCoordinator?.updateTask?.(taskId, { status: 'failed', error: err.message });
      if (saveDriveBtn) {
        saveDriveBtn.disabled = false;
        saveDriveBtn.innerHTML = `
          <i data-lucide="hard-drive" class="w-4 h-4 text-[#1DB954]"></i>
          <span>Lưu vào Studio Drive</span>
        `;
        if (window.lucide?.createIcons) window.lucide.createIcons({ root: saveDriveBtn });
      }
    } finally {
      this.savingToDrive = false;
      // CRITICAL: DO NOT call this.render() here! That would destroy the playing <audio> element!
    }
  }

  async saveHistoryItemToDrive(historyItem) {
    if (!historyItem || !historyItem.downloadUrl) return;
    try {
      showToast('Đang lưu bài hát vào Studio Drive...', 'info');

      // In-place loading feedback on the history card's save button
      const historyContainer = this.container.querySelector('#spotifyHistoryContainer');
      const saveBtn = historyContainer?.querySelector(`[data-action-save-drive="${historyItem.id}"]`);
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-[#1DB954]"></i>';
        if (window.lucide?.createIcons) window.lucide.createIcons({ root: saveBtn });
      }

      const res = await spotifyApi.saveToDrive({
        url: historyItem.originalUrl || this.url,
        title: historyItem.title || historyItem.fileName,
        artist: historyItem.artist || '',
        album: historyItem.album || '',
        cover: historyItem.cover || '',
        duration: historyItem.duration || 0,
        audioUrl: historyItem.downloadUrl,
        overwrite: true
      });

      if (res.data?.relPath) {
        storage.updateItemDrivePath(historyItem.id || historyItem.downloadUrl, res.data.relPath);
        showToast('Đã lưu bài hát vào Studio Drive!', 'success');

        // In-place DOM update: replace save button with Drive link
        if (saveBtn) {
          const driveLink = document.createElement('a');
          driveLink.href = '#storage?path=%2Fspotify';
          driveLink.className = 'w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition flex items-center justify-center shrink-0 min-h-[32px] min-w-[32px]';
          driveLink.title = 'Xem trong Studio Drive';
          driveLink.innerHTML = '<i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>';
          saveBtn.replaceWith(driveLink);

          const card = driveLink.closest('.space-y-2\\.5, .rounded-xl');
          const metaRow = card?.querySelector('.flex.items-center.gap-1\\.5');
          if (metaRow && !metaRow.textContent.includes('Đã lưu Drive')) {
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 inline-flex items-center gap-0.5';
            badgeSpan.innerHTML = '<i data-lucide="check" class="w-2.5 h-2.5"></i> Đã lưu Drive';
            const bullet = document.createElement('span');
            bullet.textContent = '•';
            metaRow.insertBefore(bullet, metaRow.firstChild);
            metaRow.insertBefore(badgeSpan, metaRow.firstChild);
          }

          if (window.lucide?.createIcons) window.lucide.createIcons({ root: card || historyContainer });
        } else {
          this.renderHistory();
        }
      }
    } catch (e) {
      showToast(e.message || 'Lỗi khi lưu vào Drive', 'error');
      this.renderHistory();
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
        this.resolveTrack(false);
        break;

      case 're-resolve':
        this.resolveTrack(true);
        break;

      case 'paste-url': {
        const text = await readText();
        if (text) {
          this.url = this.sanitizeUrl(text) || text.trim();
          const input = this.container.querySelector('#spUrlInput');
          if (input) input.value = this.url;
          this.updateInputActions();
          this.resolveTrack();
        }
        break;
      }

      case 'clear-input':
        this.clearInput();
        break;

      case 'save-drive':
        this.saveToDrive();
        break;

      case 'preview':
        this.previewInApp();
        break;

      case 'dismiss-alert':
        this.renderAlert(null);
        break;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
        
        <!-- Breadcrumb Bar -->
        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#" class="min-h-[44px] min-w-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
            </a>
            <span class="text-zinc-400 dark:text-zinc-600">/</span>
            <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-[#1DB954]"></span>
              Spotify Downloader
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-[#1DB954] border border-emerald-500/20">
              <i data-lucide="check" class="w-3 h-3"></i> MP3 320kbps & Bìa Album
            </span>
          </div>
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
            <div id="spInputActionBtn" class="absolute right-1.5 flex items-center gap-1">
              ${this.url ? `
                <button type="button" data-action="clear-input" class="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-white/10 transition cursor-pointer" title="Xóa">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : `
                <button type="button" data-action="paste-url" class="min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-semibold text-[#1DB954] hover:bg-[#1DB954]/10 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5" title="Dán từ bộ nhớ tạm">
                  <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                  <span>Dán</span>
                </button>
              `}
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span class="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-500"></i>
              Âm thanh chuẩn studio 320kbps kèm bìa album
            </span>
            <button
              id="spSubmitBtn"
              type="button"
              data-action="resolve"
              ${this.loading ? 'disabled' : ''}
              class="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1AA34A] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

        <!-- Alert Container -->
        <div id="spotifyAlertContainer"></div>

        <!-- Resolved Media Workspace -->
        <div id="spotifyResultContainer"></div>

        <!-- Isolated Media History Section -->
        <div id="spotifyHistoryContainer">
          ${renderMediaHistorySection({
            toolId: 'spotify-downloader',
            title: 'Lịch Sử Tải Nhạc Spotify',
            activeTab: this.historyTab,
            fallbackIcon: 'music',
            accentColor: '#1DB954',
            driveFolderPath: '/spotify'
          })}
        </div>

      </div>
    `;

    // Attach input listeners
    const input = this.container.querySelector('#spUrlInput');
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
    const historyContainer = this.container.querySelector('#spotifyHistoryContainer');
    if (!historyContainer) return;

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    // Intercept single item delete / restore for smooth in-place DOM item animation and removal
    const handleInPlaceAction = (e) => {
      const actionBtn = e.target.closest('[data-action-delete], [data-action-restore], [data-action-perm-delete]');
      if (!actionBtn) return;
      const card = actionBtn.closest('.p-3, .p-3\\.5, .rounded-xl');
      if (card) {
        card.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.96) translateY(-4px)';
        card.style.pointerEvents = 'none';
        setTimeout(() => {
          card.remove();
          const countBadge = historyContainer.querySelector('.font-mono.font-bold');
          if (countBadge) {
            const currentItems = this.historyTab === 'trash'
              ? storage.getToolTrash('spotify-downloader')
              : storage.getToolHistory('spotify-downloader');
            countBadge.textContent = `${currentItems.length} mục`;
          }
        }, 260);
      }
    };
    historyContainer.addEventListener('click', handleInPlaceAction);

    const baseCleanup = attachMediaHistoryListeners({
      container: historyContainer,
      toolId: 'spotify-downloader',
      accentColor: '#1DB954',
      onTabChange: (tab) => {
        this.historyTab = tab;
        this.renderHistory();
      },
      onReResolve: (url) => {
        this.url = this.sanitizeUrl(url) || url;
        const inp = this.container.querySelector('#spUrlInput');
        if (inp) inp.value = this.url;
        this.updateInputActions();
        this.resolveTrack();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onSaveDrive: (item) => {
        this.saveHistoryItemToDrive(item);
      },
      onHistoryChange: () => {
        const currentList = this.historyTab === 'trash'
          ? storage.getToolTrash('spotify-downloader')
          : storage.getToolHistory('spotify-downloader');
        if (currentList.length === 0) {
          this.renderHistory();
        }
      }
    });

    this.historyCleanup = () => {
      historyContainer.removeEventListener('click', handleInPlaceAction);
      if (typeof baseCleanup === 'function') baseCleanup();
    };

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: historyContainer });
    }
  }

  renderHistory() {
    const historyContainer = this.container.querySelector('#spotifyHistoryContainer');
    if (!historyContainer) return;

    historyContainer.innerHTML = renderMediaHistorySection({
      toolId: 'spotify-downloader',
      title: 'Lịch Sử Tải Nhạc Spotify',
      activeTab: this.historyTab,
      fallbackIcon: 'music',
      accentColor: '#1DB954',
      driveFolderPath: '/spotify'
    });

    this.attachHistoryListeners();
  }
}

let activeSpotifyWorkspace = null;

export function renderSpotifyWorkspace() {
  return '<div id="spotifyWorkspaceContainer" class="w-full"></div>';
}

export function mountSpotifyWorkspace(container) {
  if (activeSpotifyWorkspace) {
    activeSpotifyWorkspace.unmount();
    activeSpotifyWorkspace = null;
  }
  const root = container || document.getElementById('spotifyWorkspaceContainer');
  if (!root) return null;
  activeSpotifyWorkspace = new SpotifyWorkspace(root);
  activeSpotifyWorkspace.mount();
  return activeSpotifyWorkspace;
}

export function unmountSpotifyWorkspace() {
  if (activeSpotifyWorkspace) {
    activeSpotifyWorkspace.unmount();
    activeSpotifyWorkspace = null;
  }
}
