/**
 * Pointer Drag-and-Drop Reorder Utility (< 250 lines)
 * Zero-dependency Fluid Reordering Engine for Touch and Mouse
 * Leveraging Pointer Events, 60fps GPU transforms, and Haptic Feedback.
 */

import { triggerHaptic } from './swipeGesture.js';

/**
 * Computes the target drop index based on pointer Y coordinate and item midpoint rects (1D compatibility).
 * @param {number} pointerY - Current client Y position of pointer
 * @param {Array<{ index: number, midY: number, top: number, bottom: number }>} itemRects - Measured rects
 * @param {number} currentIndex - Index of the item currently being dragged
 * @returns {number} Target index
 */
export function computeDropIndex(pointerY, itemRects = [], currentIndex = 0) {
  if (!itemRects || itemRects.length <= 1) return currentIndex;

  const validRects = itemRects.filter((r) => r && typeof r.midY === 'number');
  if (validRects.length <= 1) return currentIndex;

  if (pointerY <= validRects[0].midY) return validRects[0].index !== undefined ? validRects[0].index : 0;
  const lastIdx = validRects.length - 1;
  if (pointerY >= validRects[lastIdx].midY) return validRects[lastIdx].index !== undefined ? validRects[lastIdx].index : lastIdx;

  for (let i = 0; i < lastIdx; i++) {
    const curr = validRects[i];
    const next = validRects[i + 1];
    if (pointerY >= curr.midY && pointerY <= next.midY) {
      const distToCurr = Math.abs(pointerY - curr.midY);
      const distToNext = Math.abs(pointerY - next.midY);
      return distToCurr < distToNext ? (curr.index !== undefined ? curr.index : i) : (next.index !== undefined ? next.index : i + 1);
    }
  }

  return currentIndex;
}

/**
 * Computes the target drop index based on 2D pointer coordinates (X, Y) for multi-column grids or lists.
 * @param {number} pointerX - Current client X position of pointer
 * @param {number} pointerY - Current client Y position of pointer
 * @param {Array<{ index: number, left: number, right: number, top: number, bottom: number, midX: number, midY: number }>} itemRects - Measured rects
 * @param {number} currentIndex - Index of the item currently being dragged
 * @returns {number} Target index
 */
export function computeDropIndex2D(pointerX, pointerY, itemRects = [], currentIndex = 0) {
  if (!itemRects || itemRects.length <= 1) return currentIndex;
  if (typeof pointerX !== 'number' || isNaN(pointerX) || typeof pointerY !== 'number' || isNaN(pointerY)) {
    return currentIndex;
  }

  // Pass 1: Direct bounding box collision
  for (let i = 0; i < itemRects.length; i++) {
    const r = itemRects[i];
    if (!r) continue;
    if (pointerX >= r.left && pointerX <= r.right && pointerY >= r.top && pointerY <= r.bottom) {
      return r.index !== undefined ? r.index : i;
    }
  }

  // Pass 2: Euclidean distance to nearest slot midpoint (for gutters and margins)
  let closestIdx = currentIndex;
  let minDistanceSq = Infinity;

  for (let i = 0; i < itemRects.length; i++) {
    const r = itemRects[i];
    if (!r) continue;
    const midX = r.midX !== undefined ? r.midX : ((r.left ?? 0) + (r.width || 0) / 2);
    const midY = r.midY !== undefined ? r.midY : ((r.top ?? 0) + (r.height || 0) / 2);
    const distSq = (pointerX - midX) ** 2 + (pointerY - midY) ** 2;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestIdx = r.index !== undefined ? r.index : i;
    }
  }

  return closestIdx;
}

/**
 * Attaches pointer-based list or grid reordering to a container.
 * Supports 2D vector coordinate tracking for multi-column grids and 1D lists.
 * @param {HTMLElement} container - The container holding reorderable items
 * @param {Object} options
 * @param {string} [options.itemSelector='.pdf-file-row-wrapper'] - Selector for item rows
 * @param {string} [options.handleSelector='.drag-grip-handle'] - Selector for grip handle
 * @param {Function} [options.onReorder] - (fromIndex, toIndex) => void
 * @param {Function} [options.onDragStart] - (index, item) => void
 * @param {Function} [options.onDragEnd] - (fromIndex, toIndex, item) => void
 * @returns {Function} cleanup - Function to unbind all listeners
 */
