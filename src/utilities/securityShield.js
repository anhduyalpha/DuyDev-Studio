/**
 * securityShield.js - Enterprise Client-Side Hardening & Anti-Tamper Shield
 * Provides hotkey blocking, context-menu protection, anti-clickjacking,
 * multi-vector anti-debugger traps, and administrative dev bypass.
 */

import { isAdminAuthenticated } from './adminAuth.js';

let antiDebuggerIntervalId = null;
let consoleProbeIntervalId = null;
let devToolsOpenDetected = false;
let aggressiveLoopActive = false;

/**
 * Checks if client environment is local developer machine
 */
export function isLocalDev() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
}

/**
 * Handles detected DevTools opening by unauthorized visitors
 */
function onDevToolsOpen() {
  if (isLocalDev() || isAdminAuthenticated()) return;
  devToolsOpenDetected = true;

  try {
    console.clear();
    console.warn(
      '%c⚠️ [BẢO MẬT] Công cụ nhà phát triển (DevTools) bị vô hiệu hóa vì lý do an toàn thông tin.',
      'color: #ef4444; font-size: 14px; font-weight: bold; background: #18181b; padding: 6px 12px; border-radius: 6px;'
    );
  } catch {}

  // Trigger aggressive debugger breakpoint cycles to deter stepping/inspection
  if (!aggressiveLoopActive) {
    aggressiveLoopActive = true;
    triggerAggressiveDebuggerLoop();
  }
}

/**
 * Executes dynamic Function debugger loop
 */
function triggerAggressiveDebuggerLoop() {
  if (isLocalDev() || isAdminAuthenticated()) {
    aggressiveLoopActive = false;
    return;
  }

  try {
    // Dynamic constructor invocation prevents static string search
    (function () {
      return false;
    }['constructor']('debugger')());
  } catch {}

  // Re-schedule trap while DevTools remains open
  setTimeout(() => {
    if (aggressiveLoopActive) {
      triggerAggressiveDebuggerLoop();
    }
  }, 120);
}

/**
 * Periodic timing-based debugger trap (measures execution pause when DevTools is open)
 */
function runTimingDebuggerTrap() {
  if (isLocalDev() || isAdminAuthenticated()) {
    stopAntiDebugger();
    return;
  }

  const start = performance.now();
  try {
    (function () {
      return false;
    }['constructor']('debugger')());
  } catch {}
  const duration = performance.now() - start;

  // If paused for more than 100ms, a breakpoint halted execution in DevTools
  if (duration > 100) {
    onDevToolsOpen();
  } else {
    // If closed, gradually back off aggressive loop
    if (aggressiveLoopActive) {
      aggressiveLoopActive = false;
    }
  }
}

/**
 * Console toString / getter probe (triggers when DevTools Console tab renders objects)
 */
function runConsoleProbe() {
  if (isLocalDev() || isAdminAuthenticated()) return;

  try {
    const probe = /./;
    probe.toString = function () {
      onDevToolsOpen();
      return '';
    };
    console.debug('%c', probe);
  } catch {}
}

/**
 * Inspects desktop browser window dimension deltas for docked DevTools
 */
function checkWindowDimensions() {
  if (isLocalDev() || isAdminAuthenticated()) return;

  // Only check on desktop screens (width > 640px)
  if (window.innerWidth > 640) {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    // Standard window OS borders are < 40px width and < 140px height
    if (widthDiff > 180 || heightDiff > 200) {
      onDevToolsOpen();
    }
  }
}

/**
 * Starts the Anti-Debugger defense subsystem
 */
export function startAntiDebugger() {
  if (typeof window === 'undefined' || isLocalDev() || isAdminAuthenticated()) return;

  stopAntiDebugger();

  // 1. Initial execution
  runTimingDebuggerTrap();

  // 2. Periodic timing trap every 1000ms
  antiDebuggerIntervalId = setInterval(runTimingDebuggerTrap, 1000);

  // 3. Periodic console probe every 2500ms
  consoleProbeIntervalId = setInterval(runConsoleProbe, 2500);

  // 4. Window resize listener
  window.addEventListener('resize', checkWindowDimensions, { passive: true });
}

/**
 * Stops all Anti-Debugger traps (e.g. when Admin logs in)
 */
export function stopAntiDebugger() {
  aggressiveLoopActive = false;
  devToolsOpenDetected = false;

  if (antiDebuggerIntervalId) {
    clearInterval(antiDebuggerIntervalId);
    antiDebuggerIntervalId = null;
  }
  if (consoleProbeIntervalId) {
    clearInterval(consoleProbeIntervalId);
    consoleProbeIntervalId = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', checkWindowDimensions);
  }
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
      onDevToolsOpen();
      return false;
    }

    // Ctrl+Shift+I / J / C (DevTools & Element Inspector)
    if (isCtrlOrMeta && e.shiftKey && ['I', 'J', 'C'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      onDevToolsOpen();
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

  // 4. Start Anti-Debugger traps
  startAntiDebugger();

  // 5. Listen to Admin authentication state changes to dynamically enable/disable traps
  window.addEventListener('ds:admin-auth-changed', (e) => {
    const isAuth = Boolean(e?.detail?.authenticated);
    if (isAuth) {
      stopAntiDebugger();
    } else {
      startAntiDebugger();
    }
  });
}
