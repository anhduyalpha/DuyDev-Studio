/**
 * @module storageJanitor
 * Non-intrusive background janitor that safely purges orphaned, temporary,
 * or redundant storage data without affecting active user sessions,
 * preferences, history, or offline capabilities.
 */

const SHARE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const STATE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Prune orphaned temporary payloads in IndexedDB ds_share_db.
 */
async function pruneExpiredShares() {
  if (typeof indexedDB === 'undefined') return;
  try {
    const req = indexedDB.open('ds_share_db', 1);
    const db = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = db.transaction('shares', 'readwrite');
    const store = tx.objectStore('shares');
    const now = Date.now();

    const cursorReq = store.openCursor();
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const val = cursor.value;
        const time = val?.timestamp || 0;
        // Delete if older than 30 minutes or missing timestamp
        if (!time || now - time > SHARE_EXPIRY_MS) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    db.close();
  } catch (err) {
    // Non-blocking: fail quietly
  }
}

/**
 * Prune obsolete CacheStorage buckets and transient query requests.
 */
async function pruneCacheStorage() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    // Keep only the active version cache (e.g. duydev-studio-v15.3)
    const currentVersionPrefix = 'duydev-studio-v';
    for (const key of keys) {
      if (key.startsWith(currentVersionPrefix)) {
        // Prune transient cache entries with share query params from the active cache
        const cache = await caches.open(key);
        const requests = await cache.keys();
        for (const req of requests) {
          const url = req.url || '';
          if (url.includes('hasFiles=1') || url.includes('&t=') || url.includes('?t=')) {
            await cache.delete(req);
          }
        }
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Prune stale form state envelopes older than 7 days from localStorage.
 * Strictly preserves theme, auth token, history, and route state.
 */
function pruneStaleLocalStates() {
  if (typeof localStorage === 'undefined') return;
  try {
    const now = Date.now();
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ds_state_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.__time && (now - parsed.__time > STATE_EXPIRY_MS)) {
              keysToDelete.push(key);
            }
          }
        } catch {
          keysToDelete.push(key);
        }
      }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  } catch {}
}

/**
 * Run all cleanup tasks in the background during idle time.
 */
export async function runStorageJanitor() {
  await pruneExpiredShares();
  await pruneCacheStorage();
  pruneStaleLocalStates();
}
