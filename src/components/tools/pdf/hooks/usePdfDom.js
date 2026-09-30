/**
 * usePdfDom - DOM Event Management & In-Place Synchronization
 * Specialized Workspace event bindings for PDF Studio Pro
 */

import { renderDropzoneQueue } from '../components/DropzoneQueue.js';
import { renderConfigPanel } from '../components/ConfigPanel.js';
import { renderResultCard } from '../components/ResultCard.js';
import { renderPdfErrorBanner } from '../components/PdfErrorBanner.js';
import { bindPdfHistory, updatePdfHistoryDom } from '../components/PdfHistoryList.js';
import { attachDropzoneListeners } from '../../../common/Dropzone.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';
import { showToast } from '../../../../utilities/toast.js';
import { copyText } from '../../../../utilities/clipboard.js';
import { storage } from '../../../../utilities/storage.js';
import { loadAndRenderPdfThumbnails } from '../components/PdfRotateWorkspace.js';
import { loadAndRenderSplitThumbnails } from '../components/PdfSplitWorkspace.js';
import { loadAndRenderOrganizeThumbnails } from '../components/PdfOrganizeWorkspace.js';
import { openPdfPageLightbox, closePdfPageLightbox } from '../components/PdfPageLightboxModal.js';
import { restoreThumbnailsSynchronously } from '../components/PdfPreviewCanvas.js';
import { pdfPageCache } from '../services/PdfPageCache.js';
import { attachSwipeToDismiss, attachSlideToClear } from '../../../../utilities/swipeGesture.js';
import { attachPointerReorder } from '../../../../utilities/dragReorder.js';

/**
 * Synchronizes active tab styling for PDF Studio modes.
 */
export function syncModeTabs(activeMode, isProcessing = false) {
  document.querySelectorAll('.btn-pdf-mode').forEach((btn) => {
    const isActive = btn.dataset.mode === activeMode;
    if (isProcessing) {
      btn.disabled = true;
      btn.className = 'btn-pdf-mode flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 opacity-40 cursor-not-allowed pointer-events-none text-zinc-400 dark:text-zinc-600';
    } else {
      btn.disabled = false;
      btn.className = `btn-pdf-mode flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 ${
        isActive
          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
          : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
      }`;
    }
  });
}

/**
 * In-place processing state controller for visual workspaces (Split/Rotate)
 * Keeps thumbnails and canvases continuously visible without DOM replacement.
 */
