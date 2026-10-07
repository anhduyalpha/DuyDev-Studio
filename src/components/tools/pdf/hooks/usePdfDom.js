/**
 * usePdfDom - DOM Event Management & In-Place Synchronization
 * Specialized Workspace event bindings for PDF Studio Pro
 */

import { renderDropzoneQueue } from '../components/DropzoneQueue.js';
import { renderConfigPanel } from '../components/ConfigPanel.js';
import { renderResultCard } from '../components/ResultCard.js';
import { renderPdfErrorBanner } from '../components/PdfErrorBanner.js';
import { bindPdfHistory, updatePdfHistoryDom } from '../components/PdfHistoryList.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';
import { showToast } from '../../../../utilities/toast.js';
import { copyText } from '../../../../utilities/clipboard.js';
import { storage } from '../../../../utilities/storage.js';
import { loadAndRenderPdfThumbnails } from '../components/PdfRotateWorkspace.js';
import { loadAndRenderSplitThumbnails } from '../components/PdfSplitWorkspace.js';
import { loadAndRenderOrganizeThumbnails } from '../components/PdfOrganizeWorkspace.js';
import { openPdfPageLightbox, closePdfPageLightbox } from '../components/PdfPageLightboxModal.js';
import { restoreThumbnailsSynchronously, renderWorkspaceThumbnails } from '../components/PdfPreviewCanvas.js';
import { pdfPageCache } from '../services/PdfPageCache.js';
import { attachSwipeToDismiss, attachSlideToClear } from '../../../../utilities/swipeGesture.js';
import { attachPointerReorder } from '../../../../utilities/dragReorder.js';
import { attachPdfClipboardPaste, pasteImageFromClipboard } from './usePdfPaste.js';
import { getToolTheme, PDF_THEMES } from '../services/pdfThemes.js';

const ALL_THEME_ICON_CLASSES = Object.values(PDF_THEMES).flatMap((t) => (t.iconActive || '').split(' ')).filter(Boolean);

/**
 * Synchronizes active tab styling for PDF Studio modes with Semantic Tool Theming.
 */
