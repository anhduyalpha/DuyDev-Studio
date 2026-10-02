/**
 * useConverterDom
 * DOM event wiring, action dispatch, and reactive UI observer for File Converter Pro.
 */

import { renderConverterDropzone } from '../components/ConverterDropzone.js';
import { renderFormatSelector } from '../components/FormatSelector.js';
import { renderConverterQueueList } from '../components/ConverterQueueList.js';
import { renderConverterResult } from '../components/ConverterResult.js';
import { bindConverterHistory, updateConverterHistoryDom } from '../components/ConverterHistoryList.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';

/**
 * Safely refreshes Lucide icons if available in current runtime environment.
 * @param {HTMLElement} root - DOM node root to search for icons
 */
function refreshLucide(root) {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root });
  }
}

/**
 * Synchronizes category tab styles and reveals the active category's format grid and options.
 * @param {string} activeCategory - The selected category ('image' | 'video' | 'audio' | 'document')
 */
export function syncCategoryUI(activeCategory) {
  document.querySelectorAll('.btn-converter-cat').forEach((buttonElement) => {
    const isCategoryActive = buttonElement.dataset.category === activeCategory;
    buttonElement.className = `btn-converter-cat px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
      isCategoryActive
        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs active-cat'
        : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
    }`;
  });

  document.querySelectorAll('[id^="formatGrid_"]').forEach((gridElement) => {
    gridElement.classList.toggle('hidden', gridElement.id !== `formatGrid_${activeCategory}`);
  });

  document.querySelectorAll('.converter-opt-section').forEach((sectionElement) => {
    sectionElement.classList.toggle('hidden', sectionElement.id !== `optionsSection_${activeCategory}`);
  });
}

/**
 * Synchronizes format pill styles and updates the target format badge.
 * @param {string} activeCategory - The selected category
 * @param {string} targetFormat - The selected target format extension (e.g. 'webp')
 */
export function syncFormatUI(activeCategory, targetFormat) {
  document.querySelectorAll('.btn-format-pill').forEach((pillElement) => {
    const isTargetActive =
      pillElement.dataset.category === activeCategory &&
      (pillElement.dataset.format || '').toLowerCase() === (targetFormat || '').toLowerCase();
    const isRecommended = pillElement.dataset.recommended === 'true';

    let pillClass = 'border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] bg-zinc-50/50 dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium';
    if (isTargetActive) {
      pillClass = 'ring-2 ring-indigo-500 bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm shadow-indigo-600/30';
    } else if (isRecommended) {
      pillClass = 'border border-indigo-500/30 dark:border-indigo-400/30 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500/60 font-semibold';
    }

    pillElement.className = `btn-format-pill py-3 px-4 rounded-xl transition text-center flex items-center justify-center relative group active:scale-95 cursor-pointer ${pillClass}`;
  });

  const badgeElement = document.getElementById('badgeCurrentTargetFormat');
  if (badgeElement) {
    badgeElement.textContent = (targetFormat || '').toUpperCase();
  }
}

/**
 * Updates the state, styling, and label of the batch conversion button.
 * @param {import('./useConverter.js').ConverterManager} manager - The converter state manager
 */
export function updateBatchButton(manager) {
  const startButton = document.getElementById('btnStartConversion');
  if (!startButton) return;

  const isBusy = manager.isConverting;
  const uploadingItems = manager.items.filter(
    (item) => item.uploadStatus === 'uploading' || item.status === 'uploading'
  );
  const isUploading = uploadingItems.length > 0;

  const validItems = manager.items.filter(
    (item) => (item.status === 'ready' || item.status === 'idle' || item.status === 'retry') && (item.fileId || item.file)
  );
  const pendingCount = validItems.length;

  startButton.disabled = pendingCount === 0 || isBusy || isUploading;
  startButton.className = `w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-200 ${
    startButton.disabled
      ? 'bg-zinc-100 dark:bg-white/[0.05] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-white/[0.06] cursor-not-allowed'
      : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 active:scale-[0.98] cursor-pointer'
  }`;

  const textElement = document.getElementById('btnStartConversionText');
  if (textElement) {
    if (isBusy) {
      textElement.textContent = 'Đang chuyển đổi theo lô...';
    } else if (isUploading) {
      const avgProg = Math.round(
        uploadingItems.reduce((acc, it) => acc + (it.uploadProgress || 0), 0) / uploadingItems.length
      );
      textElement.textContent = `Đang tải lên máy chủ (${avgProg}%)...`;
    } else if (pendingCount > 0) {
      textElement.textContent = `Chuyển đổi ${pendingCount} tệp tin`;
    } else {
      textElement.textContent = 'Chọn tệp để chuyển đổi';
    }
  }

  const iconElement = document.getElementById('btnStartConversionIcon');
  if (iconElement) {
    iconElement.innerHTML = (isBusy || isUploading)
      ? '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>'
      : '<i data-lucide="zap" class="w-5 h-5 fill-current"></i>';

    refreshLucide(iconElement);
  }

  const btnClearQueue = document.getElementById('btnClearConverterQueue');
  if (btnClearQueue) {
    btnClearQueue.disabled = isUploading;
    btnClearQueue.title = isUploading ? 'Đang tải tệp lên máy chủ...' : 'Xóa tất cả tệp';
    btnClearQueue.className = `text-xs ${isUploading ? 'opacity-40 cursor-not-allowed text-zinc-400' : 'text-zinc-500 hover:text-red-500 transition cursor-pointer'} flex items-center gap-1`;
  }
}

