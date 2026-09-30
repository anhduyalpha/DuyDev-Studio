/**
 * PWA Service Worker Registration & Lifecyle Manager
 */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[PWA] Controller changed -> Auto refreshing page for instant update...');
      window.location.reload();
    });

    const doRegister = () => {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
          reg.update().catch(() => {});
          
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (!installingWorker) return;
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'activated' ||
                (installingWorker.state === 'installed' && navigator.serviceWorker.controller)
              ) {
                if (!refreshing) {
                  refreshing = true;
                  console.log('[PWA] New version activated, refreshing...');
                  window.location.reload();
                }
              }
            });
          };
        })
        .catch((error) => {
          console.warn('[PWA] ServiceWorker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }
  }
}
