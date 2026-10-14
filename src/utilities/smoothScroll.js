/**
 * smoothScroll.js - 120Hz/144Hz High-Fidelity Inertial Smooth Scroll Controller
 * Powered by Lenis v1.1 (Linear / Apple Exponential Easing Curve)
 *
 * Designed to eliminate notched 60Hz-feel stepped mouse wheel scrolling on Desktop,
 * while preserving 100% native touch physics on mobile touchscreens.
 */

import { Lenis } from '../vendor/lenis-smooth.js?v=22.74';

/** @type {Lenis | null} */
let lenisInstance = null;
let rafId = null;
let isPausedForModal = false;

/**
 * Initializes the smooth scroll engine.
 * Automatically syncs with the display's native refresh rate (120Hz, 144Hz, 60Hz).
 * Respects 'prefers-reduced-motion'.
 */
export function initSmoothScroll() {
  if (typeof window === 'undefined') return null;
  if (lenisInstance) return lenisInstance;

  // Respect user's accessibility reduced-motion preference
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    return null;
  }

  try {
    lenisInstance = new Lenis({
      duration: 1.0,
      // Apple / Linear Exponential Easing Curve: smooth glide with crisp, natural deceleration
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false, // 100% native touch physics & responsiveness on touchscreens
      touchMultiplier: 1.0,
      wheelMultiplier: 1.0,
      infinite: false,
      autoRaf: false,
      autoResize: true
    });

    // Drive Lenis with requestAnimationFrame to unlock 120Hz/144Hz displays
    function rafLoop(time) {
      if (lenisInstance) {
        lenisInstance.raf(time);
        rafId = requestAnimationFrame(rafLoop);
      }
    }
    rafId = requestAnimationFrame(rafLoop);

    // Watch for modal classes on body (pause Lenis when a modal locks the viewport)
    setupModalObserver();

    window.__ds_lenis = lenisInstance;
    return lenisInstance;
  } catch (err) {
    console.warn('[SmoothScroll] Initialization fallback to native scroll:', err);
    return null;
  }
}

/**
 * Watches document.body for overflow-hidden / modal classes to pause smooth scrolling
 */
function setupModalObserver() {
  if (typeof MutationObserver === 'undefined' || !document.body) return;

  const observer = new MutationObserver(() => {
    const hasModal =
      document.body.classList.contains('overflow-hidden') ||
      Boolean(document.querySelector('#universalViewerModal:not(.hidden)')) ||
      Boolean(document.querySelector('.slide-confirm-overlay')) ||
      Boolean(document.querySelector('[role="dialog"]:not(.hidden)'));

    if (hasModal && !isPausedForModal) {
      isPausedForModal = true;
      pauseSmoothScroll();
    } else if (!hasModal && isPausedForModal) {
      isPausedForModal = false;
      resumeSmoothScroll();
    }
  });

  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/**
 * Pauses smooth scrolling (e.g. when opening a lightbox or modal)
 */
export function pauseSmoothScroll() {
  if (lenisInstance) {
    lenisInstance.stop();
  }
}

/**
 * Resumes smooth scrolling
 */
export function resumeSmoothScroll() {
  if (lenisInstance) {
    lenisInstance.start();
  }
}

/**
 * Programmatically scrolls smoothly to a target position, element, or selector
 * @param {string | number | HTMLElement} target
 * @param {object} [options]
 */
export function scrollToTarget(target, options = {}) {
  if (lenisInstance) {
    lenisInstance.scrollTo(target, options);
  } else if (typeof window !== 'undefined') {
    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } else if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

/**
 * Returns active Lenis instance or null
 * @returns {Lenis | null}
 */
export function getLenis() {
  return lenisInstance;
}

/**
 * Cleans up and destroys Lenis
 */
export function destroySmoothScroll() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
  if (typeof window !== 'undefined') {
    delete window.__ds_lenis;
  }
}