/**
 * Sets up reactive state subscriptions between the ConverterManager and the DOM.
 * @param {import('./useConverter.js').ConverterManager} manager - The converter state manager
 * @returns {() => void} Teardown unsubscribe function
 */
export function setupConverterObserver(manager) {
  const refreshDynamicSections = () => {
    const formatElement = document.getElementById('converterFormatContainer');
    if (formatElement) {
      formatElement.innerHTML = renderFormatSelector(manager);
      refreshLucide(formatElement);
    }

    const queueElement = document.getElementById('converterQueueContainer');
    if (queueElement) {
      queueElement.innerHTML = renderConverterQueueList(manager);
      refreshLucide(queueElement);
    }

    const resultElement = document.getElementById('converterResultContainer');
    if (resultElement) {
      resultElement.innerHTML = renderConverterResult(manager);
      refreshLucide(resultElement);
    }

    const dropzoneElement = document.getElementById('converterDropzoneContainer');
    if (dropzoneElement) {
      dropzoneElement.innerHTML = renderConverterDropzone(manager);
      refreshLucide(dropzoneElement);
    }

    syncCategoryUI(manager.selectedCategory);
    syncFormatUI(manager.selectedCategory, manager.targetFormat);
    updateBatchButton(manager);
  };

  return manager.subscribe((m, type) => {
    if (type === 'category-changed' || type === 'format-changed' || type === 'queue-changed' || type === 'item-updated') {
      refreshDynamicSections();
      return;
    }

    if (type === 'upload-progress') {
      let needsFullRender = false;
      m.items.forEach((item) => {
        const row = document.querySelector(`[data-item-id="${item.id}"]`);
        if (!row) {
          needsFullRender = true;
          return;
        }
        const badge = row.querySelector('.badge-upload-status');
        if (!badge) {
          needsFullRender = true;
          return;
        }

        if (item.uploadStatus === 'uploading') {
          badge.className = 'badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40';
          badge.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Đang tải lên ${item.uploadProgress || 0}%`;
          refreshLucide(badge);
        } else if (item.uploadStatus === 'uploaded' || item.fileId) {
          badge.className = 'badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40';
          badge.setAttribute('title', 'Đã sẵn sàng');
          badge.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> Đã sẵn sàng`;
          refreshLucide(badge);
        } else if (item.uploadStatus === 'error') {
          badge.className = 'badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40';
          badge.setAttribute('title', item.uploadError || 'Tải lên ngầm thất bại');
          badge.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3"></i> Lỗi tải lên`;
          refreshLucide(badge);
        } else if (item.status === 'stale' || item.uploadStatus === 'expired') {
          badge.className = 'badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40';
          badge.setAttribute('title', 'Phiên làm việc đã hết hạn. Vui lòng nạp lại tệp.');
          badge.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3"></i> Cần nạp lại`;
          refreshLucide(badge);
        }
      });

      if (needsFullRender) {
        const queueElement = document.getElementById('converterQueueContainer');
        if (queueElement) {
          queueElement.innerHTML = renderConverterQueueList(manager);
          refreshLucide(queueElement);
        }
      }
      updateBatchButton(manager);
      return;
    }

    if (type === 'item-progress') {
      // Targeted DOM update for item progress to avoid flickering whole queue
      m.items.forEach((item) => {
        if (item.status === 'converting') {
          const row = document.querySelector(`[data-item-id="${item.id}"]`);
          if (row) {
            const bar = row.querySelector('.bg-indigo-600');
            const pct = row.querySelector('.font-mono.text-indigo-500');
            if (bar) bar.style.width = `${item.progress}%`;
            if (pct) pct.textContent = `${item.progress}%`;
          }
        }
      });
      return;
    }

    if (type === 'error') {
      const errBanner = document.getElementById('converterErrorBanner');
      const errText = document.getElementById('converterErrorText');
      if (errBanner) {
        if (m.error) {
          errBanner.classList.remove('hidden');
          if (errText) errText.textContent = m.error;
        } else {
          errBanner.classList.add('hidden');
        }
      }
      updateBatchButton(manager);
      return;
    }

    if (type === 'conversion-finished' || type === 'batch-completed') {
      updateConverterHistoryDom(manager);
    }

    // Default: full dynamic refresh
    refreshDynamicSections();
  });
}

