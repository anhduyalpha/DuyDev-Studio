/**
 * DuyDev Studio - Service Worker (v6.2 - Bulletproof Share Target & App Shell)
 * Provides offline caching, app installability, instant updates, and Level 2 Share Target API
 */

const CACHE_NAME = 'duydev-studio-v25.2';

const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/tailwind.generated.css?v=25.2',
  './src/styles/stitch-tokens.css?v=25.2',
  './src/styles/card-tiers-10.css?v=25.2',
  './src/styles/studocu.css?v=25.2',
  './src/styles/scribd.css?v=25.2',
  './src/styles/highlight-theme.css?v=25.2',
  './src/vendor/highlight.min.js',
  './src/vendor/thinking-orbs.js',
  './src/vendor/qr-code-styling.js',
  './src/vendor/jszip.min.js',
  './src/vendor/docx-preview.min.js',
  './src/vendor/xlsx.full.min.js',
  './src/vendor/lucide.min.js',
  './src/vendor/ds_rust_core.wasm',
  './src/app.js?v=25.2',
  './src/app.js',
  './src/hooks/useTheme.js',
  './src/hooks/useToolRegistry.js',
  './src/pages/DashboardPage.js',
  './src/pages/ToolPage.js',
  './src/pages/ArchivePage.js',
  './src/pages/StoragePage.js',
  './src/pages/HistoryPage.js',
  './src/pages/AdminPage.js',
  './src/pages/ServerPage.js',
  './src/pages/TermsPage.js',
  './src/components/layout/Header.js',
  './src/components/layout/BottomNav.js',
  './src/components/layout/Footer.js',
  './src/components/layout/GlobalTaskDock.js',
  './src/components/common/SlideConfirmModal.js',
  './src/components/common/ProfileModal.js',
  './src/components/common/ToolIcons.js',
  './src/components/common/viewer/FileViewerConnector.js',
  './src/components/common/viewer/FileViewerCore.js',
  './src/components/dashboard/CategoryFilters.js',
  './src/components/dashboard/RecentActivity.js',
  './src/components/dashboard/TierFrameAssets.js',
  './src/components/dashboard/ToolCard.js',
  './src/components/dashboard/dashboardSwipeController.js',
  './src/components/tools/qr/QrStudio.js',
  './src/components/tools/hash/HashStudio.js',
  './src/components/tools/MarkdownEditor.js',
  './src/components/tools/archive/ArchiveCompressWorkspace.js',
  './src/components/tools/converter/ConverterWorkspace.js',
  './src/components/tools/converter/hooks/useConverter.js',
  './src/components/tools/studocu/StudocuWorkspace.js',
  './src/components/tools/scribd/ScribdWorkspace.js',
  './src/components/tools/quiz/QuizWorkspace.js',
  './src/components/tools/viewsplit/ViewSplitWorkspace.js',
  './src/components/tools/tiktok/TiktokWorkspace.js',
  './src/components/tools/youtube/YoutubeWorkspace.js',
  './src/components/tools/facebook/FacebookWorkspace.js',
  './src/components/tools/instagram/InstagramWorkspace.js',
  './src/components/tools/spotify/SpotifyWorkspace.js',
  './src/components/tools/slideshare/SlideshareWorkspace.js',
  './src/components/tools/academia/AcademiaWorkspace.js',
  './src/components/tools/researchgate/ResearchgateWorkspace.js',
  './src/components/tools/pdf/PdfWorkspace.js',
  './src/components/tools/pdf/hooks/usePdfQueue.js',
  './src/utilities/rustCore.js',
  './src/utilities/adminAuth.js',
  './src/utilities/clipboard.js',
  './src/utilities/deviceId.js',
  './src/utilities/formatters.js',
  './src/utilities/moduleState.js',
  './src/utilities/notificationHelper.js',
  './src/utilities/securityShield.js',
  './src/utilities/shareTargetHelper.js',
  './src/utilities/smartUrlRouter.js',
  './src/utilities/soundEngine.js',
  './src/utilities/storage.js',
  './src/utilities/taskCoordinator.js',
  './src/utilities/toast.js',
  './src/utilities/userProfile.js',
  './src/utilities/releaseNotes.js?v=24.44',
  './src/utilities/tierViewportGovernor.js',
  './src/components/common/SoundVolumeModal.js?v=24.66',
  './src/components/common/MigrationNoticeModal.js',
  './src/utilities/storageJanitor.js',
  './src/utilities/visitorTracker.js',
  './src/components/common/ShareTargetModal.js',
  './src/assets/logo-ds.svg?v=22.12',
  './src/assets/logo-ds.svg?v=22.52',
  './src/assets/icon-192.png?v=22.12',
  './src/assets/icon-512.png?v=22.12',
  './src/assets/icon-maskable-192.png?v=22.12',
  './src/assets/icon-maskable-512.png?v=22.12',
  './src/assets/shortcut-pdf.png',
  './src/assets/shortcut-archive.png',
  './src/assets/shortcut-qr.png',
  './src/assets/icon-192.svg?v=22.12',
  './src/assets/icon-512.svg?v=22.12',
  './src/assets/icon-maskable.svg?v=22.12'
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

    // If a link is shared, filter out browser link preview thumbnails from files array
    if (payload.url && payload.files.length === 1) {
      const f = payload.files[0];
      const isThumb = f.size < 512 * 1024 && (/^\d{10,}\.(png|jpe?g|webp)$/i.test(f.name) || /^(thumb|favicon|preview|cover|image)/i.test(f.name) || (f.type && f.type.startsWith('image/')));
      if (isThumb) {
        payload.files = [];
      }
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
  } else if (event.data?.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING' || event.data?.type === 'PURGE_AND_UPDATE') {
    console.log('[SW] SKIP_WAITING / PURGE_AND_UPDATE received from client. Activating now...');
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

  // 1. Pass through API, media streaming, download, viewer endpoints, blob protocols, and byte-range requests directly to network
  if (
    url.protocol === 'blob:' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/downloads/') ||
    url.pathname.includes('/download') ||
    url.pathname.includes('/viewer') ||
    url.pathname.includes('/stream') ||
    url.searchParams.has('inline') ||
    event.request.headers.has('range')
  ) {
    return;
  }

  // 2. App Shell Navigation: Stale-While-Revalidate (<2ms Cache-First + silent background refresh)
  // Serves precached index.html instantly to eliminate network RTT wait while keeping shell fresh.
  if (event.request.mode === 'navigate') {
    const revalidatePromise = fetch(event.request, { cache: 'no-cache' })
      .then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', networkResponse.clone()).catch(() => {});
          await cache.put(event.request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => null);

    event.waitUntil(revalidatePromise);

    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cached = (await cache.match(event.request, { ignoreSearch: true })) ||
                         (await cache.match('./index.html')) ||
                         (await cache.match('./'));
          if (cached) {
            return cached;
          }
        } catch (err) {
          console.warn('[SW] Navigation cache lookup warning:', err);
        }

        const fresh = await revalidatePromise;
        if (fresh && fresh.status === 200) {
          return fresh;
        }

        return (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               new Response('', { status: 503, statusText: 'Offline' });
      })()
    );
    return;
  }

  // 3. Same-origin assets: Cache-First for immutable (?v=, vendor, assets), SWR (<2ms) for JS/CSS
  if (url.origin === self.location.origin) {
    const isImmutableAsset =
      url.pathname.startsWith('/src/vendor/') ||
      url.pathname.startsWith('/src/assets/') ||
      url.searchParams.has('v');

    if (isImmutableAsset) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
              if (response && response.status === 200 && response.type === 'basic') {
                cache.put(event.request, response.clone()).catch(() => {});
              }
              return response;
            });
          })
        )
      );
      return;
    }

    const isScriptOrStyle =
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      /\.(js|mjs|css)$/i.test(url.pathname);

    if (isScriptOrStyle) {
      const revalidateAsset = fetch(event.request, { cache: 'no-cache' })
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => null);

      event.waitUntil(revalidateAsset);

      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          const fresh = await revalidateAsset;
          return fresh || new Response('', { status: 503, statusText: 'Offline' });
        })
      );
      return;
    }

    const networkFetch = fetch(event.request);

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

// 4. System Push Notification Click: Bring app window into focus or navigate to task route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            if (targetUrl && targetUrl !== './' && client.navigate) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
