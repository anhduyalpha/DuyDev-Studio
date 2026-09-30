/**
 * PdfErrorBanner Component (< 30 lines)
 * Reusable error alert banner for PDF Studio Pro
 */

export function renderPdfErrorBanner(error) {
  if (!error) return '';
  return `
    <div class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm flex items-center justify-between gap-3 shadow-xs">
      <div class="flex items-center gap-2.5">
        <i data-lucide="alert-circle" class="w-5 h-5 text-red-500 shrink-0"></i>
        <span>${error}</span>
      </div>
      <button id="btnDismissError" type="button" class="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition cursor-pointer">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `.trim();
}
