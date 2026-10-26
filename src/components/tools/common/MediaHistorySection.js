/**
 * MediaHistorySection Component
 * Reusable high-fidelity history and trash management section for media downloaders
 * (Spotify, Instagram, Facebook, and TikTok) with zero-login device synchronization,
 * AndroidBridge native downloading, and Impeccable Design System ergonomics.
 */

import { storage } from '../../../utilities/storage.js';
import { StorageService } from '../../../services/storageService.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { openSlideConfirmModal } from '../../common/SlideConfirmModal.js';
import { showToast } from '../../../utilities/toast.js';
import { copyText } from '../../../utilities/clipboard.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { formatBytes, formatRelativeTime } from '../../../utilities/formatters.js';

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
 * Returns HTML string for the media history section
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

  return `
    <div id="mediaHistorySection" class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4 animate-fadeIn">
      
      <!-- Header & Tab Switcher -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-white/5">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background-color: ${accentColor}15; color: ${accentColor}">
            <i data-lucide="clock" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              ${escapeHtml(title)}
            </h3>
            <p class="text-[11px] text-zinc-500 dark:text-zinc-400">
              ${historyItems.length} mục đã lưu • ${trashItems.length} trong thùng rác
            </p>
          </div>
        </div>

        <!-- Tab & Actions Bar -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-black/30 border border-zinc-200/60 dark:border-white/5">
            <button
              type="button"
              data-media-tab="history"
              class="px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer min-h-[44px] flex items-center gap-1.5 ${!isTrash ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
            >
              <i data-lucide="list" class="w-3.5 h-3.5"></i>
              <span>Lịch sử (${historyItems.length})</span>
            </button>
            <button
              type="button"
              data-media-tab="trash"
              class="px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer min-h-[44px] flex items-center gap-1.5 ${isTrash ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Thùng rác (${trashItems.length})</span>
            </button>
          </div>

          ${!isTrash && historyItems.length > 0 ? `
            <button
              type="button"
              id="btnClearMediaHistory"
              class="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer min-h-[44px] flex items-center gap-1.5"
              title="Chuyển toàn bộ lịch sử vào thùng rác"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Xóa lịch sử</span>
            </button>
          ` : ''}

          ${isTrash && trashItems.length > 0 ? `
            <button
              type="button"
              id="btnRestoreAllMediaTrash"
              class="px-3.5 py-2 rounded-xl text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition cursor-pointer min-h-[44px] flex items-center gap-1.5"
              title="Khôi phục toàn bộ mục trong thùng rác"
            >
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Khôi phục tất cả</span>
            </button>
            <button
              type="button"
              id="btnEmptyMediaTrash"
              class="px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer min-h-[44px] flex items-center gap-1.5"
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
        <div class="py-10 text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 mx-auto flex items-center justify-center text-zinc-400">
            <i data-lucide="${isTrash ? 'trash' : 'inbox'}" class="w-6 h-6"></i>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            ${isTrash ? 'Thùng rác trống' : 'Chưa có lịch sử tải xuống'}
          </p>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            ${isTrash ? 'Các mục bạn đã xóa từ danh sách tải sẽ xuất hiện tại đây trước khi bị dọn vĩnh viễn.' : 'Các tệp tải hoàn tất sẽ được tự động lưu lại đây để phát trực tiếp hoặc tải lại bất cứ lúc nào.'}
          </p>
        </div>
      ` : `
        <div class="divide-y divide-zinc-100 dark:divide-white/5">
          ${currentList.map((item) => {
            const hasDrive = Boolean(item.driveRelPath);
            const coverImg = item.cover || item.thumbnail;
            const itemTitle = item.title || item.fileName || 'Tài liệu phương tiện';
            const itemSubtitle = item.artist || item.author || (item.mediaType ? item.mediaType.toUpperCase() : 'Đã tải');
            const driveTargetUrl = driveFolderPath ? `#storage?path=${encodeURIComponent(driveFolderPath)}` : '#storage';
            const hasBothQualities = Boolean(!hasDrive && item.videoHdUrl && item.videoSdUrl);

            return `
              <div class="py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] rounded-xl px-2 transition">
                
                <!-- Left: Thumbnail & Metadata -->
                <div class="flex items-center gap-3.5 min-w-0 flex-1">
                  ${coverImg ? `
                    <div class="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-white/10 shrink-0 shadow-2xs">
                      <img
                        src="${escapeHtml(coverImg)}"
                        alt="Thumbnail"
                        class="w-full h-full object-cover"
                        loading="lazy"
                        onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-zinc-500\\'><i data-lucide=\\'${fallbackIcon}\\' class=\\'w-5 h-5\\'></i></div>'"
                      />
                      ${item.duration ? `
                        <span class="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/70 backdrop-blur-xs text-[9px] font-mono font-medium text-white">
                          ${formatDuration(item.duration)}
                        </span>
                      ` : ''}
                    </div>
                  ` : `
                    <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center shrink-0 text-zinc-400">
                      <i data-lucide="${fallbackIcon}" class="w-6 h-6"></i>
                    </div>
                  `}

                  <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p
                        class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white truncate cursor-pointer hover:underline"
                        data-action-reopen="${escapeHtml(item.originalUrl || item.downloadUrl || '')}"
                        title="${escapeHtml(itemTitle)}"
                      >
                        ${escapeHtml(itemTitle)}
                      </p>

                      ${item.quality ? `
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 shrink-0">
                          ${escapeHtml(item.quality)}
                        </span>
                      ` : ''}

                      ${hasDrive ? `
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 inline-flex items-center gap-1">
                          <i data-lucide="check" class="w-3 h-3"></i> Đã lưu Drive
                        </span>
                      ` : ''}
                    </div>

                    <div class="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex-wrap">
                      <span class="truncate">${escapeHtml(itemSubtitle)}</span>
                      <span>•</span>
                      ${item.resultSize ? `<span>${formatBytes(item.resultSize)}</span><span>•</span>` : ''}
                      <span>${formatRelativeTime(item.deletedAt || item.createdAt || Date.now())}</span>
                    </div>
                  </div>
                </div>

                <!-- Right: Action Buttons Group (Touch targets >= 44px) -->
                <div class="flex items-center justify-end gap-1.5 shrink-0 flex-wrap pt-2 md:pt-0 border-t border-zinc-100 dark:border-white/5 md:border-t-0">
                  
                  ${!isTrash ? `
                    <!-- Preview In App -->
                    <button
                      type="button"
                      data-action-preview="${escapeHtml(item.id)}"
                      class="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      title="Xem trước / Phát trong ứng dụng"
                    >
                      <i data-lucide="play" class="w-3.5 h-3.5 text-zinc-500"></i>
                      <span>Xem</span>
                    </button>

                    <!-- Direct Download (Supports SD / HD or Drive) -->
                    ${hasBothQualities ? `
                      <div class="inline-flex rounded-xl bg-zinc-100 dark:bg-white/5 p-0.5 border border-zinc-200 dark:border-white/10 shrink-0">
                        <button
                          type="button"
                          data-action-direct-download="${escapeHtml(item.videoHdUrl)}"
                          data-file-name="${escapeHtml((item.fileName || 'video').replace(/\.mp4$/i, '') + '_HD.mp4')}"
                          class="min-h-[44px] px-2.5 py-1.5 rounded-lg text-white text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1"
                          style="background-color: ${accentColor}"
                          title="Tải video chất lượng cao HD"
                        >
                          <i data-lucide="download" class="w-3.5 h-3.5"></i>
                          <span>HD</span>
                        </button>
                        <button
                          type="button"
                          data-action-direct-download="${escapeHtml(item.videoSdUrl)}"
                          data-file-name="${escapeHtml((item.fileName || 'video').replace(/\.mp4$/i, '') + '_SD.mp4')}"
                          class="min-h-[44px] px-2.5 py-1.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          title="Tải video chất lượng tiêu chuẩn SD"
                        >
                          <span>SD</span>
                        </button>
                      </div>
                    ` : `
                      <button
                        type="button"
                        data-action-download="${escapeHtml(item.id)}"
                        class="min-h-[44px] px-3 py-2 rounded-xl text-white text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                        style="background-color: ${accentColor}"
                        title="Tải tệp về thiết bị"
                      >
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        <span>Tải về</span>
                      </button>
                    `}

                    <!-- Drive Action -->
                    ${hasDrive ? `
                      <a
                        href="${driveTargetUrl}"
                        class="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-emerald-600 dark:text-emerald-400 transition flex items-center justify-center"
                        title="Xem trong Studio Drive"
                      >
                        <i data-lucide="hard-drive" class="w-4 h-4"></i>
                      </a>
                    ` : `
                      <button
                        type="button"
                        data-action-save-drive="${escapeHtml(item.id)}"
                        class="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center cursor-pointer"
                        title="Lưu vào Studio Drive"
                      >
                        <i data-lucide="cloud-upload" class="w-4 h-4"></i>
                      </button>
                    `}

                    <!-- Re-open / Re-resolve URL -->
                    <button
                      type="button"
                      data-action-reopen="${escapeHtml(item.originalUrl || item.downloadUrl || '')}"
                      class="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center cursor-pointer"
                      title="Dán lại liên kết và tải lại"
                    >
                      <i data-lucide="rotate-cw" class="w-4 h-4"></i>
                    </button>

                    <!-- Copy Direct Link -->
                    <button
                      type="button"
                      data-action-copy-link="${escapeHtml(item.downloadUrl || item.originalUrl || '')}"
                      class="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition flex items-center justify-center cursor-pointer"
                      title="Sao chép liên kết"
                    >
                      <i data-lucide="link" class="w-4 h-4"></i>
                    </button>

                    <!-- Move to Trash -->
                    <button
                      type="button"
                      data-action-delete="${escapeHtml(item.id)}"
                      class="min-h-[44px] min-w-[44px] p-2.5 rounded-xl hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 transition flex items-center justify-center cursor-pointer"
                      title="Chuyển vào thùng rác"
                    >
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  ` : `
                    <!-- Restore item from Trash -->
                    <button
                      type="button"
                      data-action-restore="${escapeHtml(item.id)}"
                      class="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                      title="Khôi phục mục này vào lịch sử"
                    >
                      <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                      <span>Khôi phục</span>
                    </button>

                    <!-- Permanently Delete -->
                    <button
                      type="button"
                      data-action-perm-delete="${escapeHtml(item.id)}"
                      class="min-h-[44px] min-w-[44px] p-2.5 rounded-xl hover:bg-rose-500/10 text-zinc-400 hover:text-rose-600 transition flex items-center justify-center cursor-pointer"
                      title="Xóa vĩnh viễn"
                    >
                      <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                  `}

                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

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
          soundEngine.playDeleteAll?.();
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
        soundEngine.playSuccess?.();
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
          soundEngine.playDeleteAll?.();
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
      const isVideo = !isAudio && !isImage;

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

  // 7. Save to Drive / Re-save
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

  // 8. Copy Link
  container.querySelectorAll('[data-action-copy-link]').forEach((btn) => {
    btn.onclick = async () => {
      const link = btn.getAttribute('data-action-copy-link');
      if (link) {
        await copyText(link);
        showToast('Đã sao chép liên kết vào bộ nhớ tạm', 'success');
      }
    };
  });

  // 9. Re-open / Re-resolve URL
  container.querySelectorAll('[data-action-reopen]').forEach((el) => {
    el.onclick = () => {
      const url = el.getAttribute('data-action-reopen');
      if (url && typeof onReResolve === 'function') {
        onReResolve(url);
      }
    };
  });

  // 10. Delete item (Move to trash)
  container.querySelectorAll('[data-action-delete]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-delete');
      soundEngine.playDelete?.();
      await storage.moveToTrash(id);
      showToast('Đã chuyển mục vào thùng rác', 'delete');
      onHistoryChange?.();
    };
  });

  // 11. Restore item from trash
  container.querySelectorAll('[data-action-restore]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-restore');
      soundEngine.playSuccess?.();
      await storage.restoreTrashItem(id);
      showToast('Đã khôi phục mục về lịch sử', 'success');
      onHistoryChange?.();
    };
  });

  // 12. Permanently delete item
  container.querySelectorAll('[data-action-perm-delete]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-action-perm-delete');
      soundEngine.playDelete?.();
      await storage.permanentlyDeleteTrashItem(id);
      showToast('Đã xóa vĩnh viễn mục khỏi thùng rác', 'delete');
      onHistoryChange?.();
    };
  });

  if (window.lucide?.createIcons) {
    window.lucide.createIcons({ root: container });
  }

  // 13. Real-time global synchronization listener
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
