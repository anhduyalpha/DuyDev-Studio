/**
 * Unified Notification Helper for DuyDev Studio.
 * Provides high-priority, responsive system notifications across:
 * 1. Native Android APK via AndroidBridge (heads-up banners, sound, vibration, lockscreen visibility).
 * 2. Mobile / Desktop Web Push via Service Worker / HTML5 Notification API.
 */

/**
 * Checks whether system push notifications are supported in the current environment.
 * @returns {boolean}
 */
export function isNotificationSupported() {
  if (typeof window === 'undefined') return false;
  if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === 'function') {
    return true;
  }
  return 'Notification' in window;
}

/**
 * Gets current notification permission status: 'granted' | 'denied' | 'default' | 'unsupported'.
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';

  // Android Native APK layer
  if (window.AndroidBridge && typeof window.AndroidBridge.hasNotificationPermission === 'function') {
    try {
      return window.AndroidBridge.hasNotificationPermission() ? 'granted' : 'denied';
    } catch (_) {
      return 'granted';
    }
  }

  // Web Push API
  if ('Notification' in window) {
    return Notification.permission;
  }

  return 'unsupported';
}

/**
 * Prompts user for system notification permission if not yet granted.
 * @returns {Promise<'granted' | 'denied' | 'default'>}
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined') return 'default';

  // Native Android
  if (window.AndroidBridge && typeof window.AndroidBridge.requestNotificationPermission === 'function') {
    try {
      window.AndroidBridge.requestNotificationPermission();
      // Wait briefly for user response in native prompt
      await new Promise((r) => setTimeout(r, 600));
      return getNotificationPermission();
    } catch (_) {}
  }

  // Web Notification API
  if ('Notification' in window) {
    if (Notification.permission === 'granted') return 'granted';
    try {
      const res = await Notification.requestPermission();
      return res;
    } catch (_) {
      return Notification.permission;
    }
  }

  return 'default';
}

/**
 * Opens system app notification settings (Android Native).
 */
export function openNotificationSettings() {
  if (typeof window === 'undefined') return;
  if (window.AndroidBridge && typeof window.AndroidBridge.openNotificationSettings === 'function') {
    try {
      window.AndroidBridge.openNotificationSettings();
    } catch (_) {}
  }
}

/**
 * Dispatches a high-priority system notification.
 * @param {string} title
 * @param {string} message
 * @param {object} [options]
 * @param {string} [options.type] - Notification category ('task_completed', 'download_completed', 'error', etc.)
 * @param {string} [options.url] - Deep link URL to focus on click
 * @param {string} [options.tag] - Notification identifier for replacing older notifications
 * @param {string} [options.icon] - Notification icon URL
 */
export function showNotification(title, message, options = {}) {
  if (typeof window === 'undefined') return;

  const cleanTitle = String(title || 'DuyDev Studio').trim();
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage && !cleanTitle) return;

  // 1. Android Native APK Container
  if (window.AndroidBridge && typeof window.AndroidBridge.showNotification === 'function') {
    try {
      window.AndroidBridge.showNotification(
        cleanTitle,
        cleanMessage,
        options.type || 'task_completed'
      );
      return;
    } catch (err) {
      console.warn('[NotificationHelper] Native bridge notification failed:', err);
    }
  }

  // 2. Web / PWA Push Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    const icon = options.icon || './src/assets/icon-192.png';
    const tag = options.tag || `ds_notif_${Date.now()}`;
    const targetUrl = options.url || window.location.href;

    // Prefer Service Worker registration to handle background clicks & vibration patterns
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((registration) => {
          registration.showNotification(cleanTitle, {
            body: cleanMessage,
            icon,
            badge: icon,
            tag,
            renotify: true,
            requireInteraction: false,
            vibrate: [0, 200, 100, 200],
            data: { url: targetUrl }
          });
        })
        .catch(() => {
          fallbackBrowserNotification(cleanTitle, cleanMessage, icon, tag, targetUrl);
        });
    } else {
      fallbackBrowserNotification(cleanTitle, cleanMessage, icon, tag, targetUrl);
    }
  }
}

/**
 * Fallback to direct HTML5 Notification instance.
 */
function fallbackBrowserNotification(title, body, icon, tag, targetUrl) {
  try {
    const n = new Notification(title, {
      body,
      icon,
      tag
    });
    n.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (targetUrl && targetUrl !== window.location.href) {
        window.location.href = targetUrl;
      }
      n.close();
    };
  } catch (_) {}
}

/**
 * Shortcut to notify job or download completion with high prominence.
 * @param {string} title
 * @param {string} message
 * @param {object} [options]
 */
export function notifyJobComplete(title, message, options = {}) {
  showNotification(title, message, {
    ...options,
    type: 'job_completed'
  });
}

/**
 * Shortcut to notify job failure or error.
 * @param {string} title
 * @param {string} message
 * @param {object} [options]
 */
export function notifyJobFailed(title, message, options = {}) {
  showNotification(title, message, {
    ...options,
    type: 'job_failed'
  });
}

export const notificationHelper = {
  isSupported: isNotificationSupported,
  getPermission: getNotificationPermission,
  requestPermission: requestNotificationPermission,
  openSettings: openNotificationSettings,
  send: showNotification,
  notifyComplete: notifyJobComplete,
  notifyFailed: notifyJobFailed
};

