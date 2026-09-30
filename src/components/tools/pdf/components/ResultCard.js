/**
 * ResultCard Component (< 100 lines)
 * PDF processing completion and download card
 */

import { formatBytes } from '../../../../utilities/formatters.js';

export function renderResultCard(result) {
  if (!result) return '';

  const isPdf = result.fileName?.toLowerCase().endsWith('.pdf');
  const isZip = result.fileName?.toLowerCase().endsWith('.zip');
  const isDocx = result.fileName?.toLowerCase().endsWith('.docx');

  return `
    <div id="resultPanel" class="rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] p-5 space-y-4 shadow-sm transition-all animate-fadeIn">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isDocx ? 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'} flex items-center justify-center shrink-0">
            <i data-lucide="${isDocx ? 'file-check' : 'check'}" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-sm font-bold text-zinc-900 dark:text-white">Xử lý hoàn tất</h4>
              ${isDocx ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Word DOCX</span>' : ''}
              ${result.isClientProcessed ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Xử lý tại thiết bị</span>' : ''}
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Tệp: <strong class="text-zinc-800 dark:text-zinc-200 font-mono">${result.fileName}</strong> • Thời gian: <span class="text-zinc-600 dark:text-zinc-300 font-mono">${result.duration}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs font-mono text-zinc-700 dark:text-zinc-300 shrink-0">
          <span>${formatBytes(result.originalSize)}</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-zinc-400"></i>
          <span class="font-bold text-zinc-900 dark:text-white">${formatBytes(result.resultSize)} ${result.savedPct ? `(-${result.savedPct}%)` : ''}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
        <a href="${result.downloadUrl}" download="${result.fileName}"
          class="min-h-[40px] px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-2 transition shadow-xs">
          <i data-lucide="download" class="w-4 h-4"></i> Tải về (${formatBytes(result.resultSize)})
        </a>

        ${isPdf || isZip || isDocx ? `
          <button id="btnPreviewPdfResult" type="button" data-url="${result.downloadUrl}" data-file-id="${result.resultFileId || ''}"
            class="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs sm:text-sm font-semibold border border-amber-500/20 flex items-center gap-1.5 transition cursor-pointer">
            <i data-lucide="${isPdf ? 'eye' : isDocx ? 'file-text' : 'folder-archive'}" class="w-4 h-4"></i> Xem trước
          </button>
        ` : ''}

        ${isPdf ? `
          <div class="relative inline-block" id="chainWorkflowContainer">
            <button id="btnToggleChainWorkflow" type="button"
              class="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-300 dark:hover:text-white text-xs sm:text-sm font-semibold border border-zinc-200 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer">
              <i data-lucide="forward" class="w-4 h-4 text-amber-500"></i>
              <span>Chuyển tiếp</span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-zinc-400"></i>
            </button>
            <div id="chainWorkflowMenu" class="hidden absolute left-0 bottom-full mb-2 w-48 rounded-xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/10 shadow-xl py-1 z-20">
              <button type="button" data-chain-mode="organize" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="layout-grid" class="w-3.5 h-3.5 text-amber-500"></i> Sắp xếp trang
              </button>
              <button type="button" data-chain-mode="compress" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="minimize-2" class="w-3.5 h-3.5 text-amber-500"></i> Nén PDF
              </button>
              <button type="button" data-chain-mode="split" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="scissors" class="w-3.5 h-3.5 text-amber-500"></i> Tách trang
              </button>
              <button type="button" data-chain-mode="rotate" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="rotate-cw" class="w-3.5 h-3.5 text-amber-500"></i> Xoay trang
              </button>
              <button type="button" data-chain-mode="watermark" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="stamp" class="w-3.5 h-3.5 text-amber-500"></i> Đóng dấu PDF
              </button>
              <button type="button" data-chain-mode="security" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="shield" class="w-3.5 h-3.5 text-amber-500"></i> Bảo mật PDF
              </button>
              <button type="button" data-chain-mode="extract_images" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="images" class="w-3.5 h-3.5 text-amber-500"></i> Trích ảnh
              </button>
              <button type="button" data-chain-mode="view" class="btn-chain-mode w-full px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2 cursor-pointer transition">
                <i data-lucide="eye" class="w-3.5 h-3.5 text-amber-500"></i> Xem PDF
              </button>
            </div>
          </div>
        ` : ''}

        <button id="btnCopyDownloadLink" data-url="${result.downloadUrl}" type="button"
          class="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] dark:text-zinc-300 dark:hover:text-white text-xs sm:text-sm font-medium border border-zinc-200 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer">
          <i data-lucide="link" class="w-4 h-4"></i> Sao chép link
        </button>

        <button id="btnTrashPdfResult" type="button"
          class="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-600 dark:bg-white/[0.05] dark:hover:bg-red-500/10 dark:text-zinc-300 dark:hover:text-red-400 text-xs sm:text-sm font-medium border border-zinc-200 dark:border-white/[0.08] flex items-center gap-1.5 transition cursor-pointer">
          <i data-lucide="trash-2" class="w-4 h-4"></i> Xóa
        </button>

        <button id="btnResetResult" type="button"
          class="ml-auto min-h-[40px] px-3.5 py-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs sm:text-sm font-medium transition cursor-pointer">
          Tiếp tục
        </button>
      </div>
    </div>
  `.trim();
}
