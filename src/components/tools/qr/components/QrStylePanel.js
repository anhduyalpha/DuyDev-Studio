/**
 * QrStylePanel Component
 * Collapsible accordion panel for custom dot styles, gradients, corners, and logos.
 * Collapsed by default for a clean, minimal interface.
 */

import { DOT_TYPES, CORNER_SQUARE_TYPES, COLOR_PRESETS } from '../hooks/useQrState.js';

export function renderQrStylePanel(styling) {
  const isExpanded = Boolean(styling.isExpanded);
  const isCustomized = Boolean(styling.isCustomized);

  return `
    <div class="pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
      <!-- Collapsible Header Toggle with Arrow -->
      <button 
        type="button" 
        id="btnToggleQrStyling" 
        class="w-full flex items-center justify-between py-2 text-left group cursor-pointer select-none"
      >
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <i data-lucide="palette" class="w-3.5 h-3.5"></i>
          </div>
          <span class="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white">Tùy Biến Giao Diện</span>
          ${isCustomized ? `
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">Đã tùy biến</span>
          ` : `
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.05] text-zinc-500 dark:text-zinc-400 font-medium">Chuẩn QR</span>
          `}
        </div>

        <div class="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition">
          <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" id="iconToggleQrStyling" class="w-4 h-4 transition-transform"></i>
        </div>
      </button>

      <!-- Collapsible Options Container -->
      <div id="qrStylingCollapseContent" class="${isExpanded ? '' : 'hidden'} space-y-5 pt-3 animate-fadeIn">
        ${isCustomized ? `
          <div class="flex items-center justify-between pb-1">
            <span class="text-xs text-zinc-500 dark:text-zinc-400">Đang áp dụng giao diện tùy biến</span>
            <button 
              type="button" 
              id="btnResetQrToStandard" 
              class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
            >
              Về chuẩn mặc định
            </button>
          </div>
        ` : ''}

        <!-- 1. Kiểu Điểm Ảnh -->
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Kiểu Điểm Ảnh</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${DOT_TYPES.map((dt) => `
              <button 
                type="button" 
                data-dot-type="${dt.id}" 
                class="btn-dot-type py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  styling.dotType === dt.id && isCustomized
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                }"
              >
                ${dt.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 2. Màu Sắc & Gradient -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-zinc-600 dark:text-zinc-400">Màu Sắc</label>
            <label class="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input type="checkbox" id="chkUseGradient" ${styling.useGradient && isCustomized ? 'checked' : ''} class="accent-indigo-600 rounded">
              <span>Gradient</span>
            </label>
          </div>

          ${styling.useGradient && isCustomized ? `
            <div class="grid grid-cols-2 gap-3">
              <div>
                <span class="block text-[11px] text-zinc-500 mb-1">Bắt đầu:</span>
                <div class="flex items-center gap-2">
                  <input type="color" id="qrGradientStart" value="${styling.gradientStart}" class="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 dark:border-zinc-700 p-0">
                  <span class="font-mono text-xs text-zinc-700 dark:text-zinc-300">${styling.gradientStart}</span>
                </div>
              </div>
              <div>
                <span class="block text-[11px] text-zinc-500 mb-1">Kết thúc:</span>
                <div class="flex items-center gap-2">
                  <input type="color" id="qrGradientEnd" value="${styling.gradientEnd}" class="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 dark:border-zinc-700 p-0">
                  <span class="font-mono text-xs text-zinc-700 dark:text-zinc-300">${styling.gradientEnd}</span>
                </div>
              </div>
            </div>
          ` : `
            <div class="flex items-center gap-2">
              ${COLOR_PRESETS.map((c) => `
                <button 
                  type="button" 
                  data-dot-color="${c.val}" 
                  class="btn-preset-dot-color w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                    isCustomized && styling.dotColor.toUpperCase() === c.val.toUpperCase()
                      ? 'border-indigo-500 scale-110 shadow-xs'
                      : 'border-zinc-300 dark:border-white/20 hover:scale-105'
                  }" 
                  style="background-color: ${c.val}" 
                  title="${c.label}"
                ></button>
              `).join('')}
              <div class="relative w-6 h-6 rounded-full overflow-hidden border border-zinc-300 dark:border-white/20 cursor-pointer ml-1">
                <input type="color" id="qrDotColor" value="${styling.dotColor || '#000000'}" class="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0">
              </div>
            </div>
          `}
        </div>

        <!-- 3. Kiểu Góc -->
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Kiểu Góc</label>
          <div class="grid grid-cols-3 gap-2">
            ${CORNER_SQUARE_TYPES.map((cs) => `
              <button 
                type="button" 
                data-corner-square="${cs.id}" 
                class="btn-corner-square py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  styling.cornerSquareType === cs.id && isCustomized
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                }"
              >
                ${cs.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 4. Logo Upload -->
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Logo</label>
          <div class="flex items-center gap-3">
            ${isCustomized && styling.logoUrl ? `
              <div class="relative w-12 h-12 rounded-xl border border-zinc-200 dark:border-zinc-700 p-1 bg-white flex items-center justify-center shrink-0">
                <img src="${styling.logoUrl}" alt="Logo" class="max-w-full max-h-full object-contain rounded">
              </div>
              <button id="btnRemoveDynamicLogo" type="button" class="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium transition cursor-pointer">
                Xóa Logo
              </button>
            ` : `
              <label class="flex-1 px-3.5 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.04] text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-2 cursor-pointer transition">
                <i data-lucide="image" class="w-4 h-4 text-zinc-400"></i>
                <span>Chọn tệp ảnh logo</span>
                <input type="file" id="dynamicLogoInput" accept="image/*" class="hidden">
              </label>
            `}
          </div>
        </div>
      </div>
    </div>
  `.trim();
}
