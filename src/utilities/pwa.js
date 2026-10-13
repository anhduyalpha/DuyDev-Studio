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

export const CURRENT_PWA_VERSION = 'duydev-studio-v22.53';

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
  capsule.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 99999',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 1rem',
    'box-sizing: border-box',
    'background: rgba(0, 0, 0, 0.65)',
    'backdrop-filter: blur(12px)',
    '-webkit-backdrop-filter: blur(12px)',
    'transition: opacity 0.2s ease-out'
  ].join(';');

  const displayVer = CURRENT_PWA_VERSION.replace('duydev-studio-', '') || 'v22.53';

  capsule.innerHTML = `
    <div id="ds-update-modal-card" style="
      width: 100%;
      max-width: 28rem;
      box-sizing: border-box;
      background: rgba(18, 18, 23, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 1.25rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      padding: 1.5rem;
      color: #e4e4e7;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <!-- Header Bar -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="
            width: 2.75rem;
            height: 2.75rem;
            border-radius: 0.875rem;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
            border: 1px solid rgba(99, 102, 241, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #818cf8;
            flex-shrink: 0;
            box-shadow: 0 0 18px rgba(99, 102, 241, 0.25);
          ">
            <svg style="width: 1.5rem; height: 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h3 style="font-weight: 700; font-size: 1.0625rem; color: #f4f4f5; margin: 0; letter-spacing: -0.01em;">Đã có bản cập nhật mới</h3>
              <span style="font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 9999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399;">${displayVer}</span>
            </div>
            <p style="font-size: 0.8125rem; color: #a1a1aa; margin: 0.25rem 0 0 0; line-height: 1.35;">Phiên bản mới đã sẵn sàng. Vui lòng làm mới để nạp code mới nhất.</p>
          </div>
        </div>
        <button type="button" id="ds-update-dismiss-btn" title="Bỏ qua" style="
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 1.125rem;
          cursor: pointer;
          padding: 0.25rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          transition: color 0.15s ease;
          flex-shrink: 0;
        ">✕</button>
      </div>

      <!-- Feature Highlights -->
      <div id="ds-update-highlights" style="margin-top: 1.125rem; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 0.875rem; border-radius: 0.75rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); font-size: 0.8125rem; color: #d4d4d8;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #818cf8; font-size: 0.875rem;">⚡</span>
          <span>Tối ưu hóa hiệu năng & tốc độ xử lý tác vụ</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #34d399; font-size: 0.875rem;">🎨</span>
          <span>Tinh chỉnh giao diện mượt mà & loại bỏ độ trễ</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #fbbf24; font-size: 0.875rem;">🛡️</span>
          <span>Vá lỗi hệ thống & đồng bộ bộ nhớ đệm an toàn</span>
        </div>
      </div>

      <!-- In-flight Task Warning (Initially hidden) -->
      <div id="ds-update-warning-container" style="display: none; margin-top: 1.125rem; padding: 0.75rem 0.875rem; border-radius: 0.75rem; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.8125rem; color: #fde68a;">
        <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
          <span style="color: #f59e0b; font-size: 1rem; line-height: 1.2;">⚠️</span>
          <div>
            <strong style="color: #fbbf24; display: block; margin-bottom: 0.25rem;">Đang có tác vụ xử lý dở dang</strong>
            <span>Hệ thống phát hiện đang có tiến trình tệp chạy ngầm. Cập nhật ngay sẽ làm mới trang và hủy tác vụ này.</span>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
          <button type="button" id="ds-update-cancel-warning-btn" style="
            padding: 0.375rem 0.75rem;
            border-radius: 0.5rem;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #d4d4d8;
            font-size: 0.75rem;
            font-weight: 500;
            cursor: pointer;
          ">Chờ xử lý xong</button>
          <button type="button" id="ds-update-force-reload-btn" style="
            padding: 0.375rem 0.75rem;
            border-radius: 0.5rem;
            background: #d97706;
            border: 1px solid #f59e0b;
            color: #ffffff;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
          ">Vẫn cập nhật</button>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div id="ds-update-footer-actions" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem; margin-top: 1.25rem;">
        <button type="button" id="ds-update-later-btn" style="
          padding: 0.5rem 1rem;
          border-radius: 0.625rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #a1a1aa;
          font-weight: 500;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        ">Để sau</button>
        <button type="button" id="ds-update-reload-btn" style="
          padding: 0.5rem 1.125rem;
          border-radius: 0.625rem;
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          color: #ffffff;
          font-weight: 600;
          font-size: 0.8125rem;
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
          display: flex;
          align-items: center;
          gap: 0.375rem;
          transition: transform 0.1s ease, filter 0.15s ease;
        ">Làm mới</button>
      </div>
    </div>
  `;

  document.body.appendChild(capsule);

  const reloadBtn = (capsule.querySelector && capsule.querySelector('#ds-update-reload-btn')) || document.getElementById('ds-update-reload-btn');
  const dismissBtn = (capsule.querySelector && capsule.querySelector('#ds-update-dismiss-btn')) || document.getElementById('ds-update-dismiss-btn');
  const laterBtn = (capsule.querySelector && capsule.querySelector('#ds-update-later-btn')) || document.getElementById('ds-update-later-btn');
  const warningContainer = (capsule.querySelector && capsule.querySelector('#ds-update-warning-container')) || document.getElementById('ds-update-warning-container');
  const highlightsContainer = (capsule.querySelector && capsule.querySelector('#ds-update-highlights')) || document.getElementById('ds-update-highlights');
  const forceReloadBtn = (capsule.querySelector && capsule.querySelector('#ds-update-force-reload-btn')) || document.getElementById('ds-update-force-reload-btn');
  const cancelWarningBtn = (capsule.querySelector && capsule.querySelector('#ds-update-cancel-warning-btn')) || document.getElementById('ds-update-cancel-warning-btn');

  const dismissModal = () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('ds_update_capsule_dismissed', 'true');
      }
    } catch {}
    capsule.remove();
  };

  const handleExecuteUpdate = () => {
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

