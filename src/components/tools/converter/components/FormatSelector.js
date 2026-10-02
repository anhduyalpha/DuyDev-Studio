/**
 * FormatSelector Component
 * Adaptive Dynamic Selector showing compatible target formats based on queue state.
 * Strictly adheres to UI minimalism (Rule 3) - no marketing copy or parenthetical annotations.
 */

import {
  SUPPORTED_CATEGORIES,
  CATEGORY_FORMATS,
  getCompatibleOutputs
} from '../utilities/converterFormatRegistry.js';
import { formatBytes } from '../../../../utilities/formatters.js';

export const CATEGORIES = SUPPORTED_CATEGORIES;
export const FORMAT_CATALOG = CATEGORY_FORMATS;

/**
 * Partitions items by their source extension.
 * @param {Array} items
 * @returns {Map<string, {ext: string, category: string, categoryLabel: string, items: Array}>}
 */
export function getItemGroupMap(items) {
  const groups = new Map();
  (items || []).forEach((it) => {
    const ext = (it.detectedMeta?.extension || 'BIN').toLowerCase();
    if (!groups.has(ext)) {
      groups.set(ext, {
        ext,
        category: it.detectedMeta?.category || 'document',
        categoryLabel: it.detectedMeta?.categoryLabel || 'Tài liệu',
        items: []
      });
    }
    groups.get(ext).items.push(it);
  });
  return groups;
}

function renderGroupPills(formats, currentTarget, groupExt) {
  return formats.map((fmt) => {
    const isSelected = (currentTarget || '').toLowerCase() === fmt.id.toLowerCase();
    const isRecommended = Boolean(fmt.isRecommended);

    let pillClass = 'border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] bg-zinc-50/50 dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium';
    if (isSelected) {
      pillClass = 'ring-2 ring-indigo-500 bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm shadow-indigo-600/30';
    } else if (isRecommended) {
      pillClass = 'border border-indigo-500/30 dark:border-indigo-400/30 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500/60 font-semibold';
    }

    return `
      <button type="button" data-group-ext="${groupExt}" data-format="${fmt.id}" data-recommended="${isRecommended}" class="btn-group-format-pill py-2 px-2.5 rounded-xl transition text-center flex items-center justify-center relative cursor-pointer active:scale-95 ${pillClass}">
        <span class="font-mono text-xs flex items-center gap-1">
          ${fmt.name}${isRecommended ? `<span class="${isSelected ? 'text-amber-300' : 'text-amber-500'} text-xs">★</span>` : ''}
        </span>
      </button>
    `;
  }).join('');
}

function renderGroupBox(group) {
  const extUpper = group.ext.toUpperCase();
  const currentTarget = (group.items[0]?.targetFormat || '').toLowerCase();
  const compatibleOutputs = getCompatibleOutputs(group.ext);

  const isVideo = group.category === 'video';
  const videoTargets = isVideo ? compatibleOutputs.filter((f) => f.category !== 'audio') : compatibleOutputs;
  const audioTargets = isVideo ? compatibleOutputs.filter((f) => f.category === 'audio') : [];

  return `
    <div class="converter-group-box p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] shadow-sm space-y-3.5" data-group-ext="${group.ext}">
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
            ${extUpper}
          </span>
          <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            ${(group.categoryLabel || '').toUpperCase()}
          </span>
          <span class="px-2 py-0.5 rounded-full text-xs font-mono bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400">
            ${group.items.length} tệp
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-zinc-100 dark:bg-white/[0.06] text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/[0.08]">
            ĐÍCH: ${currentTarget ? currentTarget.toUpperCase() : '--'}
          </span>
        </div>
      </div>

      <!-- Collapsible File List Dropdown -->
      <details class="group/files rounded-xl bg-zinc-50/70 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.06] overflow-hidden text-xs">
        <summary class="px-3 py-1.5 flex items-center justify-between cursor-pointer select-none text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="folder" class="w-3.5 h-3.5 text-indigo-500 shrink-0"></i>
            <span class="font-medium truncate">Danh sách ${group.items.length} tệp ${extUpper}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              ${formatBytes(group.items.reduce((sum, it) => sum + (it.detectedMeta?.size || 0), 0))}
            </span>
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform duration-200 group-open/files:rotate-180 text-zinc-400"></i>
          </div>
        </summary>
        <div class="px-3 py-2 border-t border-zinc-200/60 dark:border-white/[0.04] space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
          ${group.items.map((it) => `
            <div class="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-white/60 dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
              <span class="truncate flex-1" title="${it.detectedMeta?.name || ''}">${it.detectedMeta?.name || 'Tệp'}</span>
              <span class="text-zinc-400 dark:text-zinc-500 text-[10px] shrink-0">${formatBytes(it.detectedMeta?.size || 0)}</span>
            </div>
          `).join('')}
        </div>
      </details>

      <!-- Format Pills Grid -->
      <div class="group-format-grid ${isVideo ? 'space-y-3' : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2'}">
        ${isVideo ? `
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            ${renderGroupPills(videoTargets, currentTarget, group.ext)}
          </div>
          ${audioTargets.length > 0 ? `
            <div class="relative flex py-1 items-center">
              <div class="flex-grow border-t border-zinc-200 dark:border-white/[0.08]"></div>
              <span class="flex-shrink mx-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">Trích xuất âm thanh</span>
              <div class="flex-grow border-t border-zinc-200 dark:border-white/[0.08]"></div>
            </div>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              ${renderGroupPills(audioTargets, currentTarget, group.ext)}
            </div>
          ` : ''}
        ` : renderGroupPills(compatibleOutputs, currentTarget, group.ext)}
      </div>
    </div>
  `.trim();
}

