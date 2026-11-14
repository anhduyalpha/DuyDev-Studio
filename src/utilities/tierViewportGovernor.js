/**
 * Tier Viewport Governor
 * Offscreen card animation suspension is handled solely by IntersectionObserver (.tier-offscreen)
 * and visibility events (html.app-backgrounded) so active 120Hz scrolling never freezes animations (KI-CON-012).
 */

export function initTierViewportGovernor() {
  return () => {};
}
