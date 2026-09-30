/**
 * ImageRenderer Component (< 190 lines)
 * High-performance pan & zoom image viewer with SVG source code inspection toggle
 */

import { copyText } from '../../../../utilities/clipboard.js';
import { showToast } from '../../../../utilities/toast.js';

export function renderImageViewer(state) {
  const isSvg = state.name?.toLowerCase().endsWith('.svg') || state.mimeType === 'image/svg+xml';

  return `
    <div id="imageViewerWrapper" class="relative w-full h-full min-h-[350px] max-h-[75vh] flex flex-col items-center justify-center">
      ${isSvg ? `
        <!-- SVG Mode Toggle Header -->
        <div class="absolute top-2 left-3 z-30 flex items-center gap-1.5 p-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-white">
          <button id="btnSvgModeVector" type="button" class="px-2.5 py-1 rounded-md bg-white/20 text-white shadow-xs cursor-pointer transition">
            Xem Vector
          </button>
          <button id="btnSvgModeCode" type="button" class="px-2.5 py-1 rounded-md text-zinc-400 hover:text-white cursor-pointer transition">
            Mã nguồn SVG
          </button>
        </div>

        <button id="btnCopySvgCode" type="button" class="hidden absolute top-2 right-3 z-30 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-white items-center gap-1.5 transition cursor-pointer">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i> Sao chép
        </button>
      ` : ''}

      <!-- Vector / Image Canvas -->
      <div id="imageViewerContainer" class="relative w-full h-full min-h-[350px] max-h-[75vh] flex items-center justify-center overflow-hidden select-none bg-zinc-950/40 rounded-xl cursor-grab active:cursor-grabbing">
        <div id="imageLoadingSpinner" class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-xs z-10 transition-opacity duration-200">
          <i data-lucide="loader-2" class="w-8 h-8 text-indigo-400 animate-spin"></i>
        </div>
        
        <div id="imageViewport" class="transition-transform duration-100 ease-out origin-center flex items-center justify-center p-2">
          <img id="activePreviewImage" src="${state.viewUrl}" alt="${state.name}" class="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl pointer-events-none" />
        </div>

        <!-- Image Controls Floating Bar -->
        <div id="imageControlsBar" class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 shadow-xl text-white text-xs font-mono">
          <button id="btnZoomOut" type="button" class="p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer" title="Thu nhỏ">
            <i data-lucide="zoom-out" class="w-4 h-4"></i>
          </button>
          <span id="zoomLevelText" class="px-2 font-medium min-w-[50px] text-center">100%</span>
          <button id="btnZoomIn" type="button" class="p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer" title="Phóng to">
            <i data-lucide="zoom-in" class="w-4 h-4"></i>
          </button>
          <div class="w-px h-3.5 bg-white/20 mx-1"></div>
          <button id="btnResetZoom" type="button" class="px-2 py-1 rounded-lg hover:bg-white/10 transition text-[11px] cursor-pointer" title="Đặt lại">
            Reset
          </button>
        </div>
      </div>

      <!-- SVG Source Code Viewport (Initially hidden) -->
      ${isSvg ? `
        <div id="svgSourceContainer" class="hidden w-full h-full min-h-[350px] max-h-[75vh] overflow-auto custom-scrollbar p-3 rounded-xl bg-zinc-950 border border-white/10">
          <pre class="p-4 font-mono text-xs text-zinc-200 select-text leading-relaxed"><code id="svgSourceCode" class="hljs">Đang tải mã nguồn...</code></pre>
        </div>
      ` : ''}
    </div>
  `;
}

