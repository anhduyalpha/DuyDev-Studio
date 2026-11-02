/**
 * SlideshareWorkspace.js - SlideShare Presentation Downloader Workspace
 * Compliant with DuyDev Studio Universal Tool Module Architecture (KI-CON-019).
 */

import { slideshareApi } from './services/slideshareApi.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { storage } from '../../../utilities/storage.js';
import { renderMediaHistorySection, attachMediaHistoryListeners, escapeHtml } from '../common/MediaHistorySection.js';

export class SlideshareWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.url = '';
    this.loading = false;
    this.error = null;
    this.data = null;
    this.savingToDrive = false;
    this.savedDrivePath = null;
    this.savedFileName = null;
    this.handlePendingEvent = null;
    this.historyTab = 'history';
    this.historyCleanup = null;
    this.abortController = null;

    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  mount() {
    this.render();

    Promise.all([storage.fetchHistory(), storage.fetchTrash()]).then(() => {
      this.renderHistory();
    }).catch(() => {});

    const pendingUrl = consumePendingAutoStart('slideshare') || consumePendingAutoStart('slideshare-downloader');
    if (pendingUrl) {
      this.url = this.sanitizeUrl(pendingUrl) || pendingUrl.trim();
      const input = this.container.querySelector('#ssUrlInput');
      if (input) input.value = this.url;
      this.updateInputActions();
      setTimeout(() => this.resolvePresentation(), 60);
    }

    this.handlePendingEvent = (e) => {
      if ((e.detail?.toolId === 'slideshare' || e.detail?.toolId === 'slideshare-downloader') && e.detail.url) {
        this.url = this.sanitizeUrl(e.detail.url) || e.detail.url.trim();
        const input = this.container.querySelector('#ssUrlInput');
        if (input) input.value = this.url;
        this.updateInputActions();
        setTimeout(() => this.resolvePresentation(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    this.abortController = null;

    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    const input = this.container.querySelector('#ssUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.innerHTML = '';
  }

  sanitizeUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let text = raw.trim();

    if (/^(?:[a-zA-Z0-9_-]+\.)?slideshare\.net(?:\/|$)/i.test(text)) {
      text = `https://${text}`;
    }

    const match = text.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?slideshare\.net\/[^\s"'<>]+/i);
    if (!match) return '';

    let clean = match[0].replace(/[.,;!?)"'\]>]+$/, '');
    try {
      const u = new URL(clean);
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'from_search'];
      for (const p of trackingParams) {
        u.searchParams.delete(p);
      }
      return u.toString();
    } catch {
      return clean;
    }
  }

  handleInput(e) {
    if (e.target.id === 'ssUrlInput') {
      this.url = e.target.value;
      this.updateInputActions();
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.resolvePresentation();
    }
  }

  async handleClick(e) {
    const pasteBtn = e.target.closest('#btnPasteSsUrl');
    if (pasteBtn) {
      e.preventDefault();
      try {
        const text = await readText();
        if (text) {
          const clean = this.sanitizeUrl(text) || text.trim();
          this.url = clean;
          const input = this.container.querySelector('#ssUrlInput');
          if (input) input.value = clean;
          this.updateInputActions();
          soundEngine?.play?.('click');
          if (clean.includes('slideshare.net')) {
            this.resolvePresentation();
          } else {
            showToast('Đã dán liên kết. Nhấn Phân tích để tiếp tục.', 'info');
          }
        }
      } catch {
        showToast('Không thể đọc clipboard. Vui lòng dán thủ công.', 'error');
      }
      return;
    }

    const clearBtn = e.target.closest('#btnClearSsUrl');
    if (clearBtn) {
      e.preventDefault();
      this.url = '';
      const input = this.container.querySelector('#ssUrlInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.data = null;
      this.error = null;
      this.updateInputActions();
      this.renderResultArea();
      soundEngine?.play?.('click');
      return;
    }

    const resolveBtn = e.target.closest('#btnResolveSs');
    if (resolveBtn) {
      e.preventDefault();
      this.resolvePresentation();
      return;
    }

    const previewBtn = e.target.closest('#btnPreviewSs');
    if (previewBtn) {
      e.preventDefault();
      this.previewPresentation();
      return;
    }

    const saveDriveBtn = e.target.closest('#btnSaveSsDrive');
    if (saveDriveBtn) {
      e.preventDefault();
      this.saveToDrive();
      return;
    }

    const downloadBtn = e.target.closest('#btnDownloadSs');
    if (downloadBtn) {
      e.preventDefault();
      this.downloadPdfDirect();
      return;
    }
  }

  updateInputActions() {
    const clearBtn = this.container.querySelector('#btnClearSsUrl');
    if (clearBtn) {
      if (this.url && this.url.trim().length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }
  }

  async resolvePresentation() {
    if (this.loading) return;

    const cleanUrl = this.sanitizeUrl(this.url);
    if (!cleanUrl) {
      showToast('Vui lòng nhập liên kết SlideShare hợp lệ', 'warning');
      return;
    }

    this.loading = true;
    this.error = null;
    this.data = null;
    this.savedDrivePath = null;
    this.savedFileName = null;
    this.renderResultArea();
    soundEngine?.play?.('start');

    const resolveBtn = this.container.querySelector('#btnResolveSs');
    if (resolveBtn) {
      resolveBtn.disabled = true;
      resolveBtn.classList.add('opacity-75', 'cursor-not-allowed');
      resolveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang phân tích slide...</span>';
      if (window.lucide) window.lucide.createIcons({ root: resolveBtn });
    }

    const taskId = `ss_${Date.now()}`;
    taskCoordinator.createTask(taskId, {
      title: 'Phân tích SlideShare',
      type: 'document-resolve',
      progress: 25
    });

    try {
      this.abortController = new AbortController();
      const res = await slideshareApi.resolve(cleanUrl, { signal: this.abortController.signal });
      this.data = res;
      this.loading = false;
      taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
      soundEngine?.play?.('success');

      // Check if already downloaded to Drive
      try {
        const dup = await slideshareApi.checkDuplicate({ id: res.id, url: cleanUrl });
        if (dup?.exists) {
          this.savedDrivePath = dup.drivePath;
          this.savedFileName = dup.fileName;
        }
      } catch (_) {}

      this.renderResultArea();
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.loading = false;
      this.error = err.message || 'Không thể phân tích tài liệu SlideShare';
      taskCoordinator.updateTask(taskId, { status: 'failed', progress: 100 });
      soundEngine?.play?.('error');
      this.renderResultArea();
    } finally {
      if (resolveBtn) {
        resolveBtn.disabled = false;
        resolveBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        resolveBtn.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i><span>Phân tích Slide</span>';
        if (window.lucide) window.lucide.createIcons({ root: resolveBtn });
      }
    }
  }

  async saveToDrive(options = {}) {
    if (!this.data || this.savingToDrive) return;

    this.savingToDrive = true;
    soundEngine?.play?.('start');
    if (!options.silent) {
      showToast('Đang tải và ghép các trang slide thành PDF...', 'info');
    }

    const taskId = `ss_drive_${Date.now()}`;
    taskCoordinator.createTask(taskId, {
      title: `Lưu Drive: ${this.data.title || 'SlideShare'}`,
      type: 'pdf-compile',
      progress: 30
    });

    try {
      const result = await slideshareApi.saveToDrive({
        url: this.data.originalUrl,
        title: this.data.title,
        id: this.data.id,
        originalUrl: this.data.originalUrl,
        cover: this.data.coverUrl,
        author: this.data.author,
        category: 'slideshare'
      });

      this.savedDrivePath = result.drivePath;
      this.savedFileName = result.fileName;
      this.savingToDrive = false;
      taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
      soundEngine?.play?.('bell');
      if (!options.silent) {
        showToast('Đã lưu tài liệu SlideShare vào Studio Drive (/slideshare)!', 'success');
      }

      // Add to media history
      await storage.addHistoryItem({
        id: `ss_${this.data.id}_${Date.now()}`,
        toolId: 'slideshare-downloader',
        toolTitle: 'SlideShare Downloader',
        title: this.data.title,
        fileName: result.fileName,
        fileSize: result.size,
        resultSize: result.size,
        mimeType: 'application/pdf',
        driveRelPath: result.drivePath,
        thumbnail: this.data.coverUrl,
        cover: this.data.coverUrl,
        sourceUrl: this.data.originalUrl,
        timestamp: Date.now()
      });

      this.renderResultArea();
      this.renderHistory();

      if (options.autoPreview) {
        this.openPdfViewer(result.fileName, result.drivePath);
      }
      return result;
    } catch (err) {
      this.savingToDrive = false;
      taskCoordinator.updateTask(taskId, { status: 'failed', progress: 100 });
      soundEngine?.play?.('error');
      showToast(err.message || 'Lỗi khi lưu tài liệu vào Studio Drive', 'error');
      this.renderResultArea();
      throw err;
    }
  }

  async previewPresentation() {
    if (!this.data) return;

    if (this.savedDrivePath) {
      this.openPdfViewer(this.savedFileName || `${this.data.title || 'SlideShare'}.pdf`, this.savedDrivePath);
      return;
    }

    const previewBtn = this.container.querySelector('#btnPreviewSs');
    if (previewBtn) {
      previewBtn.disabled = true;
      previewBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang chuẩn bị PDF...</span>';
      if (window.lucide) window.lucide.createIcons({ root: previewBtn });
    }

    try {
      await this.saveToDrive({ autoPreview: true, silent: false });
    } catch (_) {
      // Error toast already triggered in saveToDrive
    } finally {
      if (previewBtn) {
        previewBtn.disabled = false;
        previewBtn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i><span>Xem trước</span>';
        if (window.lucide) window.lucide.createIcons({ root: previewBtn });
      }
    }
  }

  openPdfViewer(fileName, driveRelPath) {
    const viewUrl = `/api/v1/storage/file?path=${encodeURIComponent(driveRelPath)}`;
    const downloadUrl = `/api/v1/storage/file?path=${encodeURIComponent(driveRelPath)}&download=true`;

    ViewerConnector.preview({
      name: fileName,
      fileName,
      path: driveRelPath,
      driveRelPath,
      category: 'pdf',
      mimeType: 'application/pdf',
      viewUrl,
      downloadUrl
    });
  }

  async downloadPdfDirect() {
    if (!this.data) return;
    await this.saveToDrive();
  }

  renderResultArea() {
    const el = this.container.querySelector('#ssResultContainer');
    if (!el) return;

    if (this.loading) {
      el.innerHTML = `
        <div class="linear-card p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-[#121216]/70 backdrop-blur-md text-center space-y-4 animate-fadeIn">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-500 animate-pulse">
            <i data-lucide="loader-2" class="w-7 h-7 animate-spin"></i>
          </div>
          <h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100">Đang bóc tách bài thuyết trình SlideShare...</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">Hệ thống đang tải danh sách slide độ phân giải cao và trích xuất siêu dữ liệu.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: el });
      return;
    }

    if (this.error) {
      el.innerHTML = `
        <div class="linear-card p-5 md:p-6 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04] text-center space-y-3 animate-fadeIn">
          <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500">
            <i data-lucide="alert-circle" class="w-5 h-5"></i>
          </div>
          <div class="text-sm font-semibold text-rose-600 dark:text-rose-400">${escapeHtml(this.error)}</div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: el });
      return;
    }

    if (!this.data) {
      el.innerHTML = '';
      return;
    }

    const { title, author, description, coverUrl, slideCount } = this.data;
    const isSaved = Boolean(this.savedDrivePath);

    el.innerHTML = `
      <div class="linear-card p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121216] shadow-xl space-y-5 animate-fadeIn">
        <div class="flex flex-col sm:flex-row gap-4 items-start">
          ${coverUrl ? `
            <div class="relative w-full sm:w-44 h-48 sm:h-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5">
              <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" />
              <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono font-bold text-white">
                ${slideCount} trang
              </div>
            </div>
          ` : ''}
          <div class="space-y-2 flex-1 min-w-0">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <i data-lucide="presentation" class="w-3 h-3"></i>
              <span>SlideShare Presentation</span>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">${escapeHtml(title)}</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Tác giả: <strong class="text-zinc-700 dark:text-zinc-300">${escapeHtml(author)}</strong></p>
            ${description ? `<p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">${escapeHtml(description)}</p>` : ''}
          </div>
        </div>

        <div class="pt-2 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center gap-3">
          <button id="btnSaveSsDrive" ${this.savingToDrive ? 'disabled' : ''} class="flex-1 min-h-[44px] px-5 py-2.5 rounded-2xl ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#0077B5] hover:bg-[#0284C7]'} active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
            ${this.savingToDrive ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang xử lý & Lưu...</span>' : isSaved ? '<i data-lucide="check" class="w-4 h-4"></i><span>Đã lưu vào Studio Drive</span>' : '<i data-lucide="hard-drive" class="w-4 h-4"></i><span>Lưu vào Studio Drive</span>'}
          </button>
          <button id="btnPreviewSs" class="min-h-[44px] px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Xem trước</span>
          </button>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: el });
  }

  renderHistory() {
    const el = this.container.querySelector('#slideshareHistoryContainer');
    if (!el) return;
    el.innerHTML = renderMediaHistorySection({
      toolId: 'slideshare-downloader',
      historyTab: this.historyTab
    });
    if (this.historyCleanup) this.historyCleanup();
    this.historyCleanup = attachMediaHistoryListeners({
      container: el,
      toolId: 'slideshare-downloader',
      historyTab: this.historyTab,
      onTabChange: (newTab) => {
        this.historyTab = newTab;
        this.renderHistory();
      },
      onPreview: (item) => {
        const path = item.driveRelPath || undefined;
        ViewerConnector.preview({
          name: item.fileName,
          fileName: item.fileName,
          path,
          driveRelPath: path,
          category: 'pdf',
          mimeType: 'application/pdf',
          viewUrl: path ? `/api/v1/storage/file?path=${encodeURIComponent(path)}` : (item.sourceUrl || ''),
          downloadUrl: path ? `/api/v1/storage/file?path=${encodeURIComponent(path)}&download=true` : undefined
        });
      }
    });
  }

  render() {
    this.container.innerHTML = `
      <div id="slideshareWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-16 sm:pb-20">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs min-h-[44px]">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Dashboard</span>
            </a>
            <span class="text-zinc-400 dark:text-zinc-600">/</span>
            <span class="text-sky-600 dark:text-sky-400 font-semibold truncate inline-flex items-center gap-1.5">
              <i data-lucide="presentation" class="w-3.5 h-3.5 text-[#0077B5]"></i>
              <span>SlideShare Downloader</span>
            </span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            S · MASTER
          </span>
        </div>

        <!-- Input Box -->
        <div class="linear-card p-5 sm:p-7 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121216] shadow-xl space-y-4">
          <div class="space-y-1.5">
            <h1 class="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Tải Bài Thuyết Trình SlideShare</h1>
            <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Nhập hoặc dán liên kết SlideShare để tải slide chất lượng cao về PDF.</p>
          </div>

          <div class="relative flex items-center">
            <div class="absolute left-4 text-zinc-400 pointer-events-none">
              <i data-lucide="link" class="w-4 h-4"></i>
            </div>
            <input
              type="text"
              id="ssUrlInput"
              placeholder="Dán liên kết https://www.slideshare.net/..."
              class="w-full min-h-[48px] pl-11 pr-24 py-3 rounded-2xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition font-mono"
            />
            <div class="absolute right-2 flex items-center gap-1">
              <button id="btnClearSsUrl" class="hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
              <button id="btnPasteSsUrl" class="px-3 py-1.5 rounded-xl bg-zinc-200/70 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 min-h-[36px]">
                <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                <span>Dán</span>
              </button>
            </div>
          </div>

          <button id="btnResolveSs" class="w-full min-h-[44px] px-6 py-3 rounded-2xl bg-[#0077B5] hover:bg-[#0284C7] active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-600/25 transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="search" class="w-4 h-4"></i>
            <span>Phân tích Slide</span>
          </button>
        </div>

        <!-- Result Container -->
        <div id="ssResultContainer"></div>

        <!-- History Container -->
        <div id="slideshareHistoryContainer"></div>
      </div>
    `.trim();

    const input = this.container.querySelector('#ssUrlInput');
    if (input) {
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
    }
    this.container.addEventListener('click', this.boundHandleClick);

    if (window.lucide) window.lucide.createIcons({ root: this.container });
  }
}

export function renderSlideshareWorkspace() {
  return `<div id="slideshareWorkspaceRoot" class="w-full"></div>`;
}

export function attachSlideshareWorkspaceListeners() {
  const container = document.getElementById('slideshareWorkspaceRoot') || document.getElementById('mainContent');
  if (container) {
    const ws = new SlideshareWorkspace(container);
    ws.mount();
    return () => ws.unmount();
  }
}
