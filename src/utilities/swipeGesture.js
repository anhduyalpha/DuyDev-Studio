/**
 * Swipe Gesture Utility (< 250 lines)
 * Zero-dependency Touch & Pointer Swipe Engine with Dual-Axis Touch Slop,
 * Threshold Math, Haptic Feedback, and Slide-to-Clear.
 */

/**
 * Safely triggers haptic feedback via Navigator Vibration API if supported.
 * @param {number|number[]} pattern - Vibration duration in ms or pattern array
 * @returns {boolean} Whether vibration was requested
 */
export function triggerHaptic(pattern = 15) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch (_) {
    // Graceful fallback for browsers with restricted permissions
  }
  return false;
}

/**
 * Evaluates whether movement has exited the touch slop window and disambiguates axis.
 * Yields immediately to native scrolling when vertical delta dominates (|dy| >= |dx|).
 * @param {number} dx - Horizontal pointer delta
 * @param {number} dy - Vertical pointer delta
 * @param {number} slopThreshold - Pixel threshold (default: 8px)
 * @returns {{ resolved: boolean, isHorizontal: boolean }}
 */
export function isTouchSlopDisambiguated(dx, dy, slopThreshold = 8) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < slopThreshold && absY < slopThreshold) {
    return { resolved: false, isHorizontal: false };
  }
  if (absY >= absX) {
    return { resolved: true, isHorizontal: false };
  }
  return { resolved: true, isHorizontal: true };
}

/**
 * Computes swipe distance, clamping, threshold target, and triggered state.
 * @param {Object} params
 * @param {number} params.dx - Horizontal delta
 * @param {number} [params.width=300] - Element width
 * @param {number} [params.thresholdRatio=0.35] - Fraction of element width
 * @param {number} [params.thresholdPx=100] - Minimum pixel distance
 * @param {string} [params.direction='left'] - 'left' | 'right' | 'both'
 * @returns {{ distance: number, clampedDx: number, threshold: number, isTriggered: boolean, ratio: number }}
 */
export function calculateSwipeState({
  dx,
  width = 300,
  thresholdRatio = 0.35,
  thresholdPx = 100,
  direction = 'left'
}) {
  let clampedDx = 0;
  let distance = 0;

  if (direction === 'left') {
    clampedDx = Math.min(0, dx);
    distance = Math.abs(clampedDx);
  } else if (direction === 'right') {
    clampedDx = Math.max(0, dx);
    distance = clampedDx;
  } else {
    clampedDx = dx;
    distance = Math.abs(clampedDx);
  }

  const effectiveWidth = Math.max(1, width);
  const threshold = Math.min(effectiveWidth, Math.max(thresholdPx, effectiveWidth * thresholdRatio));
  const isTriggered = distance >= threshold;
  const ratio = Math.min(1, distance / effectiveWidth);

  return { distance, clampedDx, threshold, isTriggered, ratio };
}

/**
 * Attaches swipe-to-dismiss gesture to a list row element.
 * @param {HTMLElement} element - Foreground swipable element
 * @param {Object} options
 * @param {string} [options.direction='left'] - Swipe direction
 * @param {number} [options.thresholdRatio=0.35] - Width ratio threshold
 * @param {number} [options.thresholdPx=100] - Min px threshold
 * @param {number} [options.touchSlop=8] - Touch slop window
 * @param {HTMLElement} [options.wrapperElement] - Outer container to collapse
 * @param {Function} [options.onProgress] - ({ distance, ratio, isTriggered, clampedDx }) => void
 * @param {Function} [options.onComplete] - (element) => void
 * @param {Function} [options.onCancel] - (element) => void
 * @returns {Function} cleanup - Function to unbind all listeners
 */
