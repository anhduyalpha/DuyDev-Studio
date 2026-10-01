/**
 * PWA Service Worker Registration & Lifecycle Manager
 * Handles SW registration, automatic update checks on foreground,
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
 * Query the active Service Worker for its CACHE_NAME version string.
 * Falls back to 'unknown' if SW is unavailable or doesn't respond within 2s.
 * @returns {Promise<string>}
 */
export function getSwVersion() {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) {
      resolve('unknown');
      return;
    }

    /** @type {ReturnType<typeof setTimeout> | null} */
    let timeoutId = null;

    const onMessage = (e) => {
      if (e.data?.type === 'VERSION_INFO') {
        navigator.serviceWorker.removeEventListener('message', onMessage);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(e.data.version || 'unknown');
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    controller.postMessage({ type: 'GET_VERSION' });

    // Fallback timeout: resolve with 'unknown' if SW doesn't respond
    timeoutId = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      resolve('unknown');
    }, 2000);
  });
}

/**
 * Trigger Service Worker update check.
 * If a new worker is found, the existing controllerchange listener will
 * automatically reload the page once the new SW activates.
 * @returns {Promise<{ updated: boolean, message: string }>}
 */
export async function checkForAppUpdate() {
  if (!swRegistration) {
    return { updated: false, message: 'Service Worker chưa sẵn sàng' };
  }
  try {
    await swRegistration.update();
    const waiting = swRegistration.waiting || swRegistration.installing;
    if (waiting) {
      return { updated: true, message: 'Đang tải bản cập nhật mới...' };
    }
    return { updated: false, message: 'Bạn đang sử dụng phiên bản mới nhất' };
  } catch (err) {
    console.warn('[PWA] Update check failed:', err);
    return { updated: false, message: 'Không thể kiểm tra cập nhật (offline?)' };
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
    if (document.visibilityState === 'visible' && swRegistration) {
      swRegistration.update().catch(() => {});
    }
  });
}
