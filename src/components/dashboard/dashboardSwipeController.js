/**
 * Dashboard Horizontal Swipe Controller
 * Enables silky smooth horizontal swipe gestures on mobile & Android WebView
 * to cycle through tool category tabs with haptic feedback & GPU acceleration.
 */

export function initDashboardSwipe({
  container,
  onSwipeNext,
  onSwipePrev,
  getCanSwipe = () => true,
  canSwipeNext,
  canSwipePrev
}) {
  if (!container || typeof window === 'undefined') return () => {};

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isHorizontalSwipe = null;
  let currentDeltaX = 0;
  let isTracking = false;

  const MIN_HORIZONTAL_THRESHOLD = 45; // min px for swipe
  const VELOCITY_THRESHOLD = 0.18; // px/ms
  const ANGLE_RATIO = 1.35; // dx > dy * 1.35 (~53.5 deg)
  const MAX_RESISTANCE_DISPLACEMENT = 32; // px visual damping during drag
  const BOUNDARY_RESISTANCE_DISPLACEMENT = 12; // px damped resistance at edge boundary

  const getTargetGrid = () => document.getElementById('toolsGridContainer');

  const onTouchStart = (e) => {
    if (!getCanSwipe() || e.touches.length !== 1) return;
    const target = e.target;

    // Do NOT intercept if touching horizontal category filter pill bar or interactive form controls
    if (target.closest('#dashboardCategoryBarContainer, #categoryFilterBar, .filter-pill, input, textarea, select, .no-swipe')) {
      return;
    }

    // Do NOT intercept if an active modal or viewer is open
    if (document.querySelector('#universalViewerModal, #shareTargetPanel, #adminModal, .ds-modal-open')) {
      return;
    }

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isHorizontalSwipe = null;
    currentDeltaX = 0;
    isTracking = true;
  };

  const onTouchMove = (e) => {
    if (!isTracking || e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Direction lock decision after small movement (8px)
    if (isHorizontalSwipe === null) {
      if (absDx > 8 || absDy > 8) {
        if (absDx > absDy * ANGLE_RATIO) {
          isHorizontalSwipe = true;
          // In Android APK, pause SwipeRefreshLayout so it doesn't trigger pull-to-refresh
          if (window.AndroidBridge?.setSwipeRefreshEnabled) {
            try { window.AndroidBridge.setSwipeRefreshEnabled(false); } catch {}
          }
        } else {
          // Vertical page scroll confirmed — stop tracking this gesture
          isHorizontalSwipe = false;
          isTracking = false;
          return;
        }
      } else {
        return;
      }
    }

    if (isHorizontalSwipe) {
      currentDeltaX = dx;
      const isPastBoundary = (dx < 0 && typeof canSwipeNext === 'function' && !canSwipeNext()) ||
                             (dx > 0 && typeof canSwipePrev === 'function' && !canSwipePrev());
      const maxDisplacement = isPastBoundary ? BOUNDARY_RESISTANCE_DISPLACEMENT : MAX_RESISTANCE_DISPLACEMENT;
      const dampingFactor = isPastBoundary ? 0.08 : 0.22;
      const dampedOffset = Math.sign(dx) * Math.min(Math.abs(dx) * dampingFactor, maxDisplacement);
      const grid = getTargetGrid();
      if (grid) {
        grid.style.transform = `translate3d(${dampedOffset}px, 0, 0)`;
        grid.style.transition = 'none';
      }
    }
  };

  const resetTransform = (grid) => {
    if (!grid) return;
    grid.style.transition = 'transform 0.16s cubic-bezier(0.16, 1, 0.3, 1)';
    grid.style.transform = 'translate3d(0, 0, 0)';
    setTimeout(() => {
      grid.style.transition = '';
      grid.style.transform = '';
    }, 160);
  };

  const onTouchEnd = () => {
    if (!isTracking) return;
    isTracking = false;

    // Restore Android native SwipeRefresh
    if (window.AndroidBridge?.setSwipeRefreshEnabled) {
      try { window.AndroidBridge.setSwipeRefreshEnabled(true); } catch {}
    }

    const grid = getTargetGrid();

    if (isHorizontalSwipe) {
      const elapsed = Math.max(1, Date.now() - touchStartTime);
      const distance = Math.abs(currentDeltaX);
      const velocity = distance / elapsed;

      const isSwipe = (distance >= MIN_HORIZONTAL_THRESHOLD && velocity >= VELOCITY_THRESHOLD) || distance >= 80;

      if (isSwipe) {
        let result = false;
        if (currentDeltaX < 0) {
          // Swipe Left -> Next tab
          result = onSwipeNext ? onSwipeNext() : false;
        } else {
          // Swipe Right -> Prev tab
          result = onSwipePrev ? onSwipePrev() : false;
        }

        // If swipe was explicitly unhandled (e.g. boundary reached where no adjacent tab exists),
        // smoothly spring the grid back to rest instead of snapping instantly.
        if (result === false) {
          resetTransform(grid);
        } else if (grid) {
          grid.style.transition = '';
          grid.style.transform = '';
        }
      } else {
        resetTransform(grid);
      }
    } else {
      resetTransform(grid);
    }

    isHorizontalSwipe = null;
    currentDeltaX = 0;
  };

  const onTouchCancel = () => {
    if (!isTracking) return;
    isTracking = false;
    if (window.AndroidBridge?.setSwipeRefreshEnabled) {
      try { window.AndroidBridge.setSwipeRefreshEnabled(true); } catch {}
    }
    resetTransform(getTargetGrid());
    isHorizontalSwipe = null;
    currentDeltaX = 0;
  };

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchCancel);
    const grid = getTargetGrid();
    if (grid) {
      grid.style.transition = '';
      grid.style.transform = '';
    }
  };
}
