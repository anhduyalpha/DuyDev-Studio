/**
 * AdminStorageInspectorModal.js - Storage File Inspector & Pre-Clean Verification Modal
 * Allows inspection of physical files stored on disk across temp, uploads, processed, and drive folders.
 * Features Slide-To-Confirm verification before deleting any file or purging folders.
 */

import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';
import { openSlideConfirmModal } from '../common/SlideConfirmModal.js';

let activeFolder = 'temp';
let cachedFiles = [];
let currentSearchQuery = '';
let onTelemetryRefreshCallback = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h trước`;
  const days = Math.floor(hr / 24);
  return `${days}d trước`;
}

function getFileIcon(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) {
    return `<div class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0"><i data-lucide="file-text" class="w-4 h-4"></i></div>`;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return `<div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><i data-lucide="archive" class="w-4 h-4"></i></div>`;
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'ico'].includes(ext)) {
    return `<div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><i data-lucide="image" class="w-4 h-4"></i></div>`;
  }
  if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
    return `<div class="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0"><i data-lucide="film" class="w-4 h-4"></i></div>`;
  }
  if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
    return `<div class="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0"><i data-lucide="music" class="w-4 h-4"></i></div>`;
  }
  return `<div class="w-8 h-8 rounded-lg bg-zinc-500/10 text-zinc-500 flex items-center justify-center shrink-0"><i data-lucide="file" class="w-4 h-4"></i></div>`;
}

/**
 * Returns static HTML markup for the Storage Inspector Modal
 */
