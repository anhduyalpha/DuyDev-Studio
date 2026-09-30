/**
 * DuyDev Studio - Service Worker (v5.3 - Network-First Resilient Architecture)
 * Provides offline caching, app installability, and instant updates on LAN
 */

const CACHE_NAME = 'duydev-studio-v12.0';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/stitch-tokens.css?v=12.0',
  './src/styles/studocu.css?v=12.0',
  './src/styles/highlight-theme.css?v=12.0',
  './src/vendor/highlight.min.js',
  './src/vendor/thinking-orbs.js',
  './src/vendor/qr-code-styling.js',
  './src/vendor/jszip.min.js',
  './src/vendor/docx-preview.min.js',
  './src/vendor/xlsx.full.min.js',
  './src/app.js?v=11.9',
  './src/assets/logo-ds.svg',
  './src/assets/icon-192.svg',
  './src/assets/icon-512.svg'
];



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

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

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