function renderBrowsePills(formats, currentFormat, categoryId) {
  return formats.map((fmt) => {
    const isActive = (currentFormat || '').toLowerCase() === fmt.id.toLowerCase();
    const isRecommended = Boolean(fmt.isRecommended);

    let pillClass = 'border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2] bg-zinc-50/50 dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium';
    if (isActive) {
      pillClass = 'ring-2 ring-indigo-500 bg-indigo-600 text-white font-bold border-indigo-600 shadow-sm shadow-indigo-600/30';
    } else if (isRecommended) {
      pillClass = 'border border-indigo-500/30 dark:border-indigo-400/30 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500/60 font-semibold';
    }

    return `
      <button type="button" data-format="${fmt.id}" data-category="${categoryId}" data-recommended="${isRecommended}" class="btn-format-pill py-3 px-4 rounded-xl transition text-center flex items-center justify-center relative group active:scale-95 cursor-pointer ${pillClass}">
        <span class="font-mono text-sm flex items-center gap-1.5">
          ${fmt.name}${isRecommended ? `<span class="${isActive ? 'text-amber-300' : 'text-amber-500'} text-xs">★</span>` : ''}
        </span>
      </button>
    `;
  }).join('');
}

export function renderFormatSelector(state) {
  const items = state.items || [];
  const currentFormat = state.targetFormat || 'webp';

  // 1. When Queue has items: Grouped Format Boxes
  if (items.length > 0) {
    const groups = getItemGroupMap(items);
    return `
      <div class="space-y-4">
        ${Array.from(groups.values()).map((group) => renderGroupBox(group)).join('')}
      </div>
    `.trim();
  }

  // 2. When Queue is empty: Full 6-Category Browse Mode
  const activeCategory = state.selectedCategory || 'image';

  return `
    <div class="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.07] shadow-sm space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <h4 class="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Định dạng đích</h4>
        </div>
      </div>

      <!-- Category Filter Tabs (6 Standard Categories) -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        ${CATEGORIES.map((cat) => {
          const isCatActive = cat.id === activeCategory;
          return `
            <button type="button" data-category="${cat.id}" class="btn-converter-cat px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              isCatActive
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs active-cat'
                : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }">
              ${cat.label}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Pre-rendered Format Grids for Each Category -->
      ${CATEGORIES.map((cat) => {
        const isCatActive = cat.id === activeCategory;
        const formats = (CATEGORY_FORMATS[cat.id] || [])
          .filter((f) => f !== 'svg' && f !== 'avif')
          .map((f) => ({ id: f, name: f.toUpperCase(), isRecommended: false }));

        return `
          <div id="formatGrid_${cat.id}" class="format-category-grid grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${isCatActive ? '' : 'hidden'}">
            ${renderBrowsePills(formats, currentFormat, cat.id)}
          </div>
        `;
      }).join('')}
    </div>
  `.trim();
}
