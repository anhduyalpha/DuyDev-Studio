/**
 * StoragePage.js - CasaOS Files Style Storage Drive Controller
 * Features: Password guard, Breadcrumb navigation, Drag & Drop upload,
 * Folder ZIP download, File Preview, Rename, Delete, and Storage Telemetry.
 */

import { StorageService } from '../services/storageService.js';
import { ViewerConnector } from '../components/common/viewer/FileViewerConnector.js';
import { isAdminAuthenticated, verifyAdminPassword, lockAdminSession } from '../utilities/adminAuth.js';
import { formatBytes, formatRelativeTime } from '../utilities/formatters.js';
import { showToast } from '../utilities/toast.js';
import { openSlideConfirmModal } from '../components/common/SlideConfirmModal.js';

// Internal controller state
const state = {
  currentPath: '/',
  items: [],
  stats: null,
  viewMode: 'grid', // 'grid' | 'list'
  searchQuery: '',
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
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'avif'].includes(ext)) {
    return { icon: 'image', color: 'text-blue-500' };
  }
  if (ext === 'pdf') {
    return { icon: 'file-text', color: 'text-rose-500' };
  }
  if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
    return { icon: 'video', color: 'text-cyan-500' };
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return { icon: 'music', color: 'text-emerald-500' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return { icon: 'archive', color: 'text-amber-600' };
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh', 'sql', 'c', 'cpp', 'rs', 'go'].includes(ext)) {
    return { icon: 'file-code', color: 'text-indigo-500' };
  }
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md'].includes(ext)) {
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
 * Main Render Function
 */
