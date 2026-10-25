/**
 * AdminToolCardManager - Tool Card & Tab Category Layout Editor
 * Allows administrators to create/edit tabs, pick indicator colors, reorder tools,
 * and reassign categories with real-time preview and server persistence.
 */

import { toolRegistry, DEFAULT_TOOL_CATEGORIES } from '../../hooks/useToolRegistry.js';
import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';
import { soundEngine } from '../../utilities/soundEngine.js';

export const SYSTEM_CATEGORY_IDS = new Set(['pdf', 'convert', 'archive', 'qr', 'media', 'system', 'advanced']);

export const PRESET_TAB_COLORS = [
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#F97316'  // Orange
];

// In-memory working draft state
let draftTools = [];
let originalToolsSnapshot = [];
let draftCategories = [];
let originalCategoriesSnapshot = [];
let activeCategoryFilter = 'all';
let searchQuery = '';
let isSaving = false;
let showAddTabModal = false;
let newTabForm = { label: '', id: '', color: '#8B5CF6' };

function toSlug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Syncs working draft state from toolRegistry.tools and toolRegistry.categories
 */
export function initDraftTools() {
  draftTools = toolRegistry.tools.map((t, idx) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    icon: t.icon,
    color: t.color,
    route: t.route,
    tier: t.tier || null,
    order: idx + 1
  }));
  originalToolsSnapshot = JSON.parse(JSON.stringify(draftTools));

  draftCategories = toolRegistry.getRawCategories().map(c => ({
    id: c.id,
    label: c.label,
    color: c.color
  }));
  originalCategoriesSnapshot = JSON.parse(JSON.stringify(draftCategories));
}

/**
 * Checks if draft has unsaved changes compared to snapshot
 */
