/**
 * StoragePage.js - CasaOS Files Style Storage Drive Controller
 * Features: Password guard, Breadcrumb navigation, Drag & Drop upload,
 * Folder ZIP download, Multi-selection batch operations (Download ZIP, Move, Copy, Delete),
 * Sorting (Name, Size, Date, Type), Grid/List views, URL hash deep linking & history navigation,
 * File Preview via Universal File Viewer, Rename, and Real-time Storage Telemetry.
 */

import { StorageService } from '../services/storageService.js';
import { ViewerConnector } from '../components/common/viewer/FileViewerConnector.js';
import { isAdminAuthenticated, verifyAdminPassword, lockAdminSession } from '../utilities/adminAuth.js';
import { formatBytes, formatRelativeTime } from '../utilities/formatters.js';
import { showToast } from '../utilities/toast.js';
import { openSlideConfirmModal } from '../components/common/SlideConfirmModal.js';

/**
 * Escapes unsafe HTML characters to prevent XSS in user filenames
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

/**
 * Extracts storage path from window.location.hash
 */
export function getStoragePathFromHash() {
  const hash = window.location.hash || '';
  if (hash.startsWith('#storage?')) {
    const searchPart = hash.slice('#storage?'.length);
    const params = new URLSearchParams(searchPart);
    const p = params.get('path');
    if (p) {
      const decoded = decodeURIComponent(p);
      return decoded.startsWith('/') ? decoded : `/${decoded}`;
    }
  } else if (hash.startsWith('#storage/')) {
    const raw = hash.slice('#storage'.length);
    if (raw) {
      try {
        const decoded = decodeURIComponent(raw);
        return decoded.startsWith('/') ? decoded : `/${decoded}`;
      } catch {
        return '/';
      }
    }
  }
  return '/';
}

// Internal controller state
const state = {
  currentPath: '/',
  items: [],
  stats: null,
  viewMode: (typeof localStorage !== 'undefined' && localStorage.getItem('ds_storage_view_mode')) || 'grid',
  searchQuery: '',
  sortBy: (typeof localStorage !== 'undefined' && localStorage.getItem('ds_storage_sort_by')) || 'name',
  sortDirection: (typeof localStorage !== 'undefined' && localStorage.getItem('ds_storage_sort_dir')) || 'asc',
  selectedPaths: new Set(),
  isUploading: false,
  uploadProgress: 0,
  uploadStatusText: '',
  isLoading: false,
  error: null
};

/**
 * Maps extension to Lucide icon and color theme
 */
function getFileVisualInfo(item) {
  if (item.isDirectory) {
    return { icon: 'folder', color: 'text-amber-500 fill-amber-500/20' };
  }
  const ext = (item.extension || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'avif', 'ico', 'tiff'].includes(ext)) {
    return { icon: 'image', color: 'text-blue-500' };
  }
  if (ext === 'pdf') {
    return { icon: 'file-text', color: 'text-rose-500' };
  }
  if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv'].includes(ext)) {
    return { icon: 'video', color: 'text-cyan-500' };
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'].includes(ext)) {
    return { icon: 'music', color: 'text-emerald-500' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return { icon: 'archive', color: 'text-amber-600' };
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh', 'sql', 'c', 'cpp', 'rs', 'go', 'php'].includes(ext)) {
    return { icon: 'file-code', color: 'text-indigo-500' };
  }
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md', 'csv'].includes(ext)) {
    return { icon: 'file-spreadsheet', color: 'text-violet-500' };
  }
  return { icon: 'file', color: 'text-zinc-400' };
}

/**
 * Checks if a file is previewable directly in the browser
 */
function isPreviewable(item) {
  return Boolean(item && !item.isDirectory);
}

/**
 * Gets sorted & filtered items based on current controller state
 */
function getProcessedItems() {
  const query = state.searchQuery.toLowerCase().trim();
  const filtered = state.items.filter((item) => {
    if (!query) return true;
    return item.name.toLowerCase().includes(query);
  });

  return filtered.sort((a, b) => {
    // Folders always pinned to top
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let cmp = 0;
    if (state.sortBy === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    } else if (state.sortBy === 'size') {
      cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0);
    } else if (state.sortBy === 'date') {
      cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
    } else if (state.sortBy === 'type') {
      cmp = (a.extension || '').localeCompare(b.extension || '');
    }

    return state.sortDirection === 'asc' ? cmp : -cmp;
  });
}

/**
 * Main Render Function
 */
