/**
 * HistoryItemRow Component (< 80 lines)
 */
import { formatBytes, formatRelativeTime } from '../../utilities/formatters.js';

export function renderHistoryItemRow(item, isTrash) {
  const downloadHref = item.downloadUrl || (item.resultFileId ? `/api/v1/files/download/${item.resultFileId}` : null);
  const hasPreview = Boolean(downloadHref);

  return `
    <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition text-sm">
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-10 h-10 rounded-xl ${isTrash ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'} border flex items-center justify-center shrink-0">
          <i data-lucide="${isTrash ? 'trash' : 'check'}" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-zinc-900 dark:text-white truncate text-sm sm:text-base">${item.fileName || 'Tài liệu'}</p>
          <p class="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
            Công cụ: <span class="text-indigo-600 dark:text-indigo-300 font-medium">${item.toolTitle || item.tool || 'Xử lý'}</span>
            ${item.resultSize ? ` • ${formatBytes(item.resultSize)}` : ''}
            • ${formatRelativeTime(item.deletedAt || item.createdAt || item.timestamp)}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end sm:justify-start gap-2 pt-2 sm:pt-0 border-t border-zinc-100 dark:border-white/[0.04] sm:border-t-0 shrink-0 w-full sm:w-auto">
        ${hasPreview ? `
          <button type="button" data-preview-id="${item.id}" class="btn-preview-history px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Xem
          </button>
          ${!isTrash && downloadHref ? `
            <a href="${downloadHref}" download="${item.fileName || 'file'}" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải lại
            </a>
          ` : ''}
        ` : ''}

        ${!isTrash ? `
          <button data-delete-history="${item.id}" class="btn-delete-item p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition" title="Chuyển vào thùng rác">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : `
          <button data-restore-trash="${item.id}" class="btn-restore-item px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Khôi phục
          </button>
          <button data-perm-delete="${item.id}" class="btn-perm-delete p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition" title="Xóa vĩnh viễn">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        `}
      </div>
    </div>
  `;
}
