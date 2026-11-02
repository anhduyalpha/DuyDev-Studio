/**
 * securityShield.js - Enterprise Client-Side Hardening & Anti-Tamper Shield
 * Provides hotkey blocking, context-menu protection, anti-clickjacking,
 * and high-priority DevTools blocking with "ÂU NÂU ĐỪNG PHÁ WEB" blocker overlay.
 */

import { isAdminAuthenticated, showAdminPasswordModal } from './adminAuth.js';

let devToolsDetected = false;
let checkIntervalId = null;
let consoleProbeIntervalId = null;
let probeElement = null;
let consoleOpen = false;
let bypassActive = false;
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
 */
function isDockedDevToolsOpen() {
  if (typeof window === 'undefined') return false;

  const threshold = 160;
  const widthDiff = window.outerWidth - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;

  const widthThreshold = widthDiff > threshold;
  const heightThreshold = heightDiff > threshold;

  // On desktop, docked DevTools on side triggers widthThreshold, docked on bottom triggers heightThreshold.
  // If BOTH trigger simultaneously, it's typically page zoom or OS window resize.
  return (widthThreshold && !heightThreshold) || (heightThreshold && !widthThreshold);
}

/**
 * Measures execution delay around debugger statement
 * When DevTools is open, debugger causes execution to halt (>100ms)
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
 * Shows the full-screen "ÂU NÂU ĐỪNG PHÁ WEB" DevTools blocker overlay
 */
export function showDevToolsBlockScreen() {
  if (bypassActive || typeof document === 'undefined') return;

  const blockerId = 'ds-devtools-blocker';
  let blocker = document.getElementById(blockerId);
  if (!blocker) {
    blocker = document.createElement('div');
    blocker.id = blockerId;
    blocker.className = 'fixed inset-0 z-[99999999] bg-[#09090b]/95 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans';
    blocker.innerHTML = `
      <div class="relative max-w-md w-full bg-[#18181b] border border-red-500/40 rounded-3xl p-6 md:p-8 text-center shadow-2xl shadow-red-500/20 space-y-6 animate-fadeIn">
        <!-- Shield Alert Icon with Pulse Glow -->
        <div class="relative w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
          <span class="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping"></span>
          <i data-lucide="shield-alert" class="w-10 h-10 relative z-10"></i>
        </div>

        <!-- Heading Requested by User -->
        <div class="space-y-2">
          <h1 class="text-2xl md:text-3xl font-black text-red-500 tracking-tight uppercase">
            ÂU NÂU ĐỪNG PHÁ WEB
          </h1>
          <p class="text-xs md:text-sm text-zinc-300 leading-relaxed">
            Phát hiện bạn đang mở công cụ lập trình viên (<span class="text-red-400 font-mono font-bold">DevTools</span>).
            Vui lòng đóng DevTools lại để tiếp tục sử dụng web nhé!
          </p>
        </div>

        <!-- Instruction Pill -->
        <div class="p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 space-y-1.5 text-xs text-zinc-400">
          <div class="flex items-center justify-center gap-2 text-zinc-200 font-medium font-mono">
            <i data-lucide="x-circle" class="w-4 h-4 text-red-400 shrink-0"></i>
            <span>Bấm <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 text-white font-bold border border-white/10">F12</kbd> hoặc nút ✕ DevTools</span>
          </div>
          <p class="text-[11px] text-zinc-500">Màn hình sẽ tự động mở khóa ngay khi bạn đóng DevTools.</p>
        </div>

        <div class="pt-1">
          <button id="dsBtnBypassDevTools" class="text-[11px] text-zinc-500 hover:text-zinc-300 underline transition cursor-pointer">
            Tôi là Quản trị viên Duy
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(blocker);
    if (window.lucide) window.lucide.createIcons();

    const btnBypass = document.getElementById('dsBtnBypassDevTools');
    if (btnBypass) {
      btnBypass.onclick = () => {
        if (isAdminAuthenticated()) {
          bypassActive = true;
          hideDevToolsBlockScreen();
        } else {
          showAdminPasswordModal({
            message: 'Nhập mật khẩu Quản trị viên để mở khóa DevTools.',
            onSuccess: () => {
              bypassActive = true;
              hideDevToolsBlockScreen();
            }
          });
        }
      };
    }
  }

  try {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  } catch {}

  // Trigger debugger trap so stepping/inspection in DevTools is halted
  try {
    (function () {
      return false;
    }['constructor']('debugger')());
  } catch {}
}

/**
 * Hides the blocker screen once DevTools is closed
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
 * Main inspection loop to detect DevTools open/close transitions
 */
function checkDevToolsStatus() {
  if (bypassActive || typeof window === 'undefined') return;

  const isDocked = isDockedDevToolsOpen();
  const isTiming = isTimingDevToolsOpen();

  if (isDocked || isTiming || consoleOpen) {
    devToolsDetected = true;
    showDevToolsBlockScreen();
  } else {
    if (devToolsDetected) {
      devToolsDetected = false;
      hideDevToolsBlockScreen();
    }
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
        consoleOpen = true;
        showDevToolsBlockScreen();
        return 'probe';
      }
    });
  } catch {}
}

/**
 * Starts DevTools detection and anti-debugger subsystem
 */
export function startAntiDebugger() {
  if (typeof window === 'undefined') return;

  stopAntiDebugger();
  initConsoleProbe();

  // Run initial check
  checkDevToolsStatus();

  // Periodic polling check every 250ms
  checkIntervalId = setInterval(checkDevToolsStatus, 250);

  // Periodic console probe trigger every 1500ms
  consoleProbeIntervalId = setInterval(() => {
    if (probeElement && !bypassActive) {
      consoleOpen = false;
      try {
        console.debug(probeElement);
      } catch {}
    }
  }, 1500);

  // Listen to window resize for instant docked DevTools detection
  window.addEventListener('resize', checkDevToolsStatus, { passive: true });

  // Anti-tamper DOM observer: re-inject blocker if deleted from Elements tab
  if (typeof MutationObserver !== 'undefined' && document.body) {
    blockerObserver = new MutationObserver(() => {
      if (devToolsDetected && !bypassActive) {
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
 * Stops all DevTools detection and traps
 */
export function stopAntiDebugger() {
  devToolsDetected = false;
  hideDevToolsBlockScreen();

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
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', checkDevToolsStatus);
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
    if (bypassActive) return;

    const key = (e.key || '').toUpperCase();
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // F12 or DevTools shortcuts
    if (key === 'F12' || (isCtrlOrMeta && e.shiftKey && ['I', 'J', 'C'].includes(key))) {
      e.preventDefault();
      e.stopPropagation();
      devToolsDetected = true;
      showDevToolsBlockScreen();
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
    if (bypassActive) return;

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

  // 5. Listen to Admin authentication state changes
  window.addEventListener('ds:admin-auth-changed', (e) => {
    const isAuth = Boolean(e?.detail?.authenticated);
    if (isAuth) {
      bypassActive = true;
      stopAntiDebugger();
    } else {
      bypassActive = false;
      startAntiDebugger();
    }
  });
}
