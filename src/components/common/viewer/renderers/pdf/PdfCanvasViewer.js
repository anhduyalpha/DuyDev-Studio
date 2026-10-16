/**
 * PdfCanvasViewer Component (< 280 lines)
 * Continuous Virtualized Canvas Engine with Dynamic Aspect Ratio, TextLayer & Gestures
 */

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class PdfCanvasViewer {
  constructor(containerEl, onPageChange, onScaleChange = null) {
    this.containerEl = containerEl;
    this.onPageChange = onPageChange;
    this.onScaleChange = onScaleChange;
    this.pdfDoc = null;
    this.totalPages = 0;
    this.currentPage = 1;
    this.scale = 1.0;
    this.baseAspectRatio = 1.414; // Default A4
    this.basePageWidth = 595;
    this.rotation = 0; // 0, 90, 180, 270 deg
    this.pageDimensions = new Map(); // pageNum -> { width: number, height: number, ratio: number, rotate?: number }
    this.renderedPages = new Map(); // pageNum -> { canvas, renderTask, textLayerDiv, textTask, page }
    this.observer = null;
    this.nightMode = 'normal'; // 'normal' | 'dark' | 'sepia'
    this.zoomDebounceTimer = null;
    this.touchPinch = null;
    this.boundWheel = null;
    this.boundTouchStart = null;
    this.boundTouchMove = null;
    this.boundTouchEnd = null;

    // Navigation lock state to prevent conflicting IntersectionObserver midpoint detections
    this.isNavigating = false;
    this.targetNavPage = null;
    this.navigationTimer = null;

    // Search highlights state
    this.searchMatches = [];
    this.activeSearchMatch = null;
    this.searchQuery = '';
  }

  async loadDocument(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.totalPages = pdfDoc.numPages;
    this.pageDimensions.clear();

    // 1. Pre-query dimensions for Page 1 for initial viewport calculations
    const firstPage = await pdfDoc.getPage(1);
    const initialRot = ((firstPage.rotate || 0) + this.rotation) % 360;
    const firstVp = firstPage.getViewport({ scale: 1.0, rotation: initialRot });
    this.basePageWidth = firstVp.width;
    this.baseAspectRatio = firstVp.height / firstVp.width;
    this.pageDimensions.set(1, {
      width: firstVp.width,
      height: firstVp.height,
      ratio: this.baseAspectRatio,
      rotate: firstPage.rotate || 0
    });

    // 2. Pre-query dimensions for remaining pages concurrently in batches
    const batchSize = 25;
    for (let b = 2; b <= this.totalPages; b += batchSize) {
      const batchPromises = [];
      const end = Math.min(b + batchSize - 1, this.totalPages);
      for (let p = b; p <= end; p++) {
        batchPromises.push(
          pdfDoc.getPage(p).then((page) => {
            const rot = ((page.rotate || 0) + this.rotation) % 360;
            const vp = page.getViewport({ scale: 1.0, rotation: rot });
            this.pageDimensions.set(p, {
              width: vp.width,
              height: vp.height,
              ratio: vp.height / vp.width,
              rotate: page.rotate || 0
            });
          }).catch(() => {
            this.pageDimensions.set(p, {
              width: this.basePageWidth,
              height: this.basePageWidth * this.baseAspectRatio,
              ratio: this.baseAspectRatio,
              rotate: 0
            });
          })
        );
      }
      await Promise.all(batchPromises);
    }

    this.scale = this.calcFitWidthScale();
    if (this.onScaleChange) this.onScaleChange(this.scale);
    this.renderPlaceholders();
    this.initIntersectionObserver();
    this.initGestureListeners();
  }

  calcFitWidthScale() {
    const containerW = this.containerEl.clientWidth || window.innerWidth || 800;
    const padding = containerW < 640 ? 16 : 48;
    const targetW = Math.max(300, Math.min(containerW - padding, 960));
    return Math.max(0.25, Math.min(targetW / this.basePageWidth, 4.0));
  }

  renderPlaceholders() {
    let html = `<div id="pdfPagesWrapper" class="w-fit min-w-full flex flex-col items-center gap-4 origin-top">`;
    for (let i = 1; i <= this.totalPages; i++) {
      const dims = this.pageDimensions.get(i) || {
        width: this.basePageWidth,
        height: this.basePageWidth * this.baseAspectRatio,
        ratio: this.baseAspectRatio
      };
      const pageW = Math.round(dims.width * this.scale);
      const pageH = Math.round(dims.height * this.scale);

      html += `
        <div id="pdfPageBox_${i}" data-page="${i}" class="pdf-page-box relative bg-white shadow-md dark:shadow-2xl rounded-xs overflow-hidden transition-colors duration-150 border border-zinc-200/60 dark:border-transparent select-text" 
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

        // Suppress midpoint detection while programmatic navigation scroll is active
        if (this.isNavigating) {
          return;
        }

        // Determine visible page based on viewport midpoint
        const boxes = this.containerEl.querySelectorAll('.pdf-page-box');
        const containerRect = this.containerEl.getBoundingClientRect();
        const containerMid = containerRect.top + containerRect.height / 2;
        let detectedPage = null;

        for (const box of boxes) {
          const r = box.getBoundingClientRect();
          if (r.top <= containerMid && r.bottom >= containerMid) {
            detectedPage = Number(box.getAttribute('data-page'));
            break;
          }
        }

        if (detectedPage && detectedPage !== this.currentPage) {
          this.currentPage = detectedPage;
          if (this.onPageChange) this.onPageChange(detectedPage, this.totalPages);
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
      const dim = this.pageDimensions.get(pageNum);
      const intrinsicRotate = dim?.rotate ?? (page.rotate || 0);
      const effectiveRotation = (intrinsicRotate + this.rotation) % 360;
      const viewport = page.getViewport({ scale: this.scale, rotation: effectiveRotation });

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

      // Mount canvas & text layer immediately to establish layout context
      box.innerHTML = '';
      box.appendChild(canvas);
      box.appendChild(textLayerDiv);

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

      // Apply active search highlighting if search is active
      this.highlightPageMatches(pageNum);
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') {
        console.warn(`Render error on page ${pageNum}:`, e);
      }
    }
  }

  unrenderPage(pageNum) {
    if (this.targetNavPage === pageNum) return;
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

  renderVisiblePages() {
    const containerRect = this.containerEl.getBoundingClientRect();
    const buffer = 400;
    const viewTop = containerRect.top - buffer;
    const viewBottom = containerRect.bottom + buffer;

    const boxes = this.containerEl.querySelectorAll('.pdf-page-box');
    boxes.forEach((box) => {
      const pageNum = Number(box.getAttribute('data-page'));
      const r = box.getBoundingClientRect();
      if (r.bottom >= viewTop && r.top <= viewBottom) {
        this.renderPage(pageNum);
      } else {
        this.unrenderPage(pageNum);
      }
    });
  }

  setSearchResults(query, matches, activeMatch, shouldScroll = true) {
    this.searchQuery = (query || '').trim();
    this.searchMatches = matches || [];
    this.activeSearchMatch = activeMatch || null;

    this.renderedPages.forEach((_record, pageNum) => {
      this.highlightPageMatches(pageNum);
    });

    if (activeMatch && shouldScroll) {
      this.scrollToMatchElement(activeMatch.pageNum, activeMatch.matchIndex);
    }
  }

  setNavigating(targetPage) {
    this.isNavigating = true;
    this.targetNavPage = targetPage;
    if (targetPage && targetPage !== this.currentPage) {
      this.currentPage = targetPage;
      if (this.onPageChange) this.onPageChange(targetPage, this.totalPages);
    }
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
    this.navigationTimer = setTimeout(() => {
      this.isNavigating = false;
      this.targetNavPage = null;
    }, 600);
  }

  async navigateToMatch(match, query = null, matches = null) {
    if (!match) return;
    if (query !== null) {
      this.searchQuery = (query || '').trim();
    }
    if (matches !== null) {
      this.searchMatches = matches;
    }
    this.activeSearchMatch = match;

    const targetPage = match.pageNum;

    // Render target page if not currently in memory so textLayer & highlights are created
    if (!this.renderedPages.has(targetPage)) {
      await this.renderPage(targetPage);
    }

    // Refresh highlights across all rendered pages without rogue auto-scrolls
    this.renderedPages.forEach((_record, pageNum) => {
      this.highlightPageMatches(pageNum);
    });

    // Smoothly and directly scroll container to center the match element with padding
    this.scrollToMatchElement(targetPage, match.matchIndex);
  }

  scrollToMatchElement(targetPage, matchIndex) {
    this.setNavigating(targetPage);

    const box = document.getElementById(`pdfPageBox_${targetPage}`);
    const selected = box?.querySelector('.highlight.selected');

    if (selected && typeof selected.getBoundingClientRect === 'function' && typeof this.containerEl.scrollTo === 'function') {
      const containerRect = this.containerEl.getBoundingClientRect();
      const elRect = selected.getBoundingClientRect();

      const currentScrollTop = this.containerEl.scrollTop;
      const currentScrollLeft = this.containerEl.scrollLeft;
      const targetScrollTop = currentScrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2 - elRect.height / 2);
      const targetScrollLeft = currentScrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2 - elRect.width / 2);

      this.containerEl.scrollTo({
        top: Math.max(0, Math.round(targetScrollTop)),
        left: Math.max(0, Math.round(targetScrollLeft)),
        behavior: 'smooth'
      });
    } else if (box && typeof this.containerEl.scrollTo === 'function') {
      const containerRect = this.containerEl.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const currentScrollTop = this.containerEl.scrollTop;
      const targetScrollTop = currentScrollTop + (boxRect.top - containerRect.top) - 24;

      this.containerEl.scrollTo({
        top: Math.max(0, Math.round(targetScrollTop)),
        behavior: 'smooth'
      });
    } else if (selected?.scrollIntoView) {
      selected.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } else if (box?.scrollIntoView) {
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  clearSearchResults() {
    this.searchQuery = '';
    this.searchMatches = [];
    this.activeSearchMatch = null;
    this.renderedPages.forEach((_record, pageNum) => {
      this.highlightPageMatches(pageNum);
    });
  }

  highlightPageMatches(pageNum) {
    const record = this.renderedPages.get(pageNum);
    if (!record || !record.textLayerDiv) return;

    const spans = record.textLayerDiv.querySelectorAll('span:not(.highlight)');
    const query = this.searchQuery.trim().toLowerCase();

    // 1. If query is empty, restore all original text
    if (!query) {
      spans.forEach((span) => {
        if (span.dataset.rawText !== undefined) {
          span.textContent = span.dataset.rawText;
          delete span.dataset.rawText;
        }
      });
      return;
    }

    // 2. Identify matches on this page
    const pageMatches = this.searchMatches.filter((m) => m.pageNum === pageNum);
    if (pageMatches.length === 0) {
      spans.forEach((span) => {
        if (span.dataset.rawText !== undefined) {
          span.textContent = span.dataset.rawText;
          delete span.dataset.rawText;
        }
      });
      return;
    }

    const isPageActive = this.activeSearchMatch && this.activeSearchMatch.pageNum === pageNum;
    const activeMatchIndex = isPageActive ? this.activeSearchMatch.matchIndex : -1;

    let matchCounter = 0;
    spans.forEach((span) => {
      if (span.dataset.rawText === undefined) {
        span.dataset.rawText = span.textContent;
      }
      const raw = span.dataset.rawText;
      const lower = raw.toLowerCase();

      if (!lower.includes(query)) {
        span.textContent = raw;
        return;
      }

      let html = '';
      let lastIdx = 0;
      let idx = 0;
      while ((idx = lower.indexOf(query, lastIdx)) !== -1) {
        html += escapeHtml(raw.slice(lastIdx, idx));
        const matchedStr = escapeHtml(raw.slice(idx, idx + query.length));
        const isSelected = matchCounter === activeMatchIndex;
        html += `<span class="highlight${isSelected ? ' selected' : ''}">${matchedStr}</span>`;
        matchCounter++;
        lastIdx = idx + query.length;
      }
      html += escapeHtml(raw.slice(lastIdx));
      span.innerHTML = html;
    });
  }

  jumpToPage(pageNum) {
    const target = Math.max(1, Math.min(pageNum, this.totalPages));
    this.setNavigating(target);
    const box = document.getElementById(`pdfPageBox_${target}`);
    if (box) {
      if (typeof this.containerEl.scrollTo === 'function') {
        const containerRect = this.containerEl.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        const currentScrollTop = this.containerEl.scrollTop;
        const targetScrollTop = currentScrollTop + (boxRect.top - containerRect.top) - 24;
        this.containerEl.scrollTo({
          top: Math.max(0, Math.round(targetScrollTop)),
          behavior: 'smooth'
        });
      } else if (box.scrollIntoView) {
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  zoomIn() {
    this.setScale(Math.min(this.scale * 1.25, 4.0));
  }

  zoomOut() {
    this.setScale(Math.max(this.scale / 1.25, 0.25));
  }

  zoomFit() {
    const fitScale = this.calcFitWidthScale();
    this.setScale(fitScale);
  }

  setScale(newScale, anchorX = null, anchorY = null) {
    const targetScale = Math.max(0.25, Math.min(newScale, 4.0));
    if (Math.abs(targetScale - this.scale) < 0.001 && anchorX === null && anchorY === null) {
      return;
    }

    const containerW = this.containerEl.clientWidth || window.innerWidth || 800;
    const containerH = this.containerEl.clientHeight || window.innerHeight || 600;
    const ax = anchorX !== null ? anchorX : containerW / 2;
    const ay = anchorY !== null ? anchorY : containerH / 2;

    const containerRect = this.containerEl.getBoundingClientRect();
    const anchorClientX = containerRect.left + ax;
    const anchorClientY = containerRect.top + ay;

    // Identify page box currently under the anchor point
    const boxes = this.containerEl.querySelectorAll('.pdf-page-box');
    let targetBox = null;
    let targetPageNum = this.currentPage || 1;
    let fractionX = 0.5;
    let fractionY = 0.5;

    for (const box of boxes) {
      const rect = box.getBoundingClientRect();
      if (rect.top <= anchorClientY && rect.bottom >= anchorClientY) {
        targetBox = box;
        targetPageNum = Number(box.getAttribute('data-page')) || targetPageNum;
        fractionY = rect.height > 0 ? (anchorClientY - rect.top) / rect.height : 0.5;
        fractionX = rect.width > 0 ? (anchorClientX - rect.left) / rect.width : 0.5;
        break;
      }
    }

    if (!targetBox) {
      targetBox = document.getElementById(`pdfPageBox_${targetPageNum}`);
      if (targetBox) {
        const rect = targetBox.getBoundingClientRect();
        fractionY = rect.height > 0 ? Math.max(0, Math.min(1, (anchorClientY - rect.top) / rect.height)) : 0.5;
        fractionX = rect.width > 0 ? Math.max(0, Math.min(1, (anchorClientX - rect.left) / rect.width)) : 0.5;
      }
    }

    this.scale = targetScale;
    if (this.onScaleChange) {
      this.onScaleChange(this.scale);
    }

    // Update placeholder dimensions in-place without destroying DOM
    for (let i = 1; i <= this.totalPages; i++) {
      const box = document.getElementById(`pdfPageBox_${i}`);
      const dims = this.pageDimensions.get(i);
      if (box && dims) {
        box.style.width = `${Math.round(dims.width * this.scale)}px`;
        box.style.height = `${Math.round(dims.height * this.scale)}px`;
      }
    }

    // Maintain scroll position anchored around cursor or center
    if (targetBox && typeof targetBox.offsetTop === 'number') {
      const newBoxDims = this.pageDimensions.get(targetPageNum);
      const newBoxHeight = newBoxDims ? Math.round(newBoxDims.height * this.scale) : (targetBox.offsetHeight || 0);
      const newBoxWidth = newBoxDims ? Math.round(newBoxDims.width * this.scale) : (targetBox.offsetWidth || 0);

      const newAnchorY = targetBox.offsetTop + fractionY * newBoxHeight;
      const newAnchorX = targetBox.offsetLeft + fractionX * newBoxWidth;

      this.containerEl.scrollTop = Math.max(0, Math.round(newAnchorY - ay));
      this.containerEl.scrollLeft = Math.max(0, Math.round(newAnchorX - ax));
    } else {
      const docX = this.containerEl.scrollLeft + ax;
      const docY = this.containerEl.scrollTop + ay;
      const ratio = targetScale / (this.scale || 1.0);
      this.containerEl.scrollLeft = Math.max(0, Math.round(docX * ratio - ax));
      this.containerEl.scrollTop = Math.max(0, Math.round(docY * ratio - ay));
    }

    const wrapper = document.getElementById('pdfPagesWrapper');
    if (wrapper) wrapper.style.transform = 'none';

    // Debounce re-rendering visible pages at target DPR and clean up off-screen
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    this.zoomDebounceTimer = setTimeout(() => {
      this.renderedPages.forEach((item) => {
        try { item.renderTask?.cancel(); } catch {}
        try { item.textTask?.cancel?.(); } catch {}
        try { item.page?.cleanup(); } catch {}
      });
      this.renderedPages.clear();
      this.renderVisiblePages();
    }, 150);
  }

  rotateClockwise() {
    this.rotation = (this.rotation + 90) % 360;
    // Update dimensions map with rotated coordinates
    this.pageDimensions.forEach((dim, pageNum) => {
      this.pageDimensions.set(pageNum, {
        width: dim.height,
        height: dim.width,
        ratio: dim.width / dim.height,
        rotate: dim.rotate
      });
    });
    const oldBaseWidth = this.basePageWidth;
    this.basePageWidth = this.basePageWidth * this.baseAspectRatio;
    this.baseAspectRatio = oldBaseWidth / this.basePageWidth;

    const fitScale = this.calcFitWidthScale();
    this.scale = fitScale;
    if (this.onScaleChange) this.onScaleChange(this.scale);
    
    // Update all page box sizes in-place
    for (let i = 1; i <= this.totalPages; i++) {
      const box = document.getElementById(`pdfPageBox_${i}`);
      const dims = this.pageDimensions.get(i);
      if (box && dims) {
        box.style.width = `${Math.round(dims.width * this.scale)}px`;
        box.style.height = `${Math.round(dims.height * this.scale)}px`;
      }
    }

    this.renderedPages.forEach((item) => {
      try { item.renderTask?.cancel(); } catch {}
      try { item.textTask?.cancel?.(); } catch {}
      try { item.page?.cleanup(); } catch {}
    });
    this.renderedPages.clear();
    this.renderVisiblePages();
    this.jumpToPage(this.currentPage);
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
    // 1. Ctrl + Wheel Zoom anchored at cursor
    this.boundWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      let zoomFactor;
      if (Math.abs(e.deltaY) < 50) {
        // Continuous precision trackpad: smooth exponential scale
        zoomFactor = Math.max(0.85, Math.min(1.15, Math.exp(-e.deltaY * 0.005)));
      } else {
        // Standard discrete mouse wheel
        zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      }
      const rect = this.containerEl.getBoundingClientRect();
      const ax = typeof e.clientX === 'number' ? e.clientX - rect.left : this.containerEl.clientWidth / 2;
      const ay = typeof e.clientY === 'number' ? e.clientY - rect.top : this.containerEl.clientHeight / 2;
      this.setScale(this.scale * zoomFactor, ax, ay);
    };
    this.containerEl.addEventListener('wheel', this.boundWheel, { passive: false });

    // 2. Mobile 2-Finger Pinch-to-Zoom
    this.boundTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const rect = this.containerEl.getBoundingClientRect();
        this.touchPinch = {
          startDist: Math.hypot(dx, dy),
          initialScale: this.scale,
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
        };
      }
    };

    this.boundTouchMove = (e) => {
      if (e.touches.length === 2 && this.touchPinch && this.touchPinch.startDist > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const ratio = currentDist / this.touchPinch.startDist;
        const liveScale = Math.max(0.25, Math.min(this.touchPinch.initialScale * ratio, 4.0));
        if (Math.abs(liveScale - this.scale) >= 0.005) {
          this.setScale(liveScale, this.touchPinch.midX, this.touchPinch.midY);
        }
      }
    };

    this.boundTouchEnd = (e) => {
      if (this.touchPinch && e.touches.length < 2) {
        this.touchPinch = null;
      }
    };

    this.containerEl.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    this.containerEl.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    this.containerEl.addEventListener('touchend', this.boundTouchEnd, { passive: true });
  }

  destroy() {
    if (this.zoomDebounceTimer) clearTimeout(this.zoomDebounceTimer);
    if (this.navigationTimer) clearTimeout(this.navigationTimer);
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
