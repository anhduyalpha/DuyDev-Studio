/**
 * PdfCanvasViewer Component (< 230 lines)
 * Continuous Virtualized Canvas PDF Rendering Engine with Lazy Loading
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
    this.renderedPages = new Map(); // pageNum -> { canvas, renderTask }
    this.observer = null;
    this.nightMode = 'normal'; // 'normal' | 'dark' | 'sepia'
  }

  async loadDocument(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.totalPages = pdfDoc.numPages;

    const firstPage = await pdfDoc.getPage(1);
    const vp = firstPage.getViewport({ scale: 1.0 });
    this.basePageWidth = vp.width;
    this.baseAspectRatio = vp.height / vp.width;

    this.calcFitWidthScale();
    this.renderPlaceholders();
    this.initIntersectionObserver();
  }

  calcFitWidthScale() {
    const containerW = this.containerEl.clientWidth || window.innerWidth;
    const padding = containerW < 640 ? 16 : 48;
    const targetW = Math.max(300, Math.min(containerW - padding, 960));
    this.scale = targetW / this.basePageWidth;
  }

  renderPlaceholders() {
    const pageW = Math.round(this.basePageWidth * this.scale);
    const pageH = Math.round(pageW * this.baseAspectRatio);

    let html = `<div id="pdfPagesWrapper" class="flex flex-col items-center gap-4 transition-all duration-300">`;
    for (let i = 1; i <= this.totalPages; i++) {
      html += `
        <div id="pdfPageBox_${i}" data-page="${i}" class="pdf-page-box relative bg-white shadow-md dark:shadow-2xl rounded-xs overflow-hidden transition-all duration-200 border border-zinc-200/60 dark:border-transparent" 
          style="width: ${pageW}px; height: ${pageH}px;">
          <div class="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-mono text-xs select-none">
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
            // Free canvas memory if page scrolls far away (RAM optimization)
            this.unrenderPage(pageNum);
          }
        });

        // Determine current visible page based on scroll midpoint
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: this.scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.className = 'w-full h-full block select-none';

      ctx.scale(dpr, dpr);

      const renderTask = page.render({ canvasContext: ctx, viewport });
      this.renderedPages.set(pageNum, { canvas, renderTask });

      await renderTask.promise;
      box.innerHTML = '';
      box.appendChild(canvas);
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
    this.renderedPages.delete(pageNum);

    const box = document.getElementById(`pdfPageBox_${pageNum}`);
    if (box) {
      box.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center text-zinc-400 font-mono text-xs select-none">
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
    this.setScale(Math.min(this.scale * 1.25, 3.0));
  }

  zoomOut() {
    this.setScale(Math.max(this.scale / 1.25, 0.4));
  }

  zoomFit() {
    this.calcFitWidthScale();
    this.applyScaleUpdate();
  }

  setScale(newScale) {
    this.scale = newScale;
    this.applyScaleUpdate();
  }

  applyScaleUpdate() {
    this.renderedPages.forEach((item) => {
      try { item.renderTask?.cancel(); } catch {}
    });
    this.renderedPages.clear();
    this.renderPlaceholders();
    this.initIntersectionObserver();
    this.jumpToPage(this.currentPage);
  }

  toggleNightMode() {
    if (this.nightMode === 'normal') this.nightMode = 'dark';
    else if (this.nightMode === 'dark') this.nightMode = 'sepia';
    else this.nightMode = 'normal';
    this.applyNightModeFilter();
    return this.nightMode;
  }

  applyNightModeFilter() {
    const wrapper = document.getElementById('pdfPagesWrapper');
    if (!wrapper) return;
    if (this.nightMode === 'dark') {
      wrapper.style.filter = 'invert(0.9) hue-rotate(180deg) contrast(1.1) brightness(0.95)';
    } else if (this.nightMode === 'sepia') {
      wrapper.style.filter = 'sepia(0.4) contrast(0.95) brightness(0.98)';
    } else {
      wrapper.style.filter = 'none';
    }
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    this.renderedPages.forEach((item) => {
      try { item.renderTask?.cancel(); } catch {}
    });
    this.renderedPages.clear();
    this.pdfDoc = null;
  }
}
