/**
 * Tool Card Component (Dark Professional Minimalism with Soft Color Accents)
 */


import { renderToolIcon } from '../common/ToolIcons.js';
import { getCardTierConfig } from '../../hooks/useToolRegistry.js';
import { renderTierStructuralLayers, renderTierIconHalo } from './TierFrameAssets.js';

const CATEGORY_LABELS = {
  all: 'Tất cả',
  pdf: 'PDF',
  convert: 'Chuyển đổi',
  archive: 'File nén',
  qr: 'Mã QR',
  system: 'Tiện ích',
  advanced: 'Nâng cao'
};

export function renderToolCard(tool) {
  const accent = tool.color || '#6366F1';
  const categoryLabel = CATEGORY_LABELS[tool.category] || tool.category;
  const contrastMap = {
    '#F59E0B': '#B45309', // Amber-700
    '#EA580C': '#C2410C', // Orange-700 (Scribd Terracotta)
    '#0EA5E9': '#0369A1', // Sky-700
    '#8B5CF6': '#6D28D9', // Purple-700
    '#10B981': '#047857', // Emerald-700
    '#64748B': '#334155', // Slate-700
    '#EC4899': '#BE185D', // Pink-700
    '#A1A1AA': '#3F3F46'  // Zinc-700
  };
  const contrastColor = contrastMap[accent] || accent;

  const tierConfig = tool.tier ? getCardTierConfig(tool.tier) : null;
  const tierCardClass = tierConfig ? ` tier-card ${tierConfig.className}` : '';
  const tierBadgeHtml = tierConfig ? `
    <div class="tier-crest-badge shadow-xs shrink-0" title="${tierConfig.name} - ${tierConfig.titleVi}">
      <span class="tier-badge-indicator"></span>
      <span class="tier-badge-label">${tierConfig.badgeText}</span>
    </div>
  `.trim() : '';

  const tierOrnamentsHtml = tierConfig ? renderTierStructuralLayers(tierConfig.code) : '';
  const tierIconHaloHtml = tierConfig ? renderTierIconHalo(tierConfig.code) : '';

  return `
    <a href="${tool.route}"
       class="tool-card linear-card${tierCardClass} group relative overflow-hidden p-4 sm:p-5 !rounded-[20px] touch-manipulation active:scale-[0.985] transition-transform duration-150 ease-out cursor-pointer flex flex-col justify-between select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 dark:focus-visible:ring-indigo-400 no-underline"
       data-tool-id="${tool.id}"
       aria-label="${tool.title} - ${tool.description}"
       style="--accent: ${accent}; --accent-contrast: ${contrastColor};">
      
      ${tierOrnamentsHtml}

      <!-- Giant Tool-Specific Icon Silhouette Watermark -->
      <div class="tier-tool-watermark pointer-events-none" aria-hidden="true">
        ${renderToolIcon(tool.id, tool.icon, 'w-24 h-24 sm:w-28 sm:h-28')}
      </div>

      <!-- Top Precision Accent Beam: Refined, delicate edge accent -->
      <div class="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-25 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none"></div>
      
      <!-- Ambient Tool Identity Bloom: Soft, balanced chromatic aura (Zero Gaussian Blur Thrash) -->
      <div class="absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-[0.08] dark:opacity-[0.14] group-hover:opacity-[0.18] dark:group-hover:opacity-[0.22] transition-opacity duration-500 pointer-events-none" style="background: radial-gradient(circle, var(--accent) 0%, transparent 70%);"></div>

      <!-- Subtle Ambient Top-Down Surface Tint -->
      <div class="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/[0.02] via-transparent to-transparent opacity-50 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none rounded-[20px]"></div>

      <div class="relative z-10">
        <!-- Header: Icon & Tier Badge (Concentric Icon Anchor) -->
        <div class="flex items-center justify-between mb-3.5 min-h-[44px]">
          <div class="relative inline-flex items-center justify-center shrink-0">
            ${tierIconHaloHtml}
            <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-xs tool-accent-box shrink-0">
              ${renderToolIcon(tool.id, tool.icon, 'w-6 h-6 sm:w-6.5 sm:h-6.5')}
            </div>
          </div>
          ${tierBadgeHtml}
        </div>

        <!-- Title & Description -->
        <h3 class="font-semibold text-zinc-900 dark:text-[#F5F5F7] text-base sm:text-lg group-hover:text-[var(--accent)] transition tracking-[-0.025em] truncate" title="${tool.title}">
          ${tool.title}
        </h3>
        <p class="text-[13px] text-zinc-500 dark:text-[#86868B] mt-1 leading-[1.45] line-clamp-2 min-h-[2.25rem]">
          ${tool.description}
        </p>

        <!-- Spec Badges with Primary Engine Hierarchy -->
        <div class="flex flex-wrap gap-1.5 mt-3 min-h-[22px]">
          ${tool.specs && tool.specs.length > 0 ? tool.specs.map((spec, idx) => `
            <span class="px-2 py-0.5 rounded-[8px] text-[10px] font-mono font-medium tracking-tight tabular-nums ${
              idx === 0 
                ? 'bg-zinc-100/90 dark:bg-white/[0.08] text-zinc-800 dark:text-[#F5F5F7] border border-zinc-300/80 dark:border-white/[0.12] font-semibold shadow-2xs' 
                : 'bg-zinc-50/80 dark:bg-white/[0.04] text-zinc-600 dark:text-[#86868B] border border-zinc-200/60 dark:border-white/[0.06]'
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
        <div class="tier-cta-btn flex items-center gap-1 text-xs font-semibold text-zinc-600 group-hover:text-zinc-900 dark:text-[#86868B] dark:group-hover:text-[#F5F5F7] transition">
          <span>Mở</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1"></i>
        </div>
      </div>

    </a>
  `.trim();
}

