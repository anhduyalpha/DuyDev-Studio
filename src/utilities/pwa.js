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

export const CURRENT_PWA_VERSION = 'duydev-studio-v16.5';

/**
 * Read the current local version from CacheStorage or fallback constant.
 * @returns {Promise<string>}
 */
export async function getCurrentVersion() {
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      const pwaKey = keys.find((k) => k.startsWith('duydev-studio-'));
      if (pwaKey) return pwaKey;
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

    if (serverVer && serverVer !== localVer) {
      // New version found on server! Update Service Worker silently in background
      if (swRegistration) {
        swRegistration.update().catch(() => {});
      }

      // Proactively clear stale cache keys so next launch loads fresh
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(
            keys.filter((k) => k !== serverVer).map((k) => caches.delete(k))
          );
        } catch {}
      }

      return {
        updated: true,
        message: `Đã có bản cập nhật mới (${serverVer}). Bản cập nhật sẽ tự động kích hoạt ở phiên tiếp theo.`
      };
    }

    // Already on latest version
    if (swRegistration) {
      swRegistration.update().catch(() => {});
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
  let refreshing = false;

  const performSafeReload = (reason) => {
    if (refreshing) return;
    const lastReload = sessionStorage.getItem('ds_sw_just_reloaded');
    if (lastReload && Date.now() - Number(lastReload) < 10000) {
      console.log(`[PWA] Skipping reload (${reason}): already reloaded recently`);
      return;
    }
    refreshing = true;
    try { sessionStorage.setItem('ds_sw_just_reloaded', String(Date.now())); } catch {}
    console.log(`[PWA] ${reason} -> Reloading to apply new assets...`);
    window.location.reload();
  };

  // When a new SW takes over, reload to apply new assets ONLY if an older SW was controlling the page
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadExistingController) {
      console.log('[PWA] Initial Service Worker activated. Skipping reload.');
      return;
    }
    performSafeReload('Controller updated');
  });

  const doRegister = () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        swRegistration = reg;
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
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

  // Auto-check for updates only when app returns after being in the background for > 5 minutes.
  // This completely eliminates unwanted reloads when returning from file picker dialogs or quick tab switches.
  let lastBackgroundTime = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lastBackgroundTime = Date.now();
    } else if (document.visibilityState === 'visible') {
      if (lastBackgroundTime > 0 && Date.now() - lastBackgroundTime > 300000) {
        checkForAppUpdate().catch(() => {});
      }
    }
  });
}

