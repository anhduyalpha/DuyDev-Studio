/**
 * QrFormStatic Component
 * Plain Text input & Shared Generation Action Controls
 */

import { COLOR_PRESETS } from '../hooks/useQrState.js';

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
  const { colorDark, width, format, isGenerating } = state;

  return `
    <div class="space-y-4 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
      <!-- Color Options -->
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Màu Sắc</label>
        <div class="flex items-center gap-1.5">
          ${COLOR_PRESETS.map((c) => `
            <button type="button" data-color-dark="${c.val}" class="btn-color-preset w-6 h-6 rounded-full border-2 transition ${colorDark.toUpperCase() === c.val.toUpperCase() ? 'border-indigo-500 scale-110 shadow-xs' : 'border-zinc-300 dark:border-white/20 hover:scale-105'}" style="background-color: ${c.val}" title="${c.label}"></button>
          `).join('')}
          <div class="relative w-6 h-6 rounded-full overflow-hidden border border-zinc-300 dark:border-white/20 cursor-pointer ml-1">
            <input type="color" id="qrCustomColorDark" value="${colorDark.startsWith('#') && colorDark.length === 7 ? colorDark : '#000000'}" class="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0">
          </div>
        </div>
      </div>

      <!-- Format & Submit Controls -->
      <div class="pt-3 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Định dạng:</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input type="radio" name="qrFormatRadio" value="png" ${format === 'png' ? 'checked' : ''} class="accent-indigo-600">
              <span>PNG</span>
            </label>
            <label class="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input type="radio" name="qrFormatRadio" value="svg" ${format === 'svg' ? 'checked' : ''} class="accent-indigo-600">
              <span>SVG</span>
            </label>
          </div>
        </div>

        <button id="btnGenerateQr" ${isGenerating ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 transition shadow-sm ${isGenerating ? 'opacity-60 cursor-not-allowed' : ''}">
          ${isGenerating ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Đang tạo...' : '<i data-lucide="sparkles" class="w-4 h-4"></i> Tạo Mã QR'}
        </button>
      </div>
    </div>
  `.trim();
}
