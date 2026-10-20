/**
 * ArchiveRenderer Component
 * Interactive Zero-Extraction Archive Inspector for Universal File Viewer
 * High-density directory exploration, folder navigation, flat search & inline preview
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { getFileIcon } from '../../../tools/archive/components/FileTablePane.js';
import { extractFolders, getFilesInFolder, getSubfoldersInFolder, getAllFilesInArchive } from '../../../tools/archive/hooks/archiveTreeHelper.js';
import { saveModuleState } from '../../../../utilities/moduleState.js';
import { closeFileViewer } from '../FileViewerCore.js';
import { ViewerConnector } from '../FileViewerConnector.js';
import { showToast } from '../../../../utilities/toast.js';
import { getAdminToken } from '../../../../utilities/adminAuth.js';
import { smartUploadFile } from '../../../../utilities/resumableUploader.js';
import { ensureDocxLoaded } from '../../../../utilities/docxHelper.js';
import { ensureSheetJsLoaded } from '../../../../utilities/sheetHelper.js';
import { ensurePdfJsLoaded } from '../../../../utilities/pdfJsHelper.js';
import { inspectNestedArchiveFile } from '../../../tools/archive/hooks/useArchiveInspect.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initial markup for the archive viewer viewport
 */
export function renderArchiveViewer(state) {
  return `
    <div id="archiveViewerRoot" class="flex-1 flex flex-col min-h-[380px] max-h-[82vh] relative overflow-hidden">
      <!-- Loading State -->
      <div id="archiveViewerLoading" class="my-auto py-16 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
        </div>
        <p class="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">Đang phân tích cấu trúc tệp nén...</p>
      </div>

      <!-- Main Archive Explorer (Populated dynamically) -->
      <div id="archiveViewerContent" class="hidden flex-1 flex flex-col min-h-0 space-y-2 overflow-hidden">
        <!-- Unified Header: Breadcrumb, Meta Stats, Mode Switcher & Search -->
        <div class="p-2 sm:p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <!-- Left: Breadcrumb & Meta Pill -->
          <div class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <div id="archiveViewerBackBtn" class="shrink-0"></div>
            <div id="archiveViewerFolderBar" class="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-mono min-w-0 overflow-x-auto custom-scrollbar whitespace-nowrap"></div>
            <span id="archiveViewerStatsDivider" class="text-zinc-300 dark:text-zinc-700 hidden sm:inline shrink-0">•</span>
            <div id="archiveViewerMetaStats" class="hidden sm:flex items-center gap-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0"></div>
          </div>

          <!-- Right: Controls (Mode, Search, Tool Link) -->
          <div class="flex items-center gap-2 shrink-0 justify-end">
            <!-- Mode Switcher Pills -->
            <div class="inline-flex p-0.5 rounded-lg bg-zinc-200/70 dark:bg-white/[0.06] border border-zinc-300/60 dark:border-white/[0.08] text-xs font-mono shrink-0">
              <button id="btnArchiveModeFolder" type="button" class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-semibold transition cursor-pointer bg-white dark:bg-white/20 text-indigo-600 dark:text-white shadow-2xs">
                Thư mục
              </button>
              <button id="btnArchiveModeFlat" type="button" class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-semibold transition cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                Tất cả tệp
              </button>
            </div>

            <!-- Instant Search Input -->
            <div class="relative w-32 sm:w-44">
              <i data-lucide="search" class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"></i>
              <input id="archiveSearchInput" type="text" placeholder="Tìm tệp..." class="w-full pl-8 pr-6 py-1 text-xs font-mono rounded-lg bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button id="btnClearArchiveSearch" type="button" class="hidden absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                <i data-lucide="x" class="w-3 h-3"></i>
              </button>
            </div>

            <!-- Fullscreen / External Tool Link Button -->
            <button id="btnOpenArchiveFullscreen" type="button" class="px-2 py-1 rounded-lg bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0" title="Mở trong công cụ Soi Tệp Nén">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Mở rộng</span>
            </button>
          </div>
        </div>

        <!-- Files & Folders Table Scroll Area -->
        <div id="archiveViewerTableContainer" class="flex-1 overflow-auto custom-scrollbar border border-zinc-200/80 dark:border-white/[0.06] rounded-xl bg-white dark:bg-[#121215]"></div>
      </div>

      <!-- Member Preview Overlay (Initially hidden) -->
      <div id="archiveMemberPreviewOverlay" class="hidden absolute inset-0 z-30 bg-white dark:bg-[#121215] flex flex-col animate-fadeIn">
        <div class="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-zinc-50/90 dark:bg-white/[0.02] shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <button id="btnBackToArchiveTable" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span>Quay lại</span>
            </button>
            <span class="text-zinc-300 dark:text-zinc-700">|</span>
            <span id="archiveMemberPreviewTitle" class="text-xs font-mono font-bold text-zinc-900 dark:text-white truncate max-w-[200px] sm:max-w-xs"></span>
            <span id="archiveMemberPreviewSize" class="text-[11px] font-mono text-zinc-400 hidden sm:inline"></span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button id="btnMemberFullscreen" type="button" class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer" title="Mở bằng Trình xem Đa năng">
              <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Toàn màn hình</span>
            </button>
            <a id="archiveMemberPreviewDownload" href="#" download class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> <span>Tải về</span>
            </a>
          </div>
        </div>
        <div id="archiveMemberPreviewViewport" class="flex-1 p-3 sm:p-5 overflow-auto custom-scrollbar flex items-center justify-center bg-zinc-100/50 dark:bg-black/40"></div>
      </div>
    </div>
  `;
}

