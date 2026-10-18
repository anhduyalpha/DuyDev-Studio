/**
 * QrFormDynamic Component
 * Web Link with Platform Combobox
 */

import { URL_PRESETS } from '../hooks/useQrState.js';

export function renderQrFormDynamic(dynamic) {
  const currentPreset = dynamic.preset || 'custom';
  const selectedPresetObj = URL_PRESETS.find((p) => p.id === currentPreset) || URL_PRESETS[0];

  return `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
        <i data-lucide="globe" class="w-4 h-4 text-indigo-500"></i> Link Web
      </h3>

      <!-- Service Selector -->
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Dịch Vụ</label>
        <select id="dynamicPresetSelect" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
          ${URL_PRESETS.map((p) => `<option value="${p.id}" ${currentPreset === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
      </div>

      <!-- Target URL Input -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Địa Chỉ Web</label>
          ${currentPreset !== 'custom' ? `<span class="text-[11px] text-indigo-500 dark:text-indigo-400 font-medium">Yêu cầu liên kết ${selectedPresetObj.label}</span>` : ''}
        </div>
        <input 
          type="url" 
          id="dynamicTargetUrl" 
          value="${dynamic.targetUrl || dynamic.link || ''}" 
          placeholder="${selectedPresetObj.placeholder}" 
          class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          autocomplete="off"
        >
        <p id="dynamicUrlValidationError" class="hidden text-[11px] text-rose-500 font-medium mt-1.5 flex items-center gap-1.5 animate-fadeIn">
          <i data-lucide="alert-circle" class="w-3.5 h-3.5 shrink-0"></i>
          <span id="dynamicUrlValidationMsg"></span>
        </p>
      </div>

      <!-- Optional Title -->
      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Tên Gợi Nhớ (Không bắt buộc)</label>
        <input 
          type="text" 
          id="dynamicTitle" 
          value="${dynamic.title || ''}" 
          placeholder="Ví dụ: Bảng Báo Giá 2026" 
          class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        >
      </div>

      <!-- Submit Trigger Button -->
      <div class="pt-2">
        <button 
          id="btnCreateDynamicQr" 
          ${dynamic.isCreating ? 'disabled' : ''} 
          class="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm ${dynamic.isCreating ? 'opacity-60 cursor-not-allowed' : ''}"
        >
          ${dynamic.isCreating ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Đang tạo...' : '<i data-lucide="sparkles" class="w-4 h-4"></i> Tạo Mã QR'}
        </button>
      </div>
    </div>
  `.trim();
}
