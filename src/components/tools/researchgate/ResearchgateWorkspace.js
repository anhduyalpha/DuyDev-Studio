/**
 * ResearchgateWorkspace.js - ResearchGate Scientific Paper & Publication Downloader Workspace
 * Compliant with DuyDev Studio Universal Tool Module Architecture (KI-CON-019).
 */

import { researchgateApi } from './services/researchgateApi.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { storage } from '../../../utilities/storage.js';
import { renderMediaHistorySection, attachMediaHistoryListeners, escapeHtml } from '../common/MediaHistorySection.js';

export class ResearchgateWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.url = '';
    this.loading = false;
    this.error = null;
    this.data = null;
    this.savingToDrive = false;
    this.handlePendingEvent = null;
    this.historyTab = 'history';
    this.historyCleanup = null;
    this.abortController = null;
    this.inputDebounce = null;

    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandlePaste = this.handlePaste.bind(this);
    this.boundHandleGlobalPaste = this.handleGlobalPaste.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  mount() {
    this.render();

    Promise.all([storage.fetchHistory(), storage.fetchTrash()]).then(() => {
      this.renderHistory();
    }).catch(() => {});

    window.addEventListener('paste', this.boundHandleGlobalPaste);

    const pendingUrl = consumePendingAutoStart('researchgate') || consumePendingAutoStart('researchgate-downloader');
    if (pendingUrl) {
      this.url = this.sanitizeUrl(pendingUrl) || pendingUrl.trim();
      const input = this.container.querySelector('#rgUrlInput');
      if (input) input.value = this.url;
      this.updateInputActions();
      setTimeout(() => this.resolvePublication(), 60);
    }

    this.handlePendingEvent = (e) => {
      if ((e.detail?.toolId === 'researchgate' || e.detail?.toolId === 'researchgate-downloader') && e.detail.url) {
        this.url = this.sanitizeUrl(e.detail.url) || e.detail.url.trim();
        const input = this.container.querySelector('#rgUrlInput');
        if (input) input.value = this.url;
        this.updateInputActions();
        setTimeout(() => this.resolvePublication(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  unmount() {
    this.abortController = null;
    if (this.inputDebounce) {
      clearTimeout(this.inputDebounce);
      this.inputDebounce = null;
    }

    window.removeEventListener('paste', this.boundHandleGlobalPaste);

    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    const input = this.container.querySelector('#rgUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
      input.removeEventListener('paste', this.boundHandlePaste);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.innerHTML = '';
  }

  sanitizeUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let text = raw.trim();

    if (/^(?:[a-zA-Z0-9_-]+\.)?researchgate\.net(?:\/|$)/i.test(text)) {
      text = `https://${text}`;
    }

    const match = text.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?researchgate\.net\/[^\s"'<>]+/i);
    if (!match) return '';

    let clean = match[0].replace(/[.,;!?)"'\]>]+$/, '');
    try {
      const u = new URL(clean);
      const trackingParams = ['_tp', 'enrichId', 'enrichSource', 'el', '_esc'];
      for (const p of trackingParams) {
        u.searchParams.delete(p);
      }
      return u.toString();
    } catch {
      return clean;
    }
  }

  handleInput(e) {
    if (e.target.id === 'rgUrlInput') {
      const val = e.target.value || '';
      this.url = val;
      this.updateInputActions();

      const clean = this.sanitizeUrl(val);
      if (clean && clean.includes('researchgate.net') && (val.startsWith('http') || val.startsWith('researchgate.net'))) {
        clearTimeout(this.inputDebounce);
        this.inputDebounce = setTimeout(() => {
          if (this.url === val && !this.loading && !this.data) {
            this.resolvePublication();
          }
        }, 300);
      }
    }
  }

  handlePaste(e) {
    if (e.target.id === 'rgUrlInput') {
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (!pasted) return;
      const clean = this.sanitizeUrl(pasted) || pasted.trim();
      if (clean) {
        e.preventDefault();
        e.target.value = clean;
        this.url = clean;
        this.updateInputActions();
        soundEngine?.play?.('click');
        if (clean.includes('researchgate.net')) {
          setTimeout(() => this.resolvePublication(), 40);
        }
      }
    }
  }

  handleGlobalPaste(e) {
    if (['TEXTAREA', 'INPUT'].includes(e.target?.tagName)) return;
    const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (!pasted) return;
    const clean = this.sanitizeUrl(pasted);
    if (clean && clean.includes('researchgate.net')) {
      e.preventDefault();
      const input = this.container.querySelector('#rgUrlInput');
      if (input) input.value = clean;
      this.url = clean;
      this.updateInputActions();
      soundEngine?.play?.('click');
      setTimeout(() => this.resolvePublication(), 40);
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.resolvePublication();
    }
  }

  async handleClick(e) {
    const pasteBtn = e.target.closest('#btnPasteRgUrl');
    if (pasteBtn) {
      e.preventDefault();
      try {
        const text = await readText();
        if (text) {
          const clean = this.sanitizeUrl(text) || text.trim();
          this.url = clean;
          const input = this.container.querySelector('#rgUrlInput');
          if (input) input.value = clean;
          this.updateInputActions();
          soundEngine?.play?.('click');
          if (clean.includes('researchgate.net')) {
            this.resolvePublication();
          } else {
            showToast('Đã dán liên kết. Nhấn Phân tích để tiếp tục.', 'info');
          }
        }
      } catch {
        showToast('Không thể đọc clipboard. Vui lòng dán thủ công.', 'error');
      }
      return;
    }

    const clearBtn = e.target.closest('#btnClearRgUrl');
    if (clearBtn) {
      e.preventDefault();
      this.url = '';
      const input = this.container.querySelector('#rgUrlInput');
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

    const resolveBtn = e.target.closest('#btnResolveRg');
    if (resolveBtn) {
      e.preventDefault();
      this.resolvePublication();
      return;
    }

    const previewBtn = e.target.closest('#btnPreviewRg');
    if (previewBtn) {
      e.preventDefault();
      if (!this.data) return;
      ViewerConnector.preview({
        name: `${this.data.title || 'Paper'}.pdf`,
        fileName: `${this.data.title || 'Paper'}.pdf`,
        category: 'document',
        mimeType: 'application/pdf',
        viewUrl: this.data.coverUrl || '',
        downloadUrl: researchgateApi.getStreamUrl(this.data.pdfUrl || this.data.originalUrl, `${this.data.title || 'researchgate'}.pdf`, true)
      });
      return;
    }

    const saveDriveBtn = e.target.closest('#btnSaveRgDrive');
    if (saveDriveBtn) {
      e.preventDefault();
      this.saveToDrive();
      return;
    }
  }

  updateInputActions() {
    const clearBtn = this.container.querySelector('#btnClearRgUrl');
    if (clearBtn) {
      if (this.url && this.url.trim().length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }
  }

  async resolvePublication() {
    if (this.loading) return;

    const cleanUrl = this.sanitizeUrl(this.url);
    if (!cleanUrl) {
      showToast('Vui lòng nhập liên kết ResearchGate hợp lệ', 'warning');
      return;
    }

    this.loading = true;
    this.error = null;
    this.data = null;
    this.renderResultArea();
    soundEngine?.play?.('start');

    const resolveBtn = this.container.querySelector('#btnResolveRg');
    if (resolveBtn) {
      resolveBtn.disabled = true;
      resolveBtn.classList.add('opacity-75', 'cursor-not-allowed');
      resolveBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang phân tích...</span>';
      if (window.lucide) window.lucide.createIcons({ root: resolveBtn });
    }

    const taskId = `rg_${Date.now()}`;
    taskCoordinator.createTask(taskId, {
      title: 'Phân tích tài liệu ResearchGate',
      type: 'document-resolve',
      progress: 25
    });

    try {
      this.abortController = new AbortController();
      const res = await researchgateApi.resolve(cleanUrl, { signal: this.abortController.signal });
      this.data = res;
      this.loading = false;
      taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
      soundEngine?.play?.('success');
      this.renderResultArea();
    } catch (err) {
      if (err.name === 'AbortError') return;
      this.loading = false;
      this.error = err.message || 'Không thể phân tích tài liệu ResearchGate';
      taskCoordinator.updateTask(taskId, { status: 'failed', progress: 100 });
      soundEngine?.play?.('error');
      this.renderResultArea();
    } finally {
      if (resolveBtn) {
        resolveBtn.disabled = false;
        resolveBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        resolveBtn.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i><span>Phân tích bài báo</span>';
        if (window.lucide) window.lucide.createIcons({ root: resolveBtn });
      }
    }
  }

  async saveToDrive() {
    if (!this.data || this.savingToDrive) return;

    this.savingToDrive = true;
    soundEngine?.play?.('start');
    showToast('Đang tải và lưu tệp PDF vào Studio Drive...', 'info');

    const taskId = `rg_drive_${Date.now()}`;
    taskCoordinator.createTask(taskId, {
      title: `Lưu Drive: ${this.data.title || 'Scientific Publication'}`,
      type: 'pdf-compile',
      progress: 30
    });

    try {
      const result = await researchgateApi.saveToDrive({
        url: this.data.pdfUrl || this.data.originalUrl,
        title: this.data.title,
        id: this.data.id,
        originalUrl: this.data.originalUrl,
        cover: this.data.coverUrl,
        author: this.data.authors?.join(', ') || 'ResearchGate Author',
        category: 'researchgate'
      });

      this.savingToDrive = false;
      taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
      soundEngine?.play?.('bell');
      showToast('Đã lưu công bố khoa học vào Studio Drive (/researchgate)!', 'success');

      // Add to media history
      await storage.addHistoryItem({
        id: `rg_${this.data.id}_${Date.now()}`,
        toolId: 'researchgate-downloader',
        title: this.data.title,
        fileName: result.fileName,
        fileSize: result.size,
        mimeType: 'application/pdf',
        driveRelPath: result.drivePath,
        thumbnailUrl: this.data.coverUrl,
        sourceUrl: this.data.originalUrl,
        timestamp: Date.now()
      });

      this.renderResultArea();
      this.renderHistory();
    } catch (err) {
      this.savingToDrive = false;
      taskCoordinator.updateTask(taskId, { status: 'failed', progress: 100 });
      soundEngine?.play?.('error');
      showToast(err.message || 'Lỗi khi lưu tài liệu vào Studio Drive', 'error');
      this.renderResultArea();
    }
  }

  renderResultArea() {
    const el = this.container.querySelector('#rgResultContainer');
    if (!el) return;

    if (this.loading) {
      el.innerHTML = `
        <div class="linear-card p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-[#121216]/70 backdrop-blur-md text-center space-y-4 animate-fadeIn">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-500 animate-pulse">
            <i data-lucide="loader-2" class="w-7 h-7 animate-spin"></i>
          </div>
          <h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100">Đang bóc tách bài báo khoa học...</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">Phân giải DOI và tìm kiếm luồng PDF Open-Access.</p>
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

    const { title, authors, abstract, doi, journal, publicationDate, coverUrl } = this.data;

    el.innerHTML = `
      <div class="linear-card p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121216] shadow-xl space-y-5 animate-fadeIn">
        <div class="flex flex-col sm:flex-row gap-4 items-start">
          ${coverUrl ? `
            <div class="relative w-full sm:w-44 h-48 sm:h-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5">
              <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" />
            </div>
          ` : ''}
          <div class="space-y-2 flex-1 min-w-0">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <i data-lucide="microscope" class="w-3 h-3"></i>
              <span>ResearchGate Publication</span>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">${escapeHtml(title)}</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Tác giả: <strong class="text-zinc-700 dark:text-zinc-300">${escapeHtml(authors?.join(', ') || 'ResearchGate Scientists')}</strong></p>
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 font-mono">
              ${doi ? `<span class="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 text-teal-600 dark:text-teal-400">DOI: ${escapeHtml(doi)}</span>` : ''}
              ${journal ? `<span>${escapeHtml(journal)}</span>` : ''}
              ${publicationDate ? `<span>• ${escapeHtml(publicationDate)}</span>` : ''}
            </div>
            ${abstract ? `<p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">${escapeHtml(abstract)}</p>` : ''}
          </div>
        </div>

        <div class="pt-2 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center gap-3">
          <button id="btnSaveRgDrive" ${this.savingToDrive ? 'disabled' : ''} class="flex-1 min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#0D9488] hover:bg-[#14B8A6] active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-lg shadow-teal-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
            ${this.savingToDrive ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang xử lý & Lưu...</span>' : '<i data-lucide="hard-drive" class="w-4 h-4"></i><span>Lưu vào Studio Drive</span>'}
          </button>
          <button id="btnPreviewRg" class="min-h-[44px] px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Xem trước</span>
          </button>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: el });
  }

  renderHistory() {
    const el = this.container.querySelector('#researchgateHistoryContainer');
    if (!el) return;
    el.innerHTML = renderMediaHistorySection({
      toolId: 'researchgate-downloader',
      historyTab: this.historyTab
    });
    if (this.historyCleanup) this.historyCleanup();
    this.historyCleanup = attachMediaHistoryListeners({
      container: el,
      toolId: 'researchgate-downloader',
      historyTab: this.historyTab,
      onTabChange: (newTab) => {
        this.historyTab = newTab;
        this.renderHistory();
      },
      onPreview: (item) => {
        ViewerConnector.preview({
          name: item.fileName,
          fileName: item.fileName,
          path: item.driveRelPath || undefined,
          category: 'document',
          mimeType: 'application/pdf',
          viewUrl: item.driveRelPath ? `/api/v1/storage/file?path=${encodeURIComponent(item.driveRelPath)}` : (item.sourceUrl || '')
        });
      }
    });
  }

  render() {
    this.container.innerHTML = `
      <div id="researchgateWorkspaceRoot" class="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-16 sm:pb-20">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs min-h-[44px]">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Dashboard</span>
            </a>
            <span class="text-zinc-400 dark:text-zinc-600">/</span>
            <span class="text-teal-600 dark:text-teal-400 font-semibold truncate inline-flex items-center gap-1.5">
              <i data-lucide="microscope" class="w-3.5 h-3.5 text-[#0D9488]"></i>
              <span>ResearchGate Downloader</span>
            </span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            S · MASTER
          </span>
        </div>

        <!-- Input Box -->
        <div class="linear-card p-5 sm:p-7 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121216] shadow-xl space-y-4">
          <div class="space-y-1.5">
            <h1 class="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Tải Công Bố Khoa Học ResearchGate</h1>
            <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Nhập liên kết bài báo hoặc mã DOI trên ResearchGate để trích xuất tệp PDF.</p>
          </div>

          <div class="relative flex items-center">
            <div class="absolute left-4 text-zinc-400 pointer-events-none">
              <i data-lucide="link" class="w-4 h-4"></i>
            </div>
            <input
              type="text"
              id="rgUrlInput"
              placeholder="Dán liên kết https://www.researchgate.net/publication/..."
              class="w-full min-h-[48px] pl-11 pr-24 py-3 rounded-2xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition font-mono"
            />
            <div class="absolute right-2 flex items-center gap-1">
              <button id="btnClearRgUrl" class="hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
              <button id="btnPasteRgUrl" class="px-3 py-1.5 rounded-xl bg-zinc-200/70 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 min-h-[36px]">
                <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                <span>Dán</span>
              </button>
            </div>
          </div>

          <button id="btnResolveRg" class="w-full min-h-[44px] px-6 py-3 rounded-2xl bg-[#0D9488] hover:bg-[#14B8A6] active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-lg shadow-teal-600/25 transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="search" class="w-4 h-4"></i>
            <span>Phân tích Công bố</span>
          </button>
        </div>

        <!-- Result Container -->
        <div id="rgResultContainer"></div>

        <!-- History Container -->
        <div id="researchgateHistoryContainer"></div>
      </div>
    `.trim();

    const input = this.container.querySelector('#rgUrlInput');
    if (input) {
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
      input.addEventListener('paste', this.boundHandlePaste);
    }
    this.container.addEventListener('click', this.boundHandleClick);

    if (window.lucide) window.lucide.createIcons({ root: this.container });
  }
}

export function renderResearchgateWorkspace() {
  return `<div id="researchgateWorkspaceRoot" class="w-full"></div>`;
}

export function attachResearchgateWorkspaceListeners() {
  const container = document.getElementById('researchgateWorkspaceRoot') || document.getElementById('mainContent');
  if (container) {
    const ws = new ResearchgateWorkspace(container);
    ws.mount();
    return () => ws.unmount();
  }
}
