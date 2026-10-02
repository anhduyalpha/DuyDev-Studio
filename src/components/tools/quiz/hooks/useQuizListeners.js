/**
 * useQuizListeners Hook (< 210 lines)
 * Event delegation and selective DOM state updates for Quiz Generator.
 * Adheres to Rule 1 (Explicit resource cleanup) and Rule 3 (Minimalism).
 */

import { quizManager } from './useQuiz.js';
import { renderQuizConfigPanel } from '../components/QuizConfigPanel.js';
import { renderQuizResultCard } from '../components/QuizResultCard.js';
import { ViewerConnector } from '../../../common/viewer/FileViewerConnector.js';

export function attachQuizListeners() {
  if (window.lucide?.createIcons) window.lucide.createIcons();

  const root = document.getElementById('quizWorkspaceRoot');
  if (!root) return () => {};

  let isTornDown = false;

  function syncGenerateButton() {
    const state = quizManager.getState();
    const btnGen = document.getElementById('btnQuizGenerate');
    if (!btnGen) return;

    const isReady = (Boolean(state.file?.status === 'ready') || Boolean(state.gdriveUrl?.trim())) &&
                    Boolean(state.pages?.trim()) &&
                    Boolean(state.prefix?.trim()) &&
                    !state.isProcessing;

    btnGen.disabled = !isReady;
    if (isReady) {
      btnGen.classList.remove('bg-zinc-900', 'text-zinc-600', 'border', 'border-zinc-800/80', 'cursor-not-allowed');
      btnGen.classList.add('bg-zinc-100', 'hover:bg-white', 'text-zinc-950', 'cursor-pointer');
    } else {
      btnGen.classList.add('bg-zinc-900', 'text-zinc-600', 'border', 'border-zinc-800/80', 'cursor-not-allowed');
      btnGen.classList.remove('bg-zinc-100', 'hover:bg-white', 'text-zinc-950', 'cursor-pointer');
    }
  }

  // Selective re-rendering helper
  function updateDom(event) {
    if (isTornDown) return;

    const configEl = document.getElementById('quizConfigContainer');
    const resultEl = document.getElementById('quizResultContainer');
    const state = quizManager.getState();

    // In-place DOM update for continuous progress or status updates while processing to prevent box flickering
    if (event === 'job-progress' || event === 'job-enqueued') {
      const progressText = document.getElementById('quizProgressText');
      const progressStage = document.getElementById('quizProgressStage');
      const progressBar = document.getElementById('quizProgressBar');
      if (progressText && progressStage && progressBar) {
        const pct = Math.max(5, Math.min(100, state.progress || 0));
        progressText.textContent = `${pct}%`;
        progressStage.textContent = state.stage || 'Đang xử lý...';
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

    if (configEl && (event === 'file-selected' || event === 'file-uploaded' || event === 'file-cleared' || event === 'file-upload-error' || event === 'prompt-parsed' || event === 'job-started' || event === 'job-completed' || event === 'job-error')) {
      configEl.innerHTML = renderQuizConfigPanel(state);
      attachConfigHandlers();
    } else {
      syncGenerateButton();
    }

    if (resultEl) {
      resultEl.innerHTML = renderQuizResultCard(state);
      attachResultHandlers();
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
        dropzone.classList.add('border-zinc-500', 'bg-zinc-900/60');
      };

      dropzone.ondragleave = () => {
        dropzone.classList.remove('border-zinc-500', 'bg-zinc-900/60');
      };

      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-zinc-500', 'bg-zinc-900/60');
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

    // Google Drive Input
    const driveInput = document.getElementById('quizDriveInput');
    if (driveInput) {
      driveInput.oninput = (e) => {
        quizManager.setGdriveUrl(e.target.value);
        syncGenerateButton();
      };
    }

    // Prompt Box
    const promptInput = document.getElementById('quizPromptInput');
    const btnParsePrompt = document.getElementById('btnQuizParsePrompt');
    if (btnParsePrompt && promptInput) {
      btnParsePrompt.onclick = () => quizManager.parsePrompt(promptInput.value);
      promptInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          quizManager.parsePrompt(promptInput.value);
        }
      };
    }

    // Parameters
    const pagesInput = document.getElementById('quizPagesInput');
    if (pagesInput) {
      pagesInput.oninput = (e) => {
        quizManager.setParams({ pages: e.target.value });
        syncGenerateButton();
      };
    }

    const startInput = document.getElementById('quizStartInput');
    if (startInput) {
      startInput.onchange = (e) => quizManager.setParams({ start: e.target.value });
    }

    const prefixInput = document.getElementById('quizPrefixInput');
    if (prefixInput) {
      prefixInput.oninput = (e) => {
        quizManager.setParams({ prefix: e.target.value });
        syncGenerateButton();
      };
    }

    const titleInput = document.getElementById('quizTitleInput');
    if (titleInput) {
      titleInput.oninput = (e) => quizManager.setParams({ title: e.target.value });
    }

    // Question Count Input
    const countInput = document.getElementById('quizCountInput');
    if (countInput) {
      countInput.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
          quizManager.setParams({ count: val });
        }
      };
    }

    // Primary Action Button
    const btnGen = document.getElementById('btnQuizGenerate');
    if (btnGen) {
      btnGen.onclick = () => {
        if (!btnGen.disabled) quizManager.startGeneration();
      };
    }

    syncGenerateButton();
  }

  // Attach Result Handlers
  function attachResultHandlers() {
    const btnCancel = document.getElementById('btnQuizCancelJob');
    if (btnCancel) {
      btnCancel.onclick = () => quizManager.cancelJob();
    }

    const btnReset = document.getElementById('btnQuizReset');
    if (btnReset) {
      btnReset.onclick = () => quizManager.clearResult();
    }

    // Preview buttons
    const previewBtns = document.querySelectorAll('.btn-quiz-preview');
    previewBtns.forEach((btn) => {
      btn.onclick = () => {
        const fileId = btn.dataset.fileId;
        const fileName = btn.dataset.fileName;
        if (fileId) {
          ViewerConnector.preview({
            id: fileId,
            fileId: fileId,
            name: fileName,
            fileName: fileName,
            mimeType: 'application/pdf',
            viewUrl: `/api/v1/files/${fileId}/download?inline=true`,
            downloadUrl: `/api/v1/files/${fileId}/download`
          });
        }
      };
    });
  }

  // Initial handler binding
  attachConfigHandlers();
  attachResultHandlers();

  // Return clean teardown function
  return () => {
    isTornDown = true;
    unsubscribe();
    quizManager.teardown();
  };
}
