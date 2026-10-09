/**
 * ViewSplitMobileTabs.js - Responsive Mobile Tab Switcher Component
 * Segmented quick-access switcher [Ảnh A] [Ảnh B] [Ảnh C] [Ảnh D] for small mobile screens.
 */

import { PANE_TITLES } from '../hooks/useViewSplit.js';

/**
 * Renders Mobile Segmented Tab bar markup.
 * @param {Object} state
 * @returns {string}
 */
export function renderViewSplitMobileTabs(state) {
  const { panes, mobileActiveTab } = state;

  return `
    <nav aria-label="Khung nhìn di động" class="w-full md:hidden flex items-center justify-center p-1.5 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 rounded-2xl shadow-sm mb-3">
      <div class="grid grid-cols-4 w-full gap-1">
        ${panes.map((pane) => {
          const isActive = mobileActiveTab === pane.id;
          const hasImage = Boolean(pane.image);
          const title = PANE_TITLES[pane.id - 1] || `Ảnh ${pane.id}`;

          return `
            <button
              type="button"
              data-action="set-mobile-tab"
              data-pane-id="${pane.id}"
              class="relative flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }"
            >
              <span class="w-1.5 h-1.5 rounded-full ${hasImage ? 'bg-emerald-400' : 'bg-zinc-400/50'}"></span>
              <span>${title}</span>
            </button>
          `;
        }).join('')}
      </div>
    </nav>
  `;
}