export function renderStoragePage() {
  const isUnlocked = isAdminAuthenticated();

  if (!isUnlocked) {
    return renderLockScreen();
  }

  state.currentPath = getStoragePathFromHash();

  return `
    <div class="max-w-7xl mx-auto space-y-4 animate-fadeIn">
      
      <!-- Top Header & Actions Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] shadow-xs">
        
        <!-- Left: Title & Breadcrumbs -->
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <i data-lucide="hard-drive" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-base text-zinc-900 dark:text-white truncate">Bộ Nhớ Lưu Trữ</h2>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                ĐÃ MỞ KHÓA
              </span>
            </div>
            <div id="storageBreadcrumbContainer" class="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 overflow-x-auto whitespace-nowrap">
              ${renderBreadcrumbs(state.currentPath)}
            </div>
          </div>
        </div>

        <!-- Right: Actions Toolbar -->
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <!-- Search in directory -->
          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="inputStorageSearch" 
              placeholder="Lọc tệp..." 
              value="${escapeHtml(state.searchQuery)}"
              class="w-32 sm:w-44 pl-8 pr-7 py-1.5 rounded-xl glass-search text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none transition font-sans"
            />
            <button id="btnStorageClearSearch" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer ${state.searchQuery ? '' : 'hidden'}" title="Xóa tìm kiếm">
              <i data-lucide="x" class="w-3 h-3"></i>
            </button>
          </div>

          <!-- Sort Select Menu -->
          <div class="relative">
            <select 
              id="selectStorageSort" 
              class="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200/80 dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition border border-zinc-200 dark:border-white/10 focus:outline-none cursor-pointer appearance-none pr-7"
              title="Sắp xếp danh sách"
            >
              <option value="name_asc" ${state.sortBy === 'name' && state.sortDirection === 'asc' ? 'selected' : ''}>Tên (A-Z)</option>
              <option value="name_desc" ${state.sortBy === 'name' && state.sortDirection === 'desc' ? 'selected' : ''}>Tên (Z-A)</option>
              <option value="size_asc" ${state.sortBy === 'size' && state.sortDirection === 'asc' ? 'selected' : ''}>Kích thước (Nhỏ nhất)</option>
              <option value="size_desc" ${state.sortBy === 'size' && state.sortDirection === 'desc' ? 'selected' : ''}>Kích thước (Lớn nhất)</option>
              <option value="date_desc" ${state.sortBy === 'date' && state.sortDirection === 'desc' ? 'selected' : ''}>Thời gian (Mới nhất)</option>
              <option value="date_asc" ${state.sortBy === 'date' && state.sortDirection === 'asc' ? 'selected' : ''}>Thời gian (Cũ nhất)</option>
              <option value="type_asc" ${state.sortBy === 'type' && state.sortDirection === 'asc' ? 'selected' : ''}>Định dạng (A-Z)</option>
            </select>
            <i data-lucide="arrow-down-up" class="w-3 h-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
          </div>

          <!-- View Toggle -->
          <div class="flex items-center bg-zinc-100 dark:bg-white/[0.06] p-0.5 rounded-xl border border-zinc-200 dark:border-white/10">
            <button id="btnStorageViewGrid" title="Dạng lưới" class="p-1.5 rounded-lg transition cursor-pointer ${state.viewMode === 'grid' ? 'bg-white dark:bg-white/15 text-indigo-600 dark:text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
              <i data-lucide="layout-grid" class="w-3.5 h-3.5"></i>
            </button>
            <button id="btnStorageViewList" title="Dạng danh sách" class="p-1.5 rounded-lg transition cursor-pointer ${state.viewMode === 'list' ? 'bg-white dark:bg-white/15 text-indigo-600 dark:text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
              <i data-lucide="list" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <!-- Select All Toggle Button -->
          <button id="btnStorageSelectAllToggle" title="Chọn tất cả (Ctrl+A)" class="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 transition border border-zinc-200 dark:border-white/10 cursor-pointer">
            <i data-lucide="check-square" class="w-3.5 h-3.5"></i>
          </button>

          <!-- New Folder Button -->
          <button id="btnStorageNewFolder" class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition border border-zinc-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Thư mục mới</span>
          </button>

          <!-- Upload Button -->
          <label for="storageFileInput" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="upload" class="w-3.5 h-3.5"></i>
            <span>Tải lên</span>
          </label>
          <input type="file" id="storageFileInput" multiple class="hidden" />

          <!-- Refresh Button -->
          <button id="btnStorageRefresh" title="Làm mới" class="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 transition border border-zinc-200 dark:border-white/10 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          </button>

          <!-- Lock Session Button -->
          <button id="btnStorageLock" title="Khóa phiên lưu trữ" class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition border border-red-200 dark:border-red-500/20 cursor-pointer">
            <i data-lucide="lock" class="w-3.5 h-3.5"></i>
          </button>
        </div>

      </div>

      <!-- Batch Operations Toolbar (Visible when items selected) -->
      <div id="storageBatchToolbar" class="${state.selectedPaths.size > 0 ? '' : 'hidden'} p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fadeIn">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span id="storageSelectedCountText" class="text-xs font-bold text-indigo-900 dark:text-indigo-200">
            Đã chọn ${state.selectedPaths.size} mục
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button id="btnStorageBatchDownload" type="button" class="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition border border-zinc-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer shadow-2xs">
            <i data-lucide="download" class="w-3.5 h-3.5 text-indigo-500"></i>
            <span>Tải ZIP</span>
          </button>
          <button id="btnStorageBatchMove" type="button" class="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition border border-zinc-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer shadow-2xs">
            <i data-lucide="folder-input" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Di chuyển</span>
          </button>
          <button id="btnStorageBatchCopy" type="button" class="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition border border-zinc-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer shadow-2xs">
            <i data-lucide="copy" class="w-3.5 h-3.5 text-blue-500"></i>
            <span>Sao chép</span>
          </button>
          <button id="btnStorageBatchDelete" type="button" class="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold transition border border-red-200 dark:border-red-500/20 flex items-center gap-1.5 cursor-pointer shadow-2xs">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            <span>Xóa</span>
          </button>
          <button id="btnStorageBatchClear" type="button" class="px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium transition cursor-pointer">
            Bỏ chọn
          </button>
        </div>
      </div>

      <!-- Upload Progress Dock (Visible during upload) -->
      <div id="storageUploadDock" class="${state.isUploading ? '' : 'hidden'} p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 space-y-2">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
          <div class="flex items-center gap-2 min-w-0">
            <div id="storageUploadIndicator" class="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0"></div>
            <span id="storageUploadText" class="truncate">${escapeHtml(state.uploadStatusText || 'Đang tải lên tệp...')}</span>
          </div>
          <div class="flex items-center gap-2.5 font-mono text-xs shrink-0 self-end sm:self-auto">
            <span id="storageUploadStats" class="text-zinc-500 dark:text-zinc-400 font-normal"></span>
            <span id="storageUploadPercent" class="font-bold">${state.uploadProgress}%</span>
            <button id="btnStoragePauseUpload" type="button" class="hidden px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-200 transition cursor-pointer">Tạm dừng</button>
            <button id="btnStorageCancelUpload" type="button" class="hidden px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 transition cursor-pointer">Hủy</button>
          </div>
        </div>
        <div class="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900/50 rounded-full overflow-hidden">
          <div id="storageProgressBar" class="h-full bg-indigo-600 transition-all duration-150" style="width: ${state.uploadProgress}%"></div>
        </div>
      </div>

      <!-- Main Explorer & Drop Target Container -->
      <div id="storageDropZone" class="relative min-h-[420px] p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] shadow-xs flex flex-col justify-between">
        
        <!-- Drag & Drop Hover Overlay -->
        <div id="storageDropOverlay" class="absolute inset-0 z-20 hidden bg-indigo-600/10 backdrop-blur-xs border-2 border-dashed border-indigo-500 rounded-2xl flex flex-col items-center justify-center pointer-events-none space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg animate-pulse">
            <i data-lucide="upload-cloud" class="w-6 h-6"></i>
          </div>
          <p class="font-bold text-sm text-indigo-600 dark:text-indigo-400">Thả tệp vào đây để tải lên thư mục hiện tại</p>
        </div>

        <!-- Files & Folders Content Area -->
        <div id="storageContentArea">
          ${renderExplorerContent()}
        </div>

        <!-- Bottom Telemetry & Status Bar -->
        <div id="storageStatusBar" class="mt-6 pt-3 border-t border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div class="flex items-center gap-2 font-mono flex-wrap">
            <span id="storageItemCount">${state.items.length} mục</span>
            <span>•</span>
            <span id="storageFolderCount">${state.items.filter((i) => i.isDirectory).length} thư mục</span>
            <span>•</span>
            <span id="storageFileCount">${state.items.filter((i) => !i.isDirectory).length} tệp tin</span>
            <span id="storageFilteredCount" class="${state.searchQuery ? '' : 'hidden'} text-indigo-600 dark:text-indigo-400 font-semibold">• Đang lọc: ${getProcessedItems().length} mục</span>
          </div>
          <div class="flex items-center gap-3 font-mono">
            <span id="storageDriveUsed">Đã dùng: ${state.stats ? formatBytes(state.stats.driveUsedBytes) : '...'}</span>
            <span>•</span>
            <span id="storageDiskFree">Còn trống: ${state.stats ? formatBytes(state.stats.diskFreeBytes) : '...'}</span>
          </div>
        </div>

      </div>

      <!-- Modals Container -->
      <div id="storageModalRoot"></div>

    </div>
  `;
}

