/**
 * ResultCard Component (< 100 lines)
 * PDF processing completion and download card matching exact reference design
 */

import { formatBytes } from '../../../../utilities/formatters.js';

export function renderResultCard(result) {
  if (!result) return '';

  const durationText = typeof result.duration === 'string' && result.duration.endsWith('s')
    ? result.duration
    : `${Number(result.duration || 0).toFixed(2)}s`;

  const origSize = Number(result.originalSize) || 0;
  const resSize = Number(result.resultSize) || 0;
  const hasBothSizes = origSize > 0 && resSize > 0;

  // Percentage change calculation (e.g. -99.7%)
  let pctBadge = '';
  if (hasBothSizes) {
    let pct = result.savedPct;
    if (pct === undefined || pct === null || pct === 0) {
      pct = (((origSize - resSize) / origSize) * 100).toFixed(1);
    }
    const numPct = Number(pct);
    if (!isNaN(numPct) && numPct !== 0) {
      const pctFormatted = numPct > 0 ? `(-${numPct}%)` : `(+${Math.abs(numPct)}%)`;
      pctBadge = ` ${pctFormatted}`;
    }
  }

  const isZip = result.fileName?.toLowerCase().endsWith('.zip');
  const isDocx = result.fileName?.toLowerCase().endsWith('.docx');
  const previewIcon = isZip ? 'folder-archive' : (isDocx ? 'file-text' : 'eye');

  return `
    <div id="resultPanel" class="rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-xs transition-all animate-fadeIn">
      <!-- Header Row -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <i data-lucide="check" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <h4 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-tight">Xử lý hoàn tất</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>Tệp:</span>
              <strong class="text-zinc-800 dark:text-zinc-200 font-mono truncate max-w-[180px] sm:max-w-xs md:max-w-md">${result.fileName}</strong>
              <span class="text-zinc-400">&bull;</span>
              <span>Thời gian:</span>
              <span class="text-zinc-600 dark:text-zinc-300 font-mono">${durationText}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] text-xs font-mono text-zinc-700 dark:text-zinc-300 shrink-0 self-start sm:self-center">
          ${hasBothSizes ? `
            <span>${formatBytes(origSize)}</span>
            <span class="text-zinc-400 dark:text-zinc-500 font-sans mx-0.5">&rarr;</span>
            <span class="font-bold text-zinc-900 dark:text-white">${formatBytes(resSize)}${pctBadge}</span>
          ` : `
            <span class="font-bold text-zinc-900 dark:text-white">${formatBytes(resSize || origSize)}</span>
          `}
        </div>
      </div>

      <!-- Actions Row -->
      <div class="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
        <a href="${result.downloadUrl}" download="${result.fileName}"
          class="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer active:scale-[0.98]">
          <i data-lucide="download" class="w-4 h-4"></i> Tải về (${formatBytes(resSize || origSize)})
        </a>

        <button id="btnPreviewPdfResult" type="button" data-url="${result.downloadUrl}" data-file-id="${result.resultFileId || ''}"
          class="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#fff8eb] hover:bg-[#ffeed1] text-[#9a5b13] dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-[#fde3b7] dark:border-amber-800/50 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]">
          <i data-lucide="${previewIcon}" class="w-4 h-4 text-[#d97706] dark:text-amber-400"></i> Xem trước
        </button>

        <button id="btnTrashPdfResult" type="button"
          class="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 hover:text-red-600 dark:bg-white/[0.04] dark:hover:bg-red-500/10 dark:text-zinc-300 dark:hover:text-red-400 text-xs sm:text-sm font-medium border border-zinc-200 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]">
          <i data-lucide="trash-2" class="w-4 h-4 text-zinc-500 dark:text-zinc-400"></i> Xóa
        </button>

        <button id="btnResetResult" type="button"
          class="ml-auto min-h-[44px] px-3.5 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs sm:text-sm font-medium transition cursor-pointer flex items-center">
          Tiếp tục
        </button>
      </div>
    </div>
  `.trim();
}
