/**
 * ConverterResult Component (Batch & ZIP Bundle Support)
 * Summary banner displaying total converted count, aggregate storage savings, and ZIP trigger.
 */

import { formatBytes } from '../../../../utilities/formatters.js';

export function renderConverterResult(state) {
  const items = state.items || [];
  const completed = items.filter(it => it.status === 'completed' && it.result);
  if (completed.length === 0) {
    return `<div id="converterResultPanel" class="hidden"></div>`;
  }

  const totalOrigSize = completed.reduce((acc, it) => acc + (it.result.originalSize || 0), 0);
  const totalResSize = completed.reduce((acc, it) => acc + (it.result.resultSize || 0), 0);
  const savedBytes = Math.max(0, totalOrigSize - totalResSize);
  const savedPct = totalOrigSize > 0 ? Math.round((savedBytes / totalOrigSize) * 100) : 0;

  return `
    <div id="converterResultPanel" class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.12] space-y-4 shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <!-- Title & Count -->
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            <i data-lucide="check-check" class="w-6 h-6"></i>
          </div>
          <div>
            <h4 class="text-base font-bold text-zinc-900 dark:text-white">
              Đã xử lý ${completed.length}/${items.length} tệp
            </h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              ${completed.length === items.length ? 'Hoàn tất xử lý' : 'Một số tệp đã sẵn sàng tải'}
            </p>
          </div>
        </div>

        <!-- Aggregate Storage Savings -->
        <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs font-mono text-zinc-700 dark:text-zinc-300 shrink-0">
          <span>${formatBytes(totalOrigSize)}</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-zinc-400"></i>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">
            ${formatBytes(totalResSize)} ${savedPct > 0 ? `(-${savedPct}%)` : ''}
          </span>
        </div>
      </div>

      <!-- Action Buttons Bar -->
      <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
        <!-- Download All as ZIP Button -->
        <button id="btnDownloadAllZip" type="button"
          class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-sm shadow-indigo-500/20 cursor-pointer active:scale-[0.99]">
          <i data-lucide="archive" class="w-4 h-4"></i>
          <span>Tải .zip (${completed.length} tệp)</span>
        </button>

        ${completed.length === 1 ? `
          <button id="btnPreviewSingleConverterResult" type="button" data-item-id="${completed[0].id}"
            class="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold border border-amber-500/20 flex items-center gap-1.5 transition cursor-pointer">
            <i data-lucide="eye" class="w-4 h-4"></i>
            <span>Xem trước</span>
          </button>
        ` : ''}

        <button id="btnClearAllConverterResults" type="button"
          class="px-3.5 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-xs font-medium transition flex items-center gap-1.5 ml-auto">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Làm mới</span>
        </button>
      </div>
    </div>
  `.trim();
}
