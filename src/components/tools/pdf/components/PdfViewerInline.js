import { renderPdfViewer, attachPdfListeners } from '../../../common/viewer/renderers/PdfRenderer.js';

export { attachPdfListeners };

export function renderPdfViewerInline({ fileUrl, title = 'Tài liệu PDF', onClose = null }) {
  if (!fileUrl) {
    return `
      <div class="rounded-2xl border border-dashed border-zinc-300 dark:border-white/10 p-8 text-center bg-zinc-50 dark:bg-white/[0.02]">
        <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <i data-lucide="file-search" class="w-6 h-6"></i>
        </div>
        <p class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Chưa chọn tệp</p>
        <p class="text-xs text-zinc-500 mt-1">Chọn hoặc kéo thả tệp PDF để xem</p>
      </div>
    `.trim();
  }

  const tabUrl = `/#view/pdf?file=${encodeURIComponent(fileUrl)}`;

  return `
    <div id="pdfInlineViewerWrapper" class="space-y-3 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-white/[0.06]">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <i data-lucide="file-text" class="w-4 h-4"></i>
          </div>
          <span class="text-sm font-bold text-zinc-900 dark:text-white truncate">${title}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="${tabUrl}" target="_blank" rel="noopener noreferrer"
             class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10 transition flex items-center gap-1.5">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Mở tab mới
          </a>
          <button id="btnClosePdfViewer" type="button"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex items-center gap-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i> Đóng
          </button>
        </div>
      </div>
      <div class="relative w-full rounded-xl overflow-hidden border border-zinc-200/60 dark:border-white/[0.06]">
        ${renderPdfViewer({ viewUrl: fileUrl, downloadUrl: fileUrl, name: title })}
      </div>
    </div>
  `.trim();
}
