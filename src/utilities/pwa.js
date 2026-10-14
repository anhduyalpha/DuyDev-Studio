/**
 * PWA Service Worker Registration & Lifecycle Manager
 * Handles SW registration, deterministic update checks against the server,
 * and exposes helpers for the Settings page.
 */

/** @type {ServiceWorkerRegistration | null} */
let swRegistration = null;

/**
 * Check if PWA is running in standalone mode (installed on device).
 * @returns {boolean}
 */
export function isStandaloneMode() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone
  );
}

export const CURRENT_PWA_VERSION = 'duydev-studio-v22.76';

/**
 * Read the current local version from CacheStorage or fallback constant.
 * @returns {Promise<string>}
 */
export async function getCurrentVersion() {
  const cacheStorage = typeof caches !== 'undefined' ? caches : (typeof window !== 'undefined' ? window.caches : null);
  if (cacheStorage) {
    try {
      const keys = await cacheStorage.keys();
      if (keys.includes(CURRENT_PWA_VERSION)) {
        return CURRENT_PWA_VERSION;
      }
      const pwaKeys = keys.filter((k) => k.startsWith('duydev-studio-'));
      if (pwaKeys.length > 0) {
        pwaKeys.sort().reverse();
        return pwaKeys[0];
      }
    } catch (err) {
      console.warn('[PWA] Error reading cache keys:', err);
    }
  }
  return CURRENT_PWA_VERSION;
}

/**
 * Fetch the live sw.js script from the server (bypassing all browser/SW cache)
 * and parse the exact CACHE_NAME constant currently deployed.
 * @returns {Promise<string>}
 */
export async function getServerVersion() {
  const resp = await fetch(`./sw.js?t=${Date.now()}`, { cache: 'no-store' });
  if (!resp.ok) {
    throw new Error(`Máy chủ phản hồi mã lỗi ${resp.status}`);
  }
  const text = await resp.text();
  const match = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  if (!match) {
    throw new Error('Không thể phân tích phiên bản từ kịch bản Service Worker');
  }
  return match[1];
}

/**
 * Legacy compatibility alias for getSwVersion
 * @returns {Promise<string>}
 */
export async function getSwVersion() {
  return getCurrentVersion();
}

// Controlled update state management
let userRequestedReload = false;
let updateToastShown = false;

/**
 * Inspection helper for testing and update state verification.
 * @returns {boolean}
 */
export function getUserRequestedReload() {
  return userRequestedReload;
}

/**
 * Mutator helper for testing and manual update triggers.
 * @param {boolean} val
 */
export function setUserRequestedReload(val) {
  userRequestedReload = Boolean(val);
}

/**
 * Resets the update toast state (useful for test suites or re-prompting).
 */
export function resetUpdateToastShown() {
  updateToastShown = false;
}

let refreshing = false;

/**
 * Execute a safe, controlled reload to apply updated SW assets.
 * @param {string} reason
 * @param {boolean} [isUserConfirmed=false]
 */
export function performSafeReload(reason = 'App update', isUserConfirmed = false) {
  if (refreshing) return;
  const lastReload = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ds_sw_just_reloaded') : null;
  if (!isUserConfirmed && lastReload && Date.now() - Number(lastReload) < 10000) {
    console.log(`[PWA] Skipping reload (${reason}): already reloaded recently`);
    return;
  }
  refreshing = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('ds_sw_just_reloaded', String(Date.now()));
    }
  } catch {}
  console.log(`[PWA] ${reason} -> Reloading to apply new assets...`);
  if (typeof window !== 'undefined' && window.location?.reload) {
    window.location.reload();
  }
}

/**
 * Executes the Triple-Lock Hard Purge to guarantee that stale caches,
 * in-memory ES module cache, and Service Worker caches are completely wiped
 * and a 100% fresh app shell is loaded, matching the manual Ctrl+F5 effect.
 * @param {ServiceWorker | null} [waitingWorker]
 */
