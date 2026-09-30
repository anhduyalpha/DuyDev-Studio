/**
 * PdfOutlineDrawer Component (< 150 lines)
 * Table of Contents Drawer (Slide-over on Desktop, Bottom Sheet on Mobile)
 */

export function renderOutlineDrawer() {
  return `
    <div id="pdfOutlineBackdrop" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 opacity-0 pointer-events-none"></div>
    <aside id="pdfOutlineDrawer" class="fixed z-50 transition-transform duration-300 ease-out 
      bottom-0 left-0 right-0 max-h-[75vh] rounded-t-2xl sm:rounded-none sm:top-0 sm:bottom-0 sm:left-0 sm:right-auto sm:w-80 sm:max-h-full
      bg-zinc-950/95 dark:bg-[#0c0c0e]/95 backdrop-blur-md border-t sm:border-t-0 sm:border-r border-zinc-800 text-zinc-100 shadow-2xl flex flex-col translate-y-full sm:translate-y-0 sm:-translate-x-full">
      
      <!-- Drawer Header -->
      <div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <i data-lucide="list" class="w-4 h-4 text-indigo-400"></i>
          <span class="text-xs font-bold uppercase tracking-wider text-zinc-300">Mục lục</span>
        </div>
        <button id="btnCloseOutlineDrawer" type="button" class="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Search in Outline -->
      <div class="p-3 border-b border-zinc-800/80 shrink-0">
        <div class="relative">
          <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input id="inputOutlineSearch" type="text" placeholder="Tìm mục lục..."
            class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans" />
        </div>
      </div>

      <!-- Outline Tree Items -->
      <div id="pdfOutlineList" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5 text-xs">
        <div class="py-8 text-center text-zinc-500 font-mono text-[11px]">Đang tải mục lục...</div>
      </div>
    </aside>
  `;
}

export function openOutlineDrawer() {
  const backdrop = document.getElementById('pdfOutlineBackdrop');
  const drawer = document.getElementById('pdfOutlineDrawer');
  if (backdrop && drawer) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
    drawer.classList.remove('translate-y-full', 'sm:-translate-x-full');
    drawer.classList.add('translate-y-0', 'sm:translate-x-0');
  }
}

export function closeOutlineDrawer() {
  const backdrop = document.getElementById('pdfOutlineBackdrop');
  const drawer = document.getElementById('pdfOutlineDrawer');
  if (backdrop && drawer) {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    drawer.classList.add('translate-y-full', 'sm:-translate-x-full');
    drawer.classList.remove('translate-y-0', 'sm:translate-x-0');
  }
}

export function toggleOutlineDrawer() {
  const drawer = document.getElementById('pdfOutlineDrawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('translate-y-0') || drawer.classList.contains('sm:translate-x-0');
  if (isOpen) closeOutlineDrawer();
  else openOutlineDrawer();
}

function renderTreeItems(items, level = 0, query = '') {
  if (!items || items.length === 0) return '';
  const q = query.trim().toLowerCase();
  let html = '';

  for (const item of items) {
    const match = !q || (item.title && item.title.toLowerCase().includes(q));
    const childrenHtml = renderTreeItems(item.items, level + 1, query);

    if (match || childrenHtml) {
      const padLeft = Math.min(level * 14 + 8, 48);
      html += `
        <button type="button" data-dest-page="${item.pageNumber || ''}" class="btn-outline-item w-full text-left py-1.5 px-2.5 rounded-lg hover:bg-white/[0.08] active:bg-indigo-500/20 text-zinc-300 hover:text-white transition flex items-center justify-between gap-2 group cursor-pointer" style="padding-left: ${padLeft}px">
          <span class="truncate ${level === 0 ? 'font-semibold text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-200'}">${item.title}</span>
          ${item.pageNumber ? `<span class="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 shrink-0">tr. ${item.pageNumber}</span>` : ''}
        </button>
        ${childrenHtml}
      `;
    }
  }
  return html;
}

export function attachOutlineListeners(items, onJumpPage) {
  const backdrop = document.getElementById('pdfOutlineBackdrop');
  const btnClose = document.getElementById('btnCloseOutlineDrawer');
  const searchInput = document.getElementById('inputOutlineSearch');
  const listEl = document.getElementById('pdfOutlineList');

  backdrop?.addEventListener('click', closeOutlineDrawer);
  btnClose?.addEventListener('click', closeOutlineDrawer);

  const updateList = (query = '') => {
    if (!listEl) return;
    if (!items || items.length === 0) {
      listEl.innerHTML = '<div class="py-10 text-center text-zinc-500 text-xs">Không có mục lục</div>';
      return;
    }
    const html = renderTreeItems(items, 0, query);
    listEl.innerHTML = html || '<div class="py-10 text-center text-zinc-500 text-xs">Không tìm thấy mục lục</div>';

    listEl.querySelectorAll('.btn-outline-item').forEach((btn) => {
      btn.onclick = () => {
        const page = Number(btn.dataset.destPage);
        if (page && onJumpPage) {
          onJumpPage(page);
          closeOutlineDrawer();
        }
      };
    });
  };

  searchInput?.addEventListener('input', (e) => updateList(e.target.value));
  updateList();
}