function setVisualWorkspaceProcessingState(isProcessing) {
  const dropEl = document.getElementById('pdfDropzoneContainer');
  if (!dropEl) return;
  if (isProcessing) {
    dropEl.classList.add('pointer-events-none', 'opacity-85');
  } else {
    dropEl.classList.remove('pointer-events-none', 'opacity-85');
  }

  const buttonsToToggle = [
    '#btnChangeRotateFile', '#btnChangeSplitFile', '#btnChangeOrganizeFile', '#btnChangeSingleFile',
    '#btnRotateAllCW', '#btnRotateAllCCW', '#btnResetRotations',
    '#btnSelectAllPages', '#btnSelectOddPages', '#btnSelectEvenPages', '#btnDeselectAllPages',
    '#btnReverseOrganize', '#btnResetOrganize',
    '#btnPrevSplitPage', '#btnNextSplitPage', '#btnPrevRotatePage', '#btnNextRotatePage',
    '#btnPrevOrganizePage', '#btnNextOrganizePage',
    '#btnClearAllMultiFiles', '#btnPreviewSingleFile'
  ];
  buttonsToToggle.forEach((sel) => {
    const btn = dropEl.querySelector(sel);
    if (btn) {
      btn.disabled = isProcessing;
      if (isProcessing) {
        btn.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        btn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
  });

  const inputsToToggle = ['#inputPdfPages', '#inputAddMoreFiles'];
  inputsToToggle.forEach((sel) => {
    const input = dropEl.querySelector(sel);
    if (input) {
      input.disabled = isProcessing;
      if (isProcessing) {
        input.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        input.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
  });

  dropEl.querySelectorAll('.btn-file-move-up, .btn-file-move-down, .btn-file-remove, .btn-page-card, [data-rotate-single], .btn-preview-page, .btn-split-card, .btn-rotate-organize, .btn-delete-organize').forEach((el) => {
    if ('disabled' in el) el.disabled = isProcessing;
    if (isProcessing) {
      el.classList.add('opacity-40', 'cursor-not-allowed');
      el.setAttribute('aria-disabled', 'true');
    } else {
      el.classList.remove('opacity-40', 'cursor-not-allowed');
      el.removeAttribute('aria-disabled');
    }
  });
}

/**
 * Binds dropzone event handlers or specialized workspace interactions
 */
function bindDropzone(qm) {
  attachDropzoneListeners('pdfDropzone', (files) => {
    qm.addFiles(files);
    if (qm.mode === 'view' && files && files[0]) {
      ViewerConnector.previewBlob(files[0], files[0].name);
    }
  });

  const rootEl = document.getElementById('pdfDropzoneContainer');
  if (!rootEl) return;

  // 1. Rotate Workspace
  if (qm.mode === 'rotate' && qm.files.length > 0) {
    rootEl.querySelector('#btnChangeRotateFile')?.addEventListener('click', () => {
      if (qm.files[0]) pdfPageCache.releaseForFile(qm.files[0]);
      qm.clearFiles();
    });
    rootEl.querySelector('#btnRotateAllCW')?.addEventListener('click', () => qm.rotateAll(90));
    rootEl.querySelector('#btnRotateAllCCW')?.addEventListener('click', () => qm.rotateAll(-90));
    rootEl.querySelector('#btnResetRotations')?.addEventListener('click', () => qm.resetRotations());

    rootEl.querySelector('#btnPrevRotatePage')?.addEventListener('click', () => {
      qm.setThumbnailPage(qm.thumbnailPage - 1);
    });
    rootEl.querySelector('#btnNextRotatePage')?.addEventListener('click', () => {
      qm.setThumbnailPage(qm.thumbnailPage + 1);
    });

    rootEl.querySelectorAll('.btn-page-card').forEach((card) => {
      card.onclick = () => {
        const idx = card.dataset.pageIndex;
        if (idx !== undefined) qm.rotatePage(idx, 90);
      };
    });

    rootEl.querySelectorAll('[data-rotate-single]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = btn.dataset.rotateSingle;
        if (idx !== undefined) qm.rotatePage(idx, 90);
      };
    });

    rootEl.querySelectorAll('.btn-preview-page').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.previewPage);
        if (!isNaN(idx) && qm.files[0]) {
          openPdfPageLightbox({
            file: qm.files[0],
            pageIndex: idx,
            rotation: qm.pageRotations[idx] || 0,
            totalPages: qm.totalPages || qm.files[0].pages || 1,
            getRotation: (pageIdx) => qm.pageRotations[pageIdx] || 0,
            onRotateChange: (pageIdx, deg) => qm.rotatePage(pageIdx, deg),
            onPageChange: (newPage) => {
              const newThumbPage = Math.floor(newPage / 8);
              if (newThumbPage !== qm.thumbnailPage) {
                qm.setThumbnailPage(newThumbPage);
              }
            }
          });
        }
      };
    });

    // Synchronously paint cached bitmaps immediately with 0ms latency
    restoreThumbnailsSynchronously(rootEl, qm.files[0]);

    // Check if any canvas in the visible page range needs rendering
    const unrendered = rootEl.querySelector('#pdfRotateGrid canvas.pdf-thumb-canvas:not([data-rendered="true"])');
    if (unrendered || !qm.totalPages) {
      loadAndRenderPdfThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
    }
  }

  // 2. Split Workspace
  else if (qm.mode === 'split' && qm.files.length > 0) {
    rootEl.querySelector('#btnChangeSplitFile')?.addEventListener('click', () => {
      if (qm.files[0]) pdfPageCache.releaseForFile(qm.files[0]);
      qm.clearFiles();
    });
    rootEl.querySelector('#btnSelectAllPages')?.addEventListener('click', () => qm.selectAllSplitPages());
    rootEl.querySelector('#btnDeselectAllPages')?.addEventListener('click', () => qm.deselectAllSplitPages());
    rootEl.querySelector('#btnSelectOddPages')?.addEventListener('click', () => qm.selectOddSplitPages());
    rootEl.querySelector('#btnSelectEvenPages')?.addEventListener('click', () => qm.selectEvenSplitPages());

    rootEl.querySelector('#btnPrevSplitPage')?.addEventListener('click', () => {
      qm.setThumbnailPage(qm.thumbnailPage - 1);
    });
    rootEl.querySelector('#btnNextSplitPage')?.addEventListener('click', () => {
      qm.setThumbnailPage(qm.thumbnailPage + 1);
    });

    const rangeInput = rootEl.querySelector('#inputPdfPages');
    if (rangeInput) {
      rangeInput.oninput = (e) => qm.setPages(e.target.value);
    }

    rootEl.querySelectorAll('.btn-split-card').forEach((card) => {
      card.onclick = () => {
        const idx = card.dataset.splitIndex;
        if (idx !== undefined) qm.toggleSplitPage(idx);
      };
    });

    rootEl.querySelectorAll('.btn-preview-page').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.previewPage);
        if (!isNaN(idx) && qm.files[0]) {
          openPdfPageLightbox({
            file: qm.files[0],
            pageIndex: idx,
            rotation: 0,
            totalPages: qm.totalPages || qm.files[0].pages || 1,
            getRotation: () => 0,
            onPageChange: (newPage) => {
              const newThumbPage = Math.floor(newPage / 8);
              if (newThumbPage !== qm.thumbnailPage) {
                qm.setThumbnailPage(newThumbPage);
              }
            }
          });
        }
      };
    });

    // Synchronously paint cached bitmaps immediately with 0ms latency
    restoreThumbnailsSynchronously(rootEl, qm.files[0]);

    // Check if any canvas in the visible page range needs rendering
    const unrendered = rootEl.querySelector('#pdfSplitGrid canvas.pdf-thumb-canvas:not([data-rendered="true"])');
    if (unrendered || !qm.totalPages) {
      loadAndRenderSplitThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
    }
  }

  // 3. Organize Workspace
  else if (qm.mode === 'organize' && qm.files.length > 0) {
    rootEl.querySelector('#btnChangeOrganizeFile')?.addEventListener('click', () => {
      if (qm.files[0]) pdfPageCache.releaseForFile(qm.files[0]);
      qm.clearFiles();
    });
    rootEl.querySelector('#btnReverseOrganize')?.addEventListener('click', () => qm.reverseOrganizePages());
    rootEl.querySelector('#btnResetOrganize')?.addEventListener('click', () => qm.resetOrganizePages());

    rootEl.querySelector('#btnPrevOrganizePage')?.addEventListener('click', () => {
      qm.setThumbnailPage(qm.thumbnailPage - 1);
    });
    rootEl.querySelector('#btnNextOrganizePage')?.addEventListener('click', () => {
      qm.setThumbnailPage(qm.thumbnailPage + 1);
    });

    rootEl.querySelectorAll('.btn-rotate-organize').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const origIdx = Number(btn.dataset.rotateOrganize);
        if (!isNaN(origIdx)) qm.rotateOrganizePage(origIdx, 90);
      };
    });

    rootEl.querySelectorAll('.btn-delete-organize').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const origIdx = Number(btn.dataset.deleteOrganize);
        if (!isNaN(origIdx)) qm.toggleDeleteOrganizePage(origIdx);
      };
    });

    rootEl.querySelectorAll('.btn-preview-page').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const origIdx = Number(btn.dataset.previewPage);
        if (!isNaN(origIdx) && qm.files[0]) {
          openPdfPageLightbox({
            file: qm.files[0],
            pageIndex: origIdx,
            rotation: qm.organizeRotations[origIdx] || 0,
            totalPages: qm.totalPages || qm.files[0].pages || 1,
            getRotation: (pageIdx) => qm.organizeRotations[pageIdx] || 0,
            onRotateChange: (pageIdx, deg) => qm.rotateOrganizePage(pageIdx, deg),
            onPageChange: (newPage) => {
              const newThumbPage = Math.floor(newPage / 8);
              if (newThumbPage !== qm.thumbnailPage) {
                qm.setThumbnailPage(newThumbPage);
              }
            }
          });
        }
      };
    });

    // Reorder drag and drop
    const organizeGrid = rootEl.querySelector('#pdfOrganizeGrid');
    if (organizeGrid) {
      const startIdx = (qm.thumbnailPage || 0) * 8;
      attachPointerReorder(organizeGrid, {
        itemSelector: '[data-reorder-item="true"]',
        handleSelector: '[data-drag-handle="true"]',
        onReorder: (fromIdx, toIdx) => {
          const fromGlobal = startIdx + fromIdx;
          const toGlobal = startIdx + toIdx;
          qm.reorderOrganizePages(fromGlobal, toGlobal);
        }
      });
    }

    // Synchronously paint cached bitmaps immediately with 0ms latency
    restoreThumbnailsSynchronously(rootEl, qm.files[0]);

    // Check if any canvas in the visible page range needs rendering
    const unrendered = rootEl.querySelector('#pdfOrganizeGrid canvas.pdf-thumb-canvas:not([data-rendered="true"])');
    if (unrendered || !qm.totalPages) {
      loadAndRenderOrganizeThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8);
    }
  }

  // 4. Multi-file Workspace (Merge & Images to PDF)
  else if ((qm.mode === 'merge' || qm.mode === 'images_to_pdf') && qm.files.length > 0) {
    rootEl.querySelector('#btnClearAllMultiFiles')?.addEventListener('click', () => {
      qm.files.forEach((f) => pdfPageCache.releaseForFile(f));
      qm.clearFiles();
    });

    const slideTrack = rootEl.querySelector('#slideClearTrack');
    const slideThumb = rootEl.querySelector('#slideClearThumb');
    const slideFill = rootEl.querySelector('#slideClearFill');
    const slideLabel = rootEl.querySelector('#slideClearLabel');
    if (slideTrack && slideThumb) {
      attachSlideToClear(slideTrack, slideThumb, {
        thresholdRatio: 0.70,
        fillElement: slideFill,
        labelElement: slideLabel,
        onClear: () => {
          qm.files.forEach((f) => pdfPageCache.releaseForFile(f));
          qm.clearFiles();
        }
      });
    }

    rootEl.querySelector('#inputAddMoreFiles')?.addEventListener('change', (e) => {
      if (e.target.files) qm.addFiles(e.target.files);
    });

    const multiRoot = rootEl.querySelector('#pdfMultiFileWorkspaceRoot');
    if (multiRoot) {
      multiRoot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        multiRoot.classList.add('ring-2', 'ring-amber-500/50');
      });
      multiRoot.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        multiRoot.classList.remove('ring-2', 'ring-amber-500/50');
      });
      multiRoot.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        multiRoot.classList.remove('ring-2', 'ring-amber-500/50');
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          qm.addFiles(e.dataTransfer.files);
        }
      });
    }

    rootEl.querySelectorAll('.btn-file-move-up').forEach((btn) => {
      btn.onclick = () => qm.moveFileUp(Number(btn.dataset.moveUp));
    });
    rootEl.querySelectorAll('.btn-file-move-down').forEach((btn) => {
      btn.onclick = () => qm.moveFileDown(Number(btn.dataset.moveDown));
    });
    rootEl.querySelectorAll('.btn-file-remove').forEach((btn) => {
      btn.onclick = () => {
        const removedFile = qm.files.find((f) => f.id === btn.dataset.removeMultiId);
        if (removedFile) pdfPageCache.releaseForFile(removedFile);
        qm.removeFile(btn.dataset.removeMultiId);
      };
    });

    // Unified Pointer Drag-and-Drop Reordering
    const multiFileList = rootEl.querySelector('#pdfMultiFileList');
    if (multiFileList) {
      attachPointerReorder(multiFileList, {
        itemSelector: '.pdf-file-row-wrapper',
        handleSelector: '.drag-grip-handle',
        onReorder: (fromIdx, toIdx) => {
          qm.reorderFiles(fromIdx, toIdx);
        }
      });
    }

    // Touch & Pointer Swipe-to-Dismiss on Rows
    rootEl.querySelectorAll('.pdf-file-row').forEach((rowEl) => {
      const fileId = rowEl.dataset.fileId;
      if (!fileId) return;
      attachSwipeToDismiss(rowEl, {
        direction: 'left',
        thresholdRatio: 0.35,
        thresholdPx: 100,
        wrapperElement: rowEl.closest('.pdf-file-row-wrapper'),
        onComplete: () => {
          const removedFile = qm.files.find((f) => f.id === fileId);
          if (removedFile) pdfPageCache.releaseForFile(removedFile);
          qm.removeFile(fileId);
        }
      });
    });
  }

  // 4. Single-file Card (Compress, Watermark, Security, Extract Images, View)
  else if (qm.files.length > 0) {
    rootEl.querySelector('#btnChangeSingleFile')?.addEventListener('click', () => {
      if (qm.files[0]) pdfPageCache.releaseForFile(qm.files[0]);
      qm.clearFiles();
    });
    rootEl.querySelector('#btnPreviewSingleFile')?.addEventListener('click', () => {
      const f = qm.files[0];
      if (f) ViewerConnector.previewBlob(f.rawFile || f, f.name);
    });
  }

  setVisualWorkspaceProcessingState(qm.isProcessing);
}