function hasUnsavedChanges() {
  if (draftTools.length !== originalToolsSnapshot.length) return true;
  for (let i = 0; i < draftTools.length; i++) {
    const d = draftTools[i];
    const o = originalToolsSnapshot[i];
    if (!o || d.id !== o.id || d.category !== o.category || d.order !== o.order) {
      return true;
    }
  }

  if (draftCategories.length !== originalCategoriesSnapshot.length) return true;
  for (let i = 0; i < draftCategories.length; i++) {
    const d = draftCategories[i];
    const o = originalCategoriesSnapshot[i];
    if (!o || d.id !== o.id || d.label !== o.label || d.color !== o.color) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the currently visible draft tools filtered by active category and search
 */
export function getFilteredDraftTools() {
  return draftTools.filter(tool => {
    const matchCat = activeCategoryFilter === 'all' || tool.category === activeCategoryFilter;
    if (!matchCat) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (tool.title || '').toLowerCase().includes(q) || (tool.id || '').toLowerCase().includes(q);
  });
}

/**
 * Renders the Tool Card & Tab Manager HTML
 */
export function renderAdminToolCardManager() {
  if (draftTools.length === 0 || draftCategories.length === 0) {
    initDraftTools();
  }

  const isDirty = hasUnsavedChanges();

  // Calculate counts per category
  const counts = { all: draftTools.length };
  draftCategories.forEach(c => {
    counts[c.id] = draftTools.filter(t => t.category === c.id).length;
  });

  // Filter tools based on activeCategoryFilter and searchQuery
  const filteredTools = getFilteredDraftTools();

  return `
    <div class="space-y-6">
      <!-- 1. Header & Global Actions Bar -->
      <div class="p-5 rounded-3xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/5 backdrop-blur-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-start sm:items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-pink-500/15 to-amber-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-xs">
            <i data-lucide="layout-grid" class="w-6 h-6 text-indigo-500 dark:text-indigo-400"></i>
          </div>
          <div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Quản Lý Thẻ & Danh Mục Tab
              </h2>
              ${isDirty ? `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Có thay đổi chưa lưu
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <i data-lucide="check" class="w-3 h-3"></i>
                  Đã đồng bộ
                </span>
              `}
            </div>
            <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Tạo mới tab, chọn màu chấm tròn đại diện, gán thẻ công cụ vào tab và sắp xếp thứ tự hiển thị.
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
          <button
            type="button"
            id="btnResetToolLayout"
            class="px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 min-h-[44px]"
            title="Khôi phục toàn bộ vị trí, tab và danh mục mặc định"
          >
            <i data-lucide="rotate-ccw" class="w-4 h-4 text-zinc-500"></i>
            <span>Mặc định</span>
          </button>

          <button
            type="button"
            id="btnSaveToolLayout"
            ${isSaving ? 'disabled' : ''}
            class="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 min-h-[44px]"
          >
            <i data-lucide="${isSaving ? 'loader-2' : 'save'}" class="w-4 h-4 ${isSaving ? 'animate-spin' : ''}"></i>
            <span>${isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
          </button>
        </div>
      </div>

      <!-- 2. Tab Management & Color Dot Customizer -->
      <div class="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-md shadow-xs space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <i data-lucide="palette" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Danh Sách Tab & Màu Chấm Tròn Đại Diện
              </h3>
              <p class="text-[11px] text-zinc-500">Click vào chấm màu để đổi màu hoặc sửa tên tab trực tiếp</p>
            </div>
          </div>

          <button
            type="button"
            id="btnOpenAddTab"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 min-h-[38px]"
          >
            <i data-lucide="${showAddTabModal ? 'chevron-up' : 'plus'}" class="w-3.5 h-3.5"></i>
            <span>${showAddTabModal ? 'Đóng form tạo' : 'Tạo mới Tab'}</span>
          </button>
        </div>

        <!-- Add New Tab Form Panel -->
        ${showAddTabModal ? `
          <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-indigo-500/30 space-y-3.5 animate-fadeIn">
            <div class="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-white/5">
              <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                Thêm Tab Mới
              </span>
              <span class="text-[11px] text-zinc-400 font-mono">Slug: #${newTabForm.id || 'tự sinh'}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <!-- Label Input -->
              <div>
                <label for="inputNewTabLabel" class="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Tên Tab hiển thị *
                </label>
                <input
                  type="text"
                  id="inputNewTabLabel"
                  value="${newTabForm.label}"
                  placeholder="Ví dụ: Media Hub, AI Tools..."
                  class="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[38px]"
                />
              </div>

              <!-- Slug ID Input -->
              <div>
                <label for="inputNewTabId" class="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Mã Tab (ID/Slug) *
                </label>
                <input
                  type="text"
                  id="inputNewTabId"
                  value="${newTabForm.id}"
                  placeholder="ví dụ: media-hub"
                  class="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[38px]"
                />
              </div>

              <!-- Color Picker & Live Preview -->
              <div>
                <label class="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Màu chấm tròn đại diện
                </label>
                <div class="flex items-center gap-2">
                  <div class="relative w-9 h-9 rounded-xl border border-black/10 dark:border-white/10 shrink-0 overflow-hidden cursor-pointer shadow-xs" style="background-color: ${newTabForm.color};">
                    <input
                      type="color"
                      id="inputNewTabColor"
                      value="${newTabForm.color}"
                      class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      title="Chọn màu bất kỳ"
                    />
                  </div>

                  <!-- Live Preview Pill -->
                  <div class="flex-1 flex items-center px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 min-h-[38px]">
                    <span class="w-2 h-2 rounded-full mr-2 shrink-0 transition-colors" style="background-color: ${newTabForm.color};"></span>
                    <span class="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      ${newTabForm.label || 'Xem trước Tab'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Color Palette Presets -->
            <div class="flex items-center gap-1.5 pt-1 flex-wrap">
              <span class="text-[11px] text-zinc-400 mr-1">Bảng màu gợi ý:</span>
              ${PRESET_TAB_COLORS.map(c => `
                <button
                  type="button"
                  data-preset-color="${c}"
                  class="btn-preset-color w-6 h-6 rounded-lg border transition-transform hover:scale-110 active:scale-95 cursor-pointer ${newTabForm.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-900' : 'border-black/10 dark:border-white/10'}"
                  style="background-color: ${c};"
                  title="Chọn màu ${c}"
                ></button>
              `).join('')}
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-white/5">
              <button
                type="button"
                id="btnCancelAddTab"
                class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                id="btnSubmitNewTab"
                class="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Thêm Tab Này</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Tabs Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          ${draftCategories.map(cat => {
            const isSystem = SYSTEM_CATEGORY_IDS.has(cat.id);
            const count = counts[cat.id] || 0;

            return `
              <div
                class="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 transition-all flex items-center justify-between gap-2.5"
                data-category-card="${cat.id}"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <!-- Color Dot with Hidden Native Picker -->
                  <div class="relative w-5 h-5 rounded-full shrink-0 border border-black/10 dark:border-white/20 cursor-pointer shadow-xs group" style="background-color: ${cat.color};" title="Click để đổi màu chấm tròn">
                    <input
                      type="color"
                      data-cat-id="${cat.id}"
                      value="${cat.color}"
                      class="input-tab-color-edit absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>

                  <!-- Editable Tab Label -->
                  <div class="min-w-0 flex-1">
                    <input
                      type="text"
                      data-cat-id="${cat.id}"
                      value="${cat.label}"
                      title="Sửa tên tab"
                      class="input-tab-label-edit w-full bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-indigo-500 text-xs font-bold text-zinc-900 dark:text-zinc-100 px-1 py-0.5 rounded focus:outline-none transition-colors"
                    />
                    <div class="flex items-center gap-1.5 px-1">
                      <span class="text-[10px] font-mono text-zinc-400">#${cat.id}</span>
                      <span class="text-[10px] text-zinc-400">•</span>
                      <span class="text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">${count} thẻ</span>
                    </div>
                  </div>
                </div>

                <!-- Delete Custom Tab Button (System categories cannot be deleted) -->
                ${!isSystem ? `
                  <button
                    type="button"
                    data-action="delete-tab"
                    data-cat-id="${cat.id}"
                    data-cat-label="${cat.label}"
                    class="btn-delete-tab w-7 h-7 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
                    title="Xóa tab này (các thẻ bên trong sẽ tự chuyển về Tiện ích)"
                  >
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                  </button>
                ` : `
                  <span class="text-[10px] font-mono text-zinc-400 shrink-0 px-1.5 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-700/50" title="Tab mặc định hệ thống">
                    Gốc
                  </span>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. Search & Category Filters Bar -->
      <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 backdrop-blur-md shadow-xs space-y-3">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <!-- Filter Pills -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar select-none">
            <button
              type="button"
              data-tab-filter="all"
              class="btn-tool-tab-filter px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 min-h-[38px] ${activeCategoryFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs' : 'glass-pill text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'}"
            >
              <span>Tất cả</span>
              <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${activeCategoryFilter === 'all' ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900' : 'bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'}">${counts.all}</span>
            </button>

            ${draftCategories.map(cat => {
              const isActive = activeCategoryFilter === cat.id;
              const count = counts[cat.id] || 0;
              return `
                <button
                  type="button"
                  data-tab-filter="${cat.id}"
                  class="btn-tool-tab-filter px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 min-h-[38px] ${isActive ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs' : 'glass-pill text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'}"
                >
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${cat.color};"></span>
                  <span>${cat.label}</span>
                  <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${isActive ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900' : 'bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'}">${count}</span>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Quick Search Box -->
          <div class="relative w-full sm:w-64 shrink-0">
            <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"></i>
            <input
              type="text"
              id="inputSearchToolLayout"
              value="${searchQuery}"
              placeholder="Tìm thẻ công cụ..."
              class="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[38px]"
            />
            ${searchQuery ? `
              <button
                type="button"
                id="btnClearSearchToolLayout"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- 4. Tools Cards List -->
      <div class="space-y-2.5" id="toolLayoutCardsList">
        ${filteredTools.length === 0 ? `
          <div class="p-12 text-center rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-3">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <i data-lucide="search-x" class="w-6 h-6"></i>
            </div>
            <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Không tìm thấy thẻ công cụ nào phù hợp</p>
            <p class="text-xs text-zinc-500">Thử đổi danh mục lọc hoặc xóa từ khóa tìm kiếm</p>
          </div>
        ` : filteredTools.map((tool, index) => {
          const globalIndex = draftTools.findIndex(t => t.id === tool.id);
          const isFirst = index === 0;
          const isLast = index === filteredTools.length - 1;
          const currentCat = draftCategories.find(c => c.id === tool.category) || { label: tool.category, color: '#6366F1' };

          return `
            <div
              class="tool-layout-item p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-white/5 backdrop-blur-md shadow-xs hover:border-zinc-300 dark:hover:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              data-tool-id="${tool.id}"
            >
              <!-- Left: Order & Tool Info -->
              <div class="flex items-center gap-3 min-w-0">
                <!-- Order Index Pill -->
                <div class="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 flex items-center justify-center font-mono font-bold text-xs shrink-0" title="Thứ tự hiển thị: ${globalIndex + 1}">
                  #${globalIndex + 1}
                </div>

                <!-- Tool Icon with signature color -->
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/5 dark:border-white/10" style="background-color: ${tool.color}15; color: ${tool.color};">
                  <i data-lucide="${tool.icon || 'square'}" class="w-5 h-5"></i>
                </div>

                <!-- Title & Meta -->
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">${tool.title}</span>
                    <span class="px-2 py-0.5 rounded-md font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-white/5">
                      ${tool.id}
                    </span>
                    ${tool.tier ? `
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                        ${tool.tier}
                      </span>
                    ` : ''}
                  </div>
                  <p class="text-xs text-zinc-500 truncate max-w-sm sm:max-w-md mt-0.5">${tool.description || ''}</p>
                </div>
              </div>

              <!-- Right: Category Dropdown & Reorder Controls -->
              <div class="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                <!-- Category Select Dropdown -->
                <div class="flex items-center gap-1.5">
                  <label for="selectCat-${tool.id}" class="text-[11px] font-medium text-zinc-400 hidden lg:inline">Tab:</label>
                  <div class="relative">
                    <select
                      id="selectCat-${tool.id}"
                      data-action="change-category"
                      data-tool-id="${tool.id}"
                      class="select-tool-category appearance-none pl-3 pr-7 py-2 rounded-xl text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[40px]"
                    >
                      ${draftCategories.map(c => `
                        <option value="${c.id}" ${c.id === tool.category ? 'selected' : ''}>
                          ${c.label} (#${c.id})
                        </option>
                      `).join('')}
                    </select>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"></i>
                  </div>
                </div>

                <!-- Reorder Up/Down Buttons -->
                <div class="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-200 dark:border-white/5">
                  <button
                    type="button"
                    data-action="move-up"
                    data-tool-id="${tool.id}"
                    ${isFirst ? 'disabled' : ''}
                    class="btn-move-tool w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                    title="Di chuyển lên trên"
                  >
                    <i data-lucide="chevron-up" class="w-4 h-4 pointer-events-none"></i>
                  </button>

                  <button
                    type="button"
                    data-action="move-down"
                    data-tool-id="${tool.id}"
                    ${isLast ? 'disabled' : ''}
                    class="btn-move-tool w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                    title="Di chuyển xuống dưới"
                  >
                    <i data-lucide="chevron-down" class="w-4 h-4 pointer-events-none"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 5. Real-Time Visual Tab Preview Card -->
      <div class="p-5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-3.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="eye" class="w-4 h-4 text-zinc-500"></i>
            <h3 class="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Xem Trước Bố Cục Thẻ Theo Tab</h3>
          </div>
          <span class="text-[11px] text-zinc-500">Tổng cộng: ${draftTools.length} thẻ trong ${draftCategories.length} tabs</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${draftCategories.map(cat => {
            const catTools = draftTools.filter(t => t.category === cat.id);
            return `
              <div class="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-white/5 space-y-2">
                <div class="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-white/5">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${cat.color};"></span>
                    <span class="text-xs font-bold text-zinc-800 dark:text-zinc-200">${cat.label}</span>
                  </div>
                  <span class="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-700/60 px-1.5 py-0.2 rounded">${catTools.length}</span>
                </div>

                <div class="space-y-1.5 min-h-[48px]">
                  ${catTools.length === 0 ? `
                    <p class="text-[11px] text-zinc-400 italic py-2 text-center">Chưa có thẻ nào trong tab này</p>
                  ` : catTools.map((t, i) => `
                    <div class="flex items-center justify-between py-1 px-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 text-xs">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-[10px] font-mono text-zinc-400 font-bold shrink-0">${i + 1}.</span>
                        <span class="truncate text-zinc-700 dark:text-zinc-300 font-medium">${t.title}</span>
                      </div>
                      <span class="text-[9px] font-mono text-zinc-400 shrink-0 ml-1">#${draftTools.findIndex(dt => dt.id === t.id) + 1}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Attaches interactive listeners to the Tool Card & Tab Manager UI
 */
export function attachAdminToolCardManagerListeners(container, onReRender) {
  if (!container) return;

  const refreshUI = () => {
    container.innerHTML = renderAdminToolCardManager();
    attachAdminToolCardManagerListeners(container, onReRender);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (_) {}
    }
    if (typeof onReRender === 'function') {
      onReRender();
    }
  };

  // 1. Tab Filter Buttons
  container.querySelectorAll('.btn-tool-tab-filter').forEach(btn => {
    btn.onclick = () => {
      const targetFilter = btn.dataset.tabFilter || 'all';
      if (activeCategoryFilter !== targetFilter) {
        activeCategoryFilter = targetFilter;
        soundEngine?.playToggle();
        refreshUI();
      }
    };
  });

  // 2. Search Box
  const inputSearch = container.querySelector('#inputSearchToolLayout');
  if (inputSearch) {
    inputSearch.oninput = (e) => {
      searchQuery = e.target.value;
      refreshUI();
    };
  }

  const btnClearSearch = container.querySelector('#btnClearSearchToolLayout');
  if (btnClearSearch) {
    btnClearSearch.onclick = () => {
      searchQuery = '';
      refreshUI();
    };
  }

  // 3. Tab Creation Form Toggle & Submission
  const btnOpenAddTab = container.querySelector('#btnOpenAddTab');
  if (btnOpenAddTab) {
    btnOpenAddTab.onclick = () => {
      showAddTabModal = !showAddTabModal;
      if (showAddTabModal) {
        newTabForm = { label: '', id: '', color: PRESET_TAB_COLORS[Math.floor(Math.random() * PRESET_TAB_COLORS.length)] };
      }
      refreshUI();
    };
  }

  const btnCancelAddTab = container.querySelector('#btnCancelAddTab');
  if (btnCancelAddTab) {
    btnCancelAddTab.onclick = () => {
      showAddTabModal = false;
      refreshUI();
    };
  }

  const inputNewTabLabel = container.querySelector('#inputNewTabLabel');
  const inputNewTabId = container.querySelector('#inputNewTabId');
  const inputNewTabColor = container.querySelector('#inputNewTabColor');

  if (inputNewTabLabel) {
    inputNewTabLabel.oninput = (e) => {
      newTabForm.label = e.target.value;
      if (!inputNewTabId.dataset.manuallyEdited) {
        newTabForm.id = toSlug(e.target.value);
        if (inputNewTabId) inputNewTabId.value = newTabForm.id;
      }
    };
  }

  if (inputNewTabId) {
    inputNewTabId.oninput = (e) => {
      inputNewTabId.dataset.manuallyEdited = 'true';
      newTabForm.id = toSlug(e.target.value);
      e.target.value = newTabForm.id;
    };
  }

  if (inputNewTabColor) {
    inputNewTabColor.oninput = (e) => {
      newTabForm.color = e.target.value;
      refreshUI();
    };
  }

  container.querySelectorAll('.btn-preset-color').forEach(btn => {
    btn.onclick = () => {
      const color = btn.dataset.presetColor;
      if (color) {
        newTabForm.color = color;
        refreshUI();
      }
    };
  });

  const btnSubmitNewTab = container.querySelector('#btnSubmitNewTab');
  if (btnSubmitNewTab) {
    btnSubmitNewTab.onclick = () => {
      const label = (newTabForm.label || '').trim();
      let id = (newTabForm.id || '').trim().toLowerCase();
      if (!id) {
        id = toSlug(label);
      }

      if (!label) {
        showToast('Vui lòng nhập tên tab hiển thị', 'error');
        return;
      }
      if (!id) {
        showToast('Vui lòng nhập mã ID/Slug cho tab', 'error');
        return;
      }

      if (id === 'all' || draftCategories.some(c => c.id === id)) {
        showToast(`Mã tab #${id} đã tồn tại! Vui lòng chọn ID khác`, 'error');
        return;
      }

      draftCategories.push({
        id,
        label,
        color: newTabForm.color || '#6366F1'
      });

      showAddTabModal = false;
      newTabForm = { label: '', id: '', color: '#8B5CF6' };
      try { soundEngine?.playSuccess(); } catch (_) {}
      showToast(`Đã thêm tab "${label}" thành công`, 'success');
      refreshUI();
    };
  }

  // 4. In-Place Edit Tab Color & Label
  container.querySelectorAll('.input-tab-color-edit').forEach(input => {
    input.onchange = (e) => {
      const catId = input.dataset.catId;
      const targetCat = draftCategories.find(c => c.id === catId);
      if (targetCat && targetCat.color !== e.target.value) {
        targetCat.color = e.target.value;
        try { soundEngine?.playToggle(); } catch (_) {}
        refreshUI();
      }
    };
  });

  container.querySelectorAll('.input-tab-label-edit').forEach(input => {
    input.onchange = (e) => {
      const catId = input.dataset.catId;
      const targetCat = draftCategories.find(c => c.id === catId);
      const val = (e.target.value || '').trim();
      if (targetCat && val && targetCat.label !== val) {
        targetCat.label = val;
        try { soundEngine?.playToggle(); } catch (_) {}
        refreshUI();
      }
    };
  });

  // 5. Delete Custom Tab
  container.querySelectorAll('.btn-delete-tab').forEach(btn => {
    btn.onclick = () => {
      const catId = btn.dataset.catId;
      const catLabel = btn.dataset.catLabel || catId;
      if (SYSTEM_CATEGORY_IDS.has(catId)) {
        showToast('Không thể xóa tab mặc định của hệ thống', 'error');
        return;
      }

      const confirmDelete = window.confirm(
        `Bạn có chắc chắn muốn xóa tab "${catLabel}"? Các thẻ trong tab này sẽ tự động chuyển về tab "Tiện ích".`
      );
      if (!confirmDelete) return;

      // Reassign tools in this category to 'system'
      draftTools.forEach(t => {
        if (t.category === catId) {
          t.category = 'system';
        }
      });

      // Remove from draftCategories
      draftCategories = draftCategories.filter(c => c.id !== catId);
      if (activeCategoryFilter === catId) {
        activeCategoryFilter = 'all';
      }

      try { soundEngine?.playToggle(); } catch (_) {}
      showToast(`Đã xóa tab "${catLabel}". Các thẻ liên quan đã chuyển sang Tiện ích`, 'info');
      refreshUI();
    };
  });

  // 6. Category Change Selectors for Tools
  container.querySelectorAll('.select-tool-category').forEach(sel => {
    sel.onchange = (e) => {
      const toolId = sel.dataset.toolId;
      const newCat = e.target.value;
      const targetTool = draftTools.find(t => t.id === toolId);
      if (targetTool && targetTool.category !== newCat) {
        targetTool.category = newCat;
        try { soundEngine?.playToggle(); } catch (_) {}
        refreshUI();
      }
    };
  });

  // 7. Move Up / Move Down Reordering
  container.querySelectorAll('button[data-action="move-up"]').forEach(btn => {
    btn.onclick = () => {
      const toolId = btn.dataset.toolId;
      const currentFiltered = getFilteredDraftTools();
      const visibleIndex = currentFiltered.findIndex(t => t.id === toolId);
      if (visibleIndex > 0) {
        const prevVisibleTool = currentFiltered[visibleIndex - 1];
        const targetIdx = draftTools.findIndex(t => t.id === toolId);
        const prevIdx = draftTools.findIndex(t => t.id === prevVisibleTool.id);
        if (targetIdx !== -1 && prevIdx !== -1) {
          const [item] = draftTools.splice(targetIdx, 1);
          const newPrevIdx = draftTools.findIndex(t => t.id === prevVisibleTool.id);
          draftTools.splice(newPrevIdx, 0, item);
          // Normalize sequential order
          draftTools.forEach((t, i) => { t.order = i + 1; });
          try { soundEngine?.playToggle(); } catch (_) {}
          refreshUI();
        }
      }
    };
  });

  container.querySelectorAll('button[data-action="move-down"]').forEach(btn => {
    btn.onclick = () => {
      const toolId = btn.dataset.toolId;
      const currentFiltered = getFilteredDraftTools();
      const visibleIndex = currentFiltered.findIndex(t => t.id === toolId);
      if (visibleIndex >= 0 && visibleIndex < currentFiltered.length - 1) {
        const nextVisibleTool = currentFiltered[visibleIndex + 1];
        const targetIdx = draftTools.findIndex(t => t.id === toolId);
        const nextIdx = draftTools.findIndex(t => t.id === nextVisibleTool.id);
        if (targetIdx !== -1 && nextIdx !== -1) {
          const [item] = draftTools.splice(targetIdx, 1);
          const newNextIdx = draftTools.findIndex(t => t.id === nextVisibleTool.id);
          draftTools.splice(newNextIdx + 1, 0, item);
          // Normalize sequential order
          draftTools.forEach((t, i) => { t.order = i + 1; });
          try { soundEngine?.playToggle(); } catch (_) {}
          refreshUI();
        }
      }
    };
  });

  // 8. Save Button
  const btnSave = container.querySelector('#btnSaveToolLayout');
  if (btnSave) {
    btnSave.onclick = async () => {
      if (isSaving) return;
      isSaving = true;
      refreshUI();

      try {
        const authHeaders = getStorageAuthHeaders();
        const payload = draftTools.map((t, idx) => ({
          id: t.id,
          category: t.category,
          order: idx + 1
        }));

        await toolRegistry.saveLayoutToServer(payload, authHeaders, draftCategories);
        originalToolsSnapshot = JSON.parse(JSON.stringify(draftTools));
        originalCategoriesSnapshot = JSON.parse(JSON.stringify(draftCategories));

        try { soundEngine?.playSuccess(); } catch (_) {}
        showToast('Đã lưu cấu hình thẻ và danh mục thành công', 'success');
      } catch (err) {
        console.error('[AdminToolCardManager] Save error:', err);
        try { soundEngine?.playError(); } catch (_) {}
        showToast(err?.message || 'Không thể lưu cấu hình thẻ công cụ', 'error');
      } finally {
        isSaving = false;
        refreshUI();
      }
    };
  }

  // 9. Reset to Defaults Button
  const btnReset = container.querySelector('#btnResetToolLayout');
  if (btnReset) {
    btnReset.onclick = async () => {
      const confirmReset = window.confirm(
        'Bạn có chắc chắn muốn khôi phục vị trí, tab và danh mục của tất cả các thẻ về mặc định ban đầu?'
      );
      if (!confirmReset) return;

      isSaving = true;
      refreshUI();

      try {
        const authHeaders = getStorageAuthHeaders();
        await toolRegistry.resetLayoutToServer(authHeaders);
        initDraftTools();

        try { soundEngine?.playSuccess(); } catch (_) {}
        showToast('Đã khôi phục bố cục thẻ và tab về mặc định ban đầu', 'info');
      } catch (err) {
        console.error('[AdminToolCardManager] Reset error:', err);
        try { soundEngine?.playError(); } catch (_) {}
        showToast(err?.message || 'Không thể khôi phục bố cục mặc định', 'error');
      } finally {
        isSaving = false;
        refreshUI();
      }
    };
  }
}
