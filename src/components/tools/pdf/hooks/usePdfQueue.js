/**
 * usePdfQueue - PDF Studio Pro State & Job Orchestration
 * Supports specialized rotation, visual splitting, file reordering, and preset compression
 */

import { showToast } from '../../../../utilities/toast.js';
import { watchJobProgress } from '../../../../utilities/jobWatcher.js';
import { loadModuleState, saveModuleState } from '../../../../utilities/moduleState.js';
import { uploadPdfFiles, dispatchPdfJob, buildPdfResult } from './pdfApi.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';

const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'tiff', 'tif', 'svg']);

/**
 * Validates and filters input files strictly based on the active PDF Studio mode.
 */
export function filterFilesForMode(fileList, mode) {
  const isImages = mode === 'images_to_pdf';
  const rawArray = Array.from(fileList || []);
  const validFiles = [];
  let rejectedCount = 0;
  let hasPdfRejectedInImageMode = false;

  for (const file of rawArray) {
    const ext = file.name ? file.name.split('.').pop()?.toLowerCase() : '';
    const mime = file.type ? file.type.toLowerCase() : '';

    if (isImages) {
      const isPdf = ext === 'pdf' || mime === 'application/pdf' || mime.includes('pdf');
      if (isPdf) {
        hasPdfRejectedInImageMode = true;
        rejectedCount++;
        continue;
      }
      const isImg = mime.startsWith('image/') || ALLOWED_IMAGE_EXTS.has(ext);
      if (isImg) validFiles.push(file);
      else rejectedCount++;
    } else {
      const isPdf = mime === 'application/pdf' || ext === 'pdf';
      if (isPdf) validFiles.push(file);
      else rejectedCount++;
    }
  }

  return { validFiles, rejectedCount, isImages, hasPdfRejectedInImageMode };
}

/**
 * Cleanly releases memory and DOM resources for a PDF/Image file item.
 */
export function releasePdfFileResources(file) {
  if (!file) return;
  if (file.localUrl) {
    try { URL.revokeObjectURL(file.localUrl); } catch {}
  }
  if (file.cachedDoc?.destroy) {
    try { file.cachedDoc.destroy(); } catch {}
  }
  if (file._thumbCache) {
    file._thumbCache.forEach((bmp) => {
      try { if (bmp.close) bmp.close(); } catch {}
    });
    file._thumbCache.clear();
  }
}

/**
 * Validates and parses split page ranges (e.g., "1-3, 5, 8-10").
 */
