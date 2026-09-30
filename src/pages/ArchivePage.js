/**
 * ArchivePage Controller (< 220 lines)
 * Zero-Extraction Archive Browser & Nested Archive Explorer.
 * Decoupled from DOM lifecycle via singleton archiveManager for background multitasking.
 */

import { renderArchiveViewer } from '../components/tools/archive/ArchiveWorkspace.js';
import { updateActiveFolderTree } from '../components/tools/archive/components/ArchiveTreePane.js';
import { updateFileTableDOM, attachTableMemberListeners } from '../components/tools/archive/components/FileTablePane.js';
import { attachDropzoneListeners } from '../components/common/Dropzone.js';
import { closeMediaPreview } from '../components/common/MediaPreviewModal.js';
import { ResumableUploader } from '../utilities/resumableUploader.js';
import { archiveManager } from '../components/tools/archive/hooks/useArchive.js';
import {
  renderUploadProgressCard,
  updateUploadProgressUI,
  attachUploadProgressControls
} from '../components/common/UploadProgressCard.js';

export function renderArchivePage() {
  return renderArchiveViewer(archiveManager.getState());
}

export function attachArchivePageListeners(rerender) {
  let isMounted = true;

  const bindControls = () => {
    attachUploadProgressControls({
      getUploader: () => archiveManager.activeUploader,
      onCancel: () => {
        archiveManager.cancelUpload();
        rerender?.();
      }
    });
  };

  // If already uploading when entering the route, attach progress controls
  if (archiveManager.isUploading) {
    bindControls();
  }

  const unsub = archiveManager.subscribe((event, data) => {
    if (!isMounted) return;

    if (event === 'upload-start') {
      const dropzoneHost = document.getElementById('archiveDropzoneHost');
      if (dropzoneHost) {
        dropzoneHost.innerHTML = renderUploadProgressCard(
          archiveManager.uploadTelemetry,
          archiveManager.uploadingFileName,
          archiveManager.uploadStage
        );
        if (window.lucide) window.lucide.createIcons({ root: dropzoneHost });
        bindControls();
      }
      return;
    }

    if (event === 'upload-progress') {
      updateUploadProgressUI(data);
      return;
    }

    if (event === 'upload-stage') {
      const stEl = document.getElementById('uploadStageText');
      if (stEl) stEl.textContent = data;
      if (data && (data.includes('Central Directory') || data.includes('phân tích'))) {
        const cardEl = document.getElementById('uploadProgressCard');
        if (cardEl) {
          const iconEl = cardEl.querySelector('.w-7.h-7');
          if (iconEl) {
            iconEl.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 text-sky-400 animate-spin"></i>';
            if (window.lucide) window.lucide.createIcons({ root: iconEl });
          }
        }
      }
      return;
    }

    if (event === 'folder-select') {
      return;
    }

    rerender?.();
  });

  attachDropzoneListeners('archiveDropzone', (files) => {
    if (files?.length) archiveManager.startUpload(files[0]);
  });

  const resumeInput = document.getElementById('archiveResumeFileInput');
  if (resumeInput) {
    resumeInput.onchange = (e) => {
      const f = e.target.files?.[0];
      const cp = ResumableUploader.getCheckpoint();
      if (f && cp) archiveManager.startUpload(f, cp);
    };
  }

  const btnDismissCp = document.getElementById('btnDismissCheckpoint');
  if (btnDismissCp) {
    btnDismissCp.onclick = () => {
      archiveManager.dismissCheckpoint();
      rerender?.();
    };
  }

  function bindMembers() {
    attachTableMemberListeners({
      archiveState: archiveManager.getState(),
      persistArchive: () => archiveManager.persist(),
      rerender
    });
  }

  function selectFolder(p) {
    if (!archiveManager.archiveData || !p) return;
    const currentScrollY = window.scrollY;
    archiveManager.selectFolder(p);

    updateActiveFolderTree(p);
    updateFileTableDOM(archiveManager.archiveData.currentFiles, archiveManager.archiveData, p);
    bindMembers();
    if (window.lucide) window.lucide.createIcons();

    if (window.scrollY !== currentScrollY) {
      window.scrollTo({ top: currentScrollY, behavior: 'instant' });
    }
  }

  document.querySelectorAll('.btn-folder-select').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      selectFolder(btn.getAttribute('data-folder-path'));
    };
  });

  bindMembers();

  const btnBack = document.getElementById('btnBackParentArchive');
  if (btnBack) {
    btnBack.onclick = () => {
      archiveManager.popArchiveStack();
      rerender?.();
    };
  }

  const triggerChangeArchive = () => {
    archiveManager.changeArchive();
    rerender?.();
  };

  const btnChange = document.getElementById('btnChangeArchive');
  if (btnChange) btnChange.onclick = triggerChangeArchive;
  const btnTopChange = document.getElementById('btnTopChangeArchive');
  if (btnTopChange) btnTopChange.onclick = triggerChangeArchive;

  const btnDismissErr = document.getElementById('btnDismissArchiveError');
  if (btnDismissErr) {
    btnDismissErr.onclick = () => {
      archiveManager.dismissError();
      rerender?.();
    };
  }

  return () => {
    isMounted = false;
    unsub();
    closeMediaPreview();
  };
}
