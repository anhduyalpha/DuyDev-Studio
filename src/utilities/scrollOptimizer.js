/**
 * scrollOptimizer.js - 120FPS GPU Compositing & Backdrop-Filter Reliever
 *
 * Temporarily relaxes heavy GPU shaders (backdrop-filter: blur, box-shadows, pointer hover calculations)
 * during high-speed scrolling by tagging documentElement with 'is-scrolling'.
 * Restores 100% pristine visual clarity within 120ms of motion stopping.
 */

let isScrollingActive = false;
let scrollStopTimer = null;
const SCROLL_DEBOUNCE_MS = 120;

function handleScrollEvent() {
  if (!isScrollingActive) {
    isScrollingActive = true;
    document.documentElement.classList.add('is-scrolling');
  }

  if (scrollStopTimer) {
    clearTimeout(scrollStopTimer);
  }

  scrollStopTimer = setTimeout(() => {
    isScrollingActive = false;
    document.documentElement.classList.remove('is-scrolling');
    scrollStopTimer = null;
  }, SCROLL_DEBOUNCE_MS);
}

/**
 * Initializes the scroll optimization listener
 */
export function initScrollOptimizer() {
  if (typeof window === 'undefined') return;

  // Passive event listener ensures zero main-thread blocking on scrolling
  window.addEventListener('scroll', handleScrollEvent, { passive: true });
}

/**
 * Teardown scroll optimizer
 */
export function destroyScrollOptimizer() {
  if (typeof window === 'undefined') return;

  window.removeEventListener('scroll', handleScrollEvent);
  if (scrollStopTimer) {
    clearTimeout(scrollStopTimer);
    scrollStopTimer = null;
  }
  document.documentElement.classList.remove('is-scrolling');
  isScrollingActive = false;
}
