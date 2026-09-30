/**
 * Reusable Atomic Tabs Component
 * Dark Professional Minimalism
 */

export function renderTabs({
  tabs = [],
  activeTab = '',
  dataTabAttr = 'data-tab',
  btnClass = 'btn-tab-item',
  containerClass = ''
}) {
  return `
    <div class="flex items-center gap-1.5 p-1.5 bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.06] rounded-2xl overflow-x-auto ${containerClass}">
      ${tabs
        .map((t) => {
          const isActive = activeTab === t.id;
          return `
            <button type="button" ${dataTabAttr}="${t.id}"
                    class="${btnClass} flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            isActive
              ? 'bg-white dark:bg-white/[0.1] text-zinc-900 dark:text-white shadow-xs border border-zinc-200/60 dark:border-white/10'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }">
              ${t.icon ? `<i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>` : ''}
              <span>${t.label}</span>
            </button>
          `;
        })
        .join('')}
    </div>
  `.trim();
}
