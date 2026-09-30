/**
 * Category Filter Bar Component (Dark Professional Minimalism with Soft Accents)
 */

const CATEGORIES = [
  { id: 'all', label: 'Tất cả', color: '#A1A1AA' },
  { id: 'pdf', label: 'PDF', color: '#F59E0B' },
  { id: 'convert', label: 'Chuyển đổi', color: '#8B5CF6' },
  { id: 'archive', label: 'File nén', color: '#0EA5E9' },
  { id: 'qr', label: 'Mã QR', color: '#10B981' },
  { id: 'system', label: 'Tiện ích', color: '#6366F1' }
];

export function renderCategoryFilters(activeCategory = 'all', counts = {}) {
  return `
    <div id="categoryFilterBar" class="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar select-none py-1">
      ${CATEGORIES.map(cat => {
        const isActive = cat.id === activeCategory;
        const count = counts[cat.id] !== undefined ? counts[cat.id] : 0;
        const activeClasses = 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md border-zinc-900 dark:border-white ring-1 ring-black/10 dark:ring-white/20';
        const inactiveClasses = 'bg-white dark:bg-[#16161a] text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white border border-zinc-200/90 dark:border-white/[0.12] hover:border-zinc-300 dark:hover:border-white/25 font-medium shadow-2xs';

        return `
          <button 
            type="button"
            data-category="${cat.id}"
            class="filter-pill flex items-center px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm border transition-all whitespace-nowrap active:scale-95 ${isActive ? activeClasses : inactiveClasses}">
            <span class="w-2 h-2 rounded-full mr-2 shrink-0 ${isActive ? 'bg-white dark:bg-zinc-900' : ''}" style="${isActive ? '' : `background-color: ${cat.color};`}"></span>
            <span>${cat.label}</span>
            <span class="filter-count-badge ml-1.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${isActive ? 'bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800' : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-400'}">${count}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

export function attachCategoryFilterListeners(onSelect) {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = btn.getAttribute('data-category');
      onSelect(cat, btn);
    });
  });
}
