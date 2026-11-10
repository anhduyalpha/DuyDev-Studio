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
import { renderMediaHistorySection, attachMediaHistoryListeners, setMediaHistoryExpanded, triggerDownload, escapeHtml } from '../common/MediaHistorySection.js';

function formatErrorMessage(err, fallback = 'Lỗi xử lý') {
  if (!err) return fallback;
  if (typeof err === 'string' && err !== '[object Object]') return err;
  if (typeof err.message === 'string' && err.message !== '[object Object]') return err.message;
  if (typeof err.error === 'string' && err.error !== '[object Object]') return err.error;
  if (err.error && typeof err.error.message === 'string' && err.error.message !== '[object Object]') {
    return err.error.message;
  }
  return fallback;
}

export class SlideshareWorkspace {
  constructor(containerEl) {
    this.container = containerEl;
    this.url = '';
    this.lastResolvedUrl = null;
    this.loading = false;
    this.error = null;
    this.data = null;
    this.savingToDrive = false;
    this.saveToDrivePromise = null;
    this.savedDrivePath = null;
    this.savedFileName = null;
    this.savedPptxDrivePath = null;
    this.savedPptxFileName = null;
    this.currentSlideIndex = 0;
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

  async sanitizeCorruptedHistory() {
    try {
      const history = storage.getToolHistory('slideshare-downloader');
      const trash = storage.getToolTrash('slideshare-downloader');
      const isCorrupted = (item) => {
        const title = (item.title || '').toLowerCase();
        const fn = (item.fileName || '').toLowerCase();
        return title.includes('client challenge') || fn.includes('client challenge') || title.includes('undefined') || fn.includes('undefined');
      };

      for (const item of history) {
        if (isCorrupted(item)) {
          await storage.moveToTrash(item.id);
          await storage.permanentlyDeleteTrashItem(item.id);
        }
      }
      for (const item of trash) {
        if (isCorrupted(item)) {
          await storage.permanentlyDeleteTrashItem(item.id);
        }
      }
    } catch (_) {}
  }

  mount() {
    this.render();

    Promise.all([storage.fetchHistory(), storage.fetchTrash()]).then(async () => {
      await this.sanitizeCorruptedHistory();
      this.renderHistory();
    }).catch(() => {});

    window.addEventListener('paste', this.boundHandleGlobalPaste);
    window.addEventListener('keydown', this.boundHandleKeyDown);

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
    if (this.inputDebounce) {
      clearTimeout(this.inputDebounce);
      this.inputDebounce = null;
    }

    window.removeEventListener('paste', this.boundHandleGlobalPaste);
    window.removeEventListener('keydown', this.boundHandleKeyDown);

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
      input.removeEventListener('paste', this.boundHandlePaste);
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
      const val = e.target.value || '';
      this.url = val;
      this.updateInputActions();

      const clean = this.sanitizeUrl(val);
      if (clean && clean.includes('slideshare.net') && clean !== this.lastResolvedUrl) {
        if (this.inputDebounce) clearTimeout(this.inputDebounce);
        this.inputDebounce = setTimeout(() => {
          if (this.url === val && clean !== this.lastResolvedUrl) {
            this.resolvePresentation();
          }
        }, 200);
      }
    }
  }

  handlePaste(e) {
    if (e.target.id === 'ssUrlInput') {
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (!pasted) return;
      const clean = this.sanitizeUrl(pasted) || pasted.trim();
      if (clean) {
        e.preventDefault();
        e.target.value = clean;
        this.url = clean;
        this.updateInputActions();
        soundEngine?.play?.('click');
        if (this.inputDebounce) clearTimeout(this.inputDebounce);
        if (this.abortController) {
          this.abortController.abort();
          this.loading = false;
        }
        if (clean.includes('slideshare.net')) {
          this.resolvePresentation();
        }
      }
    }
  }

