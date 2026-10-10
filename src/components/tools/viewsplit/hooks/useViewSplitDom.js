/**
 * useViewSplitDom.js - DOM Event Listeners, Canvas Loop & Interaction Orchestrator
 * Cursor-anchored wheel zoom, multi-touch gestures, drag-and-drop, clipboard paste,
 * keyboard shortcuts, slider wipe divider dragging, and storage drive browsing.
 */

import { showToast } from '../../../../utilities/toast.js';
import { copyText } from '../../../../utilities/clipboard.js';
import { StorageService } from '../../../../services/storageService.js';
import {
  calculateZoomAroundAnchor,
  calculateDifferencePixel
} from './useViewSplitSync.js';
import {
  LAYOUT_MODES,
  PANE_TITLES
} from './useViewSplit.js';
import { drawLoupe, updatePixelInspectorHud } from '../components/ViewSplitPixelInspector.js';
import {
  downloadComparisonImage,
  copyComparisonImageToClipboard
} from '../utilities/viewSplitCompositor.js';

/**
 * Attaches all DOM event listeners, starts RAF canvas render loop, and handles shortcuts.
 *
 * @param {import('./useViewSplit.js').ViewSplitStore} store
 * @param {Function} onReRender
 * @returns {Function} cleanup function
 */
export function attachViewSplitDomListeners(store, onReRender) {
  let isAlive = true;
  let rafId = null;
  const paneBlobUrls = new Map();
  let scratchCanvas = null;
  let scratchCtx = null;

  // Helper to load File or Blob into an HTMLImageElement
  const loadImageSource = (src, meta = {}) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Không thể nạp tệp hình ảnh'));
      img.src = src;
    });
  };

  /**
   * Fast in-place DOM synchronization for active pane indicators across all UI surfaces
   * (Panes, badges, toolbar segmented pills, slider overlay slots, and mobile tabs).
   *
   * @param {number} activeId
   */
  const syncActivePaneUI = (activeId) => {
    const numActiveId = parseInt(activeId, 10);
    if (isNaN(numActiveId)) return;

    // A. Multi-pane grid panes
    document.querySelectorAll('.viewsplit-pane').forEach((paneEl) => {
      const pId = parseInt(paneEl.dataset.paneId, 10);
      const isActive = pId === numActiveId;

      if (isActive) {
        paneEl.classList.remove(
          'border-zinc-200/80',
          'dark:border-white/10',
          'hover:border-zinc-400',
          'dark:hover:border-white/30',
          'cursor-pointer'
        );
        paneEl.classList.add(
          'border-cyan-500',
          'ring-2',
          'ring-cyan-400/40',
          'shadow-xl',
          'shadow-cyan-500/15'
        );
      } else {
        paneEl.classList.remove(
          'border-cyan-500',
          'ring-2',
          'ring-cyan-400/40',
          'shadow-xl',
          'shadow-cyan-500/15'
        );
        paneEl.classList.add(
          'border-zinc-200/80',
          'dark:border-white/10',
          'hover:border-zinc-400',
          'dark:hover:border-white/30',
          'cursor-pointer'
        );
      }

      paneEl.title = isActive
        ? 'Khung hình đang được chọn để dán/nạp ảnh'
        : 'Bấm để chọn khung hình này';

      const dot = paneEl.querySelector('.viewsplit-pane-dot');
      if (dot) {
        dot.className = `viewsplit-pane-dot w-2 h-2 rounded-full ${isActive ? 'bg-cyan-500 dark:bg-cyan-400 animate-pulse' : 'bg-zinc-400'}`;
      }

      const badge = paneEl.querySelector('.viewsplit-pane-badge');
      if (badge) {
        badge.innerHTML = isActive
          ? '<span class="px-1.5 py-0.5 rounded-md bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold text-[10px] tracking-wide border border-cyan-500/30 animate-pulse">ĐANG CHỌN</span>'
          : '';
      }
    });

    // B. Toolbar pills & header selectors
    document.querySelectorAll('[data-action="select-pane"][data-pane-id]').forEach((btn) => {
      if (!btn.classList.contains('viewsplit-pane') && !btn.classList.contains('viewsplit-overlay-slot')) {
        const pId = parseInt(btn.dataset.paneId, 10);
        const isSelected = pId === numActiveId;
        btn.classList.toggle('bg-cyan-500/15', isSelected);
        btn.classList.toggle('text-cyan-600', isSelected);
        btn.classList.toggle('dark:text-cyan-400', isSelected);
        btn.classList.toggle('border', isSelected);
        btn.classList.toggle('border-cyan-500/30', isSelected);
        btn.classList.toggle('shadow-sm', isSelected);

        const dot = btn.querySelector('.rounded-full');
        if (dot) {
          dot.classList.toggle('bg-cyan-400', isSelected);
          dot.classList.toggle('animate-pulse', isSelected);
        }
      }
    });

    // C. Slider overlay slot cards (Slot A & Slot B)
    const slotACard = document.querySelector('.viewsplit-overlay-slot[data-pane-id="1"]');
    const slotBCard = document.querySelector('.viewsplit-overlay-slot[data-pane-id="2"]');
    if (slotACard) {
      const isA = numActiveId === 1;
      if (isA) {
        slotACard.classList.remove('border-zinc-200/80', 'dark:border-white/10', 'cursor-pointer');
        slotACard.classList.add('border-cyan-500', 'ring-2', 'ring-cyan-400/40', 'shadow-xl', 'shadow-cyan-500/15');
      } else {
        slotACard.classList.remove('border-cyan-500', 'ring-2', 'ring-cyan-400/40', 'shadow-xl', 'shadow-cyan-500/15');
        slotACard.classList.add('border-zinc-200/80', 'dark:border-white/10', 'cursor-pointer');
      }
      const b1 = document.querySelector('.viewsplit-overlay-badge-1');
      if (b1) {
        b1.innerHTML = isA
          ? '<span class="px-1.5 py-0.5 rounded-md bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold text-[9px] border border-cyan-500/30 animate-pulse">ĐANG CHỌN</span>'
          : '';
      }
    }
    if (slotBCard) {
      const isB = numActiveId === 2;
      if (isB) {
        slotBCard.classList.remove('border-zinc-200/80', 'dark:border-white/10', 'cursor-pointer');
        slotBCard.classList.add('border-cyan-500', 'ring-2', 'ring-cyan-400/40', 'shadow-xl', 'shadow-cyan-500/15');
      } else {
        slotBCard.classList.remove('border-cyan-500', 'ring-2', 'ring-cyan-400/40', 'shadow-xl', 'shadow-cyan-500/15');
        slotBCard.classList.add('border-zinc-200/80', 'dark:border-white/10', 'cursor-pointer');
      }
      const b2 = document.querySelector('.viewsplit-overlay-badge-2');
      if (b2) {
        b2.innerHTML = isB
          ? '<span class="px-1.5 py-0.5 rounded-md bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold text-[9px] border border-cyan-500/30 animate-pulse">ĐANG CHỌN</span>'
          : '';
      }
    }

    // D. Mobile tabs
    document.querySelectorAll('.viewsplit-mobile-tab[data-pane-id], [data-action="set-mobile-tab"][data-pane-id]').forEach((tab) => {
      const pId = parseInt(tab.dataset.paneId, 10);
      const isActive = pId === numActiveId;
      tab.classList.toggle('bg-cyan-500/15', isActive);
      tab.classList.toggle('text-cyan-600', isActive);
      tab.classList.toggle('dark:text-cyan-400', isActive);
      tab.classList.toggle('border-cyan-500/30', isActive);
      tab.classList.toggle('shadow-sm', isActive);
      tab.classList.toggle('text-zinc-600', !isActive);
      tab.classList.toggle('dark:text-zinc-400', !isActive);
    });
  };

  const loadFileIntoPane = async (source, paneId, meta = {}) => {
    if (!source) return;

    let blobUrl = null;
    let fileName = meta.name;
    let fileSize = meta.size || 0;

    if (typeof source === 'string') {
      blobUrl = source;
      if (!fileName) {
        fileName = source.split('/').pop()?.split('?')[0] || 'Ảnh từ URL';
      }
    } else if (source instanceof Blob || (typeof File !== 'undefined' && source instanceof File) || (source && source.type)) {
      if (source.type && !source.type.startsWith('image/')) {
        showToast('Tệp được chọn không phải là hình ảnh hợp lệ', 'warning');
        return;
      }
      if (paneBlobUrls.has(paneId)) {
        try { URL.revokeObjectURL(paneBlobUrls.get(paneId)); } catch {}
      }
      blobUrl = URL.createObjectURL(source);
      paneBlobUrls.set(paneId, blobUrl);
      if (!fileName) {
        fileName = source.name || 'Ảnh đã dán';
      }
      if (!fileSize) {
        fileSize = source.size || 0;
      }
    } else {
      showToast('Nguồn ảnh không hợp lệ', 'warning');
      return;
    }

    try {
      const img = await loadImageSource(blobUrl);
      store.setImageForPane(paneId, img, { name: fileName, size: fileSize });
      const nextPaneId = store.getNextTargetPaneId(paneId);
      const paneTitle = PANE_TITLES[paneId - 1] || `Ảnh ${paneId}`;
      if (nextPaneId !== paneId) {
        store.setActivePane(nextPaneId);
        const nextTitle = PANE_TITLES[nextPaneId - 1] || `Ảnh ${nextPaneId}`;
        showToast(`Đã nạp ${fileName} vào ${paneTitle}. Tự động chuyển sang ${nextTitle} để sẵn sàng dán ảnh tiếp theo.`, 'success');
      } else {
        showToast(`Đã nạp ${fileName} vào ${paneTitle}`, 'success');
      }
      onReRender();
      requestAnimationFrame(() => {
        syncActivePaneUI(store.activePaneId);
      });
    } catch (err) {
      console.error('[ViewSplit] Error loading image:', err);
      showToast('Lỗi khi nạp ảnh', 'error');
    }
  };

  // ─── 1. RAF Canvas Render Loop ───
  const renderCanvasFrame = () => {
    if (!isAlive) return;

    const dpr = window.devicePixelRatio || 1;

    // A. Render multi-pane canvases
    const canvases = document.querySelectorAll('.viewsplit-canvas');
    canvases.forEach((canvas) => {
      const paneId = parseInt(canvas.dataset.paneId, 10);
      const pane = store.getPane(paneId);
      if (!pane) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (pane.image && pane.width > 0 && pane.height > 0) {
        ctx.imageSmoothingEnabled = store.filter === 'bilinear';
        ctx.drawImage(
          pane.image,
          pane.panX,
          pane.panY,
          pane.width * pane.zoom,
          pane.height * pane.zoom
        );

        // Render Crosshair if cursor inside or syncCursor enabled
        if (pane.cursor.inside) {
          const cx = pane.cursor.viewX;
          const cy = pane.cursor.viewY;

          ctx.save();
          // Horizontal line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, cy);
          ctx.lineTo(rect.width, cy);
          ctx.stroke();

          // Vertical line
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, rect.height);
          ctx.stroke();

          // Center target dot
          ctx.setLineDash([]);
          ctx.fillStyle = '#06B6D4';
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();
    });

    // B. Render Slider Wipe / Difference Diff Overlay Canvas
    const overlayCanvas = document.getElementById('viewsplit-overlay-canvas');
    if (overlayCanvas) {
      const rect = overlayCanvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (overlayCanvas.width !== Math.round(rect.width * dpr) || overlayCanvas.height !== Math.round(rect.height * dpr)) {
          overlayCanvas.width = Math.round(rect.width * dpr);
          overlayCanvas.height = Math.round(rect.height * dpr);
        }

        const ctx = overlayCanvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, rect.width, rect.height);

          const paneA = store.panes[0];
          const paneB = store.panes[1];

          if (paneA.image && paneB.image) {
            ctx.imageSmoothingEnabled = store.filter === 'bilinear';

            if (store.layout === LAYOUT_MODES.SLIDER) {
              const splitX = Math.round(rect.width * store.sliderPos);

              // Draw Pane A clipped to left side
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, 0, splitX, rect.height);
              ctx.clip();
              ctx.drawImage(
                paneA.image,
                paneA.panX,
                paneA.panY,
                paneA.width * paneA.zoom,
                paneA.height * paneA.zoom
              );
              ctx.restore();

              // Draw Pane B clipped to right side
              ctx.save();
              ctx.beginPath();
              ctx.rect(splitX, 0, rect.width - splitX, rect.height);
              ctx.clip();
              ctx.drawImage(
                paneB.image,
                paneB.panX,
                paneB.panY,
                paneB.width * paneB.zoom,
                paneB.height * paneB.zoom
              );
              ctx.restore();
            } else if (store.layout === LAYOUT_MODES.DIFF) {
              // Difference Diff mode using persistent scratch canvas to prevent GC thrashing
              if (!scratchCanvas) {
                scratchCanvas = document.createElement('canvas');
                scratchCtx = scratchCanvas.getContext('2d');
              }
              if (scratchCanvas.width !== overlayCanvas.width || scratchCanvas.height !== overlayCanvas.height) {
                scratchCanvas.width = overlayCanvas.width;
                scratchCanvas.height = overlayCanvas.height;
              }
              if (scratchCtx) {
                scratchCtx.save();
                scratchCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                scratchCtx.scale(dpr, dpr);
                scratchCtx.imageSmoothingEnabled = store.filter === 'bilinear';
                scratchCtx.drawImage(
                  paneA.image,
                  paneA.panX,
                  paneA.panY,
                  paneA.width * paneA.zoom,
                  paneA.height * paneA.zoom
                );
                scratchCtx.globalCompositeOperation = 'difference';
                scratchCtx.drawImage(
                  paneB.image,
                  paneB.panX,
                  paneB.panY,
                  paneB.width * paneB.zoom,
                  paneB.height * paneB.zoom
                );
                scratchCtx.restore();

                // Draw base difference
                ctx.drawImage(scratchCanvas, 0, 0, rect.width, rect.height);

                // Amplify differences if multiplier > 1 using GPU additive blending
                const mult = Math.min(10, Math.max(1, store.diffMultiplier || 1));
                if (mult > 1) {
                  ctx.globalCompositeOperation = 'lighter';
                  for (let m = 1; m < mult; m++) {
                    ctx.drawImage(scratchCanvas, 0, 0, rect.width, rect.height);
                  }
                  ctx.globalCompositeOperation = 'source-over';
                }
              }
            }
          }

          ctx.restore();
        }
      }
    }

    // C. Render Pixel Loupe HUD canvas & Telemetry
    const loupeCanvas = document.getElementById('viewsplit-loupe-canvas');
    if (store.inspectorOpen) {
      if (loupeCanvas) {
        drawLoupe(loupeCanvas, store.pixelInspectorState.neighborhood);
      }
      const activeTitle = PANE_TITLES[store.pixelInspectorState.paneId - 1] || `Ảnh ${store.pixelInspectorState.paneId}`;
      updatePixelInspectorHud(store.pixelInspectorState, activeTitle);
    }

    // D. Update Live Zoom Percentage Badges across panes
    store.panes.forEach((p) => {
      const zoomBadge = document.getElementById(`viewsplit-zoom-badge-${p.id}`);
      if (zoomBadge) {
        zoomBadge.textContent = `${Math.round(p.zoom * 100)}%`;
      }
    });

    rafId = requestAnimationFrame(renderCanvasFrame);
  };

  rafId = requestAnimationFrame(renderCanvasFrame);

  // ─── 2. Mouse Wheel Interaction (Anchored Zoom) ───
  const onWheel = (e) => {
    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (!canvas) return;
    e.preventDefault();

    const paneId = canvas.id === 'viewsplit-overlay-canvas' ? 1 : parseInt(canvas.dataset.paneId, 10);
    const pane = store.getPane(paneId);
    if (!pane || !pane.image) return;

    const rect = canvas.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;

    const zoomDelta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const { zoom, panX, panY } = calculateZoomAroundAnchor(
      pane.zoom,
      zoomDelta,
      { x: vx, y: vy },
      { x: pane.panX, y: pane.panY }
    );

    store.setTransform(pane.id, zoom, panX, panY, rect.width, rect.height);
  };

  // ─── 3. Mouse Drag (Pan) & Move (Cursor / Loupe) ───
  let activeDragPaneId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPanX = 0;
  let initialPanY = 0;
  let isDragging = false;

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    // If clicking slider divider, handled separately
    if (e.target.closest('#viewsplit-slider-divider')) return;

    // Immediate Pane Selection on MouseDown: Clicking anywhere inside a pane
    const paneEl = e.target.closest('.viewsplit-pane');
    if (paneEl) {
      const actionBtn = e.target.closest('button[data-action], a[data-action]');
      const subAction = actionBtn ? actionBtn.dataset.action : null;
      if (!subAction || subAction === 'select-pane' || subAction === 'paste-clipboard') {
        const paneId = parseInt(paneEl.dataset.paneId, 10);
        if (paneId && paneId >= 1 && paneId <= store.getVisiblePaneCount()) {
          if (store.activePaneId !== paneId) {
            store.setActivePane(paneId);
            syncActivePaneUI(paneId);
          }
        }
      }
    }

    // Immediate Overlay Slot Selection on MouseDown
    const overlaySlot = e.target.closest('.viewsplit-overlay-slot');
    if (overlaySlot) {
      const actionBtn = e.target.closest('button[data-action], a[data-action]');
      const subAction = actionBtn ? actionBtn.dataset.action : null;
      if (!subAction || subAction === 'select-pane' || subAction === 'paste-clipboard') {
        const slotId = parseInt(overlaySlot.dataset.paneId, 10);
        if (slotId && (slotId === 1 || slotId === 2)) {
          if (store.activePaneId !== slotId) {
            store.setActivePane(slotId);
            syncActivePaneUI(slotId);
          }
        }
      }
    }

    // Direct Overlay Canvas Click on MouseDown
    const overlayCanvas = e.target.closest('#viewsplit-overlay-canvas');
    if (overlayCanvas && !e.target.closest('button, [data-action], input, #viewsplit-slider-divider')) {
      const rect = overlayCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const splitX = rect.width * store.sliderPos;
      const targetId = (store.layout === LAYOUT_MODES.SLIDER && clickX >= splitX) ? 2 : 1;
      if (store.activePaneId !== targetId) {
        store.setActivePane(targetId);
        syncActivePaneUI(targetId);
      }
    }

    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (!canvas) return;

    let paneId;
    if (canvas.id === 'viewsplit-overlay-canvas') {
      const rect = canvas.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const splitX = rect.width * store.sliderPos;
      paneId = (store.layout === LAYOUT_MODES.SLIDER && vx >= splitX) ? 2 : 1;
    } else {
      paneId = parseInt(canvas.dataset.paneId, 10);
    }
    const pane = store.getPane(paneId);
    if (!pane) return;

    isDragging = true;
    activeDragPaneId = pane.id;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialPanX = pane.panX;
    initialPanY = pane.panY;
  };

  const onMouseMove = (e) => {
    // Handle Pan dragging
    if (isDragging && activeDragPaneId !== null) {
      const pane = store.getPane(activeDragPaneId);
      if (pane) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const canvas = document.querySelector(`.viewsplit-canvas[data-pane-id="${pane.id}"]`) ||
                       document.getElementById('viewsplit-overlay-canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };

        store.setTransform(
          pane.id,
          pane.zoom,
          initialPanX + deltaX,
          initialPanY + deltaY,
          rect.width,
          rect.height
        );
      }
    }

    // Handle Cursor Tracking & Loupe inspection
    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;

      let paneId;
      if (canvas.id === 'viewsplit-overlay-canvas') {
        const splitX = rect.width * store.sliderPos;
        paneId = (store.layout === LAYOUT_MODES.SLIDER && vx >= splitX) ? 2 : 1;
      } else {
        paneId = parseInt(canvas.dataset.paneId, 10);
      }

      store.updateCursor(paneId, vx, vy, true);
    } else {
      store.clearAllCursors();
    }
  };

  const onMouseUp = () => {
    isDragging = false;
    activeDragPaneId = null;
  };

  const onWindowMouseLeave = (e) => {
    if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
      store.clearAllCursors();
    }
  };

  // ─── 4. Slider Wipe Divider Dragging ───
  let isDraggingSlider = false;

  const onSliderMouseDown = (e) => {
    const divider = e.target.closest('#viewsplit-slider-divider');
    if (!divider) return;
    e.preventDefault();
    isDraggingSlider = true;
  };

  const onSliderMouseMove = (e) => {
    if (!isDraggingSlider) return;
    const overlay = document.querySelector('.viewsplit-overlay-container');
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    store.setSliderPos(pos);

    const divider = document.getElementById('viewsplit-slider-divider');
    if (divider) {
      divider.style.left = `${store.sliderPos * 100}%`;
    }
    const sliderBadge = document.getElementById('viewsplit-slider-pct-badge');
    if (sliderBadge) {
      sliderBadge.textContent = `${Math.round(store.sliderPos * 100)}%`;
    }
  };

  const onSliderMouseUp = () => {
    isDraggingSlider = false;
  };

  const onSliderTouchStart = (e) => {
    const divider = e.target.closest('#viewsplit-slider-divider');
    if (!divider || e.touches.length !== 1) return;
    e.preventDefault();
    isDraggingSlider = true;
  };

  const onSliderTouchMove = (e) => {
    if (!isDraggingSlider || e.touches.length !== 1) return;
    const overlay = document.querySelector('.viewsplit-overlay-container');
    if (!overlay) return;

    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const pos = (e.touches[0].clientX - rect.left) / rect.width;
    store.setSliderPos(pos);

    const divider = document.getElementById('viewsplit-slider-divider');
    if (divider) {
      divider.style.left = `${store.sliderPos * 100}%`;
    }
    const sliderBadge = document.getElementById('viewsplit-slider-pct-badge');
    if (sliderBadge) {
      sliderBadge.textContent = `${Math.round(store.sliderPos * 100)}%`;
    }
  };

  const onSliderTouchEnd = () => {
    isDraggingSlider = false;
  };

  // ─── 4b. Draggable Pixel Inspector HUD ───
  let isDraggingHud = false;
  let hudDragStartX = 0;
  let hudDragStartY = 0;
  let hudInitialLeft = 0;
  let hudInitialTop = 0;

  const onHudMouseDown = (e) => {
    const header = e.target.closest('#viewsplit-inspector-header');
    if (!header || e.target.closest('button')) return;
    const hud = document.getElementById('viewsplit-pixel-inspector-hud');
    if (!hud) return;

    isDraggingHud = true;
    hudDragStartX = e.clientX;
    hudDragStartY = e.clientY;
    const rect = hud.getBoundingClientRect();
    hudInitialLeft = rect.left;
    hudInitialTop = rect.top;

    hud.style.bottom = 'auto';
    hud.style.right = 'auto';
    hud.style.left = `${hudInitialLeft}px`;
    hud.style.top = `${hudInitialTop}px`;
    e.preventDefault();
  };

  const onHudMouseMove = (e) => {
    if (!isDraggingHud) return;
    const hud = document.getElementById('viewsplit-pixel-inspector-hud');
    if (!hud) return;

    const dx = e.clientX - hudDragStartX;
    const dy = e.clientY - hudDragStartY;
    const newLeft = Math.max(10, Math.min(window.innerWidth - hud.offsetWidth - 10, hudInitialLeft + dx));
    const newTop = Math.max(10, Math.min(window.innerHeight - hud.offsetHeight - 10, hudInitialTop + dy));

    hud.style.left = `${newLeft}px`;
    hud.style.top = `${newTop}px`;
  };

  const onHudMouseUp = () => {
    isDraggingHud = false;
  };

  const onHudTouchStart = (e) => {
    const header = e.target.closest('#viewsplit-inspector-header');
    if (!header || e.target.closest('button') || e.touches.length !== 1) return;
    const hud = document.getElementById('viewsplit-pixel-inspector-hud');
    if (!hud) return;

    isDraggingHud = true;
    hudDragStartX = e.touches[0].clientX;
    hudDragStartY = e.touches[0].clientY;
    const rect = hud.getBoundingClientRect();
    hudInitialLeft = rect.left;
    hudInitialTop = rect.top;

    hud.style.bottom = 'auto';
    hud.style.right = 'auto';
    hud.style.left = `${hudInitialLeft}px`;
    hud.style.top = `${hudInitialTop}px`;
  };

  const onHudTouchMove = (e) => {
    if (!isDraggingHud || e.touches.length !== 1) return;
    const hud = document.getElementById('viewsplit-pixel-inspector-hud');
    if (!hud) return;

    const dx = e.touches[0].clientX - hudDragStartX;
    const dy = e.touches[0].clientY - hudDragStartY;
    const newLeft = Math.max(10, Math.min(window.innerWidth - hud.offsetWidth - 10, hudInitialLeft + dx));
    const newTop = Math.max(10, Math.min(window.innerHeight - hud.offsetHeight - 10, hudInitialTop + dy));

    hud.style.left = `${newLeft}px`;
    hud.style.top = `${newTop}px`;
    e.preventDefault();
  };

  const onHudTouchEnd = () => {
    isDraggingHud = false;
  };

  // ─── 5. Touch Gestures (Mobile Pinch-to-Zoom & Pan) ───
  let initialTouchDistance = 0;
  let initialTouchZoom = 1;
  let touchAnchor = { x: 0, y: 0 };
  let touchPanStart = { x: 0, y: 0 };
  let touchInitialPan = { x: 0, y: 0 };

  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const paneEl = e.target.closest('.viewsplit-pane');
      if (paneEl) {
        const actionBtn = e.target.closest('button[data-action], a[data-action]');
        const subAction = actionBtn ? actionBtn.dataset.action : null;
        if (!subAction || subAction === 'select-pane' || subAction === 'paste-clipboard') {
          const paneId = parseInt(paneEl.dataset.paneId, 10);
          if (paneId && paneId >= 1 && paneId <= store.getVisiblePaneCount()) {
            if (store.activePaneId !== paneId) {
              store.setActivePane(paneId);
              syncActivePaneUI(paneId);
            }
          }
        }
      }

      const overlaySlot = e.target.closest('.viewsplit-overlay-slot');
      if (overlaySlot) {
        const actionBtn = e.target.closest('button[data-action], a[data-action]');
        const subAction = actionBtn ? actionBtn.dataset.action : null;
        if (!subAction || subAction === 'select-pane' || subAction === 'paste-clipboard') {
          const slotId = parseInt(overlaySlot.dataset.paneId, 10);
          if (slotId && (slotId === 1 || slotId === 2)) {
            if (store.activePaneId !== slotId) {
              store.setActivePane(slotId);
              syncActivePaneUI(slotId);
            }
          }
        }
      }
    }

    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (!canvas) return;

    const paneId = canvas.id === 'viewsplit-overlay-canvas' ? 1 : parseInt(canvas.dataset.paneId, 10);
    const pane = store.getPane(paneId);
    if (!pane) return;

    if (e.touches.length === 1) {
      // Single finger drag
      isDragging = true;
      activeDragPaneId = pane.id;
      touchPanStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchInitialPan = { x: pane.panX, y: pane.panY };
    } else if (e.touches.length === 2) {
      // Two-finger pinch
      isDragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialTouchZoom = pane.zoom;

      const rect = canvas.getBoundingClientRect();
      touchAnchor = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top
      };
      touchInitialPan = { x: pane.panX, y: pane.panY };
    }
  };

  const onTouchMove = (e) => {
    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (!canvas) return;
    const paneId = canvas.id === 'viewsplit-overlay-canvas' ? 1 : parseInt(canvas.dataset.paneId, 10);
    const pane = store.getPane(paneId);
    if (!pane) return;

    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const deltaX = e.touches[0].clientX - touchPanStart.x;
      const deltaY = e.touches[0].clientY - touchPanStart.y;
      store.setTransform(
        pane.id,
        pane.zoom,
        touchInitialPan.x + deltaX,
        touchInitialPan.y + deltaY,
        rect.width,
        rect.height
      );
    } else if (e.touches.length === 2 && initialTouchDistance > 0) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = newDistance / initialTouchDistance;

      const { zoom, panX, panY } = calculateZoomAroundAnchor(
        initialTouchZoom,
        ratio,
        touchAnchor,
        touchInitialPan
      );

      store.setTransform(pane.id, zoom, panX, panY, rect.width, rect.height);
    }
  };

  const onTouchEnd = () => {
    isDragging = false;
    initialTouchDistance = 0;
  };

  // ─── 6. Action Delegation (Click Handlers) ───
  const onClick = async (e) => {
    // Handle Storage Drive list item click delegation
    const driveItem = e.target.closest('.viewsplit-drive-item');
    if (driveItem) {
      e.preventDefault();
      const path = driveItem.dataset.drivePath;
      const name = driveItem.dataset.driveName;
      const imgUrl = `/api/v1/storage/download?path=${encodeURIComponent(path)}&inline=true`;
      const targetId = store.urlModalTargetPaneId;
      store.closeUrlModal();
      await loadFileIntoPane(imgUrl, targetId, { name });
      return;
    }

    // Direct Pane Selection Click: Clicking anywhere on a .viewsplit-pane (except sub-action buttons like clear-pane, pick-file, open-url-modal)
    const paneEl = e.target.closest('.viewsplit-pane');
    if (paneEl) {
      const actionBtn = e.target.closest('button[data-action], a[data-action]');
      const subAction = actionBtn ? actionBtn.dataset.action : null;

      // If no sub-action button, OR the action is specifically 'select-pane':
      if (!subAction || subAction === 'select-pane') {
        const paneId = parseInt(paneEl.dataset.paneId, 10);
        if (paneId && paneId >= 1 && paneId <= store.getVisiblePaneCount()) {
          store.setActivePane(paneId);
          syncActivePaneUI(paneId);
          return;
        }
      }
    }

    // Direct Overlay Canvas Click: Clicking on Slider Wipe or Diff canvas selects Slot A or Slot B
    const overlayCanvas = e.target.closest('#viewsplit-overlay-canvas');
    if (overlayCanvas && !e.target.closest('button, [data-action], input, #viewsplit-slider-divider')) {
      const rect = overlayCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const splitX = rect.width * store.sliderPos;
      const targetId = (store.layout === LAYOUT_MODES.SLIDER && clickX >= splitX) ? 2 : 1;
      store.setActivePane(targetId);
      syncActivePaneUI(targetId);
      return;
    }

    const btn = e.target.closest('button, [data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;

    if (btn.tagName === 'BUTTON' || btn.tagName === 'A') {
      e.preventDefault();
    }

    switch (action) {
      case 'select-pane': {
        const paneId = parseInt(btn.dataset.paneId, 10);
        if (paneId && paneId >= 1 && paneId <= store.getVisiblePaneCount()) {
          store.setActivePane(paneId);
          syncActivePaneUI(paneId);
        }
        break;
      }

      case 'set-layout': {
        const newLayout = btn.dataset.layout;
        store.setLayout(newLayout);
        onReRender();
        break;
      }

      case 'toggle-sync-view': {
        store.toggleSyncView();
        onReRender();
        break;
      }

      case 'toggle-sync-cursor': {
        store.toggleSyncCursor();
        onReRender();
        break;
      }

      case 'toggle-filter': {
        store.toggleFilter();
        onReRender();
        break;
      }

      case 'toggle-inspector': {
        store.toggleInspector();
        onReRender();
        break;
      }

      case 'fit-all': {
        store.fitAll();
        break;
      }

      case 'actual-size': {
        store.actualSize();
        break;
      }

      case 'reset-view': {
        store.resetView();
        break;
      }

      case 'pick-file': {
        const paneId = parseInt(btn.dataset.paneId, 10) || store.activePaneId;
        if (paneId) {
          store.setActivePane(paneId);
          syncActivePaneUI(paneId);
          const input = document.querySelector(`.viewsplit-file-input[data-pane-id="${paneId}"]`);
          if (input) input.click();
        }
        break;
      }

      case 'paste-clipboard': {
        const paneId = parseInt(btn.dataset.paneId, 10) || store.activePaneId;
        if (paneId && paneId >= 1 && paneId <= store.getVisiblePaneCount()) {
          store.setActivePane(paneId);
          syncActivePaneUI(paneId);
        }
        let clipboardPasted = false;
        try {
          if (navigator.clipboard && navigator.clipboard.read) {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              const imageType = item.types.find((t) => t.startsWith('image/'));
              if (imageType) {
                const blob = await item.getType(imageType);
                await loadFileIntoPane(blob, paneId, { name: 'Ảnh từ Clipboard' });
                clipboardPasted = true;
                return;
              }
            }
          }
        } catch (err) {
          // Clipboard read denied or not available
        }

        if (!clipboardPasted) {
          showToast(`Đã chọn ${PANE_TITLES[paneId - 1] || 'Khung hình'}. Nhấn Ctrl+V để dán ảnh ngay lập tức.`, 'info');
        }
        break;
      }

      case 'clear-pane': {
        const paneId = parseInt(btn.dataset.paneId, 10);
        if (paneBlobUrls.has(paneId)) {
          try { URL.revokeObjectURL(paneBlobUrls.get(paneId)); } catch {}
          paneBlobUrls.delete(paneId);
        }
        store.clearPane(paneId);
        store.setActivePane(paneId);
        syncActivePaneUI(paneId);
        onReRender();
        break;
      }

      case 'swap-overlay-panes': {
        const p1 = store.panes[0];
        const p2 = store.panes[1];
        const tempImg = p1.image;
        const tempName = p1.name;
        const tempW = p1.width;
        const tempH = p1.height;
        const tempSize = p1.size;
        const tempData = p1.imageData;

        p1.image = p2.image;
        p1.name = p2.name;
        p1.width = p2.width;
        p1.height = p2.height;
        p1.size = p2.size;
        p1.imageData = p2.imageData;

        p2.image = tempImg;
        p2.name = tempName;
        p2.width = tempW;
        p2.height = tempH;
        p2.size = tempSize;
        p2.imageData = tempData;

        showToast('Đã đảo vị trí Pane A và Pane B', 'info');
        onReRender();
        break;
      }

      case 'copy-hex': {
        const hex = btn.dataset.hex;
        if (hex) {
          const ok = await copyText(hex);
          if (ok) showToast(`Đã sao chép mã màu ${hex}`, 'success');
        }
        break;
      }

      case 'copy-composite': {
        showToast('Đang tạo và sao chép ảnh ghép...', 'info');
        const isDark = document.documentElement.classList.contains('dark');
        const ok = await copyComparisonImageToClipboard(store.panes, store.layout, {
          sliderPos: store.sliderPos,
          diffMultiplier: store.diffMultiplier,
          filter: store.filter,
          background: isDark ? '#09090B' : '#F4F4F6'
        });
        if (ok) {
          showToast('Đã sao chép ảnh so sánh vào Clipboard', 'success');
        } else {
          showToast('Trình duyệt không hỗ trợ chép ảnh nhị phân, đang tải về...', 'info');
          await downloadComparisonImage(store.panes, store.layout, {
            sliderPos: store.sliderPos,
            diffMultiplier: store.diffMultiplier,
            filter: store.filter,
            background: isDark ? '#09090B' : '#F4F4F6'
          });
        }
        break;
      }

      case 'download-composite': {
        showToast('Đang tải ảnh so sánh...', 'info');
        const isDark = document.documentElement.classList.contains('dark');
        await downloadComparisonImage(store.panes, store.layout, {
          sliderPos: store.sliderPos,
          diffMultiplier: store.diffMultiplier,
          filter: store.filter,
          background: isDark ? '#09090B' : '#F4F4F6'
        });
        break;
      }

      case 'open-url-modal': {
        const paneId = parseInt(btn.dataset.paneId, 10) || store.activePaneId;
        store.setActivePane(paneId);
        syncActivePaneUI(paneId);
        store.openUrlModal(paneId);
        onReRender();
        loadDriveFiles();
        break;
      }

      case 'close-url-modal': {
        store.closeUrlModal();
        onReRender();
        break;
      }

      case 'load-url': {
        const inputUrl = document.getElementById('viewsplit-input-url');
        const url = inputUrl?.value?.trim();
        if (!url) {
          showToast('Vui lòng nhập liên kết hình ảnh (URL)', 'warning');
          return;
        }
        showToast('Đang nạp ảnh từ URL...', 'info');
        const fileName = url.split('/').pop()?.split('?')[0] || 'Ảnh từ URL';
        const targetId = store.urlModalTargetPaneId;
        store.closeUrlModal();
        await loadFileIntoPane(url, targetId, { name: fileName });
        break;
      }

      case 'refresh-drive': {
        loadDriveFiles();
        break;
      }

      case 'set-mobile-tab': {
        const paneId = parseInt(btn.dataset.paneId, 10);
        store.setMobileActiveTab(paneId);
        store.setActivePane(paneId);
        syncActivePaneUI(paneId);
        onReRender();
        break;
      }
    }
  };

  // ─── 7. Range Input Handlers (Diff Multiplier) ───
  const onInput = (e) => {
    if (e.target.dataset.action === 'set-diff-multiplier') {
      store.setDiffMultiplier(parseInt(e.target.value, 10));
    }
  };

  // ─── 8. File Input Change Listeners ───
  const onFileInputChange = (e) => {
    if (e.target.classList.contains('viewsplit-file-input')) {
      const paneId = parseInt(e.target.dataset.paneId, 10);
      const file = e.target.files?.[0];
      if (file) {
        loadFileIntoPane(file, paneId);
      }
    }
  };

  // ─── 9. Drag & Drop File Handling ───
  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const targetPaneEl = e.target.closest('.viewsplit-pane');
    if (targetPaneEl) {
      const targetId = parseInt(targetPaneEl.dataset.paneId, 10);
      await loadFileIntoPane(files[0], targetId);
    } else if (e.target.closest('.viewsplit-overlay-container, #viewsplit-overlay-canvas')) {
      await loadFileIntoPane(files[0], store.activePaneId);
    } else {
      // Distribute multiple files across panes sequentially
      const maxPanes = store.getVisiblePaneCount();
      for (let idx = 0; idx < Math.min(files.length, maxPanes); idx++) {
        await loadFileIntoPane(files[idx], idx + 1);
      }
    }
  };

  // ─── 10. Global Paste Event (Ctrl+V) ───
  let lastGlobalPasteTs = 0;
  const onGlobalPaste = async (e) => {
    // Skip if typing in an input or editable field
    if (e.target && (e.target.matches?.('input, textarea') || e.target.isContentEditable)) return;

    // Deduplicate rapid dual events from window & document
    const now = Date.now();
    if (now - lastGlobalPasteTs < 300) return;

    let imageFile = null;

    // A. Check clipboardData.items
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          imageFile = items[i].getAsFile();
          if (imageFile) break;
        }
      }
    }

    // B. Fallback: check clipboardData.files (e.g. copied from file explorer or browser image)
    if (!imageFile && e.clipboardData?.files) {
      const files = Array.from(e.clipboardData.files);
      imageFile = files.find((f) => f.type && f.type.startsWith('image/')) || null;
    }

    if (imageFile) {
      e.preventDefault();
      lastGlobalPasteTs = now;
      const visibleCount = store.getVisiblePaneCount();
      const targetId = (store.activePaneId >= 1 && store.activePaneId <= visibleCount)
        ? store.activePaneId
        : 1;
      await loadFileIntoPane(imageFile, targetId, { name: imageFile.name || 'Ảnh đã dán' });
    }
  };

  // ─── 11. Keyboard Shortcuts ───
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.id === 'viewsplit-input-url') {
      e.preventDefault();
      const btn = document.getElementById('viewsplit-btn-load-url');
      if (btn) btn.click();
      return;
    }

    if (e.target.matches('input, textarea')) return;

    const key = e.key.toLowerCase();
    if (key === 'f') {
      store.fitAll();
    } else if (key === '1') {
      store.actualSize();
    } else if (key === 'r') {
      store.resetView();
    } else if (key === 's') {
      store.toggleSyncView();
      onReRender();
    } else if (key === 'c') {
      store.toggleSyncCursor();
      onReRender();
    } else if (key === 'n') {
      store.toggleFilter();
      onReRender();
    } else if (key === 'i') {
      store.toggleInspector();
      onReRender();
    }
  };

  // ─── 12. Storage Drive & URL Modal Loader ───
  const loadDriveFiles = async () => {
    const listContainer = document.getElementById('viewsplit-drive-items-list');
    if (!listContainer) return;

    try {
      const result = await StorageService.fetchList('/');
      const items = (result?.items || []).filter((item) => {
        if (item.isDirectory) return false;
        const ext = (item.extension || '').toLowerCase();
        return ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp'].includes(ext);
      });

      if (items.length === 0) {
        listContainer.innerHTML = `
          <div class="p-3 text-center text-zinc-500 text-xs">
            Không tìm thấy tệp ảnh nào trong Storage Drive.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = items.map((item) => `
        <div
          class="viewsplit-drive-item flex items-center justify-between p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition cursor-pointer"
          data-drive-path="${item.path}"
          data-drive-name="${item.name}"
        >
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="image" class="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0"></i>
            <span class="truncate text-zinc-800 dark:text-zinc-200 text-xs">${item.name}</span>
          </div>
          <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">${item.sizeFormatted || ''}</span>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons({ root: listContainer });
    } catch (err) {
      listContainer.innerHTML = `
        <div class="p-3 text-center text-zinc-500 text-xs">
          Không thể kết nối danh sách Storage Drive (yêu cầu đăng nhập hoặc không khả dụng).
        </div>
      `;
    }
  };

  // Attach all window/document listeners
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  window.addEventListener('mousedown', onSliderMouseDown);
  window.addEventListener('mousemove', onSliderMouseMove);
  window.addEventListener('mouseup', onSliderMouseUp);

  window.addEventListener('mousedown', onHudMouseDown);
  window.addEventListener('mousemove', onHudMouseMove);
  window.addEventListener('mouseup', onHudMouseUp);

  window.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);

  window.addEventListener('touchstart', onSliderTouchStart, { passive: false });
  window.addEventListener('touchmove', onSliderTouchMove, { passive: false });
  window.addEventListener('touchend', onSliderTouchEnd);

  window.addEventListener('touchstart', onHudTouchStart, { passive: false });
  window.addEventListener('touchmove', onHudTouchMove, { passive: false });
  window.addEventListener('touchend', onHudTouchEnd);

  window.addEventListener('mouseleave', onWindowMouseLeave);

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onFileInputChange);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('drop', onDrop);
  window.addEventListener('paste', onGlobalPaste);
  document.addEventListener('paste', onGlobalPaste);
  window.addEventListener('keydown', onKeyDown);

  // Return cleanup function
  return () => {
    isAlive = false;
    if (rafId) cancelAnimationFrame(rafId);

    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    window.removeEventListener('mousedown', onSliderMouseDown);
    window.removeEventListener('mousemove', onSliderMouseMove);
    window.removeEventListener('mouseup', onSliderMouseUp);

    window.removeEventListener('mousedown', onHudMouseDown);
    window.removeEventListener('mousemove', onHudMouseMove);
    window.removeEventListener('mouseup', onHudMouseUp);

    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);

    window.removeEventListener('touchstart', onSliderTouchStart);
    window.removeEventListener('touchmove', onSliderTouchMove);
    window.removeEventListener('touchend', onSliderTouchEnd);

    window.removeEventListener('touchstart', onHudTouchStart);
    window.removeEventListener('touchmove', onHudTouchMove);
    window.removeEventListener('touchend', onHudTouchEnd);

    window.removeEventListener('mouseleave', onWindowMouseLeave);

    document.removeEventListener('click', onClick);
    document.removeEventListener('input', onInput);
    document.removeEventListener('change', onFileInputChange);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('drop', onDrop);
    window.removeEventListener('paste', onGlobalPaste);
    document.removeEventListener('paste', onGlobalPaste);
    window.removeEventListener('keydown', onKeyDown);
  };
}
