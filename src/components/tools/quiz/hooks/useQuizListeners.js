/**
 * useQuizListeners Hook (< 210 lines)
 * Event delegation and selective DOM state updates for Quiz Generator.
 * Adheres to Rule 1 (Explicit resource cleanup) and Rule 3 (Minimalism).
 */

import { quizManager, isValidDriveUrl } from './useQuiz.js';
import { renderQuizConfigPanel } from '../components/QuizConfigPanel.js';
import { renderQuizResultCard } from '../components/QuizResultCard.js';
import {
  renderQuizHistoryList,
  setQuizHistoryTab,
  getQuizHistoryTab,
  toggleQuizDropbox,
  toggleQuizHistoryBox
} from '../components/QuizHistoryList.js';
import {
  moveQuizPairToTrash,
  restoreQuizPairFromTrash,
  deleteQuizPairPermanently,
  moveAllQuizPairsToTrash,
  restoreAllQuizPairsFromTrash,
  emptyQuizTrashPermanently
} from '../utilities/quizHistoryHelper.js';
import { showToast } from '../../../../utilities/toast.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';
import { openSlideConfirmModal } from '../../../common/SlideConfirmModal.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export function getCuteQuizProgressQuote(pct, rawStage) {
  if (rawStage && rawStage.trim()) {
    return rawStage.trim();
  }

  // Fallback status based on percentage
  if (pct < 15) return 'Đang khởi tạo pipeline và kiểm tra tài liệu nguồn...';
  if (pct < 30) return 'Đang phân tích cấu trúc trang và trích xuất câu hỏi...';
  if (pct < 50) return 'Đang bóc tách đề bài, phân loại phương án lựa chọn...';
  if (pct < 65) return 'Đang phân tích công thức, hình ảnh và sinh lời giải chi tiết...';
  if (pct < 80) return 'Đang chuẩn hóa LaTeX và kiểm tra đối chiếu dữ liệu...';
  if (pct < 95) return 'Đang dàn trang A4 chuẩn Paged Media và xuất PDF...';
  if (pct < 100) return 'Đang hoàn tất đóng gói bộ tài liệu đề bài và lời giải...';
  return 'Đã hoàn tất biên soạn bộ đề bài và đáp án.';
}