/**
 * Renders Breadcrumbs navigation path
 */
function renderBreadcrumbs(currentPath) {
  const parts = currentPath.split('/').filter(Boolean);
  let html = `
    <button data-path="/" class="btn-breadcrumb hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold cursor-pointer flex items-center gap-1">
      <i data-lucide="home" class="w-3.5 h-3.5"></i>
      <span>Gốc</span>
    </button>
  `;

  let accumulated = '';
  parts.forEach((part, index) => {
    accumulated += `/${part}`;
    const isLast = index === parts.length - 1;
    html += `
      <span class="text-zinc-400">/</span>
      <button data-path="${escapeHtml(accumulated)}" class="btn-breadcrumb cursor-pointer ${isLast ? 'text-zinc-900 dark:text-white font-bold' : 'hover:text-indigo-600 dark:hover:text-indigo-400'}">
        ${escapeHtml(part)}
      </button>
    `;
  });

  return html;
}

/**
 * Renders the main file explorer area (Grid or List)
 */
function renderExplorerContent() {
  if (state.isLoading) {
    return `
      <div class="py-24 flex flex-col items-center justify-center space-y-3">
        <div class="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs text-zinc-400 font-mono">Đang đọc danh sách tệp...</p>
      </div>
    `;
  }

  const items = getProcessedItems();

  if (items.length === 0) {
    return `
      <div class="py-20 flex flex-col items-center justify-center space-y-3 text-center">
        <div class="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 flex items-center justify-center">
          <i data-lucide="folder-open" class="w-6 h-6"></i>
        </div>
        <div>
          <h4 class="font-bold text-sm text-zinc-800 dark:text-zinc-200">
            ${state.searchQuery ? 'Không tìm thấy tệp phù hợp' : 'Thư mục này hiện đang trống'}
          </h4>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            ${state.searchQuery ? 'Thử tìm kiếm với từ khóa khác' : 'Kéo thả tệp vào đây hoặc bấm nút "Tải lên" ở trên'}
          </p>
        </div>
      </div>
    `;
  }

  if (state.viewMode === 'list') {
    const isAllSelected = items.length > 0 && items.every((i) => state.selectedPaths.has(i.path));
    const sortIcon = (col) => {
      if (state.sortBy !== col) return '<i data-lucide="chevrons-up-down" class="w-3 h-3 text-zinc-400"></i>';
      return state.sortDirection === 'asc'
        ? '<i data-lucide="arrow-up" class="w-3 h-3 text-indigo-500"></i>'
        : '<i data-lucide="arrow-down" class="w-3 h-3 text-indigo-500"></i>';
    };

    return `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-zinc-100 dark:border-white/5 text-zinc-400 font-medium select-none">
              <th class="py-2.5 px-3 w-10">
                <input type="checkbox" id="storageSelectAllHeader" class="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer" ${isAllSelected ? 'checked' : ''} />
              </th>
              <th class="py-2.5 px-3 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition" data-sort-col="name">
                <div class="flex items-center gap-1.5">
                  <span>Tên mục</span>
                  ${sortIcon('name')}
                </div>
              </th>
              <th class="py-2.5 px-3 w-28 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition" data-sort-col="size">
                <div class="flex items-center gap-1.5">
                  <span>Kích thước</span>
                  ${sortIcon('size')}
                </div>
              </th>
              <th class="py-2.5 px-3 w-32 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition" data-sort-col="date">
                <div class="flex items-center gap-1.5">
                  <span>Ngày sửa đổi</span>
                  ${sortIcon('date')}
                </div>
              </th>
              <th class="py-2.5 px-3 w-40 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-white/5">
            ${items.map((item) => renderListItem(item)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Default: Grid View
  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      ${items.map((item) => renderGridItem(item)).join('')}
    </div>
  `;
}

/**
 * Grid Item Card Component
 */
function renderGridItem(item) {
  const visual = getFileVisualInfo(item);
  const preview = isPreviewable(item);
  const isSelected = state.selectedPaths.has(item.path);

  return `
    <div 
      class="group relative p-3 rounded-xl transition cursor-pointer select-none flex flex-col justify-between ${isSelected ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-500/50 shadow-sm' : 'bg-zinc-50/70 hover:bg-zinc-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] border-zinc-200/80 hover:border-zinc-300 dark:border-white/[0.06] dark:hover:border-white/15 border'}"
      data-item-path="${escapeHtml(item.path)}"
      data-is-dir="${item.isDirectory}"
    >
      <!-- Selection Checkbox -->
      <div data-checkbox-wrapper class="absolute top-2.5 right-2.5 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity p-1 cursor-pointer">
        <input 
          type="checkbox" 
          data-select-path="${escapeHtml(item.path)}" 
          class="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer pointer-events-none" 
          ${isSelected ? 'checked' : ''} 
        />
      </div>

      <div class="space-y-2.5">
        <div class="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/5 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform ${visual.color}">
          <i data-lucide="${visual.icon}" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0 pr-4">
          <p class="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" title="${escapeHtml(item.name)}">
            ${escapeHtml(item.name)}
          </p>
          <p class="text-[11px] text-zinc-400 font-mono mt-0.5">
            ${item.isDirectory ? 'Thư mục' : formatBytes(item.sizeBytes)}
          </p>
        </div>
      </div>

      <!-- Action Hover Overlay Controls -->
      <div class="flex items-center justify-end gap-0.5 mt-3 pt-2 border-t border-zinc-200/50 dark:border-white/5 opacity-80 group-hover:opacity-100 transition">
        ${preview ? `
          <button data-action="preview" data-item-path="${escapeHtml(item.path)}" title="Xem trước" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          </button>
        ` : ''}
        <button data-action="download" data-item-path="${escapeHtml(item.path)}" data-is-dir="${item.isDirectory}" title="${item.isDirectory ? 'Tải ZIP thư mục' : 'Tải về'}" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
        </button>
        <button data-action="move" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Di chuyển" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition cursor-pointer">
          <i data-lucide="folder-input" class="w-3.5 h-3.5"></i>
        </button>
        <button data-action="copy" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Sao chép" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition cursor-pointer">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        </button>
        <button data-action="rename" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Đổi tên" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
          <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
        </button>
        <button data-action="delete" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Xóa" class="p-1 rounded-md hover:bg-red-500/10 dark:hover:bg-red-500/20 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition cursor-pointer">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * List Item Row Component
 */
function renderListItem(item) {
  const visual = getFileVisualInfo(item);
  const preview = isPreviewable(item);
  const isSelected = state.selectedPaths.has(item.path);

  return `
    <tr 
      class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition cursor-pointer select-none group ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}"
      data-item-path="${escapeHtml(item.path)}"
      data-is-dir="${item.isDirectory}"
    >
      <td class="py-2 px-3" data-checkbox-wrapper>
        <input 
          type="checkbox" 
          data-select-path="${escapeHtml(item.path)}" 
          class="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer pointer-events-none" 
          ${isSelected ? 'checked' : ''} 
        />
      </td>
      <td class="py-2 px-3">
        <div class="flex items-center gap-2.5">
          <div class="shrink-0 ${visual.color}">
            <i data-lucide="${visual.icon}" class="w-4 h-4"></i>
          </div>
          <span class="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate max-w-xs sm:max-w-md">
            ${escapeHtml(item.name)}
          </span>
        </div>
      </td>
      <td class="py-2 px-3 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
        ${item.isDirectory ? '—' : formatBytes(item.sizeBytes)}
      </td>
      <td class="py-2 px-3 text-zinc-500 dark:text-zinc-400 text-[11px] whitespace-nowrap font-mono">
        ${formatRelativeTime(item.updatedAt)}
      </td>
      <td class="py-2 px-3 text-right">
        <div class="flex items-center justify-end gap-1">
          ${preview ? `
            <button data-action="preview" data-item-path="${escapeHtml(item.path)}" title="Xem trước" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
          <button data-action="download" data-item-path="${escapeHtml(item.path)}" data-is-dir="${item.isDirectory}" title="${item.isDirectory ? 'Tải ZIP thư mục' : 'Tải về'}" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="move" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Di chuyển" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition cursor-pointer">
            <i data-lucide="folder-input" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="copy" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Sao chép" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition cursor-pointer">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="rename" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Đổi tên" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="delete" data-item-path="${escapeHtml(item.path)}" data-item-name="${escapeHtml(item.name)}" title="Xóa" class="p-1 rounded-md hover:bg-red-500/10 dark:hover:bg-red-500/20 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition cursor-pointer">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Lock Screen View
 */
function renderLockScreen() {
  return `
    <div class="max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] shadow-xl text-center space-y-5 animate-fadeIn">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-xs">
        <i data-lucide="shield-alert" class="w-7 h-7"></i>
      </div>

      <div class="space-y-1.5">
        <h2 class="text-lg font-bold text-zinc-900 dark:text-white">Kho Lưu Trữ Tệp Được Bảo Vệ</h2>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Nhập mật khẩu quản trị để truy cập và quản lý tài liệu cá nhân giữa các thiết bị.
        </p>
      </div>

      <div class="space-y-3 text-left">
        <div>
          <label class="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Mật khẩu mở khóa</label>
          <input 
            type="password" 
            id="storageLockPwdInput" 
            placeholder="Nhập mật khẩu..." 
            autocomplete="current-password"
            class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 transition font-sans"
          />
        </div>
        <p id="storageLockError" class="text-[11px] text-red-500 font-medium hidden">Mật khẩu không chính xác</p>

        <button 
          id="btnStorageUnlock" 
          class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <i data-lucide="key" class="w-3.5 h-3.5"></i> Mở khóa kho lưu trữ
        </button>
      </div>
    </div>
  `;
}

/**
 * Controller Event Attachments & Lifecycle Management
 */
export function attachStoragePageListeners(onSoftReRender) {
  const isUnlocked = isAdminAuthenticated();

  // If locked, wire unlock events
  if (!isUnlocked) {
    const input = document.getElementById('storageLockPwdInput');
    const btnUnlock = document.getElementById('btnStorageUnlock');
    const errEl = document.getElementById('storageLockError');

    if (input) input.focus();

    const handleUnlock = async () => {
      const val = input ? input.value : '';
      if (!val) return;
      if (btnUnlock) btnUnlock.disabled = true;

      const ok = await verifyAdminPassword(val);
      if (btnUnlock) btnUnlock.disabled = false;

      if (ok) {
        showToast('Đã mở khóa kho lưu trữ thành công', 'success');
        onSoftReRender();
      } else {
        if (errEl) errEl.classList.remove('hidden');
        if (input) {
          input.classList.add('border-red-500');
          input.focus();
          input.select();
        }
      }
    };

    if (btnUnlock) btnUnlock.onclick = handleUnlock;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') handleUnlock();
      };
    }
    return () => {};
  }

  // --- Unlocked State Logic ---
  const updateBatchToolbar = () => {
    const toolbar = document.getElementById('storageBatchToolbar');
    const countText = document.getElementById('storageSelectedCountText');
    if (!toolbar) return;

    if (state.selectedPaths.size > 0) {
      toolbar.classList.remove('hidden');
      if (countText) countText.textContent = `Đã chọn ${state.selectedPaths.size} mục`;
    } else {
      toolbar.classList.add('hidden');
    }
  };

  const updateStatusBar = () => {
    const itemCountEl = document.getElementById('storageItemCount');
    const folderCountEl = document.getElementById('storageFolderCount');
    const fileCountEl = document.getElementById('storageFileCount');
    const filteredSpan = document.getElementById('storageFilteredCount');
    const driveUsedEl = document.getElementById('storageDriveUsed');
    const diskFreeEl = document.getElementById('storageDiskFree');

    if (itemCountEl) itemCountEl.textContent = `${state.items.length} mục`;
    if (folderCountEl) folderCountEl.textContent = `${state.items.filter((i) => i.isDirectory).length} thư mục`;
    if (fileCountEl) fileCountEl.textContent = `${state.items.filter((i) => !i.isDirectory).length} tệp tin`;
    if (driveUsedEl && state.stats) driveUsedEl.textContent = `Đã dùng: ${formatBytes(state.stats.driveUsedBytes)}`;
    if (diskFreeEl && state.stats) diskFreeEl.textContent = `Còn trống: ${formatBytes(state.stats.diskFreeBytes)}`;

    if (filteredSpan) {
      if (state.searchQuery) {
        filteredSpan.textContent = `• Đang lọc: ${getProcessedItems().length} mục`;
        filteredSpan.classList.remove('hidden');
      } else {
        filteredSpan.classList.add('hidden');
      }
    }
  };

  const rerenderContentOnly = () => {
    const contentArea = document.getElementById('storageContentArea');
    if (contentArea) {
      contentArea.innerHTML = renderExplorerContent();
      if (window.lucide) window.lucide.createIcons();
    }
    updateBatchToolbar();
    updateStatusBar();
  };

  const loadDirectory = async (targetPath = state.currentPath) => {
    state.isLoading = true;
    state.currentPath = targetPath;
    state.error = null;
    state.selectedPaths.clear();
    rerenderContentOnly();

    try {
      const data = await StorageService.fetchList(targetPath);
      state.items = data.items || [];
      state.stats = data.stats || null;
      state.currentPath = data.currentPath || targetPath;
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        lockAdminSession();
        onSoftReRender();
        return;
      }
      showToast(err.message || 'Không thể tải danh sách tệp', 'error');
    } finally {
      state.isLoading = false;
      const breadcrumbEl = document.getElementById('storageBreadcrumbContainer');
      rerenderContentOnly();
      if (breadcrumbEl) breadcrumbEl.innerHTML = renderBreadcrumbs(state.currentPath);
      if (window.lucide) window.lucide.createIcons();
    }
  };

  const navigateToPath = (targetPath) => {
    const cleanPath = targetPath || '/';
    const targetHash = cleanPath === '/' ? '#storage' : `#storage?path=${encodeURIComponent(cleanPath)}`;
    if (window.location.hash !== targetHash) {
      history.pushState(null, '', targetHash);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ds_last_route', targetHash);
      }
    }
    loadDirectory(cleanPath);
  };

  // Popstate listener for browser Back/Forward navigation
  const onPopState = () => {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#storage')) return;
    const hashPath = getStoragePathFromHash();
    if (hashPath !== state.currentPath) {
      loadDirectory(hashPath);
    }
  };
  window.addEventListener('popstate', onPopState);

  // Initial load
  loadDirectory(getStoragePathFromHash());

  // Search Filter
  const searchInput = document.getElementById('inputStorageSearch');
  const btnClearSearch = document.getElementById('btnStorageClearSearch');
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      if (btnClearSearch) {
        btnClearSearch.classList.toggle('hidden', !state.searchQuery);
      }
      rerenderContentOnly();
    };
  }
  if (btnClearSearch) {
    btnClearSearch.onclick = () => {
      state.searchQuery = '';
      if (searchInput) searchInput.value = '';
      btnClearSearch.classList.add('hidden');
      rerenderContentOnly();
    };
  }

  // Select All Toggle Button
  const btnSelectAllToggle = document.getElementById('btnStorageSelectAllToggle');
  if (btnSelectAllToggle) {
    btnSelectAllToggle.onclick = () => {
      const items = getProcessedItems();
      if (items.length === 0) return;
      const isAllSelected = items.every((i) => state.selectedPaths.has(i.path));
      if (isAllSelected) {
        state.selectedPaths.clear();
      } else {
        items.forEach((i) => state.selectedPaths.add(i.path));
      }
      rerenderContentOnly();
    };
  }

  // Sort Select Menu
  const sortSelect = document.getElementById('selectStorageSort');
  if (sortSelect) {
    sortSelect.onchange = (e) => {
      const val = e.target.value;
      const [col, dir] = val.split('_');
      state.sortBy = col;
      state.sortDirection = dir;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ds_storage_sort_by', col);
        localStorage.setItem('ds_storage_sort_dir', dir);
      }
      rerenderContentOnly();
    };
  }

  // View Mode Toggles (Seamless re-render without server re-fetch)
  const btnGrid = document.getElementById('btnStorageViewGrid');
  const btnList = document.getElementById('btnStorageViewList');
  if (btnGrid && btnList) {
    btnGrid.onclick = () => {
      state.viewMode = 'grid';
      if (typeof localStorage !== 'undefined') localStorage.setItem('ds_storage_view_mode', 'grid');
      btnGrid.className = 'p-1.5 rounded-lg transition cursor-pointer bg-white dark:bg-white/15 text-indigo-600 dark:text-white shadow-2xs';
      btnList.className = 'p-1.5 rounded-lg transition cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white';
      rerenderContentOnly();
    };

    btnList.onclick = () => {
      state.viewMode = 'list';
      if (typeof localStorage !== 'undefined') localStorage.setItem('ds_storage_view_mode', 'list');
      btnList.className = 'p-1.5 rounded-lg transition cursor-pointer bg-white dark:bg-white/15 text-indigo-600 dark:text-white shadow-2xs';
      btnGrid.className = 'p-1.5 rounded-lg transition cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white';
      rerenderContentOnly();
    };
  }

  // Refresh Button
  const btnRefresh = document.getElementById('btnStorageRefresh');
  if (btnRefresh) {
    btnRefresh.onclick = () => loadDirectory();
  }

  // Lock Session Button
  const btnLock = document.getElementById('btnStorageLock');
  if (btnLock) {
    btnLock.onclick = () => {
      lockAdminSession();
      showToast('Đã khóa phiên làm việc kho lưu trữ', 'info');
      onSoftReRender();
    };
  }

  // File Upload Input
  const fileInput = document.getElementById('storageFileInput');
  if (fileInput) {
    fileInput.onchange = async () => {
      const files = fileInput.files;
      if (!files || files.length === 0) return;
      await handleUploadFiles(files, loadDirectory);
      fileInput.value = '';
    };
  }

  // Drag and Drop Zone with anti-flicker counter
  const dropZone = document.getElementById('storageDropZone');
  const dropOverlay = document.getElementById('storageDropOverlay');
  let dragCounter = 0;

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dropOverlay) dropOverlay.classList.remove('hidden');
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (dropOverlay) dropOverlay.classList.add('hidden');
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    if (dropOverlay) dropOverlay.classList.add('hidden');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUploadFiles(e.dataTransfer.files, loadDirectory);
    }
  };

  // Prevent accidental drop navigation outside drop zone
  const onWindowDragOver = (e) => e.preventDefault();
  const onWindowDrop = (e) => e.preventDefault();

  if (dropZone && dropOverlay) {
    dropZone.addEventListener('dragenter', onDragEnter);
    dropZone.addEventListener('dragover', onDragOver);
    dropZone.addEventListener('dragleave', onDragLeave);
    dropZone.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
  }

  // New Folder Button & Modal
  const btnNewFolder = document.getElementById('btnStorageNewFolder');
  if (btnNewFolder) {
    btnNewFolder.onclick = () => {
      showNewFolderModal(async (folderName) => {
        try {
          await StorageService.createFolder(state.currentPath, folderName);
          showToast(`Đã tạo thư mục "${folderName}"`, 'success');
          loadDirectory();
        } catch (err) {
          showToast(err.message || 'Không thể tạo thư mục', 'error');
        }
      });
    };
  }

  // Batch Operations Button Handlers
  const btnBatchDownload = document.getElementById('btnStorageBatchDownload');
  const btnBatchMove = document.getElementById('btnStorageBatchMove');
  const btnBatchCopy = document.getElementById('btnStorageBatchCopy');
  const btnBatchDelete = document.getElementById('btnStorageBatchDelete');
  const btnBatchClear = document.getElementById('btnStorageBatchClear');

  if (btnBatchDownload) {
    btnBatchDownload.onclick = () => {
      handleDownloadBatch(Array.from(state.selectedPaths));
    };
  }

  if (btnBatchMove) {
    btnBatchMove.onclick = () => {
      handleMoveCopyModal(Array.from(state.selectedPaths), false, () => {
        state.selectedPaths.clear();
        loadDirectory();
      });
    };
  }

  if (btnBatchCopy) {
    btnBatchCopy.onclick = () => {
      handleMoveCopyModal(Array.from(state.selectedPaths), true, () => {
        state.selectedPaths.clear();
        loadDirectory();
      });
    };
  }

  if (btnBatchDelete) {
    btnBatchDelete.onclick = () => {
      handleBatchDeleteItem(Array.from(state.selectedPaths), () => {
        state.selectedPaths.clear();
        loadDirectory();
      });
    };
  }

  if (btnBatchClear) {
    btnBatchClear.onclick = () => {
      state.selectedPaths.clear();
      rerenderContentOnly();
    };
  }

  // Global Keyboard Shortcuts (Escape to deselect, Ctrl+A to select all)
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (state.selectedPaths.size > 0) {
        state.selectedPaths.clear();
        rerenderContentOnly();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      e.preventDefault();
      const items = getProcessedItems();
      if (items.length > 0) {
        if (state.selectedPaths.size === items.length) {
          state.selectedPaths.clear();
        } else {
          items.forEach(i => state.selectedPaths.add(i.path));
        }
        rerenderContentOnly();
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);

  // Global Click Delegator for Item Navigation, Sort, & Actions
  const contentArea = document.getElementById('storageContentArea');
  if (contentArea) {
    contentArea.onclick = (e) => {
      // 0. Column Header Sort Click in List View
      const sortTh = e.target.closest('[data-sort-col]');
      if (sortTh) {
        const col = sortTh.dataset.sortCol;
        if (state.sortBy === col) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortBy = col;
          state.sortDirection = 'asc';
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ds_storage_sort_by', state.sortBy);
          localStorage.setItem('ds_storage_sort_dir', state.sortDirection);
        }
        const sortSel = document.getElementById('selectStorageSort');
        if (sortSel) {
          sortSel.value = `${state.sortBy}_${state.sortDirection}`;
        }
        rerenderContentOnly();
        return;
      }

      // 0.1 Header Select All Checkbox Click
      const selectAllCb = e.target.closest('#storageSelectAllHeader');
      if (selectAllCb) {
        const items = getProcessedItems();
        if (selectAllCb.checked) {
          items.forEach((i) => state.selectedPaths.add(i.path));
        } else {
          state.selectedPaths.clear();
        }
        rerenderContentOnly();
        return;
      }

      // 0.2 Checkbox wrapper or input click
      const cbWrapper = e.target.closest('[data-checkbox-wrapper]');
      const itemCb = e.target.closest('[data-select-path]');
      if (cbWrapper || itemCb) {
        e.stopPropagation();
        const path = itemCb?.dataset?.selectPath || cbWrapper?.querySelector('[data-select-path]')?.dataset?.selectPath;
        if (path) {
          if (state.selectedPaths.has(path)) {
            state.selectedPaths.delete(path);
          } else {
            state.selectedPaths.add(path);
          }
          rerenderContentOnly();
        }
        return;
      }

      // 1. Actions Buttons
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const itemPath = actionBtn.dataset.itemPath;
        const isDir = actionBtn.dataset.isDir === 'true';
        const itemName = actionBtn.dataset.itemName;

        if (action === 'download') {
          handleDownloadItem(itemPath, isDir);
        } else if (action === 'preview') {
          const item = state.items.find((i) => i.path === itemPath);
          if (item) ViewerConnector.preview(item);
        } else if (action === 'move') {
          handleMoveCopyModal([itemPath], false, loadDirectory);
        } else if (action === 'copy') {
          handleMoveCopyModal([itemPath], true, loadDirectory);
        } else if (action === 'rename') {
          handleRenameItem(itemPath, itemName, loadDirectory);
        } else if (action === 'delete') {
          handleDeleteItem(itemPath, itemName, loadDirectory);
        }
        return;
      }

      // 2. Folder Navigation or File Preview (Clicking card or row)
      const itemEl = e.target.closest('[data-item-path]');
      if (itemEl) {
        const isDir = itemEl.dataset.isDir === 'true';
        const itemPath = itemEl.dataset.itemPath;
        if (isDir) {
          navigateToPath(itemPath);
        } else {
          const item = state.items.find((i) => i.path === itemPath);
          if (item) ViewerConnector.preview(item);
        }
      }
    };
  }

  // Breadcrumb Click Delegator
  const breadcrumbContainer = document.getElementById('storageBreadcrumbContainer');
  if (breadcrumbContainer) {
    breadcrumbContainer.onclick = (e) => {
      const btn = e.target.closest('.btn-breadcrumb');
      if (btn && btn.dataset.path) {
        navigateToPath(btn.dataset.path);
      }
    };
  }

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('popstate', onPopState);
    if (dropZone) {
      dropZone.removeEventListener('dragenter', onDragEnter);
      dropZone.removeEventListener('dragover', onDragOver);
      dropZone.removeEventListener('dragleave', onDragLeave);
      dropZone.removeEventListener('drop', onDrop);
    }
    window.removeEventListener('dragover', onWindowDragOver);
    window.removeEventListener('drop', onWindowDrop);
  };
}

