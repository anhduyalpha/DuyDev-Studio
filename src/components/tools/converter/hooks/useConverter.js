/**
 * Converter State Manager (File Converter Pro)
 * Multi-file batch queue orchestration, format mapping, and persistence.
 */

import { showToast } from '../../../../utilities/toast.js';
import {
  SUPPORTED_CATEGORIES,
  CATEGORY_FORMATS,
  sniffFileExtension,
  getFormatCategory,
  getSmartDefaultTarget,
  getCompatibleOutputs
} from '../utilities/converterFormatRegistry.js';
import { loadModuleState, saveModuleState } from '../../../../utilities/moduleState.js';
import { storage } from '../../../../utilities/storage.js';
import { runConcurrentQueue, processSingleItem, createZipBundleFromCompleted, startBackgroundUpload } from './useConverterBatch.js';
import { batchPresignFiles } from '../../../../utilities/resumableUploader.js';
import { taskCoordinator } from '../../../../utilities/taskCoordinator.js';

/**
 * @typedef {Object} ConverterDetectedMeta
 * @property {string} name
 * @property {number} size
 * @property {string} extension
 * @property {string} mimeType
 * @property {string} category
 * @property {string} categoryLabel
 */

/**
 * @typedef {Object} ConverterQueueItem
 * @property {string} id
 * @property {File|null} file
 * @property {string|null} fileId
 * @property {ConverterDetectedMeta} detectedMeta
 * @property {string} targetFormat
 * @property {'ready'|'idle'|'uploading'|'converting'|'completed'|'error'|'retry'} status
 * @property {number} progress
 * @property {string} stage
 * @property {Object|null} result
 * @property {string|null} error
 * @property {EventSource|null} eventSource
 */

/**
 * @typedef {Object} ConverterOptions
 * @property {number} quality
 * @property {string|number} width
 * @property {string|number} height
 * @property {string} resolution
 * @property {string} fps
 * @property {string} bitrate
 * @property {boolean} [ocr]
 */

export class ConverterManager {
  constructor() {
    this.moduleId = 'universal-converter';
    this.moduleTitle = 'File Converter';
    this.route = '#tool/universal-converter';
    /** @type {ConverterQueueItem[]} */
    this.items = [];
    this.selectedCategory = 'image';
    this.targetFormat = 'webp';
    this.options = {
      quality: 80,
      width: '',
      height: '',
      resolution: 'original',
      fps: 'original',
      bitrate: '320k'
    };
    this.renamePattern = {
      prefix: '',
      suffix: '',
      numbering: false
    };
    this.isConverting = false;
    /** @type {string|null} */
    this.error = null;
    /** @type {Set<(manager: ConverterManager, type: string) => void>} */
    this.listeners = new Set();

    const saved = loadModuleState('converter_batch', null);
    if (saved) {
      if (saved.targetFormat) {
        this.targetFormat = saved.targetFormat;
      }
      if (saved.selectedCategory) {
        this.selectedCategory = saved.selectedCategory;
      }
      if (saved.options) {
        Object.assign(this.options, saved.options);
      }
      if (saved.renamePattern) {
        Object.assign(this.renamePattern, saved.renamePattern);
      }
      if (Array.isArray(saved.items)) {
        this.items = saved.items.map((it) => {
          const isStale = !it.fileId;
          return {
            ...it,
            file: null,
            eventSource: null,
            status: isStale ? 'stale' : it.status,
            uploadStatus: isStale ? 'expired' : (it.fileId ? 'uploaded' : 'idle'),
            error: isStale ? 'Tệp cần được nạp lại (phiên cũ)' : it.error
          };
        });
      }
    }
  }

  persist() {
    saveModuleState('converter_batch', {
      targetFormat: this.targetFormat,
      selectedCategory: this.selectedCategory,
      options: this.options,
      renamePattern: this.renamePattern,
      items: this.items.map((it) => ({
        id: it.id,
        fileId: it.fileId,
        detectedMeta: it.detectedMeta,
        targetFormat: it.targetFormat,
        status: it.status,
        uploadStatus: it.uploadStatus,
        progress: it.progress,
        result: it.result,
        error: it.error
      }))
    });
  }

  /**
   * Subscribes a listener callback to state change notifications.
   * @param {(manager: ConverterManager, type: string) => void} fn
   * @returns {() => void} Unsubscribe teardown function
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Broadcasts an event notification to all registered listeners.
   * @param {string} [type='update']
   */
  notify(type = 'update') {
    const activeListeners = Array.from(this.listeners);
    activeListeners.forEach((fn) => {
      fn(this, type);
    });
  }

