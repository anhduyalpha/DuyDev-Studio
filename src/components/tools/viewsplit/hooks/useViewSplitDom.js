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
  const activeBlobUrls = new Set();
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

  const loadFileIntoPane = async (file, paneId) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Tệp được chọn không phải là hình ảnh hợp lệ', 'warning');
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    activeBlobUrls.add(blobUrl);

    try {
      const img = await loadImageSource(blobUrl);
      store.setImageForPane(paneId, img, { name: file.name, size: file.size });
      const paneTitle = PANE_TITLES[paneId - 1] || `Ảnh ${paneId}`;
      showToast(`Đã nạp ${file.name} vào ${paneTitle}`, 'success');
      onReRender();
    } catch (err) {
      console.error('[ViewSplit] Error loading file:', err);
      showToast('Lỗi khi nạp ảnh từ tệp tin', 'error');
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
    // If clicking slider divider, handled separately
    if (e.target.closest('#viewsplit-slider-divider')) return;

    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (!canvas || e.button !== 0) return;

    const paneId = canvas.id === 'viewsplit-overlay-canvas' ? 1 : parseInt(canvas.dataset.paneId, 10);
    const pane = store.getPane(paneId);
    if (!pane) return;

    store.setActivePane(pane.id);

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
    const canvas = e.target.closest('.viewsplit-canvas, #viewsplit-overlay-canvas');
    if (!canvas) return;

    const paneId = canvas.id === 'viewsplit-overlay-canvas' ? 1 : parseInt(canvas.dataset.paneId, 10);
    const pane = store.getPane(paneId);
    if (!pane) return;

    store.setActivePane(pane.id);

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
      try {
        const img = await loadImageSource(imgUrl);
        store.setImageForPane(store.urlModalTargetPaneId, img, { name });
        store.closeUrlModal();
        showToast(`Đã nạp ${name} từ Storage Drive`, 'success');
        onReRender();
      } catch (err) {
        showToast('Không thể tải tệp từ Storage Drive', 'error');
      }
      return;
    }

    const btn = e.target.closest('button, [data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;

    e.preventDefault();

    switch (action) {
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
        const paneId = parseInt(btn.dataset.paneId, 10);
        const input = document.querySelector(`.viewsplit-file-input[data-pane-id="${paneId}"]`);
        if (input) input.click();
        break;
      }

      case 'paste-clipboard': {
        const paneId = parseInt(btn.dataset.paneId, 10);
        try {
          if (navigator.clipboard && navigator.clipboard.read) {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              const imageType = item.types.find((t) => t.startsWith('image/'));
              if (imageType) {
                const blob = await item.getType(imageType);
                await loadFileIntoPane(blob, paneId);
                return;
              }
            }
          }
          showToast('Nhấn Ctrl+V để dán ảnh trực tiếp từ bộ nhớ tạm', 'info');
        } catch (err) {
          showToast('Vui lòng cấp quyền Clipboard hoặc nhấn Ctrl+V', 'warning');
        }
        break;
      }

      case 'clear-pane': {
        const paneId = parseInt(btn.dataset.paneId, 10);
        store.clearPane(paneId);
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
        const ok = await copyComparisonImageToClipboard(store.panes, store.layout, {
          sliderPos: store.sliderPos,
          diffMultiplier: store.diffMultiplier,
          filter: store.filter
        });
        if (ok) {
          showToast('Đã sao chép ảnh so sánh vào Clipboard', 'success');
        } else {
          showToast('Trình duyệt không hỗ trợ chép ảnh nhị phân, đang tải về...', 'info');
          await downloadComparisonImage(store.panes, store.layout, {
            sliderPos: store.sliderPos,
            diffMultiplier: store.diffMultiplier,
            filter: store.filter
          });
        }
        break;
      }

      case 'download-composite': {
        showToast('Đang tải ảnh so sánh...', 'info');
        await downloadComparisonImage(store.panes, store.layout, {
          sliderPos: store.sliderPos,
          diffMultiplier: store.diffMultiplier,
          filter: store.filter
        });
        break;
      }

      case 'open-url-modal': {
        const paneId = parseInt(btn.dataset.paneId, 10);
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
        try {
          showToast('Đang nạp ảnh từ URL...', 'info');
          const img = await loadImageSource(url);
          const fileName = url.split('/').pop()?.split('?')[0] || 'Ảnh từ URL';
          store.setImageForPane(store.urlModalTargetPaneId, img, { name: fileName });
          store.closeUrlModal();
          showToast(`Đã nạp ${fileName} từ URL`, 'success');
          onReRender();
        } catch (err) {
          showToast('Không thể nạp ảnh từ URL chỉ định', 'error');
        }
        break;
      }

      case 'refresh-drive': {
        loadDriveFiles();
        break;
      }

      case 'set-mobile-tab': {
        const paneId = parseInt(btn.dataset.paneId, 10);
        store.setMobileActiveTab(paneId);
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

  const onDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const targetPaneEl = e.target.closest('.viewsplit-pane');
    if (targetPaneEl) {
      const targetId = parseInt(targetPaneEl.dataset.paneId, 10);
      loadFileIntoPane(files[0], targetId);
    } else {
      // Distribute multiple files across panes
      files.slice(0, 4).forEach((file, idx) => {
        loadFileIntoPane(file, idx + 1);
      });
    }
  };

  // ─── 10. Global Paste Event (Ctrl+V) ───
  const onGlobalPaste = async (e) => {
    // Skip if typing in an input
    if (e.target.matches('input, textarea')) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await loadFileIntoPane(file, store.activePaneId);
          return;
        }
      }
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
          class="viewsplit-drive-item flex items-center justify-between p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
          data-drive-path="${item.path}"
          data-drive-name="${item.name}"
        >
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="image" class="w-4 h-4 text-cyan-400 shrink-0"></i>
            <span class="truncate text-zinc-200 text-xs">${item.name}</span>
          </div>
          <span class="text-[10px] text-zinc-500 font-mono shrink-0">${item.sizeFormatted || ''}</span>
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
  window.addEventListener('keydown', onKeyDown);

  // Return cleanup function
  return () => {
    isAlive = false;
    if (rafId) cancelAnimationFrame(rafId);

    activeBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    activeBlobUrls.clear();

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
    window.removeEventListener('keydown', onKeyDown);
  };
}
