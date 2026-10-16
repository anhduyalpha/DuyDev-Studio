/**
 * PdfCanvasViewer Component (< 280 lines)
 * Continuous Virtualized Canvas Engine with Dynamic Aspect Ratio, TextLayer & Gestures
 */

export class PdfCanvasViewer {
  constructor(containerEl, onPageChange) {
    this.containerEl = containerEl;
    this.onPageChange = onPageChange;
    this.pdfDoc = null;
    this.totalPages = 0;
    this.currentPage = 1;
    this.scale = 1.0;
    this.baseAspectRatio = 1.414; // Default A4
    this.basePageWidth = 595;
    this.rotation = 0; // 0, 90, 180, 270 deg
    this.pageDimensions = new Map(); // pageNum -> { width: number, height: number, ratio: number }
    this.renderedPages = new Map(); // pageNum -> { canvas, renderTask, textLayerDiv, textTask, page }
    this.observer = null;
    this.nightMode = 'normal'; // 'normal' | 'dark' | 'sepia'
    this.zoomDebounceTimer = null;
    this.touchPinch = null;
    this.boundWheel = null;
    this.boundTouchStart = null;
    this.boundTouchMove = null;
    this.boundTouchEnd = null;
  }

  async loadDocument(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.totalPages = pdfDoc.numPages;
    this.pageDimensions.clear();

    // 1. Pre-query dimensions for Page 1 for initial viewport calculations
    const firstPage = await pdfDoc.getPage(1);
    const firstVp = firstPage.getViewport({ scale: 1.0, rotation: this.rotation });
    this.basePageWidth = firstVp.width;
    this.baseAspectRatio = firstVp.height / firstVp.width;
    this.pageDimensions.set(1, {
      width: firstVp.width,
      height: firstVp.height,
      ratio: this.baseAspectRatio
    });

    // 2. Pre-query dimensions for remaining pages concurrently in batches
    const batchSize = 25;
    for (let b = 2; b <= this.totalPages; b += batchSize) {
      const batchPromises = [];
      const end = Math.min(b + batchSize - 1, this.totalPages);
      for (let p = b; p <= end; p++) {
        batchPromises.push(
          pdfDoc.getPage(p).then((page) => {
            const vp = page.getViewport({ scale: 1.0, rotation: this.rotation });
            this.pageDimensions.set(p, {
              width: vp.width,
              height: vp.height,
              ratio: vp.height / vp.width
            });
          }).catch(() => {
            this.pageDimensions.set(p, {
              width: this.basePageWidth,
              height: this.basePageWidth * this.baseAspectRatio,
              ratio: this.baseAspectRatio
            });
          })
        );
      }
      await Promise.all(batchPromises);
    }

    this.calcFitWidthScale();
    this.renderPlaceholders();
    this.initIntersectionObserver();
    this.initGestureListeners();
  }

  calcFitWidthScale() {
    const containerW = this.containerEl.clientWidth || window.innerWidth;
    const padding = containerW < 640 ? 16 : 48;
    const targetW = Math.max(300, Math.min(containerW - padding, 960));
    this.scale = targetW / this.basePageWidth;
  }

  renderPlaceholders() {
    let html = `<div id="pdfPagesWrapper" class="flex flex-col items-center gap-4 transition-transform duration-150 origin-top">`;
    for (let i = 1; i <= this.totalPages; i++) {
      const dims = this.pageDimensions.get(i) || {
        width: this.basePageWidth,
        height: this.basePageWidth * this.baseAspectRatio,
        ratio: this.baseAspectRatio
      };
      const pageW = Math.round(dims.width * this.scale);
      const pageH = Math.round(dims.height * this.scale);

      html += `
        <div id="pdfPageBox_${i}" data-page="${i}" class="pdf-page-box relative bg-white shadow-md dark:shadow-2xl rounded-xs overflow-hidden transition-all duration-200 border border-zinc-200/60 dark:border-transparent select-text" 
          style="width: ${pageW}px; height: ${pageH}px;">
          <div class="pdf-placeholder absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-mono text-xs select-none pointer-events-none">
            Trang ${i}
          </div>
        </div>
      `;
    }
    html += `</div>`;
    this.containerEl.innerHTML = html;
    this.applyNightModeFilter();
  }