export function renderStorageInspectorModal() {
  return `
    <div id="adminStorageInspectorModal" class="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md hidden animate-fadeIn select-none" style="display: none;">
      <div class="relative w-full max-w-4xl max-h-[90vh] rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#111114] p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
              <i data-lucide="hard-drive" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Trình Soi Tệp Lưu Trữ Máy Chủ (Storage Inspector)
              </h3>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Kiểm tra trực tiếp các tệp thực tế đang lưu trên đĩa server trước khi dọn dẹp hoặc xóa
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btnCloseStorageInspector"
            class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Đóng modal"
          >
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Folder Tabs & Search Bar -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 pt-1">
          <!-- Folder Segmented Pills -->
          <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 text-xs font-semibold overflow-x-auto">
            <button
              type="button"
              data-storage-tab="temp"
              class="storage-folder-tab px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFolder === 'temp' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Tệp tạm (temp)
            </button>
            <button
              type="button"
              data-storage-tab="uploads"
              class="storage-folder-tab px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFolder === 'uploads' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Đầu vào (uploads)
            </button>
            <button
              type="button"
              data-storage-tab="processed"
              class="storage-folder-tab px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFolder === 'processed' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Thành phẩm (processed)
            </button>
            <button
              type="button"
              data-storage-tab="drive"
              class="storage-folder-tab px-3 py-1.5 rounded-xl transition cursor-pointer ${activeFolder === 'drive' ? 'bg-orange-500 text-white shadow-xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}"
            >
              Ổ đĩa (drive)
            </button>
          </div>

          <!-- Search Filter -->
          <div class="relative w-full sm:w-64">
            <input
              type="text"
              id="inputSearchStorageFiles"
              placeholder="Tìm theo tên tệp..."
              class="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 font-mono"
            />
            <i data-lucide="search" class="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
          </div>
        </div>

        <!-- Folder Info Banner -->
        <div id="storageFolderInfoBanner" class="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0">
          <div class="flex items-center gap-2 truncate text-zinc-600 dark:text-zinc-400">
            <i data-lucide="folder" class="w-4 h-4 text-amber-500 shrink-0"></i>
            <span id="storageFolderPathText" class="truncate font-mono">Đang quét thư mục...</span>
          </div>
          <div class="flex items-center gap-3">
            <span>Tổng: <strong id="storageFolderTotalFiles" class="text-zinc-900 dark:text-zinc-100 font-bold">0 tệp</strong></span>
            <span>Dung lượng: <strong id="storageFolderTotalSize" class="text-orange-500 font-bold">0 MB</strong></span>
          </div>
        </div>

        <!-- File List Body (Scrollable) -->
        <div id="storageFilesListContainer" class="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          <div class="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <i data-lucide="loader-2" class="w-6 h-6 animate-spin text-orange-500"></i>
            <span class="text-xs text-zinc-500">Đang quét ổ đĩa máy chủ...</span>
          </div>
        </div>

        <!-- Footer / Global Folder Actions -->
        <div class="pt-3 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-500"></i>
            <span>Mọi thao tác xóa đều yêu cầu kéo trượt xác nhận an toàn (Slide-To-Confirm).</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              id="btnPurgeCurrentFolder"
              class="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span id="btnPurgeCurrentFolderText">Dọn Sạch Thư Mục Này</span>
            </button>
            <button
              type="button"
              id="btnCancelStorageInspector"
              class="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Ensures modal is mounted into the DOM
 */
function ensureStorageModalMounted() {
  let modal = document.getElementById('adminStorageInspectorModal');
  if (!modal) {
    const container = document.getElementById('globalAdminModalContainer') || document.body;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderStorageInspectorModal();
    modal = wrapper.firstElementChild;
    container.appendChild(modal);
    attachStorageModalEvents(modal);
  }
  return modal;
}

/**
 * Renders file list items
 */
function renderStorageFileListItems(files, folder) {
  if (!files || files.length === 0) {
    return `
      <div class="py-12 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-white/5 space-y-2">
        <div class="w-10 h-10 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400">
          <i data-lucide="folder-check" class="w-5 h-5"></i>
        </div>
        <p class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Thư mục trống</p>
        <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Không có tệp nào trên đĩa trong thư mục <code>storage/${folder}</code></p>
      </div>
    `;
  }

  return files.map(file => {
    const icon = getFileIcon(file.name);
    const originalBadge = file.originalName
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-[200px]" title="Tên gốc: ${escapeHtml(file.originalName)}">
          Gốc: ${escapeHtml(file.originalName)}
        </span>`
      : '';

    return `
      <div class="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/5 flex items-center justify-between gap-3 hover:border-zinc-300 dark:hover:border-white/10 transition shadow-xs group">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          ${icon}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" title="${escapeHtml(file.name)}">
                ${escapeHtml(file.name)}
              </span>
              ${originalBadge}
            </div>
            <div class="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              <span class="font-bold text-zinc-700 dark:text-zinc-300">${escapeHtml(file.sizeFormatted)}</span>
              <span>•</span>
              <span>Sửa đổi: ${formatRelativeTime(file.mtime)}</span>
            </div>
          </div>
        </div>

        <!-- Action: Delete single file -->
        <button
          type="button"
          data-delete-storage-file="${escapeHtml(file.name)}"
          class="p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer shrink-0 opacity-80 group-hover:opacity-100"
          title="Xóa tệp này khỏi máy chủ"
        >
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');
}

/**
 * Fetches files for the active folder from the API and updates modal UI
 */
async function fetchAndRenderFolder(folder) {
  activeFolder = folder;
  const listContainer = document.getElementById('storageFilesListContainer');
  const pathText = document.getElementById('storageFolderPathText');
  const totalFilesEl = document.getElementById('storageFolderTotalFiles');
  const totalSizeEl = document.getElementById('storageFolderTotalSize');
  const purgeBtn = document.getElementById('btnPurgeCurrentFolder');

  if (listContainer) {
    listContainer.innerHTML = `
      <div class="py-12 flex flex-col items-center justify-center text-center space-y-2">
        <i data-lucide="loader-2" class="w-6 h-6 animate-spin text-orange-500"></i>
        <span class="text-xs text-zinc-500 font-mono">Đang đọc danh sách tệp trong storage/${folder}...</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const resp = await fetch(`/api/v1/admin/storage/inspect?folder=${encodeURIComponent(folder)}`, {
      headers: { ...getStorageAuthHeaders(), 'Accept': 'application/json' }
    });
    const json = await resp.json();

    if (json.success && json.data) {
      cachedFiles = json.data.files || [];
      if (pathText) pathText.textContent = json.data.folderPath || `storage/${folder}`;
      if (totalFilesEl) totalFilesEl.textContent = `${json.data.totalFiles} tệp`;
      if (totalSizeEl) totalSizeEl.textContent = `${json.data.totalSizeMb} MB`;

      if (purgeBtn) {
        purgeBtn.style.display = json.data.totalFiles > 0 ? 'inline-flex' : 'none';
      }

      applyFilterAndRender();
    } else {
      if (listContainer) {
        listContainer.innerHTML = `<div class="p-6 text-center text-xs text-rose-500 font-mono">${escapeHtml(json.message || 'Không thể đọc thư mục')}</div>`;
      }
    }
  } catch (err) {
    if (listContainer) {
      listContainer.innerHTML = `<div class="p-6 text-center text-xs text-rose-500 font-mono">Lỗi kết nối: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function applyFilterAndRender() {
  const listContainer = document.getElementById('storageFilesListContainer');
  if (!listContainer) return;

  const q = currentSearchQuery.trim().toLowerCase();
  const filtered = q
    ? cachedFiles.filter(f => f.name.toLowerCase().includes(q) || (f.originalName && f.originalName.toLowerCase().includes(q)))
    : cachedFiles;

  listContainer.innerHTML = renderStorageFileListItems(filtered, activeFolder);
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Attaches event listeners to the modal
 */
function attachStorageModalEvents(modal) {
  const btnClose = modal.querySelector('#btnCloseStorageInspector');
  const btnCancel = modal.querySelector('#btnCancelStorageInspector');
  const searchInput = modal.querySelector('#inputSearchStorageFiles');
  const purgeBtn = modal.querySelector('#btnPurgeCurrentFolder');

  if (btnClose) btnClose.onclick = closeStorageInspectorModal;
  if (btnCancel) btnCancel.onclick = closeStorageInspectorModal;

  modal.onclick = (e) => {
    if (e.target === modal) closeStorageInspectorModal();
  };

  // Tab switching
  modal.querySelectorAll('.storage-folder-tab').forEach(tab => {
    tab.onclick = () => {
      const folder = tab.dataset.storageTab;
      modal.querySelectorAll('.storage-folder-tab').forEach(t => {
        const isActive = t.dataset.storageTab === folder;
        t.className = `storage-folder-tab px-3 py-1.5 rounded-xl transition cursor-pointer ${
          isActive
            ? 'bg-orange-500 text-white shadow-xs'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
        }`;
      });
      fetchAndRenderFolder(folder);
    };
  });

  // Search input
  if (searchInput) {
    searchInput.oninput = (e) => {
      currentSearchQuery = e.target.value;
      applyFilterAndRender();
    };
  }

  // Delete individual file with Slide-To-Confirm
  modal.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('[data-delete-storage-file]');
    if (!deleteBtn) return;
    const fileName = deleteBtn.dataset.deleteStorageFile;
    const fileObj = cachedFiles.find(f => f.name === fileName);
    const sizeFormatted = fileObj ? fileObj.sizeFormatted : '';

    openSlideConfirmModal({
      title: 'Xóa tệp khỏi máy chủ',
      description: `Xóa vĩnh viễn tệp "${fileName}" (${sizeFormatted}) khỏi thư mục storage/${activeFolder}.`,
      warningText: 'Tệp này sẽ bị xóa hoàn toàn khỏi đĩa cứng và không thể khôi phục.',
      actionText: 'Kéo sang phải để xóa tệp',
      confirmingText: 'Đang xóa tệp...',
      onConfirm: async () => {
        try {
          const resp = await fetch('/api/v1/admin/storage/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
            body: JSON.stringify({ folder: activeFolder, fileName })
          });
          const json = await resp.json();
          showToast(json.message || `Đã xóa tệp ${fileName}`, json.success ? 'success' : 'error');
          // Re-fetch folder
          await fetchAndRenderFolder(activeFolder);
          if (onTelemetryRefreshCallback) onTelemetryRefreshCallback();
        } catch (err) {
          showToast(`Lỗi khi xóa tệp: ${err.message}`, 'error');
        }
      }
    });
  });

  // Purge entire current folder with Slide-To-Confirm
  if (purgeBtn) {
    purgeBtn.onclick = () => {
      const folderName = activeFolder;
      const count = cachedFiles.length;

      // Map to corresponding cleanup action
      let actionEndpoint = '/api/v1/admin/actions/clean-temp';
      let title = `Dọn sạch thư mục storage/${folderName}`;
      let desc = `Xóa vĩnh viễn toàn bộ ${count} tệp trong thư mục storage/${folderName}.`;

      if (folderName === 'temp') {
        actionEndpoint = '/api/v1/admin/actions/clean-temp';
      } else {
        // If other folder, delete files sequentially or notify
        title = `Xóa toàn bộ ${count} tệp trong ${folderName}`;
      }

      openSlideConfirmModal({
        title,
        description: desc,
        warningText: 'Toàn bộ các tệp trong thư mục này sẽ bị xóa sạch khỏi máy chủ. Hành động này không thể hoàn tác.',
        actionText: 'Kéo sang phải để dọn sạch thư mục',
        confirmingText: 'Đang dọn dẹp thư mục...',
        onConfirm: async () => {
          try {
            if (folderName === 'temp') {
              const resp = await fetch('/api/v1/admin/actions/clean-temp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() }
              });
              const json = await resp.json();
              showToast(json.message || 'Đã dọn dẹp thư mục temp', json.success ? 'success' : 'error');
            } else {
              // Delete each file individually
              let deleted = 0;
              for (const f of cachedFiles) {
                try {
                  await fetch('/api/v1/admin/storage/delete-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getStorageAuthHeaders() },
                    body: JSON.stringify({ folder: folderName, fileName: f.name })
                  });
                  deleted++;
                } catch {}
              }
              showToast(`Đã xóa ${deleted} tệp khỏi ${folderName}`, 'success');
            }

            await fetchAndRenderFolder(folderName);
            if (onTelemetryRefreshCallback) onTelemetryRefreshCallback();
          } catch (err) {
            showToast(`Lỗi khi dọn thư mục: ${err.message}`, 'error');
          }
        }
      });
    };
  }
}

/**
 * Opens the Storage Inspector Modal
 * @param {string} [initialFolder='temp']
 * @param {Function} [onTelemetryRefresh]
 */
export function openStorageInspectorModal(initialFolder = 'temp', onTelemetryRefresh = null) {
  const modal = ensureStorageModalMounted();
  onTelemetryRefreshCallback = onTelemetryRefresh;
  activeFolder = initialFolder || 'temp';
  currentSearchQuery = '';

  const searchInput = modal.querySelector('#inputSearchStorageFiles');
  if (searchInput) searchInput.value = '';

  // Highlight tab
  modal.querySelectorAll('.storage-folder-tab').forEach(t => {
    const isActive = t.dataset.storageTab === activeFolder;
    t.className = `storage-folder-tab px-3 py-1.5 rounded-xl transition cursor-pointer ${
      isActive
        ? 'bg-orange-500 text-white shadow-xs'
        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
    }`;
  });

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();

  fetchAndRenderFolder(activeFolder);
}

/**
 * Closes the Storage Inspector Modal
 */
export function closeStorageInspectorModal() {
  const modal = document.getElementById('adminStorageInspectorModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}
