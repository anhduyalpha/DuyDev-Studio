/**
 * PdfFloatingDock Component (< 160 lines)
 * Floating Glassmorphic HUD (Dynamic Island style) for document controls
 */

export function renderFloatingDock(currentPage = 1, totalPages = 1, zoomPct = 100) {
  return `
    <div id="pdfFloatingDock" class="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 
      px-2 sm:px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-[#101014]/90 backdrop-blur-md border border-zinc-200/90 dark:border-white/10 text-zinc-800 dark:text-zinc-200 shadow-xl dark:shadow-2xl 
      flex items-center gap-1 sm:gap-2 opacity-95 hover:opacity-100 transition-all duration-200 select-none">
      
      <!-- Outline / Table of Contents Toggle -->
      <button id="btnPdfToggleOutline" type="button" title="Mục lục" 
        class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
        <i data-lucide="list" class="w-4 h-4"></i>
      </button>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5"></div>

      <!-- Page Stepper -->
      <div class="flex items-center gap-1">
        <button id="btnPdfPrevPage" type="button" title="Trang trước" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
          <i data-lucide="chevron-left" class="w-4 h-4"></i>
        </button>

        <div class="flex items-center gap-1 px-1">
          <input id="inputPdfCurrentPage" type="text" inputmode="numeric" value="${currentPage}" 
            class="w-8 sm:w-10 text-center py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.08] border border-zinc-200 dark:border-white/15 text-xs font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 transition" />
          <span class="text-xs text-zinc-400 dark:text-zinc-500 font-mono">/</span>
          <span id="pdfTotalPagesLabel" class="text-xs text-zinc-500 dark:text-zinc-400 font-mono">${totalPages}</span>
        </div>

        <button id="btnPdfNextPage" type="button" title="Trang kế" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none">
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5"></div>

      <!-- Zoom Controls -->
      <div class="flex items-center gap-0.5 sm:gap-1">
        <button id="btnPdfZoomOut" type="button" title="Thu nhỏ" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="minus" class="w-3.5 h-3.5"></i>
        </button>

        <button id="btnPdfZoomFit" type="button" title="Vừa trang" 
          class="min-h-[40px] px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-[11px] font-mono font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <span id="pdfZoomPctLabel">${zoomPct}%</span>
        </button>

        <button id="btnPdfZoomIn" type="button" title="Phóng to" 
          class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5"></div>

      <!-- Night Mode Toggle (Normal -> Dark Invert -> Sepia) -->
      <button id="btnPdfNightMode" type="button" title="Chế độ đọc ban đêm" 
        class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 flex items-center justify-center transition cursor-pointer">
        <i data-lucide="moon" class="w-4 h-4"></i>
      </button>

      <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-0.5"></div>

      <!-- Fullscreen Toggle -->
      <button id="btnPdfFullscreen" type="button" title="Toàn màn hình" 
        class="min-w-[40px] min-h-[40px] p-2 rounded-xl hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-white/10 dark:active:bg-white/15 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition cursor-pointer">
        <i data-lucide="maximize" class="w-4 h-4"></i>
      </button>
    </div>
  `;
}

export function attachFloatingDockListeners({ onPrev, onNext, onJump, onZoomIn, onZoomOut, onZoomFit, onToggleOutline, onToggleNight, onToggleFullscreen }) {
  document.getElementById('btnPdfPrevPage')?.addEventListener('click', onPrev);
  document.getElementById('btnPdfNextPage')?.addEventListener('click', onNext);
  document.getElementById('btnPdfZoomOut')?.addEventListener('click', onZoomOut);
  document.getElementById('btnPdfZoomIn')?.addEventListener('click', onZoomIn);
  document.getElementById('btnPdfZoomFit')?.addEventListener('click', onZoomFit);
  document.getElementById('btnPdfToggleOutline')?.addEventListener('click', onToggleOutline);
  document.getElementById('btnPdfNightMode')?.addEventListener('click', onToggleNight);

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
