/**
 * ViewSplitUrlModal.js - Image Ingestion Modal from URL & DD Studio Storage Drive
 * Allows pasting public web image URLs or browsing existing server drive assets.
 */

import { PANE_TITLES } from '../hooks/useViewSplit.js';

/**
 * Renders URL & Drive ingestion modal markup.
 * @param {Object} state
 * @returns {string}
 */
export function renderViewSplitUrlModal(state) {
  const { isUrlModalOpen, urlModalTargetPaneId } = state;
  if (!isUrlModalOpen) return '';

  const targetTitle = PANE_TITLES[urlModalTargetPaneId - 1] || `Ảnh ${urlModalTargetPaneId}`;

  return `
    <div id="viewsplit-url-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div class="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl p-5 text-zinc-900 dark:text-white flex flex-col gap-4 animate-scaleUp">
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <i data-lucide="link-2" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="font-bold text-sm text-zinc-900 dark:text-white">Nạp ảnh vào ${targetTitle}</h3>
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Nhập đường dẫn trực tiếp hoặc duyệt từ bộ nhớ DD Studio</p>
            </div>
          </div>
          <button
            type="button"
            data-action="close-url-modal"
            class="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition cursor-pointer"
          >
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- URL Input Tab Form -->
        <div class="space-y-3">
          <div>
            <label for="viewsplit-input-url" class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Liên kết ảnh (URL):</label>
            <div class="flex items-center gap-2">
              <input
                id="viewsplit-input-url"
                type="url"
                placeholder="https://example.com/image.png"
                class="flex-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-300 dark:border-white/10 focus:border-cyan-500 focus:outline-none text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500"
              />
              <button
                type="button"
                id="viewsplit-btn-load-url"
                data-action="load-url"
                data-pane-id="${urlModalTargetPaneId}"
                class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer shrink-0 shadow-sm"
              >
                Tải ảnh
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="flex items-center gap-3 pt-1">
            <div class="flex-1 h-px bg-zinc-200 dark:bg-white/10"></div>
            <span class="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-mono">hoặc duyệt bộ nhớ lưu trữ</span>
            <div class="flex-1 h-px bg-zinc-200 dark:bg-white/10"></div>
          </div>

          <!-- Storage Drive Browser Container -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tệp ảnh trong DD Studio:</span>
              <button
                type="button"
                id="viewsplit-btn-refresh-drive"
                data-action="refresh-drive"
                class="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                <span>Làm mới</span>
              </button>
            </div>

            <div
              id="viewsplit-drive-items-list"
              class="max-h-48 overflow-y-auto rounded-xl bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/10 p-2 divide-y divide-zinc-200/80 dark:divide-white/5 text-xs"
            >
              <div class="p-3 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                Đang tải danh sách ảnh từ Storage Drive...
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end pt-2 border-t border-zinc-200/80 dark:border-white/10">
          <button
            type="button"
            data-action="close-url-modal"
            class="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  `;
}