export function attachSwipeToDismiss(element, {
  direction = 'left',
  thresholdRatio = 0.35,
  thresholdPx = 100,
  touchSlop = 8,
  wrapperElement = null,
  onProgress = null,
  onComplete = null,
  onCancel = null
} = {}) {
  if (!element) return () => {};

  const wrapper = wrapperElement || element.closest('.pdf-file-row-wrapper') || element.parentElement;
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let isTracking = false;
  let directionLocked = false;
  let hasTicked = false;

  const onPointerDown = (e) => {
    // Only primary mouse click or touch pointer
    if (e.button !== undefined && e.button !== 0) return;
    // Don't intercept button/input clicks or drag reorder handles
    if (e.target.closest('button, input, a, .drag-grip-handle, [data-drag-handle]')) return;

    startX = e.clientX;
    startY = e.clientY;
    pointerId = e.pointerId;
    isTracking = true;
    directionLocked = false;
    hasTicked = false;
    element.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!isTracking || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!directionLocked) {
      const slop = isTouchSlopDisambiguated(dx, dy, touchSlop);
      if (!slop.resolved) return;
      if (!slop.isHorizontal) {
        // Vertical scroll dominates: yield immediately to native browser scrolling
        isTracking = false;
        return;
      }
      directionLocked = true;
      try {
        element.setPointerCapture?.(e.pointerId);
      } catch (_) {}
    }

    if (e.cancelable) e.preventDefault();

    const width = element.offsetWidth || 300;
    const state = calculateSwipeState({ dx, width, thresholdRatio, thresholdPx, direction });

    element.style.transform = `translateX(${state.clampedDx}px)`;
    element.style.willChange = 'transform';

    if (state.isTriggered && !hasTicked) {
      hasTicked = true;
      triggerHaptic(12);
    } else if (!state.isTriggered && hasTicked) {
      hasTicked = false;
    }

    if (onProgress) onProgress(state);
  };

  const onPointerEnd = (e) => {
    if (!isTracking || e.pointerId !== pointerId) return;
    isTracking = false;

    try {
      element.releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    if (!directionLocked) return;
    directionLocked = false;

    const dx = e.clientX - startX;
    const width = element.offsetWidth || 300;
    const state = calculateSwipeState({ dx, width, thresholdRatio, thresholdPx, direction });

    if (state.isTriggered && e.type !== 'pointercancel') {
      triggerHaptic([15, 30, 15]);

      // Step 1: Slide element off screen
      element.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
      element.style.transform = direction === 'left' ? 'translateX(-105%)' : 'translateX(105%)';
      element.style.opacity = '0';

      // Step 2: Smooth height collapse of wrapper
      setTimeout(() => {
        if (wrapper && wrapper.isConnected) {
          const originalHeight = wrapper.offsetHeight;
          wrapper.style.maxHeight = `${originalHeight}px`;
          wrapper.style.transition = 'max-height 0.22s ease-out, opacity 0.2s ease-out, margin 0.22s ease-out, padding 0.22s ease-out';
          // Force layout reflow
          void wrapper.offsetHeight;
          wrapper.style.maxHeight = '0px';
          wrapper.style.opacity = '0';
          wrapper.style.marginTop = '0px';
          wrapper.style.marginBottom = '0px';
          wrapper.style.paddingTop = '0px';
          wrapper.style.paddingBottom = '0px';
          setTimeout(() => {
            if (onComplete) onComplete(element);
          }, 220);
        } else {
          if (onComplete) onComplete(element);
        }
      }, 160);
    } else {
      // Spring back to origin
      element.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
      element.style.transform = 'translateX(0px)';
      if (onCancel) onCancel(element);
      setTimeout(() => {
        element.style.transition = '';
        element.style.willChange = '';
      }, 220);
    }
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerEnd);
    element.removeEventListener('pointercancel', onPointerEnd);
  };
}

/**
 * Attaches an ergonomic slide-to-confirm gesture (Slide-to-Clear All) to a toolbar track.
 * @param {HTMLElement} trackElement - Background container track
 * @param {HTMLElement} thumbElement - Draggable thumb icon
 * @param {Object} options
 * @param {number} [options.thresholdRatio=0.70] - Fraction of track width required
 * @param {HTMLElement} [options.fillElement] - Background color fill element
 * @param {HTMLElement} [options.labelElement] - Centered instruction text
 * @param {Function} [options.onClear] - Invoked when cleared successfully
 * @returns {Function} cleanup
 */
