/**
 * DuyDev Studio - Service Worker (v6.2 - Bulletproof Share Target & App Shell)
 * Provides offline caching, app installability, instant updates, and Level 2 Share Target API
 */

const CACHE_NAME = 'duydev-studio-v22.7';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/stitch-tokens.css?v=22.7',
  './src/styles/studocu.css?v=22.7',
  './src/styles/highlight-theme.css?v=22.7',
  './src/vendor/highlight.min.js',
  './src/vendor/thinking-orbs.js',
  './src/vendor/qr-code-styling.js',
  './src/vendor/jszip.min.js',
  './src/vendor/docx-preview.min.js',
  './src/vendor/xlsx.full.min.js',
  './src/app.js?v=22.7',
  './src/hooks/useToolRegistry.js',
  './src/pages/DashboardPage.js',
  './src/utilities/shareTargetHelper.js',
  './src/utilities/storageJanitor.js',
  './src/components/common/ShareTargetModal.js',
  './src/pages/TermsPage.js',
  './src/assets/logo-ds.svg',
  './src/assets/icon-192.png',
  './src/assets/icon-512.png',
  './src/assets/icon-maskable-192.png',
  './src/assets/icon-maskable-512.png',
  './src/assets/shortcut-pdf.png',
  './src/assets/shortcut-archive.png',
  './src/assets/shortcut-qr.png',
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
  try {
    const db = await openShareDb();
    const tx = db.transaction('shares', 'readwrite');
    tx.objectStore('shares').add({ ...payload, timestamp: Date.now() });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    // Broadcast instant wake-up notification to listening window clients
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ds_share_channel');
        bc.postMessage({ type: 'PAYLOAD_READY', timestamp: Date.now() });
        setTimeout(() => {
          try { bc.close(); } catch {}
        }, 200);
      }
    } catch {}
  } catch (err) {
    console.warn('[SW] IndexedDB write failed:', err);
  }
}

/**
 * Prune orphaned temporary payloads in ds_share_db older than 30 minutes.
 */
async function pruneOrphanedShares() {
  try {
    if (typeof indexedDB === 'undefined') return;
    const db = await openShareDb();
    const tx = db.transaction('shares', 'readwrite');
    const store = tx.objectStore('shares');
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const time = cursor.value?.timestamp || 0;
        if (!time || now - time > maxAge) {
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
  } catch {}
}

/**
 * Helper to build client redirect URL preserving parameters across webview barriers
 */
function buildShareRedirectUrl(params) {
  const base = self.registration ? self.registration.scope : self.location.href;
  const redirectUrl = new URL('./', base);
  if (params.url) redirectUrl.searchParams.set('url', params.url);
  if (params.text) redirectUrl.searchParams.set('text', params.text);
  if (params.title) redirectUrl.searchParams.set('title', params.title);
  if (params.hasFiles) redirectUrl.searchParams.set('hasFiles', '1');
  redirectUrl.searchParams.set('t', Date.now().toString());
  redirectUrl.hash = '#share-target';
  return redirectUrl.href;
}

/**
 * Handle POST /share-target from OS Share Sheet.
 * Parse formData, save to IndexedDB, notify clients, redirect with query params & hash.
 * @param {FetchEvent} event
 * @returns {Promise<Response>}
 */
async function handleShareTargetPost(event) {
  let payload = { title: '', text: '', url: '', files: [] };
  try {
    const formData = await event.request.formData();
    
    // Inspect all entries to capture files regardless of field name variations
    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && typeof value.size === 'number' && value.size > 0) {
        payload.files.push(value);
      } else if (!payload.url && key === 'url') {
        payload.url = String(value || '').trim();
      } else if (!payload.text && key === 'text') {
        payload.text = String(value || '').trim();
      } else if (!payload.title && key === 'title') {
        payload.title = String(value || '').trim();
      }
    }

    // Some Android apps send URL in text field instead of url field
    if (!payload.url && payload.text) {
      const urlMatch = payload.text.match(/https?:\/\/\S+/);
      if (urlMatch) payload.url = urlMatch[0];
    }

    await saveSharePayload(payload);

    // Wake up existing client tab if open (including uncontrolled clients during startup)
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (allClients.length > 0) {
      const existingClient = allClients[0];
      if (typeof existingClient.focus === 'function') {
        existingClient.focus().catch(() => {});
      }
      for (const client of allClients) {
        client.postMessage({ type: 'DS_SHARE_TARGET_PAYLOAD', payload });
        client.postMessage({ type: 'DS_SHARE_TARGET_ARRIVED', payloadSummary: { hasFiles: payload.files.length > 0, url: payload.url } });
      }
    }

    const redirectUrl = buildShareRedirectUrl({
      url: payload.url,
      text: payload.text,
      title: payload.title,
      hasFiles: payload.files.length > 0
    });
    return Response.redirect(redirectUrl, 303);
  } catch (err) {
    console.error('[SW] Share target POST error:', err);
    const redirectUrl = buildShareRedirectUrl({
      url: payload.url,
      text: payload.text,
      title: payload.title,
      hasFiles: payload.files.length > 0
    });
    return Response.redirect(redirectUrl, 303);
  }
}

