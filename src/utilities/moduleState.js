/**
 * Universal Module State Persistence for DD Studio
 * Auto-saves and hydrates module states across browser reloads
 * Supports schema versioning, auto-purge on upgrade, and manual reset
 */

export const APP_SCHEMA_VERSION = 'v5.2.0';

function sanitizeForStorage(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (
    typeof obj === 'function' ||
    (typeof File !== 'undefined' && obj instanceof File) ||
    (typeof Blob !== 'undefined' && obj instanceof Blob) ||
    (typeof Element !== 'undefined' && obj instanceof Element)
  ) {
    return undefined;
  }
  if (seen.has(obj)) return undefined;
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj
      .map(item => sanitizeForStorage(item, seen))
      .filter(item => item !== undefined);
  }

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('is') || key.startsWith('has') || key === 'error' || key === 'progress') {
      continue;
    }
    const sanitized = sanitizeForStorage(val, seen);
    if (sanitized !== undefined) {
      clean[key] = sanitized;
    }
  }
  return clean;
}

export function loadModuleState(moduleId, defaultState, expectedVersion = APP_SCHEMA_VERSION) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(`ds_state_${moduleId}`);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);

    // Legacy unversioned state or version mismatch detection
    if (!parsed || typeof parsed !== 'object' || parsed.__v !== expectedVersion) {
      console.info(`[ModuleState] Schema version mismatch or legacy for "${moduleId}". Purging stale cache.`);
      localStorage.removeItem(`ds_state_${moduleId}`);
      return defaultState;
    }

    const savedData = parsed.data || {};
    return { ...defaultState, ...savedData };
  } catch (err) {
    console.warn(`[ModuleState] Failed to load state for ${moduleId}:`, err);
    return defaultState;
  }
}

export function saveModuleState(moduleId, state, version = APP_SCHEMA_VERSION) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const clean = sanitizeForStorage(state);
    const envelope = {
      __v: version,
      __time: Date.now(),
      data: clean
    };
    localStorage.setItem(`ds_state_${moduleId}`, JSON.stringify(envelope));
  } catch (err) {
    console.warn(`[ModuleState] Failed to save state for ${moduleId}:`, err);
  }
}

export function clearModuleState(moduleId) {
  try {
    localStorage.removeItem(`ds_state_${moduleId}`);
  } catch {}
}

export function clearAllModuleStates() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('ds_state_') || key === 'ds_last_route')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.info(`[ModuleState] Cleared ${keysToRemove.length} cached states.`);
  } catch (err) {
    console.warn('[ModuleState] Failed to clear all states:', err);
  }
}

export function renderResetStateButton(moduleId, label = 'Đặt lại') {
  // Purged: Users should not have accidental reset buttons wiping upload queues
  return '';
}

// Deprecated no-ops preserved for backward compatibility
export function saveLastRoute() {}
export function getLastRoute() { return ''; }

export default renderResetStateButton;