/**
 * Handles Upload Flow with Progress Visualization
 */
async function handleUploadFiles(files, onComplete) {
  const dock = document.getElementById('storageUploadDock');
  const bar = document.getElementById('storageProgressBar');
  const txt = document.getElementById('storageUploadText');
  const pct = document.getElementById('storageUploadPercent');
  const statsEl = document.getElementById('storageUploadStats');
  const btnPause = document.getElementById('btnStoragePauseUpload');
  const btnCancel = document.getElementById('btnStorageCancelUpload');
  const indicator = document.getElementById('storageUploadIndicator');

  state.isUploading = true;
  state.uploadProgress = 0;
  state.uploadStatusText = `Đang chuẩn bị tải lên ${files.length} tệp...`;

  if (dock) dock.classList.remove('hidden');
  if (bar) bar.style.width = '0%';
  if (pct) pct.textContent = '0%';
  if (txt) txt.textContent = state.uploadStatusText;
  if (statsEl) statsEl.textContent = '';

  let currentUploader = null;

  if (btnPause) {
    btnPause.onclick = () => {
      if (!currentUploader) return;
      if (currentUploader.isPaused) {
        currentUploader.resume();
        btnPause.textContent = 'Tạm dừng';
        if (indicator) indicator.classList.add('animate-ping');
      } else {
        currentUploader.pause();
        btnPause.textContent = 'Tiếp tục';
        if (indicator) indicator.classList.remove('animate-ping');
        if (txt) txt.textContent = 'Đã tạm dừng tải lên';
      }
    };
  }

  if (btnCancel) {
    btnCancel.onclick = () => {
      if (currentUploader) {
        currentUploader.cancel();
      }
    };
  }

  try {
    await StorageService.uploadFiles(
      files,
      state.currentPath,
      (percent, loaded, total, telemetry) => {
        state.uploadProgress = percent;
        if (bar) bar.style.width = `${percent}%`;
        if (pct) pct.textContent = `${percent}%`;

        if (statsEl && telemetry) {
          const parts = [];
          if (telemetry.formattedUploaded && telemetry.formattedTotal) {
            parts.push(`${telemetry.formattedUploaded} / ${telemetry.formattedTotal}`);
          }
          if (telemetry.formattedSpeed) parts.push(telemetry.formattedSpeed);
          if (telemetry.formattedEta && telemetry.formattedEta !== '--') {
            parts.push(`Còn ${telemetry.formattedEta}`);
          }
          statsEl.textContent = parts.join(' • ');
        }
      },
      {
        onUploaderCreated: (uploader) => {
          currentUploader = uploader;
          if (btnPause) btnPause.classList.remove('hidden');
          if (btnCancel) btnCancel.classList.remove('hidden');
        },
        onStage: (stage, fileIdx, totalCount, file) => {
          state.uploadStatusText = totalCount > 1 
            ? `[${fileIdx}/${totalCount}] ${file.name}: ${stage}`
            : `${file.name}: ${stage}`;
          if (txt) txt.textContent = state.uploadStatusText;
        }
      }
    );

    showToast(`Đã tải lên thành công ${files.length} tệp`, 'success');
    if (typeof onComplete === 'function') onComplete();
  } catch (err) {
    if (err.message && err.message.includes('Đã hủy')) {
      showToast('Đã hủy tải tệp lên', 'info');
    } else {
      showToast(err.message || 'Lỗi tải lên tệp', 'error');
    }
  } finally {
    state.isUploading = false;
    currentUploader = null;
    if (btnPause) btnPause.classList.add('hidden');
    if (btnCancel) btnCancel.classList.add('hidden');
    setTimeout(() => {
      if (dock && !state.isUploading) dock.classList.add('hidden');
    }, 1200);
  }
}