  /**
   * Sniffs the file format, extension, mime type, and classification category.
   * @param {File} file
   * @returns {ConverterDetectedMeta}
   */
  sniffFormat(file) {
    const ext = sniffFileExtension(file.name, file.type);
    const category = getFormatCategory(ext);
    const catObj = SUPPORTED_CATEGORIES.find((c) => c.id === category);
    const categoryLabel = catObj?.label || 'Tài liệu Văn bản';

    return {
      name: file.name,
      size: file.size,
      extension: ext ? ext.toUpperCase() : 'BIN',
      mimeType: file.type || '',
      category,
      categoryLabel
    };
  }

  /**
   * Retrieves the default target format extension for a category.
   * @param {string} cat
   * @returns {string}
   */
  getDefaultFormatForCategory(cat) {
    const list = CATEGORY_FORMATS[cat] || CATEGORY_FORMATS.image;
    return list[0];
  }

  /**
   * Appends an array or FileList of files to the batch queue.
   * @param {FileList|File[]} fileList
   */
  addFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const newItems = Array.from(fileList).map((file) => {
      const meta = this.sniffFormat(file);
      const defaultFmt = getSmartDefaultTarget(meta.extension);

      return {
        id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        fileId: null,
        detectedMeta: meta,
        targetFormat: defaultFmt,
        status: 'ready',
        uploadStatus: 'idle',
        uploadProgress: 0,
        uploadError: null,
        uploadPromise: null,
        abortController: null,
        progress: 0,
        stage: 'Sẵn sàng',
        result: null,
        error: null,
        eventSource: null
      };
    });

    this.items.push(...newItems);

    const firstItem = newItems[0];
    if (firstItem?.detectedMeta) {
      this.selectedCategory = firstItem.detectedMeta.category;
      this.targetFormat = firstItem.targetFormat;
    }

    // Batch presign multiple large files (>50MB) in 1 roundtrip
    const largeFiles = newItems.filter(it => it.file && it.file.size > 50 * 1024 * 1024);
    if (largeFiles.length > 1) {
      batchPresignFiles(largeFiles.map(it => it.file), { purpose: 'universal-converter' })
        .then((batchData) => {
          if (Array.isArray(batchData)) {
            const map = new Map(batchData.map(r => [r.fileName, r]));
            largeFiles.forEach(it => {
              if (it.file && map.has(it.file.name)) {
                it.presignData = map.get(it.file.name);
              }
            });
          }
        })
        .catch((err) => {
          console.warn('[Converter] Batch presign fallback:', err);
        });
    }

    // Trigger background eager upload for newly added files
    newItems.forEach((it) => {
      startBackgroundUpload(this, it);
    });

