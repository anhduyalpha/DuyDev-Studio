/**
 * AdminToolCardManager - Tool Card & Tab Category Layout Editor
 * Allows administrators to reorder tools and reassign categories (tabs) with real-time preview and server persistence.
 */

import { toolRegistry } from '../../hooks/useToolRegistry.js';
import { getStorageAuthHeaders } from '../../utilities/adminAuth.js';
import { showToast } from '../../utilities/toast.js';
import { soundEngine } from '../../utilities/soundEngine.js';

export const CATEGORY_OPTIONS = [
  { id: 'pdf', label: 'PDF', color: '#F59E0B' },
  { id: 'convert', label: 'Chuyển đổi', color: '#8B5CF6' },
  { id: 'archive', label: 'File nén', color: '#0EA5E9' },
  { id: 'qr', label: 'Mã QR', color: '#10B981' },
  { id: 'system', label: 'Tiện ích', color: '#6366F1' },
  { id: 'advanced', label: 'Nâng cao', color: '#EC4899' }
];

// In-memory working draft state
let draftTools = [];
let originalToolsSnapshot = [];
let activeCategoryFilter = 'all';
let searchQuery = '';
let isSaving = false;

/**
 * Syncs working draft state from toolRegistry.tools
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
  return false;
}

/**
 * Renders the Tool Card Manager HTML
 */
export function renderAdminToolCardManager() {
  if (draftTools.length === 0) {
    initDraftTools();
  }

  const isDirty = hasUnsavedChanges();

  // Calculate counts per category
  const counts = { all: draftTools.length };
  CATEGORY_OPTIONS.forEach(c => {
    counts[c.id] = draftTools.filter(t => t.category === c.id).length;
  });

  // Filter tools based on activeCategoryFilter and searchQuery
  const filteredTools = draftTools.filter(tool => {
    const matchCat = activeCategoryFilter === 'all' || tool.category === activeCategoryFilter;
    if (!matchCat) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (tool.title || '').toLowerCase().includes(q) || (tool.id || '').toLowerCase().includes(q);
  });

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
                Quản Lý Thẻ & Danh Mục
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
              Tùy chỉnh danh mục thẻ (tab hiển thị) và kéo đổi thứ tự thẻ công cụ trên trang chủ.
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
          <button
            type="button"
            id="btnResetToolLayout"
            class="px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 min-h-[44px]"
            title="Khôi phục toàn bộ vị trí và danh mục mặc định"
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

      <!-- 2. Search & Category Filters Bar -->
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

            ${CATEGORY_OPTIONS.map(cat => {
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

      <!-- 3. Tools Cards List -->
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
          const isFirst = globalIndex === 0;
          const isLast = globalIndex === draftTools.length - 1;
          const currentCat = CATEGORY_OPTIONS.find(c => c.id === tool.category) || { label: tool.category, color: '#6366F1' };

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
                      ${CATEGORY_OPTIONS.map(c => `
                        <option value="${c.id}" ${c.id === tool.category ? 'selected' : ''}>
                          ${c.label}
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
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                  </button>

                  <button
                    type="button"
                    data-action="move-down"
                    data-tool-id="${tool.id}"
                    ${isLast ? 'disabled' : ''}
                    class="btn-move-tool w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                    title="Di chuyển xuống dưới"
                  >
                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 4. Real-Time Visual Tab Preview Card -->
      <div class="p-5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-3.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="eye" class="w-4 h-4 text-zinc-500"></i>
            <h3 class="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Xem Trước Bố Cục Thẻ Theo Tab</h3>
          </div>
          <span class="text-[11px] text-zinc-500">Tổng cộng: ${draftTools.length} thẻ</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${CATEGORY_OPTIONS.map(cat => {
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
 * Attaches interactive listeners to the Tool Card Manager UI
 */
export function attachAdminToolCardManagerListeners(container, onReRender) {
  if (!container) return;

  const refreshUI = () => {
    container.innerHTML = renderAdminToolCardManager();
    attachAdminToolCardManagerListeners(container, onReRender);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
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

  // 3. Category Change Selectors
  container.querySelectorAll('.select-tool-category').forEach(sel => {
    sel.onchange = (e) => {
      const toolId = sel.dataset.toolId;
      const newCat = e.target.value;
      const targetTool = draftTools.find(t => t.id === toolId);
      if (targetTool && targetTool.category !== newCat) {
        targetTool.category = newCat;
        soundEngine?.play('click');
        refreshUI();
      }
    };
  });

  // 4. Move Up / Move Down Reordering
  container.querySelectorAll('button[data-action="move-up"]').forEach(btn => {
    btn.onclick = () => {
      const toolId = btn.dataset.toolId;
      const index = draftTools.findIndex(t => t.id === toolId);
      if (index > 0) {
        const item = draftTools.splice(index, 1)[0];
        draftTools.splice(index - 1, 0, item);
        // Normalize order
        draftTools.forEach((t, i) => { t.order = i + 1; });
        soundEngine?.play('click');
        refreshUI();
      }
    };
  });

  container.querySelectorAll('button[data-action="move-down"]').forEach(btn => {
    btn.onclick = () => {
      const toolId = btn.dataset.toolId;
      const index = draftTools.findIndex(t => t.id === toolId);
      if (index >= 0 && index < draftTools.length - 1) {
        const item = draftTools.splice(index, 1)[0];
        draftTools.splice(index + 1, 0, item);
        // Normalize order
        draftTools.forEach((t, i) => { t.order = i + 1; });
        soundEngine?.play('click');
        refreshUI();
      }
    };
  });

  // 5. Save Button
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

        await toolRegistry.saveLayoutToServer(payload, authHeaders);
        originalToolsSnapshot = JSON.parse(JSON.stringify(draftTools));

        soundEngine?.play('success');
        showToast('Đã lưu cấu hình thẻ và danh mục thành công', 'success');
      } catch (err) {
        console.error('[AdminToolCardManager] Save error:', err);
        soundEngine?.play('error');
        showToast(err?.message || 'Không thể lưu cấu hình thẻ công cụ', 'error');
      } finally {
        isSaving = false;
        refreshUI();
      }
    };
  }

  // 6. Reset to Defaults Button
  const btnReset = container.querySelector('#btnResetToolLayout');
  if (btnReset) {
    btnReset.onclick = async () => {
      const confirmReset = window.confirm(
        'Bạn có chắc chắn muốn khôi phục vị trí và danh mục của tất cả các thẻ về mặc định ban đầu?'
      );
      if (!confirmReset) return;

      isSaving = true;
      refreshUI();

      try {
        const authHeaders = getStorageAuthHeaders();
        await toolRegistry.resetLayoutToServer(authHeaders);
        initDraftTools();

        soundEngine?.play('success');
        showToast('Đã khôi phục bố cục thẻ công cụ về mặc định ban đầu', 'info');
      } catch (err) {
        console.error('[AdminToolCardManager] Reset error:', err);
        soundEngine?.play('error');
        showToast(err?.message || 'Không thể khôi phục bố cục mặc định', 'error');
      } finally {
        isSaving = false;
        refreshUI();
      }
    };
  }
}