/**
 * Attaches DOM listeners for File Converter Pro.
 * @param {import('./useConverter.js').ConverterManager} manager - The converter state manager
 * @returns {() => void} Teardown unsubscribe function
 */
export function attachConverterListeners(manager) {
  // 1. Dropzone & File Ingestion (Multiple Support)
  const onFilesSelected = (files) => {
    if (files && files.length > 0) {
      manager.addFiles(files);
    }
  };

  const dropzoneContainer = document.getElementById('converterDropzoneContainer');

  if (dropzoneContainer) {
    // Delegated change listener ensures file inputs trigger file addition even after innerHTML re-renders
    dropzoneContainer.addEventListener('change', (e) => {
      if (e.target && e.target.type === 'file') {
        onFilesSelected(e.target.files);
        e.target.value = '';
      }
    });

    // Delegated click listener queries active DOM elements dynamically
    dropzoneContainer.onclick = (e) => {
      if (e.target.closest('#btnBrowseConverterFile')) {
        dropzoneContainer.querySelector('#converterDropzone_input')?.click();
      } else if (e.target.closest('#btnAddMoreConverterFiles')) {
        dropzoneContainer.querySelector('#converterAddMoreInput')?.click();
      } else if (e.target.closest('#dropzoneIdleView') && !e.target.closest('button')) {
        dropzoneContainer.querySelector('#converterDropzone_input')?.click();
      }
    };

    const getActiveDropzone = () => dropzoneContainer.querySelector('#dropzoneIdleView, #dropzoneCompactView');

    ['dragenter', 'dragover'].forEach((ev) => {
      dropzoneContainer.addEventListener(ev, (e) => {
        e.preventDefault();
        getActiveDropzone()?.classList.add('border-indigo-500', 'bg-indigo-500/[0.04]');
      });
    });

    ['dragleave', 'drop'].forEach((ev) => {
      dropzoneContainer.addEventListener(ev, (e) => {
        e.preventDefault();
        getActiveDropzone()?.classList.remove('border-indigo-500', 'bg-indigo-500/[0.04]');
      });
    });

    dropzoneContainer.ondrop = (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
    };
  }

  // 2. Setup Category Tabs & Format Pills via Event Delegation
  const formatContainer = document.getElementById('converterFormatContainer');
  if (formatContainer) {
    formatContainer.addEventListener('click', (e) => {
      const groupPill = e.target.closest('.btn-group-format-pill');
      if (groupPill) {
        const groupExt = groupPill.dataset.groupExt;
        const format = groupPill.dataset.format;
        if (groupExt && format && typeof manager.setFormatForExtension === 'function') {
          manager.setFormatForExtension(groupExt, format);
        }
        return;
      }

      const catBtn = e.target.closest('.btn-converter-cat');
      if (catBtn) {
        const category = catBtn.dataset.category;
        if (category) manager.setCategory(category);
        return;
      }

      const fmtPill = e.target.closest('.btn-format-pill');
      if (fmtPill) {
        const format = fmtPill.dataset.format;
        const category = fmtPill.dataset.category;
        if (category) manager.selectedCategory = category;
        if (format) manager.setTargetFormat(format);
      }
    });
  }

  // 3. Setup Queue List Delegations
  const queueContainer = document.getElementById('converterQueueContainer');
  if (queueContainer) {
    queueContainer.onchange = (e) => {
      const select = e.target.closest('.item-format-select');
      if (select) {
        const itemId = select.dataset.itemId;
        manager.setItemFormat(itemId, select.value);
      }
    };

    queueContainer.onclick = (e) => {
      const previewBtn = e.target.closest('.btn-preview-item');
      if (previewBtn) {
        const itemId = previewBtn.dataset.itemId;
        const it = manager.items?.find((x) => x.id === itemId);
        if (it?.result) {
          ViewerConnector.preview({
            fileName: it.result.fileName,
            downloadUrl: it.result.downloadUrl,
            fileId: it.result.resultFileId,
            resultSize: it.result.resultSize
          });
        }
        return;
      }

      const removeBtn = e.target.closest('.btn-remove-item');
      if (removeBtn) {
        manager.removeItem(removeBtn.dataset.itemId);
        return;
      }

      const retryBtn = e.target.closest('.btn-retry-item');
      if (retryBtn) {
        manager.retryItem(retryBtn.dataset.itemId);
        return;
      }

      if (e.target.closest('#btnClearConverterQueue')) {
        const isUploading = manager.items?.some(
          (it) => it.uploadStatus === 'uploading' || it.status === 'uploading'
        );
        if (isUploading) {
          showToast('Đang tải tệp lên máy chủ, vui lòng đợi hoàn tất!', 'warning');
          return;
        }
        manager.clearQueue();
        updateConverterHistoryDom(manager);
        return;
      }
    };
  }

  // 4. Setup Options & Batch Rename Controls
  const qualityRange = document.getElementById('inputQualityRange');
  if (qualityRange) {
    qualityRange.oninput = (e) => {
      const val = Number(e.target.value);
      manager.setOption('quality', val, false);
      const badge = document.getElementById('badgeQualityValue');
      if (badge) {
        badge.textContent = `${val}%`;
      }
    };
  }

  const bindOption = (id, key, isNumber = false) => {
    const el = document.getElementById(id);
    if (el) {
      el.onchange = (e) => {
        manager.setOption(key, isNumber ? Number(e.target.value) : e.target.value, false);
      };
    }
  };
  bindOption('inputImageWidth', 'width');
  bindOption('inputImageHeight', 'height');
  bindOption('selectVideoRes', 'resolution');
  bindOption('selectVideoFps', 'fps');
  bindOption('selectAudioBitrate', 'bitrate');

  const checkOcr = document.getElementById('checkOcrFeature');
  if (checkOcr) {
    checkOcr.onchange = (e) => manager.setOption('ocr', e.target.checked, false);
  }

  const prefixInput = document.getElementById('inputRenamePrefix');
  if (prefixInput) {
    prefixInput.oninput = (e) => manager.setRenamePattern('prefix', e.target.value.trim());
  }

  const suffixInput = document.getElementById('inputRenameSuffix');
  if (suffixInput) {
    suffixInput.oninput = (e) => manager.setRenamePattern('suffix', e.target.value.trim());
  }

  const numCheck = document.getElementById('checkRenameNumbering');
  if (numCheck) {
    numCheck.onchange = (e) => manager.setRenamePattern('numbering', e.target.checked);
  }

  // 5. Setup Action Triggers (Start, ZIP, Clear)
  const btnStart = document.getElementById('btnStartConversion');
  if (btnStart) {
    btnStart.onclick = async () => {
      await manager.startConversion();
      updateConverterHistoryDom(manager);
    };
  }

  const resultContainer = document.getElementById('converterResultContainer');
  if (resultContainer) {
    resultContainer.onclick = (e) => {
      const previewSingleBtn = e.target.closest('#btnPreviewSingleConverterResult');
      if (previewSingleBtn) {
        const itemId = previewSingleBtn.dataset.itemId;
        const it = manager.items?.find((x) => x.id === itemId) || manager.items?.find((x) => x.status === 'completed' && x.result);
        if (it?.result) {
          ViewerConnector.preview({
            fileName: it.result.fileName,
            downloadUrl: it.result.downloadUrl,
            fileId: it.result.resultFileId,
            resultSize: it.result.resultSize
          });
        }
        return;
      }

      if (e.target.closest('#btnDownloadAllZip')) {
        manager.downloadAllZip();
        return;
      }
      if (e.target.closest('#btnClearAllConverterResults')) {
        manager.clearQueue();
        updateConverterHistoryDom(manager);
        return;
      }
    };
  }

  const btnDismiss = document.getElementById('btnDismissConverterError');
  if (btnDismiss) {
    btnDismiss.onclick = () => {
      manager.error = null;
      manager.notify('error');
    };
  }

  bindConverterHistory(manager);
  const unsubscribeObserver = setupConverterObserver(manager);

  return () => {
    unsubscribeObserver();
  };
}