    this.persist();
    this.notify('queue-changed');
    showToast(`Đã thêm ${newItems.length} tệp tin vào hàng đợi`, 'info');
  }

  /**
   * Returns the list of compatible output formats for a queue item.
   * @param {ConverterQueueItem} item
   * @returns {Array<{id: string, name: string, isRecommended: boolean, category: string}>}
   */
  getCompatibleFormatsForItem(item) {
    const ext = item?.detectedMeta?.extension || '';
    return getCompatibleOutputs(ext);
  }

  removeItem(id) {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx !== -1) {
      const it = this.items[idx];
      if (it.abortController) {
        try { it.abortController.abort(); } catch (_) {}
      }
      if (it.eventSource) {
        it.eventSource.close();
      }
      this.items.splice(idx, 1);
      this.persist();
      this.notify('queue-changed');
    }
  }

  clearQueue() {
    this.items.forEach((it) => {
      if (it.abortController) {
        try { it.abortController.abort(); } catch (_) {}
      }
      if (it.eventSource) {
        it.eventSource.close();
      }
    });
    this.items = [];
    this.error = null;
    this.persist();
    this.notify('queue-changed');
    showToast('Đã làm mới hàng đợi', 'info');
  }

  setFormatForExtension(extension, targetFormat) {
    const ext = (extension || '').toLowerCase().trim();
    const cleanFmt = (targetFormat || '').toLowerCase().trim();
    if (!ext || !cleanFmt) return;

    this.items.forEach((it) => {
      const itemExt = (it.detectedMeta?.extension || '').toLowerCase().trim();
      if (itemExt === ext && it.status !== 'converting' && it.status !== 'completed') {
        it.targetFormat = cleanFmt;
      }
    });
    this.targetFormat = cleanFmt;
    const cat = getFormatCategory(cleanFmt);
    if (cat) {
      this.selectedCategory = cat;
    }
    this.persist();
    this.notify('format-changed');
  }

  setCategory(cat) {
    this.selectedCategory = cat;
    const available = CATEGORY_FORMATS[cat] || CATEGORY_FORMATS.image;
    this.targetFormat = available[0];
    this.applyBatchFormatToCategory(cat, this.targetFormat);
    this.persist();
    this.notify('category-changed');
  }

  setTargetFormat(fmt) {
    this.targetFormat = fmt;
    this.applyBatchFormatToCategory(this.selectedCategory, fmt);
    this.persist();
    this.notify('format-changed');
  }

  applyBatchFormatToCategory(category, format) {
    const cleanFmt = (format || '').toLowerCase().trim();
    if (!cleanFmt) return;

    this.items.forEach((it) => {
      if (it.detectedMeta?.category === category && (it.status === 'ready' || it.status === 'idle')) {
        const itemExt = (it.detectedMeta?.extension || '').toLowerCase().trim();
        // Prevent self-conversion (e.g., pdf -> pdf or png -> png)
        if (cleanFmt === itemExt) return;
        const compatible = getCompatibleOutputs(itemExt);
        if (compatible.some((f) => f.id.toLowerCase() === cleanFmt)) {
          it.targetFormat = cleanFmt;
        }
      }
    });
  }

  setItemFormat(id, format) {
    const it = this.items.find((item) => item.id === id);
    if (it) {
      it.targetFormat = format;
      if (this.items.length === 1) {
        this.targetFormat = format;
      }
      this.persist();
      this.notify('item-updated');
    }
  }

  setRenamePattern(key, val) {
    this.renamePattern[key] = val;
    this.persist();
    this.notify('pattern-changed');
  }

  setOption(key, value, shouldNotify = false) {
    this.options[key] = value;
    this.persist();
    if (shouldNotify) {
      this.notify('option-changed');
    }
  }

  async startConversion() {
    if (this.isConverting) return;

    // Guard: Check if any item is currently uploading or queued to upload
    const uploadingItems = this.items.filter((it) => it.uploadStatus === 'uploading' || (it.uploadStatus === 'idle' && !it.fileId && it.file));
    if (uploadingItems.length > 0) {
      return showToast('Đang tải tệp lên máy chủ, vui lòng đợi giây lát...', 'info');
    }

    const pending = this.items.filter(
      (it) => (it.status === 'ready' || it.status === 'idle' || it.status === 'retry') && (it.fileId || it.file)
    );
    if (pending.length === 0) {
      const hasStale = this.items.some((it) => it.status === 'stale' || (!it.fileId && !it.file));
      if (hasStale) {
        return showToast('Các tệp cũ đã hết hạn phiên làm việc. Vui lòng nạp lại tệp.', 'warning');
      }
      return showToast('Không có tệp nào trong hàng đợi cần chuyển đổi', 'warning');
    }

    await runConcurrentQueue(this, 3);

    this.items
      .filter((it) => it.status === 'completed' && it.result)
      .forEach((it) => {
        storage.recordCompletedJob({
          id: it.result.fileId,
          resultFileId: it.result.fileId,
          toolId: 'universal-converter',
          toolTitle: 'File Converter',
          targetFormat: it.targetFormat || (it.result.fileName || '').split('.').pop()?.toLowerCase(),
          fileName: it.result.fileName,
          originalSize: it.result.originalSize,
          resultSize: it.result.resultSize,
          downloadUrl: it.result.downloadUrl
        });
      });

    this.notify('conversion-finished');
  }

  async retryItem(id) {
    const it = this.items.find((item) => item.id === id);
    if (!it) return;

    it.status = 'ready';
    it.error = null;
    it.progress = 0;
    this.notify('item-updated');
    await processSingleItem(this, it);

    if (it.status === 'completed' && it.result) {
      storage.recordCompletedJob({
        id: it.result.fileId,
        resultFileId: it.result.fileId,
        toolId: 'universal-converter',
        toolTitle: 'File Converter',
        targetFormat: it.targetFormat || (it.result.fileName || '').split('.').pop()?.toLowerCase(),
        fileName: it.result.fileName,
        originalSize: it.result.originalSize,
        resultSize: it.result.resultSize,
        downloadUrl: it.result.downloadUrl
      });
      this.notify('conversion-finished');
    }
  }

  async downloadAllZip() {
    await createZipBundleFromCompleted(this);
  }

  getActiveTasks() {
    if (!this.isConverting) return [];
    const active = this.items.filter(
      (it) => it.status === 'uploading' || it.status === 'converting'
    );
    if (!active.length) return [];
    return active.map((it) => ({
      id: `conv-task-${it.id}`,
      moduleId: this.moduleId,
      moduleTitle: this.moduleTitle,
      title: `${it.file?.name || it.detectedMeta?.name || 'Tệp'} -> ${(it.targetFormat || '').toUpperCase()}`,
      status: 'running',
      progress: it.progress || 0,
      stage: it.stage || (it.status === 'uploading' ? 'Đang tải lên...' : 'Đang chuyển đổi...'),
      route: this.route
    }));
  }
}

export const converterManager = new ConverterManager();
taskCoordinator.registerManager(converterManager);