/**
 * Handles Single Item Download
 */
function handleDownloadItem(itemPath, isDir) {
  try {
    const url = StorageService.getDownloadUrl(itemPath);
    const a = document.createElement('a');
    a.href = url;
    const baseName = itemPath ? itemPath.split('/').filter(Boolean).pop() || 'download' : 'download';
    a.download = isDir ? `${baseName}.zip` : baseName;
    if (isDir) {
      showToast(`Đang đóng gói "${baseName}" thành file nén ZIP và tải xuống...`, 'info');
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    showToast(err.message || 'Không thể tạo liên kết tải xuống', 'error');
  }
}

/**
 * Handles Batch Download of multiple items as a ZIP archive
 */
function handleDownloadBatch(paths) {
  try {
    if (!paths || paths.length === 0) return;
    const url = StorageService.getBatchDownloadUrl(paths);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Storage_Archive.zip';
    showToast(`Đang đóng gói ${paths.length} mục đã chọn thành file ZIP và tải xuống...`, 'info');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    showToast(err.message || 'Không thể tạo liên kết tải xuống', 'error');
  }
}

/**
 * Modal for creating a new directory
 */
function showNewFolderModal(onConfirm) {
  const modalRoot = document.getElementById('storageModalRoot');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="folder-plus" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-sm text-zinc-900 dark:text-white">Tạo Thư Mục Mới</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Đặt tên cho thư mục mới</p>
          </div>
        </div>

        <div>
          <input 
            type="text" 
            id="inputNewFolderName" 
            placeholder="Tên thư mục..." 
            class="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button id="btnCancelNewFolder" class="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer">
            Hủy
          </button>
          <button id="btnSubmitNewFolder" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer">
            Tạo
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const cleanup = () => { modalRoot.innerHTML = ''; };
  const input = document.getElementById('inputNewFolderName');
  const btnSubmit = document.getElementById('btnSubmitNewFolder');
  const btnCancel = document.getElementById('btnCancelNewFolder');

  if (input) input.focus();

  const handleSubmit = () => {
    const val = input ? input.value.trim() : '';
    if (!val) return;
    cleanup();
    if (typeof onConfirm === 'function') onConfirm(val);
  };

  if (btnSubmit) btnSubmit.onclick = handleSubmit;
  if (btnCancel) btnCancel.onclick = cleanup;
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') cleanup();
    };
  }
}