/**
 * Binds configuration panel inputs, switches, and action buttons.
 */
function bindConfig(qm) {
  const cfgEl = document.getElementById('pdfConfigContainer');
  if (!cfgEl) return;

  cfgEl.querySelectorAll('.btn-compression-preset').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.compression) {
        qm.setCompressionPreset(btn.dataset.compression);
      }
    };
  });

  cfgEl.querySelectorAll('.btn-sec-action').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.secAction) {
        qm.setSecurityAction(btn.dataset.secAction);
      }
    };
  });

  cfgEl.querySelectorAll('.btn-open-recent-pdf').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.openRecentPdf;
      const all = storage.getLocalHistory();
      const item = all.find((x) => x.id === id);
      if (item) ViewerConnector.preview(item);
    };
  });

  const wmInput = cfgEl.querySelector('#inputPdfWatermark');
  if (wmInput) wmInput.oninput = (e) => qm.setWatermarkText(e.target.value);

  cfgEl.querySelectorAll('.btn-watermark-pos').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.watermarkPos) {
        qm.setWatermarkPosition(btn.dataset.watermarkPos);
      }
    };
  });

  const wmOpacityInput = cfgEl.querySelector('#inputWatermarkOpacity');
  if (wmOpacityInput) {
    wmOpacityInput.oninput = (e) => {
      const val = parseFloat(e.target.value);
      const label = cfgEl.querySelector('#watermarkOpacityLabel');
      if (label) label.textContent = `${Math.round(val * 100)}%`;
      qm.setWatermarkOpacity(val);
    };
  }

  const chkPageNum = cfgEl.querySelector('#chkPdfPageNumbers');
  if (chkPageNum) chkPageNum.onchange = (e) => qm.setPageNumbers(e.target.checked);

  const passwordInput = cfgEl.querySelector('#inputPdfPassword');
  if (passwordInput) passwordInput.oninput = (e) => qm.setPassword(e.target.value);

  const docxPagesInput = cfgEl.querySelector('#inputPdfDocxPages');
  if (docxPagesInput) docxPagesInput.oninput = (e) => qm.setPages(e.target.value);

  const btnStart = cfgEl.querySelector('#btnStartProcess');
  if (btnStart) {
    btnStart.onclick = () => {
      if (qm.mode === 'view') {
        if (qm.files[0]) {
          ViewerConnector.previewBlob(qm.files[0].rawFile || qm.files[0], qm.files[0].name);
        } else {
          showToast('Vui lòng chọn tệp PDF', 'warning');
        }
        return;
      }
      qm.runProcess();
    };
  }

  const btnCancel = cfgEl.querySelector('#btnCancelPdfProcess');
  if (btnCancel) {
    btnCancel.onclick = () => {
      qm.cancelTask('pdf-studio-job');
    };
  }
}

