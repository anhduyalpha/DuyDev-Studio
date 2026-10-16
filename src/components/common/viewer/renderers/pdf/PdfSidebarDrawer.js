/**
 * PdfSidebarDrawer Component (< 230 lines)
 * Multi-Tab Slide-Over Drawer: Table of Contents & Lazy Thumbnails Grid
 */

let currentTab = 'outline';
let thumbnailObserver = null;
let activePdfDoc = null;
let renderedThumbnails = new Set();

export function renderSidebarDrawer() {
  return `
    <div id="pdfSidebarBackdrop" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 opacity-0 pointer-events-none"></div>
    <aside id="pdfSidebarDrawer" class="fixed z-50 transition-transform duration-300 ease-out 
      bottom-0 left-0 right-0 max-h-[75vh] rounded-t-2xl sm:rounded-none sm:top-0 sm:bottom-0 sm:left-0 sm:right-auto sm:w-80 sm:max-h-full
      bg-white/95 dark:bg-[#0c0c0e]/95 backdrop-blur-md border-t sm:border-t-0 sm:border-r border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl flex flex-col translate-y-full sm:translate-y-0 sm:-translate-x-full select-none">
      
      <!-- Drawer Header & Tab Selector -->
      <div class="px-3 pt-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-2 shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
            <button id="btnTabOutline" type="button" 
              class="px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs">
              Mục lục
            </button>
            <button id="btnTabThumbnails" type="button" 
              class="px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
              Trang thu nhỏ
            </button>
          </div>

          <button id="btnCloseSidebarDrawer" type="button" title="Đóng"
            class="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 transition cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Search in Outline (shown only when outline tab is active) -->
        <div id="outlineSearchContainer" class="relative">
          <i data-lucide="search" class="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input id="inputOutlineSearch" type="text" placeholder="Tìm kiếm trong mục lục..."
            class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans" />
        </div>
      </div>

      <!-- Tab 1: Outline Tree Content -->
      <div id="tabContentOutline" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5 text-xs">
        <div class="py-8 text-center text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">Đang tải mục lục...</div>
      </div>

      <!-- Tab 2: Thumbnails Grid Content -->
      <div id="tabContentThumbnails" class="hidden flex-1 overflow-y-auto custom-scrollbar p-3">
        <div id="pdfThumbnailGrid" class="grid grid-cols-2 gap-3 pb-8"></div>
      </div>
    </aside>
  `;
}

export function openSidebarDrawer(preferredTab) {
  const backdrop = document.getElementById('pdfSidebarBackdrop');
  const drawer = document.getElementById('pdfSidebarDrawer');
  if (preferredTab) switchSidebarTab(preferredTab);
  if (backdrop && drawer) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
    drawer.classList.remove('translate-y-full', 'sm:-translate-x-full');
    drawer.classList.add('translate-y-0', 'sm:translate-x-0');
    if (window.lucide) window.lucide.createIcons({ root: drawer });
  }
}

export function closeSidebarDrawer() {
  const backdrop = document.getElementById('pdfSidebarBackdrop');
  const drawer = document.getElementById('pdfSidebarDrawer');
  if (backdrop && drawer) {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    drawer.classList.add('translate-y-full', 'sm:-translate-x-full');
    drawer.classList.remove('translate-y-0', 'sm:translate-x-0');
  }
}

