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
    <div class="p-4 sm:p-5 rounded-2xl glass-panel-contained space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-zinc-500 dark:text-zinc-400"></i> Tác vụ gần đây
        </h4>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <a href="#trash" class="text-xs sm:text-sm text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 font-semibold flex items-center gap-1 transition px-2.5 py-1 rounded-lg glass-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500" aria-label="Mở thùng rác">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> <span>Thùng rác</span>
          </a>
          <a href="#history" class="text-xs sm:text-sm text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white font-semibold transition px-2.5 py-1 rounded-lg glass-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="Xem tất cả lịch sử tác vụ"><span>Xem tất cả</span></a>
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
              class="recent-activity-card p-3.5 sm:p-4 rounded-xl glass-pill flex flex-col justify-between gap-3 text-sm hover:border-zinc-300 dark:hover:border-white/20 transition">
              
              <!-- File Meta Info (Full width, clear hierarchy) -->
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-2xs"
                  style="background-color: ${toolBg}; border-color: ${toolBorder}; color: ${toolColor};">
                  <i data-lucide="${tool.icon || 'check'}" class="w-4 h-4 sm:w-5 sm:h-5"></i>
                </div>
                
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 mb-1">
                    <a href="${tool.route || '#'}" title="Chuyển đến ${tool.title}"
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition hover:opacity-80 truncate max-w-[150px]"
                      style="color: ${toolColor}; background-color: ${toolBg}; border-color: ${toolBorder};">
                      <span>${tool.title || 'Công cụ'}</span>
                    </a>
                  </div>
                  <p class="font-bold text-zinc-900 dark:text-zinc-100 truncate text-xs sm:text-sm font-mono tracking-tight" title="${item.fileName || 'Tệp không tên'}">
                    ${item.fileName || 'Tệp không tên'}
                  </p>
                  <p class="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    ${formatBytes(item.resultSize)} • ${formatRelativeTime(item.timestamp || item.createdAt)}
                  </p>
                </div>
              </div>

              <!-- Action Bar: Touch-adapted targets (min 38-44px), separated destructive trash -->
              <div class="pt-2 border-t border-zinc-200/60 dark:border-white/[0.05] flex items-center justify-between gap-2">
                <!-- Left: Primary & Quick Access Actions -->
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                  ${item.downloadUrl ? `
                    <!-- Primary Download Button -->
                    <a href="${item.downloadUrl}" download="${item.fileName}" 
                      title="Tải về" 
                      aria-label="Tải về tệp ${item.fileName || ''}"
                      class="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                      <span class="truncate">Tải về</span>
                    </a>

                    <!-- Preview Modal Button -->
                    <button type="button" data-preview-url="${item.downloadUrl}" data-file-name="${item.fileName}" data-file-size="${item.resultSize || 0}" 
                      title="Xem trước" 
                      aria-label="Xem trước tệp ${item.fileName || ''}"
                      class="btn-preview-recent min-w-[38px] min-h-[38px] p-2 text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white rounded-lg glass-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition inline-flex items-center justify-center cursor-pointer">
                      <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                  ` : ''}

                  <!-- Open in Tool Workspace -->
                  <button type="button" data-open-in-tool="${item.id}" data-tool-id="${tool.id}" 
                    title="Mở trong ${tool.title}" 
                    aria-label="Mở tệp ${item.fileName || 'này'} trong ${tool.title}"
                    class="btn-open-in-tool min-w-[38px] min-h-[38px] p-2 text-zinc-700 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400 rounded-lg glass-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition inline-flex items-center justify-center cursor-pointer">
                    <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                  </button>

                  <!-- Copy Link or Content -->
                  <button type="button" data-copy-id="${item.id}" 
                    title="Sao chép" 
                    aria-label="Sao chép nội dung hoặc liên kết ${item.fileName || 'tệp'}"
                    class="btn-copy-recent min-w-[38px] min-h-[38px] p-2 text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white rounded-lg glass-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition inline-flex items-center justify-center cursor-pointer">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                  </button>
                </div>

                <!-- Right: Destructive Action isolated to prevent misclicks -->
                <div class="pl-2 border-l border-zinc-200/80 dark:border-white/[0.08] shrink-0">
                  <button type="button" data-trash-recent="${item.id}" 
                    title="Xoá" 
                    aria-label="Chuyển tệp ${item.fileName || 'này'} vào thùng rác"
                    class="btn-trash-recent min-w-[38px] min-h-[38px] p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition inline-flex items-center justify-center cursor-pointer">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
