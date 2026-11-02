/**
 * securityShield.js - Enterprise Client-Side Hardening & Anti-Tamper Shield
 * Provides hotkey blocking, context-menu protection, anti-clickjacking,
 * and dev bypass for administrators.
 */

import { isAdminAuthenticated } from './adminAuth.js';

/**
 * Checks if client environment is local developer machine
 */
function isLocalDev() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
}

/**
 * Initializes client-side anti-tamper shields
 */
export function initSecurityShield() {
  if (typeof window === 'undefined' || window._dsShieldActive) return;
  window._dsShieldActive = true;

  // 1. Anti-Clickjacking Frame Buster
  try {
    if (window.top !== window.self) {
      const topOrigin = (() => {
        try { return window.top.location.origin; } catch { return ''; }
      })();
      if (!topOrigin || (!topOrigin.includes('duydev.cloud') && !topOrigin.includes('localhost'))) {
        window.top.location = window.self.location;
      }
    }
  } catch {}

  // 2. Keyboard Hotkey Shield (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S)
  window.addEventListener('keydown', (e) => {
    // Whitelist active admin or local development
    if (isLocalDev() || isAdminAuthenticated()) return;

    const key = (e.key || '').toUpperCase();
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // F12 DevTools
    if (key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I / J / C (DevTools & Element Inspector)
    if (isCtrlOrMeta && e.shiftKey && ['I', 'J', 'C'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U (View Source)
    if (isCtrlOrMeta && key === 'U') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S (Save Page)
    if (isCtrlOrMeta && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 3. Right-Click Context Menu Protection (Permits inputs, textareas, media and .allow-select)
  window.addEventListener('contextmenu', (e) => {
    if (isLocalDev() || isAdminAuthenticated()) return;

    const target = e.target;
    if (target instanceof HTMLElement) {
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isAllowed = target.closest('.allow-select') || target.closest('.allow-context') || target.closest('audio') || target.closest('video');
      if (isInput || isAllowed) return;
    }

    e.preventDefault();
    e.stopPropagation();
    return false;
  }, { capture: true });
}