export function attachPointerReorder(container, {
  itemSelector = '.pdf-file-row-wrapper',
  handleSelector = '.drag-grip-handle',
  onReorder = null,
  onDragStart = null,
  onDragEnd = null
} = {}) {
  if (!container) return () => {};

  if (typeof container._cleanupPointerReorder === 'function') {
    try { container._cleanupPointerReorder(); } catch {}
  }

  let isDragging = false;
  let activePointerId = null;
  let draggedItem = null;
  let activeHandle = null;
  let fromIndex = -1;
  let currentTargetIndex = -1;
  let startPointerX = 0;
  let startPointerY = 0;
  let itemRects = [];
  let itemElements = [];

  const targetWindow = typeof window !== 'undefined' ? window : (container?.ownerDocument?.defaultView || null);

  const addDragListeners = () => {
    if (targetWindow) {
      targetWindow.addEventListener('pointermove', onPointerMove, { passive: false });
      targetWindow.addEventListener('pointerup', onPointerEnd);
      targetWindow.addEventListener('pointercancel', onPointerEnd);
    }
  };

  const removeDragListeners = () => {
    if (targetWindow) {
      targetWindow.removeEventListener('pointermove', onPointerMove);
      targetWindow.removeEventListener('pointerup', onPointerEnd);
      targetWindow.removeEventListener('pointercancel', onPointerEnd);
    }
  };

  const updateSiblingShifts = (targetIdx) => {
    itemElements.forEach((el, idx) => {
      if (idx === fromIndex) return;
      el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';

      let targetSlot = idx;
      if (fromIndex < targetIdx) {
        if (idx > fromIndex && idx <= targetIdx) {
          targetSlot = idx - 1;
        }
      } else if (fromIndex > targetIdx) {
        if (idx >= targetIdx && idx < fromIndex) {
          targetSlot = idx + 1;
        }
      }

      if (targetSlot !== idx && itemRects[targetSlot] && itemRects[idx]) {
        const shiftX = itemRects[targetSlot].left - itemRects[idx].left;
        const shiftY = itemRects[targetSlot].top - itemRects[idx].top;
        el.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
      } else {
        el.style.transform = 'translate(0px, 0px)';
      }
    });
  };

  const resetAllTransforms = () => {
    itemElements.forEach((el) => {
      el.style.transform = '';
      el.style.transition = '';
    });
    if (draggedItem) {
      draggedItem.style.position = '';
      draggedItem.style.zIndex = '';
      draggedItem.style.boxShadow = '';
      draggedItem.style.transform = '';
      draggedItem.style.transition = '';
      draggedItem.style.willChange = '';
      draggedItem.classList.remove('ring-2', 'ring-amber-500', 'shadow-xl', 'scale-[1.01]', 'scale-[1.02]');
    }
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;

    const handle = e.target.closest(handleSelector);
    if (!handle || !container.contains(handle)) return;

    const item = handle.closest(itemSelector);
    if (!item || !container.contains(item)) return;

    itemElements = Array.from(container.querySelectorAll(itemSelector));
    fromIndex = itemElements.indexOf(item);
    if (fromIndex === -1 || itemElements.length <= 1) return;

    e.preventDefault();
    isDragging = true;
    activePointerId = e.pointerId;
    draggedItem = item;
    activeHandle = handle;
    currentTargetIndex = fromIndex;
    startPointerX = e.clientX ?? 0;
    startPointerY = e.clientY ?? 0;

    addDragListeners();

    try {
      activeHandle.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    triggerHaptic(15);

    // Measure 2D bounding boxes of all sibling items
    itemRects = itemElements.map((el, i) => {
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
      return {
        index: i,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        midX: rect.left + rect.width / 2,
        midY: rect.top + rect.height / 2
      };
    });

    // Apply visual elevation to dragged item
    draggedItem.style.zIndex = '40';
    draggedItem.style.transition = 'none';
    draggedItem.classList.add('ring-2', 'ring-amber-500', 'shadow-xl', 'scale-[1.02]');

    if (onDragStart) onDragStart(fromIndex, draggedItem);
  };

  const onPointerMove = (e) => {
    if (!isDragging || e.pointerId !== activePointerId || !draggedItem) return;
    if (e.cancelable) e.preventDefault();

    const clientX = e.clientX ?? 0;
    const clientY = e.clientY ?? 0;
    const dx = clientX - startPointerX;
    const dy = clientY - startPointerY;
    draggedItem.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
    draggedItem.style.willChange = 'transform';

    const targetIdx = computeDropIndex2D(clientX, clientY, itemRects, fromIndex);
    if (targetIdx !== currentTargetIndex) {
      currentTargetIndex = targetIdx;
      triggerHaptic(10);
      updateSiblingShifts(targetIdx);
    }
  };

  const onPointerEnd = (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    isDragging = false;
    removeDragListeners();

    try {
      activeHandle?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    const finalFrom = fromIndex;
    const finalTo = currentTargetIndex;
    const item = draggedItem;

    resetAllTransforms();

    activePointerId = null;
    draggedItem = null;
    activeHandle = null;
    fromIndex = -1;
    currentTargetIndex = -1;

    if (onDragEnd) onDragEnd(finalFrom, finalTo, item);

    if (e.type !== 'pointercancel' && finalTo !== -1 && finalTo !== finalFrom) {
      triggerHaptic([15, 25]);
      if (onReorder) {
        onReorder(finalFrom, finalTo);
      }
    }
  };

  container.addEventListener('pointerdown', onPointerDown);

  const cleanup = () => {
    removeDragListeners();
    container.removeEventListener('pointerdown', onPointerDown);
    resetAllTransforms();
    if (container._cleanupPointerReorder === cleanup) {
      delete container._cleanupPointerReorder;
    }
  };

  container._cleanupPointerReorder = cleanup;

  return cleanup;
}
