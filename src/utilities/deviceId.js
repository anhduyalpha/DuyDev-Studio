/**
 * deviceId.js - Persistent Anonymous Client Device Identification
 * Zero-Login identity management for history partitioning and telemetry.
 */

const STORAGE_KEY_DEVICE_ID = 'ds_device_id';

/**
 * Retrieves the device ID from document cookies if present
 */
function getCookieDeviceId() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ds_device_id=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Persists the device ID in a long-lived cookie (10 years)
 */
function setCookieDeviceId(id) {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = 10 * 365 * 24 * 60 * 60; // 10 years
    document.cookie = `ds_device_id=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {}
}

/**
 * Generates a stable, high-entropy device identifier
 * Example: dev_m1a2b3c4_9f8e7d
 */
function generateDeviceId() {
  const ts = Date.now().toString(36);
  const r1 = Math.random().toString(36).substring(2, 8);
  const r2 = Math.random().toString(36).substring(2, 6);
  return `dev_${ts}_${r1}${r2}`;
}

/**
 * Returns the persistent unique device ID for the current browser/device.
 * Reads from localStorage first, falls back to cookie, or generates a fresh one.
 */
export function getDeviceId() {
  if (typeof window === 'undefined') return 'dev_server_side';

  // In-memory cache on window object
  if (window.__ds_device_id) {
    return window.__ds_device_id;
  }

  let deviceId = null;

  // 1. Try localStorage
  try {
    deviceId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
  } catch {}

  // 2. Try cookie fallback
  if (!deviceId) {
    deviceId = getCookieDeviceId();
  }

  // 3. Generate if missing
  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 6) {
    deviceId = generateDeviceId();
  }

  // Persist to both storage layers
  try {
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, deviceId);
  } catch {}
  setCookieDeviceId(deviceId);

  window.__ds_device_id = deviceId;
  return deviceId;
}
