/**
 * QrFormStatic Component
 * Plain Text input & Shared Generation Action Controls
 */

export function renderQrFormStatic(state) {
  const { text } = state;

  return `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
        <i data-lucide="file-text" class="w-4 h-4 text-emerald-500"></i> Văn Bản
      </h3>
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Nội Dung</label>
        <textarea id="qrTextInput" rows="4" placeholder="Nhập nội dung văn bản..." class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">${text.content || ''}</textarea>
      </div>
    </div>
  `.trim();
}

export function renderQrActionControls(state) {
  const { format, isGenerating } = state;

  return `
    <div class="pt-4 border-t border-zinc-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Định dạng:</span>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer min-h-[44px] py-1 select-none">
            <input type="radio" name="qrFormatRadio" value="png" ${format === 'png' ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 cursor-pointer">
            <span class="font-medium">PNG</span>
          </label>
          <label class="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer min-h-[44px] py-1 select-none">
            <input type="radio" name="qrFormatRadio" value="svg" ${format === 'svg' ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 cursor-pointer">
            <span class="font-medium">SVG</span>
          </label>
        </div>
      </div>

      <button id="btnGenerateQr" ${isGenerating ? 'disabled' : ''} class="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}">
        ${isGenerating ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Đang tạo...' : '<i data-lucide="sparkles" class="w-4 h-4"></i> Tạo Mã QR'}
      </button>
    </div>
  `.trim();
}
