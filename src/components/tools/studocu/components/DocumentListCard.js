/**
 * DocumentListCard Component (< 125 lines)
 * Renders the document management section with search, filter tabs, sorting, and item rows.
 */

import { renderDocumentItem } from './DocumentItem.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentItemsHtml(items, isTrash) {
  if (items.length > 0) {
    return items.map(doc => renderDocumentItem(doc, isTrash)).join('');
  }
  return `
    <div class="p-8 text-center space-y-2 text-zinc-500">
      <i data-lucide="${isTrash ? 'trash' : 'file-search'}" class="w-8 h-8 mx-auto text-zinc-600 opacity-60"></i>
      <p class="text-xs font-mono">
        ${isTrash ? 'Thùng rác trống.' : 'Chưa có tài liệu.'}
      </p>
    </div>
  `;
}

export function renderDocumentListCard(state) {
  const currentTab = state.currentTab || 'pdf';
  const isTrash = currentTab === 'trash';
  const items = state.filteredItems || [];
  const counts = state.counts || { pdf: 0, trash: 0 };

  return `
    <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800/90 bg-white dark:bg-[#111114] p-4 sm:p-5 space-y-3.5 shadow-xs dark:shadow-xl">
      <!-- Section Header -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
        <div class="flex items-center gap-2.5">
          <i data-lucide="${isTrash ? 'trash' : 'folder'}" class="w-4 h-4 text-zinc-500 dark:text-zinc-400"></i>
          <h3 class="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
            ${isTrash ? 'Thùng rác' : 'Tài liệu'}
          </h3>
          <span id="studocuItemCountBadge" class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
            ${items.length} tệp
          </span>
        </div>

        <div class="flex items-center gap-2">
          ${isTrash && counts.trash > 0 ? `
            <button
              type="button"
              id="btnEmptyStudocuTrash"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 transition cursor-pointer"
              title="Dọn sạch thùng rác"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Xóa tất cả</span>
            </button>
          ` : ''}

          <button
            type="button"
            id="btnRefreshStudocuList"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/70 transition cursor-pointer"
            title="Làm mới"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
        <!-- Search Box -->
        <div class="relative flex-1">
          <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input
            type="text"
            id="studocuSearchInput"
            value="${escapeHtml(state.searchQuery || '')}"
            placeholder="Tìm tài liệu..."
            class="w-full pl-9 pr-8 py-2 text-xs font-sans bg-zinc-50 dark:bg-[#0d0d10] border border-zinc-200 dark:border-zinc-800/90 rounded-xl text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition"
          />
          <button type="button" id="btnClearStudocuSearch" class="${state.searchQuery ? '' : 'hidden '}absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">✕</button>
        </div>

        <!-- Filter Segmented Tabs & Sort -->
        <div class="flex items-center justify-between sm:justify-end gap-2 select-none">
          <div class="file-filter-tabs">
            <button type="button" class="filter-tab ${currentTab === 'pdf' ? 'active' : ''} tab-filter-studocu cursor-pointer" data-tab="pdf">
              <span>PDF</span> <span class="filter-count">${counts.pdf || 0}</span>
            </button>
            <button type="button" class="filter-tab filter-tab-trash ${currentTab === 'trash' ? 'active' : ''} tab-filter-studocu cursor-pointer" data-tab="trash">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
              <span>Thùng rác</span> <span class="filter-count">${counts.trash || 0}</span>
            </button>
          </div>

          <!-- Sort Dropdown -->
          <div class="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <select id="studocuSortSelect" class="py-1.5 px-2.5 text-xs bg-white dark:bg-[#0d0d10] border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-300 focus:outline-none cursor-pointer">
              <option value="newest" ${state.sortOption === 'newest' ? 'selected' : ''}>Mới nhất</option>
              <option value="oldest" ${state.sortOption === 'oldest' ? 'selected' : ''}>Cũ nhất</option>
              <option value="name_asc" ${state.sortOption === 'name_asc' ? 'selected' : ''}>Tên A-Z</option>
              <option value="name_desc" ${state.sortOption === 'name_desc' ? 'selected' : ''}>Tên Z-A</option>
              <option value="size_desc" ${state.sortOption === 'size_desc' ? 'selected' : ''}>Dung lượng lớn</option>
              <option value="size_asc" ${state.sortOption === 'size_asc' ? 'selected' : ''}>Dung lượng nhỏ</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Items List -->
      <div id="studocuItemsContainer" class="pt-1 space-y-1.5">
        ${renderDocumentItemsHtml(items, isTrash)}
      </div>
    </div>
  `.trim();
}