export function attachImageListeners(state, registerCleanup) {
  const container = document.getElementById('imageViewerContainer');
  const viewport = document.getElementById('imageViewport');
  const img = document.getElementById('activePreviewImage');
  const spinner = document.getElementById('imageLoadingSpinner');
  const zoomText = document.getElementById('zoomLevelText');
  const controlsBar = document.getElementById('imageControlsBar');

  const btnVector = document.getElementById('btnSvgModeVector');
  const btnCode = document.getElementById('btnSvgModeCode');
  const svgSourceContainer = document.getElementById('svgSourceContainer');
  const svgSourceCode = document.getElementById('svgSourceCode');
  const copyBtn = document.getElementById('btnCopySvgCode');

  let scale = 1.0;
  let posX = 0, posY = 0;
  let isDragging = false;
  let startX = 0, startY = 0;
  let rawSvgText = '';

  const updateTransform = () => {
    if (viewport) {
      viewport.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    }
    if (zoomText) zoomText.textContent = `${Math.round(scale * 100)}%`;
  };

  if (img) {
    img.onload = () => {
      if (spinner) spinner.classList.add('hidden');
    };
    img.onerror = () => {
      if (spinner) spinner.classList.add('hidden');
      if (container) {
        container.innerHTML = `
          <div class="py-12 text-center text-zinc-400 space-y-2">
            <i data-lucide="image-off" class="w-10 h-10 mx-auto text-red-400 stroke-[1.5]"></i>
            <p class="text-xs">Không thể tải trước ảnh.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons({ root: container });
      }
    };
  }

  // Zoom controls
  document.getElementById('btnZoomIn')?.addEventListener('click', () => {
    scale = Math.min(5.0, scale + 0.25);
    updateTransform();
  });
  document.getElementById('btnZoomOut')?.addEventListener('click', () => {
    scale = Math.max(0.2, scale - 0.25);
    updateTransform();
  });
  document.getElementById('btnResetZoom')?.addEventListener('click', () => {
    scale = 1.0; posX = 0; posY = 0;
    updateTransform();
  });

  // Mouse wheel zoom
  container?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    scale = Math.min(5.0, Math.max(0.2, scale + delta));
    updateTransform();
  }, { passive: false });

  // Pan / Drag
  container?.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX - posX;
    startY = e.clientY - posY;
  });

  const onMouseMove = (e) => {
    if (!isDragging) return;
    posX = e.clientX - startX;
    posY = e.clientY - startY;
    updateTransform();
  };

  const onMouseUp = () => {
    isDragging = false;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  if (registerCleanup) {
    registerCleanup(() => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    });
  }

  // SVG Mode switching
  if (btnVector && btnCode) {
    btnVector.onclick = () => {
      container?.classList.remove('hidden');
      controlsBar?.classList.remove('hidden');
      svgSourceContainer?.classList.add('hidden');
      copyBtn?.classList.add('hidden');
      copyBtn?.classList.remove('flex');
      btnVector.className = 'px-2.5 py-1 rounded-md bg-white/20 text-white shadow-xs cursor-pointer transition';
      btnCode.className = 'px-2.5 py-1 rounded-md text-zinc-400 hover:text-white cursor-pointer transition';
    };

    btnCode.onclick = async () => {
      container?.classList.add('hidden');
      controlsBar?.classList.add('hidden');
      svgSourceContainer?.classList.remove('hidden');
      copyBtn?.classList.remove('hidden');
      copyBtn?.classList.add('flex');
      btnCode.className = 'px-2.5 py-1 rounded-md bg-white/20 text-white shadow-xs cursor-pointer transition';
      btnVector.className = 'px-2.5 py-1 rounded-md text-zinc-400 hover:text-white cursor-pointer transition';

      if (!rawSvgText) {
        try {
          const fetchPromise = (state.rawFile instanceof Blob)
            ? state.rawFile.text()
            : fetch(state.viewUrl).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
              });
          rawSvgText = await fetchPromise;
          if (svgSourceCode) {
            if (window.hljs && rawSvgText.length <= 500000) {
              try {
                svgSourceCode.innerHTML = window.hljs.highlight(rawSvgText, { language: 'xml' }).value;
              } catch {
                svgSourceCode.textContent = rawSvgText;
              }
            } else {
              svgSourceCode.textContent = rawSvgText;
            }
          }
        } catch (err) {
          if (svgSourceCode) svgSourceCode.textContent = `Lỗi đọc mã SVG: ${err.message}`;
        }
      }
    };

    copyBtn?.addEventListener('click', async () => {
      if (!rawSvgText) return;
      const ok = await copyText(rawSvgText);
      showToast(ok ? 'Đã sao chép mã SVG' : 'Lỗi sao chép', ok ? 'success' : 'error');
    });
  }
}