/**
 * Modal for renaming an item
 */
function handleRenameItem(itemPath, oldName, onComplete) {
  const modalRoot = document.getElementById('storageModalRoot');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <i data-lucide="edit-2" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-sm text-zinc-900 dark:text-white">Đổi Tên Mục</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-[200px]">${escapeHtml(oldName)}</p>
          </div>
        </div>

        <div>
          <input 
            type="text" 
            id="inputRenameItem" 
            value="${escapeHtml(oldName)}"
            class="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button id="btnCancelRename" class="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer">
            Hủy
          </button>
          <button id="btnSubmitRename" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer">
            Lưu
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const cleanup = () => { modalRoot.innerHTML = ''; };
  const input = document.getElementById('inputRenameItem');
  const btnSubmit = document.getElementById('btnSubmitRename');
  const btnCancel = document.getElementById('btnCancelRename');

  if (input) {
    input.focus();
    input.select();
  }

  const handleSubmit = async () => {
    const val = input ? input.value.trim() : '';
    if (!val || val === oldName) return cleanup();
    cleanup();
    try {
      await StorageService.renameItem(itemPath, val);
      showToast('Đã đổi tên thành công', 'success');
      if (typeof onComplete === 'function') onComplete();
    } catch (err) {
      showToast(err.message || 'Không thể đổi tên', 'error');
    }
  };

  if (btnSubmit) btnSubmit.onclick = handleSubmit;
  if (btnCancel) btnCancel.onclick = cleanup;
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') cleanup();
    };
  }
}