export function attachQuizListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();

  const root = document.getElementById('quizWorkspaceRoot');
  if (!root) return () => {};

  let isTornDown = false;

  function syncGenerateButton() {
    try {
      const state = quizManager.getState();
      const btnGen = document.getElementById('btnQuizGenerate');
      if (!btnGen) return;

      const driveInput = document.getElementById('quizDriveInput');
      const pagesInput = document.getElementById('quizPagesInput');
      const prefixInput = document.getElementById('quizPrefixInput');

      const domDrive = driveInput ? driveInput.value.trim() : '';
      const isDriveValid = isValidDriveUrl(domDrive || state.gdriveUrl);
      const isSourceReady = Boolean(state.file?.status === 'ready') || isDriveValid;

      const domPages = pagesInput ? pagesInput.value.trim() : '';
      const effectivePages = domPages || state.pages?.trim() || '';
      const hasPages = Boolean(effectivePages);

      const domPrefix = prefixInput ? prefixInput.value.trim() : '';
      const effectivePrefix = domPrefix || state.prefix?.trim() || '';
      const hasPrefix = Boolean(effectivePrefix);

      const isReady = isSourceReady && hasPages && hasPrefix && !state.isProcessing;

      btnGen.disabled = !isReady;
      if (isReady) {
        btnGen.classList.remove(
          'bg-zinc-100', 'dark:bg-zinc-900',
          'text-zinc-400', 'dark:text-zinc-600',
          'border', 'border-zinc-200', 'dark:border-zinc-800/80',
          'cursor-not-allowed',
          'bg-zinc-900', 'text-zinc-600', 'border-zinc-800/80'
        );
        btnGen.classList.add(
          'bg-zinc-900', 'hover:bg-zinc-800',
          'dark:bg-zinc-100', 'dark:hover:bg-white',
          'text-white', 'dark:text-zinc-950',
          'cursor-pointer'
        );
      } else {
        btnGen.classList.remove(
          'bg-zinc-900', 'hover:bg-zinc-800',
          'dark:bg-zinc-100', 'dark:hover:bg-white',
          'text-white', 'dark:text-zinc-950',
          'cursor-pointer'
        );
        btnGen.classList.add(
          'bg-zinc-100', 'dark:bg-zinc-900',
          'text-zinc-400', 'dark:text-zinc-600',
          'border', 'border-zinc-200', 'dark:border-zinc-800/80',
          'cursor-not-allowed'
        );
      }
    } catch (err) {
      console.warn('syncGenerateButton warning:', err);
    }
  }

  function syncValidationUI() {
    try {
      const state = quizManager.getState();
      const isFileReady = state.file?.status === 'ready';
      const driveInput = document.getElementById('quizDriveInput');
      const pagesInput = document.getElementById('quizPagesInput');
      const prefixInput = document.getElementById('quizPrefixInput');

      const domDrive = driveInput ? driveInput.value.trim() : '';
      const isDriveValid = isValidDriveUrl(domDrive || state.gdriveUrl);
      const isSourceReady = isFileReady || isDriveValid;

      const domPages = pagesInput ? pagesInput.value.trim() : '';
      const effectivePages = domPages || state.pages?.trim() || '';
      const hasPages = Boolean(effectivePages);
      if (domPages && state.pages !== domPages) {
        quizManager.state.pages = domPages;
      }

      const domPrefix = prefixInput ? prefixInput.value.trim() : '';
      const effectivePrefix = domPrefix || state.prefix?.trim() || '';
      const hasPrefix = Boolean(effectivePrefix);
      if (domPrefix && state.prefix !== domPrefix) {
        quizManager.state.prefix = domPrefix;
      }

      // 1. Source validation & badge
      const srcStatus = document.getElementById('quizSourceStatus');
      const dropzone = document.getElementById('quizDropzone');
      if (srcStatus) {
        if (isSourceReady) {
          srcStatus.innerHTML = '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="check" class="w-2.5 h-2.5"></i> Hợp lệ</span>';
          if (dropzone && !state.file) {
            dropzone.classList.remove('border-rose-500/30', 'hover:border-rose-500/50', 'bg-rose-50/50', 'dark:bg-rose-950/5');
            dropzone.classList.add('border-zinc-300', 'dark:border-zinc-800', 'hover:border-zinc-400', 'dark:hover:border-zinc-600', 'bg-zinc-50/50', 'dark:bg-zinc-950/40');
          }
          if (driveInput) {
            if (isDriveValid) {
              driveInput.classList.remove('border-dashed', 'border-rose-500/20', 'focus:border-rose-500/50', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600', 'border-rose-500/40', 'hover:border-rose-500/60', 'focus:border-rose-500', 'bg-rose-50/50', 'dark:bg-rose-950/5');
              driveInput.classList.add('border-solid', 'border-emerald-500/40', 'focus:border-emerald-500');
            } else {
              driveInput.classList.remove('border-dashed', 'border-rose-500/20', 'focus:border-rose-500/50', 'border-emerald-500/40', 'focus:border-emerald-500', 'border-rose-500/40', 'hover:border-rose-500/60', 'focus:border-rose-500', 'bg-rose-50/50', 'dark:bg-rose-950/5');
              driveInput.classList.add('border-solid', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600');
            }
          }
        } else {
          srcStatus.innerHTML = '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">Bắt buộc</span>';
          if (dropzone && !state.file) {
            dropzone.classList.remove('border-zinc-300', 'dark:border-zinc-800', 'hover:border-zinc-400', 'dark:hover:border-zinc-600', 'bg-zinc-50/50', 'dark:bg-zinc-950/40');
            dropzone.classList.add('border-rose-500/30', 'hover:border-rose-500/50', 'bg-rose-50/50', 'dark:bg-rose-950/5');
          }
          if (driveInput) {
            driveInput.classList.remove('border-solid', 'border-emerald-500/40', 'focus:border-emerald-500', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600', 'border-rose-500/20', 'focus:border-rose-500/50');
            driveInput.classList.add('border-dashed', 'border-rose-500/40', 'hover:border-rose-500/60', 'focus:border-rose-500', 'bg-rose-50/50', 'dark:bg-rose-950/5');
          }
        }
      }

      // 2. Pages validation & badge
      const pagesStatus = document.getElementById('quizPagesStatus');
      if (pagesStatus && pagesInput) {
        if (hasPages) {
          pagesStatus.innerHTML = `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="check" class="w-2.5 h-2.5"></i> Trang ${escapeHtml(effectivePages)}</span>`;
          pagesInput.classList.remove('border-rose-500/40', 'focus:border-rose-500', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600');
          pagesInput.classList.add('border-emerald-500/40', 'focus:border-emerald-500');
        } else {
          pagesStatus.innerHTML = '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">Bắt buộc</span>';
          pagesInput.classList.remove('border-emerald-500/40', 'focus:border-emerald-500', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600');
          pagesInput.classList.add('border-rose-500/40', 'focus:border-rose-500');
        }
      }

      // 3. Prefix validation & badge
      const prefixStatus = document.getElementById('quizPrefixStatus');
      if (prefixStatus && prefixInput) {
        if (hasPrefix) {
          prefixStatus.innerHTML = '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1"><i data-lucide="check" class="w-2.5 h-2.5"></i> Hợp lệ</span>';
          prefixInput.classList.remove('border-rose-500/40', 'focus:border-rose-500', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600');
          prefixInput.classList.add('border-emerald-500/40', 'focus:border-emerald-500');
        } else {
          prefixStatus.innerHTML = '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">Bắt buộc</span>';
          prefixInput.classList.remove('border-emerald-500/40', 'focus:border-emerald-500', 'border-zinc-300', 'dark:border-zinc-800', 'focus:border-zinc-500', 'dark:focus:border-zinc-600');
          prefixInput.classList.add('border-rose-500/40', 'focus:border-rose-500');
        }
      }

      if (window.lucide?.createIcons) window.lucide.createIcons();
      syncGenerateButton();
    } catch (err) {
      console.warn('syncValidationUI warning:', err);
    }
  }

  // Selective re-rendering helper
  function updateDom(event) {
    if (isTornDown) return;

    const configEl = document.getElementById('quizConfigContainer');
    const resultEl = document.getElementById('quizResultContainer');
    const state = quizManager.getState();

    // In-place validation update for parameter / prompt changes without replacing DOM
    if (event === 'params-changed' || event === 'gdrive-changed') {
      syncValidationUI();
      return;
    }

    // In-place DOM update for continuous progress or status updates while processing to prevent box flickering
    if (event === 'job-progress' || event === 'job-enqueued') {
      const progressText = document.getElementById('quizProgressText');
      const progressStage = document.getElementById('quizProgressStage');
      const progressBar = document.getElementById('quizProgressBar');
      if (progressText && progressStage && progressBar) {
        const pct = Math.max(5, Math.min(100, state.progress || 0));
        progressText.textContent = `${pct}%`;
        progressStage.textContent = getCuteQuizProgressQuote(pct, state.stage);
        progressBar.style.width = `${pct}%`;
        syncGenerateButton();
        return;
      }
    }

    // Preserve active focus and cursor position
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const selStart = activeEl && 'selectionStart' in activeEl ? activeEl.selectionStart : null;
    const selEnd = activeEl && 'selectionEnd' in activeEl ? activeEl.selectionEnd : null;

    const reRenderEvents = [
      'file-selected',
      'file-uploaded',
      'file-cleared',
      'file-upload-error',
      'source-ready',
      'step-changed',
      'prompt-analyzing',
      'prompt-parsed',
      'prompt-analysis-finished',
      'job-started',
      'job-completed',
      'job-cancelled',
      'job-error',
      'result-cleared',
      'error-cleared'
    ];

    if (configEl) {
      if (state.isProcessing || state.result) {
        configEl.classList.add('hidden');
        configEl.innerHTML = '';
      } else {
        configEl.classList.remove('hidden');
        if (reRenderEvents.includes(event)) {
          configEl.innerHTML = renderQuizConfigPanel(state);
          attachConfigHandlers();
        } else {
          syncGenerateButton();
        }
      }
    }

    if (resultEl) {
      resultEl.innerHTML = renderQuizResultCard(state);
      attachResultHandlers();
    }

    if (event === 'job-completed') {
      renderAndBindHistory();
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        document.getElementById('quizResultContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (window.lucide?.createIcons) window.lucide.createIcons();

    // Restore focus if element still exists
    if (activeId) {
      const restored = document.getElementById(activeId);
      if (restored && typeof restored.focus === 'function') {
        restored.focus();
        if (selStart !== null && selEnd !== null && 'setSelectionRange' in restored) {
          try { restored.setSelectionRange(selStart, selEnd); } catch (_) {}
        }
      }
    }
  }

  // Subscribe to state manager
  const unsubscribe = quizManager.subscribe((_, event) => {
    updateDom(event);
  });

  // Attach Config Panel Handlers
  function attachConfigHandlers() {
    // Dropzone & File Input
    const dropzone = document.getElementById('quizDropzone');
    const fileInput = document.getElementById('quizFileInput');
    const btnChangeFile = document.getElementById('btnQuizChangeFile');

    if (dropzone && fileInput) {
      dropzone.onclick = (e) => {
        if (e.target.closest('#btnQuizChangeFile')) return;
        fileInput.click();
      };

      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) quizManager.setFile(file);
      };

      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('border-zinc-400', 'dark:border-zinc-500', 'bg-zinc-100/80', 'dark:bg-zinc-900/60');
      };

      dropzone.ondragleave = () => {
        dropzone.classList.remove('border-zinc-400', 'dark:border-zinc-500', 'bg-zinc-100/80', 'dark:bg-zinc-900/60');
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-zinc-400', 'dark:border-zinc-500', 'bg-zinc-100/80', 'dark:bg-zinc-900/60');
        const file = e.dataTransfer?.files?.[0];
        if (file) quizManager.setFile(file);
      };
    }

    if (btnChangeFile && fileInput) {
      btnChangeFile.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
      };
    }

    const btnChangeSource = document.getElementById('btnQuizChangeSource');
    if (btnChangeSource) {
      btnChangeSource.onclick = (e) => {
        e.stopPropagation();
        quizManager.clearSource();
      };
    }

    // Google Drive Input
    const driveInput = document.getElementById('quizDriveInput');
    if (driveInput) {
      const handleDrive = () => {
        quizManager.setGdriveUrl(driveInput.value);
        syncValidationUI();
      };
      ['input', 'change', 'paste', 'keyup', 'blur'].forEach((evt) => {
        driveInput.addEventListener(evt, handleDrive);
      });
    }

    // Prompt Box
    const promptInput = document.getElementById('quizPromptInput');
    const btnParsePrompt = document.getElementById('btnQuizParsePrompt');
    if (btnParsePrompt && promptInput) {
      const triggerParse = () => {
        const dInput = document.getElementById('quizDriveInput');
        if (dInput && dInput.value.trim() && !quizManager.state.gdriveUrl) {
          quizManager.setGdriveUrl(dInput.value);
        }
        quizManager.parsePrompt(promptInput.value);
      };
      btnParsePrompt.onclick = triggerParse;
      promptInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerParse();
        }
      };
    }

    const btnSkipPrompt = document.getElementById('btnQuizSkipPrompt');
    if (btnSkipPrompt) {
      btnSkipPrompt.onclick = () => quizManager.skipToManualParams();
    }

    // Helper to bind all input/interaction events to handle autocomplete, paste, IME, and typing
    const bindInputEvents = (el, handler) => {
      if (!el) return;
      ['input', 'change', 'paste', 'keyup', 'blur', 'compositionend'].forEach((evt) => {
        el.addEventListener(evt, handler);
      });
    };

    // Parameters
    const pagesInput = document.getElementById('quizPagesInput');
    if (pagesInput) {
      const handlePages = () => {
        const val = pagesInput.value.trim();
        quizManager.setParams({ pages: val });
        syncValidationUI();
      };
      bindInputEvents(pagesInput, handlePages);
    }

    const startInput = document.getElementById('quizStartInput');
    if (startInput) {
      const handleStart = () => {
        const val = parseInt(startInput.value, 10);
        if (!isNaN(val) && val > 0) {
          quizManager.setParams({ start: val });
        }
        syncValidationUI();
      };
      bindInputEvents(startInput, handleStart);
    }

    const prefixInput = document.getElementById('quizPrefixInput');
    if (prefixInput) {
      const handlePrefix = () => {
        const val = prefixInput.value.trim();
        quizManager.setParams({ prefix: val });
        syncValidationUI();
      };
      bindInputEvents(prefixInput, handlePrefix);
    }

    const titleInput = document.getElementById('quizTitleInput');
    if (titleInput) {
      const handleTitle = () => {
        quizManager.setParams({ title: titleInput.value.trim() });
      };
      bindInputEvents(titleInput, handleTitle);
    }


    // Question Count Input
    const countInput = document.getElementById('quizCountInput');
    if (countInput) {
      const handleCount = () => {
        const val = parseInt(countInput.value, 10);
        if (!isNaN(val) && val > 0) {
          quizManager.setParams({ count: val });
        }
        syncValidationUI();
      };
      bindInputEvents(countInput, handleCount);
    }

    // Primary Action Button
    const btnGen = document.getElementById('btnQuizGenerate');
    if (btnGen) {
      const preFlightSync = () => {
        syncValidationUI();
      };
      ['mouseenter', 'pointerenter', 'touchstart', 'focus'].forEach((evt) => {
        btnGen.addEventListener(evt, preFlightSync);
      });
      btnGen.onclick = (e) => {
        e.preventDefault();
        syncValidationUI();
        if (!btnGen.disabled) {
          quizManager.startGeneration();
        }
      };
    }

    syncValidationUI();
  }

  // Attach Result Handlers
  function attachResultHandlers() {
    const btnCancel = document.getElementById('btnQuizCancelJob');
    if (btnCancel) {
      btnCancel.onclick = () => quizManager.cancelJob();
    }

    const resetButtons = document.querySelectorAll('.btn-quiz-reset, #btnQuizReset');
    resetButtons.forEach((btn) => {
      btn.onclick = () => {
        const state = quizManager.getState();
        if (state.result) {
          quizManager.resetForNewDocument();
        } else {
          quizManager.clearError();
        }
      };
    });

    // Preview buttons
    const previewBtns = document.querySelectorAll('.btn-quiz-preview');
    previewBtns.forEach((btn) => {
      btn.onclick = () => {
        const fileId = btn.dataset.fileId;
        const fileName = btn.dataset.fileName;
        const viewUrl = btn.dataset.viewUrl;
        const downloadUrl = btn.dataset.downloadUrl;
        if ((fileId && fileId !== 'undefined') || viewUrl) {
          ViewerConnector.preview({
            id: fileId || fileName,
            fileId: fileId,
            name: fileName,
            fileName: fileName,
            mimeType: 'application/pdf',
            viewUrl: viewUrl || `/api/v1/files/view/${fileId}`,
            downloadUrl: downloadUrl || `/api/v1/files/download/${fileId}`
          });
        }
      };
    });

    // Native APK and browser download buttons
    const downloadBtns = document.querySelectorAll('.btn-quiz-download');
    downloadBtns.forEach((btn) => {
      btn.onclick = (e) => handleQuizDownload(e, btn);
    });
  }

  // Unified download dispatcher for result card and history list
  function handleQuizDownload(e, btn) {
    const fileUrl = btn.dataset.fileUrl || btn.getAttribute('href');
    const fileName = btn.dataset.fileName || btn.getAttribute('download') || 'quiz_document.pdf';
    const mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

    if (window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
      e.preventDefault();
      try {
        window.AndroidBridge.downloadFile(fileUrl, fileName, mimeType);
        return;
      } catch (err) {
        console.warn('AndroidBridge.downloadFile failed, fallback to native navigation', err);
        window.location.href = fileUrl;
        return;
      }
    }
  }

  // Attach History & Trash Handlers
  function attachHistoryHandlers() {
    // 0. Master Dropbox Box Toggle
    const btnToggleMasterBox = document.getElementById('btnToggleQuizHistoryBox');
    if (btnToggleMasterBox) {
      btnToggleMasterBox.onclick = () => {
        toggleQuizHistoryBox();
        renderAndBindHistory();
      };
    }

    // 1. Tab Switching (Lịch sử vs Thùng rác)
    const btnTabHistory = document.getElementById('btnQuizTabHistory');
    if (btnTabHistory) {
      btnTabHistory.onclick = () => {
        setQuizHistoryTab('history');
        renderAndBindHistory();
      };
    }

    const btnTabTrash = document.getElementById('btnQuizTabTrash');
    if (btnTabTrash) {
      btnTabTrash.onclick = () => {
        setQuizHistoryTab('trash');
        renderAndBindHistory();
      };
    }

    // 2. Dropbox Accordion Toggle (Click on Header expands/collapses 2-column files)
    const dropboxHeaders = document.querySelectorAll('.quiz-dropbox-header');
    dropboxHeaders.forEach((header) => {
      header.onclick = (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        const pairId = header.dataset.pairId;
        if (pairId) {
          toggleQuizDropbox(pairId);
          renderAndBindHistory();
        }
      };
    });

    // 3. Move Single Pair to Trash (History Tab)
    const trashSingleBtns = document.querySelectorAll('.btn-quiz-trash-single');
    trashSingleBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pairId = btn.dataset.pairId;
        if (pairId) {
          moveQuizPairToTrash(pairId);
          renderAndBindHistory();
          showToast('Đã chuyển bộ đề vào thùng rác', 'success');
        }
      };
    });

    // 4. Restore Single Pair from Trash (Trash Tab)
    const restoreSingleBtns = document.querySelectorAll('.btn-quiz-restore-single');
    restoreSingleBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pairId = btn.dataset.pairId;
        if (pairId) {
          restoreQuizPairFromTrash(pairId);
          renderAndBindHistory();
          showToast('Đã khôi phục bộ đề về lịch sử', 'success');
        }
      };
    });

    // 5. Permanently Delete Single Pair (Trash Tab)
    const deletePermBtns = document.querySelectorAll('.btn-quiz-delete-perm-single');
    deletePermBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pairId = btn.dataset.pairId;
        if (pairId) {
          deleteQuizPairPermanently(pairId);
          renderAndBindHistory();
          showToast('Đã xóa vĩnh viễn bộ đề', 'success');
        }
      };
    });

    // 6. Global History / Trash Actions
    const btnTrashAll = document.getElementById('btnQuizTrashAll');
    if (btnTrashAll) {
      btnTrashAll.onclick = () => {
        openSlideConfirmModal({
          title: 'Chuyển tất cả vào thùng rác',
          description: 'Chuyển toàn bộ danh sách bộ đề trong lịch sử vào thùng rác.',
          warningText: 'Bạn có thể khôi phục lại từ tab Thùng rác bất cứ lúc nào.',
          actionText: 'Kéo sang phải để chuyển tất cả',
          confirmingText: 'Đang chuyển...',
          onConfirm: () => {
            moveAllQuizPairsToTrash();
            renderAndBindHistory();
            showToast('Đã chuyển tất cả bộ đề vào thùng rác', 'success');
          }
        });
      };
    }

    const btnRestoreAll = document.getElementById('btnQuizRestoreAllTrash');
    if (btnRestoreAll) {
      btnRestoreAll.onclick = () => {
        restoreAllQuizPairsFromTrash();
        renderAndBindHistory();
        showToast('Đã khôi phục tất cả bộ đề về lịch sử', 'success');
      };
    }

    const btnEmptyTrash = document.getElementById('btnQuizEmptyTrash');
    if (btnEmptyTrash) {
      btnEmptyTrash.onclick = () => {
        openSlideConfirmModal({
          title: 'Dọn sạch thùng rác bộ đề',
          description: 'Xóa vĩnh viễn toàn bộ các bộ đề trong thùng rác.',
          warningText: 'Hành động này không thể hoàn tác.',
          actionText: 'Kéo sang phải để xóa vĩnh viễn',
          confirmingText: 'Đang dọn sạch...',
          onConfirm: () => {
            emptyQuizTrashPermanently();
            renderAndBindHistory();
            showToast('Đã dọn sạch thùng rác', 'success');
          }
        });
      };
    }

    // 7. Preview Buttons (Inside expanded Dropbox)
    const historyPreviewBtns = document.querySelectorAll('.btn-quiz-history-preview');
    historyPreviewBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const fileId = btn.dataset.fileId;
        const fileName = btn.dataset.fileName;
        const viewUrl = btn.dataset.viewUrl;
        const downloadUrl = btn.dataset.downloadUrl;
        if (fileId || viewUrl) {
          ViewerConnector.preview({
            id: fileId || fileName,
            fileId: fileId,
            name: fileName,
            fileName: fileName,
            mimeType: 'application/pdf',
            viewUrl: viewUrl || `/api/v1/files/view/${fileId}`,
            downloadUrl: downloadUrl || `/api/v1/files/download/${fileId}`
          });
        }
      };
    });

    // 8. Download Buttons (Inside expanded Dropbox)
    const historyDownloadBtns = document.querySelectorAll('.btn-quiz-history-download');
    historyDownloadBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        handleQuizDownload(e, btn);
      };
    });
  }

  function renderAndBindHistory() {
    const historyEl = document.getElementById('quizHistoryContainer');
    if (historyEl) {
      historyEl.innerHTML = renderQuizHistoryList();
      attachHistoryHandlers();
      if (window.lucide?.createIcons) window.lucide.createIcons();
    }
  }

  // Initial handler binding
  attachConfigHandlers();
  attachResultHandlers();
  attachHistoryHandlers();

  // Root-level delegated listener for global form synchronizations across any dynamic DOM updates or autofills
  const handleDelegatedInteraction = (e) => {
    if (isTornDown) return;
    const target = e.target;
    if (!target) return;
    if (target.id === 'quizPrefixInput' || target.id === 'quizPagesInput' || target.id === 'quizDriveInput') {
      syncValidationUI();
    }
  };

  const delegatedEvents = ['input', 'change', 'paste', 'keyup', 'focusout'];
  delegatedEvents.forEach((evt) => {
    root.addEventListener(evt, handleDelegatedInteraction);
  });

  // Return clean teardown function
  return () => {
    isTornDown = true;
    delegatedEvents.forEach((evt) => {
      root.removeEventListener(evt, handleDelegatedInteraction);
    });
    unsubscribe();
    quizManager.teardown();
  };
}
