/**
 * usePWAInstall Hook
 * Manages browser installation prompt for PWA.
 */

import { showToast } from '../utilities/toast.js';

class PWAInstallManager {
  constructor() {
    this.deferredPrompt = null;
    this.listeners = new Set();
    const hasWindow = typeof window !== 'undefined';
    this.isInstalled = hasWindow
      ? Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator && 'standalone' in window.navigator && window.navigator.standalone))
      : false;

    if (hasWindow) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.notify(true);
      });

      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.isInstalled = true;
        this.notify(false);
        showToast('Đã cài đặt ứng dụng', 'success');
      });
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(Boolean(this.deferredPrompt), this.isInstalled);
    return () => this.listeners.delete(listener);
  }

  notify(canInstall) {
    this.listeners.forEach(fn => fn(canInstall, this.isInstalled));
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      showToast('Ứng dụng đã được cài đặt', 'info');
      return false;
    }
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.notify(false);
    return outcome === 'accepted';
  }
}

export const pwaInstall = new PWAInstallManager();
