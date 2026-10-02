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

export function renderToolCard(tool, isSpotlight = false) {
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

  if (isSpotlight || tool.featured) {
    return `
      <div onclick="window.location.hash = '${tool.route}'"
           class="tool-card group relative p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#131317] border border-zinc-200/90 dark:border-white/[0.12] hover:border-zinc-300 dark:hover:border-white/30 hover:bg-zinc-50/80 dark:hover:bg-[#18181f] transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] select-none"
           data-tool-id="${tool.id}"
           style="--accent: ${accent}; --accent-contrast: ${contrastColor};">
        
        <div>
          <!-- Header: Icon & Badge -->
          <div class="flex items-center justify-between mb-3.5">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center transition duration-200 group-hover:scale-105 shadow-xs tool-accent-box shrink-0">
              <i data-lucide="${tool.icon}" class="w-6 h-6"></i>
            </div>
            ${tool.badge ? renderBadge(tool.badge, accent) : ''}
          </div>

          <!-- Title & Description -->
          <h3 class="font-bold text-zinc-900 dark:text-white text-base sm:text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition tracking-tight">
            ${tool.title}
          </h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2">
            ${tool.description}
          </p>

          <!-- Spec Badges -->
          ${tool.specs && tool.specs.length > 0 ? `
            <div class="flex flex-wrap gap-1.5 mt-3">
              ${tool.specs.map(spec => `
                <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200/70 dark:border-white/[0.06]">
                  ${spec}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Footer / CTA -->
        <div class="mt-4 pt-3.5 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
          <span class="font-mono text-xs uppercase tracking-wider font-semibold tool-accent-text">
            ${categoryLabel}
          </span>
          <div class="flex items-center gap-1 text-xs font-semibold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-white transition">
            <span>Mở ngay</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"></i>
          </div>
        </div>

      </div>
    `.trim();
  }

  // Standard Compact Tool Card
  return `
    <div onclick="window.location.hash = '${tool.route}'"
         class="tool-card group relative p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#131317] border border-zinc-200/80 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-[#18181f] transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:shadow-sm active:scale-[0.99] select-none"
         data-tool-id="${tool.id}"
         style="--accent: ${accent}; --accent-contrast: ${contrastColor};">
      
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center transition duration-150 group-hover:scale-105 shadow-xs tool-accent-box shrink-0">
          <i data-lucide="${tool.icon}" class="w-4 h-4"></i>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition tracking-tight truncate">
              ${tool.title}
            </h4>
            ${tool.badge ? renderBadge(tool.badge, accent) : ''}
          </div>
          <p class="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
            ${tool.description}
          </p>
        </div>
      </div>

      <div class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition shrink-0">
        <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
      </div>

    </div>
  `.trim();
}