  initIntersectionObserver() {
    if (this.observer) this.observer.disconnect();

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = Number(entry.target.getAttribute('data-page'));
          if (entry.isIntersecting) {
            this.renderPage(pageNum);
          } else {
            this.unrenderPage(pageNum);
          }
        });

        // Determine visible page based on scroll midpoint
        const boxes = this.containerEl.querySelectorAll('.pdf-page-box');
        const containerMid = this.containerEl.scrollTop + this.containerEl.clientHeight / 2;
        for (const box of boxes) {
          const top = box.offsetTop;
          const bottom = top + box.offsetHeight;
          if (top <= containerMid && bottom >= containerMid) {
            const current = Number(box.getAttribute('data-page'));
            if (current && current !== this.currentPage) {
              this.currentPage = current;
              if (this.onPageChange) this.onPageChange(current, this.totalPages);
            }
            break;
          }
        }
      },
      { root: this.containerEl, rootMargin: '300px 0px 300px 0px' }
    );

    this.containerEl.querySelectorAll('.pdf-page-box').forEach((el) => this.observer.observe(el));
  }

  async renderPage(pageNum) {
    if (this.renderedPages.has(pageNum)) return;
    const box = document.getElementById(`pdfPageBox_${pageNum}`);
    if (!box || !this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });

      // Guard against canvas dimension overflow on high-DPI / mobile
      const maxDim = 4096;
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (viewport.width * dpr > maxDim || viewport.height * dpr > maxDim) {
        dpr = Math.max(0.5, Math.min(maxDim / viewport.width, maxDim / viewport.height, 1));
      }

      // 1. Prepare Hi-DPI Canvas Layer
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.className = 'pdf-canvas absolute inset-0 w-full h-full block select-none pointer-events-none z-1';
      ctx.scale(dpr, dpr);

      // 2. Prepare Selectable Text Layer
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer select-text';
      textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
      textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
      textLayerDiv.style.setProperty('--scale-factor', viewport.scale);

      const renderTask = page.render({ canvasContext: ctx, viewport });
      const record = { canvas, renderTask, textLayerDiv, textTask: null, page };
      this.renderedPages.set(pageNum, record);

      await renderTask.promise;

      // 3. Render PDF.js Text Layer overlay
      const textContent = await page.getTextContent();
      const pdfjsLib = window.pdfjsLib;
      if (pdfjsLib && this.renderedPages.has(pageNum)) {
        if (typeof pdfjsLib.renderTextLayer === 'function') {
          const textTask = pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
          });
          record.textTask = textTask;
          await textTask.promise;
        } else if (pdfjsLib.TextLayer) {
          const tl = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport
          });
          record.textTask = tl;
          await tl.render();
        }
      }

      box.innerHTML = '';
      box.appendChild(canvas);
      box.appendChild(textLayerDiv);
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') {
        console.warn(`Render error on page ${pageNum}:`, e);
      }
    }
  }

  unrenderPage(pageNum) {
    const item = this.renderedPages.get(pageNum);
    if (!item) return;

    try { item.renderTask?.cancel(); } catch {}
    try { item.textTask?.cancel?.(); } catch {}
    try { item.page?.cleanup(); } catch {}
    this.renderedPages.delete(pageNum);

    const box = document.getElementById(`pdfPageBox_${pageNum}`);
    if (box) {
      box.innerHTML = `
        <div class="pdf-placeholder absolute inset-0 flex items-center justify-center text-zinc-400 font-mono text-xs select-none pointer-events-none">
          Trang ${pageNum}
        </div>
      `;
    }
  }

  jumpToPage(pageNum) {
    const target = Math.max(1, Math.min(pageNum, this.totalPages));
    const box = document.getElementById(`pdfPageBox_${target}`);
    if (box) {
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.currentPage = target;
      if (this.onPageChange) this.onPageChange(target, this.totalPages);
    }
  }

  zoomIn() {
    this.setScale(Math.min(this.scale * 1.25, 3.5));
  }

  zoomOut() {
    this.setScale(Math.max(this.scale / 1.25, 0.4));
  }

  zoomFit() {
    this.calcFitWidthScale();
    this.applyScaleUpdate();
  }

  setScale(newScale) {
    const targetScale = Math.max(0.4, Math.min(newScale, 3.5));
    const wrapper = document.getElementById('pdfPagesWrapper');

    // Flicker-Free Zoom: Apply CSS preview scale immediately
    if (wrapper) {
      const previewRatio = targetScale / this.scale;
      wrapper.style.transform = `scale(${previewRatio})`;
    }

    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    this.zoomDebounceTimer = setTimeout(() => {
      this.scale = targetScale;
      if (wrapper) wrapper.style.transform = 'none';
      this.applyScaleUpdate();
    }, 150);
  }

  applyScaleUpdate() {
    this.renderedPages.forEach((item) => {
      try { item.renderTask?.cancel(); } catch {}
      try { item.textTask?.cancel?.(); } catch {}
      try { item.page?.cleanup(); } catch {}
    });
    this.renderedPages.clear();
    this.renderPlaceholders();
    this.initIntersectionObserver();
    this.jumpToPage(this.currentPage);
  }

  rotateClockwise() {
    this.rotation = (this.rotation + 90) % 360;
    // Update dimensions map with rotated coordinates
    this.pageDimensions.forEach((dim, pageNum) => {
      this.pageDimensions.set(pageNum, {
        width: dim.height,
        height: dim.width,
        ratio: dim.width / dim.height
      });
    });
    const oldBaseWidth = this.basePageWidth;
    this.basePageWidth = this.basePageWidth * this.baseAspectRatio;
    this.baseAspectRatio = oldBaseWidth / this.basePageWidth;

    this.calcFitWidthScale();
    this.applyScaleUpdate();
  }

  toggleNightMode() {
    if (this.nightMode === 'normal') this.nightMode = 'sepia';
    else if (this.nightMode === 'sepia') this.nightMode = 'dark';
    else this.nightMode = 'normal';
    this.applyNightModeFilter();
    return this.nightMode;
  }

  setNightMode(mode) {
    this.nightMode = mode || 'normal';
    this.applyNightModeFilter();
  }

  applyNightModeFilter() {
    const wrapper = document.getElementById('pdfPagesWrapper');
    if (!wrapper) return;
    wrapper.classList.remove('pdf-mode-sepia', 'pdf-mode-dark');
    if (this.nightMode === 'dark') {
      wrapper.classList.add('pdf-mode-dark');
    } else if (this.nightMode === 'sepia') {
      wrapper.classList.add('pdf-mode-sepia');
    }
  }

  initGestureListeners() {
    // 1. Ctrl + Wheel Zoom
    this.boundWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.setScale(this.scale * zoomFactor);
    };
    this.containerEl.addEventListener('wheel', this.boundWheel, { passive: false });

    // 2. Mobile 2-Finger Pinch-to-Zoom
    this.boundTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.touchPinch = {
          startDist: Math.hypot(dx, dy),
          initialScale: this.scale
        };
      }
    };

    this.boundTouchMove = (e) => {
      if (e.touches.length === 2 && this.touchPinch) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const ratio = currentDist / this.touchPinch.startDist;
        const wrapper = document.getElementById('pdfPagesWrapper');
        if (wrapper) wrapper.style.transform = `scale(${ratio})`;
      }
    };

    this.boundTouchEnd = (e) => {
      if (this.touchPinch && e.touches.length < 2) {
        const wrapper = document.getElementById('pdfPagesWrapper');
        if (wrapper && wrapper.style.transform) {
          const match = wrapper.style.transform.match(/scale\(([^)]+)\)/);
          if (match && match[1]) {
            const finalRatio = parseFloat(match[1]);
            if (!isNaN(finalRatio)) {
              this.setScale(this.touchPinch.initialScale * finalRatio);
            }
          }
        }
        this.touchPinch = null;
      }
    };

    this.containerEl.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.containerEl.addEventListener('touchmove', this.boundTouchMove, { passive: true });
    this.containerEl.addEventListener('touchend', this.boundTouchEnd, { passive: true });
  }

  destroy() {
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    if (this.observer) this.observer.disconnect();

    if (this.boundWheel) {
      this.containerEl.removeEventListener('wheel', this.boundWheel);
    }
    if (this.boundTouchStart) {
      this.containerEl.removeEventListener('touchstart', this.boundTouchStart);
    }
    if (this.boundTouchMove) {
      this.containerEl.removeEventListener('touchmove', this.boundTouchMove);
    }
    if (this.boundTouchEnd) {
      this.containerEl.removeEventListener('touchend', this.boundTouchEnd);
    }

    this.renderedPages.forEach((item) => {
      try { item.renderTask?.cancel(); } catch {}
      try { item.textTask?.cancel?.(); } catch {}
      try { item.page?.cleanup(); } catch {}
    });
    this.renderedPages.clear();
    this.pageDimensions.clear();

    try { this.pdfDoc?.destroy(); } catch {}
    this.pdfDoc = null;
  }
}
