/**
 * MemberModal & Archive Header Banners (< 70 lines)
 * Archive header action bar and empty dropzone view
 */

import { renderDropzone } from '../../../common/Dropzone.js';
import { formatBytes } from '../../../../utilities/formatters.js';

export function renderArchiveHeaderBanner(archiveData, archiveStack = []) {
  const hasParent = archiveStack && archiveStack.length > 0;

  return `
    <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center shrink-0">
          <i data-lucide="archive" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-zinc-900 dark:text-white text-base sm:text-lg truncate max-w-md">${archiveData.archiveName}</h3>
            ${hasParent ? `
              <span class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-mono font-semibold shrink-0">
                Tệp nén lồng (${archiveStack.length})
              </span>
            ` : ''}
          </div>
          <p class="text-xs sm:text-sm font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            ${formatBytes(archiveData.totalUncompressedBytes)} • ${archiveData.totalFiles} tệp • ${archiveData.format}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        ${hasParent ? `
          <button id="btnBackParentArchive" type="button" class="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> Quay lại (${archiveStack.length})
          </button>
        ` : ''}
        <button id="btnChangeArchive" type="button" class="px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
          <i data-lucide="folder-sync" class="w-3.5 h-3.5"></i> Đổi tệp
        </button>
        <a href="${archiveData.downloadUrl}" download="${archiveData.archiveName}" class="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm">
          <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về (${formatBytes(archiveData.totalUncompressedBytes)})
        </a>
      </div>
    </div>
  `.trim();
}

export function renderArchiveEmptyDropzone() {
  return `
    <div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] p-6 sm:p-8 space-y-6 shadow-sm">
      ${renderDropzone({
        id: 'archiveDropzone',
        title: 'Kéo thả hoặc tải tệp lên',
        subtitle: 'ZIP, RAR, 7Z, TAR, GZ, TGZ',
        accept: '.zip,.rar,.7z,.tar,.gz,.bz2,.tgz'
      })}
    </div>
  `.trim();
}
