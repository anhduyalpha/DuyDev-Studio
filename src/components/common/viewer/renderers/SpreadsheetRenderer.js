/**
 * SpreadsheetRenderer Component (< 200 lines)
 * Client-Side Spreadsheet (.xlsx, .xls, .csv, .tsv, .ods) Viewer using SheetJS
 */

import { ensureSheetJsLoaded } from '../../../../utilities/sheetHelper.js';
import { formatBytes } from '../../../../utilities/formatters.js';

function escapeCell(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function colName(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export function renderSpreadsheetViewer(state) {
  const ext = (state.name.split('.').pop() || 'SHEET').toUpperCase();
  return `
    <div id="sheetViewerRoot" class="flex-1 flex flex-col min-h-[350px] max-h-[82vh] relative overflow-hidden bg-white dark:bg-[#121215] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
      <!-- Top Action & Search Bar -->
      <div class="px-4 py-2.5 border-b border-zinc-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5 bg-zinc-50/80 dark:bg-white/[0.02] shrink-0">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            ${ext}
          </span>
          <span id="sheetTelemetry" class="text-xs font-mono text-zinc-500 dark:text-zinc-400">Đang đọc dữ liệu...</span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Realtime Search -->
          <div class="relative">
            <input id="inputSheetSearch" type="search" placeholder="Tìm kiếm ô..." class="w-36 sm:w-48 pl-7 pr-2.5 py-1 text-xs font-mono rounded-lg bg-white dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:border-emerald-500 transition" />
            <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-2 pointer-events-none"></i>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div id="sheetLoading" class="my-auto py-16 text-center space-y-3">
        <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
        </div>
        <p class="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">Đang xuất bảng tính...</p>
      </div>

      <!-- Table Viewport -->
      <div id="sheetTableContainer" class="flex-1 overflow-auto custom-scrollbar relative hidden"></div>

      <!-- Sheet Tabs Bar (Bottom) -->
      <div id="sheetTabsBar" class="px-3 py-1.5 border-t border-zinc-200 dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto custom-scrollbar bg-zinc-100/70 dark:bg-[#0a0a0c] shrink-0 hidden"></div>
    </div>
  `;
}

export function attachSpreadsheetListeners(state, registerCleanup) {
  const abortController = new AbortController();
  registerCleanup(() => abortController.abort());

  const container = document.getElementById('sheetTableContainer');
  const tabsBar = document.getElementById('sheetTabsBar');
  const loading = document.getElementById('sheetLoading');
  const telemetry = document.getElementById('sheetTelemetry');
  const searchInput = document.getElementById('inputSheetSearch');

  let workbook = null;
  let activeSheetName = '';
  let currentRows = [];
  let filterQuery = '';

  function renderActiveSheet() {
    if (!workbook || !activeSheetName || !container) return;
    const worksheet = workbook.Sheets[activeSheetName];
    if (!worksheet) return;

    currentRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    const maxCols = currentRows.reduce((m, r) => Math.max(m, r.length), 0);

    const q = filterQuery.toLowerCase().trim();
    const indexedRows = currentRows.map((row, idx) => ({ row, rowNum: idx + 1 }));
    let displayRows = indexedRows;
    if (q) {
      displayRows = indexedRows.filter(item => item.row.some(c => String(c).toLowerCase().includes(q)));
    }

    const totalCount = currentRows.length;
    const isTruncated = displayRows.length > 1000;
    if (telemetry) {
      telemetry.textContent = `${workbook.SheetNames.length} sheet • ${totalCount} dòng • ${maxCols} cột${isTruncated ? ' (hiển thị 1.000 dòng đầu)' : ''}`;
    }

    if (displayRows.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 text-xs font-mono text-zinc-400">
          ${q ? 'Không tìm thấy ô khớp với từ khóa' : 'Trang tính này không có dữ liệu'}
        </div>
      `;
      return;
    }

    const headerCols = Array.from({ length: maxCols }, (_, i) => colName(i));
    const headerHtml = `
      <thead class="sticky top-0 z-10 bg-zinc-100 dark:bg-[#18181c] border-b border-zinc-200 dark:border-white/[0.08] text-[11px] font-mono text-zinc-500">
        <tr>
          <th class="sticky left-0 z-20 w-12 px-2 py-1.5 text-center bg-zinc-200/70 dark:bg-[#202025] border-r border-zinc-200 dark:border-white/[0.08]">#</th>
          ${headerCols.map(c => `<th class="px-3 py-1.5 text-left font-medium border-r border-zinc-200/50 dark:border-white/[0.04] min-w-[90px]">${c}</th>`).join('')}
        </tr>
      </thead>
    `;

    const bodyHtml = `
      <tbody class="divide-y divide-zinc-100 dark:divide-white/[0.04] text-xs font-mono">
        ${displayRows.slice(0, 1000).map((item) => {
          const row = item.row;
          return `
            <tr class="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition">
              <td class="sticky left-0 z-[5] px-2 py-1 text-center bg-zinc-50 dark:bg-[#141417] border-r border-zinc-200 dark:border-white/[0.08] text-[10px] text-zinc-400 font-bold select-none">${item.rowNum}</td>
              ${headerCols.map((_, cIdx) => {
                const val = row[cIdx] !== undefined ? row[cIdx] : '';
                const str = escapeCell(val);
                const isMatch = q && String(val).toLowerCase().includes(q);
                return `<td class="px-3 py-1 border-r border-zinc-100 dark:border-white/[0.03] text-zinc-800 dark:text-zinc-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] ${isMatch ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold' : ''}" title="${str}">${str}</td>`;
              }).join('')}
            </tr>
          `;
        }).join('')}
      </tbody>
    `;

    container.innerHTML = `<table class="w-full text-left border-collapse">${headerHtml}${bodyHtml}</table>`;
  }

  function renderTabs() {
    if (!workbook || !tabsBar) return;
    tabsBar.innerHTML = workbook.SheetNames.map(name => {
      const isActive = name === activeSheetName;
      return `
        <button type="button" data-sheet="${escapeCell(name)}" class="sheet-tab-btn px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer shrink-0 ${isActive ? 'bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-xs border border-zinc-200/80 dark:border-white/10' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}">
          ${escapeCell(name)}
        </button>
      `;
    }).join('');

    tabsBar.querySelectorAll('.sheet-tab-btn').forEach(btn => {
      btn.onclick = () => {
        activeSheetName = btn.dataset.sheet;
        renderTabs();
        renderActiveSheet();
      };
    });
  }

  searchInput?.addEventListener('input', (e) => {
    filterQuery = e.target.value;
    renderActiveSheet();
  });

  async function loadAndRender() {
    try {
      await ensureSheetJsLoaded();

      let buffer;
      if (state.rawFile instanceof Blob) {
        buffer = await state.rawFile.arrayBuffer();
      } else {
        const res = await fetch(state.viewUrl, { signal: abortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = await res.arrayBuffer();
      }

      workbook = window.XLSX.read(buffer, { type: 'array' });
      activeSheetName = workbook.SheetNames[0] || '';

      if (loading) loading.classList.add('hidden');
      if (container) container.classList.remove('hidden');
      if (tabsBar && workbook.SheetNames.length > 0) tabsBar.classList.remove('hidden');

      renderTabs();
      renderActiveSheet();
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (loading) {
        const dlUrl = state.downloadUrl || state.viewUrl || '#';
        loading.innerHTML = `
          <div class="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto">
            <i data-lucide="alert-circle" class="w-5 h-5"></i>
          </div>
          <p class="font-mono text-xs font-semibold text-red-500">${err.message || 'Không thể đọc tệp bảng tính'}</p>
          <div class="pt-2">
            <a href="${dlUrl}" download="${state.name}" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về
            </a>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: loading });
      }
    }
  }

  loadAndRender();
}