  handleGlobalPaste(e) {
    if (['TEXTAREA', 'INPUT'].includes(e.target?.tagName)) return;
    const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (!pasted) return;
    const clean = this.sanitizeUrl(pasted);
    if (clean && clean.includes('slideshare.net')) {
      e.preventDefault();
      const input = this.container.querySelector('#ssUrlInput');
      if (input) input.value = clean;
      this.url = clean;
      this.updateInputActions();
      soundEngine?.play?.('click');
      if (this.inputDebounce) clearTimeout(this.inputDebounce);
      if (this.abortController) {
        this.abortController.abort();
        this.loading = false;
      }
      this.resolvePresentation();
    }
  }

  handleKeyDown(e) {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.resolvePresentation();
      }
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.prevSlide();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      this.nextSlide();
    }
  }

  goToSlide(index) {
    if (!this.data?.slideImages || !this.data.slideImages.length) return;
    const total = this.data.slideImages.length;
    if (index < 0 || index >= total) return;
    this.currentSlideIndex = index;

    const img = this.container.querySelector('#ssActiveSlideImg');
    if (img) {
      img.src = this.data.slideImages[index];
      img.alt = `Slide ${index + 1}`;
    }

    const counter = this.container.querySelector('#ssSlideCounter');
    if (counter) {
      counter.textContent = `Trang ${index + 1} / ${total}`;
    }

    const thumbs = this.container.querySelectorAll('.ss-thumb-btn');
    thumbs.forEach((thumb, idx) => {
      if (idx === index) {
        thumb.className = 'ss-thumb-btn relative shrink-0 w-24 sm:w-28 aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer border-sky-500 ring-2 ring-sky-500/30 scale-[1.03] shadow-md opacity-100';
        thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        thumb.className = 'ss-thumb-btn relative shrink-0 w-24 sm:w-28 aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer border-transparent hover:border-zinc-400 opacity-60 hover:opacity-100';
      }
    });
  }

  prevSlide() {
    if (!this.data?.slideImages?.length) return;
    const total = this.data.slideImages.length;
    const nextIdx = this.currentSlideIndex > 0 ? this.currentSlideIndex - 1 : total - 1;
    this.goToSlide(nextIdx);
  }

  nextSlide() {
    if (!this.data?.slideImages?.length) return;
    const total = this.data.slideImages.length;
    const nextIdx = this.currentSlideIndex < total - 1 ? this.currentSlideIndex + 1 : 0;
    this.goToSlide(nextIdx);
  }

  toggleFullscreen() {
    const stage = this.container.querySelector('#ssPresentationStage');
    if (!stage) return;
    if (!document.fullscreenElement) {
      stage.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  async handleClick(e) {
    const prevSlideBtn = e.target.closest('#btnPrevSlide');
    if (prevSlideBtn) {
      e.preventDefault();
      this.prevSlide();
      return;
    }

    const nextSlideBtn = e.target.closest('#btnNextSlide');
    if (nextSlideBtn) {
      e.preventDefault();
      this.nextSlide();
      return;
    }

    const fullscreenBtn = e.target.closest('#btnFullscreenSlide');
    if (fullscreenBtn) {
      e.preventDefault();
      this.toggleFullscreen();
      return;
    }

    const thumbBtn = e.target.closest('.ss-thumb-btn');
    if (thumbBtn) {
      e.preventDefault();
      const idx = parseInt(thumbBtn.dataset.slideIndex, 10);
      if (!isNaN(idx)) this.goToSlide(idx);
      return;
    }

    const downloadPptxBtn = e.target.closest('#btnDownloadSsPptx');
    if (downloadPptxBtn) {
      e.preventDefault();
      this.downloadPptxDirect();
      return;
    }

    const downloadPdfBtn = e.target.closest('#btnDownloadSsPdf') || e.target.closest('#btnDownloadSs');
    if (downloadPdfBtn) {
      e.preventDefault();
      this.downloadPdfDirect();
      return;
    }

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
          if (this.inputDebounce) clearTimeout(this.inputDebounce);
          if (this.abortController) {
            this.abortController.abort();
            this.loading = false;
          }
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
      this.lastResolvedUrl = null;
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
    const cleanUrl = this.sanitizeUrl(this.url);
    if (!cleanUrl) {
      showToast('Vui lòng nhập liên kết SlideShare hợp lệ', 'warning');
      return;
    }

    if (this.loading) {
      if (this.abortController) {
        this.abortController.abort();
      }
    }

    this.lastResolvedUrl = cleanUrl;
    this.loading = true;
    this.error = null;
    this.data = null;
    this.savedDrivePath = null;
    this.savedFileName = null;
    this.savedPptxDrivePath = null;
    this.savedPptxFileName = null;
    this.currentSlideIndex = 0;
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
      this.savedDrivePath = null;
      this.savedFileName = null;
      this.savedPptxDrivePath = null;
      this.savedPptxFileName = null;
      taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
      soundEngine?.play?.('success');

      // Add presentation to history immediately upon get (not saved to Drive until user explicitly clicks Save)
      const cleanTitle = (res.title || 'SlideShare Presentation').replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 80);
      const pptxName = `[SlideShare]_${cleanTitle}_${String(res.id).slice(-8)}.pptx`;
      const pptxDl = `/api/v1/slideshare/download?file=${encodeURIComponent(pptxName)}&temp=1`;
      const coverImg = res.coverUrl || (res.slideImages && res.slideImages[0]) || '';

      await storage.addHistoryItem({
        id: `ss_${res.id}`,
        toolId: 'slideshare-downloader',
        toolTitle: 'SlideShare Downloader',
        title: res.title,
        fileName: pptxName,
        fileSize: (res.slideCount || 1) * 150000,
        resultSize: (res.slideCount || 1) * 150000,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        driveRelPath: null,
        downloadUrl: pptxDl,
        thumbnail: coverImg,
        cover: coverImg,
        slideImages: res.slideImages || [],
        author: res.author,
        sourceUrl: cleanUrl,
        timestamp: Date.now()
      });

      // Expand history box and render immediately
      setMediaHistoryExpanded('slideshare-downloader', true);
      this.renderResultArea();
      this.renderHistory();
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
    if (!this.data) return null;

    // If an operation is already in-flight, return the existing promise to prevent race conditions
    if (this.saveToDrivePromise) {
      return await this.saveToDrivePromise;
    }

    this.saveToDrivePromise = (async () => {
      this.savingToDrive = true;
      soundEngine?.play?.('start');
      if (!options.silent) {
        showToast('Đang tải và ghép các trang slide thành PDF & PPTX...', 'info');
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
          id: String(this.data.id),
          originalUrl: this.data.originalUrl,
          cover: this.data.coverUrl,
          author: this.data.author,
          slideImages: this.data.slideImages || [],
          category: 'slideshare'
        });

        this.savedDrivePath = result.drivePath;
        this.savedFileName = result.fileName;
        this.savedPptxDrivePath = result.pptxDrivePath || null;
        this.savedPptxFileName = result.pptxFileName || null;
        this.savingToDrive = false;
        taskCoordinator.updateTask(taskId, { status: 'completed', progress: 100 });
        soundEngine?.play?.('bell');
        if (!options.silent) {
          showToast('Đã lưu bài thuyết trình vào Studio Drive (/slideshare)!', 'success');
        }

        // Update existing master history item with real Drive path
        const cleanTitle = (this.data.title || 'Presentation').replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 80);
        const pptxName = result.pptxFileName || `[SlideShare]_${cleanTitle}_${String(this.data.id).slice(-8)}.pptx`;
        const coverImg = this.data.coverUrl || (this.data.slideImages && this.data.slideImages[0]) || '';

        await storage.addHistoryItem({
          id: `ss_${this.data.id}`,
          toolId: 'slideshare-downloader',
          toolTitle: 'SlideShare Downloader',
          title: this.data.title,
          fileName: pptxName,
          fileSize: result.pptxSize || result.size,
          resultSize: result.pptxSize || result.size,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          driveRelPath: result.pptxDrivePath || result.drivePath,
          downloadUrl: `/api/v1/slideshare/download?file=${encodeURIComponent(pptxName)}`,
          thumbnail: coverImg,
          cover: coverImg,
          slideImages: this.data.slideImages || [],
          author: this.data.author,
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
        const errMsg = formatErrorMessage(err, 'Lỗi khi lưu tài liệu vào Studio Drive');
        showToast(errMsg, 'error');
        this.renderResultArea();
        throw err;
      }
    })().finally(() => {
      this.saveToDrivePromise = null;
    });

    return await this.saveToDrivePromise;
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

  async downloadPptxDirect() {
    if (!this.data) return;
    const btn = this.container.querySelector('#btnDownloadSsPptx');
    const origHtml = btn?.innerHTML;

    const cleanTitle = (this.data.title || 'SlideShare Presentation').replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 80);
    const pptxName = this.savedPptxFileName || `[SlideShare]_${cleanTitle}_${String(this.data.id).slice(-8)}.pptx`;
    let dlUrl = '';

    if (this.savedPptxDrivePath) {
      dlUrl = `/api/v1/slideshare/download?file=${encodeURIComponent(pptxName)}`;
    } else {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang chuẩn bị PPTX...</span>';
        if (window.lucide) window.lucide.createIcons({ root: btn });
      }
      showToast('Đang tổng hợp các slide thành tệp PowerPoint (.pptx)...', 'info');
      try {
        const comp = await slideshareApi.compileTemp({
          id: String(this.data.id),
          title: this.data.title,
          format: 'pptx',
          slideImages: this.data.slideImages || [],
          originalUrl: this.data.originalUrl
        });
        dlUrl = comp.downloadUrl;
      } catch (err) {
        const msg = formatErrorMessage(err, 'Lỗi khi tạo tệp PowerPoint (.pptx)');
        showToast(msg, 'error');
        return;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('opacity-75', 'cursor-not-allowed');
          btn.innerHTML = origHtml;
          if (window.lucide) window.lucide.createIcons({ root: btn });
        }
      }
    }

    triggerDownload(dlUrl, pptxName, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    soundEngine?.play?.('success');
    showToast('Đang tải tệp PowerPoint (.pptx) về máy...', 'success');
  }

  async downloadPdfDirect() {
    if (!this.data) return;
    const btn = this.container.querySelector('#btnDownloadSsPdf');
    const origHtml = btn?.innerHTML;

    const cleanTitle = (this.data.title || 'SlideShare Presentation').replace(/[<>:"/\\|?*]/g, '_').trim().slice(0, 80);
    const pdfName = this.savedFileName || `[SlideShare]_${cleanTitle}_${String(this.data.id).slice(-8)}.pdf`;
    let dlUrl = '';

    if (this.savedDrivePath) {
      dlUrl = `/api/v1/slideshare/download?file=${encodeURIComponent(pdfName)}`;
    } else {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang chuẩn bị PDF...</span>';
        if (window.lucide) window.lucide.createIcons({ root: btn });
      }
      showToast('Đang đóng gói các slide thành tệp PDF...', 'info');
      try {
        const comp = await slideshareApi.compileTemp({
          id: String(this.data.id),
          title: this.data.title,
          format: 'pdf',
          slideImages: this.data.slideImages || [],
          originalUrl: this.data.originalUrl
        });
        dlUrl = comp.downloadUrl;
      } catch (err) {
        const msg = formatErrorMessage(err, 'Lỗi khi tạo tệp PDF');
        showToast(msg, 'error');
        return;
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('opacity-75', 'cursor-not-allowed');
          btn.innerHTML = origHtml;
          if (window.lucide) window.lucide.createIcons({ root: btn });
        }
      }
    }

    triggerDownload(dlUrl, pdfName, 'application/pdf');
    soundEngine?.play?.('success');
    showToast('Đang tải tệp PDF về máy...', 'success');
  }

  renderResultArea() {
    const el = this.container.querySelector('#ssResultContainer');
    if (!el) return;

    if (this.loading) {
      el.innerHTML = `
        <div class="linear-card p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-[#121216]/70 backdrop-blur-md text-center space-y-3 animate-fadeIn">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-500 animate-pulse">
            <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
          </div>
          <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">Đang trích xuất bài thuyết trình...</h3>
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
    const slideImages = Array.isArray(this.data.slideImages) ? this.data.slideImages : [];
    const hasSlides = slideImages.length > 0;
    const totalSlides = hasSlides ? slideImages.length : (slideCount || 1);
    const cleanAuthor = author ? (author.startsWith('@') ? author : `@${author}`) : '';

    el.innerHTML = `
      <div class="linear-card p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121216] shadow-xl space-y-5 animate-fadeIn">
        <div class="flex flex-col sm:flex-row gap-4 items-start">
          ${coverUrl ? `
            <div class="relative w-full sm:w-44 h-48 sm:h-32 shrink-0 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5">
              <img src="${escapeHtml(coverUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" />
              <div class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono font-bold text-white">
                ${totalSlides} slide
              </div>
            </div>
          ` : ''}
          <div class="space-y-1.5 flex-1 min-w-0">
            <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">${escapeHtml(title)}</h2>
            <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              ${cleanAuthor ? `<span class="font-medium text-zinc-700 dark:text-zinc-300">${escapeHtml(cleanAuthor)}</span><span>•</span>` : ''}
              <span class="font-mono">${totalSlides} trang</span>
              ${isSaved ? `<span>•</span><span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5"><i data-lucide="check" class="w-2.5 h-2.5"></i> Đã lưu Drive</span>` : ''}
            </div>
            ${description ? `<p class="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed pt-1">${escapeHtml(description)}</p>` : ''}
          </div>
        </div>

        <!-- Trình xem Slide trực tiếp trong module -->
        ${hasSlides ? `
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between gap-2 px-1">
              <div class="flex items-center gap-2">
                <i data-lucide="monitor-play" class="w-4 h-4 text-sky-500"></i>
                <span class="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200">Trình xem Slide trực tiếp</span>
              </div>
              <div class="flex items-center gap-2">
                <span id="ssSlideCounter" class="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                  Trang ${this.currentSlideIndex + 1} / ${totalSlides}
                </span>
                <button id="btnFullscreenSlide" class="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer" title="Toàn màn hình">
                  <i data-lucide="maximize-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <!-- Stage -->
            <div id="ssPresentationStage" class="relative w-full aspect-video rounded-2xl overflow-hidden bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-2xl group select-none">
              <img id="ssActiveSlideImg" src="${escapeHtml(slideImages[this.currentSlideIndex] || coverUrl || '')}" alt="Slide ${this.currentSlideIndex + 1}" class="max-w-full max-h-full object-contain transition-opacity duration-200" />
              
              <!-- Floating Navigation Controls -->
              <button id="btnPrevSlide" class="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white backdrop-blur-md border border-white/20 transition flex items-center justify-center opacity-80 group-hover:opacity-100 cursor-pointer shadow-lg z-10" title="Slide trước (←)">
                <i data-lucide="chevron-left" class="w-6 h-6"></i>
              </button>
              <button id="btnNextSlide" class="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 active:scale-95 text-white backdrop-blur-md border border-white/20 transition flex items-center justify-center opacity-80 group-hover:opacity-100 cursor-pointer shadow-lg z-10" title="Slide sau (→)">
                <i data-lucide="chevron-right" class="w-6 h-6"></i>
              </button>
            </div>

            <!-- Slide Thumbnails Strip -->
            <div id="ssThumbStrip" class="flex gap-2 overflow-x-auto p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 scrollbar-thin">
              ${slideImages.map((img, idx) => `
                <button class="ss-thumb-btn relative shrink-0 w-24 sm:w-28 aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${idx === this.currentSlideIndex ? 'border-sky-500 ring-2 ring-sky-500/30 scale-[1.03] shadow-md opacity-100' : 'border-transparent hover:border-zinc-400 opacity-60 hover:opacity-100'}" data-slide-index="${idx}">
                  <img src="${escapeHtml(img)}" class="w-full h-full object-cover" loading="lazy" />
                  <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono font-bold text-white leading-none">
                    ${idx + 1}
                  </span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="pt-3 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center gap-3">
          <!-- Tải PDF -->
          <button id="btnDownloadSsPdf" class="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#0077B5] hover:bg-[#0284C7] active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            <span>Tải PDF (.pdf)</span>
          </button>

          <!-- Tải PPTX -->
          <button id="btnDownloadSsPptx" class="min-h-[44px] px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="file-presentation" class="w-4 h-4"></i>
            <span>Tải PowerPoint (.pptx)</span>
          </button>

          <!-- Lưu Drive -->
          <button id="btnSaveSsDrive" ${this.savingToDrive ? 'disabled' : ''} class="min-h-[44px] px-4 py-2.5 rounded-2xl ${isSaved ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10'} active:scale-[0.98] text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
            ${this.savingToDrive ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang lưu...</span>' : isSaved ? '<i data-lucide="check" class="w-4 h-4"></i><span>Đã lưu vào Drive</span>' : '<i data-lucide="hard-drive" class="w-4 h-4"></i><span>Lưu vào Drive</span>'}
          </button>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: el });
  }

  attachHistoryListeners() {
    const historyContainer = this.container.querySelector('#slideshareHistoryContainer');
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
              ? storage.getToolTrash('slideshare-downloader')
              : storage.getToolHistory('slideshare-downloader');
            countBadge.textContent = `${currentItems.length} mục`;
          }
        }, 260);
      }
    };
    historyContainer.addEventListener('click', handleInPlaceAction);

    const baseCleanup = attachMediaHistoryListeners({
      container: historyContainer,
      toolId: 'slideshare-downloader',
      accentColor: '#0077B5',
      onTabChange: (newTab) => {
        this.historyTab = newTab;
        this.renderHistory();
      },
      onReResolve: (url) => {
        if (url) {
          this.url = url;
          const input = this.container.querySelector('#ssUrlInput');
          if (input) input.value = url;
          this.updateInputActions();
          this.resolvePresentation();
        }
      },
      onSaveDrive: async (item) => {
        if (!item) return;
        showToast('Đang lưu bài thuyết trình vào Studio Drive...', 'info');
        try {
          const res = await slideshareApi.saveToDrive({
            url: item.sourceUrl || item.originalUrl || '',
            title: item.title,
            id: String(item.id).replace(/^ss_/, ''),
            originalUrl: item.sourceUrl || item.originalUrl || '',
            cover: item.cover || item.thumbnail,
            author: item.author,
            slideImages: item.slideImages || [],
            category: 'slideshare'
          });
          const pptxName = res.pptxFileName || `[SlideShare]_${item.title}_${String(item.id).slice(-8)}.pptx`;
          await storage.addHistoryItem({
            ...item,
            driveRelPath: res.pptxDrivePath || res.drivePath,
            downloadUrl: `/api/v1/slideshare/download?file=${encodeURIComponent(pptxName)}`
          });
          showToast('Đã lưu bài thuyết trình vào Studio Drive!', 'success');
          this.renderHistory();
        } catch (err) {
          showToast(formatErrorMessage(err, 'Lỗi khi lưu vào Studio Drive'), 'error');
        }
      },
      onHistoryChange: () => {
        this.renderHistory();
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
    const el = this.container.querySelector('#slideshareHistoryContainer');
    if (!el) return;
    el.innerHTML = renderMediaHistorySection({
      toolId: 'slideshare-downloader',
      title: 'Lịch Sử Tải Xuống',
      activeTab: this.historyTab,
      fallbackIcon: 'presentation',
      accentColor: '#0077B5',
      driveFolderPath: '/slideshare'
    });
    this.attachHistoryListeners();
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

        <!-- History Container (Immediate render) -->
        <div id="slideshareHistoryContainer">
          ${renderMediaHistorySection({
            toolId: 'slideshare-downloader',
            title: 'Lịch Sử Tải Xuống',
            activeTab: this.historyTab,
            fallbackIcon: 'presentation',
            accentColor: '#0077B5',
            driveFolderPath: '/slideshare'
          })}
        </div>
      </div>
    `.trim();

    const input = this.container.querySelector('#ssUrlInput');
    if (input) {
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
      input.addEventListener('paste', this.boundHandlePaste);
    }
    this.container.addEventListener('click', this.boundHandleClick);

    this.attachHistoryListeners();

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
