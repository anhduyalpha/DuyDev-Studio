/**
 * visitorTracker.js - Full-Lifecycle Client Visitor Tracker ("Vào web ra web cũng log được")
 * Tracks session entry, route changes, heartbeat liveness, and graceful exit (pagehide/beforeunload/beacon)
 * Zero external dependencies. Self-hosted telemetry only.
 */

import { getDeviceId } from './deviceId.js';
import { isAdminAuthenticated } from './adminAuth.js';

class VisitorTracker {
  constructor() {
    this.sessionId = null;
    this.visitorId = null;
    this.deviceId = null;
    this.sessionStartTime = Date.now();
    this.currentRoute = '#dashboard';
    this.heartbeatTimer = null;
    this.isInitialized = false;
    this.leaveReported = false;
    // 2x interval on mobile/APK (window.AndroidBridge or mobile UA) to reduce cellular/Wi-Fi radio wake-ups
    const isMobileOrApk = typeof window !== 'undefined' && (Boolean(window.AndroidBridge) || /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || ''));
    this.heartbeatIntervalMs = isMobileOrApk ? 50_000 : 25_000;
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 0. Persistent Device ID (stable across sessions & browser cookies)
    this.deviceId = getDeviceId();

    // 1. Session ID (per browser tab/window via sessionStorage)
    try {
      this.sessionId = sessionStorage.getItem('ds_session_id');
      if (!this.sessionId) {
        this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('ds_session_id', this.sessionId);
      }
    } catch {
      this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // 2. Persistent Visitor ID (across tabs/visits via localStorage)
    try {
      this.visitorId = localStorage.getItem('ds_visitor_id');
      if (!this.visitorId) {
        this.visitorId = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('ds_visitor_id', this.visitorId);
      }
    } catch {
      this.visitorId = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    this.currentRoute = window.location.hash || '#dashboard';

    // 3. Send Session Enter Beacon
    this.reportEnter();

    // 4. Start Periodic Heartbeat
    this.startHeartbeat();

    // 5. Visibility Change (pause heartbeat when tab/app hidden, resume & tick when visible with debounce)
    let lastResumeHeartbeatTime = 0;
    const handleForeground = () => {
      this.leaveReported = false;
      this.startHeartbeat();
      const now = Date.now();
      if (now - lastResumeHeartbeatTime >= 20_000) {
        lastResumeHeartbeatTime = now;
        this.sendHeartbeat();
      }
    };
    const handleBackground = () => {
      this.stopHeartbeat();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleForeground();
      } else {
        handleBackground();
      }
    });

    window.addEventListener('ds:visibility-change', (e) => {
      if (e.detail?.hidden) {
        handleBackground();
      } else {
        handleForeground();
      }
    });
    window.addEventListener('ds:native-app-paused', handleBackground);
    window.addEventListener('ds:native-app-resumed', handleForeground);

    // 6. Page Exit / Unload Beacon (pagehide is most reliable on mobile Safari & modern browsers)
    const handleExit = () => {
      this.reportLeave();
    };

    window.addEventListener('pagehide', handleExit, { capture: true });
    window.addEventListener('beforeunload', handleExit, { capture: true });

    // Expose session ID globally for fetch interceptors
    window.__ds_session_id = this.sessionId;
  }

  reportEnter() {
    try {
      const isPwa = Boolean(
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator?.standalone === true
      );

      const screenRes = window.screen ? `${window.screen.width}x${window.screen.height}` : 'Unknown';

      const isAdmin = Boolean(isAdminAuthenticated());
      const payload = {
        sessionId: this.sessionId,
        visitorId: this.visitorId,
        deviceId: this.deviceId,
        isAdmin,
        route: this.currentRoute,
        referrer: document.referrer || '',
        screen: screenRes,
        pwaMode: isPwa
      };

      fetch('/api/v1/telemetry/session/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.sessionId,
          'X-Device-Id': this.deviceId,
          ...(isAdmin ? { 'X-Is-Admin': 'true' } : {})
        },
        body: JSON.stringify(payload)
      }).catch(() => {
        // Silent fail for offline/firewall modes
      });
    } catch {}
  }

  notifyRouteChange(newRoute) {
    if (!newRoute) return;
    const cleanRoute = String(newRoute).trim() || '#dashboard';
    if (cleanRoute === this.currentRoute) return;

    this.currentRoute = cleanRoute;
    this.sendHeartbeat(cleanRoute);
  }

  sendHeartbeat(routeOverride = null) {
    if (!this.sessionId) return;
    if (typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden')) return;
    try {
      const route = routeOverride || this.currentRoute || window.location.hash || '#dashboard';
      const isAdmin = Boolean(isAdminAuthenticated());
      fetch('/api/v1/telemetry/session/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.sessionId,
          'X-Device-Id': this.deviceId,
          ...(isAdmin ? { 'X-Is-Admin': 'true' } : {})
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          deviceId: this.deviceId,
          isAdmin,
          route
        })
      }).catch(() => {});
    } catch {}
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.sendHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  reportLeave() {
    if (this.leaveReported || !this.sessionId) return;
    this.leaveReported = true;
    this.stopHeartbeat();

    try {
      const durationSec = Math.max(0, Math.floor((Date.now() - this.sessionStartTime) / 1000));
      const payloadStr = JSON.stringify({
        sessionId: this.sessionId,
        deviceId: this.deviceId,
        durationSec,
        lastRoute: this.currentRoute || window.location.hash || '#dashboard'
      });

      // Priority 1: navigator.sendBeacon
      if (navigator.sendBeacon) {
        const blob = new Blob([payloadStr], { type: 'text/plain;charset=UTF-8' });
        const sent = navigator.sendBeacon('/api/v1/telemetry/session/leave', blob);
        if (sent) return;
      }

      // Priority 2: keepalive fetch fallback
      if (typeof fetch === 'function') {
        fetch('/api/v1/telemetry/session/leave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': this.deviceId
          },
          body: payloadStr,
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  }
}

export const visitorTracker = new VisitorTracker();
