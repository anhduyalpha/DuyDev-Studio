/**
 * securityShield.js - Enterprise Client-Side Hardening & Anti-Tamper Shield
 * Provides hotkey blocking, context-menu protection, anti-clickjacking,
 * and unconditional permanent DevTools lockout displaying "ÂU NÂU ĐỪNG PHÁ WEB" requiring page reload.
 */

let isWebLocked = false;
let checkIntervalId = null;
let consoleProbeIntervalId = null;
let probeElement = null;
let blockerObserver = null;

/**
 * Checks if client environment is local developer machine
 */
export function isLocalDev() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
}

/**
 * Detects docked DevTools (Docked Right, Left, or Bottom)
 * Normal desktop window borders are <= 32px width and <= 160px height.
 */
function isDockedDevToolsOpen() {
  if (typeof window === 'undefined') return false;

  const widthDiff = window.outerWidth - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;

  // DevTools docked to right or left takes > 100px width (typically 300px - 800px)
  if (widthDiff > 100) return true;

  // DevTools docked to bottom takes > 200px height (desktop only, unless virtual keyboard is active on mobile input)
  const isDesktop = !window.screen || window.screen.width >= 768;
  const isInputFocused = typeof document !== 'undefined' &&
    document.activeElement &&
    ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (isDesktop && heightDiff > 200 && !isInputFocused) return true;

  return false;
}

/**
 * Measures execution delay around debugger statement
 * When DevTools is open, debugger halts execution (>100ms)
 */
function isTimingDevToolsOpen() {
  if (isDockedDevToolsOpen()) return true;
  const start = performance.now();
  try {
    (function () {
      return false;
    }['constructor']('debugger')());
  } catch {}
  const duration = performance.now() - start;
  return duration > 100;
}

/**
 * Permanently locks the web application and displays "ÂU NÂU ĐỪNG PHÁ WEB"
 * Requires the user to close DevTools and reload the page.
 */
export function lockWebPermanently() {
  if (isWebLocked || typeof document === 'undefined') return;
  if (isLocalDev()) return;
  isWebLocked = true;

  try {
    sessionStorage.setItem('__ds_dt_lock', '1');
  } catch {}

  // Stop polling once locked to latch the screen permanently
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  if (consoleProbeIntervalId) {
    clearInterval(consoleProbeIntervalId);
    consoleProbeIntervalId = null;
  }
  if (blockerObserver) {
    blockerObserver.disconnect();
    blockerObserver = null;
  }

  // Abort all active network downloads, SSE streams, script evaluations
  try {
    window.stop();
  } catch {}

  showDevToolsBlockScreen();
}

/**
 * Shows the full-screen "ÂU NÂU ĐỪNG PHÁ WEB" DevTools blocker page
 * Completely replaces document DOM to ensure zero source code or sensitive UI can be inspected.
 */
export function showDevToolsBlockScreen() {
  if (typeof document === 'undefined') return;

  const blockerHTML = `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ÂU NÂU ĐỪNG PHÁ WEB</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #09090b;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          user-select: none;
          -webkit-user-select: none;
        }
        .card {
          background-color: #121216;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 24px;
          padding: 32px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .icon-box {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
        }
        .icon-box svg {
          width: 40px;
          height: 40px;
        }
        h1 {
          color: #ef4444;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.025em;
          text-transform: uppercase;
        }
        p {
          color: #d4d4d8;
          font-size: 15px;
          line-height: 1.6;
        }
        .badge {
          color: #f87171;
          font-family: monospace;
          font-weight: 700;
        }
        button {
          background-color: #dc2626;
          color: #ffffff;
          border: none;
          border-radius: 14px;
          padding: 14px 28px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.3);
        }
        button:hover {
          background-color: #ef4444;
        }
        button:active {
          transform: scale(0.98);
        }
      </style>
    </head>
    <body>
      <div id="ds-devtools-blocker" class="card">
        <div class="icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </div>
        <div>
          <h1>ÂU NÂU ĐỪNG PHÁ WEB</h1>
          <p style="margin-top: 10px;">
            Phát hiện bạn đang mở công cụ lập trình viên (<span class="badge">DevTools</span>).<br>
            Vui lòng đóng DevTools và bấm <strong style="color: #fff;">Tải lại trang</strong> để vào lại web nhé!
          </p>
        </div>
        <button id="dsBtnReloadWeb">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
            <path d="M16 21h5v-5"></path>
          </svg>
          <span>Tải lại trang (F5)</span>
        </button>
      </div>
    </body>
  `;

  document.documentElement.innerHTML = blockerHTML;

  const btnReload = document.getElementById('dsBtnReloadWeb');
  if (btnReload) {
    btnReload.onclick = () => {
      try {
        sessionStorage.removeItem('__ds_dt_lock');
      } catch {}
      window.location.reload();
    };
  }
}

/**
 * Hides the blocker screen
 */
export function hideDevToolsBlockScreen() {
  if (typeof document === 'undefined') return;
  const blocker = document.getElementById('ds-devtools-blocker');
  if (blocker) {
    blocker.remove();
  }
  try {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  } catch {}
}

/**
 * Inspection step to check DevTools status
 */
function checkDevToolsStatus() {
  if (isWebLocked || typeof window === 'undefined') return;
  if (isLocalDev()) return;

  if (isDockedDevToolsOpen() || isTimingDevToolsOpen()) {
    lockWebPermanently();
  }
}

/**
 * Initializes console formatting probe
 */
function initConsoleProbe() {
  if (typeof Image === 'undefined') return;
  try {
    probeElement = new Image();
    Object.defineProperty(probeElement, 'id', {
      get: function () {
        lockWebPermanently();
        return 'probe';
      }
    });
  } catch {}
}

/**
 * Starts DevTools detection and permanent locking subsystem
 */
export function startAntiDebugger() {
  if (typeof window === 'undefined') return;
  if (isLocalDev()) return;

  initConsoleProbe();

  // Run initial check on load
  checkDevToolsStatus();

  // Polling check every 150ms for lightning-fast lockout (<0.2s)
  checkIntervalId = setInterval(checkDevToolsStatus, 150);

  // Periodic console probe trigger every 500ms
  consoleProbeIntervalId = setInterval(() => {
    if (probeElement && !isWebLocked) {
      try {
        console.debug(probeElement);
      } catch {}
    }
  }, 500);

  // Listen to window resize for instant docked DevTools detection
  window.addEventListener('resize', checkDevToolsStatus, { passive: true });

  // Anti-tamper DOM observer: re-inject blocker if deleted from Elements tab
  if (typeof MutationObserver !== 'undefined' && document.body) {
    blockerObserver = new MutationObserver(() => {
      if (isWebLocked) {
        const el = document.getElementById('ds-devtools-blocker');
        if (!el) {
          showDevToolsBlockScreen();
        }
      }
    });
    blockerObserver.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Initializes client-side anti-tamper shields
 */
export function initSecurityShield() {
  if (typeof window === 'undefined' || window._dsShieldActive) return;
  if (isLocalDev()) return;
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
    const key = (e.key || '').toUpperCase();
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // F12 or DevTools shortcuts
    if (key === 'F12' || (isCtrlOrMeta && e.shiftKey && ['I', 'J', 'C'].includes(key))) {
      e.preventDefault();
      e.stopPropagation();
      lockWebPermanently();
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

  // 4. Start DevTools Detection & Anti-Debugger
  startAntiDebugger();
}
