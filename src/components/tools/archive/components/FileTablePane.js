/**
 * FileTablePane Component
 * File list table with direct streaming download & view actions
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { inspectNestedArchiveFile } from '../hooks/useArchiveInspect.js';
import { openMediaPreview } from '../../../common/MediaPreviewModal.js';
import { showToast } from '../../../../utilities/toast.js';


export function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico', 'avif'].includes(ext)) return 'image';
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'sql', 'sh'].includes(ext)) return 'file-code';
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return 'file-text';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz'].includes(ext) || fileName.endsWith('.tar.gz')) return 'archive';
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'].includes(ext)) return 'music';
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'ogv'].includes(ext)) return 'video';
  return 'file';
}

export function renderFileTableRows(files, archiveData) {
  return files.map((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isNestedArchive = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz'].includes(ext) || file.name.endsWith('.tar.gz');

    return `
      <tr class="archive-file-row hover:bg-zinc-50/90 dark:hover:bg-white/[0.03] transition cursor-pointer"
          data-member-path="${file.rawPath}"
          data-file-name="${file.name}">
        <td class="py-2.5 px-3 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 font-medium min-w-[200px]">
          <div class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0">
            <i data-lucide="${getFileIcon(file.name)}" class="w-4 h-4"></i>
          </div>
          <span class="truncate">${file.name}</span>
        </td>
        <td class="py-2.5 px-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">${formatBytes(file.sizeBytes)}</td>
        <td class="py-2.5 px-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
          ${formatBytes(file.compressedBytes)} (${Math.round(file.compressionRatio * 100)}%)
        </td>
        <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
          <button type="button"
             data-member-path="${file.rawPath}"
             data-file-name="${file.name}"
             class="btn-preview-member px-2.5 py-1 rounded-lg ${
               isNestedArchive
                 ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                 : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 dark:hover:text-white border-zinc-200 dark:border-white/[0.08]'
             } border text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer">
            <i data-lucide="${isNestedArchive ? 'folder-archive' : 'eye'}" class="w-3.5 h-3.5"></i>
            <span>${isNestedArchive ? 'Mở tệp nén' : 'Xem'}</span>
          </button>
          <a href="${archiveData.apiBase}/api/v1/archive/extract-file?fileId=${archiveData.fileId}&memberPath=${encodeURIComponent(file.rawPath)}"
             download="${file.name}"
             onclick="event.stopPropagation()"
             class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-medium text-xs transition shadow-xs inline-flex items-center gap-1">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderFileTablePane({ archiveData, currentFolder }) {
  return `
    <div id="archiveFileTablePane" class="lg:col-span-8 h-full flex flex-col min-h-0 p-4 sm:p-5 relative">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 text-sm text-zinc-600 dark:text-zinc-400 shrink-0">
        <span class="truncate">Thư mục: <strong id="archiveCurrentFolderLabel" class="text-zinc-800 dark:text-zinc-200 font-mono">${currentFolder}</strong> (<span id="archiveFolderFileCount">${archiveData.currentFiles.length}</span> tệp)</span>
      </div>

      <div id="archiveTableEmptyState" class="${archiveData.currentFiles.length === 0 ? 'flex' : 'hidden'} flex-1 items-center justify-center text-center p-10 text-sm text-zinc-400 font-mono border border-dashed border-zinc-200 dark:border-white/[0.06] rounded-xl">
        Không có tệp nào trực tiếp trong thư mục này.
      </div>

      <div id="archiveTableScrollContainer" class="${archiveData.currentFiles.length === 0 ? 'hidden' : 'flex'} flex-1 flex-col min-h-0 overflow-auto custom-scrollbar border border-zinc-200/80 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#121215]">
        <table class="w-full text-left text-sm">
          <thead class="sticky top-0 bg-zinc-50/95 dark:bg-[#16161a]/95 backdrop-blur-xs z-10 border-b border-zinc-200 dark:border-white/[0.06]">
            <tr class="text-zinc-500 dark:text-zinc-400 font-mono text-xs">
              <th class="py-2 px-3 font-medium">Tên tệp</th>
              <th class="py-2 px-3 font-medium">Gốc</th>
              <th class="py-2 px-3 font-medium">Nén còn</th>
              <th class="py-2 px-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody id="archiveFileTableBody" class="divide-y divide-zinc-100 dark:divide-white/[0.05]">
            ${renderFileTableRows(archiveData.currentFiles, archiveData)}
          </tbody>
        </table>
      </div>
    </div>
  `.trim();
}

export function updateFileTableDOM(currentFiles, archiveData, folderPath) {
  const folderLabel = document.getElementById('archiveCurrentFolderLabel');
  if (folderLabel) folderLabel.textContent = folderPath;

  const countLabel = document.getElementById('archiveFolderFileCount');
  if (countLabel) countLabel.textContent = currentFiles.length;

  const emptyState = document.getElementById('archiveTableEmptyState');
  const tableContainer = document.getElementById('archiveTableScrollContainer');
  const tableBody = document.getElementById('archiveFileTableBody');

  if (currentFiles.length === 0) {
    if (emptyState) emptyState.className = 'flex flex-1 items-center justify-center text-center p-10 text-sm text-zinc-400 font-mono border border-dashed border-zinc-200 dark:border-white/[0.06] rounded-xl';
    if (tableContainer) tableContainer.className = 'hidden';
  } else {
    if (emptyState) emptyState.className = 'hidden';
    if (tableContainer) {
      tableContainer.className = 'flex flex-1 flex-col min-h-0 overflow-auto custom-scrollbar border border-zinc-200/80 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#121215]';
    }
    if (tableBody) {
      tableBody.innerHTML = renderFileTableRows(currentFiles, archiveData);
    }
  }
}

export function attachTableMemberListeners({ archiveState, persistArchive, rerender }) {
  document.querySelectorAll('.archive-file-row, .btn-preview-member').forEach((el) => {
    el.onclick = async (e) => {
      if (e.target.closest('a[download]')) return;
      if (el.classList.contains('archive-file-row') && e.target.closest('.btn-preview-member')) return;
      e.preventDefault();

      const memberPath = el.getAttribute('data-member-path');
      const fileName = el.getAttribute('data-file-name');
      if (!archiveState.archiveData || !memberPath) return;

      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const isNested = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz'].includes(ext) || fileName.endsWith('.tar.gz');

      if (isNested) {
        const tablePane = document.getElementById('archiveFileTablePane');
        let overlay = document.getElementById('archiveNestedOverlay');
        if (tablePane && !overlay) {
          overlay = document.createElement('div');
          overlay.id = 'archiveNestedOverlay';
          overlay.className = 'absolute inset-0 z-20 bg-white/80 dark:bg-[#121215]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 animate-fadeIn';
          overlay.innerHTML = `
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center animate-spin">
              <i data-lucide="loader-2" class="w-5 h-5"></i>
            </div>
            <p class="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">Đang mở tệp nén: ${fileName}...</p>
          `;
          tablePane.appendChild(overlay);
          if (window.lucide) window.lucide.createIcons({ root: overlay });
        }

        try {
          const inspected = await inspectNestedArchiveFile(
            archiveState.archiveData.fileId,
            memberPath,
            archiveState.archiveData.apiBase
          );
          overlay?.remove();
          archiveState.archiveStack.push({ ...archiveState.archiveData, savedFolder: archiveState.currentFolder });
          archiveState.archiveData = { ...inspected, archiveName: `${archiveState.archiveData.archiveName} / ${inspected.nestedName}` };
          archiveState.currentFolder = '/';
          persistArchive();
          showToast(`Đã mở tệp nén: ${fileName}`, 'success');
          rerender?.();
        } catch (err) {
          overlay?.remove();
          showToast(err.message || 'Lỗi khi mở tệp nén con', 'error');
        }
        return;
      }

      openMediaPreview({
        name: fileName,
        url: `${archiveState.archiveData.apiBase}/api/v1/archive/extract-file?fileId=${archiveState.archiveData.fileId}&memberPath=${encodeURIComponent(memberPath)}&inline=true`
      });
    };
  });
}

