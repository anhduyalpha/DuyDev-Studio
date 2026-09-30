/**
 * ArchiveCompressWorkspace Component (< 180 lines)
 * Dedicated Multi-Format Archive Compressor Workspace (#server-archive)
 * Decoupled from DOM via archiveCompressManager for multitasking.
 */

import { renderArchiveCompressPane } from './components/ArchiveCompressPane.js';
import { renderResetStateButton } from '../../../utilities/moduleState.js';
import { attachDropzoneListeners } from '../../common/Dropzone.js';
import { archiveCompressManager } from './hooks/useArchiveCompressManager.js';
import { showToast } from '../../../utilities/toast.js';
import { storage } from '../../../utilities/storage.js';

export function renderArchiveCompressWorkspace(state = archiveCompressManager.getState()) {
  return `
    <div class="space-y-6 animate-fadeIn">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#dashboard" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Nén Tệp</span>
        </div>

        <div class="flex items-center gap-2">
          ${renderResetStateButton('archive_compress')}
        </div>
      </div>

      ${state.error ? `
        <div class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-2.5">
            <i data-lucide="alert-circle" class="w-5 h-5 text-red-500 shrink-0"></i>
            <span>${state.error}</span>
          </div>
          <button id="btnDismissCompressError" class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      ` : ''}

      ${renderArchiveCompressPane(state)}
    </div>
  `.trim();
}

export function attachArchiveCompressListeners(rerender) {
  let isMounted = true;

  const unsub = archiveCompressManager.subscribe((event) => {
    if (!isMounted) return;

    if (event === 'compress-stage') {
      const stageEl = document.getElementById('compressStageText');
      if (stageEl) stageEl.textContent = archiveCompressManager.stage;
      return;
    }

    rerender?.();
  });

  attachDropzoneListeners('archiveCompressDropzone', (newFiles) => {
    archiveCompressManager.addFiles(newFiles);
    rerender?.();
  });

  document.querySelectorAll('.btn-remove-compress-file').forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0', 10);
      archiveCompressManager.removeFile(idx);
      rerender?.();
    };
  });

  const btnClear = document.getElementById('btnClearCompressFiles');
  if (btnClear) {
    btnClear.onclick = () => {
      archiveCompressManager.clearFiles();
      rerender?.();
    };
  }

  const inputName = document.getElementById('inputCompressName');
  if (inputName) {
    inputName.addEventListener('input', (e) => {
      archiveCompressManager.setArchiveName(e.target.value);
    });
  }

  const selectFormat = document.getElementById('selectCompressFormat');
  if (selectFormat) {
    selectFormat.addEventListener('change', (e) => {
      archiveCompressManager.setFormat(e.target.value);
    });
  }

  const selectLevel = document.getElementById('selectCompressLevel');
  if (selectLevel) {
    selectLevel.addEventListener('change', (e) => {
      archiveCompressManager.setCompressionLevel(e.target.value);
    });
  }

  const btnDismissErr = document.getElementById('btnDismissCompressError');
  if (btnDismissErr) {
    btnDismissErr.onclick = () => {
      archiveCompressManager.dismissError();
      rerender?.();
    };
  }

  const btnRun = document.getElementById('btnRunCompress');
  if (btnRun) {
    btnRun.onclick = async () => {
      await archiveCompressManager.startCompress();
    };
  }

  const btnTrash = document.getElementById('btnTrashCompressResult');
  if (btnTrash) {
    btnTrash.onclick = async () => {
      const res = archiveCompressManager.result;
      if (res?.historyId) {
        await storage.moveToTrash(res.historyId);
      }
      showToast('Đã chuyển tệp vào thùng rác', 'info');
      archiveCompressManager.resetResult();
      rerender?.();
    };
  }

  const btnReset = document.getElementById('btnResetCompress');
  if (btnReset) {
    btnReset.onclick = () => {
      archiveCompressManager.resetResult();
      rerender?.();
    };
  }

  return () => {
    isMounted = false;
    unsub();
  };
}
