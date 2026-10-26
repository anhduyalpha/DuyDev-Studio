/**
 * MediaHistorySection Component
 * Reusable high-fidelity history and trash management section for media downloaders
 * (Spotify, Instagram, Facebook, and TikTok) with zero-login device synchronization,
 * AndroidBridge native downloading, and Impeccable Design System ergonomics.
 * Fully compliant with KI-CON-001 (Production Minimalism) and KI-CON-006 (Collapsible Dropboxes).
 */

import { storage } from '../../../utilities/storage.js';
import { StorageService } from '../../../services/storageService.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { openSlideConfirmModal } from '../../common/SlideConfirmModal.js';
import { showToast } from '../../../utilities/toast.js';
import { copyText } from '../../../utilities/clipboard.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { formatBytes, formatRelativeTime } from '../../../utilities/formatters.js';

const historyExpandedMap = new Map();

export function isMediaHistoryExpanded(toolId) {
  return historyExpandedMap.get(toolId) ?? false;
}

export function setMediaHistoryExpanded(toolId, open) {
  historyExpandedMap.set(toolId, Boolean(open));
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function getCleanAuthor(item) {
  if (!item) return '';
  if (typeof item.author === 'string' && item.author.trim()) {
    const a = item.author.trim();
    return a.startsWith('@') ? a : `@${a}`;
  }
  if (item.author && typeof item.author === 'object') {
    const name = item.author.name || item.author.username || item.author.uploader || item.author.channel || '';
    if (name) return name.startsWith('@') ? name : `@${name}`;
  }
  if (typeof item.artist === 'string' && item.artist.trim()) {
    return item.artist.trim();
  }
  return '';
}

export function triggerDownload(url, fileName, mimeType = 'application/octet-stream') {
  if (!url) {
    showToast('Không có liên kết tải xuống hợp lệ', 'error');
    return;
  }
  if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.downloadFile === 'function') {
    try {
      window.AndroidBridge.downloadFile(url, fileName);
      showToast('Đang tải tệp về máy...', 'info');
      return;
    } catch (e) {
      console.warn('AndroidBridge download failed, falling back to browser download', e);
    }
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Đang bắt đầu tải xuống...', 'info');
}

/**
 * Returns HTML string for the collapsible media history section
 */
export function renderMediaHistorySection({
  toolId,
  title = 'Lịch Sử Tải Xuống',
  activeTab = 'history',
  fallbackIcon = 'film',
  accentColor = '#4F46E5',
  driveFolderPath = ''
}) {
  const historyItems = storage.getToolHistory(toolId);
  const trashItems = storage.getToolTrash(toolId);
  const isTrash = activeTab === 'trash';
  const currentList = isTrash ? trashItems : historyItems;
  const isOpen = isMediaHistoryExpanded(toolId);

  return `
    <div id="mediaHistorySection" class="bg-white dark:bg-[#16161A] rounded-2xl border border-zinc-200/80 dark:border-white/10 overflow-hidden transition-all shadow-xs select-none">
      
      <!-- Collapsible Master Header Button (KI-CON-006) -->
      <button
        type="button"
        id="btnToggleMediaHistory"
        class="w-full flex items-center justify-between p-3.5 sm:p-4 text-left cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        aria-expanded="${isOpen}"
      >
        <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border" style="background-color: ${accentColor}15; color: ${accentColor}; border-color: ${accentColor}30;">
            <i data-lucide="clock" class="w-4 h-4"></i>
          </div>
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <span class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider truncate">
              ${escapeHtml(title)}
            </span>
            <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold shrink-0" style="background-color: ${accentColor}15; color: ${accentColor}; border: 1px solid ${accentColor}30;">
              ${historyItems.length} mục
            </span>
            ${trashItems.length > 0 ? `
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                ${trashItems.length} thùng rác
              </span>
            ` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span class="text-xs text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
            ${isOpen ? 'Thu gọn' : 'Xem lịch sử'}
          </span>
          <div class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-180 text-zinc-900 dark:text-zinc-100' : ''}">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
          </div>
        </div>
      </button>

      <!-- Collapsible Body -->
      <div id="mediaHistoryBody" class="${isOpen ? 'block' : 'hidden'} border-t border-zinc-100 dark:border-white/[0.06] p-3 sm:p-4 space-y-3 bg-zinc-50/30 dark:bg-black/10">
        
        <!-- Sub-Header Tabs & Batch Actions Bar -->
        <div class="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-zinc-200/50 dark:border-white/5">
          <!-- Compact Tab Switcher -->
          <div class="inline-flex p-0.5 rounded-xl bg-zinc-200/60 dark:bg-white/5 border border-zinc-200 dark:border-white/5">
            <button
              type="button"
              data-media-tab="history"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${!isTrash ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
            >
              <i data-lucide="list" class="w-3.5 h-3.5"></i>
              <span>Lịch sử (${historyItems.length})</span>
            </button>
            <button
              type="button"
              data-media-tab="trash"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${isTrash ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Thùng rác (${trashItems.length})</span>
            </button>
          </div>

          <!-- Quick Actions on Right -->
          <div class="flex items-center gap-1.5">
            ${!isTrash && historyItems.length > 0 ? `
              <button
                type="button"
                id="btnClearMediaHistory"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-1.5"
                title="Chuyển toàn bộ lịch sử vào thùng rác"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Xóa tất cả</span>
              </button>
            ` : ''}

            ${isTrash && trashItems.length > 0 ? `
              <button
                type="button"
                id="btnRestoreAllMediaTrash"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition cursor-pointer flex items-center gap-1"
                title="Khôi phục toàn bộ mục"
              >
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                <span>Khôi phục</span>
              </button>
              <button
                type="button"
                id="btnEmptyMediaTrash"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-1"
                title="Dọn sạch thùng rác vĩnh viễn"
              >
                <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                <span>Dọn sạch</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Item List Container -->
        ${currentList.length === 0 ? `
          <div class="py-8 text-center space-y-2">
            <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 mx-auto flex items-center justify-center text-zinc-400">
              <i data-lucide="${isTrash ? 'trash' : 'inbox'}" class="w-5 h-5"></i>
            </div>
            <p class="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              ${isTrash ? 'Thùng rác trống' : 'Chưa có lịch sử tải xuống'}
            </p>
            <p class="text-[11px] text-zinc-400 max-w-sm mx-auto">
              ${isTrash ? 'Các mục bạn đã xóa sẽ xuất hiện ở đây trước khi bị dọn vĩnh viễn.' : 'Các tệp tải hoàn tất sẽ tự động xuất hiện ở đây để phát trực tiếp hoặc tải lại.'}
            </p>
          </div>
        ` : `
          <div class="space-y-2.5">
            ${currentList.map((item) => {
              const hasDrive = Boolean(item.driveRelPath);
              const coverImg = item.cover || item.thumbnail;
              const itemTitle = item.title || item.fileName || 'Phương tiện';
              const cleanAuthor = getCleanAuthor(item);
              const driveTargetUrl = driveFolderPath ? `#storage?path=${encodeURIComponent(driveFolderPath)}` : '#storage';
              const hasBothQualities = Boolean(!hasDrive && item.videoHdUrl && item.videoSdUrl);

              return `
                <div class="p-3 sm:p-3.5 rounded-xl border border-zinc-200/80 dark:border-white/[0.08] bg-white dark:bg-[#16161A] shadow-xs space-y-2.5 transition-all hover:border-zinc-300 dark:hover:border-white/15">
                  
                  <!-- Top: Thumbnail & Metadata Row -->
                  <div class="flex items-start gap-3 min-w-0">
                    <!-- Thumbnail -->
                    ${coverImg ? `
                      <div
                        class="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-white/10 shrink-0 shadow-2xs cursor-pointer group"
                        data-action-preview="${escapeHtml(item.id)}"
                        title="Xem trước"
                      >
                        <img
                          src="${escapeHtml(coverImg)}"
                          alt="Thumbnail"
                          class="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-zinc-500\\'><i data-lucide=\\'${fallbackIcon}\\' class=\\'w-5 h-5\\'></i></div>'"
                        />
                        ${item.duration ? `
                          <span class="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/75 text-[9px] font-mono font-medium text-white">
                            ${formatDuration(item.duration)}
                          </span>
                        ` : ''}
                      </div>
                    ` : `
                      <div class="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center shrink-0 text-zinc-400">
                        <i data-lucide="${fallbackIcon}" class="w-5 h-5"></i>
                      </div>
                    `}

                    <!-- Text Details -->
                    <div class="min-w-0 flex-1 space-y-1">
                      <p
                        class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:underline"
                        data-action-preview="${escapeHtml(item.id)}"
                        title="${escapeHtml(itemTitle)}"
                      >
                        ${escapeHtml(itemTitle)}
                      </p>

                      <div class="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
                        ${cleanAuthor ? `<span class="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[120px] sm:max-w-[180px]">${escapeHtml(cleanAuthor)}</span><span>•</span>` : ''}
                        ${item.quality ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 shrink-0">${escapeHtml(item.quality)}</span><span>•</span>` : ''}
                        ${hasDrive ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 inline-flex items-center gap-0.5"><i data-lucide="check" class="w-2.5 h-2.5"></i> Đã lưu Drive</span><span>•</span>` : ''}
                        ${item.resultSize ? `<span>${formatBytes(item.resultSize)}</span><span>•</span>` : ''}
                        <span>${formatRelativeTime(item.deletedAt || item.createdAt || Date.now())}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Bottom: Action Toolbar (One Clean Balanced Row) -->
                  <div class="flex items-center justify-between gap-1.5 pt-2 border-t border-zinc-100 dark:border-white/5">
                    
                    ${!isTrash ? `
                      <!-- Left Group: Primary Actions (Xem & Tải) -->
                      <div class="flex items-center gap-1.5 shrink-0">
                        <!-- Preview In App -->
                        <button
                          type="button"
                          data-action-preview="${escapeHtml(item.id)}"
                          class="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1 min-h-[36px]"
                          title="Xem trước / Phát trong ứng dụng"
                        >
                          <i data-lucide="play" class="w-3.5 h-3.5 text-zinc-500"></i>
                          <span>Xem</span>
                        </button>

                        <!-- Direct Download Button(s) -->
                        ${hasBothQualities ? `
                          <div class="inline-flex rounded-lg overflow-hidden border border-zinc-200 dark:border-white/10 shadow-2xs">
                            <button
                              type="button"
                              data-action-direct-download="${escapeHtml(item.videoHdUrl)}"
                              data-file-name="${escapeHtml((item.fileName || 'video').replace(/\.mp4$/i, '') + '_HD.mp4')}"
                              class="px-2.5 py-1.5 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 min-h-[36px]"
                              style="background-color: ${accentColor}"
                              title="Tải video HD"
                            >
                              <i data-lucide="download" class="w-3.5 h-3.5"></i>
                              <span>HD</span>
                            </button>
                            <button
                              type="button"
                              data-action-direct-download="${escapeHtml(item.videoSdUrl)}"
                              data-file-name="${escapeHtml((item.fileName || 'video').replace(/\.mp4$/i, '') + '_SD.mp4')}"
                              class="px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition cursor-pointer border-l border-zinc-200 dark:border-white/10 min-h-[36px]"
                              title="Tải video SD"
                            >
                              <span>SD</span>
                            </button>
                          </div>
                        ` : `
                          <button
                            type="button"
                            data-action-download="${escapeHtml(item.id)}"
                            class="px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1 min-h-[36px]"
                            style="background-color: ${accentColor}"
                            title="Tải tệp về thiết bị"
                          >
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                            <span>Tải về</span>
                          </button>
                        `}
                      </div>

                      <!-- Right Group: Compact Utility Icons -->
                      <div class="flex items-center gap-1 shrink-0">
                        <!-- Drive Action -->
                        ${hasDrive ? `
                          <a
                            href="${driveTargetUrl}"
                            class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition flex items-center justify-center shrink-0"
                            title="Xem trong Studio Drive"
                          >
                            <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
                          </a>
                        ` : `
                          <button
                            type="button"
                            data-action-save-drive="${escapeHtml(item.id)}"
                            class="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center cursor-pointer shrink-0"
                            title="Lưu vào Studio Drive"
                          >
                            <i data-lucide="cloud-upload" class="w-3.5 h-3.5"></i>
                          </button>
                        `}

                        <!-- Re-open / Re-resolve URL -->
                        <button
                          type="button"
                          data-action-reopen="${escapeHtml(item.originalUrl || item.downloadUrl || '')}"
                          class="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center cursor-pointer shrink-0"
                          title="Dán lại liên kết và tải lại"
                        >
                          <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
                        </button>

                        <!-- Copy Direct Link -->
                        <button
                          type="button"
                          data-action-copy-link="${escapeHtml(item.downloadUrl || item.originalUrl || '')}"
                          class="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center cursor-pointer shrink-0"
                          title="Sao chép liên kết"
                        >
                          <i data-lucide="link" class="w-3.5 h-3.5"></i>
                        </button>

                        <!-- Move to Trash -->
                        <button
                          type="button"
                          data-action-delete="${escapeHtml(item.id)}"
                          class="w-8 h-8 rounded-lg hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 transition flex items-center justify-center cursor-pointer shrink-0"
                          title="Chuyển vào thùng rác"
                        >
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    ` : `
                      <!-- Trash Mode: Clean Restore Bar -->
                      <div class="flex items-center justify-between w-full">
                        <span class="text-[11px] text-zinc-400 italic">Đã nằm trong thùng rác</span>
                        <div class="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-action-restore="${escapeHtml(item.id)}"
                            class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition cursor-pointer flex items-center gap-1 min-h-[36px]"
                            title="Khôi phục mục này vào lịch sử"
                          >
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                            <span>Khôi phục</span>
                          </button>
                          <button
                            type="button"
                            data-action-perm-delete="${escapeHtml(item.id)}"
                            class="w-8 h-8 rounded-lg hover:bg-rose-500/10 text-zinc-400 hover:text-rose-600 transition flex items-center justify-center cursor-pointer"
                            title="Xóa vĩnh viễn"
                          >
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                          </button>
                        </div>
                      </div>
                    `}

                  </div>

                </div>
              `;
            }).join('')}
          </div>
        `}

      </div>

    </div>
  `.trim();
}

/**
 * Attaches interactive listeners to the rendered media history section
 */
export function attachMediaHistoryListeners({
  container,
  toolId,
  onTabChange,
  onReResolve,
  onSaveDrive,
  onHistoryChange,
  accentColor = '#4F46E5'
}) {
  if (!container) return;

  // 0. Toggle Master Collapsible Dropbox (KI-CON-006)
  const btnToggle = container.querySelector('#btnToggleMediaHistory');
  if (btnToggle) {
    btnToggle.onclick = (e) => {
      e.preventDefault();
      const current = isMediaHistoryExpanded(toolId);
      setMediaHistoryExpanded(toolId, !current);
      soundEngine?.playToggle?.();
      if (typeof onHistoryChange === 'function') {
        onHistoryChange();
      }
    };
  }

  // 1. Tab Switching
  container.querySelectorAll('[data-media-tab]').forEach((btn) => {
    btn.onclick = () => {
      const tab = btn.getAttribute('data-media-tab');
      if (typeof onTabChange === 'function') {
        onTabChange(tab);
      }
    };
  });

  // 2. Clear History (Move active items to trash)
  const btnClear = container.querySelector('#btnClearMediaHistory');
  if (btnClear) {
    btnClear.onclick = () => {
      openSlideConfirmModal({
        title: 'Chuyển lịch sử vào thùng rác',
        description: 'Toàn bộ mục trong danh sách này sẽ được chuyển vào Thùng rác. Bạn có thể khôi phục lại bất cứ khi nào.',
        warningText: 'Các mục sẽ được chuyển vào thùng rác của công cụ này.',
        actionText: 'Kéo sang phải để chuyển',
        confirmingText: 'Đang chuyển...',
        onConfirm: async () => {
          soundEngine?.playDeleteAll?.();
          await storage.clearToolHistoryToTrash(toolId);
          showToast('Đã chuyển toàn bộ lịch sử vào thùng rác', 'deleteAll');
          onHistoryChange?.();
        }
      });
    };
  }

  // 3. Restore all trash
  const btnRestoreAll = container.querySelector('#btnRestoreAllMediaTrash');
  if (btnRestoreAll) {
    btnRestoreAll.onclick = async () => {
      const trashItems = storage.getToolTrash(toolId);
      if (trashItems.length > 0) {
        soundEngine?.playSuccess?.();
        storage.restoreItemsFromTrashSync(trashItems.map((i) => i.id));
        showToast(`Đã khôi phục ${trashItems.length} mục vào lịch sử`, 'success');
        onHistoryChange?.();
      }
    };
  }

  // 4. Empty Trash (Permanent delete)
  const btnEmptyTrash = container.querySelector('#btnEmptyMediaTrash');
  if (btnEmptyTrash) {
    btnEmptyTrash.onclick = () => {
      openSlideConfirmModal({
        title: 'Dọn sạch thùng rác',
        description: 'Hành động này sẽ xóa vĩnh viễn toàn bộ mục trong thùng rác của công cụ này.',
        warningText: 'Không thể hoàn tác sau khi đã xóa vĩnh viễn.',
        actionText: 'Kéo sang phải để xóa vĩnh viễn',
        confirmingText: 'Đang dọn sạch...',
        onConfirm: async () => {
          soundEngine?.playDeleteAll?.();
          const trashItems = storage.getToolTrash(toolId);
          storage.permanentlyDeleteItemsSync(trashItems.map((i) => i.id));
          showToast('Đã dọn sạch thùng rác', 'delete');
          onHistoryChange?.();
        }
      });
    };
  }

  // 5. Preview item in app
  container.querySelectorAll('[data-action-preview]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-action-preview');
      const item = storage.getLocalHistory().find((x) => x.id === id);
      if (!item) return;

      const hasDrive = Boolean(item.driveRelPath);
      const targetViewUrl = hasDrive
        ? StorageService.getDownloadUrl(item.driveRelPath, true)
        : (item.viewUrl || item.downloadUrl);
      const targetDownloadUrl = hasDrive
        ? StorageService.getDownloadUrl(item.driveRelPath, false)
        : (item.downloadUrl || item.viewUrl);

      const isAudio = item.mediaType === 'audio' || item.fileName?.endsWith('.mp3');
      const isImage = item.mediaType === 'image' || item.mediaType === 'photo' ||
        /\.(jpe?g|png|webp|gif|svg)$/i.test(item.fileName || '') ||
        (item.mediaType === 'carousel' && !item.fileName?.endsWith('.mp4'));

      ViewerConnector.preview({
        name: item.fileName || item.title || 'Media',
        fileName: item.fileName || item.title || 'Media',
        path: hasDrive ? item.driveRelPath : undefined,
        category: isAudio ? 'audio' : (isImage ? 'image' : 'video'),
        mimeType: isAudio ? 'audio/mpeg' : (isImage ? 'image/jpeg' : 'video/mp4'),
        viewUrl: targetViewUrl,
        downloadUrl: targetDownloadUrl
      });
    };
  });

  // 6. Direct download (Single resolution or Drive file)
  container.querySelectorAll('[data-action-download]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-action-download');
      const item = storage.getLocalHistory().find((x) => x.id === id);
      if (!item) return;

      const hasDrive = Boolean(item.driveRelPath);
      const downloadUrl = hasDrive
        ? StorageService.getDownloadUrl(item.driveRelPath, false)
        : (item.downloadUrl || item.viewUrl);
      const fileName = item.fileName || `${item.title || 'media'}.${item.mediaType === 'audio' ? 'mp3' : 'mp4'}`;
      const isAudio = item.mediaType === 'audio' || fileName.endsWith('.mp3');
      const isImage = item.mediaType === 'image' || item.mediaType === 'photo' || /\.(jpe?g|png|webp|gif|svg)$/i.test(fileName);
      const mime = isAudio ? 'audio/mpeg' : (isImage ? 'image/jpeg' : 'video/mp4');

      triggerDownload(downloadUrl, fileName, mime);
    };
  });

  // 7. Multi-resolution download (e.g. Facebook SD / HD)
  container.querySelectorAll('[data-action-direct-download]').forEach((btn) => {
    btn.onclick = () => {
      const url = btn.getAttribute('data-action-direct-download');
      const fileName = btn.getAttribute('data-file-name') || 'video.mp4';
      triggerDownload(url, fileName, 'video/mp4');
    };
  });

  // 8. Save to Drive / Re-save
  container.querySelectorAll('[data-action-save-drive]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-save-drive');
      const item = storage.getLocalHistory().find((x) => x.id === id);
      if (!item) return;
      if (typeof onSaveDrive === 'function') {
        onSaveDrive(item);
      }
    };
  });

  // 9. Copy Link
  container.querySelectorAll('[data-action-copy-link]').forEach((btn) => {
    btn.onclick = async () => {
      const link = btn.getAttribute('data-action-copy-link');
      if (link) {
        await copyText(link);
        showToast('Đã sao chép liên kết vào bộ nhớ tạm', 'success');
      }
    };
  });

  // 10. Re-open / Re-resolve URL
  container.querySelectorAll('[data-action-reopen]').forEach((el) => {
    el.onclick = () => {
      const url = el.getAttribute('data-action-reopen');
      if (url && typeof onReResolve === 'function') {
        onReResolve(url);
      }
    };
  });

  // 11. Delete item (Move to trash)
  container.querySelectorAll('[data-action-delete]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-delete');
      soundEngine?.playDelete?.();
      await storage.moveToTrash(id);
      showToast('Đã chuyển mục vào thùng rác', 'delete');
      onHistoryChange?.();
    };
  });

  // 12. Restore item from trash
  container.querySelectorAll('[data-action-restore]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-restore');
      soundEngine?.playSuccess?.();
      await storage.restoreTrashItem(id);
      showToast('Đã khôi phục mục về lịch sử', 'success');
      onHistoryChange?.();
    };
  });

  // 13. Permanently delete item
  container.querySelectorAll('[data-action-perm-delete]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-perm-delete');
      soundEngine?.playDelete?.();
      await storage.permanentlyDeleteTrashItem(id);
      showToast('Đã xóa vĩnh viễn mục khỏi thùng rác', 'delete');
      onHistoryChange?.();
    };
  });

  if (window.lucide?.createIcons) {
    window.lucide.createIcons({ root: container });
  }

  // 14. Real-time global synchronization listener
  const handleGlobalHistoryUpdated = (e) => {
    const detailTool = e.detail?.toolId ? String(e.detail.toolId).toLowerCase().replace(/-downloader$/, '') : null;
    const currentTool = String(toolId).toLowerCase().replace(/-downloader$/, '');
    if (!detailTool || detailTool === currentTool) {
      if (typeof onHistoryChange === 'function') {
        onHistoryChange();
      }
    }
  };
  window.addEventListener('dd:history-updated', handleGlobalHistoryUpdated);

  return () => {
    window.removeEventListener('dd:history-updated', handleGlobalHistoryUpdated);
  };
}