export async function executeTripleLockPurge(waitingWorker) {
  setUserRequestedReload(true);
  console.log('[PWA] Triple-Lock Hard Purge executing: wiping caches, signaling SW, and cache-busting navigation...');

  // 1. Wipe all CacheStorage from client if supported
  try {
    const cacheStorage = typeof caches !== 'undefined' ? caches : (typeof window !== 'undefined' ? window.caches : null);
    if (cacheStorage && typeof cacheStorage.keys === 'function' && typeof cacheStorage.delete === 'function') {
      const keys = await cacheStorage.keys();
      await Promise.all(keys.map(k => cacheStorage.delete(k)));
      console.log(`[PWA] Successfully purged ${keys.length} cache bucket(s).`);
    }
  } catch (err) {
    console.warn('[PWA] Cache purge warning:', err);
  }

  // 2. Dispatch SKIP_WAITING and PURGE_AND_UPDATE to pending and active workers
  try {
    if (waitingWorker) {
      try { waitingWorker.postMessage({ type: 'SKIP_WAITING' }); } catch {}
      try { waitingWorker.postMessage({ type: 'PURGE_AND_UPDATE' }); } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      try { navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' }); } catch {}
      try { navigator.serviceWorker.controller.postMessage({ type: 'PURGE_AND_UPDATE' }); } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistration) {
      const reg = swRegistration || (await navigator.serviceWorker.getRegistration());
      if (reg) {
        reg.update().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[PWA] SW message warning:', err);
  }

  // 3. Mark session flag and hard-reload with cache-busting timestamp
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('ds_hard_purged', 'true');
      sessionStorage.setItem('ds_sw_just_reloaded', String(Date.now()));
    }
  } catch {}

  const delayMs = 150;
  setTimeout(() => {
    performSafeReload('Triple-Lock Hard Purge complete', true);
  }, delayMs);
}

/**
 * Renders a prominent, centered Update Notification Center with blurred backdrop
 * (Dark Obsidian Glass aesthetic, version badge, 3 key highlights, in-flight task safety warning).
 * @param {ServiceWorker | null} waitingWorker
 */
export function showUpdateNotificationCenter(waitingWorker) {
  if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
    return;
  }

  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ds_update_capsule_dismissed') === 'true') {
      return;
    }
  } catch {}

  if (document.getElementById('ds-update-capsule')) {
    return;
  }

  const capsule = document.createElement('div');
  capsule.id = 'ds-update-capsule';
  capsule.setAttribute('role', 'alert');
  if (typeof document !== 'undefined' && document.documentElement?.classList?.contains('dark')) {
    capsule.classList.add('dark');
  }

  capsule.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 99999',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 1.25rem',
    'box-sizing: border-box',
    'background: var(--ds-up-backdrop, rgba(0, 0, 0, 0.35))',
    'backdrop-filter: blur(28px) saturate(180%)',
    '-webkit-backdrop-filter: blur(28px) saturate(180%)',
    'transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
  ].join(';');

  const displayVer = CURRENT_PWA_VERSION.replace('duydev-studio-', '') || 'v22.58';

  capsule.innerHTML = `
    <style>
      @keyframes appleModalEntrance {
        0% { opacity: 0; transform: scale(0.96) translateY(4px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }

      /* Light Theme (Default) */
      #ds-update-capsule {
        --ds-up-backdrop: rgba(0, 0, 0, 0.28);
        --ds-up-card-bg: rgba(255, 255, 255, 0.88);
        --ds-up-card-border: 0.5px solid rgba(0, 0, 0, 0.12);
        --ds-up-card-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95);
        --ds-up-text-primary: #1d1d1f;
        --ds-up-text-secondary: #6e6e73;
        --ds-up-badge-bg: rgba(0, 0, 0, 0.06);
        --ds-up-badge-border: 0.5px solid rgba(0, 0, 0, 0.1);
        --ds-up-badge-color: #1d1d1f;
        --ds-up-dismiss-bg: rgba(0, 0, 0, 0.05);
        --ds-up-dismiss-border: 0.5px solid rgba(0, 0, 0, 0.08);
        --ds-up-dismiss-color: #6e6e73;
        --ds-up-dismiss-hover-bg: rgba(0, 0, 0, 0.1);
        --ds-up-dismiss-hover-color: #1d1d1f;
        --ds-up-hl-bg: rgba(0, 0, 0, 0.035);
        --ds-up-hl-border: 0.5px solid rgba(0, 0, 0, 0.08);
        --ds-up-hl-text: #1d1d1f;
        --ds-up-hl-icon-perf-bg: rgba(0, 122, 255, 0.12);
        --ds-up-hl-icon-perf-border: 0.5px solid rgba(0, 122, 255, 0.24);
        --ds-up-hl-icon-perf-color: #0071e3;
        --ds-up-hl-icon-ui-bg: rgba(175, 82, 222, 0.12);
        --ds-up-hl-icon-ui-border: 0.5px solid rgba(175, 82, 222, 0.24);
        --ds-up-hl-icon-ui-color: #af52de;
        --ds-up-hl-icon-bug-bg: rgba(52, 199, 89, 0.14);
        --ds-up-hl-icon-bug-border: 0.5px solid rgba(52, 199, 89, 0.28);
        --ds-up-hl-icon-bug-color: #28a745;
        --ds-up-later-bg: rgba(0, 0, 0, 0.05);
        --ds-up-later-border: 0.5px solid rgba(0, 0, 0, 0.12);
        --ds-up-later-color: #1d1d1f;
        --ds-up-later-hover-bg: rgba(0, 0, 0, 0.09);
        --ds-up-later-hover-color: #000000;
        --ds-up-warn-bg: rgba(255, 149, 0, 0.1);
        --ds-up-warn-border: 0.5px solid rgba(255, 149, 0, 0.28);
        --ds-up-warn-color: #b35900;
        --ds-up-warn-desc: #7a4100;
        --ds-up-warn-cancel-bg: rgba(0, 0, 0, 0.06);
        --ds-up-warn-cancel-border: 0.5px solid rgba(0, 0, 0, 0.1);
        --ds-up-warn-cancel-color: #1d1d1f;
        --ds-up-warn-force-bg: #ff9500;
        --ds-up-warn-force-color: #ffffff;
      }

      /* Dark Theme */
      .dark #ds-update-capsule,
      #ds-update-capsule.dark {
        --ds-up-backdrop: rgba(0, 0, 0, 0.52);
        --ds-up-card-bg: rgba(30, 30, 36, 0.84);
        --ds-up-card-border: 0.5px solid rgba(255, 255, 255, 0.16);
        --ds-up-card-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.25);
        --ds-up-text-primary: #ffffff;
        --ds-up-text-secondary: rgba(235, 235, 245, 0.62);
        --ds-up-badge-bg: rgba(255, 255, 255, 0.1);
        --ds-up-badge-border: 0.5px solid rgba(255, 255, 255, 0.16);
        --ds-up-badge-color: rgba(255, 255, 255, 0.92);
        --ds-up-dismiss-bg: rgba(255, 255, 255, 0.08);
        --ds-up-dismiss-border: 0.5px solid rgba(255, 255, 255, 0.1);
        --ds-up-dismiss-color: rgba(255, 255, 255, 0.6);
        --ds-up-dismiss-hover-bg: rgba(255, 255, 255, 0.16);
        --ds-up-dismiss-hover-color: #ffffff;
        --ds-up-hl-bg: rgba(0, 0, 0, 0.28);
        --ds-up-hl-border: 0.5px solid rgba(255, 255, 255, 0.08);
        --ds-up-hl-text: #f5f5f7;
        --ds-up-hl-icon-perf-bg: rgba(10, 132, 255, 0.16);
        --ds-up-hl-icon-perf-border: 0.5px solid rgba(10, 132, 255, 0.28);
        --ds-up-hl-icon-perf-color: #2997ff;
        --ds-up-hl-icon-ui-bg: rgba(191, 90, 242, 0.16);
        --ds-up-hl-icon-ui-border: 0.5px solid rgba(191, 90, 242, 0.28);
        --ds-up-hl-icon-ui-color: #bf5af2;
        --ds-up-hl-icon-bug-bg: rgba(48, 209, 88, 0.16);
        --ds-up-hl-icon-bug-border: 0.5px solid rgba(48, 209, 88, 0.28);
        --ds-up-hl-icon-bug-color: #30d158;
        --ds-up-later-bg: rgba(255, 255, 255, 0.08);
        --ds-up-later-border: 0.5px solid rgba(255, 255, 255, 0.12);
        --ds-up-later-color: rgba(255, 255, 255, 0.85);
        --ds-up-later-hover-bg: rgba(255, 255, 255, 0.14);
        --ds-up-later-hover-color: #ffffff;
        --ds-up-warn-bg: rgba(255, 159, 10, 0.12);
        --ds-up-warn-border: 0.5px solid rgba(255, 159, 10, 0.28);
        --ds-up-warn-color: #ffd60a;
        --ds-up-warn-desc: rgba(255, 235, 204, 0.88);
        --ds-up-warn-cancel-bg: rgba(255, 255, 255, 0.08);
        --ds-up-warn-cancel-border: 0.5px solid rgba(255, 255, 255, 0.12);
        --ds-up-warn-cancel-color: #f5f5f7;
        --ds-up-warn-force-bg: #ff9f0a;
        --ds-up-warn-force-color: #000000;
      }

      #ds-update-capsule {
        background: var(--ds-up-backdrop) !important;
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
      }

      #ds-update-modal-card {
        animation: appleModalEntrance 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        background: var(--ds-up-card-bg);
        border: var(--ds-up-card-border);
        box-shadow: var(--ds-up-card-shadow);
        color: var(--ds-up-text-primary);
      }

      #ds-update-dismiss-btn:hover {
        background: var(--ds-up-dismiss-hover-bg) !important;
        color: var(--ds-up-dismiss-hover-color) !important;
      }

      #ds-update-later-btn:hover {
        background: var(--ds-up-later-hover-bg) !important;
        color: var(--ds-up-later-hover-color) !important;
      }

      #ds-update-reload-btn:hover {
        background: #0077ed !important;
        filter: brightness(1.05) !important;
      }
      #ds-update-reload-btn:active {
        transform: scale(0.98) !important;
      }
    </style>
    <div id="ds-update-modal-card" style="
      width: 100%;
      max-width: 26rem;
      box-sizing: border-box;
      background: var(--ds-up-card-bg);
      backdrop-filter: blur(48px) saturate(210%);
      -webkit-backdrop-filter: blur(48px) saturate(210%);
      border: var(--ds-up-card-border);
      border-radius: 1.5rem;
      box-shadow: var(--ds-up-card-shadow);
      padding: 1.375rem 1.375rem 1.25rem 1.375rem;
      color: var(--ds-up-text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    ">
      <!-- Header Bar -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.875rem;">
          <!-- Apple Software Update Squircle Icon -->
          <div style="
            width: 2.75rem;
            height: 2.75rem;
            border-radius: 0.75rem;
            background: linear-gradient(180deg, #2c7bf6 0%, #0056d6 100%);
            border: 0.5px solid rgba(255, 255, 255, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            flex-shrink: 0;
            box-shadow: 0 4px 14px rgba(0, 102, 230, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.45);
          ">
            <svg style="width: 1.375rem; height: 1.375rem;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h3 style="font-weight: 600; font-size: 1.0625rem; color: var(--ds-up-text-primary); margin: 0; letter-spacing: -0.015em; line-height: 1.25;">Đã có bản cập nhật mới</h3>
              <span style="font-size: 0.6875rem; font-weight: 500; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0.125rem 0.5rem; border-radius: 980px; background: var(--ds-up-badge-bg); border: var(--ds-up-badge-border); color: var(--ds-up-badge-color);">${displayVer}</span>
            </div>
            <p style="font-size: 0.8125rem; color: var(--ds-up-text-secondary); margin: 0.25rem 0 0 0; line-height: 1.38; letter-spacing: -0.005em;">DuyDev Studio phiên bản mới đã sẵn sàng cài đặt.</p>
          </div>
        </div>
        <!-- Circular Close Button -->
        <button type="button" id="ds-update-dismiss-btn" title="Bỏ qua" style="
          width: 1.625rem;
          height: 1.625rem;
          border-radius: 50%;
          background: var(--ds-up-dismiss-bg);
          border: var(--ds-up-dismiss-border);
          color: var(--ds-up-dismiss-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-size: 0.8125rem;
          line-height: 1;
          font-weight: 500;
          transition: background 0.15s ease, color 0.15s ease;
          flex-shrink: 0;
        ">✕</button>
      </div>

      <!-- Release Notes Highlights -->
      <div id="ds-update-highlights" style="margin-top: 1.125rem; display: flex; flex-direction: column; gap: 0.625rem; padding: 0.8125rem 0.9375rem; border-radius: 0.875rem; background: var(--ds-up-hl-bg); border: var(--ds-up-hl-border); font-size: 0.8125rem;">
        <div style="display: flex; align-items: center; gap: 0.625rem;">
          <div style="width: 1.375rem; height: 1.375rem; border-radius: 0.375rem; background: var(--ds-up-hl-icon-perf-bg); border: var(--ds-up-hl-icon-perf-border); display: flex; align-items: center; justify-content: center; color: var(--ds-up-hl-icon-perf-color); flex-shrink: 0;">
            <svg style="width: 0.75rem; height: 0.75rem;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style="color: var(--ds-up-hl-text); font-weight: 450; letter-spacing: -0.01em;">Tối ưu hóa hiệu năng & tốc độ xử lý tác vụ</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.625rem;">
          <div style="width: 1.375rem; height: 1.375rem; border-radius: 0.375rem; background: var(--ds-up-hl-icon-ui-bg); border: var(--ds-up-hl-icon-ui-border); display: flex; align-items: center; justify-content: center; color: var(--ds-up-hl-icon-ui-color); flex-shrink: 0;">
            <svg style="width: 0.75rem; height: 0.75rem;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6l-6.3 4.4 2.3-7.2-6-4.4h7.6z" />
            </svg>
          </div>
          <span style="color: var(--ds-up-hl-text); font-weight: 450; letter-spacing: -0.01em;">Tinh chỉnh giao diện mượt mà & loại bỏ độ trễ</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.625rem;">
          <div style="width: 1.375rem; height: 1.375rem; border-radius: 0.375rem; background: var(--ds-up-hl-icon-bug-bg); border: var(--ds-up-hl-icon-bug-border); display: flex; align-items: center; justify-content: center; color: var(--ds-up-hl-icon-bug-color); flex-shrink: 0;">
            <svg style="width: 0.75rem; height: 0.75rem;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span style="color: var(--ds-up-hl-text); font-weight: 450; letter-spacing: -0.01em;">Vá lỗi hệ thống & đồng bộ bộ nhớ đệm an toàn</span>
        </div>
      </div>

      <!-- In-flight Task Warning (Initially hidden) -->
      <div id="ds-update-warning-container" style="display: none; margin-top: 1.125rem; padding: 0.8125rem 0.9375rem; border-radius: 0.875rem; background: var(--ds-up-warn-bg); border: var(--ds-up-warn-border); font-size: 0.8125rem; color: var(--ds-up-warn-color);">
        <div style="display: flex; align-items: flex-start; gap: 0.625rem;">
          <svg style="width: 1.125rem; height: 1.125rem; color: var(--ds-up-warn-color); flex-shrink: 0; margin-top: 0.0625rem;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong style="color: var(--ds-up-warn-color); display: block; margin-bottom: 0.25rem; font-weight: 600;">Đang có tác vụ xử lý dở dang</strong>
            <span style="color: var(--ds-up-warn-desc); line-height: 1.35;">Hệ thống phát hiện đang có tiến trình tệp chạy ngầm. Cập nhật ngay sẽ làm mới trang và hủy tác vụ này.</span>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
          <button type="button" id="ds-update-cancel-warning-btn" style="
            padding: 0.375rem 0.875rem;
            border-radius: 980px;
            background: var(--ds-up-warn-cancel-bg);
            border: var(--ds-up-warn-cancel-border);
            color: var(--ds-up-warn-cancel-color);
            font-size: 0.75rem;
            font-weight: 500;
            cursor: pointer;
          ">Chờ xử lý xong</button>
          <button type="button" id="ds-update-force-reload-btn" style="
            padding: 0.375rem 0.875rem;
            border-radius: 980px;
            background: var(--ds-up-warn-force-bg);
            border: none;
            color: var(--ds-up-warn-force-color);
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(255, 149, 0, 0.3);
          ">Vẫn cập nhật</button>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div id="ds-update-footer-actions" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem; margin-top: 1.25rem;">
        <button type="button" id="ds-update-later-btn" style="
          padding: 0.4375rem 1rem;
          border-radius: 980px;
          background: var(--ds-up-later-bg);
          border: var(--ds-up-later-border);
          color: var(--ds-up-later-color);
          font-weight: 500;
          font-size: 0.8125rem;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        ">Để sau</button>
        <button type="button" id="ds-update-reload-btn" style="
          padding: 0.4375rem 1.1875rem;
          border-radius: 980px;
          background: #0071e3;
          color: #ffffff;
          font-weight: 500;
          font-size: 0.8125rem;
          letter-spacing: -0.01em;
          border: 0.5px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 1px 3px rgba(0, 113, 227, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          transition: background 0.15s ease, transform 0.1s ease;
        ">
          <span>Làm mới</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(capsule);

  // Sync theme changes in real-time if toggled while modal is open
  const handleThemeChange = (e) => {
    const isDark = e?.detail?.isDark ?? (typeof document !== 'undefined' && document.documentElement?.classList?.contains('dark'));
    capsule.classList.toggle('dark', Boolean(isDark));
  };
  if (typeof window !== 'undefined') {
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('ds-theme-change', handleThemeChange);
    }
    window.__ds_showUpdateModal = showUpdateNotificationCenter;
  }

  const reloadBtn = (capsule.querySelector && capsule.querySelector('#ds-update-reload-btn')) || document.getElementById('ds-update-reload-btn');
  const dismissBtn = (capsule.querySelector && capsule.querySelector('#ds-update-dismiss-btn')) || document.getElementById('ds-update-dismiss-btn');
  const laterBtn = (capsule.querySelector && capsule.querySelector('#ds-update-later-btn')) || document.getElementById('ds-update-later-btn');
  const warningContainer = (capsule.querySelector && capsule.querySelector('#ds-update-warning-container')) || document.getElementById('ds-update-warning-container');
  const highlightsContainer = (capsule.querySelector && capsule.querySelector('#ds-update-highlights')) || document.getElementById('ds-update-highlights');
  const forceReloadBtn = (capsule.querySelector && capsule.querySelector('#ds-update-force-reload-btn')) || document.getElementById('ds-update-force-reload-btn');
  const cancelWarningBtn = (capsule.querySelector && capsule.querySelector('#ds-update-cancel-warning-btn')) || document.getElementById('ds-update-cancel-warning-btn');

  const dismissModal = () => {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('ds-theme-change', handleThemeChange);
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('ds_update_capsule_dismissed', 'true');
      }
    } catch {}
    capsule.remove();
  };

  const handleExecuteUpdate = () => {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('ds-theme-change', handleThemeChange);
    }
    userRequestedReload = true;
    capsule.remove();

    if (waitingWorker) {
      try {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } catch {}
    }

    executeTripleLockPurge(waitingWorker);
  };

  reloadBtn?.addEventListener('click', () => {
    // 1. Verify no in-flight background tasks or active jobs
    if (typeof window !== 'undefined' && window.__ds_taskCoordinator?.getActiveTasks()?.length > 0) {
      console.log('[PWA] Tasks are active in background. Skipping reload.');
      if (warningContainer && highlightsContainer) {
        highlightsContainer.style.display = 'none';
        warningContainer.style.display = 'block';
      }
      return;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ds_studocu_active_job')) {
      console.log('[PWA] Studocu job active. Skipping reload.');
      if (warningContainer && highlightsContainer) {
        highlightsContainer.style.display = 'none';
        warningContainer.style.display = 'block';
      }
      return;
    }

    handleExecuteUpdate();
  });

  forceReloadBtn?.addEventListener('click', () => {
    handleExecuteUpdate();
  });

  cancelWarningBtn?.addEventListener('click', () => {
    if (warningContainer && highlightsContainer) {
      warningContainer.style.display = 'none';
      highlightsContainer.style.display = 'block';
    }
  });

  dismissBtn?.addEventListener('click', dismissModal);
  laterBtn?.addEventListener('click', dismissModal);

  capsule.addEventListener('click', (e) => {
    if (e.target === capsule) {
      dismissModal();
    }
  });
}

/**
 * Backward compatibility alias for showUpdateNotificationCenter.
 */
export const showUpdateCapsule = showUpdateNotificationCenter;

/**
 * Activates pending worker immediately when commanded.
 * @param {ServiceWorker | null} waitingWorker
 * @param {boolean} [_force=false]
 */
export function promptUserToApplyUpdate(waitingWorker, _force = false) {
  if (!waitingWorker) return;
  userRequestedReload = true;
  try {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } catch (_) {}
}

/**
 * Listens for waiting or newly installed workers and activates them in the background
 * without triggering an unannounced page reload during the user's active session.
 * Displays a non-intrusive Update Capsule when an update is ready while an active controller exists.
 * @param {ServiceWorkerRegistration | null} reg
 */
export function listenForWaitingWorker(reg) {
  if (!reg) return;

  function activateWorker(worker) {
    if (!worker) return;
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (_) {}
  }

  const hasController = Boolean(typeof navigator !== 'undefined' && navigator.serviceWorker?.controller);

  // 1. If a waiting worker already exists, activate it immediately in background
  if (reg.waiting) {
    activateWorker(reg.waiting);
    if (hasController) {
      showUpdateCapsule(reg.waiting);
    }
  }

  // 2. If a worker is currently installing when registration resolves
  if (reg.installing) {
    reg.installing.addEventListener('statechange', () => {
      if (reg.installing?.state === 'installed') {
        activateWorker(reg.installing);
        if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
          showUpdateCapsule(reg.installing);
        }
      }
    });
  }

  // 3. Listen for worker installation transitions for future updates
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (worker) {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          activateWorker(worker);
          if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
            showUpdateCapsule(worker);
          }
        }
      });
    }
  });
}

/**
 * Silent update check:
 * Compares the live server version from ./sw.js against local CacheStorage.
 * Triggers background SW update without forcing an unannounced page reload.
 * @returns {Promise<{ updated: boolean, message: string }>}
 */
export async function checkForAppUpdate() {
  try {
    const [localVer, serverVer] = await Promise.all([
      getCurrentVersion(),
      getServerVersion()
    ]);

    console.log(`[PWA] Checking update: Local=${localVer}, Server=${serverVer}`);

    const reg = swRegistration || (await navigator.serviceWorker?.getRegistration?.()) || null;
    if (reg) {
      listenForWaitingWorker(reg);
    }

    if (serverVer && serverVer !== localVer) {
      // New version found on server! Update Service Worker silently in background
      if (reg) {
        reg.update().catch(() => {});
        if (reg.waiting && navigator.serviceWorker?.controller) {
          showUpdateCapsule(reg.waiting);
        }
      }

      return {
        updated: true,
        message: `Đã có bản cập nhật mới (${serverVer}). Bản cập nhật sẽ tự động kích hoạt ở phiên tiếp theo.`
      };
    }

    // Already on latest version
    if (reg) {
      reg.update().catch(() => {});
      if (reg.waiting && navigator.serviceWorker?.controller) {
        showUpdateCapsule(reg.waiting);
      }
    }

    return {
      updated: false,
      message: `Bạn đang sử dụng phiên bản mới nhất (${localVer})`
    };
  } catch (err) {
    console.warn('[PWA] Update check failed:', err);
    return {
      updated: false,
      message: 'Không thể kết nối đến máy chủ để kiểm tra cập nhật (offline?)'
    };
  }
}

/**
 * Register the Service Worker, listen for updates, and auto-check
 * on visibility change (foreground resume).
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const hadExistingController = Boolean(navigator.serviceWorker.controller);
  refreshing = false;

  // When a new SW takes over, reload to apply new assets ONLY if the user explicitly commanded an update.
  // Otherwise, allow the new SW to control background requests without disrupting the active page session (zero double loading).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadExistingController) {
      console.log('[PWA] Initial Service Worker activated. Skipping reload.');
      return;
    }

    if (userRequestedReload) {
      // Never disrupt in-flight tasks or active downloads
      if (typeof window !== 'undefined' && window.__ds_taskCoordinator?.getActiveTasks()?.length > 0) {
        console.log('[PWA] Tasks are active in background. Skipping reload.');
        return;
      }
      const activeJob = localStorage.getItem('ds_studocu_active_job');
      if (activeJob) {
        console.log('[PWA] Studocu job active. Skipping reload.');
        return;
      }

      performSafeReload('User confirmed update', true);
    } else {
      console.log('[PWA] Service Worker controller updated in background. Next launch will use fresh cache without double loading.');
    }
  });

  const doRegister = () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        swRegistration = reg;
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        listenForWaitingWorker(reg);
        reg.update().catch(() => {});
      })
      .catch((error) => {
        console.warn('[PWA] ServiceWorker registration failed:', error);
      });
  };

  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister);
  }

  // Auto-check for updates when app returns to foreground or window regains focus.
  let lastBackgroundTime = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastBackgroundTime = Date.now();
    } else if (document.visibilityState === 'visible') {
      if (lastBackgroundTime > 0 && Date.now() - lastBackgroundTime > 30000) {
        checkForAppUpdate().catch(() => {});
      }
    }
  });

  window.addEventListener('focus', () => {
    if (lastBackgroundTime > 0 && Date.now() - lastBackgroundTime > 30000) {
      checkForAppUpdate().catch(() => {});
    }
  });
}

