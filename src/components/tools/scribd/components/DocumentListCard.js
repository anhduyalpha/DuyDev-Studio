/**
 * DocumentListCard Component - Stitch Editorial Bookshelf
 * Scoped for Scribd Document Archiver.
 * Implements unified segmented header bar, compact horizontal search+sort bar,
 * book-spine item rows, and refined empty states.
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
    <div class="scribd-bookshelf-empty">
      <div class="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/15 text-[#EA580C] dark:text-orange-400 flex items-center justify-center mb-1">
        <i data-lucide="${isTrash ? 'trash-2' : 'book-open'}" class="w-4 h-4"></i>
      </div>
      <p class="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        ${isTrash ? 'Thùng rác trống' : 'Chưa có tài liệu nào trên kệ'}
      </p>
      <p class="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs">
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
      <!-- 1. Unified Segmented Header Bar (Title + Segmented Switcher + Actions) -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <!-- Title & Count Badge -->
        <div class="flex items-center gap-2.5">
          <span class="text-base select-none">📚</span>
          <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Kệ tài liệu
          </h3>
          <span id="scribdItemCountBadge" class="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/70 dark:border-zinc-700/60">
            ${items.length} tệp
          </span>
        </div>

        <!-- Right: Segmented Switcher & Controls -->
        <div class="flex items-center gap-2 select-none">
          <!-- Segmented Pill Switcher -->
          <div class="scribd-segmented-switcher">
            <button
              type="button"
              class="scribd-segmented-tab tab-filter-scribd ${currentTab === 'pdf' ? 'active' : ''}"
              data-tab="pdf"
            >
              <span>Tất cả</span>
              <span class="text-[10px] font-mono opacity-80">(${counts.pdf || 0})</span>
            </button>
            <button
              type="button"
              class="scribd-segmented-tab tab-filter-scribd ${currentTab === 'trash' ? 'active' : ''}"
              data-tab="trash"
            >
              <i data-lucide="trash-2" class="w-3 h-3"></i>
              <span>Thùng rác</span>
              <span class="text-[10px] font-mono opacity-80">(${counts.trash || 0})</span>
            </button>
          </div>

          ${isTrash && counts.trash > 0 ? `
            <button
              type="button"
              id="btnEmptyScribdTrash"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition cursor-pointer min-h-[38px] touch-manipulation"
              title="Dọn sạch thùng rác"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Dọn sạch</span>
            </button>
          ` : ''}

          <button
            type="button"
            id="btnRefreshScribdList"
            class="inline-flex items-center justify-center p-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/60 transition cursor-pointer min-h-[38px] min-w-[38px] touch-manipulation"
            title="Làm mới danh sách"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <!-- 2. Compact Search + Sort Bar (Same Horizontal Row on Mobile and Desktop) -->
      <div class="flex items-center gap-2 pt-0.5">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-0">
          <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
          <input
            type="text"
            id="scribdSearchInput"
            value="${escapeHtml(state.searchQuery || '')}"
            placeholder="Lọc theo tên..."
            class="w-full pl-9 pr-8 py-2 text-xs font-sans bg-zinc-50 dark:bg-[#0c0c0f] border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#EA580C] min-h-[40px] transition"
          />
          <button
            type="button"
            id="btnClearScribdSearch"
            class="${state.searchQuery ? '' : 'hidden '}absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
            title="Xóa tìm kiếm"
          >
            ✕
          </button>
        </div>

        <!-- Sort Select -->
        <div class="shrink-0">
          <select
            id="scribdSortSelect"
            class="py-2 px-2.5 text-xs bg-zinc-50 dark:bg-[#0c0c0f] border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-[#EA580C] min-h-[40px] cursor-pointer"
            title="Sắp xếp danh sách"
          >
            <option value="newest" ${state.sortOption === 'newest' ? 'selected' : ''}>Mới nhất</option>
            <option value="oldest" ${state.sortOption === 'oldest' ? 'selected' : ''}>Cũ nhất</option>
            <option value="name_asc" ${state.sortOption === 'name_asc' ? 'selected' : ''}>Tên A-Z</option>
            <option value="name_desc" ${state.sortOption === 'name_desc' ? 'selected' : ''}>Tên Z-A</option>
            <option value="size_desc" ${state.sortOption === 'size_desc' ? 'selected' : ''}>Dung lượng lớn</option>
            <option value="size_asc" ${state.sortOption === 'size_asc' ? 'selected' : ''}>Dung lượng nhỏ</option>
          </select>
        </div>
      </div>

      <!-- 3. Items Container -->
      <div id="scribdItemsContainer" class="pt-1 space-y-2">
        ${renderDocumentItemsHtml(items, isTrash, itemOptions)}
      </div>
    </div>
  `.trim();
}
