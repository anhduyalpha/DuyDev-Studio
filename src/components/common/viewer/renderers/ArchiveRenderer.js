/**
 * ArchiveRenderer Component
 * Interactive Zero-Extraction Archive Inspector for Universal File Viewer
 * High-density directory exploration, member extraction & inline preview
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { getFileIcon } from '../../../tools/archive/components/FileTablePane.js';
import { extractFolders, getFilesInFolder } from '../../../tools/archive/hooks/archiveTreeHelper.js';
import { saveModuleState } from '../../../../utilities/moduleState.js';
import { closeFileViewer } from '../FileViewerCore.js';
import { ViewerConnector } from '../FileViewerConnector.js';
import { showToast } from '../../../../utilities/toast.js';
import { getAdminToken } from '../../../../utilities/adminAuth.js';

/**
 * Initial markup for the archive viewer viewport
 */
export function renderArchiveViewer(state) {
  return `
    <div id="archiveViewerRoot" class="flex-1 flex flex-col min-h-[320px] max-h-[78vh] relative overflow-hidden">
      <!-- Loading State -->
      <div id="archiveViewerLoading" class="my-auto py-16 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
        </div>
        <p class="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">Đang phân tích tệp nén...</p>
      </div>

      <!-- Main Archive Explorer (Populated dynamically) -->
      <div id="archiveViewerContent" class="hidden flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
        <!-- Summary Stats & Actions Bar -->
        <div id="archiveViewerStats" class="p-3 sm:p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 shrink-0"></div>

        <!-- Breadcrumb / Folder Selector -->
        <div id="archiveViewerFolderBar" class="flex items-center justify-between gap-2 px-1 text-xs text-zinc-600 dark:text-zinc-400 shrink-0 font-mono"></div>

        <!-- Files Table Scroll Area -->
        <div id="archiveViewerTableContainer" class="flex-1 overflow-auto custom-scrollbar border border-zinc-200/80 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#121215]"></div>
      </div>

      <!-- Member Preview Overlay (Initially hidden) -->
      <div id="archiveMemberPreviewOverlay" class="hidden absolute inset-0 z-20 bg-white dark:bg-[#121215] flex flex-col animate-fadeIn">
        <div class="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-zinc-50/80 dark:bg-white/[0.02] shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <button id="btnBackToArchiveTable" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Quay lại
            </button>
            <span class="text-zinc-300 dark:text-zinc-700">|</span>
            <span id="archiveMemberPreviewTitle" class="text-xs font-mono font-bold text-zinc-900 dark:text-white truncate"></span>
            <span id="archiveMemberPreviewSize" class="text-[11px] font-mono text-zinc-400"></span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <a id="archiveMemberPreviewDownload" href="#" download class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về
            </a>
          </div>
        </div>
        <div id="archiveMemberPreviewViewport" class="flex-1 p-4 overflow-auto custom-scrollbar flex items-center justify-center"></div>
      </div>
    </div>
  `;
}

/**
 * Formats table rows for the files in the current folder
 */
