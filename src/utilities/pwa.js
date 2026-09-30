/**
 * PWA Service Worker Registration & Lifecycle Manager
 * Handles background sync, auto updates, manual update triggering, and observable UI state.
 */

import { showToast } from './toast.js';

class PWAUpdateManager {
  constructor() {
    this.registration = null;
    this.hasUpdate = false;
    this.isChecking = false;
    this.waitingWorker = null;
    this.listeners = new Set();
    this.refreshing = false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.hasUpdate, this.isChecking);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => fn(this.hasUpdate, this.isChecking));
  }

  init(registration) {
    this.registration = registration;

    // Check if a worker is already waiting
    if (registration.waiting) {
      this.waitingWorker = registration.waiting;
      this.hasUpdate = true;
      this.notify();
    }

    // Monitor for new service worker being installed
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.waitingWorker = installingWorker;
          this.hasUpdate = true;
          this.notify();
          showToast('Đã có bản cập nhật mới! Nhấn Cập nhật để áp dụng.', 'info', 6000);
        }
      });
    });

    // Check for updates on visibility change (when resuming app from background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdate(false);
      }
    });

    // Periodic background update check (every 15 minutes)
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdate(false);
      }
    }, 15 * 60 * 1000);
  }

  async checkForUpdate(isManual = false) {
    if (this.isChecking) return;
    this.isChecking = true;
    this.notify();

    try {
      if (!navigator.onLine) {
        if (isManual) showToast('Không có kết nối mạng', 'warning');
        return;
      }

      if (!this.registration) {
        this.registration = await navigator.serviceWorker?.getRegistration();
      }

      if (this.registration) {
        // If an update is already waiting, prompt or apply
        if (this.registration.waiting) {
          this.waitingWorker = this.registration.waiting;
          this.hasUpdate = true;
          this.notify();
          if (isManual) {
            this.applyUpdate();
            return;
          }
        }

        await this.registration.update();

        // Brief delay to allow updatefound event to fire if a new worker is discovered
        await new Promise((r) => setTimeout(r, 1200));

        if (this.hasUpdate) {
          if (isManual) {
            this.applyUpdate();
          }
        } else if (isManual) {
          showToast('Ứng dụng đang ở phiên bản mới nhất', 'success');
        }
      } else if (isManual) {
        showToast('Ứng dụng đang ở phiên bản mới nhất', 'success');
      }
    } catch (err) {
      console.warn('[PWA] Update check error:', err);
      if (isManual) {
        showToast('Không thể kiểm tra bản cập nhật lúc này', 'warning');
      }
    } finally {
      this.isChecking = false;
      this.notify();
    }
  }

  applyUpdate() {
    if (this.refreshing) return;
    this.refreshing = true;

    showToast('Đang khởi động phiên bản mới...', 'info', 2000);

    if (this.waitingWorker) {
      this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }
}

export const pwaUpdate = new PWAUpdateManager();

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pwaUpdate.refreshing) return;
      pwaUpdate.refreshing = true;
      console.log('[PWA] Controller changed -> Auto refreshing page for instant update...');
      window.location.reload();
    });

    const doRegister = () => {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
          pwaUpdate.init(reg);
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
  }
}
