import { soundEngine } from '../../utilities/soundEngine.js';

export const CATEGORIES = [
  { id: 'all', label: 'Tất cả', color: '#A1A1AA' },
  { id: 'pdf', label: 'PDF', color: '#F59E0B' },
  { id: 'convert', label: 'Chuyển đổi', color: '#8B5CF6' },
  { id: 'archive', label: 'File nén', color: '#0EA5E9' },
  { id: 'qr', label: 'Mã QR', color: '#10B981' },
  { id: 'media', label: 'Media', color: '#E11D48' },
  { id: 'system', label: 'Tiện ích', color: '#6366F1' },
  { id: 'advanced', label: 'Nâng cao', color: '#EC4899' }
];

export function getAdjacentCategory(currentCatId, direction = 'next', categoriesList = CATEGORIES) {
  const list = Array.isArray(categoriesList) && categoriesList.length > 0 ? categoriesList : CATEGORIES;
  const idx = list.findIndex(c => c.id === currentCatId);
  if (idx === -1) return null;
  if (direction === 'next') {
    return idx < list.length - 1 ? list[idx + 1].id : null;
  } else if (direction === 'prev') {
    return idx > 0 ? list[idx - 1].id : null;
  }
  return null;
}

export function renderCategoryFilters(activeCategory = 'all', counts = {}, categoriesList = CATEGORIES) {
  const list = Array.isArray(categoriesList) && categoriesList.length > 0 ? categoriesList : CATEGORIES;
  return `
    <div class="inline-flex max-w-full p-1 bg-black/[0.03] dark:bg-white/[0.04] rounded-[16px] border border-black/[0.04] dark:border-white/[0.06] overflow-x-auto custom-scrollbar select-none">
      <div id="categoryFilterBar" role="tablist" aria-label="Bộ lọc phân loại công cụ" class="flex items-center gap-1 min-w-max">
        ${list.map(cat => {
          const isActive = cat.id === activeCategory;
          const count = counts[cat.id] !== undefined ? counts[cat.id] : 0;
          const activeClasses = 'bg-[#1D1D1F] text-white font-semibold shadow-xs border-[#1D1D1F] dark:bg-white/[0.14] dark:text-white dark:border-white/[0.16] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]';
          const inactiveClasses = 'bg-white/80 text-zinc-600 border-black/[0.04] hover:bg-white hover:text-black dark:bg-[#16161A] dark:text-[#86868B] dark:border-white/[0.08] dark:hover:text-[#F5F5F7] font-medium shadow-2xs';

          return `
            <button 
              type="button"
              data-category="${cat.id}"
              role="tab"
              aria-selected="${isActive}"
              aria-pressed="${isActive}"
              class="filter-pill flex items-center px-3.5 sm:px-4 py-1.5 min-h-[36px] sm:min-h-[34px] rounded-[12px] text-xs sm:text-sm border transition-transform duration-100 ease-out whitespace-nowrap active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 dark:focus-visible:ring-indigo-400 ${isActive ? activeClasses : inactiveClasses}">
              <span class="w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${isActive ? 'bg-white' : ''}" style="${isActive ? '' : `background-color: ${cat.color};`}"></span>
              <span>${cat.label}</span>
              <span class="filter-count-badge ml-1.5 px-1.5 py-0.5 rounded-[6px] text-[11px] font-mono font-medium tabular-nums ${isActive ? 'bg-white/20 text-white dark:bg-white/[0.18] dark:text-white' : 'bg-black/[0.05] text-zinc-600 dark:bg-white/[0.08] dark:text-[#86868B] border border-black/[0.04] dark:border-white/[0.06]'}">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function updateCategoryFilterPills(activeCategory = 'all', counts = {}, categoriesList = CATEGORIES) {
  const list = Array.isArray(categoriesList) && categoriesList.length > 0 ? categoriesList : CATEGORIES;
  const pills = Array.from(document.querySelectorAll('.filter-pill'));
  pills.forEach(btn => {
    const catId = btn.getAttribute('data-category');
    const isActive = catId === activeCategory;
    const count = counts[catId] !== undefined ? counts[catId] : 0;
    const cat = list.find(c => c.id === catId);

    const activeClasses = 'bg-[#1D1D1F] text-white font-semibold shadow-xs border-[#1D1D1F] dark:bg-white/[0.14] dark:text-white dark:border-white/[0.16] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]';
    const inactiveClasses = 'bg-white/80 text-zinc-600 border-black/[0.04] hover:bg-white hover:text-black dark:bg-[#16161A] dark:text-[#86868B] dark:border-white/[0.08] dark:hover:text-[#F5F5F7] font-medium shadow-2xs';

    btn.className = `filter-pill flex items-center px-3.5 sm:px-4 py-1.5 min-h-[36px] sm:min-h-[34px] rounded-[12px] text-xs sm:text-sm border transition-transform duration-100 ease-out whitespace-nowrap active:scale-[0.96] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 dark:focus-visible:ring-indigo-400 ${isActive ? activeClasses : inactiveClasses}`;
    btn.setAttribute('aria-selected', String(isActive));
    btn.setAttribute('aria-pressed', String(isActive));

    const dot = btn.querySelector('span:first-child');
    if (dot) {
      if (isActive) {
        dot.className = 'w-1.5 h-1.5 rounded-full mr-2 shrink-0 bg-white';
        dot.style.backgroundColor = '';
      } else {
        dot.className = 'w-1.5 h-1.5 rounded-full mr-2 shrink-0';
        dot.style.backgroundColor = cat?.color || '#A1A1AA';
      }
    }

    const badge = btn.querySelector('.filter-count-badge');
    if (badge) {
      badge.textContent = count;
      badge.className = `filter-count-badge ml-1.5 px-1.5 py-0.5 rounded-[6px] text-[11px] font-mono font-medium tabular-nums ${
        isActive
          ? 'bg-white/20 text-white dark:bg-white/[0.18] dark:text-white'
          : 'bg-black/[0.05] text-zinc-600 dark:bg-white/[0.08] dark:text-[#86868B] border border-black/[0.04] dark:border-white/[0.06]'
      }`;
    }
  });
}

export function attachCategoryFilterListeners(onSelect) {
  const pills = Array.from(document.querySelectorAll('.filter-pill'));
  pills.forEach((btn, idx) => {
    if (btn.__hasCategoryListener) return;
    btn.__hasCategoryListener = true;

    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;

    btn.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isDragging = false;
      }
    }, { passive: true });

    btn.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && !isDragging) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 8 || dy > 8) {
          isDragging = true;
        }
      }
    }, { passive: true });

    btn.addEventListener('touchend', () => {
      if (isDragging) {
        btn.__suppressClick = true;
        setTimeout(() => {
          btn.__suppressClick = false;
          isDragging = false;
        }, 120);
      }
    }, { passive: true });

    btn.addEventListener('touchcancel', () => {
      isDragging = false;
    }, { passive: true });

    btn.addEventListener('click', (e) => {
      if (btn.__suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      soundEngine.playToggle();
      const cat = btn.getAttribute('data-category');
      onSelect(cat, btn);
    });

    btn.addEventListener('keydown', (e) => {
      let targetBtn = null;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        targetBtn = pills[(idx + 1) % pills.length];
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        targetBtn = pills[(idx - 1 + pills.length) % pills.length];
      }
      if (targetBtn) {
        targetBtn.focus();
        targetBtn.click();
      }
    });
  });
}
