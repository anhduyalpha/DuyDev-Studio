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

export const CURRENT_PWA_VERSION = 'duydev-studio-v18.8';

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

/**
 * Prompts the user with an actionable toast to apply the pending update.
 * @param {ServiceWorker | null} waitingWorker
 */
export function promptUserToApplyUpdate(waitingWorker) {
  if (updateToastShown || !waitingWorker) return;
  updateToastShown = true;

  import('./toast.js')
    .then(({ showActionableToast }) => {
      showActionableToast('Đã có bản cập nhật mới', {
        type: 'info',
        actionText: 'Cập nhật',
        duration: 12000,
        onAction: () => {
          userRequestedReload = true;
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    })
    .catch(() => {});
}

/**
 * Listens for waiting or newly installed workers without hijacking the active session.
 * @param {ServiceWorkerRegistration | null} reg
 */
export function listenForWaitingWorker(reg) {
  if (!reg) return;

  // If a waiting worker already exists and the page is controlled by an active worker
  if (reg.waiting && navigator.serviceWorker?.controller) {
    promptUserToApplyUpdate(reg.waiting);
    return;
  }

  // Listen for worker installation transitions
  reg.addEventListener('updatefound', () => {
    const installingWorker = reg.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed' && navigator.serviceWorker?.controller) {
        promptUserToApplyUpdate(installingWorker);
      }
    });
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

    if (serverVer && serverVer !== localVer) {
      // New version found on server! Update Service Worker silently in background
      if (swRegistration) {
        swRegistration.update().catch(() => {});
        if (swRegistration.waiting && navigator.serviceWorker?.controller) {
          promptUserToApplyUpdate(swRegistration.waiting);
        }
      }

      return {
        updated: true,
        message: `Đã có bản cập nhật mới (${serverVer}). Bản cập nhật sẽ tự động kích hoạt ở phiên tiếp theo.`
      };
    }

    // Already on latest version
    if (swRegistration) {
      swRegistration.update().catch(() => {});
      if (swRegistration.waiting && navigator.serviceWorker?.controller) {
        promptUserToApplyUpdate(swRegistration.waiting);
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

  // When a new SW takes over, reload to apply new assets ONLY if an older SW was controlling the page AND user explicitly confirmed
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadExistingController) {
      console.log('[PWA] Initial Service Worker activated. Skipping reload.');
      return;
    }
    // Reload only when the user explicitly confirmed the update
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
      performSafeReload('User confirmed update');
    } else {
      console.log('[PWA] Service Worker controller updated in background. Will apply on next session.');
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