/**
 * Handle GET /share-target fallback from browser or third party app
 * @param {FetchEvent} event
 * @param {URL} url
 * @returns {Response}
 */
function handleShareTargetGet(url) {
  const urlParam = url.searchParams.get('url') || '';
  const textParam = url.searchParams.get('text') || '';
  const titleParam = url.searchParams.get('title') || '';

  const redirectUrl = buildShareRedirectUrl({
    url: urlParam,
    text: textParam,
    title: titleParam,
    hasFiles: false
  });
  return Response.redirect(redirectUrl, 303);
}

// ─── Message Handler ───

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({
      type: 'VERSION_INFO',
      version: CACHE_NAME
    });
  } else if (event.data?.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received from client. Activating now...');
    self.skipWaiting();
  }
});

// ─── Lifecycle Events ───

// Install Event: Pre-cache core shell and activate immediately on deploy
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching core shell:', CACHE_NAME);
      try {
        await cache.addAll(ASSETS_TO_PRECACHE);
      } catch (err) {
        console.warn('[SW] Core precache bulk warning, falling back to individual caching:', err);
        for (const asset of ASSETS_TO_PRECACHE) {
          try {
            await cache.add(asset);
          } catch (e) {
            console.warn('[SW] Failed to cache single asset:', asset, e);
          }
        }
      }
    })
  );
});

// Activate Event: Clean ALL old caches immediately & prune orphaned shares
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          }
        })
      );
      await pruneOrphanedShares();
      await self.clients.claim();
    })()
  );
});

// ─── Fetch Event ───

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isShareTarget = url.pathname.replace(/\/$/, '').endsWith('/share-target');

  // 0. Share Target Handlers (intercepted BEFORE any caching or network guards)
  if (isShareTarget) {
    if (event.request.method === 'POST') {
      event.respondWith(handleShareTargetPost(event));
      return;
    }
    if (event.request.method === 'GET') {
      event.respondWith(handleShareTargetGet(url));
      return;
    }
  }

  // Non-GET requests: pass through to network
  if (event.request.method !== 'GET') return;

  // 1. Never intercept or cache API endpoints
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. App Shell Navigation: Network-First with Cache Fallback for offline PWA
  // Always fetches the fresh index.html from server when online to prevent stale UI and eliminate double loading.
  // Falls back to Cache Storage if network is offline or unreachable.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fetchPromise = fetch(event.request, { cache: 'no-cache' });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Navigation network timeout')), 3000)
          );
          const networkResponse = await Promise.race([fetchPromise, timeoutPromise]);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone()).catch(() => {});
            return networkResponse;
          }
        } catch (err) {
          // Network failed or device is offline - fall back to Cache Storage below
        }

        try {
          const cache = await caches.open(CACHE_NAME);
          const cached = (await cache.match(event.request, { ignoreSearch: true })) ||
                         (await cache.match('./index.html')) ||
                         (await cache.match('./'));
          if (cached) {
            return cached;
          }
        } catch (err) {
          console.warn('[SW] Navigation cache fallback warning:', err);
        }

        return (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               new Response('', { status: 503, statusText: 'Offline' });
      })()
    );
    return;
  }

  // 3. Same-origin assets: Network-First with Cache Fallback for offline PWA
  if (url.origin === self.location.origin) {
    const isScriptOrStyle =
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      /\.(js|mjs|css)$/i.test(url.pathname);

    const networkFetch = isScriptOrStyle
      ? fetch(event.request, { cache: 'no-cache' })
      : fetch(event.request);

    event.respondWith(
      networkFetch
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            const contentLength = networkResponse.headers.get('content-length');
            const isOversized = contentLength && parseInt(contentLength, 10) > 4 * 1024 * 1024;
            const isMediaOrBinary = contentType.includes('video/') || contentType.includes('audio/') || contentType.includes('application/octet-stream') || contentType.includes('application/zip');
            const hasShareQuery = url.search.includes('hasFiles=1') || url.search.includes('&t=') || url.search.includes('?t=');

            // Only cache lightweight static code, styles, fonts, and assets (<4MB, no heavy media or transient query tokens)
            if (!isOversized && !isMediaOrBinary && !hasShareQuery) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
            }
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
