/**
 * Recent Activity Component (Dark Professional Minimalism)
 * High-density activity feed with tool badges and direct workspace launcher
 */

import { storage } from '../../utilities/storage.js';
import { formatBytes, formatRelativeTime } from '../../utilities/formatters.js';
import { toolRegistry } from '../../hooks/useToolRegistry.js';

export function renderRecentActivity() {
  const history = storage.getHistory().slice(0, 3);

  if (history.length === 0) return '';

  return `
    <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.07] space-y-3 shadow-xs">
      <div class="flex items-center justify-between">
        <h4 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-zinc-500 dark:text-zinc-400"></i> Tác vụ gần đây
        </h4>
        <div class="flex items-center gap-3">
          <a href="#trash" class="text-xs sm:text-sm text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 font-semibold flex items-center gap-1 transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Thùng rác
          </a>
          <a href="#history" class="text-xs sm:text-sm text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white font-semibold transition">Xem tất cả</a>
        </div>
      </div>

      <div id="recentActivityCardsGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${history.map((item) => {
          const tool = toolRegistry.getToolById(item.toolId);
          const toolColor = tool.color || '#6366F1';
          const toolBg = `${toolColor}15`;
          const toolBorder = `${toolColor}33`;

          return `
            <div data-recent-card-id="${item.id}"
              class="recent-activity-card p-3 sm:p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-2.5 text-sm hover:border-zinc-300 dark:hover:border-white/10 transition">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 border"
                  style="background-color: ${toolBg}; border-color: ${toolBorder}; color: ${toolColor};">
                  <i data-lucide="${tool.icon || 'check'}" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <a href="${tool.route || '#'}" title="Chuyển đến ${tool.title}"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition hover:opacity-80 truncate max-w-[130px]"
                      style="color: ${toolColor}; background-color: ${toolBg}; border-color: ${toolBorder};">
                      <span>${tool.title || 'Công cụ'}</span>
                    </a>
                  </div>
                  <p class="font-bold text-zinc-900 dark:text-zinc-100 truncate text-xs sm:text-sm font-mono" title="${item.fileName || 'Tệp không tên'}">
                    ${item.fileName || 'Tệp không tên'}
                  </p>
                  <p class="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">
                    ${formatBytes(item.resultSize)} • ${formatRelativeTime(item.timestamp || item.createdAt)}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0 ml-1">
                <!-- Open in Tool Workspace -->
                <button type="button" data-open-in-tool="${item.id}" data-tool-id="${tool.id}" title="Mở"
                  class="btn-open-in-tool p-1.5 sm:p-2 text-zinc-700 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] transition inline-flex items-center cursor-pointer">
                  <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                </button>

                <!-- Copy Link or Content -->
                <button type="button" data-copy-id="${item.id}" title="Sao chép"
                  class="btn-copy-recent p-1.5 sm:p-2 text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] transition inline-flex items-center cursor-pointer">
                  <i data-lucide="copy" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                </button>

                <!-- Preview -->
                ${item.downloadUrl ? `
                  <button type="button" data-preview-url="${item.downloadUrl}" data-file-name="${item.fileName}" data-file-size="${item.resultSize || 0}" title="Xem trước"
                    class="btn-preview-recent p-1.5 sm:p-2 text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] transition inline-flex items-center cursor-pointer">
                    <i data-lucide="eye" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                  </button>
                  <a href="${item.downloadUrl}" download="${item.fileName}" title="Tải về"
                    class="p-1.5 sm:p-2 text-zinc-700 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] transition inline-flex items-center">
                    <i data-lucide="download" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                  </a>
                ` : ''}

                <!-- Move to Trash -->
                <button type="button" data-trash-recent="${item.id}" title="Xoá"
                  class="btn-trash-recent p-1.5 sm:p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition inline-flex items-center cursor-pointer">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