export function renderStoragePage() {
  const isUnlocked = isAdminAuthenticated();

  if (!isUnlocked) {
    return renderLockScreen();
  }

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
              value="${state.searchQuery}"
              class="w-36 sm:w-48 pl-8 pr-3 py-1.5 rounded-xl glass-search text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none transition font-sans"
            />
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

          <!-- New Folder Button -->
          <button id="btnStorageNewFolder" class="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition border border-zinc-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
            <span>Thư mục mới</span>
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

      <!-- Upload Progress Dock (Visible during upload) -->
      <div id="storageUploadDock" class="${state.isUploading ? '' : 'hidden'} p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 space-y-2">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
          <div class="flex items-center gap-2 min-w-0">
            <div id="storageUploadIndicator" class="w-2 h-2 rounded-full bg-indigo-500 animate-ping shrink-0"></div>
            <span id="storageUploadText" class="truncate">${state.uploadStatusText || 'Đang tải lên tệp...'}</span>
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
          <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg animate-bounce">
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
          <div class="flex items-center gap-2 font-mono">
            <span id="storageItemCount">${state.items.length} mục</span>
            <span>•</span>
            <span id="storageFolderCount">${state.items.filter(i => i.isDirectory).length} thư mục</span>
            <span>•</span>
            <span id="storageFileCount">${state.items.filter(i => !i.isDirectory).length} tệp tin</span>
          </div>
          <div class="flex items-center gap-3 font-mono">
            <span id="storageDriveUsed">Đã dùng: ${state.stats ? formatBytes(state.stats.driveUsedBytes) : '...'}</span>
            <span>•</span>
            <span id="storageDiskFree">Còn trống: ${state.stats ? formatBytes(state.stats.diskFreeBytes) : '...'}</span>
          </div>
        </div>

      </div>

      <!-- New Folder Modal Container -->
      <div id="storageNewFolderModalRoot"></div>

      <!-- Rename Modal Container -->
      <div id="storageRenameModalRoot"></div>

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
      <button data-path="${accumulated}" class="btn-breadcrumb cursor-pointer ${isLast ? 'text-zinc-900 dark:text-white font-bold' : 'hover:text-indigo-600 dark:hover:text-indigo-400'}">
        ${part}
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

  const query = state.searchQuery.toLowerCase().trim();
  const filtered = state.items.filter(item => {
    if (!query) return true;
    return item.name.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    return `
      <div class="py-20 flex flex-col items-center justify-center space-y-3 text-center">
        <div class="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 flex items-center justify-center">
          <i data-lucide="folder-open" class="w-6 h-6"></i>
        </div>
        <div>
          <h4 class="font-bold text-sm text-zinc-800 dark:text-zinc-200">
            ${query ? 'Không tìm thấy tệp phù hợp' : 'Thư mục này hiện đang trống'}
          </h4>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            ${query ? 'Thử tìm kiếm với từ khóa khác' : 'Kéo thả tệp vào đây hoặc bấm nút "Tải lên" ở trên'}
          </p>
        </div>
      </div>
    `;
  }

  if (state.viewMode === 'list') {
    return `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-zinc-100 dark:border-white/5 text-zinc-400 font-medium">
              <th class="py-2.5 px-3">Tên mục</th>
              <th class="py-2.5 px-3 w-28">Kích thước</th>
              <th class="py-2.5 px-3 w-32">Ngày sửa đổi</th>
              <th class="py-2.5 px-3 w-36 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 dark:divide-white/5">
            ${filtered.map(item => renderListItem(item)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Default: Grid View
  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      ${filtered.map(item => renderGridItem(item)).join('')}
    </div>
  `;
}

/**
 * Grid Item Card Component
 */
function renderGridItem(item) {
  const visual = getFileVisualInfo(item);
  const preview = isPreviewable(item);

  return `
    <div 
      class="group relative p-3 rounded-xl bg-zinc-50/70 hover:bg-zinc-100 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] border border-zinc-200/80 hover:border-zinc-300 dark:border-white/[0.06] dark:hover:border-white/15 transition cursor-pointer select-none flex flex-col justify-between"
      data-item-path="${item.path}"
      data-is-dir="${item.isDirectory}"
    >
      <div class="space-y-2.5">
        <div class="w-10 h-10 rounded-xl bg-white dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/5 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform ${visual.color}">
          <i data-lucide="${visual.icon}" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition" title="${item.name}">
            ${item.name}
          </p>
          <p class="text-[11px] text-zinc-400 font-mono mt-0.5">
            ${item.isDirectory ? 'Thư mục' : formatBytes(item.sizeBytes)}
          </p>
        </div>
      </div>

      <!-- Action Hover Overlay Controls -->
      <div class="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-zinc-200/50 dark:border-white/5 opacity-80 group-hover:opacity-100 transition">
        ${preview ? `
          <button data-action="preview" data-item-path="${item.path}" title="Xem trước" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          </button>
        ` : ''}
        <button data-action="download" data-item-path="${item.path}" data-is-dir="${item.isDirectory}" title="${item.isDirectory ? 'Tải ZIP thư mục' : 'Tải về'}" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
        </button>
        <button data-action="rename" data-item-path="${item.path}" data-item-name="${item.name}" title="Đổi tên" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
          <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
        </button>
        <button data-action="delete" data-item-path="${item.path}" data-item-name="${item.name}" title="Xóa" class="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer">
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

  return `
    <tr 
      class="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition cursor-pointer select-none group"
      data-item-path="${item.path}"
      data-is-dir="${item.isDirectory}"
    >
      <td class="py-2 px-3">
        <div class="flex items-center gap-2.5">
          <div class="shrink-0 ${visual.color}">
            <i data-lucide="${visual.icon}" class="w-4 h-4"></i>
          </div>
          <span class="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate max-w-xs sm:max-w-md">
            ${item.name}
          </span>
        </div>
      </td>
      <td class="py-2 px-3 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
        ${item.isDirectory ? '—' : formatBytes(item.sizeBytes)}
      </td>
      <td class="py-2 px-3 text-zinc-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">
        ${formatRelativeTime(item.updatedAt)}
      </td>
      <td class="py-2 px-3 text-right">
        <div class="flex items-center justify-end gap-1">
          ${preview ? `
            <button data-action="preview" data-item-path="${item.path}" title="Xem trước" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
          <button data-action="download" data-item-path="${item.path}" data-is-dir="${item.isDirectory}" title="${item.isDirectory ? 'Tải ZIP thư mục' : 'Tải về'}" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="rename" data-item-path="${item.path}" data-item-name="${item.name}" title="Đổi tên" class="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="delete" data-item-path="${item.path}" data-item-name="${item.name}" title="Xóa" class="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer">
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
    return;
  }

  // --- Unlocked State Logic ---
  const loadDirectory = async (targetPath = state.currentPath) => {
    state.isLoading = true;
    state.currentPath = targetPath;
    state.error = null;
    const contentArea = document.getElementById('storageContentArea');
    if (contentArea) contentArea.innerHTML = renderExplorerContent();

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
      const contentArea = document.getElementById('storageContentArea');
      const breadcrumbEl = document.getElementById('storageBreadcrumbContainer');
      const itemCountEl = document.getElementById('storageItemCount');
      const folderCountEl = document.getElementById('storageFolderCount');
      const fileCountEl = document.getElementById('storageFileCount');
      const driveUsedEl = document.getElementById('storageDriveUsed');
      const diskFreeEl = document.getElementById('storageDiskFree');

      if (contentArea) contentArea.innerHTML = renderExplorerContent();
      if (breadcrumbEl) breadcrumbEl.innerHTML = renderBreadcrumbs(state.currentPath);
      if (itemCountEl) itemCountEl.textContent = `${state.items.length} mục`;
      if (folderCountEl) folderCountEl.textContent = `${state.items.filter(i => i.isDirectory).length} thư mục`;
      if (fileCountEl) fileCountEl.textContent = `${state.items.filter(i => !i.isDirectory).length} tệp tin`;
      if (driveUsedEl && state.stats) driveUsedEl.textContent = `Đã dùng: ${formatBytes(state.stats.driveUsedBytes)}`;
      if (diskFreeEl && state.stats) diskFreeEl.textContent = `Còn trống: ${formatBytes(state.stats.diskFreeBytes)}`;

      if (window.lucide) window.lucide.createIcons();
    }
  };

  // Initial load
  loadDirectory();

  // Search Filter
  const searchInput = document.getElementById('inputStorageSearch');
  if (searchInput) {
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      const contentArea = document.getElementById('storageContentArea');
      if (contentArea) {
        contentArea.innerHTML = renderExplorerContent();
        if (window.lucide) window.lucide.createIcons();
      }
    };
  }

  // View Mode Toggles
  const btnGrid = document.getElementById('btnStorageViewGrid');
  const btnList = document.getElementById('btnStorageViewList');
  if (btnGrid) {
    btnGrid.onclick = () => {
      state.viewMode = 'grid';
      onSoftReRender();
    };
  }
  if (btnList) {
    btnList.onclick = () => {
      state.viewMode = 'list';
      onSoftReRender();
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

  // Drag and Drop Zone
  const dropZone = document.getElementById('storageDropZone');
  const dropOverlay = document.getElementById('storageDropOverlay');
  if (dropZone && dropOverlay) {
    const onDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.remove('hidden');
    };
    const onDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.add('hidden');
    };
    const onDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropOverlay.classList.add('hidden');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await handleUploadFiles(e.dataTransfer.files, loadDirectory);
      }
    };

    dropZone.addEventListener('dragover', onDragOver);
    dropZone.addEventListener('dragleave', onDragLeave);
    dropZone.addEventListener('drop', onDrop);
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

  // Global Click Delegator for Item Navigation & Actions
  const contentArea = document.getElementById('storageContentArea');
  if (contentArea) {
    contentArea.onclick = (e) => {
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
          const item = state.items.find(i => i.path === itemPath);
          if (item) ViewerConnector.preview(item);
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
          loadDirectory(itemPath);
        } else {
          const item = state.items.find(i => i.path === itemPath);
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
        loadDirectory(btn.dataset.path);
      }
    };
  }

  return () => {
    // Teardown listeners if needed
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
 * Handles Item Download
 */
function handleDownloadItem(itemPath, isDir) {
  const url = StorageService.getDownloadUrl(itemPath);
  const a = document.createElement('a');
  a.href = url;
  if (isDir) {
    showToast('Đang đóng gói và tải xuống file nén ZIP...', 'info');
  }
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}



/**
 * Modal for creating a new directory
 */
function showNewFolderModal(onConfirm) {
  const modalRoot = document.getElementById('storageNewFolderModalRoot');
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
  const modalRoot = document.getElementById('storageRenameModalRoot');
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
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-[200px]">${oldName}</p>
          </div>
        </div>

        <div>
          <input 
            type="text" 
            id="inputRenameItem" 
            value="${oldName}"
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

let isDeletingStorageItem = false;

/**
 * Handles Item Deletion with slide-to-confirm modal
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
