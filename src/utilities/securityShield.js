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

  // DevTools docked to bottom takes > 200px height (unless virtual keyboard is active on mobile input)
  const isInputFocused = typeof document !== 'undefined' &&
    document.activeElement &&
    ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (heightDiff > 200 && !isInputFocused) return true;

  return false;
}

/**
 * Measures execution delay around debugger statement
 * When DevTools is open, debugger halts execution (>100ms)
 */
function isTimingDevToolsOpen() {
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
  isWebLocked = true;

  // Stop polling once locked to latch the screen permanently
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  if (consoleProbeIntervalId) {
    clearInterval(consoleProbeIntervalId);
    consoleProbeIntervalId = null;
  }

  showDevToolsBlockScreen();
}

/**
 * Shows the full-screen "ÂU NÂU ĐỪNG PHÁ WEB" DevTools blocker overlay
 */
export function showDevToolsBlockScreen() {
  if (typeof document === 'undefined') return;

  const blockerId = 'ds-devtools-blocker';
  let blocker = document.getElementById(blockerId);
  if (!blocker) {
    blocker = document.createElement('div');
    blocker.id = blockerId;
    blocker.className = 'fixed inset-0 z-[99999999] bg-[#09090b] flex items-center justify-center p-4 select-none font-sans';
    blocker.innerHTML = `
      <div class="relative max-w-lg w-full bg-[#121216] border border-red-500/30 rounded-3xl p-8 md:p-10 text-center shadow-2xl shadow-red-500/10 flex flex-col items-center space-y-6 animate-fadeIn">
        <!-- Pulsing Alert Badge -->
        <div class="relative w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
          <span class="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping opacity-75"></span>
          <i data-lucide="shield-alert" class="w-10 h-10 relative z-10"></i>
        </div>

        <!-- Title & Message Requested by User -->
        <div class="space-y-3">
          <h1 class="text-2xl md:text-4xl font-black text-red-500 tracking-tight uppercase">
            ÂU NÂU ĐỪNG PHÁ WEB
          </h1>
          <p class="text-sm md:text-base text-zinc-300 leading-relaxed max-w-md mx-auto">
            Phát hiện bạn đang mở công cụ lập trình viên (<span class="text-red-400 font-mono font-bold">DevTools</span>).
            Vui lòng đóng DevTools và bấm <strong class="text-white">Tải lại trang</strong> để vào lại web nhé!
          </p>
        </div>

        <!-- Action / Reload Button -->
        <div class="w-full pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button id="dsBtnReloadWeb" class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-sm font-bold transition shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="rotate-cw" class="w-4 h-4"></i>
            <span>Tải lại trang (F5)</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(blocker);
    if (window.lucide) window.lucide.createIcons();

    // Attach Reload Action
    const btnReload = document.getElementById('dsBtnReloadWeb');
    if (btnReload) {
      btnReload.onclick = () => {
        window.location.reload();
      };
    }
  }

  try {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  } catch {}
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

  // Background debugger interrupt loop while locked
  setInterval(() => {
    if (isWebLocked) {
      try {
        (function () {
          return false;
        }['constructor']('debugger')());
      } catch {}
    }
  }, 150);

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
