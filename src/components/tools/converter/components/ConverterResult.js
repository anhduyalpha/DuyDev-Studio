/**
 * ConverterResult Component (Batch & ZIP Bundle Support)
 * Summary banner displaying total converted count, aggregate storage savings,
 * individual file download & preview actions, and ZIP trigger.
 */

import { formatBytes } from '../../../../utilities/formatters.js';

export function renderConverterResult(state) {
  const items = state.items || [];
  const completed = items.filter(it => it.status === 'completed' && it.result);
  if (completed.length === 0) {
    return `<div id="converterResultPanel" class="hidden"></div>`;
  }

  const isAllFinished = completed.length === items.length && items.length > 0;
  const totalOrigSize = completed.reduce((acc, it) => acc + (it.result.originalSize || 0), 0);
  const totalResSize = completed.reduce((acc, it) => acc + (it.result.resultSize || 0), 0);
  const savedBytes = Math.max(0, totalOrigSize - totalResSize);
  const savedPct = totalOrigSize > 0 ? Math.round((savedBytes / totalOrigSize) * 100) : 0;

  return `
    <div id="converterResultPanel" class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] ${isAllFinished ? 'converter-result-completed-glow bg-emerald-500/[0.015] dark:bg-emerald-950/[0.08]' : 'border border-zinc-200/80 dark:border-white/[0.12]'} space-y-4 shadow-lg transition-all duration-300">
      <!-- Summary Header Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-100 dark:border-white/[0.06]">
        <!-- Title & Count -->
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl ${isAllFinished ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'} flex items-center justify-center shrink-0 shadow-xs">
            <i data-lucide="${isAllFinished ? 'check-check' : 'loader-2'}" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-base font-bold text-zinc-900 dark:text-white">
                Đã xử lý ${completed.length}/${items.length} tệp
              </h4>
              ${isAllFinished ? `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <i data-lucide="sparkles" class="w-3 h-3"></i> Hoàn tất 100%
                </span>
              ` : ''}
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              ${isAllFinished ? 'Tất cả tệp đã sẵn sàng tải về hoặc lưu trữ' : 'Một số tệp đã sẵn sàng, các tệp còn lại đang xử lý'}
            </p>
          </div>
        </div>

        <!-- Aggregate Storage Savings -->
        <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs font-mono text-zinc-700 dark:text-zinc-300 shrink-0 self-start sm:self-auto">
          <span>${formatBytes(totalOrigSize)}</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-zinc-400"></i>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">
            ${formatBytes(totalResSize)} ${savedPct > 0 ? `(-${savedPct}%)` : ''}
          </span>
        </div>
      </div>

      <!-- Converted Items List (Individual Download & Preview) -->
      <div class="divide-y divide-zinc-100 dark:divide-white/[0.05] max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
        ${completed.map((it) => {
          const res = it.result || {};
          const targetFmt = (it.targetFormat || (res.fileName || '').split('.').pop() || 'FILE').toUpperCase();
          const origExt = (it.detectedMeta?.extension || '').toUpperCase();
          const origSize = res.originalSize || it.detectedMeta?.size || 0;
          const resSize = res.resultSize || 0;

          return `
            <div class="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group rounded-xl hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] transition border border-transparent hover:border-zinc-200/50 dark:hover:border-white/[0.04]" data-item-id="${it.id}">
              <!-- Left: File Info -->
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono text-[11px] font-bold shrink-0 shadow-xs">
                  ${targetFmt.slice(0, 4)}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate" title="${res.fileName || ''}">
                      ${res.fileName || 'Tệp kết quả'}
                    </p>
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      ${targetFmt}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatBytes(resSize)}</span>
                    ${origSize && origSize !== resSize ? `
                      <span>•</span>
                      <span class="text-zinc-400 dark:text-zinc-500 line-through">${formatBytes(origSize)}</span>
                    ` : ''}
                    ${origExt ? `
                      <span>•</span>
                      <span class="text-zinc-400 dark:text-zinc-500">Từ ${origExt}</span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <!-- Right: Individual Actions (Download & Preview) -->
              <div class="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-white/[0.04] justify-end">
                <!-- Preview Button -->
                <button type="button" class="btn-preview-converter-result px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                  data-item-id="${it.id}" title="Xem trước tệp">
                  <i data-lucide="eye" class="w-3.5 h-3.5 text-indigo-500"></i>
                  <span>Xem</span>
                </button>

                <!-- Direct Individual Download Button -->
                <a href="${res.downloadUrl}" download="${res.fileName || 'file'}"
                  class="btn-download-converter-result px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs shadow-emerald-600/20"
                  title="Tải về tệp này">
                  <i data-lucide="download" class="w-3.5 h-3.5"></i>
                  <span>Tải về</span>
                </a>
              </div>
            </div>
          `;
        }).join('')}

        <!-- Failed Items (if any in batch) -->
        ${items.filter(it => it.status === 'error').map((it) => `
          <div class="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                LỖI
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                  ${it.file?.name || it.detectedMeta?.name || 'Tệp lỗi'}
                </p>
                <p class="text-[11px] text-red-500 dark:text-red-400 mt-0.5 line-clamp-1">
                  ${it.error || 'Quá trình chuyển đổi thất bại'}
                </p>
              </div>
            </div>
            <button type="button" class="btn-retry-converter-result px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-end sm:self-auto"
              data-item-id="${it.id}">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Thử lại</span>
            </button>
          </div>
        `).join('')}
      </div>

      <!-- Action Buttons Bar -->
      <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
        <!-- Download All as ZIP Button -->
        <button id="btnDownloadAllZip" type="button"
          class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-sm shadow-indigo-500/20 cursor-pointer active:scale-95">
          <i data-lucide="archive" class="w-4 h-4"></i>
          <span>Tải tất cả dạng .ZIP (${completed.length} tệp)</span>
        </button>

        <button id="btnClearAllConverterResults" type="button"
          class="px-3.5 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-xs font-medium transition flex items-center gap-1.5 ml-auto cursor-pointer active:scale-95">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          <span>Chuyển đổi tiếp</span>
        </button>
      </div>
    </div>
  `.trim();
}
