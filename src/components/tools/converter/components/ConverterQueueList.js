/**
 * ConverterQueueList Component
 * Multi-item queue table with per-item format overrides, live progress and action buttons.
 */

import { formatBytes } from '../../../../utilities/formatters.js';
import { getCompatibleOutputs } from '../utilities/converterFormatRegistry.js';

export function renderConverterQueueList(state) {
  const items = state.items || [];
  if (items.length === 0) return '';

  return `
    <div class="rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] shadow-sm overflow-hidden space-y-3 p-4 sm:p-5">
      <div class="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-white/[0.05] pb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="layers" class="w-4 h-4 text-indigo-500"></i>
          <h4 class="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Hàng đợi chuyển đổi</h4>
          <span class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400">
            ${items.length} tệp
          </span>
        </div>
        <button id="btnClearConverterQueue" type="button" class="text-xs text-zinc-500 hover:text-red-500 transition flex items-center gap-1">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa tất cả
        </button>
      </div>

      <div class="divide-y divide-zinc-100 dark:divide-white/[0.04] max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
        ${items.map((it, idx) => renderQueueItem(it, idx, state.isConverting)).join('')}
      </div>
    </div>
  `;
}

function renderQueueItem(it, idx, isConverting) {
  const meta = it.detectedMeta || {};
  const compatibleFormats = getCompatibleOutputs(meta.extension);
  const isDone = it.status === 'completed';
  const isError = it.status === 'error';
  const isBusy = it.status === 'converting';

  return `
    <div class="py-3 px-1 sm:px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 group rounded-xl hover:bg-zinc-50/60 dark:hover:bg-white/[0.02] transition" data-item-id="${it.id}">
      <!-- Info Left (Row 1 on Mobile) -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-center shrink-0 font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
          ${meta.extension || 'FILE'}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white truncate" title="${meta.name || ''}">
            ${meta.name || 'Tệp không tên'}
          </p>
          <div class="flex items-center gap-2 text-[11px] font-mono text-zinc-500 mt-0.5">
            <span>${formatBytes(meta.size || 0)}</span>
            <span>•</span>
            <span class="text-indigo-500 uppercase">${meta.categoryLabel || meta.category || 'Tài liệu'}</span>
          </div>
        </div>
      </div>

      <!-- Actions Right (Row 2 on Mobile) -->
      <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-white/[0.04]">
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <!-- Target Format Selector (Disabled when converting/done) -->
          <select class="item-format-select py-1 px-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 cursor-pointer disabled:opacity-50 w-28"
            data-item-id="${it.id}" ${isBusy || isDone ? 'disabled' : ''}>
            ${compatibleFormats.map(fmt => `
              <option value="${fmt.id}" ${(it.targetFormat || '').toLowerCase() === fmt.id.toLowerCase() ? 'selected' : ''}>
                → ${fmt.name}${fmt.isRecommended ? ' ★' : ''}
              </option>
            `).join('')}
          </select>

          <!-- Status & Result Badges -->
          ${isDone ? `
            <button type="button" class="btn-preview-item px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition flex items-center gap-1 shadow-xs cursor-pointer"
              data-item-id="${it.id}" title="Xem trước tài liệu">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <a href="${it.result.downloadUrl}" download="${it.result.fileName}"
              class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition flex items-center gap-1 shadow-xs">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> ${formatBytes(it.result.resultSize)}
            </a>
          ` : isError ? `
            <button type="button" class="btn-retry-item px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition flex items-center gap-1"
              data-item-id="${it.id}" title="${it.error || 'Lỗi'}">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Thử lại
            </button>
          ` : isBusy ? `
            <div class="flex items-center gap-2 w-24 sm:w-28">
              <div class="w-full bg-zinc-200 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                <div class="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style="width: ${it.progress}%"></div>
              </div>
              <span class="text-[10px] font-mono text-indigo-500 shrink-0">${it.progress}%</span>
            </div>
          ` : it.uploadStatus === 'uploading' ? `
            <span class="badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
              <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>
              Đang tải lên ${it.uploadProgress || 0}%
            </span>
          ` : (it.uploadStatus === 'uploaded' || it.fileId) ? `
            <span class="badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40" title="Đã sẵn sàng">
              <i data-lucide="check" class="w-3 h-3"></i>
              Đã sẵn sàng
            </span>
          ` : it.uploadStatus === 'error' ? `
            <span class="badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40" title="${it.uploadError || 'Tải lên ngầm thất bại'}">
              <i data-lucide="alert-circle" class="w-3 h-3"></i>
              Lỗi tải lên
            </span>
          ` : (it.status === 'stale' || it.uploadStatus === 'expired') ? `
            <span class="badge-upload-status inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40" title="Phiên làm việc cũ. Vui lòng nạp lại tệp.">
              <i data-lucide="refresh-cw" class="w-3 h-3"></i>
              Cần nạp lại
            </span>
          ` : `
            <span class="badge-upload-status text-[11px] font-mono text-zinc-400 dark:text-zinc-500">Chờ lệnh</span>
          `}
        </div>

        <!-- Delete Item Button -->
        <button type="button" class="btn-remove-item p-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition disabled:opacity-30 shrink-0 cursor-pointer"
          data-item-id="${it.id}" ${isBusy ? 'disabled' : ''} title="Xóa tệp này">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}
