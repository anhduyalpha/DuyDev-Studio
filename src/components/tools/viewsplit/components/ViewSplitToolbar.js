/**
 * ViewSplitToolbar.js - Header Navigation & Action Bar for ViewSplit
 * Layout pickers, Synchronizer locks, Sampling filters, Fit/Reset, and Export commands.
 */

import { LAYOUT_MODES, PANE_TITLES } from '../hooks/useViewSplit.js';
import { getStoredTheme } from '../../../../hooks/useTheme.js';

/**
 * Renders toolbar markup.
 * @param {Object} state
 * @returns {string}
 */
export function renderViewSplitToolbar(state) {
  const {
    layout,
    syncView,
    syncCursor,
    filter,
    inspectorOpen,
    activePaneId
  } = state;

  const isOverlay = layout === LAYOUT_MODES.SLIDER || layout === LAYOUT_MODES.DIFF;
  const isDark = typeof document !== 'undefined'
    ? (document.documentElement.classList.contains('dark') || getStoredTheme() === 'dark')
    : true;
  const visibleCount = typeof state.getVisiblePaneCount === 'function'
    ? state.getVisiblePaneCount()
    : (layout === LAYOUT_MODES.SINGLE ? 1 : layout === LAYOUT_MODES.QUAD ? 4 : (layout === LAYOUT_MODES.TRIPLE_H || layout === LAYOUT_MODES.TRIPLE_L || layout === LAYOUT_MODES.TRIPLE_T ? 3 : 2));

  const layoutButtons = [
    { id: LAYOUT_MODES.SINGLE, label: '1', title: '1 Khung hình' },
    { id: LAYOUT_MODES.SPLIT_H, label: '2H', title: '2 Khung ngang' },
    { id: LAYOUT_MODES.SPLIT_V, label: '2V', title: '2 Khung dọc' },
    { id: LAYOUT_MODES.TRIPLE_H, label: '3H', title: '3 Khung ngang' },
    { id: LAYOUT_MODES.TRIPLE_L, label: '3L', title: '3 Khung chính trái' },
    { id: LAYOUT_MODES.TRIPLE_T, label: '3T', title: '3 Khung chính trên' },
    { id: LAYOUT_MODES.QUAD, label: '4G', title: 'Lưới 4 khung' }
  ];

  return `
    <header class="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 rounded-2xl p-2.5 sm:p-3 shadow-sm transition-all flex flex-wrap items-center justify-between gap-2.5">
      <!-- Left: Title & Mode Selectors -->
      <div class="flex items-center flex-wrap gap-2">
        <div class="flex items-center gap-2 mr-1">
          <div class="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center shrink-0">
            <i data-lucide="columns-2" class="w-4 h-4"></i>
          </div>
          <span class="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline">ViewSplit</span>
        </div>

        <!-- Multi-Pane Layout Selector Group -->
        <div class="flex items-center bg-zinc-100 dark:bg-black/40 p-1 rounded-xl border border-zinc-200/60 dark:border-white/5 gap-0.5">
          ${layoutButtons.map((btn) => `
            <button
              type="button"
              data-action="set-layout"
              data-layout="${btn.id}"
              title="${btn.title}"
              class="px-2 py-1 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                layout === btn.id
                  ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
              }"
            >
              ${btn.label}
            </button>
          `).join('')}
        </div>

        <!-- Wipe & Difference Overlay Group -->
        <div class="flex items-center bg-zinc-100 dark:bg-black/40 p-1 rounded-xl border border-zinc-200/60 dark:border-white/5 gap-0.5">
          <button
            type="button"
            data-action="set-layout"
            data-layout="${LAYOUT_MODES.SLIDER}"
            title="Thanh trượt gạt so sánh"
            class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              layout === LAYOUT_MODES.SLIDER
                ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }"
          >
            <i data-lucide="split" class="w-3.5 h-3.5"></i>
            <span class="hidden md:inline">Slider Wipe</span>
          </button>
          <button
            type="button"
            data-action="set-layout"
            data-layout="${LAYOUT_MODES.DIFF}"
            title="So sánh sai khác điểm ảnh"
            class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              layout === LAYOUT_MODES.DIFF
                ? 'bg-white dark:bg-zinc-800 text-rose-500 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }"
          >
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span class="hidden md:inline">Diff</span>
          </button>
        </div>

        <!-- Active Box Selector Group (Pills) -->
        <div class="flex items-center bg-zinc-100 dark:bg-black/40 p-1 rounded-xl border border-zinc-200/60 dark:border-white/5 gap-0.5">
          ${Array.from({ length: visibleCount }, (_, i) => i + 1).map((id) => {
            const isSelected = activePaneId === id;
            const title = PANE_TITLES[id - 1] || `Ảnh ${id}`;
            const pane = typeof state.getPane === 'function' ? state.getPane(id) : state.panes?.[id - 1];
            const hasImage = Boolean(pane?.image);
            return `
              <button
                type="button"
                data-action="select-pane"
                data-pane-id="${id}"
                title="Chọn ${title} để nạp / dán ảnh"
                class="px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                }"
              >
                <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-cyan-400 animate-pulse' : hasImage ? 'bg-emerald-400' : 'bg-zinc-400/50'}"></span>
                <span>${title}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Center & Right: Sync Locks, Actions, Export -->
      <div class="flex items-center flex-wrap gap-1.5 sm:gap-2">
        <!-- Sync View & Cursor Toggles -->
        <div class="flex items-center bg-zinc-100 dark:bg-black/40 p-1 rounded-xl border border-zinc-200/60 dark:border-white/5 gap-0.5">
          <button
            type="button"
            data-action="toggle-sync-view"
            title="Đồng bộ thu phóng và cuộn [S]"
            class="px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              syncView
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }"
          >
            <i data-lucide="${syncView ? 'lock' : 'unlock'}" class="w-3.5 h-3.5"></i>
            <span class="hidden xl:inline">Sync View</span>
          </button>
          <button
            type="button"
            data-action="toggle-sync-cursor"
            title="Đồng bộ con trỏ chữ thập [C]"
            class="px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              syncCursor
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }"
          >
            <i data-lucide="crosshair" class="w-3.5 h-3.5"></i>
            <span class="hidden xl:inline">Sync Cursor</span>
          </button>
        </div>

        <!-- Filter Sampling Toggle -->
        <button
          type="button"
          data-action="toggle-filter"
          title="Chế độ lọc: Bilinear / Nearest Neighbor [N]"
          class="px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'nearest'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              : 'bg-zinc-100 dark:bg-black/40 border-zinc-200/60 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }"
        >
          <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          <span class="font-mono">${filter === 'nearest' ? 'Pixelated' : 'Smooth'}</span>
        </button>

        <!-- View Navigation: Fit, 1:1, Reset -->
        <div class="flex items-center gap-1">
          <button
            type="button"
            data-action="fit-all"
            title="Vừa vặn khung hình [F]"
            class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-100 dark:bg-black/40 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/5 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
          >
            <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
            <span class="hidden lg:inline">Fit</span>
          </button>
          <button
            type="button"
            data-action="actual-size"
            title="Kích thước gốc 100% [1]"
            class="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-zinc-100 dark:bg-black/40 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/5 text-xs font-mono font-semibold transition cursor-pointer"
          >
            1:1
          </button>
          <button
            type="button"
            data-action="reset-view"
            title="Đặt lại góc nhìn [R]"
            class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-100 dark:bg-black/40 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/5 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
          >
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span class="hidden lg:inline">Reset</span>
          </button>
        </div>

        <!-- Pixel Inspector Toggle -->
        <button
          type="button"
          data-action="toggle-inspector"
          title="Kính lúp soi điểm ảnh [I]"
          class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
            inspectorOpen
              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
              : 'bg-zinc-100 dark:bg-black/40 border-zinc-200/60 dark:border-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }"
        >
          <i data-lucide="zoom-in" class="w-3.5 h-3.5"></i>
          <span class="hidden sm:inline">Loupe</span>
        </button>

        <!-- Dedicated Theme Toggle Button -->
        <button
          type="button"
          data-action="toggle-theme"
          title="${isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}"
          class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-100 dark:bg-black/40 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/5 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
        >
          <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-cyan-600'}"></i>
          <span class="hidden sm:inline">${isDark ? 'Sáng' : 'Tối'}</span>
        </button>

        <!-- Export Dropdown / Buttons -->
        <div class="flex items-center gap-1">
          <button
            type="button"
            data-action="copy-composite"
            title="Sao chép ảnh ghép so sánh vào Clipboard"
            class="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-white/10 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span class="hidden md:inline">Sao chép</span>
          </button>
          <button
            type="button"
            data-action="download-composite"
            title="Tải về ảnh so sánh tổng hợp (PNG)"
            class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm hover:shadow text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Xuất ảnh</span>
          </button>
        </div>
      </div>
    </header>
  `;
}