export function toggleSidebarDrawer(preferredTab) {
  const drawer = document.getElementById('pdfSidebarDrawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('translate-y-0') || drawer.classList.contains('sm:translate-x-0');
  if (isOpen) closeSidebarDrawer();
  else openSidebarDrawer(preferredTab);
}

export function switchSidebarTab(tab) {
  currentTab = tab;
  const btnOutline = document.getElementById('btnTabOutline');
  const btnThumbnails = document.getElementById('btnTabThumbnails');
  const contentOutline = document.getElementById('tabContentOutline');
  const contentThumbnails = document.getElementById('tabContentThumbnails');
  const searchContainer = document.getElementById('outlineSearchContainer');

  if (tab === 'outline') {
    btnOutline?.classList.add('bg-white', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-zinc-100', 'shadow-xs');
    btnOutline?.classList.remove('text-zinc-500', 'dark:text-zinc-400');
    btnThumbnails?.classList.remove('bg-white', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-zinc-100', 'shadow-xs');
    btnThumbnails?.classList.add('text-zinc-500', 'dark:text-zinc-400');
    contentOutline?.classList.remove('hidden');
    contentThumbnails?.classList.add('hidden');
    searchContainer?.classList.remove('hidden');
  } else {
    btnThumbnails?.classList.add('bg-white', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-zinc-100', 'shadow-xs');
    btnThumbnails?.classList.remove('text-zinc-500', 'dark:text-zinc-400');
    btnOutline?.classList.remove('bg-white', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-zinc-100', 'shadow-xs');
    btnOutline?.classList.add('text-zinc-500', 'dark:text-zinc-400');
    contentThumbnails?.classList.remove('hidden');
    contentOutline?.classList.add('hidden');
    searchContainer?.classList.add('hidden');
  }
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
        <button type="button" data-dest-page="${item.pageNumber || ''}" class="btn-outline-item w-full text-left py-1.5 px-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] active:bg-indigo-500/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition flex items-center justify-between gap-2 group cursor-pointer" style="padding-left: ${padLeft}px">
          <span class="truncate ${level === 0 ? 'font-semibold text-zinc-900 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'}">${item.title}</span>
          ${item.pageNumber ? `<span class="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 shrink-0">tr. ${item.pageNumber}</span>` : ''}
        </button>
        ${childrenHtml}
      `;
    }
  }
  return html;
}

export function attachSidebarListeners({ outlineItems = [], pdfDoc = null, totalPages = 1, currentPage = 1, onJumpPage }) {
  activePdfDoc = pdfDoc;
  renderedThumbnails.clear();

  const backdrop = document.getElementById('pdfSidebarBackdrop');
  const btnClose = document.getElementById('btnCloseSidebarDrawer');
  const btnOutline = document.getElementById('btnTabOutline');
  const btnThumbnails = document.getElementById('btnTabThumbnails');
  const searchInput = document.getElementById('inputOutlineSearch');
  const outlineListEl = document.getElementById('tabContentOutline');
  const thumbnailGridEl = document.getElementById('pdfThumbnailGrid');

  backdrop?.addEventListener('click', closeSidebarDrawer);
  btnClose?.addEventListener('click', closeSidebarDrawer);

  btnOutline?.addEventListener('click', () => switchSidebarTab('outline'));
  btnThumbnails?.addEventListener('click', () => switchSidebarTab('thumbnails'));

  // If no TOC outline, auto-switch to thumbnails tab
  if (!outlineItems || outlineItems.length === 0) {
    switchSidebarTab('thumbnails');
  }

  // Render Outline
  const updateOutline = (query = '') => {
    if (!outlineListEl) return;
    if (!outlineItems || outlineItems.length === 0) {
      outlineListEl.innerHTML = '<div class="py-10 text-center text-zinc-500 text-xs">Tài liệu không có mục lục</div>';
      return;
    }
    const html = renderTreeItems(outlineItems, 0, query);
    outlineListEl.innerHTML = html || '<div class="py-10 text-center text-zinc-500 text-xs">Không tìm thấy mục lục</div>';

    outlineListEl.querySelectorAll('.btn-outline-item').forEach((btn) => {
      btn.onclick = () => {
        const page = Number(btn.dataset.destPage);
        if (page && onJumpPage) {
          onJumpPage(page);
          closeSidebarDrawer();
        }
      };
    });
  };

  searchInput?.addEventListener('input', (e) => updateOutline(e.target.value));
  updateOutline();

  // Populate Thumbnails Grid placeholders
  if (thumbnailGridEl) {
    let gridHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      gridHtml += `
        <button type="button" data-thumbnail-page="${p}" 
          class="pdf-thumbnail-card group flex flex-col items-center p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-500/80 transition cursor-pointer ${p === currentPage ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}">
          <div class="relative w-full aspect-[1/1.41] bg-zinc-100 dark:bg-zinc-950 rounded-lg overflow-hidden flex items-center justify-center">
            <canvas id="thumbCanvas_${p}" class="w-full h-full object-contain hidden"></canvas>
            <div id="thumbPlaceholder_${p}" class="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center justify-center">
              tr. ${p}
            </div>
          </div>
          <span class="mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium">Trang ${p}</span>
        </button>
      `;
    }
    thumbnailGridEl.innerHTML = gridHtml;

    thumbnailGridEl.querySelectorAll('.pdf-thumbnail-card').forEach((card) => {
      card.addEventListener('click', () => {
        const p = Number(card.dataset.thumbnailPage);
        if (p && onJumpPage) {
          onJumpPage(p);
          updateActiveSidebarPage(p);
          closeSidebarDrawer();
        }
      });
    });

    // Lazy load thumbnails with IntersectionObserver
    if (thumbnailObserver) thumbnailObserver.disconnect();
    const container = document.getElementById('tabContentThumbnails');

    thumbnailObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-thumbnail-page'));
            if (pageNum && !renderedThumbnails.has(pageNum)) {
              renderSingleThumbnail(pageNum);
            }
          }
        });
      },
      { root: container, rootMargin: '200px 0px 200px 0px' }
    );

    thumbnailGridEl.querySelectorAll('.pdf-thumbnail-card').forEach((card) => {
      thumbnailObserver.observe(card);
    });
  }
}

async function renderSingleThumbnail(pageNum) {
  if (!activePdfDoc || renderedThumbnails.has(pageNum)) return;
  renderedThumbnails.add(pageNum);

  const canvas = document.getElementById(`thumbCanvas_${pageNum}`);
  const placeholder = document.getElementById(`thumbPlaceholder_${pageNum}`);
  if (!canvas) return;

  try {
    const page = await activePdfDoc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1.0 });
    const targetDim = 150;
    const scale = Math.min(targetDim / vp.width, (targetDim * 1.4) / vp.height);
    const thumbVp = page.getViewport({ scale });

    canvas.width = Math.floor(thumbVp.width);
    canvas.height = Math.floor(thumbVp.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    await page.render({ canvasContext: ctx, viewport: thumbVp }).promise;
    page.cleanup();

    placeholder?.classList.add('hidden');
    canvas.classList.remove('hidden');
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.warn(`Failed to render thumbnail for page ${pageNum}:`, err);
    }
  }
}

export function updateActiveSidebarPage(pageNum) {
  const cards = document.querySelectorAll('.pdf-thumbnail-card');
  cards.forEach((card) => {
    const p = Number(card.dataset.thumbnailPage);
    if (p === pageNum) {
      card.classList.add('ring-2', 'ring-indigo-500', 'border-indigo-500');
    } else {
      card.classList.remove('ring-2', 'ring-indigo-500', 'border-indigo-500');
    }
  });
}

// Backward Compatibility Aliases for PdfOutlineDrawer
export const renderOutlineDrawer = renderSidebarDrawer;
export const openOutlineDrawer = openSidebarDrawer;
export const closeOutlineDrawer = closeSidebarDrawer;
export const toggleOutlineDrawer = toggleSidebarDrawer;
export const attachOutlineListeners = (items, onJump) => {
  attachSidebarListeners({ outlineItems: items, onJumpPage: onJump });
};
