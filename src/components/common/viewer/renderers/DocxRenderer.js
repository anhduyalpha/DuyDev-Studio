/**
 * DocxRenderer Component (< 190 lines)
 * Client-Side Offline-First Word (.docx, .dotx) Document Renderer using docx-preview
 */

import { ensureDocxLoaded } from '../../../../utilities/docxHelper.js';
import { formatBytes } from '../../../../utilities/formatters.js';

export function renderDocxViewer(state) {
  return `
    <div id="docxViewerRoot" class="flex-1 flex flex-col min-h-[350px] max-h-[82vh] relative overflow-hidden bg-zinc-100 dark:bg-[#0d0d10] rounded-xl border border-zinc-200 dark:border-white/[0.06]">
      <!-- Top Action Toolbar -->
      <div class="px-4 py-2 border-b border-zinc-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 bg-white/80 dark:bg-[#121215]/90 backdrop-blur-xs shrink-0 z-10">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            DOCX
          </span>
          <span id="docxMetaInfo" class="text-xs font-mono text-zinc-500 dark:text-zinc-400">Đang chuẩn bị...</span>
        </div>

        <div class="flex items-center gap-1.5 font-mono text-xs">
          <!-- Zoom Controls -->
          <button id="btnDocxZoomOut" type="button" class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 transition cursor-pointer" title="Thu nhỏ">
            <i data-lucide="zoom-out" class="w-3.5 h-3.5"></i>
          </button>
          <span id="docxZoomText" class="px-1.5 font-medium min-w-[45px] text-center text-zinc-700 dark:text-zinc-300">100%</span>
          <button id="btnDocxZoomIn" type="button" class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 transition cursor-pointer" title="Phóng to">
            <i data-lucide="zoom-in" class="w-3.5 h-3.5"></i>
          </button>
          <div class="w-px h-3.5 bg-zinc-200 dark:bg-white/10 mx-1"></div>

          <!-- Page Break Toggle -->
          <button id="btnToggleDocxFlow" type="button" class="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold transition cursor-pointer" title="Chuyển chế độ xem">
            Trang
          </button>

          <!-- Print Button -->
          <button id="btnDocxPrint" type="button" class="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 transition cursor-pointer" title="In tài liệu">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <!-- Loading Spinner -->
      <div id="docxLoading" class="my-auto py-16 text-center space-y-3">
        <div class="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center mx-auto">
          <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
        </div>
        <p class="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">Đang đọc tài liệu Word...</p>
      </div>

      <!-- Render Container -->
      <div id="docxScrollWrapper" class="flex-1 overflow-auto custom-scrollbar p-3 sm:p-6 flex justify-center hidden">
        <div id="docxRenderContainer" class="docx-preview-host origin-top transition-transform duration-100 max-w-full"></div>
      </div>
    </div>
  `;
}

export function attachDocxListeners(state, registerCleanup) {
  const abortController = new AbortController();
  registerCleanup(() => abortController.abort());

  const container = document.getElementById('docxRenderContainer');
  const scrollWrapper = document.getElementById('docxScrollWrapper');
  const loading = document.getElementById('docxLoading');
  const metaInfo = document.getElementById('docxMetaInfo');
  const zoomText = document.getElementById('docxZoomText');
  const btnZoomIn = document.getElementById('btnDocxZoomIn');
  const btnZoomOut = document.getElementById('btnDocxZoomOut');
  const btnToggleFlow = document.getElementById('btnToggleDocxFlow');
  const btnPrint = document.getElementById('btnDocxPrint');

  let scale = 1.0;
  let isPaginated = true;
  let fileBuffer = null;

  // Dedicated print style to ensure clean document printing
  const printStyleEl = document.createElement('style');
  printStyleEl.id = 'docxPrintStyle';
  printStyleEl.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #fileViewerCoreModal, #docxViewerRoot, #docxScrollWrapper, #docxRenderContainer, #docxRenderContainer * {
        visibility: visible !important;
      }
      #docxViewerRoot {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        background: white !important;
        border: none !important;
        overflow: visible !important;
      }
      #docxScrollWrapper {
        overflow: visible !important;
        padding: 0 !important;
        display: block !important;
      }
      #docxRenderContainer {
        transform: none !important;
        margin: 0 auto !important;
      }
    }
  `;
  document.head.appendChild(printStyleEl);
  registerCleanup(() => printStyleEl.remove());

  const updateZoom = () => {
    if (container) {
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = 'top center';
    }
    if (zoomText) zoomText.textContent = `${Math.round(scale * 100)}%`;
  };

  btnZoomIn?.addEventListener('click', () => {
    scale = Math.min(2.0, Math.round((scale + 0.1) * 10) / 10);
    updateZoom();
  });

  btnZoomOut?.addEventListener('click', () => {
    scale = Math.max(0.5, Math.round((scale - 0.1) * 10) / 10);
    updateZoom();
  });

  btnPrint?.addEventListener('click', () => {
    window.print();
  });

  async function renderDocxContent() {
    if (!fileBuffer || !window.docx || !container) return;
    container.innerHTML = '';
    await window.docx.renderAsync(fileBuffer, container, null, {
      inWrapper: true,
      breakPages: isPaginated,
      ignoreWidth: false,
      ignoreHeight: false
    });

    // Apply clean A4 styling
    const sections = container.querySelectorAll('section.docx');
    sections.forEach((sec) => {
      sec.style.boxShadow = '0 4px 24px rgba(0,0,0,0.12)';
      sec.style.marginBottom = '24px';
      sec.style.background = '#ffffff';
      sec.style.color = '#111827';
    });

    if (metaInfo) {
      metaInfo.textContent = `${sections.length || 1} trang • ${formatBytes(fileBuffer.byteLength)}`;
    }
  }

  btnToggleFlow?.addEventListener('click', async () => {
    if (!fileBuffer || !window.docx || !container) return;
    try {
      isPaginated = !isPaginated;
      if (btnToggleFlow) btnToggleFlow.textContent = isPaginated ? 'Trang' : 'Cuộn';
      await renderDocxContent();
    } catch (err) {
      console.error('Lỗi khi chuyển đổi chế độ xem DOCX:', err);
    }
  });

  async function loadAndRender() {
    try {
      await ensureDocxLoaded();

      if (state.rawFile instanceof Blob) {
        fileBuffer = await state.rawFile.arrayBuffer();
      } else {
        const res = await fetch(state.viewUrl, { signal: abortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fileBuffer = await res.arrayBuffer();
      }

      await renderDocxContent();
      if (loading) loading.classList.add('hidden');
      if (scrollWrapper) scrollWrapper.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (scrollWrapper) scrollWrapper.classList.add('hidden');
      if (loading) {
        loading.classList.remove('hidden');
        const dlUrl = state.downloadUrl || state.viewUrl || '#';
        loading.innerHTML = `
          <div class="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto">
            <i data-lucide="alert-circle" class="w-5 h-5"></i>
          </div>
          <p class="font-mono text-xs font-semibold text-red-500">${err.message || 'Không thể đọc tệp Word'}</p>
          <div class="pt-2">
            <a href="${dlUrl}" download="${state.name}" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5">
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
