/**
 * DuyDev Studio - Service Worker (v6.0 - Web Share Target + Network-First)
 * Provides offline caching, app installability, instant updates, and Share Target API
 */

const CACHE_NAME = 'duydev-studio-v14.2';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/stitch-tokens.css?v=14.2',
  './src/styles/studocu.css?v=14.2',
  './src/styles/highlight-theme.css?v=14.2',
  './src/vendor/highlight.min.js',
  './src/vendor/thinking-orbs.js',
  './src/vendor/qr-code-styling.js',
  './src/vendor/jszip.min.js',
  './src/vendor/docx-preview.min.js',
  './src/vendor/xlsx.full.min.js',
  './src/app.js?v=14.2',
  './src/utilities/shareTargetHelper.js',
  './src/components/common/ShareTargetModal.js',
  './src/pages/TermsPage.js',
  './src/assets/logo-ds.svg',
  './src/assets/icon-192.png',
  './src/assets/icon-512.png',
  './src/assets/icon-192.svg',
  './src/assets/icon-512.svg'
];

// ─── IndexedDB helpers for Share Target ───

/**
 * Open ds_share_db, create object store 'shares' if needed.
 * @returns {Promise<IDBDatabase>}
 */
function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ds_share_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shares', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save share payload to IndexedDB.
 * @param {{ title?: string, text?: string, url?: string, files?: File[] }} payload
 * @returns {Promise<void>}
 */
async function saveSharePayload(payload) {
  const db = await openShareDb();
  const tx = db.transaction('shares', 'readwrite');
  tx.objectStore('shares').add({ ...payload, timestamp: Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Handle POST /share-target from OS Share Sheet.
 * Parse formData, save to IndexedDB, notify clients, redirect.
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleShareTargetPost(event) {
  try {
    const formData = await event.request.formData();
    const payload = {
      title: formData.get('title') || '',
      text: formData.get('text') || '',
      url: formData.get('url') || '',
      files: formData.getAll('shared_files').filter(f => f instanceof File && f.size > 0),
    };

    // Some Android apps send URL in text field instead of url field
    if (!payload.url && payload.text) {
      const urlMatch = payload.text.match(/https?:\/\/\S+/);
      if (urlMatch) payload.url = urlMatch[0];
    }

    await saveSharePayload(payload);

    // Wake up existing client tab if open
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
    for (const client of allClients) {
      client.postMessage({ type: 'DS_SHARE_TARGET_ARRIVED' });
    }

    // 303 See Other: POST → GET redirect (must be absolute URL for Response.redirect)
    const redirectUrl = new URL('./#share-target', self.registration ? self.registration.scope : self.location.href).href;
    return Response.redirect(redirectUrl, 303);
  } catch (err) {
    console.error('[SW] Share target error:', err);
    const redirectUrl = new URL('./#share-target', self.registration ? self.registration.scope : self.location.href).href;
    return Response.redirect(redirectUrl, 303);
  }
}

// ─── Lifecycle Events ───

// Install Event: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core shell');
      return cache.addAll(ASSETS_TO_PRECACHE).catch((err) => {
        console.warn('[SW] Core precache partial warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch Event ───

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 0. Share Target POST handler (must be BEFORE GET-only guard)
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTargetPost(event));
    return;
  }

  // Non-GET requests: pass through to network
  if (event.request.method !== 'GET') return;

  // 1. Never intercept or cache API endpoints
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Same-origin assets: Network-First with Cache Fallback for offline PWA
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html') || caches.match('./');
            }
            return new Response('', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }

  // 3. External CDNs (Tailwind, Lucide, Google Fonts): Cache-First with Network Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.warn('[SW] External asset fetch failed:', event.request.url, err);
          return new Response('', { status: 408, statusText: 'CDN Timeout' });
        });
    })
  );
});