function renderFilesTableHtml(files, archiveData) {
  if (files.length === 0) {
    return `
      <div class="text-center py-12 text-xs font-mono text-zinc-400">
        Không có tệp nào trong thư mục này
      </div>
    `;
  }

  return `
    <table class="w-full text-left text-xs">
      <thead>
        <tr class="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 font-mono">
          <th class="py-2.5 px-3 font-medium">Tên tệp</th>
          <th class="py-2.5 px-3 font-medium hidden sm:table-cell">Kích thước gốc</th>
          <th class="py-2.5 px-3 font-medium hidden sm:table-cell">Nén còn</th>
          <th class="py-2.5 px-3 font-medium text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-100 dark:divide-white/[0.04]">
        ${files.map((file) => {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const nonViewable = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
          const isViewable = !nonViewable.includes(ext);
          const rawPath = file.rawPath || (file.path ? file.path.replace(/^\/+/, '') : file.name);
          const token = getAdminToken();
          const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';
          const extractUrl = archiveData.drivePath
            ? `/api/v1/archive/extract-file?drivePath=${encodeURIComponent(archiveData.drivePath)}&memberPath=${encodeURIComponent(rawPath)}${authParam}`
            : `/api/v1/archive/extract-file?fileId=${encodeURIComponent(archiveData.fileId)}&memberPath=${encodeURIComponent(rawPath)}`;

          return `
            <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
              <td class="py-2.5 px-3 flex items-center gap-2 font-mono text-zinc-800 dark:text-zinc-200 truncate max-w-[240px] sm:max-w-xs">
                <i data-lucide="${getFileIcon(file.name)}" class="w-4 h-4 text-zinc-400 shrink-0"></i>
                <span class="truncate" title="${file.name}">${file.name}</span>
              </td>
              <td class="py-2.5 px-3 font-mono text-zinc-500 dark:text-zinc-400 hidden sm:table-cell">
                ${formatBytes(file.sizeBytes)}
              </td>
              <td class="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-300 hidden sm:table-cell">
                ${formatBytes(file.compressedBytes)}
              </td>
              <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                ${isViewable ? `
                  <button type="button" data-view-member="${rawPath}" data-name="${file.name}" data-size="${file.sizeBytes}"
                    class="btn-viewer-member-view px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Xem</span>
                  </button>
                ` : ''}
                <a href="${extractUrl}" download="${file.name}"
                  class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-medium inline-flex items-center gap-1 transition shadow-xs">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  <span>Tải</span>
                </a>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Attaches asynchronous inspector and interaction handlers for ArchiveRenderer
 */
export function attachArchiveViewerListeners(state, registerCleanup) {
  let abortController = new AbortController();
  registerCleanup(() => abortController.abort());

  let archiveData = null;
  let currentFolder = '/';

  const root = document.getElementById('archiveViewerRoot');
  if (!root) return;

  // 1. Resolve fileId
  // 1. Resolve fileId and drivePath
  let fileId = state.fileId;
  const drivePath = state.drivePath || null;
  if (!fileId && !drivePath && state.downloadUrl) {
    const match = state.downloadUrl.match(/\/api\/v1\/files\/(?:download|view)\/([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }

  // 2. Fetch and inspect archive
  async function loadArchive() {
    try {
      // If we don't have a server fileId and no drivePath, but have a local rawFile blob, upload it first
      if (!fileId && !drivePath && state.rawFile) {
        const formData = new FormData();
        formData.append('file', state.rawFile, state.name);
        formData.append('purpose', 'archive-inspect');
        const upRes = await fetch('/api/v1/files/upload?purpose=archive-inspect', {
          method: 'POST',
          body: formData,
          signal: abortController.signal
        });
        if (!upRes.ok) throw new Error('Không thể tải tệp nén lên máy chủ để đọc');
        const upJson = await upRes.json();
        fileId = upJson.data?.fileId;
      }

      if (!fileId && !drivePath) throw new Error('Không tìm thấy định danh hoặc đường dẫn của tệp nén');

      const token = getAdminToken();
      const inspectHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'x-storage-auth': token } : {})
      };
      const inspectBody = drivePath
        ? { drivePath, auth: token }
        : { fileId, auth: token };

      const res = await fetch('/api/v1/archive/inspect', {
        method: 'POST',
        headers: inspectHeaders,
        body: JSON.stringify(inspectBody),
        signal: abortController.signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.message || `Lỗi phân tích tệp nén (${res.status})`);
      }

      const inspected = (await res.json()).data;
      archiveData = {
        fileId,
        drivePath,
        archiveName: state.name || inspected.archiveName,
        totalFiles: inspected.totalFiles,
        totalUncompressedBytes: inspected.totalUncompressedBytes,
        totalCompressedBytes: inspected.totalCompressedBytes,
        format: inspected.format,
        allEntries: inspected.tree,
        folders: extractFolders(inspected.tree),
        apiBase: window.location.origin
      };

      displayArchive();
    } catch (err) {
      if (err.name === 'AbortError') return;
      const loading = document.getElementById('archiveViewerLoading');
      if (loading) {
        loading.innerHTML = `
          <div class="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto">
            <i data-lucide="alert-circle" class="w-6 h-6"></i>
          </div>
          <p class="font-mono text-sm font-semibold text-red-500">${err.message || 'Không thể đọc tệp nén'}</p>
          <div class="pt-2">
            <a href="${state.downloadUrl}" download="${state.name}" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2">
              <i data-lucide="download" class="w-4 h-4"></i> Tải về
            </a>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: loading });
      }
    }
  }

  // 3. Render loaded archive UI
  function displayArchive() {
    const loading = document.getElementById('archiveViewerLoading');
    const content = document.getElementById('archiveViewerContent');
    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    // Stats bar
    const statsEl = document.getElementById('archiveViewerStats');
    if (statsEl) {
      const ratio = archiveData.totalUncompressedBytes > 0
        ? Math.round((1 - archiveData.totalCompressedBytes / archiveData.totalUncompressedBytes) * 100)
        : 0;

      statsEl.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded font-mono text-[11px] font-bold uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            ${archiveData.format || 'ARCHIVE'}
          </span>
          <span class="text-xs font-mono text-zinc-700 dark:text-zinc-300">
            <strong>${archiveData.totalFiles}</strong> tệp • ${formatBytes(archiveData.totalUncompressedBytes)} (Tiết kiệm ${Math.max(0, ratio)}%)
          </span>
        </div>
        <button id="btnOpenArchiveFullscreen" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
          <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
          <span>Mở rộng</span>
        </button>
      `;

      statsEl.querySelector('#btnOpenArchiveFullscreen')?.addEventListener('click', () => {
        saveModuleState('archive', {
          currentTab: 'inspect',
          archiveData: {
            ...archiveData,
            currentFiles: getFilesInFolder(archiveData.allEntries, '/')
          },
          currentFolder: '/'
        });
        closeFileViewer();
        window.location.hash = '#archive';
      });
    }

    refreshFolderView();
  }

  // 4. Update folder and table
  function refreshFolderView() {
    const folderBar = document.getElementById('archiveViewerFolderBar');
    if (folderBar) {
      const parts = currentFolder.split('/').filter(Boolean);
      let crumbHtml = `<button data-go-folder="/" class="btn-crumb text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">root</button>`;
      let pathAcc = '';
      parts.forEach((p) => {
        pathAcc += `/${p}`;
        crumbHtml += ` <span class="text-zinc-300 dark:text-zinc-700">/</span> <button data-go-folder="${pathAcc}/" class="btn-crumb text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">${p}</button>`;
      });

      folderBar.innerHTML = `
        <div class="flex items-center gap-1.5 truncate">
          <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-500"></i>
          <span>${crumbHtml}</span>
        </div>
      `;

      folderBar.querySelectorAll('.btn-crumb').forEach((btn) => {
        btn.onclick = () => {
          currentFolder = btn.dataset.goFolder || '/';
          refreshFolderView();
        };
      });
    }

    const tableEl = document.getElementById('archiveViewerTableContainer');
    if (tableEl) {
      const files = getFilesInFolder(archiveData.allEntries, currentFolder);
      tableEl.innerHTML = renderFilesTableHtml(files, archiveData);
      if (window.lucide) window.lucide.createIcons({ root: tableEl });

      // Attach member preview handlers
      tableEl.querySelectorAll('.btn-viewer-member-view').forEach((btn) => {
        btn.onclick = () => previewMember(btn.dataset.viewMember, btn.dataset.name, Number(btn.dataset.size || 0));
      });
    }

    if (window.lucide) window.lucide.createIcons({ root: root });
  }

  // 5. Member preview via Universal Viewer
  function previewMember(memberPath, fileName, sizeBytes) {
    const token = getAdminToken();
    const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';
    const extractUrl = archiveData.drivePath
      ? `/api/v1/archive/extract-file?drivePath=${encodeURIComponent(archiveData.drivePath)}&memberPath=${encodeURIComponent(memberPath)}${authParam}`
      : `/api/v1/archive/extract-file?fileId=${encodeURIComponent(archiveData.fileId)}&memberPath=${encodeURIComponent(memberPath)}`;
    const inlineExtractUrl = `${extractUrl}&inline=true`;

    ViewerConnector.preview({
      fileName,
      viewUrl: inlineExtractUrl,
      downloadUrl: extractUrl,
      size: sizeBytes
    });
  }

  // 6. Close member overlay
  document.getElementById('btnBackToArchiveTable')?.addEventListener('click', () => {
    const overlay = document.getElementById('archiveMemberPreviewOverlay');
    if (overlay) overlay.classList.add('hidden');
    const viewport = document.getElementById('archiveMemberPreviewViewport');
    if (viewport) viewport.innerHTML = '';
  });

  loadArchive();
}
