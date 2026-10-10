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

export const CURRENT_PWA_VERSION = 'duydev-studio-v22.8';

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
 * Renders a discreet, non-intrusive floating Update Capsule in the corner
 * adhering to Apple Sequoia aesthetic (dark frosted glass pill, glowing dot, dismissable).
 * @param {ServiceWorker | null} waitingWorker
 */
export function showUpdateCapsule(waitingWorker) {
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
  capsule.style.cssText = [
    'position: fixed',
    'bottom: 1.25rem',
    'right: 1.25rem',
    'z-index: 9999',
    'display: flex',
    'align-items: center',
    'gap: 0.75rem',
    'padding: 0.5rem 0.875rem',
    'max-width: calc(100vw - 2.5rem)',
    'box-sizing: border-box',
    'background: rgba(24, 24, 27, 0.88)',
    'backdrop-filter: blur(16px)',
    '-webkit-backdrop-filter: blur(16px)',
    'border: 1px solid rgba(255, 255, 255, 0.12)',
    'border-radius: 9999px',
    'box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    'color: #e4e4e7',
    'font-size: 0.75rem',
    'user-select: none'
  ].join(';');

  const displayVer = CURRENT_PWA_VERSION.replace('duydev-studio-', '') || 'v22.8';

  capsule.innerHTML = `
    <span style="width: 8px; height: 8px; border-radius: 9999px; background: #10b981; box-shadow: 0 0 8px #10b981; flex-shrink: 0; display: inline-block;"></span>
    <span style="font-weight: 500; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Đã có bản cập nhật mới (${displayVer})</span>
    <button type="button" id="ds-update-reload-btn" style="
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      background: #4f46e5;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.75rem;
      border: none;
      cursor: pointer;
      line-height: 1.2;
      flex-shrink: 0;
    ">Làm mới</button>
    <button type="button" id="ds-update-dismiss-btn" style="
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 0.875rem;
      cursor: pointer;
      padding: 0.125rem 0.25rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    " title="Bỏ qua">✕</button>
  `;

  document.body.appendChild(capsule);

  const reloadBtn = (capsule.querySelector && capsule.querySelector('#ds-update-reload-btn')) || document.getElementById('ds-update-reload-btn');
  const dismissBtn = (capsule.querySelector && capsule.querySelector('#ds-update-dismiss-btn')) || document.getElementById('ds-update-dismiss-btn');

  reloadBtn?.addEventListener('click', () => {
    // 1. Verify no in-flight background tasks or active jobs
    if (typeof window !== 'undefined' && window.__ds_taskCoordinator?.getActiveTasks()?.length > 0) {
      console.log('[PWA] Tasks are active in background. Skipping reload.');
      return;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ds_studocu_active_job')) {
      console.log('[PWA] Studocu job active. Skipping reload.');
      return;
    }

    userRequestedReload = true;
    capsule.remove();

    if (waitingWorker) {
      try {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      } catch {}
      // In controllerchange, safe reload will execute when worker takes control.
      // Fallback timer ensures reload executes if controllerchange doesn't fire (e.g. worker was already controlling)
      setTimeout(() => {
        performSafeReload('User confirmed update (controllerchange fallback)', true);
      }, 1000);
    } else {
      performSafeReload('User clicked update capsule', true);
    }
  });

  dismissBtn?.addEventListener('click', () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('ds_update_capsule_dismissed', 'true');
      }
    } catch {}
    capsule.remove();
  });
}

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

