/**
 * Tool Card Component (Dark Professional Minimalism with Soft Color Accents)
 */

import { renderBadge } from '../common/Badge.js';

const CATEGORY_LABELS = {
  all: 'Tất cả',
  pdf: 'PDF',
  convert: 'Chuyển đổi',
  archive: 'File nén',
  qr: 'Mã QR',
  system: 'Tiện ích'
};

export function renderToolCard(tool) {
  const accent = tool.color || '#6366F1';
  const categoryLabel = CATEGORY_LABELS[tool.category] || tool.category;
  const contrastMap = {
    '#F59E0B': '#B45309', // Amber-700
    '#0EA5E9': '#0369A1', // Sky-700
    '#8B5CF6': '#6D28D9', // Purple-700
    '#10B981': '#047857', // Emerald-700
    '#64748B': '#334155', // Slate-700
    '#A1A1AA': '#3F3F46'  // Zinc-700
  };
  const contrastColor = contrastMap[accent] || accent;

  return `
    <div onclick="window.location.hash = '${tool.route}'"
         class="tool-card group relative p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-[#131317] border border-zinc-200/90 dark:border-white/[0.12] hover:border-zinc-300 dark:hover:border-white/25 hover:bg-zinc-50 dark:hover:bg-[#18181f] transition-all duration-200 cursor-pointer flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3.5 sm:gap-0 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] select-none"
         data-tool-id="${tool.id}"
         style="--accent: ${accent}; --accent-contrast: ${contrastColor};">
      
      <!-- Icon & Badge Container -->
      <div class="flex items-center sm:items-start justify-between sm:mb-3.5 shrink-0">
        <div class="w-12 h-12 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition duration-200 group-hover:scale-105 shadow-xs tool-accent-box shrink-0">
          <i data-lucide="${tool.icon}" class="w-5 h-5"></i>
        </div>

        <div class="hidden sm:block">
          ${tool.badge ? renderBadge(tool.badge, accent) : ''}
        </div>
      </div>

      <!-- Text Content -->
      <div class="flex-1 min-w-0 sm:flex-none">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-zinc-900 dark:text-white text-sm sm:text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition tracking-tight truncate">
            ${tool.title}
          </h3>
          <div class="sm:hidden">
            ${tool.badge ? renderBadge(tool.badge, accent) : ''}
          </div>
        </div>

        <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 sm:mt-1.5 leading-normal line-clamp-1 sm:line-clamp-2">
          ${tool.description}
        </p>

        <span class="sm:hidden font-mono text-[11px] uppercase tracking-wider font-semibold tool-accent-text mt-1 block">
          ${categoryLabel}
        </span>
      </div>

      <!-- Action Indicator / Footer -->
      <div class="shrink-0 sm:mt-4 sm:pt-3.5 sm:border-t sm:border-zinc-100 sm:dark:border-white/[0.05] sm:flex sm:items-center sm:justify-between text-xs">
        <span class="hidden sm:inline font-mono text-xs uppercase tracking-wider font-semibold tool-accent-text">
          ${categoryLabel}
        </span>
        <div class="w-8 h-8 sm:w-auto sm:h-auto rounded-full sm:rounded-none bg-zinc-100 sm:bg-transparent dark:bg-white/[0.06] sm:dark:bg-transparent flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition">
          <span class="hidden sm:inline text-sm font-semibold mr-1">Mở</span>
          <i data-lucide="arrow-right" class="w-4 h-4 hidden sm:inline"></i>
          <i data-lucide="chevron-right" class="w-4 h-4 sm:hidden"></i>
        </div>
      </div>

    </div>
  `;
}
