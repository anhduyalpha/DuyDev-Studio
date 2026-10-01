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
  return 'duydev-studio-v15.0';
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
 * Deterministic update check:
 * Compares the live server version from ./sw.js against local CacheStorage.
 * If server version differs from local, triggers update and auto-reload.
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
      // New version found! Trigger SW update
      if (swRegistration) {
        swRegistration.update().catch(() => {});
      }

      // Proactively clear stale cache keys so the new version loads clean
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(
            keys.filter((k) => k !== serverVer).map((k) => caches.delete(k))
          );
        } catch {}
      }

      // Schedule reload with cache buster
      setTimeout(() => {
        window.location.replace(
          window.location.origin +
            window.location.pathname +
            `?v=${Date.now()}` +
            window.location.hash
        );
      }, 1000);

      return {
        updated: true,
        message: `Đã có bản cập nhật mới (${serverVer}). Đang tải và áp dụng...`
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

  let refreshing = false;

  // When a new SW takes over, reload to apply new assets
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[PWA] Controller changed -> Auto refreshing...');
    window.location.reload();
  });

  const doRegister = () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        swRegistration = reg;
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        reg.update().catch(() => {});

        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'activated' ||
              (installingWorker.state === 'installed' && navigator.serviceWorker.controller)
            ) {
              if (!refreshing) {
                refreshing = true;
                console.log('[PWA] New version activated, refreshing...');
                window.location.reload();
              }
            }
          });
        };
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

  // Auto-check for updates when app returns from background (foreground resume)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate().catch(() => {});
    }
  });
}