/**
 * Renders the file and folder rows into HTML table
 */
function renderFilesTableHtml(options) {
  const { subfolders = [], files = [], archiveData, currentFolder = '/', isFlatView = false, searchQuery = '' } = options;
  const isRoot = currentFolder === '/';
  const totalItems = subfolders.length + files.length;

  if (totalItems === 0) {
    return `
      <div class="text-center py-16 text-xs font-mono text-zinc-400 dark:text-zinc-500 space-y-2">
        <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 flex items-center justify-center mx-auto">
          <i data-lucide="folder-open" class="w-5 h-5"></i>
        </div>
        <p>${searchQuery ? `Không tìm thấy tệp nào khớp với "${escapeHtml(searchQuery)}"` : 'Thư mục này trống hoặc không chứa tệp tin trực tiếp'}</p>
        ${!isRoot && !isFlatView ? `
          <button type="button" data-go-parent="true" class="px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer">
            ↑ Lên thư mục cha
          </button>
        ` : ''}
      </div>
    `;
  }

  const token = getAdminToken();
  const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';

  return `
    <table class="w-full text-left text-xs">
      <thead>
        <tr class="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 font-mono text-[11px] sticky top-0 z-10 backdrop-blur-xs">
          <th class="py-2.5 px-3 font-medium">Tên tệp / Thư mục</th>
          ${isFlatView || searchQuery ? '<th class="py-2.5 px-3 font-medium hidden md:table-cell">Đường dẫn</th>' : ''}
          <th class="py-2.5 px-3 font-medium hidden sm:table-cell">Kích thước gốc</th>
          <th class="py-2.5 px-3 font-medium hidden sm:table-cell">Nén còn</th>
          <th class="py-2.5 px-3 font-medium text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-100 dark:divide-white/[0.04]">
        <!-- Parent Directory Navigation Row (Folder mode only) -->
        ${!isRoot && !isFlatView && !searchQuery ? `
          <tr data-go-parent="true" class="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium">
            <td class="py-2 px-3 flex items-center gap-2 font-mono" colspan="5">
              <i data-lucide="corner-left-up" class="w-4 h-4 text-indigo-500 shrink-0"></i>
              <span>.. (Lên thư mục cha)</span>
            </td>
          </tr>
        ` : ''}

        <!-- Direct Subfolders (Folder mode only) -->
        ${!isFlatView && !searchQuery ? subfolders.map((folder) => `
          <tr data-open-folder="${escapeHtml(folder.path)}" class="hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition cursor-pointer">
            <td class="py-2.5 px-3 flex items-center gap-2.5 font-mono text-zinc-900 dark:text-zinc-100 truncate max-w-[280px] sm:max-w-md">
              <div class="w-6 h-6 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <i data-lucide="folder" class="w-3.5 h-3.5 fill-amber-500/20"></i>
              </div>
              <span class="truncate font-semibold" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 shrink-0">
                ${folder.fileCount} tệp
              </span>
            </td>
            <td class="py-2.5 px-3 font-mono text-zinc-500 dark:text-zinc-400 hidden sm:table-cell">
              ${folder.totalBytes > 0 ? formatBytes(folder.totalBytes) : '—'}
            </td>
            <td class="py-2.5 px-3 font-mono text-zinc-400 dark:text-zinc-500 hidden sm:table-cell">
              —
            </td>
            <td class="py-2.5 px-3 text-right">
              <button type="button" data-open-folder="${escapeHtml(folder.path)}"
                class="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition">
                <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
                <span>Mở</span>
              </button>
            </td>
          </tr>
        `).join('') : ''}

        <!-- Direct Files / Matching Search Files -->
        ${files.map((file) => {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const isNestedArchive = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz', 'xz'].includes(ext) || file.name.endsWith('.tar.gz');
          const rawPath = file.rawPath || (file.path ? file.path.replace(/^\/+/, '') : file.name);
          const extractUrl = archiveData.drivePath
            ? `/api/v1/archive/extract-file?drivePath=${encodeURIComponent(archiveData.drivePath)}&memberPath=${encodeURIComponent(rawPath)}${authParam}`
            : `/api/v1/archive/extract-file?fileId=${encodeURIComponent(archiveData.fileId)}&memberPath=${encodeURIComponent(rawPath)}`;

          return `
            <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition">
              <td class="py-2.5 px-3 flex items-center gap-2 font-mono text-zinc-800 dark:text-zinc-200 truncate max-w-[240px] sm:max-w-sm">
                <i data-lucide="${getFileIcon(file.name)}" class="w-4 h-4 text-zinc-400 shrink-0"></i>
                <span class="truncate" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
              </td>
              ${isFlatView || searchQuery ? `
                <td class="py-2.5 px-3 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[160px] hidden md:table-cell" title="${escapeHtml(file.dirPath || '/')}">
                  ${escapeHtml(file.dirPath ? '/' + file.dirPath : '/')}
                </td>
              ` : ''}
              <td class="py-2.5 px-3 font-mono text-zinc-500 dark:text-zinc-400 hidden sm:table-cell">
                ${formatBytes(file.sizeBytes)}
              </td>
              <td class="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-300 hidden sm:table-cell">
                ${formatBytes(file.compressedBytes)}
              </td>
              <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                ${isNestedArchive ? `
                  <button type="button" data-open-nested="${escapeHtml(rawPath)}" data-nested-name="${escapeHtml(file.name)}"
                    class="btn-viewer-nested-open px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition border border-indigo-200/60 dark:border-indigo-800/60">
                    <i data-lucide="folder-archive" class="w-3.5 h-3.5"></i>
                    <span>Mở tệp nén</span>
                  </button>
                ` : `
                  <button type="button" data-view-member="${escapeHtml(rawPath)}" data-name="${escapeHtml(file.name)}" data-size="${file.sizeBytes}"
                    class="btn-viewer-member-view px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Xem</span>
                  </button>
                `}
                <a href="${extractUrl}" download="${escapeHtml(file.name)}"
                  class="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-medium inline-flex items-center gap-1 transition shadow-xs cursor-pointer">
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
  let archiveStack = [];
  let currentFolder = '/';
  let isFlatView = false;
  let searchQuery = '';

  const root = document.getElementById('archiveViewerRoot');
  if (!root) return;

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
      if (!fileId && !drivePath && state.rawFile) {
        const upRes = await smartUploadFile(state.rawFile, {
          purpose: 'archive-inspect',
          signal: abortController.signal
        });
        if (!upRes?.fileId) throw new Error('Không thể tải tệp nén lên máy chủ để đọc');
        fileId = upRes.fileId;
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

      const fetchFn = (typeof window !== 'undefined' && window.__ddViewerFetch) || fetch;
      const res = await fetchFn('/api/v1/archive/inspect', {
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
      const allEntries = inspected.tree || [];
      const folders = extractFolders(allEntries);

      // Auto-focus first folder if root has 0 files and exactly 1 top-level subfolder
      let startFolder = '/';
      const rootFiles = getFilesInFolder(allEntries, '/');
      const rootSubfolders = getSubfoldersInFolder(allEntries, '/');
      if (rootFiles.length === 0 && rootSubfolders.length === 1) {
        startFolder = rootSubfolders[0].path;
      }

      archiveData = {
        fileId,
        drivePath,
        archiveName: state.name || inspected.archiveName,
        totalFiles: inspected.totalFiles,
        totalUncompressedBytes: inspected.totalUncompressedBytes,
        totalCompressedBytes: inspected.totalCompressedBytes,
        format: inspected.format,
        allEntries,
        folders,
        apiBase: window.location.origin
      };

      currentFolder = startFolder;
      displayArchive();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (state.showErrorFallback) {
        state.showErrorFallback('Tệp nén bị lỗi cấu trúc hoặc có mật khẩu bảo vệ', err.message || '');
      } else {
        const loading = document.getElementById('archiveViewerLoading');
        if (loading) {
          loading.innerHTML = `
            <div class="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto shadow-inner">
              <i data-lucide="alert-circle" class="w-6 h-6"></i>
            </div>
            <p class="font-mono text-sm font-semibold text-red-500">${escapeHtml(err.message || 'Tệp nén bị lỗi cấu trúc hoặc có mật khẩu bảo vệ')}</p>
            <div class="pt-2">
              <a href="${state.downloadUrl || '#'}" download="${escapeHtml(state.name || 'archive.zip')}" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs">
                <i data-lucide="download" class="w-4 h-4"></i> Tải về
              </a>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: loading });
        }
      }
    }
  }

  // 3. Render loaded archive UI
  function displayArchive() {
    const loading = document.getElementById('archiveViewerLoading');
    const content = document.getElementById('archiveViewerContent');
    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    // Nested archive back button
    const backBtnContainer = document.getElementById('archiveViewerBackBtn');
    if (backBtnContainer) {
      if (archiveStack.length > 0) {
        backBtnContainer.innerHTML = `
          <button id="btnBackNestedArchive" type="button" class="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Quay lại (${archiveStack.length})</span>
          </button>
        `;
        backBtnContainer.querySelector('#btnBackNestedArchive')?.addEventListener('click', () => {
          if (archiveStack.length === 0) return;
          const prev = archiveStack.pop();
          archiveData = prev.archiveData;
          currentFolder = prev.currentFolder;
          isFlatView = prev.isFlatView;
          searchQuery = prev.searchQuery;
          displayArchive();
        });
      } else {
        backBtnContainer.innerHTML = '';
      }
    }

    // Meta stats pill
    const metaStatsEl = document.getElementById('archiveViewerMetaStats');
    if (metaStatsEl && archiveData) {
      const ratio = archiveData.totalUncompressedBytes > 0
        ? Math.round((1 - archiveData.totalCompressedBytes / archiveData.totalUncompressedBytes) * 100)
        : 0;
      metaStatsEl.innerHTML = `
        <span class="text-zinc-500 dark:text-zinc-400">
          <strong>${archiveData.totalFiles}</strong> tệp • ${formatBytes(archiveData.totalUncompressedBytes)}${ratio > 0 ? ` (Tiết kiệm ${ratio}%)` : ''}
        </span>
      `;
    }

    // Fullscreen / external tool button
    const btnFullscreen = document.getElementById('btnOpenArchiveFullscreen');
    if (btnFullscreen) {
      btnFullscreen.onclick = () => {
        if (archiveData.drivePath) {
          closeFileViewer();
          window.location.hash = `#archive?path=${encodeURIComponent(archiveData.drivePath)}`;
        } else {
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
        }
      };
    }

    // Attach mode switches
    const btnFolderMode = document.getElementById('btnArchiveModeFolder');
    const btnFlatMode = document.getElementById('btnArchiveModeFlat');
    if (btnFolderMode && btnFlatMode) {
      btnFolderMode.onclick = () => {
        if (!isFlatView) return;
        isFlatView = false;
        searchQuery = '';
        const searchInput = document.getElementById('archiveSearchInput');
        if (searchInput) searchInput.value = '';
        document.getElementById('btnClearArchiveSearch')?.classList.add('hidden');
        btnFolderMode.className = 'px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-semibold transition cursor-pointer bg-white dark:bg-white/20 text-indigo-600 dark:text-white shadow-2xs';
        btnFlatMode.className = 'px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-semibold transition cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white';
        refreshTableView();
      };

      btnFlatMode.onclick = () => {
        if (isFlatView) return;
        isFlatView = true;
        btnFlatMode.className = 'px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-semibold transition cursor-pointer bg-white dark:bg-white/20 text-indigo-600 dark:text-white shadow-2xs';
        btnFolderMode.className = 'px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-semibold transition cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white';
        refreshTableView();
      };
    }

    // Attach instant search input
    const searchInput = document.getElementById('archiveSearchInput');
    const btnClearSearch = document.getElementById('btnClearArchiveSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        if (btnClearSearch) {
          btnClearSearch.classList.toggle('hidden', !searchQuery);
        }
        refreshTableView();
      };
    }
    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        btnClearSearch.classList.add('hidden');
        refreshTableView();
      };
    }

    refreshTableView();
  }

  // 4. Update folder and table view
  function refreshTableView() {
    const folderBar = document.getElementById('archiveViewerFolderBar');
    if (folderBar) {
      if (isFlatView || searchQuery) {
        folderBar.innerHTML = `
          <div class="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium truncate">
            <i data-lucide="${searchQuery ? 'search' : 'list-tree'}" class="w-3.5 h-3.5 text-indigo-500"></i>
            <span>${searchQuery ? `Kết quả: "${escapeHtml(searchQuery)}"` : 'Tất cả tệp (Danh sách phẳng)'}</span>
          </div>
        `;
      } else {
        const parts = currentFolder.split('/').filter(Boolean);
        let crumbHtml = `
          <button data-go-folder="/" class="btn-crumb inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold cursor-pointer transition">
            <i data-lucide="home" class="w-3.5 h-3.5"></i>
            <span>Gốc</span>
          </button>
        `;
        let pathAcc = '';
        parts.forEach((p) => {
          pathAcc += `/${p}`;
          crumbHtml += ` <span class="text-zinc-300 dark:text-zinc-700">/</span> <button data-go-folder="${pathAcc}/" class="btn-crumb text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold cursor-pointer transition">${escapeHtml(p)}</button>`;
        });

        folderBar.innerHTML = `
          <div class="flex items-center gap-1 truncate">
            <span class="truncate">${crumbHtml}</span>
          </div>
        `;

        folderBar.querySelectorAll('.btn-crumb').forEach((btn) => {
          btn.onclick = () => {
            currentFolder = btn.dataset.goFolder || '/';
            refreshTableView();
          };
        });
      }
    }

    const tableEl = document.getElementById('archiveViewerTableContainer');
    if (tableEl && archiveData) {
      let subfolders = [];
      let files = [];

      if (searchQuery) {
        // Filter across all files by search query
        const all = getAllFilesInArchive(archiveData.allEntries);
        files = all.filter((f) => f.name.toLowerCase().includes(searchQuery) || f.rawPath.toLowerCase().includes(searchQuery));
      } else if (isFlatView) {
        // Flattened view of all files
        files = getAllFilesInArchive(archiveData.allEntries);
      } else {
        // Normal hierarchical folder view
        subfolders = getSubfoldersInFolder(archiveData.allEntries, currentFolder);
        files = getFilesInFolder(archiveData.allEntries, currentFolder);
      }

      tableEl.innerHTML = renderFilesTableHtml({
        subfolders,
        files,
        archiveData,
        currentFolder,
        isFlatView,
        searchQuery
      });

      // Bind folder clicks
      tableEl.querySelectorAll('[data-open-folder]').forEach((btn) => {
        btn.onclick = () => {
          currentFolder = btn.dataset.openFolder;
          refreshTableView();
        };
      });

      // Bind parent folder click
      tableEl.querySelectorAll('[data-go-parent="true"]').forEach((btn) => {
        btn.onclick = () => {
          const parts = currentFolder.split('/').filter(Boolean);
          parts.pop();
          currentFolder = parts.length > 0 ? `/${parts.join('/')}/` : '/';
          refreshTableView();
        };
      });

      // Bind member preview handlers
      tableEl.querySelectorAll('.btn-viewer-member-view').forEach((btn) => {
        btn.onclick = () => previewMember(btn.dataset.viewMember, btn.dataset.name, Number(btn.dataset.size || 0));
      });

      // Bind nested archive open handlers
      tableEl.querySelectorAll('.btn-viewer-nested-open').forEach((btn) => {
        btn.onclick = () => openNestedArchive(btn.dataset.openNested, btn.dataset.nestedName);
      });
    }

    if (window.lucide) window.lucide.createIcons({ root });
  }

  // 5. Open nested archive recursively
  async function openNestedArchive(memberPath, nestedName) {
    const loading = document.getElementById('archiveViewerLoading');
    const content = document.getElementById('archiveViewerContent');
    if (loading && content) {
      const p = loading.querySelector('p');
      if (p) p.textContent = `Đang mở tệp nén: ${nestedName}...`;
      loading.classList.remove('hidden');
      content.classList.add('hidden');
    }

    try {
      const inspected = await inspectNestedArchiveFile({
        parentFileId: archiveData.fileId,
        parentDrivePath: archiveData.drivePath,
        memberPath,
        apiBase: archiveData.apiBase || window.location.origin
      });

      archiveStack.push({
        archiveData: { ...archiveData },
        currentFolder,
        isFlatView,
        searchQuery
      });

      archiveData = {
        fileId: inspected.fileId,
        drivePath: null,
        archiveName: `${archiveData.archiveName} / ${inspected.nestedName}`,
        totalFiles: inspected.totalFiles,
        totalUncompressedBytes: inspected.totalUncompressedBytes,
        totalCompressedBytes: inspected.totalCompressedBytes,
        format: inspected.format,
        allEntries: inspected.allEntries,
        folders: inspected.folders,
        apiBase: archiveData.apiBase || window.location.origin
      };

      currentFolder = '/';
      isFlatView = false;
      searchQuery = '';
      const searchInput = document.getElementById('archiveSearchInput');
      if (searchInput) searchInput.value = '';
      displayArchive();
      showToast(`Đã mở tệp nén con: ${nestedName}`, 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi mở tệp nén lồng nhau', 'error');
      if (loading && content) {
        loading.classList.add('hidden');
        content.classList.remove('hidden');
      }
    }
  }

  // 6. In-Modal Member Preview Overlay (Zero-modal-destruction)
  async function previewMember(memberPath, fileName, sizeBytes) {
    const token = getAdminToken();
    const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';
    const extractUrl = archiveData.drivePath
      ? `/api/v1/archive/extract-file?drivePath=${encodeURIComponent(archiveData.drivePath)}&memberPath=${encodeURIComponent(memberPath)}${authParam}`
      : `/api/v1/archive/extract-file?fileId=${encodeURIComponent(archiveData.fileId)}&memberPath=${encodeURIComponent(memberPath)}`;
    const inlineExtractUrl = `${extractUrl}&inline=true`;

    const overlay = document.getElementById('archiveMemberPreviewOverlay');
    const viewport = document.getElementById('archiveMemberPreviewViewport');
    const titleEl = document.getElementById('archiveMemberPreviewTitle');
    const sizeEl = document.getElementById('archiveMemberPreviewSize');
    const dlBtn = document.getElementById('archiveMemberPreviewDownload');
    const fsBtn = document.getElementById('btnMemberFullscreen');

    if (!overlay || !viewport) return;

    if (titleEl) titleEl.textContent = fileName;
    if (sizeEl) sizeEl.textContent = sizeBytes > 0 ? `(${formatBytes(sizeBytes)})` : '';
    if (dlBtn) {
      dlBtn.href = extractUrl;
      dlBtn.download = fileName;
    }
    if (fsBtn) {
      fsBtn.onclick = () => {
        ViewerConnector.preview({
          fileName,
          viewUrl: inlineExtractUrl,
          downloadUrl: extractUrl,
          resultSize: sizeBytes
        });
      };
    }

    viewport.innerHTML = `
      <div class="flex items-center gap-2 text-zinc-500 font-mono text-xs">
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-indigo-500"></i>
        <span>Đang nạp xem trước tệp...</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ root: viewport });
    overlay.classList.remove('hidden');

    const ext = (fileName.split('.').pop() || '').toLowerCase();

    try {
      // 1. Images
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) {
        viewport.innerHTML = `
          <div class="flex items-center justify-center w-full h-full p-2">
            <img src="${inlineExtractUrl}" alt="${escapeHtml(fileName)}" class="max-w-full max-h-[62vh] object-contain rounded-xl shadow-lg border border-zinc-200 dark:border-white/10 select-none transition" />
          </div>
        `;
        return;
      }

      // 2. Audio
      if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus'].includes(ext)) {
        viewport.innerHTML = `
          <div class="my-auto p-6 max-w-md w-full bg-white dark:bg-[#18181b] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-lg text-center space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <i data-lucide="music" class="w-7 h-7"></i>
            </div>
            <p class="font-mono text-sm font-semibold text-zinc-900 dark:text-white truncate">${escapeHtml(fileName)}</p>
            <audio controls playsinline autoplay class="w-full" src="${inlineExtractUrl}"></audio>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: viewport });
        return;
      }

      // 3. Video
      if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
        viewport.innerHTML = `
          <div class="flex items-center justify-center w-full h-full p-2">
            <video controls playsinline autoplay class="max-w-full max-h-[62vh] rounded-xl shadow-lg border border-zinc-200 dark:border-white/10" src="${inlineExtractUrl}"></video>
          </div>
        `;
        return;
      }

      // 4. Word Documents (.docx, .dotx)
      if (['docx', 'dotx'].includes(ext)) {
        viewport.innerHTML = `
          <div class="my-auto py-12 text-center space-y-3">
            <div class="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center mx-auto">
              <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
            </div>
            <p class="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">Đang đọc tài liệu Word...</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: viewport });
        await ensureDocxLoaded();
        const fetchFn = (typeof window !== 'undefined' && window.__ddViewerFetch) || fetch;
        const res = await fetchFn(inlineExtractUrl, { signal: abortController.signal });
        if (!res.ok) throw new Error(`Lỗi nạp tệp Word (${res.status})`);
        const buffer = await res.arrayBuffer();

        viewport.innerHTML = `
          <div class="w-full h-full overflow-auto custom-scrollbar p-2 sm:p-6 flex justify-center bg-zinc-100 dark:bg-[#0d0d10]" style="-webkit-overflow-scrolling: touch;">
            <div id="archiveDocxHost" class="docx-preview-host origin-top max-w-full"></div>
          </div>
        `;
        const host = document.getElementById('archiveDocxHost');
        await window.docx.renderAsync(buffer, host, null, {
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false
        });
        return;
      }

      // 5. PDF Documents (.pdf)
      if (ext === 'pdf') {
        viewport.innerHTML = `
          <div class="my-auto py-12 text-center space-y-3">
            <div class="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto">
              <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
            </div>
            <p class="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">Đang đọc tài liệu PDF...</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: viewport });
        await ensurePdfJsLoaded();
        const fetchFn = (typeof window !== 'undefined' && window.__ddViewerFetch) || fetch;
        const res = await fetchFn(inlineExtractUrl, { signal: abortController.signal });
        if (!res.ok) throw new Error(`Lỗi nạp tệp PDF (${res.status})`);
        const buffer = await res.arrayBuffer();

        const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        viewport.innerHTML = `
          <div class="w-full h-full overflow-auto custom-scrollbar p-3 sm:p-6 flex flex-col items-center gap-4 bg-zinc-100 dark:bg-[#0d0d10]" style="-webkit-overflow-scrolling: touch;" id="archivePdfPagesWrapper">
          </div>
        `;
        const wrapper = document.getElementById('archivePdfPagesWrapper');
        const renderLimit = Math.min(numPages, 15);
        for (let pNum = 1; pNum <= renderLimit; pNum++) {
          const page = await pdfDoc.getPage(pNum);
          const baseVp = page.getViewport({ scale: 1.0 });
          const targetW = Math.min(800, window.innerWidth - 60);
          const scale = targetW / baseVp.width;
          const vp = page.getViewport({ scale });

          const card = document.createElement('div');
          card.className = 'relative bg-white shadow-md rounded border border-zinc-200 dark:border-white/10 overflow-hidden';
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          card.appendChild(canvas);

          const badge = document.createElement('div');
          badge.className = 'absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white font-mono text-[10px] pointer-events-none';
          badge.textContent = `${pNum} / ${numPages}`;
          card.appendChild(badge);

          wrapper.appendChild(card);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        }
        if (numPages > renderLimit) {
          const note = document.createElement('div');
          note.className = 'p-3 text-center text-xs font-mono text-zinc-500';
          note.textContent = `Đang hiển thị ${renderLimit}/${numPages} trang đầu. Bấm "Toàn màn hình" để xem đầy đủ tất cả các trang.`;
          wrapper.appendChild(note);
        }
        return;
      }

      // 6. Spreadsheets (.xlsx, .xls, .csv, .tsv, .ods)
      if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) {
        viewport.innerHTML = `
          <div class="my-auto py-12 text-center space-y-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
            </div>
            <p class="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">Đang đọc bảng tính...</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: viewport });
        await ensureSheetJsLoaded();
        const fetchFn = (typeof window !== 'undefined' && window.__ddViewerFetch) || fetch;
        const res = await fetchFn(inlineExtractUrl, { signal: abortController.signal });
        if (!res.ok) throw new Error(`Lỗi nạp bảng tính (${res.status})`);
        const buffer = await res.arrayBuffer();

        const workbook = window.XLSX.read(buffer, { type: 'array' });
        const sheetNames = workbook.SheetNames || [];
        if (sheetNames.length === 0) throw new Error('Bảng tính rỗng');

        let activeSheetIndex = 0;
        const renderSheetTable = (idx) => {
          const sheetName = sheetNames[idx];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (!jsonData || jsonData.length === 0) {
            return `<div class="p-8 text-center text-xs text-zinc-400 font-mono">Trang tính "${escapeHtml(sheetName)}" không có dữ liệu</div>`;
          }
          const maxCols = Math.min(40, Math.max(...jsonData.map((row) => (Array.isArray(row) ? row.length : 0))));
          const displayRows = jsonData.slice(0, 100);

          return `
            <div class="overflow-auto custom-scrollbar flex-1 w-full" style="-webkit-overflow-scrolling: touch;">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono sticky top-0 z-10">
                    <th class="p-2 border border-zinc-200 dark:border-white/10 w-10 text-center">#</th>
                    ${Array.from({ length: maxCols }, (_, c) => `<th class="p-2 border border-zinc-200 dark:border-white/10 font-semibold text-center">${String.fromCharCode(65 + (c % 26))}</th>`).join('')}
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-200 dark:divide-white/5">
                  ${displayRows.map((row, rIdx) => `
                    <tr class="hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                      <td class="p-1.5 font-mono text-[10px] bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border border-zinc-200 dark:border-white/10 text-center">${rIdx + 1}</td>
                      ${Array.from({ length: maxCols }, (_, c) => `<td class="p-1.5 border border-zinc-200 dark:border-white/10 font-mono text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]" title="${escapeHtml(String(row?.[c] ?? ''))}">${escapeHtml(String(row?.[c] ?? ''))}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        };

        const updateSpreadsheetView = () => {
          viewport.innerHTML = `
            <div class="w-full h-full flex flex-col bg-white dark:bg-[#121215] rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10">
              ${sheetNames.length > 1 ? `
                <div class="px-3 py-1.5 border-b border-zinc-200 dark:border-white/10 flex items-center gap-1.5 overflow-x-auto bg-zinc-50 dark:bg-white/[0.02] shrink-0 font-mono text-xs">
                  ${sheetNames.map((sName, sIdx) => `
                    <button type="button" class="btn-sheet-tab px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${sIdx === activeSheetIndex ? 'bg-emerald-500 text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}" data-sheet-idx="${sIdx}">
                      ${escapeHtml(sName)}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
              <div id="archiveSheetTableHost" class="flex-1 overflow-auto custom-scrollbar flex flex-col min-h-0">
                ${renderSheetTable(activeSheetIndex)}
              </div>
            </div>
          `;
          viewport.querySelectorAll('.btn-sheet-tab').forEach((tabBtn) => {
            tabBtn.onclick = () => {
              activeSheetIndex = Number(tabBtn.dataset.sheetIdx);
              updateSpreadsheetView();
            };
          });
        };
        updateSpreadsheetView();
        return;
      }

      // 7. Text / Code / Markdown / JSON / Config / Log
      const textExts = ['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'sh', 'sql', 'xml', 'yaml', 'yml', 'log', 'ini', 'circ', 'env', 'c', 'cpp', 'h', 'hpp', 'java', 'rs', 'go'];
      if (textExts.includes(ext) || (!['doc', 'ppt', 'pptx', 'exe', 'bin', 'iso', 'dll', 'so', 'dylib'].includes(ext) && sizeBytes < 128 * 1024)) {
        const fetchFn = (typeof window !== 'undefined' && window.__ddViewerFetch) || fetch;
        const res = await fetchFn(inlineExtractUrl, {
          headers: { Range: 'bytes=0-131071' },
          signal: abortController.signal
        });

        if (!res.ok && res.status !== 206) {
          throw new Error(`Không thể đọc nội dung văn bản (${res.status})`);
        }

        const textContent = await res.text();
        viewport.innerHTML = `
          <div class="w-full h-full max-h-[62vh] flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-950 shadow-inner">
            <div class="px-3 py-1.5 bg-zinc-900 border-b border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>${escapeHtml(fileName)}</span>
              <span>${textContent.length > 131072 ? 'Đang hiển thị 128KB đầu' : `${textContent.length} ký tự`}</span>
            </div>
            <pre class="flex-1 p-3.5 text-xs font-mono text-zinc-200 overflow-auto custom-scrollbar select-text leading-relaxed whitespace-pre"><code>${escapeHtml(textContent)}</code></pre>
          </div>
        `;
        return;
      }

      // 8. Fallback for binary / large complex document
      viewport.innerHTML = `
        <div class="my-auto p-6 max-w-sm w-full bg-white dark:bg-[#18181b] rounded-2xl border border-zinc-200 dark:border-white/10 shadow-lg text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <i data-lucide="${getFileIcon(fileName)}" class="w-6 h-6"></i>
          </div>
          <p class="font-mono text-sm font-semibold text-zinc-900 dark:text-white truncate">${escapeHtml(fileName)}</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">Định dạng này có thể mở bằng Trình xem Đa năng hoặc tải về máy</p>
          <div class="pt-2 flex items-center justify-center gap-2 flex-wrap">
            <button id="btnFallbackOpenViewer" type="button" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer">
              <i data-lucide="eye" class="w-4 h-4"></i> Mở Trình xem Đa năng
            </button>
            <a href="${extractUrl}" download="${escapeHtml(fileName)}" class="px-3.5 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <i data-lucide="download" class="w-4 h-4"></i> Tải về
            </a>
          </div>
        </div>
      `;
      viewport.querySelector('#btnFallbackOpenViewer')?.addEventListener('click', () => {
        ViewerConnector.preview({
          fileName,
          viewUrl: inlineExtractUrl,
          downloadUrl: extractUrl,
          resultSize: sizeBytes
        });
      });
      if (window.lucide) window.lucide.createIcons({ root: viewport });
    } catch (err) {
      viewport.innerHTML = `
        <div class="my-auto p-4 text-center text-xs text-red-500 font-mono space-y-2">
          <p>Không thể xem trước tệp: ${escapeHtml(err.message)}</p>
          <a href="${extractUrl}" download="${escapeHtml(fileName)}" class="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 font-semibold inline-flex items-center gap-1">
            <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về trực tiếp
          </a>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: viewport });
    }
  }

  // 6. Close member overlay
  document.getElementById('btnBackToArchiveTable')?.addEventListener('click', () => {
    const overlay = document.getElementById('archiveMemberPreviewOverlay');
    if (overlay) overlay.classList.add('hidden');
    const viewport = document.getElementById('archiveMemberPreviewViewport');
    if (viewport) {
      // Pause any active media
      const media = viewport.querySelector('video, audio');
      if (media) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      }
      viewport.innerHTML = '';
    }
  });

  loadArchive();
}
