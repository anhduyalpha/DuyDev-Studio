/**
 * Tool Card Component (Dark Professional Minimalism with Soft Color Accents)
 */


import { renderToolIcon } from '../common/ToolIcons.js';

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
    <a href="${tool.route}"
       class="tool-card linear-card group relative overflow-hidden p-4 sm:p-5 rounded-2xl cursor-pointer flex flex-col justify-between select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 dark:focus-visible:ring-indigo-400 no-underline"
       data-tool-id="${tool.id}"
       aria-label="${tool.title} - ${tool.description}"
       style="--accent: ${accent}; --accent-contrast: ${contrastColor};">
      
      <!-- Top Precision Accent Beam: Refined, delicate edge accent -->
      <div class="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-25 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none"></div>
      
      <!-- Ambient Tool Identity Bloom: Soft, balanced chromatic aura -->
      <div class="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[var(--accent)] opacity-[0.04] dark:opacity-[0.07] blur-2xl group-hover:opacity-[0.10] dark:group-hover:opacity-[0.12] transition-opacity duration-500 pointer-events-none"></div>

      <!-- Subtle Ambient Top-Down Surface Tint -->
      <div class="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/[0.02] via-transparent to-transparent opacity-50 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none rounded-2xl"></div>

      <div class="relative z-10">
        <!-- Header: Icon -->
        <div class="flex items-center mb-3.5 min-h-[44px]">
          <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-xs tool-accent-box shrink-0">
            ${renderToolIcon(tool.id, tool.icon, 'w-6 h-6 sm:w-6.5 sm:h-6.5')}
          </div>
        </div>

        <!-- Title & Description -->
        <h3 class="font-bold text-zinc-900 dark:text-white text-base sm:text-lg group-hover:text-[var(--accent)] transition tracking-tight">
          ${tool.title}
        </h3>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2 min-h-[2.25rem]">
          ${tool.description}
        </p>

        <!-- Spec Badges with Primary Engine Hierarchy -->
        <div class="flex flex-wrap gap-1.5 mt-3 min-h-[22px]">
          ${tool.specs && tool.specs.length > 0 ? tool.specs.map((spec, idx) => `
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium ${
              idx === 0 
                ? 'bg-zinc-100/90 dark:bg-white/[0.08] backdrop-blur-md text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-white/[0.12] font-semibold shadow-2xs' 
                : 'bg-zinc-50/80 dark:bg-white/[0.04] backdrop-blur-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/[0.06]'
            }">
              ${spec}
            </span>
          `).join('') : ''}
        </div>
      </div>

      <!-- Footer / CTA -->
      <div class="relative z-10 mt-4 pt-3.5 border-t border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-between text-xs">
        <span class="font-mono text-xs uppercase tracking-wider font-semibold tool-accent-text">
          ${categoryLabel}
        </span>
        <div class="flex items-center gap-1 text-xs font-semibold text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-white transition">
          <span>Mở</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1"></i>
        </div>
      </div>

    </a>
  `.trim();
}