export function attachSlideToClear(trackElement, thumbElement, {
  thresholdRatio = 0.70,
  fillElement = null,
  labelElement = null,
  onClear = null
} = {}) {
  if (!trackElement || !thumbElement) return () => {};

  let startX = 0;
  let pointerId = null;
  let isDragging = false;
  let hasTicked = false;

  const getMaxTranslate = () => {
    const trackWidth = trackElement.offsetWidth || 200;
    const thumbWidth = thumbElement.offsetWidth || 36;
    return Math.max(10, trackWidth - thumbWidth - 8);
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    startX = e.clientX;
    pointerId = e.pointerId;
    isDragging = true;
    hasTicked = false;
    thumbElement.style.transition = 'none';
    if (fillElement) fillElement.style.transition = 'none';
    try {
      thumbElement.setPointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!isDragging || e.pointerId !== pointerId) return;
    if (e.cancelable) e.preventDefault();

    const maxTranslate = getMaxTranslate();
    const rawDx = e.clientX - startX;
    const clampedDx = Math.max(0, Math.min(rawDx, maxTranslate));
    const ratio = clampedDx / maxTranslate;

    thumbElement.style.transform = `translateX(${clampedDx}px)`;
    if (fillElement) {
      fillElement.style.width = `${clampedDx + (thumbElement.offsetWidth || 36)}px`;
    }
    if (labelElement) {
      labelElement.style.opacity = `${Math.max(0, 1 - ratio * 1.5)}`;
    }

    if (ratio >= thresholdRatio && !hasTicked) {
      hasTicked = true;
      triggerHaptic(15);
    } else if (ratio < thresholdRatio && hasTicked) {
      hasTicked = false;
    }
  };

  const onPointerEnd = (e) => {
    if (!isDragging || e.pointerId !== pointerId) return;
    isDragging = false;

    try {
      thumbElement.releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    const maxTranslate = getMaxTranslate();
    const rawDx = e.clientX - startX;
    const clampedDx = Math.max(0, Math.min(rawDx, maxTranslate));
    const ratio = clampedDx / maxTranslate;

    if (ratio >= thresholdRatio && e.type !== 'pointercancel') {
      triggerHaptic([15, 30, 15]);
      thumbElement.style.transition = 'transform 0.15s ease-out';
      thumbElement.style.transform = `translateX(${maxTranslate}px)`;
      if (fillElement) {
        fillElement.style.transition = 'width 0.15s ease-out';
        fillElement.style.width = '100%';
      }
      setTimeout(() => {
        if (onClear) onClear();
        // Reset track state after invocation
        thumbElement.style.transform = 'translateX(0px)';
        if (fillElement) fillElement.style.width = '0px';
        if (labelElement) labelElement.style.opacity = '1';
      }, 180);
    } else {
      // Rebound to start
      thumbElement.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
      thumbElement.style.transform = 'translateX(0px)';
      if (fillElement) {
        fillElement.style.transition = 'width 0.2s ease-out';
        fillElement.style.width = '0px';
      }
      if (labelElement) {
        labelElement.style.transition = 'opacity 0.2s ease-out';
        labelElement.style.opacity = '1';
      }
    }
  };

  thumbElement.addEventListener('pointerdown', onPointerDown);
  thumbElement.addEventListener('pointermove', onPointerMove);
  thumbElement.addEventListener('pointerup', onPointerEnd);
  thumbElement.addEventListener('pointercancel', onPointerEnd);

  return () => {
    thumbElement.removeEventListener('pointerdown', onPointerDown);
    thumbElement.removeEventListener('pointermove', onPointerMove);
    thumbElement.removeEventListener('pointerup', onPointerEnd);
    thumbElement.removeEventListener('pointercancel', onPointerEnd);
  };
}