/**
 * Interactive Modal for Moving or Copying items to any destination directory
 */
function handleMoveCopyModal(itemPaths, isCopy = false, onComplete) {
  const modalRoot = document.getElementById('storageModalRoot');
  if (!modalRoot || !itemPaths || itemPaths.length === 0) return;

  let browsePath = '/';
  let selectedDest = '/';
  let isLoadingFolders = false;
  let subfolders = [];

  const title = isCopy ? 'Sao Chép Mục' : 'Di Chuyển Mục';
  const actionText = isCopy ? 'Sao chép' : 'Di chuyển';
  const icon = isCopy ? 'copy' : 'folder-input';
  const iconColor = isCopy ? 'text-blue-500 bg-blue-500/10' : 'text-amber-500 bg-amber-500/10';

  const cleanup = () => { modalRoot.innerHTML = ''; };

  const fetchCurrentSubfolders = async () => {
    isLoadingFolders = true;
    renderModalBody();
    try {
      const data = await StorageService.fetchList(browsePath);
      // Filter out invalid directories
      // Filter out invalid directories: cannot move or copy a directory into itself or its subdirectories
      subfolders = (data.items || []).filter((item) => {
        if (!item.isDirectory) return false;
        for (const src of itemPaths) {
          if (item.path === src || item.path.startsWith(src + '/')) return false;
        }
        return true;
      });
    } catch (err) {
      showToast(err.message || 'Không thể đọc danh sách thư mục', 'error');
      subfolders = [];
    } finally {
      isLoadingFolders = false;
      renderModalBody();
    }
  };

  const renderModalBody = () => {
    const parentPath = browsePath === '/' ? null : (browsePath.split('/').slice(0, -1).join('/') || '/');

    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
        <div class="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center shrink-0">
              <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-sm text-zinc-900 dark:text-white truncate">${title}</h4>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                ${actionText} ${itemPaths.length} mục đã chọn tới thư mục đích
              </p>
            </div>
          </div>

          <!-- Directory Browser Path Bar -->
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-100 dark:bg-black/30 border border-zinc-200 dark:border-white/5 text-xs">
            <div class="flex items-center gap-1.5 min-w-0 font-mono text-zinc-700 dark:text-zinc-300 truncate">
              <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i>
              <span class="truncate font-semibold" title="${escapeHtml(browsePath)}">${escapeHtml(browsePath === '/' ? 'Thư mục gốc' : browsePath)}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${parentPath !== null ? `
                <button id="btnBrowseUp" type="button" class="p-2 sm:p-1 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 text-xs transition cursor-pointer" title="Lên thư mục cha">
                  <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
              <button id="btnNewFolderInside" type="button" class="p-2 sm:p-1 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 text-xs transition cursor-pointer" title="Tạo thư mục mới tại đây">
                <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- Target Selection & Folder List -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Chọn thư mục đích:</label>
              <span class="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[200px]" title="${escapeHtml(selectedDest)}">Đích: ${escapeHtml(selectedDest === '/' ? 'Thư mục gốc' : selectedDest)}</span>
            </div>

            <div class="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-black/20 divide-y divide-zinc-100 dark:divide-white/5">
              <!-- Option to pick current browse directory as destination -->
              <div class="flex items-center justify-between p-2.5 hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] transition cursor-pointer select-none">
                <label class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                  <input type="radio" name="destDirectory" value="${escapeHtml(browsePath)}" ${selectedDest === browsePath ? 'checked' : ''} class="text-indigo-600 focus:ring-0 cursor-pointer" />
                  <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 shrink-0"></i>
                  <span class="text-xs font-semibold text-zinc-900 dark:text-white truncate">Đặt tại thư mục hiện tại: ${escapeHtml(browsePath === '/' ? 'Thư mục gốc' : browsePath.split('/').pop())}</span>
                </label>
              </div>

              ${isLoadingFolders ? `
                <div class="py-8 flex flex-col items-center justify-center space-y-2">
                  <div class="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span class="text-[11px] text-zinc-400 font-mono">Đang đọc thư mục...</span>
                </div>
              ` : subfolders.length === 0 ? `
                <div class="py-6 text-center text-xs text-zinc-400">Không có thư mục con nào</div>
              ` : subfolders.map(sub => `
                <div class="flex items-center justify-between p-2.5 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition group">
                  <label class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none">
                    <input type="radio" name="destDirectory" value="${escapeHtml(sub.path)}" ${selectedDest === sub.path ? 'checked' : ''} class="text-indigo-600 focus:ring-0 cursor-pointer" />
                    <i data-lucide="folder" class="w-4 h-4 text-amber-500 shrink-0"></i>
                    <span class="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">${escapeHtml(sub.name)}</span>
                  </label>
                  <button type="button" data-open-folder="${escapeHtml(sub.path)}" class="px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg bg-zinc-200/60 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 shrink-0">
                    <span>Mở</span>
                    <i data-lucide="chevron-right" class="w-3 h-3"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button id="btnCancelMoveCopy" class="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer">
              Hủy
            </button>
            <button id="btnSubmitMoveCopy" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer flex items-center gap-1.5">
              <span>${actionText} tới đây</span>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    const btnSubmit = document.getElementById('btnSubmitMoveCopy');
    const btnCancel = document.getElementById('btnCancelMoveCopy');
    const btnUp = document.getElementById('btnBrowseUp');
    const btnNewFolder = document.getElementById('btnNewFolderInside');

    if (btnCancel) btnCancel.onclick = cleanup;

    if (btnUp && parentPath !== null) {
      btnUp.onclick = () => {
        browsePath = parentPath;
        selectedDest = parentPath;
        fetchCurrentSubfolders();
      };
    }

    if (btnNewFolder) {
      btnNewFolder.onclick = () => {
        showNewFolderModal(async (folderName) => {
          try {
            await StorageService.createFolder(browsePath, folderName);
            showToast(`Đã tạo thư mục "${folderName}"`, 'success');
            fetchCurrentSubfolders();
          } catch (err) {
            showToast(err.message || 'Không thể tạo thư mục', 'error');
          }
        });
      };
    }

    modalRoot.querySelectorAll('input[name="destDirectory"]').forEach((radio) => {
      radio.onchange = (e) => {
        selectedDest = e.target.value;
      };
    });

    modalRoot.querySelectorAll('[data-open-folder]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        browsePath = btn.dataset.openFolder;
        selectedDest = browsePath;
        fetchCurrentSubfolders();
      };
    });

    if (btnSubmit) {
      btnSubmit.onclick = async () => {
        const dest = selectedDest || '/';
        if (!isCopy && dest === state.currentPath) {
          showToast('Mục đã nằm trong thư mục đích', 'warning');
          return;
        }
        cleanup();
        try {
          if (isCopy) {
            await StorageService.copyItem(itemPaths, dest);
          } else {
            await StorageService.moveItem(itemPaths, dest);
          }
          showToast(`Đã ${actionText.toLowerCase()} thành công ${itemPaths.length} mục`, 'success');
          if (typeof onComplete === 'function') onComplete();
        } catch (err) {
          showToast(err.message || `Lỗi khi ${actionText.toLowerCase()}`, 'error');
        }
      };
    }
  };

  fetchCurrentSubfolders();
}