/**
 * Binds result card actions (reset, preview, trash, copy download URL).
 */
function bindResult(qm) {
  const resEl = document.getElementById('pdfResultContainer');
  if (!resEl) return;

  resEl.querySelector('#btnResetResult')?.addEventListener('click', () => qm.resetResult());
  resEl.querySelector('#btnPreviewPdfResult')?.addEventListener('click', () => {
    if (qm.result) {
      ViewerConnector.preview({
        ...qm.result,
        fileId: qm.result.resultFileId
      });
    }
  });

  resEl.querySelector('#btnTrashPdfResult')?.addEventListener('click', async () => {
    if (qm.result?.historyId) {
      await storage.moveToTrash(qm.result.historyId);
      showToast('Đã chuyển vào thùng rác', 'info');
      qm.resetResult();
    }
  });

  const btnCopy = resEl.querySelector('#btnCopyDownloadLink');
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const url = btnCopy.getAttribute('data-url');
      if (url) {
        const ok = await copyText(url);
        if (ok) showToast('Đã sao chép link', 'success');
      }
    };
  }

  cleanupChainMenuListener();
  const toggleChainBtn = resEl.querySelector('#btnToggleChainWorkflow');
  const chainMenu = resEl.querySelector('#chainWorkflowMenu');
  if (toggleChainBtn && chainMenu) {
    toggleChainBtn.onclick = (e) => {
      e.stopPropagation();
      chainMenu.classList.toggle('hidden');
    };
    activeChainMenuDocListener = (e) => {
      if (!chainMenu.contains(e.target) && e.target !== toggleChainBtn) {
        chainMenu.classList.add('hidden');
      }
    };
    document.addEventListener('click', activeChainMenuDocListener);
  }

  resEl.querySelectorAll('.btn-chain-mode').forEach((btn) => {
    btn.onclick = () => {
      if (chainMenu) chainMenu.classList.add('hidden');
      cleanupChainMenuListener();
      const targetMode = btn.dataset.chainMode;
      if (targetMode) {
        qm.chainResultToMode(targetMode);
      }
    };
  });
}

