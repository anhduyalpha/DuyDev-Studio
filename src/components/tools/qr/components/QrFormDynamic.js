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
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Địa Chỉ Web</label>
        <input 
          type="url" 
          id="dynamicTargetUrl" 
          value="${dynamic.targetUrl || dynamic.link || ''}" 
          placeholder="${selectedPresetObj.placeholder}" 
          class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          autocomplete="off"
        >
      </div>

      <!-- Optional Title & Slug -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Tên Gợi Nhớ</label>
          <input 
            type="text" 
            id="dynamicTitle" 
            value="${dynamic.title || ''}" 
            placeholder="Ví dụ: Bảng Báo Giá 2026" 
            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Mã Slug</label>
          <input 
            type="text" 
            id="dynamicCustomSlug" 
            value="${dynamic.customSlug || ''}" 
            placeholder="Ví dụ: baogia" 
            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
        </div>
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