/**
 * Handles Single Item Deletion with slide-to-confirm modal
 */
function handleDeleteItem(itemPath, itemName, onComplete) {
  openSlideConfirmModal({
    title: 'Xóa mục lưu trữ',
    description: `Xóa vĩnh viễn "${itemName}" khỏi hệ thống lưu trữ.`,
    warningText: 'Hành động này không thể hoàn tác.',
    actionText: 'Kéo sang phải để xóa vĩnh viễn',
    confirmingText: 'Đang xóa...',
    onConfirm: async () => {
      try {
        await StorageService.deleteItem(itemPath);
        showToast(`Đã xóa "${itemName}"`, 'success');
        if (typeof onComplete === 'function') onComplete();
      } catch (err) {
        showToast(err.message || 'Lỗi khi xóa', 'error');
      }
    }
  });
}

/**
 * Handles Batch Deletion with slide-to-confirm modal
 */
function handleBatchDeleteItem(itemPaths, onComplete) {
  if (!itemPaths || itemPaths.length === 0) return;

  openSlideConfirmModal({
    title: 'Xóa nhiều mục lưu trữ',
    description: `Xóa vĩnh viễn ${itemPaths.length} mục đã chọn khỏi hệ thống lưu trữ.`,
    warningText: 'Hành động này không thể hoàn tác.',
    actionText: `Kéo sang phải để xóa ${itemPaths.length} mục`,
    confirmingText: 'Đang xóa các mục...',
    onConfirm: async () => {
      try {
        await StorageService.deleteItems(itemPaths);
        showToast(`Đã xóa thành công ${itemPaths.length} mục`, 'success');
        if (typeof onComplete === 'function') onComplete();
      } catch (err) {
        showToast(err.message || 'Lỗi khi xóa các mục', 'error');
      }
    }
  });
}
