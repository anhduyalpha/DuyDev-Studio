/**
 * Pointer Drag-and-Drop Reorder Utility (< 250 lines)
 * Zero-dependency Fluid Reordering Engine for Touch and Mouse
 * Leveraging Pointer Events, 60fps GPU transforms, and Haptic Feedback.
 */

import { triggerHaptic } from './swipeGesture.js';

/**
 * Computes the target drop index based on pointer Y coordinate and item midpoint rects.
 * @param {number} pointerY - Current client Y position of pointer
 * @param {Array<{ index: number, midY: number, top: number, bottom: number }>} itemRects - Measured rects
 * @param {number} currentIndex - Index of the item currently being dragged
 * @returns {number} Target index
 */
export function computeDropIndex(pointerY, itemRects = [], currentIndex = 0) {
  if (!itemRects || itemRects.length <= 1) return currentIndex;

  if (pointerY <= itemRects[0].midY) return 0;
  const lastIdx = itemRects.length - 1;
  if (pointerY >= itemRects[lastIdx].midY) return lastIdx;

  for (let i = 0; i < lastIdx; i++) {
    const curr = itemRects[i];
    const next = itemRects[i + 1];
    if (pointerY >= curr.midY && pointerY <= next.midY) {
      // Determine which midpoint is closer
      const distToCurr = Math.abs(pointerY - curr.midY);
      const distToNext = Math.abs(pointerY - next.midY);
      return distToCurr < distToNext ? curr.index : next.index;
    }
  }

  return currentIndex;
}

/**
 * Attaches pointer-based list reordering to a container.
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

  let isDragging = false;
  let activePointerId = null;
  let draggedItem = null;
  let activeHandle = null;
  let fromIndex = -1;
  let currentTargetIndex = -1;
  let startPointerY = 0;
  let itemRects = [];
  let itemElements = [];
  let itemHeight = 60;

  const updateSiblingShifts = (targetIdx) => {
    itemElements.forEach((el, idx) => {
      if (idx === fromIndex) return;
      el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
      if (fromIndex < targetIdx) {
        if (idx > fromIndex && idx <= targetIdx) {
          el.style.transform = `translateY(-${itemHeight}px)`;
        } else {
          el.style.transform = 'translateY(0px)';
        }
      } else if (fromIndex > targetIdx) {
        if (idx >= targetIdx && idx < fromIndex) {
          el.style.transform = `translateY(${itemHeight}px)`;
        } else {
          el.style.transform = 'translateY(0px)';
        }
      } else {
        el.style.transform = 'translateY(0px)';
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
      draggedItem.classList.remove('ring-2', 'ring-amber-500', 'shadow-xl', 'scale-[1.01]');
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
    startPointerY = e.clientY;

    try {
      activeHandle.setPointerCapture?.(e.pointerId);
    } catch (_) {}

    triggerHaptic(15);

    // Measure bounding rectangles of items
    itemRects = itemElements.map((el, i) => {
      const rect = el.getBoundingClientRect();
      return {
        index: i,
        top: rect.top,
        bottom: rect.bottom,
        midY: rect.top + rect.height / 2,
        height: rect.height
      };
    });

    itemHeight = itemRects[fromIndex]?.height || 64;

    // Apply visual lifting to dragged item
    draggedItem.style.zIndex = '40';
    draggedItem.style.transition = 'none';
    draggedItem.classList.add('ring-2', 'ring-amber-500', 'shadow-xl', 'scale-[1.01]');

    if (onDragStart) onDragStart(fromIndex, draggedItem);
  };

  const onPointerMove = (e) => {
    if (!isDragging || e.pointerId !== activePointerId || !draggedItem) return;
    if (e.cancelable) e.preventDefault();

    const dy = e.clientY - startPointerY;
    draggedItem.style.transform = `translateY(${dy}px) scale(1.01)`;
    draggedItem.style.willChange = 'transform';

    const targetIdx = computeDropIndex(e.clientY, itemRects, fromIndex);
    if (targetIdx !== currentTargetIndex) {
      currentTargetIndex = targetIdx;
      triggerHaptic(10);
      updateSiblingShifts(targetIdx);
    }
  };

  const onPointerEnd = (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    isDragging = false;

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
  const targetWindow = typeof window !== 'undefined' ? window : (container?.ownerDocument?.defaultView || null);
  if (targetWindow) {
    targetWindow.addEventListener('pointermove', onPointerMove, { passive: false });
    targetWindow.addEventListener('pointerup', onPointerEnd);
    targetWindow.addEventListener('pointercancel', onPointerEnd);
  }

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    if (targetWindow) {
      targetWindow.removeEventListener('pointermove', onPointerMove);
      targetWindow.removeEventListener('pointerup', onPointerEnd);
      targetWindow.removeEventListener('pointercancel', onPointerEnd);
    }
    resetAllTransforms();
  };
}