export function parseAndValidatePageRange(input, totalPages = 0) {
  if (!input || !input.trim()) {
    return { valid: true, error: null, pages: [] };
  }
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
  const pages = new Set();

  for (const part of parts) {
    if (part.includes('-')) {
      const bounds = part.split('-').map((s) => s.trim());
      if (bounds.length !== 2) {
        return { valid: false, error: `Dải trang không hợp lệ: "${part}"`, pages: [] };
      }
      const start = Number(bounds[0]);
      const end = Number(bounds[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        return { valid: false, error: `Dải trang không hợp lệ: "${part}"`, pages: [] };
      }
      if (totalPages > 0 && end > totalPages) {
        return { valid: false, error: `Trang ${end} vượt quá tổng số ${totalPages} trang`, pages: [] };
      }
      for (let p = start; p <= end; p++) pages.add(p);
    } else {
      const p = Number(part);
      if (!Number.isInteger(p) || p < 1) {
        return { valid: false, error: `Số trang không hợp lệ: "${part}"`, pages: [] };
      }
      if (totalPages > 0 && p > totalPages) {
        return { valid: false, error: `Trang ${p} vượt quá tổng số ${totalPages} trang`, pages: [] };
      }
      pages.add(p);
    }
  }

  return { valid: true, error: null, pages: Array.from(pages).sort((a, b) => a - b) };
}

export class PdfQueueManager {
  constructor() {
    if (typeof window !== 'undefined' && window.__ds_pdfQueueManager) {
      return window.__ds_pdfQueueManager;
    }

    this.toolId = 'pdf-studio';
    this.toolTitle = 'PDF Studio';
    this.moduleId = 'pdf-studio';
    this.moduleTitle = 'PDF Studio';
    this.route = '#tool/pdf-studio';
    this.files = [];
    this.mode = 'compress';
    this.securityAction = 'lock';
    this.angle = 90;
    this.pages = '';
    this.watermarkText = '';
    this.watermarkPosition = 'center';
    this.watermarkOpacity = 0.3;
    this.pageNumbers = false;
    this.stripMetadata = true;
    this.password = '';
    this.compressionPreset = 'medium';
    this.pageRotations = {};
    this.organizeOrder = [];
    this.organizeDeleted = new Set();
    this.organizeRotations = {};
    this.selectedSplitPages = new Set();
    this.splitRangeError = null;
    this.totalPages = 0;
    this.thumbnailPage = 0;
    this.isLoadingFile = false;
    this.loadingFileName = '';
    this.isProcessing = false;
    this.progress = 0;
    this.stage = '';
    this.result = null;
    this.error = null;
    this.activeJobWatcherCleanup = null;
    this.activeUploadAbortController = null;
    this.listeners = new Set();

    const saved = loadModuleState('pdf_studio', null);
    if (saved) {
      this.mode = saved.mode === 'pdf_to_docx' ? 'compress' : (saved.mode || this.mode);
      this.securityAction = saved.securityAction || this.securityAction;
      this.angle = saved.angle || this.angle;
      this.watermarkText = saved.watermarkText || this.watermarkText;
      this.watermarkPosition = saved.watermarkPosition || this.watermarkPosition;
      this.watermarkOpacity = typeof saved.watermarkOpacity === 'number' ? saved.watermarkOpacity : this.watermarkOpacity;
      this.pageNumbers = !!saved.pageNumbers;
      this.stripMetadata = saved.stripMetadata !== false;
      this.compressionPreset = saved.compressionPreset || this.compressionPreset;
    }

    if (typeof window !== 'undefined') {
      window.__ds_pdfQueueManager = this;
    }
  }

  persist() {
    saveModuleState('pdf_studio', {
      mode: this.mode, securityAction: this.securityAction, angle: this.angle,
      watermarkText: this.watermarkText, watermarkPosition: this.watermarkPosition,
      watermarkOpacity: this.watermarkOpacity, pageNumbers: this.pageNumbers,
      stripMetadata: this.stripMetadata, compressionPreset: this.compressionPreset
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(type = 'update') {
    const listeners = Array.from(this.listeners);
    listeners.forEach((fn) => fn(this.getState(), type));
  }

  getState() {
    return {
      toolId: this.toolId, files: this.files, mode: this.mode, securityAction: this.securityAction,
      angle: this.angle, pages: this.pages, watermarkText: this.watermarkText,
      watermarkPosition: this.watermarkPosition, watermarkOpacity: this.watermarkOpacity,
      pageNumbers: this.pageNumbers, stripMetadata: this.stripMetadata, password: this.password,
      compressionPreset: this.compressionPreset, pageRotations: this.pageRotations,
      organizeOrder: this.organizeOrder, organizeDeleted: this.organizeDeleted,
      organizeRotations: this.organizeRotations,
      selectedSplitPages: this.selectedSplitPages, splitRangeError: this.splitRangeError,
      totalPages: this.totalPages, thumbnailPage: this.thumbnailPage,
      isLoadingFile: this.isLoadingFile, loadingFileName: this.loadingFileName,
      isProcessing: this.isProcessing, progress: this.progress, stage: this.stage,
      result: this.result, error: this.error
    };
  }

  setMode(mode, silent = false) {
    if (this.isProcessing) {
      showToast('Đang xử lý tác vụ, vui lòng đợi hoàn tất', 'warning');
      return;
    }
    if (this.activeJobWatcherCleanup) {
      try { this.activeJobWatcherCleanup(); } catch {}
      this.activeJobWatcherCleanup = null;
    }
    if (this.mode === mode) return;
    const prevMode = this.mode;
    this.mode = mode;
    this.thumbnailPage = 0;
    this.error = null;

    if (this.files.length > 0) {
      const isTargetImages = mode === 'images_to_pdf';
      const isPrevImages = prevMode === 'images_to_pdf';

      if (isTargetImages !== isPrevImages) {
        // Switching between image mode and PDF modes: clear files immediately
        this.clearFiles();
      } else if (!isTargetImages) {
        // Switching between PDF modes: ensure non-PDF files are cleared
        const validPdfs = this.files.filter((f) => {
          const ext = f.name ? f.name.split('.').pop()?.toLowerCase() : '';
          const mime = f.type ? f.type.toLowerCase() : '';
          return mime === 'application/pdf' || ext === 'pdf';
        });

        if (validPdfs.length !== this.files.length) {
          this.clearFiles();
        } else {
          // If switching to a single-file mode from a multi-file mode, keep only first PDF
          const isTargetMulti = mode === 'merge' || mode === 'images_to_pdf';
          if (!isTargetMulti && this.files.length > 1) {
            const surplus = this.files.slice(1);
            surplus.forEach((f) => releasePdfFileResources(f));
            this.files = [this.files[0]];
            this.notify('files-change');
          }
        }
      }
    }

    this.persist();
    if (!silent) this.notify('mode-change');
  }

  setThumbnailPage(page) {
    if (this.isProcessing) return;
    const total = this.totalPages || (this.files[0]?.pages || 1);
    const maxPage = Math.max(0, Math.ceil(total / 8) - 1);
    const valid = Math.max(0, Math.min(Number(page) || 0, maxPage));
    if (this.thumbnailPage === valid) return;
    this.thumbnailPage = valid;
    this.notify('thumbnail-page-change');
  }

  setSecurityAction(act) {
    if (this.isProcessing) return;
    if (this.securityAction === act) return;
    this.securityAction = act;
    this.persist();
    this.notify('config-change');
  }

  setCompressionPreset(preset) {
    if (this.isProcessing) return;
    if (this.compressionPreset === preset) return;
    this.compressionPreset = preset;
    this.persist();
    this.notify('config-change');
  }

  setAngle(deg) {
    if (this.isProcessing) return;
    const num = Number(deg);
    if (this.angle === num) return;
    this.angle = num;
    this.persist();
    this.notify('config-change');
  }

  setPages(p) {
    if (this.isProcessing) return;
    this.pages = p;
    const total = this.totalPages || (this.files[0]?.pages || 0);
    const validation = parseAndValidatePageRange(p, total);
    this.splitRangeError = validation.error;
    if (validation.valid && validation.pages.length > 0) {
      this.selectedSplitPages = new Set(validation.pages.map((n) => n - 1));
    } else if (!p || !p.trim()) {
      this.selectedSplitPages.clear();
      this.splitRangeError = null;
    }
    this.notify('split-selection-change');
  }

  setSplitRange(range) {
    if (this.isProcessing) return;
    this.setPages(range);
  }

  setWatermarkText(txt) {
    if (this.isProcessing) return;
    this.watermarkText = txt;
    this.persist();
  }

  setWatermarkPosition(pos) {
    if (this.isProcessing) return;
    if (['center', 'top', 'bottom'].includes(pos)) {
      this.watermarkPosition = pos;
      this.persist();
      this.notify('config-change');
    }
  }

  setWatermarkOpacity(op) {
    if (this.isProcessing) return;
    const num = Math.min(1.0, Math.max(0.1, Math.round(Number(op) * 100) / 100));
    if (!isNaN(num)) {
      this.watermarkOpacity = num;
      this.persist();
      this.notify('config-change');
    }
  }

  setPageNumbers(val) {
    if (this.isProcessing) return;
    this.pageNumbers = Boolean(val);
    this.persist();
  }

  setStripMetadata(val) {
    if (this.isProcessing) return;
    this.stripMetadata = Boolean(val);
    this.persist();
  }

  setPassword(pwd) {
    if (this.isProcessing) return;
    this.password = pwd;
  }

  setTotalPages(count) {
    if (this.isProcessing) return;
    const num = Number(count) || 0;
    if (this.totalPages === num) return;
    this.totalPages = num;
    if (this.files[0]) this.files[0].pages = this.totalPages;
    if (this.organizeOrder.length !== this.totalPages) {
      this.initOrganizePages(this.totalPages);
    }
    if (this.pages) {
      const validation = parseAndValidatePageRange(this.pages, this.totalPages);
      this.splitRangeError = validation.error;
    }
    this.notify('doc-info');
  }

  initOrganizePages(total = this.totalPages || this.files[0]?.pages || 0) {
    const count = Number(total) || 0;
    this.organizeOrder = Array.from({ length: count }, (_, i) => i);
    this.organizeDeleted = new Set();
    this.organizeRotations = {};
  }

  reorderOrganizePages(fromIndex, toIndex) {
    if (this.isProcessing) return;
    const from = Number(fromIndex);
    const to = Number(toIndex);
    if (isNaN(from) || isNaN(to)) return;
    if (from === to || from < 0 || to < 0 || from >= this.organizeOrder.length || to >= this.organizeOrder.length) return;
    const [moved] = this.organizeOrder.splice(from, 1);
    this.organizeOrder.splice(to, 0, moved);
    this.notify('organize-change');
  }

  toggleDeleteOrganizePage(pageIdx) {
    if (this.isProcessing) return;
    const idx = Number(pageIdx);
    if (this.organizeDeleted.has(idx)) {
      this.organizeDeleted.delete(idx);
    } else {
      const remainingCount = this.organizeOrder.length - this.organizeDeleted.size;
      if (remainingCount <= 1) {
        showToast('Cần giữ lại ít nhất 1 trang trong tài liệu', 'warning');
        return;
      }
      this.organizeDeleted.add(idx);
    }
    this.notify('organize-change');
  }

  rotateOrganizePage(pageIdx, deg = 90) {
    if (this.isProcessing) return;
    const idx = Number(pageIdx);
    const current = this.organizeRotations[idx] || 0;
    const norm = (((current + deg) % 360) + 360) % 360;
    if (norm === 0) {
      delete this.organizeRotations[idx];
    } else {
      this.organizeRotations[idx] = norm;
    }
    this.notify('organize-change');
  }

  resetOrganizePages() {
    if (this.isProcessing) return;
    const total = this.totalPages || this.files[0]?.pages || this.organizeOrder.length;
    this.initOrganizePages(total);
    this.notify('organize-change');
    showToast('Đã khôi phục thứ tự trang gốc', 'info');
  }

  reverseOrganizePages() {
    if (this.isProcessing) return;
    this.organizeOrder.reverse();
    this.notify('organize-change');
    showToast('Đã đảo ngược thứ tự các trang', 'info');
  }

  setRotation(pageIndex, deg = 90) {
    if (this.isProcessing) return;
    this.rotatePage(pageIndex, deg);
  }

  rotatePage(pageIndex, deg = 90) {
    if (this.isProcessing) return;
    const idx = Number(pageIndex);
    const cur = (this.pageRotations[idx] || 0) + deg;
    const norm = ((cur % 360) + 360) % 360;
    if (norm === 0) {
      delete this.pageRotations[idx];
    } else {
      this.pageRotations[idx] = norm;
    }
    this.notify('rotation-change');
  }

  rotateAll(deg = 90) {
    if (this.isProcessing) return;
    const total = this.totalPages || (this.files[0]?.pages || 1);
    for (let i = 0; i < total; i++) {
      const cur = (this.pageRotations[i] || 0) + deg;
      const norm = ((cur % 360) + 360) % 360;
      if (norm === 0) delete this.pageRotations[i];
      else this.pageRotations[i] = norm;
    }
    this.notify('rotation-change');
  }

  resetRotations() {
    if (this.isProcessing) return;
    this.pageRotations = {};
    this.notify('rotation-change');
  }

  toggleSplitPage(pageIndex) {
    if (this.isProcessing) return;
    const idx = Number(pageIndex);
    this.splitRangeError = null;
    if (this.selectedSplitPages.has(idx)) {
      this.selectedSplitPages.delete(idx);
    } else {
      this.selectedSplitPages.add(idx);
    }
    this.syncSplitPagesInput();
    this.notify('split-selection-change');
  }

  selectAllSplitPages() {
    if (this.isProcessing) return;
    this.splitRangeError = null;
    const total = this.totalPages || (this.files[0]?.pages || 1);
    for (let i = 0; i < total; i++) this.selectedSplitPages.add(i);
    this.syncSplitPagesInput();
    this.notify('split-selection-change');
  }

  deselectAllSplitPages() {
    if (this.isProcessing) return;
    this.splitRangeError = null;
    this.selectedSplitPages.clear();
    this.pages = '';
    this.notify('split-selection-change');
  }

  selectOddSplitPages() {
    if (this.isProcessing) return;
    this.splitRangeError = null;
    this.selectedSplitPages.clear();
    const total = this.totalPages || (this.files[0]?.pages || 1);
    for (let i = 0; i < total; i += 2) this.selectedSplitPages.add(i);
    this.syncSplitPagesInput();
    this.notify('split-selection-change');
  }

  selectEvenSplitPages() {
    if (this.isProcessing) return;
    this.splitRangeError = null;
    this.selectedSplitPages.clear();
    const total = this.totalPages || (this.files[0]?.pages || 1);
    for (let i = 1; i < total; i += 2) this.selectedSplitPages.add(i);
    this.syncSplitPagesInput();
    this.notify('split-selection-change');
  }

  syncSplitPagesInput() {
    const sorted = Array.from(this.selectedSplitPages).sort((a, b) => a - b);
    if (sorted.length === 0) {
      this.pages = '';
      return;
    }
    const parts = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
        start = sorted[i];
        prev = sorted[i];
      }
    }
    parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
    this.pages = parts.join(', ');
  }

  moveFileUp(index) {
    if (this.isProcessing) return;
    const idx = Number(index);
    if (idx <= 0 || idx >= this.files.length) return;
    const temp = this.files[idx];
    this.files[idx] = this.files[idx - 1];
    this.files[idx - 1] = temp;
    this.notify('files-change');
  }

  moveFileDown(index) {
    if (this.isProcessing) return;
    const idx = Number(index);
    if (idx < 0 || idx >= this.files.length - 1) return;
    const temp = this.files[idx];
    this.files[idx] = this.files[idx + 1];
    this.files[idx + 1] = temp;
    this.notify('files-change');
  }

  reorderFiles(fromIndex, toIndex) {
    if (this.isProcessing) return;
    const from = Number(fromIndex);
    const to = Number(toIndex);
    if (isNaN(from) || isNaN(to)) return;
    if (from === to || from < 0 || to < 0 || from >= this.files.length || to >= this.files.length) return;
    const [movedItem] = this.files.splice(from, 1);
    this.files.splice(to, 0, movedItem);
    this.notify('files-change');
  }

  async addFiles(fileList) {
    if (this.isProcessing) return;
    if (!fileList || fileList.length === 0) return;
    const { validFiles, rejectedCount, isImages, hasPdfRejectedInImageMode } = filterFilesForMode(fileList, this.mode);
    if (rejectedCount > 0) {
      if (validFiles.length === 0) {
        if (isImages && hasPdfRejectedInImageMode) {
          showToast('Chế độ Ảnh sang PDF chỉ chấp nhận tệp hình ảnh. Không nhận tệp PDF.', 'warning');
        } else {
          showToast(
            isImages
              ? 'Chỉ chấp nhận tệp hình ảnh (PNG, JPG, WEBP, AVIF...)'
              : 'Chỉ chấp nhận tệp định dạng PDF (.pdf)',
            'warning'
          );
        }
        return;
      }
      showToast(
        isImages && hasPdfRejectedInImageMode
          ? `Đã bỏ qua ${rejectedCount} tệp không hợp lệ (tệp PDF không được hỗ trợ ở chế độ này)`
          : `Đã bỏ qua ${rejectedCount} tệp không đúng định dạng ${isImages ? 'ảnh' : 'PDF'}`,
        'warning'
      );
    }
    this.isLoadingFile = true;
    this.loadingFileName = validFiles[0]?.name || 'Tệp tin';
    this.notify('file-loading');

    try {
      const isMulti = this.mode === 'merge' || this.mode === 'images_to_pdf';
      if (!isMulti && validFiles.length > 1) {
        showToast('Chế độ đơn tệp: Đã tự động chọn tệp đầu tiên', 'info');
      }

      if (!isMulti && this.files.length > 0) {
        this.files.forEach((f) => releasePdfFileResources(f));
        this.files = [];
      }

      const chosenFiles = isMulti ? validFiles : validFiles.slice(0, 1);
      const newItems = chosenFiles.map((f) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: f.name,
        size: f.size,
        type: f.type || (isImages ? 'image/png' : 'application/pdf'),
        pages: 0,
        rawFile: f,
        localUrl: URL.createObjectURL(f)
      }));

      this.files = isMulti ? [...this.files, ...newItems] : newItems;
      this.result = null;
      this.error = null;
      this.pageRotations = {};
      this.selectedSplitPages.clear();
      this.splitRangeError = null;
      this.pages = '';
      this.thumbnailPage = 0;

      const first = this.files[0];
      if (first && (first.type === 'application/pdf' || first.name.toLowerCase().endsWith('.pdf'))) {
        try {
          const { ensurePdfJsLoaded } = await import('../../../../utilities/pdfJsHelper.js');
          const pdfjs = await ensurePdfJsLoaded();
          const targetBlob = first.rawFile || first;
          const arrayBuffer = await targetBlob.arrayBuffer();
          const doc = await pdfjs.getDocument({
            data: arrayBuffer,
            cMapUrl: '/pdfjs/web/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/web/standard_fonts/'
          }).promise;
          first.pages = doc.numPages;
          first.cachedDoc = doc;
          this.totalPages = doc.numPages;
        } catch (err) {
          console.warn('PDF inspection fallback:', err);
          first.pages = 1;
          this.totalPages = 1;
        }
      } else {
        this.totalPages = this.files.length;
      }
    } finally {
      this.isLoadingFile = false;
      this.loadingFileName = '';
      this.notify('files-change');
    }
  }

  removeFile(id) {
    if (this.isProcessing) return;
    const target = this.files.find((f) => f.id === id);
    releasePdfFileResources(target);
    this.files = this.files.filter((f) => f.id !== id);
    this.notify('files-change');
  }

  clearFiles() {
    if (this.isProcessing) return;
    if (this.activeUploadAbortController) {
      try { this.activeUploadAbortController.abort(); } catch {}
      this.activeUploadAbortController = null;
    }
    if (this.activeJobWatcherCleanup) {
      try { this.activeJobWatcherCleanup(); } catch {}
      this.activeJobWatcherCleanup = null;
    }
    this.files.forEach((f) => releasePdfFileResources(f));
    this.files = [];
    this.isLoadingFile = false;
    this.loadingFileName = '';
    this.result = null;
    this.error = null;
    this.pageRotations = {};
    this.organizeOrder = [];
    this.organizeDeleted.clear();
    this.organizeRotations = {};
    this.selectedSplitPages.clear();
    this.splitRangeError = null;
    this.pages = '';
    this.totalPages = 0;
    this.thumbnailPage = 0;
    this.notify('files-change');
  }

  async addFileFromHistory(item) {
    if (this.isProcessing) return false;
    if (!item) return false;
    const isPdf = (item.fileName || '').toLowerCase().endsWith('.pdf') || (item.mimeType || '').includes('pdf');
    if (this.mode === 'images_to_pdf' && isPdf) {
      showToast('Tệp này là PDF, không thể nạp vào chế độ Ảnh sang PDF', 'warning');
      return false;
    }
    if (this.mode !== 'images_to_pdf' && !isPdf) {
      showToast('Tệp này là ảnh, chế độ này yêu cầu tệp PDF', 'warning');
      return false;
    }
    try {
      const url = item.downloadUrl || `/api/v1/files/download/${item.resultFileId || item.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải tệp từ lịch sử');
      const blob = await res.blob();
      const file = new File([blob], item.fileName || 'document.pdf', { type: item.mimeType || 'application/pdf' });
      const beforeCount = this.files.length;
      await this.addFiles([file]);
      return this.files.length > beforeCount;
    } catch (err) {
      showToast(err.message || 'Lỗi nạp tệp', 'error');
      return false;
    }
  }

  async runProcess() {
    if (this.mode === 'view') return;
    if (this.files.length === 0) return showToast('Vui lòng chọn tệp để xử lý', 'warning');

    if (this.mode === 'split') {
      if (this.splitRangeError) {
        showToast(this.splitRangeError, 'error');
        return;
      }
      if (this.selectedSplitPages.size === 0 && !this.pages) {
        showToast('Vui lòng chọn hoặc nhập dải trang cần tách', 'warning');
        return;
      }
    }

    if (this.mode === 'merge' && this.files.length < 2) {
      showToast('Vui lòng chọn ít nhất 2 tệp để ghép', 'warning');
      return;
    }

    if (this.mode === 'images_to_pdf' && this.files.length < 1) {
      showToast('Vui lòng chọn ít nhất 1 ảnh để tạo PDF', 'warning');
      return;
    }

    if (this.mode === 'organize') {
      const activePages = this.organizeOrder.filter((p) => !this.organizeDeleted.has(p));
      if (activePages.length === 0) {
        showToast('Cần giữ lại ít nhất 1 trang trong tài liệu', 'warning');
        return;
      }
    }

    if (this.mode === 'security' && !this.password) {
      showToast('Vui lòng nhập mật khẩu', 'warning');
      return;
    }

    if (this.mode === 'watermark' && !this.watermarkText?.trim() && !this.pageNumbers) {
      showToast('Vui lòng nhập nội dung watermark hoặc chọn đánh số trang', 'warning');
      return;
    }

    const apiBase = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    const startTime = Date.now();
    this.isProcessing = true;
    this.progress = 5;
    this.stage = 'Đang tải tệp lên...';
    this.error = null;
    this.result = null;
    this.notify('process-start');
    taskCoordinator.syncTasks(true);

    this.activeUploadAbortController = new AbortController();
    const abortSignal = this.activeUploadAbortController.signal;

    try {
      const fileIds = await uploadPdfFiles(this.files, (idx, total, name, filePct = 0) => {
        const fileWeight = 20 / Math.max(1, total);
        const overallUpload = Math.round((idx * fileWeight) + ((filePct / 100) * fileWeight));
        this.progress = Math.min(25, Math.max(this.progress, 5 + overallUpload));
        this.stage = total > 1
          ? `Đang upload [${idx + 1}/${total}]: ${name} (${filePct}%)`
          : `Đang upload tệp (${filePct}%)`;
        this.notify('upload-progress');
        taskCoordinator.syncTasks(true);
      }, abortSignal);

      if (abortSignal.aborted) {
        throw new DOMException('Tác vụ đã bị hủy', 'AbortError');
      }

      this.progress = 25;
      this.stage = 'Đang khởi tạo...';
      this.notify('upload-progress');
      taskCoordinator.syncTasks(true);

      const operation = this.mode === 'security' ? this.securityAction : this.mode;
      const options = {
        stripMetadata: this.stripMetadata,
        angle: this.angle,
        rotations: this.mode === 'rotate' && Object.keys(this.pageRotations).length > 0
          ? this.pageRotations
          : this.mode === 'organize' && Object.keys(this.organizeRotations).length > 0
          ? this.organizeRotations
          : undefined,
        order: this.mode === 'organize'
          ? this.organizeOrder.filter((p) => !this.organizeDeleted.has(p))
          : undefined,
        compressionLevel: this.mode === 'compress' ? this.compressionPreset : undefined,
        pages: this.pages || undefined,
        watermarkText: this.watermarkText || undefined,
        watermarkPosition: this.mode === 'watermark' ? (this.watermarkPosition || 'center') : undefined,
        watermarkOpacity: this.mode === 'watermark' ? (typeof this.watermarkOpacity === 'number' ? this.watermarkOpacity : 0.3) : undefined,
        pageNumbers: this.pageNumbers,
        password: this.password || undefined
      };

      const { eventsUrl, pollUrl } = await dispatchPdfJob(fileIds, operation, options, abortSignal);

      return new Promise((resolve, reject) => {
        this.activeJobWatcherCleanup = watchJobProgress({
          apiBase, eventsUrl, pollUrl,
          onProgress: (pct, stageName) => {
            this.progress = Math.max(this.progress, pct);
            if (stageName) this.stage = stageName;
            this.notify('progress');
            taskCoordinator.syncTasks(true);
          },
          onCompleted: (data) => {
            this.activeJobWatcherCleanup = null;
            this.activeUploadAbortController = null;
            const dur = ((Date.now() - startTime) / 1000).toFixed(2);
            this.progress = 100;
            this.stage = 'Hoàn tất';
            this.isProcessing = false;
            this.result = buildPdfResult(data, this.files[0], this.mode, dur, apiBase);
            showToast('Hoàn tất xử lý', 'success');
            this.notify('completed');
            taskCoordinator.syncTasks(true);
            resolve(this.result);
          },
          onFailed: (errMessage) => {
            this.activeJobWatcherCleanup = null;
            this.activeUploadAbortController = null;
            this.isProcessing = false;
            this.error = errMessage;
            showToast(errMessage, 'error');
            this.notify('failed');
            taskCoordinator.syncTasks(true);
            reject(new Error(errMessage));
          }
        });
      });
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || abortSignal?.aborted;
      this.activeJobWatcherCleanup = null;
      this.activeUploadAbortController = null;
      this.isProcessing = false;
      this.error = isAbort ? 'Tác vụ đã bị hủy' : (err.message || 'Lỗi xử lý PDF');
      if (isAbort) {
        showToast('Đã hủy tác vụ', 'info');
      } else {
        showToast(this.error, 'error');
      }
      this.notify('failed');
      taskCoordinator.syncTasks(true);
    }
  }

  resetResult() {
    if (this.isProcessing) return;
    if (this.activeJobWatcherCleanup) {
      try { this.activeJobWatcherCleanup(); } catch {}
      this.activeJobWatcherCleanup = null;
    }
    this.result = null;
    this.error = null;
    this.stage = '';
    this.progress = 0;
    this.notify('result-reset');
  }

  getModeTitle(modeId) {
    const titles = {
      merge: 'Ghép PDF', split: 'Tách trang', rotate: 'Xoay trang',
      organize: 'Sắp xếp trang', compress: 'Nén PDF', extract_images: 'Trích ảnh',
      images_to_pdf: 'Ảnh sang PDF', pdf_to_docx: 'PDF sang Word',
      view: 'Xem PDF', watermark: 'Watermark', security: 'Bảo mật'
    };
    return titles[modeId] || modeId;
  }

  async chainResultToMode(targetMode) {
    if (this.isProcessing) return;
    if (!this.result?.downloadUrl) return;
    if (targetMode === 'images_to_pdf') {
      showToast('Không thể chuyển tiếp tệp PDF vào chế độ Ảnh sang PDF', 'warning');
      return;
    }
    try {
      showToast('Đang chuyển tiếp tệp...', 'info');
      const res = await fetch(this.result.downloadUrl);
      if (!res.ok) throw new Error('Không thể tải tệp kết quả');
      const blob = await res.blob();
      const fileName = this.result.fileName || 'document.pdf';
      const file = new File([blob], fileName, { type: 'application/pdf' });

      this.resetResult();
      this.setMode(targetMode, true);
      await this.addFiles([file]);
      this.notify('mode-change');
      showToast(`Đã chuyển tệp sang ${this.getModeTitle(targetMode)}`, 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi chuyển tiếp tệp', 'error');
    }
  }

  getActiveTasks() {
    if (!this.isProcessing) return [];
    const modeLabel = this.getModeTitle(this.mode);
    const title = this.files.length > 0
      ? `${modeLabel}: ${this.files[0].name}${this.files.length > 1 ? ` (+${this.files.length - 1} tệp)` : ''}`
      : `${modeLabel}`;
    return [
      {
        id: 'pdf-studio-job',
        moduleId: this.moduleId,
        moduleTitle: this.moduleTitle,
        title,
        status: 'running',
        progress: this.progress,
        stage: this.stage || 'Đang xử lý...',
        route: this.route,
        cancel: () => this.cancelTask('pdf-studio-job')
      }
    ];
  }

  cancelTask(taskId) {
    if (taskId === 'pdf-studio-job') {
      if (this.activeUploadAbortController) {
        try { this.activeUploadAbortController.abort(); } catch {}
        this.activeUploadAbortController = null;
      }
      if (this.activeJobWatcherCleanup) {
        try { this.activeJobWatcherCleanup(); } catch {}
        this.activeJobWatcherCleanup = null;
      }
      this.isProcessing = false;
      this.notify('failed');
      taskCoordinator.syncTasks(true);
    }
  }
}

export const pdfQueueManager = new PdfQueueManager();
taskCoordinator.registerManager(pdfQueueManager);
