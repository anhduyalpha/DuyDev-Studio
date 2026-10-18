/**
 * Tier Viewport Governor (Android 120Hz Smooth Scroll & Power Saving)
 * Pauses continuous card micro-animations strictly during active touchmove/scroll.
 * Resumes 120ms after motion stops without triggering layout re-calculation or repainting (KI-FIX-023).
 */

let swipeTimer = null;
let isGoverning = false;

function onMotion() {
  if (!document.documentElement.classList.contains('is-swiping')) {
    document.documentElement.classList.add('is-swiping');
  }
  if (swipeTimer) {
    clearTimeout(swipeTimer);
  }
  swipeTimer = setTimeout(() => {
    document.documentElement.classList.remove('is-swiping');
    swipeTimer = null;
  }, 120);
}

export function initTierViewportGovernor() {
  if (isGoverning || typeof window === 'undefined') return () => {};
  isGoverning = true;

  const options = { passive: true };
  window.addEventListener('touchmove', onMotion, options);
  window.addEventListener('scroll', onMotion, options);
  window.addEventListener('touchend', onMotion, options);
  window.addEventListener('touchcancel', onMotion, options);

  return () => {
    window.removeEventListener('touchmove', onMotion, options);
    window.removeEventListener('scroll', onMotion, options);
    window.removeEventListener('touchend', onMotion, options);
    window.removeEventListener('touchcancel', onMotion, options);
    if (swipeTimer) {
      clearTimeout(swipeTimer);
      swipeTimer = null;
    }
    document.documentElement.classList.remove('is-swiping');
    isGoverning = false;
  };
}
