/**
 * PdfFloatingDock Component (< 190 lines)
 * Floating Glassmorphic iOS HUD Dock for Document Navigation & Tools
 */

export function renderFloatingDock(currentPage = 1, totalPages = 1, zoomPct = 100) {
  return `
    <div id="pdfFloatingDock" class="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 
      px-2 sm:px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-[#101014]/90 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 text-zinc-800 dark:text-zinc-200 shadow-xl dark:shadow-2xl 
      flex items-center gap-1 sm:gap-1.5 opacity-95 hover:opacity-100 transition-all duration-200 select-none max-w-[96vw] overflow-x-auto no-scrollbar">
      
      <!-- Group 1: Sidebar Drawer & In-Doc Search -->
      <div class="flex items-center gap-0.5">
        <button id="btnPdfToggleSidebar" type="button" title="Mục lục & Trang thu nhỏ" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="panel-left" class="w-4 h-4"></i>
        </button>

        <button id="btnPdfToggleSearch" type="button" title="Tìm kiếm (Ctrl+F)" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="search" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5 shrink-0"></div>

      <!-- Group 2: Page Stepper -->
      <div class="flex items-center gap-0.5 sm:gap-1">
        <button id="btnPdfPrevPage" type="button" title="Trang trước (←)" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
          <i data-lucide="chevron-left" class="w-4 h-4"></i>
        </button>

        <div class="flex items-center gap-1 px-1">
          <input id="inputPdfCurrentPage" type="text" inputmode="numeric" value="${currentPage}" 
            class="w-8 sm:w-10 text-center py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.08] border border-zinc-200 dark:border-white/15 text-xs font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition" />
          <span class="text-xs text-zinc-400 dark:text-zinc-500 font-mono">/</span>
          <span id="pdfTotalPagesLabel" class="text-xs text-zinc-500 dark:text-zinc-400 font-mono">${totalPages}</span>
        </div>

        <button id="btnPdfNextPage" type="button" title="Trang kế (→)" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5 shrink-0"></div>

      <!-- Group 3: Zoom Controls -->
      <div class="flex items-center gap-0.5">
        <button id="btnPdfZoomOut" type="button" title="Thu nhỏ (Ctrl+-)" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="minus" class="w-3.5 h-3.5"></i>
        </button>

        <button id="btnPdfZoomFit" type="button" title="Vừa chiều rộng (Ctrl+0)" 
          class="min-h-[40px] px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-[11px] font-mono font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <span id="pdfZoomPctLabel">${zoomPct}%</span>
        </button>

        <button id="btnPdfZoomIn" type="button" title="Phóng to (Ctrl++)" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5 shrink-0"></div>

      <!-- Group 4: Tools (Rotate, Eye-Care, Print, Fullscreen) -->
      <div class="flex items-center gap-0.5">
        <button id="btnPdfRotate" type="button" title="Xoay hướng xem 90°" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="rotate-cw" class="w-4 h-4"></i>
        </button>

        <button id="btnPdfNightMode" type="button" title="Chế độ đọc (Sáng / Sepia / Tối)" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 flex items-center justify-center transition cursor-pointer">
          <i data-lucide="moon" class="w-4 h-4"></i>
        </button>

        <button id="btnPdfPrint" type="button" title="In tài liệu (Ctrl+P)" 
          class="hidden sm:flex min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white items-center justify-center transition cursor-pointer">
          <i data-lucide="printer" class="w-4 h-4"></i>
        </button>

        <button id="btnPdfFullscreen" type="button" title="Toàn màn hình" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="maximize" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

export function attachFloatingDockListeners({
  onPrev,
  onNext,
  onJump,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onToggleSidebar,
  onToggleOutline,
  onToggleSearch,
  onRotate,
  onToggleNight,
  onPrint,
  onToggleFullscreen,
  scrollHost
}) {
  const dock = document.getElementById('pdfFloatingDock');
  const sidebarHandler = onToggleSidebar || onToggleOutline;

  document.getElementById('btnPdfPrevPage')?.addEventListener('click', onPrev);
  document.getElementById('btnPdfNextPage')?.addEventListener('click', onNext);
  document.getElementById('btnPdfZoomOut')?.addEventListener('click', onZoomOut);
  document.getElementById('btnPdfZoomIn')?.addEventListener('click', onZoomIn);
  document.getElementById('btnPdfZoomFit')?.addEventListener('click', onZoomFit);
  document.getElementById('btnPdfToggleSidebar')?.addEventListener('click', sidebarHandler);
  document.getElementById('btnPdfToggleSearch')?.addEventListener('click', onToggleSearch);
  document.getElementById('btnPdfRotate')?.addEventListener('click', onRotate);
  document.getElementById('btnPdfNightMode')?.addEventListener('click', onToggleNight);

  const btnPrint = document.getElementById('btnPdfPrint');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      if (onPrint) onPrint();
      else window.print();
    });
  }

  const btnFullscreen = document.getElementById('btnPdfFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (onToggleFullscreen) {
        onToggleFullscreen();
        return;
      }
      const viewerRoot = document.getElementById('pdfViewerRoot') || document.documentElement;
      if (!document.fullscreenElement) {
        viewerRoot.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });

    const handleFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement);
      btnFullscreen.setAttribute('title', isFull ? 'Thu nhỏ' : 'Toàn màn hình');
      btnFullscreen.innerHTML = `<i data-lucide="${isFull ? 'minimize' : 'maximize'}" class="w-4 h-4"></i>`;
      if (window.lucide) window.lucide.createIcons({ root: btnFullscreen });
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  }

  // Page input jump
  const inputPage = document.getElementById('inputPdfCurrentPage');
  if (inputPage) {
    inputPage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseInt(inputPage.value, 10);
        if (!isNaN(val) && onJump) onJump(val);
        inputPage.blur();
      }
    });
    inputPage.addEventListener('blur', () => {
      const val = parseInt(inputPage.value, 10);
      if (!isNaN(val) && onJump) onJump(val);
    });
  }

  // Opacity fade on fast scroll
  if (scrollHost && dock) {
    let scrollTimeout = null;
    scrollHost.addEventListener('scroll', () => {
      dock.classList.add('opacity-40');
      dock.classList.remove('opacity-95');
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        dock.classList.remove('opacity-40');
        dock.classList.add('opacity-95');
      }, 350);
    }, { passive: true });
  }
}

export function updateFloatingDockState({ currentPage, totalPages, zoomPct, nightMode }) {
  const inputPage = document.getElementById('inputPdfCurrentPage');
  const labelTotal = document.getElementById('pdfTotalPagesLabel');
  const labelZoom = document.getElementById('pdfZoomPctLabel');
  const btnPrev = document.getElementById('btnPdfPrevPage');
  const btnNext = document.getElementById('btnPdfNextPage');
  const btnNight = document.getElementById('btnPdfNightMode');

  if (inputPage && document.activeElement !== inputPage && currentPage !== undefined) {
    inputPage.value = currentPage;
  }
  if (labelTotal && totalPages !== undefined) labelTotal.textContent = totalPages;
  if (labelZoom && zoomPct !== undefined) labelZoom.textContent = `${Math.round(zoomPct)}%`;
  if (btnPrev && currentPage !== undefined) btnPrev.disabled = currentPage <= 1;
  if (btnNext && currentPage !== undefined && totalPages !== undefined) btnNext.disabled = currentPage >= totalPages;

  if (btnNight && nightMode !== undefined) {
    const iconName = nightMode === 'dark' ? 'sun' : nightMode === 'sepia' ? 'coffee' : 'moon';
    btnNight.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
    if (window.lucide) window.lucide.createIcons({ root: btnNight });
  }
}
