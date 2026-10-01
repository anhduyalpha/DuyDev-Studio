/**
 * ArchiveWorkspace Component (< 90 lines)
 * Zero-Extraction Archive Inspector with Resumable Upload Telemetry
 */

import { renderArchiveTreePane } from './components/ArchiveTreePane.js';
import { renderFileTablePane } from './components/FileTablePane.js';
import { renderArchiveHeaderBanner, renderArchiveEmptyDropzone } from './components/MemberModal.js';
import { renderUploadProgressCard, renderResumeCheckpointBanner } from '../../common/UploadProgressCard.js';

export function renderArchiveViewer(state = {}) {
  const {
    archiveData,
    archiveStack = [],
    currentFolder = '/',
    isUploading = false,
    uploadStage = '',
    uploadingFileName = 'Tệp nén',
    uploadTelemetry = {},
    checkpoint = null,
    error = null
  } = state;

  return `
    <div class="space-y-6 animate-fadeIn">
      <!-- Breadcrumb & Actions Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <a href="#dashboard" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06] transition shadow-xs">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Dashboard
          </a>
          <span class="text-zinc-400 dark:text-zinc-600">/</span>
          <span class="text-zinc-900 dark:text-zinc-200 font-semibold">Xem Tệp Nén</span>
        </div>

        <div class="flex items-center gap-2">
          ${archiveData ? `
            <button id="btnTopChangeArchive" type="button" class="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 hover:bg-zinc-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="folder-sync" class="w-3.5 h-3.5"></i>
              <span>Đổi tệp</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${error ? `
        <div class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-2.5">
            <i data-lucide="alert-circle" class="w-5 h-5 text-red-500 shrink-0"></i>
            <span>${error}</span>
          </div>
          <button id="btnDismissArchiveError" class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      ` : ''}

      ${!archiveData ? `
        <div id="archiveDropzoneHost" class="space-y-4">
          ${isUploading ? `
            ${renderUploadProgressCard(uploadTelemetry, uploadingFileName, uploadStage)}
          ` : `
            ${checkpoint ? renderResumeCheckpointBanner(checkpoint) : ''}
            ${renderArchiveEmptyDropzone()}
          `}
        </div>
      ` : `
        ${renderArchiveHeaderBanner(archiveData, archiveStack)}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] overflow-hidden shadow-sm h-[calc(100vh-14.5rem)] min-h-[520px] max-h-[820px]">
          ${renderArchiveTreePane({ folders: archiveData.folders, currentFolder })}
          ${renderFileTablePane({ archiveData, currentFolder })}
        </div>
      `}
    </div>
  `.trim();
}
