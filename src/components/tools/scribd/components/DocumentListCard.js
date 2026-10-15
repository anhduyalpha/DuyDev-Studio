/**
 * DocumentListCard Component - Stitch Editorial Bookshelf
 * Scoped for Scribd Document Archiver.
 * Implements unified segmented header bar, compact horizontal search+sort bar,
 * book-spine item rows, and refined empty states with bottom navigation protection.
 */

import { renderDocumentItem } from './DocumentItem.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentItemsHtml(items, isTrash, options = {}) {
  if (items && items.length > 0) {
    return items.map(doc => {
      const docName = doc.name || doc.title || '';
      const isDownloaded = doc.isDownloaded || (typeof options.isDocDownloaded === 'function' && options.isDocDownloaded(docName));
      const isJustDownloaded = doc.isJustDownloaded || (typeof options.isDocJustDownloaded === 'function' && options.isDocJustDownloaded(docName));
      return renderDocumentItem(doc, isTrash, { isDownloaded, isJustDownloaded });
    }).join('');
  }

  return `
    <div class="scribd-bookshelf-empty pb-24 sm:pb-16">
      <div class="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 text-[#EA580C] dark:text-orange-400 flex items-center justify-center mb-1">
        <i data-lucide="${isTrash ? 'trash-2' : 'book-open'}" class="w-5 h-5"></i>
      </div>
      <p class="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        ${isTrash ? 'Thùng rác trống' : 'Chưa có tài liệu nào trên kệ'}
      </p>
      <p class="text-[11.5px] text-zinc-500 dark:text-zinc-400 max-w-xs">
        ${isTrash ? 'Các tài liệu bị xóa sẽ được lưu trữ tạm thời tại đây.' : 'Dán liên kết tài liệu Scribd vào thanh nhập lệnh ở trên để tải.'}
      </p>
    </div>
  `;
}

export function renderDocumentListCard(state) {
  const currentTab = state.currentTab || 'pdf';
  const isTrash = currentTab === 'trash';
  const items = state.filteredItems || [];
  const counts = state.counts || { pdf: (state.files || []).length, trash: (state.trash || []).length };
  const downloadedSet = state.downloadedDocNames || new Set();
  const justDownloadedName = state.justDownloadedDocName || null;

  const itemOptions = {
    isDocDownloaded: (name) => {
      const norm = (s) => (s || '').normalize('NFC').trim();
      return downloadedSet.has(norm(name));
    },
    isDocJustDownloaded: (name) => {
      const norm = (s) => (s || '').normalize('NFC').trim();
      return Boolean(justDownloadedName && norm(name) === justDownloadedName);
    }
  };

  return `
    <div class="scribd-bookshelf space-y-3.5">
      <!-- Row 1: Header + Sort Dropdown + Actions -->
      <div class="flex items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <!-- Left: Title & Count Badge -->
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-base select-none shrink-0">📚</span>
          <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight whitespace-nowrap truncate">
            Kệ tài liệu
          </h3>
          <span id="scribdItemCountBadge" class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/70 dark:border-zinc-700/60 whitespace-nowrap shrink-0">
            ${items.length} tệp
          </span>
        </div>

        <!-- Right: Sort Dropdown + Actions (Empty Trash + Refresh) -->
        <div class="flex items-center gap-1.5 sm:gap-2 select-none shrink-0">
          <select
            id="scribdSortSelect"
            class="scribd-sort-select py-1 px-2 text-xs bg-zinc-50 dark:bg-[#0c0c0f] border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#EA580C] min-h-[38px] h-[38px] cursor-pointer whitespace-nowrap"
            title="Sắp xếp danh sách"
          >
            <option value="newest" ${state.sortOption === 'newest' ? 'selected' : ''}>Mới nhất</option>
            <option value="oldest" ${state.sortOption === 'oldest' ? 'selected' : ''}>Cũ nhất</option>
            <option value="name_asc" ${state.sortOption === 'name_asc' ? 'selected' : ''}>Tên A-Z</option>
            <option value="name_desc" ${state.sortOption === 'name_desc' ? 'selected' : ''}>Tên Z-A</option>
            <option value="size_desc" ${state.sortOption === 'size_desc' ? 'selected' : ''}>Dung lượng lớn</option>
            <option value="size_asc" ${state.sortOption === 'size_asc' ? 'selected' : ''}>Dung lượng nhỏ</option>
          </select>

          ${isTrash && counts.trash > 0 ? `
            <button
              type="button"
              id="btnEmptyScribdTrash"
              class="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition cursor-pointer min-h-[38px] min-w-[38px] touch-manipulation whitespace-nowrap"
              title="Dọn sạch thùng rác"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span class="hidden md:inline">Dọn sạch</span>
            </button>
          ` : ''}

          <button
            type="button"
            id="btnRefreshScribdList"
            class="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/60 transition cursor-pointer min-h-[38px] min-w-[38px] touch-manipulation whitespace-nowrap"
            title="Làm mới danh sách"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span class="hidden md:inline text-xs font-medium">Làm mới</span>
          </button>
        </div>
      </div>

      <!-- Row 2: Full-Width Search Input (100% full width, height: 44px) -->
      <div class="relative w-full">
        <i data-lucide="search" class="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
        <input
          type="text"
          id="scribdSearchInput"
          value="${escapeHtml(state.searchQuery || '')}"
          placeholder="Tìm kiếm tài liệu..."
          class="w-full pl-10 pr-10 py-2 text-xs sm:text-sm font-sans bg-zinc-50 dark:bg-[#0c0c0f] border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#EA580C] min-h-[44px] h-[44px] transition"
        />
        <button
          type="button"
          id="btnClearScribdSearch"
          class="${state.searchQuery ? '' : 'hidden '}absolute right-1 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center touch-manipulation"
          title="Xóa tìm kiếm"
        >
          ✕
        </button>
      </div>

      <!-- Row 3: Full-Width Segmented Tabs (Never wrap, 50% width each on mobile) -->
      <div class="w-full select-none pt-0.5">
        <div class="scribd-segmented-switcher w-full grid grid-cols-2">
          <button
            type="button"
            class="scribd-segmented-tab tab-filter-scribd ${currentTab === 'pdf' ? 'active' : ''} min-h-[40px] touch-manipulation cursor-pointer whitespace-nowrap"
            data-tab="pdf"
          >
            <span class="whitespace-nowrap">Tất cả</span>
            <span class="text-[11px] font-mono opacity-80 whitespace-nowrap">(${counts.pdf || 0})</span>
          </button>
          <button
            type="button"
            class="scribd-segmented-tab tab-filter-scribd ${currentTab === 'trash' ? 'active' : ''} min-h-[40px] touch-manipulation cursor-pointer whitespace-nowrap"
            data-tab="trash"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5 shrink-0"></i>
            <span class="whitespace-nowrap">Thùng rác</span>
            <span class="text-[11px] font-mono opacity-80 whitespace-nowrap">(${counts.trash || 0})</span>
          </button>
        </div>
      </div>

      <!-- 4. Items Container with 14px Vertical Gap -->
      <div id="scribdItemsContainer" class="pt-1 space-y-3.5">
        ${renderDocumentItemsHtml(items, isTrash, itemOptions)}
      </div>
    </div>
  `.trim();
}