export function syncModeTabs(activeMode, isProcessing = false) {
  document.querySelectorAll('.btn-pdf-mode').forEach((btn) => {
    const mode = btn.dataset.mode;
    const theme = getToolTheme(mode);
    const isActive = mode === activeMode;
    if (isProcessing) {
      btn.disabled = true;
      btn.className = 'btn-pdf-mode flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 opacity-40 cursor-not-allowed pointer-events-none text-zinc-400 dark:text-zinc-600';
    } else {
      btn.disabled = false;
      btn.className = `btn-pdf-mode flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 ${
        isActive
          ? `bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-sm font-bold ring-1 ring-inset ${theme.ringTab}`
          : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/70 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
      }`;
    }
    const icon = typeof btn.querySelector === 'function' ? btn.querySelector('svg, i') : null;
    if (icon && icon.classList) {
      icon.classList.remove(
        ...ALL_THEME_ICON_CLASSES,
        'text-amber-400', 'dark:text-amber-500', 'dark:text-amber-400', 'dark:text-amber-600',
        'text-violet-400', 'dark:text-violet-400', 'dark:text-violet-600',
        'text-sky-400', 'dark:text-sky-400', 'dark:text-sky-600',
        'text-indigo-400', 'dark:text-indigo-400', 'dark:text-indigo-600',
        'text-emerald-400', 'dark:text-emerald-400', 'dark:text-emerald-600',
        'text-rose-400', 'dark:text-rose-400', 'dark:text-rose-600',
        'text-cyan-400', 'dark:text-cyan-400', 'dark:text-cyan-600',
        'text-yellow-400', 'dark:text-yellow-400', 'dark:text-yellow-600',
        'text-red-400', 'dark:text-red-400', 'dark:text-red-600',
        'text-blue-400', 'dark:text-blue-400', 'dark:text-blue-600'
      );
      if (isActive && theme.iconActive) {
        theme.iconActive.split(' ').forEach((cls) => cls && icon.classList.add(cls));
      }
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
 * Helper to validate Google Drive URL or File ID
 */
function isValidGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /open\?id=([a-zA-Z0-9_-]+)/,
    /uc\?.*id=([a-zA-Z0-9_-]+)/
  ];
  for (const regex of patterns) {
    if (regex.test(clean)) return true;
  }
  return /^[a-zA-Z0-9_-]{25,50}$/.test(clean);
}

/**
 * Binds dropzone event handlers or specialized workspace interactions
 */
function bindDropzone(qm) {
  const rootEl = document.getElementById('pdfDropzoneContainer');
  if (!rootEl) return;

  const dropzone = rootEl.querySelector('#pdfDropzone');
  const fileInput = rootEl.querySelector('#pdfDropzone_input');
  const driveCard = rootEl.querySelector('#pdfDriveImportCard');
  const inputDrive = rootEl.querySelector('#inputPdfDriveLink');

  const setCardGreen = (card) => {
    if (!card) return;
    card.classList.remove('border-red-500/80', 'dark:border-red-500/70', 'border-red-500');
    card.classList.add('border-emerald-500', 'dark:border-emerald-500');
  };

  const setCardRed = (card) => {
    if (!card) return;
    card.classList.remove('border-emerald-500', 'dark:border-emerald-500');
    card.classList.add('border-red-500/80', 'dark:border-red-500/70');
  };

  // 1. File Dropzone events (separate compact box)
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput && !e.target.closest('button')) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        setCardGreen(dropzone);
        qm.addFiles(e.target.files);
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        setCardGreen(dropzone);
      });
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!dropzone.contains(e.relatedTarget)) {
        setCardRed(dropzone);
      }
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      setCardGreen(dropzone);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        qm.addFiles(e.dataTransfer.files);
      }
    });
  }

  const btnPasteImage = rootEl.querySelector('#btnPastePdfImage');
  if (btnPasteImage) {
    btnPasteImage.addEventListener('click', (e) => {
      e.stopPropagation();
      pasteImageFromClipboard(qm);
    });
  }

  // 2. Separate Google Drive Card: Reactive dashed border & Instant Auto-Import on Paste / Link Entry
  if (driveCard && inputDrive) {
    let isImporting = false;
    const spinner = rootEl.querySelector('#pdfDriveSpinner');
    const driveIcon = rootEl.querySelector('#pdfDriveIcon');
    const btnPasteDrive = rootEl.querySelector('#btnPastePdfDrive');

    const setImportingUi = (loading) => {
      isImporting = loading;
      if (inputDrive) inputDrive.disabled = loading;
      if (btnPasteDrive) {
        btnPasteDrive.disabled = loading;
        btnPasteDrive.classList.toggle('opacity-50', loading);
        btnPasteDrive.classList.toggle('pointer-events-none', loading);
      }
      if (spinner) spinner.classList.toggle('hidden', !loading);
      if (driveIcon) driveIcon.classList.toggle('opacity-40', loading);
      if (window.lucide?.createIcons) window.lucide.createIcons();
    };

    const doAutoImport = async (targetUrl) => {
      const url = (targetUrl !== undefined ? targetUrl : inputDrive.value).trim();
      if (!url || isImporting) return;

      if (!isValidGoogleDriveUrl(url)) {
        setCardRed(driveCard);
        inputDrive.classList.remove('focus:ring-emerald-500/50', 'border-emerald-500/60');
        inputDrive.classList.add('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
        showToast('Định dạng liên kết Google Drive không hợp lệ', 'warning');
        return;
      }

      setCardGreen(driveCard);
      inputDrive.classList.remove('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
      inputDrive.classList.add('focus:ring-emerald-500/50', 'border-emerald-500/60');
      setImportingUi(true);

      const success = await qm.importFromDrive(url);
      if (!success) {
        setImportingUi(false);
        const curInput = document.getElementById('inputPdfDriveLink');
        const curCard = document.getElementById('pdfDriveImportCard');
        if (curInput) {
          curInput.value = url;
          if (curCard) {
            if (isValidGoogleDriveUrl(url)) {
              setCardGreen(curCard);
            } else {
              setCardRed(curCard);
            }
          }
        }
      }
    };

    const updateDriveBorder = () => {
      if (isImporting) return;
      const url = inputDrive.value.trim();
      if (isValidGoogleDriveUrl(url)) {
        setCardGreen(driveCard);
        inputDrive.classList.remove('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
        inputDrive.classList.add('focus:ring-emerald-500/50', 'border-emerald-500/60');
      } else {
        setCardRed(driveCard);
        inputDrive.classList.remove('focus:ring-emerald-500/50', 'border-emerald-500/60');
        inputDrive.classList.add('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
      }
    };

    updateDriveBorder();

    // Auto-import when user pastes via Ctrl+V or Context Menu
    inputDrive.addEventListener('paste', (e) => {
      if (isImporting) return;
      const pasted = e.clipboardData?.getData('text') || '';
      setTimeout(() => {
        const val = (pasted || inputDrive.value).trim();
        updateDriveBorder();
        if (isValidGoogleDriveUrl(val)) {
          doAutoImport(val);
        }
      }, 20);
    });

    // Auto-import when complete valid Google Drive URL is typed or dragged into input
    let debounceTimer = null;
    inputDrive.addEventListener('input', () => {
      updateDriveBorder();
      const val = inputDrive.value.trim();
      if (isValidGoogleDriveUrl(val) && !isImporting) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          doAutoImport(val);
        }, 350);
      }
    });

    inputDrive.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doAutoImport(inputDrive.value.trim());
      }
    });

    if (btnPasteDrive) {
      btnPasteDrive.addEventListener('click', async () => {
        if (isImporting) return;
        try {
          let text = '';
          if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
            text = await navigator.clipboard.readText();
          }
          if (!text) {
            inputDrive.focus();
            showToast('Vui lòng cấp quyền truy cập bộ nhớ tạm hoặc nhấn giữ ô nhập để dán', 'info');
            return;
          }
          inputDrive.value = text.trim();
          updateDriveBorder();
          if (isValidGoogleDriveUrl(inputDrive.value)) {
            showToast('Đang tự động nạp tệp từ liên kết...', 'info');
            await doAutoImport(inputDrive.value);
          } else {
            showToast('Đã dán nội dung, nhưng liên kết Google Drive không hợp lệ', 'warning');
          }
        } catch (err) {
          inputDrive.focus();
          showToast('Không thể đọc bộ nhớ tạm tự động. Vui lòng bấm giữ hoặc nhấn Ctrl+V để dán', 'warning');
        }
      });
    }
  }

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
      card.onclick = (e) => {
        if (e.target.closest('button')) return;
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
      const count = qm.totalPages || qm.files[0]?.pages || qm.organizeOrder.length || 0;
      const order = qm.organizeOrder.length === count && count > 0 ? qm.organizeOrder : Array.from({ length: count }, (_, i) => i);
      const startIdx = (qm.thumbnailPage || 0) * 8;
      const endIdx = Math.min(order.length, startIdx + 8);
      const visibleSlots = order.length > 0 ? order.slice(startIdx, endIdx) : null;
      loadAndRenderOrganizeThumbnails(qm.files[0], (numPages) => qm.setTotalPages(numPages), qm.thumbnailPage, 8, visibleSlots);
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

    rootEl.querySelector('#btnPasteMorePdfImages')?.addEventListener('click', (e) => {
      e.stopPropagation();
      pasteImageFromClipboard(qm);
    });

    const inputMultiDrive = rootEl.querySelector('#inputPdfMultiDriveLink');
    const btnPasteMultiDrive = rootEl.querySelector('#btnPastePdfMultiDrive');
    const multiDriveSpinner = rootEl.querySelector('#pdfMultiDriveSpinner');
    const multiDriveIcon = rootEl.querySelector('#pdfMultiDriveIcon');

    if (inputMultiDrive) {
      let isMultiImporting = false;

      const setMultiImportingUi = (loading) => {
        isMultiImporting = loading;
        inputMultiDrive.disabled = loading;
        if (btnPasteMultiDrive) {
          btnPasteMultiDrive.disabled = loading;
          btnPasteMultiDrive.classList.toggle('opacity-50', loading);
          btnPasteMultiDrive.classList.toggle('pointer-events-none', loading);
        }
        if (multiDriveSpinner) multiDriveSpinner.classList.toggle('hidden', !loading);
        if (multiDriveIcon) multiDriveIcon.classList.toggle('opacity-40', loading);
        if (window.lucide?.createIcons) window.lucide.createIcons();
      };

      const doMultiAutoImport = async (targetUrl) => {
        const url = (targetUrl !== undefined ? targetUrl : inputMultiDrive.value).trim();
        if (!url || isMultiImporting) return;

        if (!isValidGoogleDriveUrl(url)) {
          inputMultiDrive.classList.remove('focus:ring-emerald-500/50', 'border-emerald-500/60');
          inputMultiDrive.classList.add('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
          showToast('Định dạng liên kết Google Drive không hợp lệ', 'warning');
          return;
        }

        setMultiImportingUi(true);
        inputMultiDrive.classList.remove('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
        inputMultiDrive.classList.add('focus:ring-emerald-500/50', 'border-emerald-500/60');

        const success = await qm.importFromDrive(url);
        if (!success) {
          setMultiImportingUi(false);
          const curMultiInput = document.getElementById('inputPdfMultiDriveLink');
          if (curMultiInput) {
            curMultiInput.value = url;
          }
        } else {
          setMultiImportingUi(false);
          inputMultiDrive.value = '';
          inputMultiDrive.classList.remove('focus:ring-emerald-500/50', 'border-emerald-500/60');
          inputMultiDrive.classList.add('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
        }
      };

      let multiDebounceTimer = null;
      inputMultiDrive.addEventListener('input', () => {
        const val = inputMultiDrive.value.trim();
        if (isValidGoogleDriveUrl(val)) {
          inputMultiDrive.classList.remove('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
          inputMultiDrive.classList.add('focus:ring-emerald-500/50', 'border-emerald-500/60');
          if (!isMultiImporting) {
            clearTimeout(multiDebounceTimer);
            multiDebounceTimer = setTimeout(() => {
              doMultiAutoImport(val);
            }, 350);
          }
        } else {
          inputMultiDrive.classList.remove('focus:ring-emerald-500/50', 'border-emerald-500/60');
          inputMultiDrive.classList.add('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
        }
      });

      inputMultiDrive.addEventListener('paste', (e) => {
        if (isMultiImporting) return;
        const pasted = e.clipboardData?.getData('text') || '';
        setTimeout(() => {
          const val = (pasted || inputMultiDrive.value).trim();
          if (isValidGoogleDriveUrl(val)) {
            doMultiAutoImport(val);
          }
        }, 20);
      });

      inputMultiDrive.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doMultiAutoImport(inputMultiDrive.value.trim());
        }
      });

      if (btnPasteMultiDrive) {
        btnPasteMultiDrive.addEventListener('click', async () => {
          if (isMultiImporting) return;
          try {
            let text = '';
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
              text = await navigator.clipboard.readText();
            }
            if (!text) {
              inputMultiDrive.focus();
              showToast('Vui lòng cấp quyền truy cập bộ nhớ tạm hoặc nhấn giữ ô nhập để dán', 'info');
              return;
            }
            inputMultiDrive.value = text.trim();
            if (isValidGoogleDriveUrl(inputMultiDrive.value)) {
              inputMultiDrive.classList.remove('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
              inputMultiDrive.classList.add('focus:ring-emerald-500/50', 'border-emerald-500/60');
              showToast('Đang tự động nạp tệp từ liên kết...', 'info');
              await doMultiAutoImport(inputMultiDrive.value);
            } else {
              inputMultiDrive.classList.remove('focus:ring-emerald-500/50', 'border-emerald-500/60');
              inputMultiDrive.classList.add('focus:ring-zinc-400/40', 'dark:focus:ring-zinc-600/40');
              showToast('Đã dán nội dung, nhưng liên kết Google Drive không hợp lệ', 'warning');
            }
          } catch (err) {
            inputMultiDrive.focus();
            showToast('Không thể đọc bộ nhớ tạm tự động. Vui lòng bấm giữ hoặc nhấn Ctrl+V để dán', 'warning');
          }
        });
      }
    }

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

    // Synchronously paint cached cover bitmap with 0ms latency
    restoreThumbnailsSynchronously(rootEl, qm.files[0]);

    // Render cover page thumbnail on single-file preview canvas
    const coverCanvas = rootEl.querySelector('#pdfSingleCoverCanvas_0:not([data-rendered="true"])');
    if (coverCanvas && qm.files[0]) {
      renderWorkspaceThumbnails({
        file: qm.files[0],
        onDocLoaded: (numPages) => qm.setTotalPages(numPages),
        pageIndex: 0,
        pageSize: 1,
        idPrefix: 'pdfSingleCover'
      });
    }

    // Wire lightbox preview button for cover thumbnail
    rootEl.querySelectorAll('.btn-preview-page').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pIdx = Number(btn.dataset.previewPage || 0);
        openPdfPageLightbox(qm.files[0], pIdx);
      };
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
  const isVisual = (state.mode === 'rotate' || state.mode === 'split' || state.mode === 'organize') && hasFiles;

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
  const detachPaste = attachPdfClipboardPaste(queueManager);

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
      const pct = Math.max(0, Math.min(100, Math.round(state.progress || 0)));
      const btnStart = document.getElementById('btnStartProcess');
      if (btnStart && state.isProcessing) {
        btnStart.innerHTML = `
          <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-current"></i>
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
            card.classList.add('border-sky-500', 'dark:border-sky-500', 'bg-sky-500/[0.03]', 'ring-2', 'ring-sky-500/20');
            card.classList.remove('border-zinc-200/80', 'dark:border-white/[0.08]', 'bg-white', 'dark:bg-[#121215]');
          } else {
            card.classList.remove('border-sky-500', 'dark:border-sky-500', 'bg-sky-500/[0.03]', 'ring-2', 'ring-sky-500/20');
            card.classList.add('border-zinc-200/80', 'dark:border-white/[0.08]', 'bg-white', 'dark:bg-[#121215]');
          }

          let badgeRot = card.querySelector('.badge-rot');
          if (deg) {
            if (!badgeRot) {
              badgeRot = document.createElement('div');
              badgeRot.className = 'badge-rot absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-sky-500 text-zinc-950 shadow-xs border border-sky-400 pointer-events-none';
              card.appendChild(badgeRot);
            }
            badgeRot.textContent = `+${deg}°`;
          } else if (badgeRot) {
            badgeRot.remove();
          }

          const badgeRotSub = card.querySelector('.badge-rot-sub');
          if (badgeRotSub) {
            badgeRotSub.textContent = deg ? `${deg}°` : '';
          }
        });
      }

      const summaryEl = document.getElementById('pdfRotatedSummary');
      if (summaryEl) {
        summaryEl.innerHTML = rotatedCount > 0 ? `• Đã xoay <strong class="text-sky-500 font-bold">${rotatedCount}</strong> trang` : '';
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
            card.classList.add('border-amber-500', 'dark:border-amber-500', 'ring-2', 'ring-amber-500', 'bg-amber-500/5', 'dark:bg-amber-500/[0.08]');
            card.classList.remove('border-zinc-200/80', 'dark:border-white/[0.08]');
            if (chkBox) chkBox.className = 'split-chkbox w-6 h-6 rounded-lg flex items-center justify-center transition-all bg-amber-500 text-zinc-950 shadow-sm font-bold scale-105';
            if (statusText) {
              statusText.textContent = 'Đã chọn';
              statusText.className = 'split-status-text font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25';
            }
          } else {
            card.classList.remove('border-amber-500', 'dark:border-amber-500', 'ring-2', 'ring-amber-500', 'bg-amber-500/5', 'dark:bg-amber-500/[0.08]');
            card.classList.add('border-zinc-200/80', 'dark:border-white/[0.08]');
            if (chkBox) chkBox.className = 'split-chkbox w-6 h-6 rounded-lg flex items-center justify-center transition-all bg-white/90 dark:bg-black/60 border border-zinc-300 dark:border-white/20 text-transparent';
            if (statusText) {
              statusText.textContent = '';
              statusText.className = 'split-status-text font-mono text-[10px] text-zinc-400';
            }
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
            errP.className = 'absolute -bottom-4 right-0 text-[10px] font-mono text-red-500 font-semibold truncate';
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
    try { detachPaste(); } catch {}
    closePdfPageLightbox();
    cleanupChainMenuListener();
  };
}