let activeChainMenuDocListener = null;

export function cleanupChainMenuListener() {
  if (activeChainMenuDocListener) {
    document.removeEventListener('click', activeChainMenuDocListener);
    activeChainMenuDocListener = null;
  }
}

/**
 * Binds dismiss button for PDF processing error banners.
 */
function bindError(qm) {
  document.getElementById('btnDismissError')?.addEventListener('click', () => qm.resetResult());
}

/**
 * Refreshes Lucide icons inside specified container elements.
 */
function refreshIcons(...elements) {
  if (!window.lucide) return;
  elements.forEach((el) => {
    if (el) window.lucide.createIcons({ root: el });
  });
}

/**
 * Synchronizes grid column spans between dropzone and config container
 * based on whether files are loaded and active mode.
 */
function syncLayoutColumns(state) {
  const dropEl = document.getElementById('pdfDropzoneContainer');
  const cfgEl = document.getElementById('pdfConfigContainer');
  if (!dropEl || !cfgEl) return;

  const hasFiles = Boolean(state.files && state.files.length > 0);
  const isVisual = (state.mode === 'rotate' || state.mode === 'split') && hasFiles;

  dropEl.classList.remove('lg:col-span-12', 'lg:col-span-8', 'lg:col-span-7');
  cfgEl.classList.remove('hidden', 'lg:col-span-5', 'lg:col-span-4');

  if (!hasFiles || state.isLoadingFile) {
    dropEl.classList.add('lg:col-span-12');
    cfgEl.classList.add('hidden');
  } else if (isVisual) {
    dropEl.classList.add('lg:col-span-8');
    cfgEl.classList.add('lg:col-span-4');
  } else {
    dropEl.classList.add('lg:col-span-7');
    cfgEl.classList.add('lg:col-span-5');
  }
}

