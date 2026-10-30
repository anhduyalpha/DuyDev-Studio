# KI-FIX-043: PWA Update Modal Loop Fix & Multi-Tier Version Defense

## Metadata
- **ID**: `KI-FIX-043`
- **Component**: `src/utilities/pwa.js`, `sw.js`, `index.html`, `src/utilities/releaseNotes.js`
- **Severity**: High (Infinite Update Prompt Loop)
- **Status**: Verified

## Problem Description
Users reported a persistent bug where clicking the "Làm mới" (Update) button in the PWA Update Notification Center did not upgrade to the new version and instead displayed the update prompt repeatedly in an endless loop upon reload.

## Root Cause
1. **Tri-Point Version Synchronization Drift**:
   During the previous release, `sw.js` was bumped to `duydev-studio-v24.25` and `index.html` was set to `src/app.js?v=24.25`. However, `CURRENT_PWA_VERSION` in `src/utilities/pwa.js` remained hardcoded at `'duydev-studio-v24.24'`, and `ASSETS_TO_PRECACHE` in `sw.js` and CSS tags in `index.html` were still targeting `v24.24`.
2. **Infinite Client-Server Version Comparison**:
   On every launch or reload, `fastCheckAppUpdate()` compared `serverVersion !== CURRENT_PWA_VERSION` (`'duydev-studio-v24.25' !== 'duydev-studio-v24.24'`). Since the running app bundle always evaluated to `v24.24` while the server returned `v24.25`, the condition was permanently `true`. Even after the user clicked "Làm mới" and the page reloaded, the same mismatch re-triggered the modal immediately.
3. **Absence of Session Update Guard**:
   `handleExecuteUpdate()` did not mark `ds_update_capsule_dismissed` in `sessionStorage` or inspect if the browser had just completed an update reload within the last 15 seconds, allowing immediate re-prompting before new caches could settle.

## Solution & Architecture
1. **Full Tri-Point Alignment to v24.26**:
   - `sw.js`: `CACHE_NAME = 'duydev-studio-v24.26'` and all core assets precache queries set to `?v=24.26`.
   - `index.html`: All CSS tags and `app.js` bundle preload/script tags bumped to `?v=24.26` to force HTTP cache bust across Chromium disk caches.
   - `src/utilities/pwa.js`: `CURRENT_PWA_VERSION = 'duydev-studio-v24.26'`.
   - `src/utilities/releaseNotes.js`: Added `v24.26` highlights and updated `LATEST_RELEASE`.
2. **Multi-Tier Defense-in-Depth in `pwa.js`**:
   - In `fastCheckAppUpdate()`: Skip immediate prompts if the session reloaded from an update within 15 seconds (`ds_sw_just_reloaded`) or if the modal was already dismissed in the current session (`ds_update_capsule_dismissed`).
   - Check `cacheStorage.has(serverVersion)`: If the target cache bucket already exists locally and matches, suppress duplicate notifications.
   - In `handleExecuteUpdate()`: Flag `sessionStorage.setItem('ds_update_capsule_dismissed', 'true')` and `ds_updating_to_version` to prevent re-prompting during the active transition.

## Verification
- `rtk vitest run server/tests/unit/pwa_lifecycle.test.ts server/tests/unit/battery_optimization.test.ts` -> 15 test suites passed (76 tests, 0 failures).
- `rtk npm --prefix server run build` -> Exit 0.