/**
 * Attaches DOM listeners and subscribes to PDF queue manager updates.
 */
export function attachPdfConverterListeners(queueManager) {
  const selectorContainer = document.getElementById('pdfModeSelectorContainer');
  if (selectorContainer) {
    selectorContainer.onclick = (e) => {
      if (queueManager.isProcessing) {
        showToast('Đang xử lý tác vụ, vui lòng đợi hoàn tất', 'warning');
        return;
      }
      const btn = e.target.closest('.btn-pdf-mode');
      if (btn && btn.dataset.mode) {
        queueManager.setMode(btn.dataset.mode);
      }
    };
  }

  syncLayoutColumns(queueManager);
  bindDropzone(queueManager);
  bindConfig(queueManager);
  bindResult(queueManager);
  bindError(queueManager);
  bindPdfHistory(queueManager);

  const unsubscribe = queueManager.subscribe((state, eventType) => {
    if (eventType === 'file-loading') {
      syncLayoutColumns(state);
      const dropEl = document.getElementById('pdfDropzoneContainer');
      if (dropEl) {
        dropEl.innerHTML = renderDropzoneQueue(state);
        refreshIcons(dropEl);
      }
      return;
    }

    if (eventType === 'progress' || eventType === 'upload-progress') {
      const btnStart = document.getElementById('btnStartProcess');
      if (btnStart && state.isProcessing) {
        const pct = Math.max(0, Math.min(100, Math.round(state.progress || 0)));
        btnStart.innerHTML = `
          <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-zinc-950"></i>
          <span>Đang xử lý (${pct}%)...</span>
        `;
        if (window.lucide) window.lucide.createIcons({ root: btnStart });
      }
      return;
    }

    if (eventType === 'doc-info') {
      document.querySelectorAll('.badge-page-count').forEach((el) => {
        el.textContent = state.totalPages > 0 ? `${state.totalPages} trang` : '';
      });
      return;
    }

    if (eventType === 'rotation-change') {
      const pageRotations = state.pageRotations || {};
      const rotatedCount = Object.values(pageRotations).filter((deg) => (deg % 360) !== 0).length;
      const grid = document.getElementById('pdfRotateGrid');
      if (grid) {
        grid.querySelectorAll('.btn-page-card').forEach((card) => {
          const idx = Number(card.dataset.pageIndex);
          const deg = (pageRotations[idx] || 0) % 360;
          const canvas = document.getElementById(`pdfRotateCanvas_${idx}`);
          if (canvas) canvas.style.transform = `rotate(${deg}deg)`;

          if (deg) {
            card.classList.add('border-amber-500', 'bg-amber-500/[0.03]');
            card.classList.remove('border-zinc-200/80', 'dark:border-white/[0.08]', 'bg-white', 'dark:bg-[#121215]');
          } else {
            card.classList.remove('border-amber-500', 'bg-amber-500/[0.03]');
            card.classList.add('border-zinc-200/80', 'dark:border-white/[0.08]', 'bg-white', 'dark:bg-[#121215]');
          }

          let badgeRot = card.querySelector('.badge-rot');
          if (deg) {
            if (!badgeRot) {
              const footerCtrl = card.querySelector('.page-footer-ctrls');
              if (footerCtrl) {
                const span = document.createElement('span');
                span.className = 'badge-rot px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30';
                span.textContent = `${deg}°`;
                footerCtrl.insertBefore(span, footerCtrl.firstChild);
              }
            } else {
              badgeRot.textContent = `${deg}°`;
            }
          } else if (badgeRot) {
            badgeRot.remove();
          }
        });
      }

      const summaryEl = document.getElementById('pdfRotatedSummary');
      if (summaryEl) {
        summaryEl.innerHTML = rotatedCount > 0 ? `• Đã xoay <strong class="text-amber-500 font-bold">${rotatedCount}</strong> trang` : '';
      }

      const resetBtn = document.getElementById('btnResetRotations');
      if (resetBtn) {
        resetBtn.classList.toggle('hidden', rotatedCount === 0);
      }

      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
        refreshIcons(cfgEl);
      }
      return;
    }

    if (eventType === 'split-selection-change') {
      const selected = state.selectedSplitPages || new Set();
      const selectedCount = selected.size;
      const grid = document.getElementById('pdfSplitGrid');
      if (grid) {
        grid.querySelectorAll('.btn-split-card').forEach((card) => {
          const idx = Number(card.dataset.splitIndex);
          const isSelected = selected.has(idx);
          const chkBox = card.querySelector('.split-chkbox');
          const statusText = card.querySelector('.split-status-text');
          if (isSelected) {
            card.classList.add('border-amber-500', 'dark:border-amber-500/80', 'bg-amber-500/[0.04]', 'ring-2', 'ring-amber-500/20');
            card.classList.remove('border-zinc-200/80', 'dark:border-white/[0.08]');
            if (chkBox) chkBox.className = 'split-chkbox w-5 h-5 rounded-md flex items-center justify-center transition-colors bg-amber-500 text-zinc-950 shadow-2xs';
            if (statusText) statusText.textContent = 'Đã chọn';
          } else {
            card.classList.remove('border-amber-500', 'dark:border-amber-500/80', 'bg-amber-500/[0.04]', 'ring-2', 'ring-amber-500/20');
            card.classList.add('border-zinc-200/80', 'dark:border-white/[0.08]');
            if (chkBox) chkBox.className = 'split-chkbox w-5 h-5 rounded-md flex items-center justify-center transition-colors bg-white/80 dark:bg-black/50 border border-zinc-300 dark:border-white/20 text-transparent';
            if (statusText) statusText.textContent = '';
          }
        });

        const rangeInput = document.getElementById('inputPdfPages');
        if (rangeInput && rangeInput.value !== state.pages) {
          rangeInput.value = state.pages;
        }
      }

      const summaryEl = document.getElementById('pdfSplitSummary');
      if (summaryEl) {
        summaryEl.innerHTML = `• Đã chọn <strong class="text-amber-500 font-bold">${selectedCount}</strong> trang`;
      }

      const deselectBtn = document.getElementById('btnDeselectAllPages');
      if (deselectBtn) {
        deselectBtn.classList.toggle('hidden', selectedCount === 0);
      }

      const rangeInput = document.getElementById('inputPdfPages');
      let errP = document.getElementById('pdfSplitRangeError');
      if (state.splitRangeError) {
        if (rangeInput) {
          rangeInput.classList.add('border-red-500', 'focus:ring-red-500');
          rangeInput.classList.remove('border-zinc-200', 'dark:border-zinc-700/60', 'focus:ring-amber-500');
          if (!errP && rangeInput.parentElement) {
            errP = document.createElement('p');
            errP.id = 'pdfSplitRangeError';
            errP.className = 'text-[11px] font-mono text-red-500 font-semibold';
            rangeInput.parentElement.appendChild(errP);
          }
        }
        if (errP) errP.textContent = state.splitRangeError;
      } else {
        if (rangeInput) {
          rangeInput.classList.remove('border-red-500', 'focus:ring-red-500');
          rangeInput.classList.add('border-zinc-200', 'dark:border-zinc-700/60', 'focus:ring-amber-500');
        }
        if (errP) errP.remove();
      }

      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
        refreshIcons(cfgEl);
      }
      return;
    }

    if (eventType === 'organize-change') {
      const dropEl = document.getElementById('pdfDropzoneContainer');
      if (dropEl) {
        dropEl.innerHTML = renderDropzoneQueue(state);
        bindDropzone(queueManager);
      }
      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
      }
      refreshIcons(dropEl, cfgEl);
      return;
    }

    if (eventType === 'config-change') {
      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
        refreshIcons(cfgEl);
      }
      return;
    }

    if (eventType === 'process-start') {
      syncModeTabs(state.mode, true);
      const resEl = document.getElementById('pdfResultContainer');
      if (resEl) {
        resEl.innerHTML = renderResultCard(state.result);
        bindResult(queueManager);
      }
      const errEl = document.getElementById('pdfErrorBannerContainer');
      if (errEl) {
        errEl.innerHTML = renderPdfErrorBanner(state.error);
        bindError(queueManager);
      }
      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
        refreshIcons(cfgEl);
      }
      setVisualWorkspaceProcessingState(true);
      return;
    }

    if (eventType === 'error' || eventType === 'failed') {
      syncModeTabs(state.mode, false);
      const errEl = document.getElementById('pdfErrorBannerContainer');
      if (errEl) {
        errEl.innerHTML = renderPdfErrorBanner(state.error);
        bindError(queueManager);
        refreshIcons(errEl);
      }
      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
        refreshIcons(cfgEl);
      }
      setVisualWorkspaceProcessingState(false);
      return;
    }

    if (eventType === 'completed' || eventType === 'result-reset') {
      syncModeTabs(state.mode, false);
      const resEl = document.getElementById('pdfResultContainer');
      if (resEl) {
        resEl.innerHTML = renderResultCard(state.result);
        bindResult(queueManager);
        refreshIcons(resEl);
      }
      const errEl = document.getElementById('pdfErrorBannerContainer');
      if (errEl) {
        errEl.innerHTML = renderPdfErrorBanner(state.error);
        bindError(queueManager);
      }
      const cfgEl = document.getElementById('pdfConfigContainer');
      if (cfgEl) {
        cfgEl.innerHTML = renderConfigPanel(state);
        bindConfig(queueManager);
        refreshIcons(cfgEl);
      }
      setVisualWorkspaceProcessingState(false);
      updatePdfHistoryDom(queueManager);
      return;
    }

    if (eventType === 'mode-change') {
      closePdfPageLightbox();
      cleanupChainMenuListener();
      syncModeTabs(state.mode, state.isProcessing);
    }

    if (eventType === 'files-change') {
      closePdfPageLightbox();
      cleanupChainMenuListener();
    }

    if (eventType === 'thumbnail-page-change') {
      const dropEl = document.getElementById('pdfDropzoneContainer');
      if (dropEl) {
        dropEl.innerHTML = renderDropzoneQueue(state);
        bindDropzone(queueManager);
        refreshIcons(dropEl);
      }
      return;
    }

    syncLayoutColumns(state);
    if (!state.isProcessing) {
      const dropEl = document.getElementById('pdfDropzoneContainer');
      if (dropEl) {
        dropEl.innerHTML = renderDropzoneQueue(state);
        bindDropzone(queueManager);
      }
    }
    const cfgEl = document.getElementById('pdfConfigContainer');
    if (cfgEl) {
      cfgEl.innerHTML = renderConfigPanel(state);
      bindConfig(queueManager);
    }
    updatePdfHistoryDom(queueManager);
    refreshIcons(document.getElementById('pdfDropzoneContainer'), cfgEl);
  });

  return () => {
    try { unsubscribe(); } catch {}
    closePdfPageLightbox();
    cleanupChainMenuListener();
  };
}
