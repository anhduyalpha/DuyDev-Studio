# DuyDev Studio — Comprehensive Overhaul Implementation Plan

**Goal:** Deliver a combined 4-track overhaul across DuyDev Studio: (1) freeze-free Android APK lifecycle, atomic Share queue, and sub-1s uncached web boot with 0% background battery drain; (2) fast cookieless Instagram & Facebook media extraction (including `/share/*` redirects and split Facebook DASH); (3) zero-idle-CPU web performance across Dashboard, ViewSplit, Admin, Markdown, PDF, and Hash while keeping visible 10-Tier RPG card effects 100% intact; and (4) Option C mobile layouts, `>=44px` touch ergonomics, clean copy, universal auth-gated `"Lưu vào Drive"`, direct Academia/ResearchGate downloads, Hash MD5 streaming, universal QR styling, Markdown `.docx`/`.pdf`/Drive open/sync-scroll, Drive empty states, and `Ctrl+V` / cross-tool handoffs.

**Architecture:** Modular 4-phase execution inside a zero-build Vanilla ES Module PWA served by Fastify v4 + TypeScript (Prisma SQLite WAL, BullMQ/Redis, Python 3 / FFmpeg / LibreOffice engines) and wrapped by an Android Kotlin WebView shell (`vn.alphadaniel.duydevstudio`). Tailwind CSS moves from runtime CDN compilation to an ahead-of-time static stylesheet committed to Git (`npm run build:css`), while `scripts/deploy-prod.sh` stays untouched.

**Tech Stack:** Kotlin (Android WebView, OkHttp), Vanilla ES Modules (zero-build JS), Tailwind CSS CLI v3, Lucide Icons, `QRCodeStyling`, Web Crypto API + pure-JS incremental MD5/SHA streaming, Fastify v4 (`@fastify/compress`), TypeScript v5 + Zod, Vitest v1.4, Python 3 (`python-docx`), FFmpeg, Headless Chromium / LibreOffice, Playwright.

**Spec:** [docs/superpowers/specs/2026-11-14-studio-overhaul-design.md](../specs/2026-11-14-studio-overhaul-design.md)

---

## Global Constraints

1. **Quarantine Boundary (`AGENTS.md`):** NEVER edit any file under `src/components/tools/studocu/**` or `server/src/services/studocu/**`. Preserve existing `ToolPage.js` and `ShareTargetModal.js` routes pointing to Studocu unchanged.
2. **Zero-Build ES Modules:** Keep frontend JS unbundled ES modules; only compile CSS via root `npm run build:css` and commit `src/styles/tailwind.generated.css` + regenerated `index.html`.
3. **Zero Background Battery Drain:** Keep Android `executeDeepFreeze()` (`onPause` 5s grace + `onStop`) and zero background keep-alive timers/services. Preserve every string and header assertion in `server/tests/unit/battery_optimization.test.ts` (including `/src/utilities/pwa.js` `no-cache, must-revalidate` 304 ETag, `CURRENT_PWA_VERSION` synced with `sw.js`, `html.app-backgrounded`, `AdminPage.js` pause guard, `Header.js` telemetry polling, and `MainActivity.kt` freeze constants).
4. **No Cookie Paste UI:** Instagram & Facebook downloaders stay 100% automatic without user cookie forms.
5. **100% Visible 10-Tier Card Parity:** Visible cards keep all gradients, borders, glows, particles, and continuous infinite animations in Light & Dark modes; offscreen and background pause use `.tier-offscreen` and `html.app-backgrounded` / `.ds-animations-paused`.
6. **Storage Auth & SSRF Boundary:** All `"Lưu vào Drive"` (`POST /api/v1/storage/save-artifact`) and Markdown `"Mở từ Drive"` actions enforce `storageAuthGuard` / Admin PIN unlock. `GET /api/v1/storage/download` stays PIN-gated for `/pdf`, `/converted`, `/archives`, `/images`, `/documents` (only `/slideshare/`, `/academia/`, `/researchgate/` whitelist stays unauthenticated). Enforce `validateSafeMediaUrl` before every external fetch and redirect hop.

---

## Scope & Execution Layout

This plan consolidates all 4 approved tracks in one master document (per user direction) grouped into 4 loosely coupled phases. Each Task produces an independently testable commit and defines explicit `Consumes` / `Produces` interfaces. Phase 2 and Phase 3 can execute in parallel with each other once Phase 1 Tasks 1.1–1.3 are stable.

---

## Review Focus (High-Risk Failure Modes & Pinned Tests)

| ID | Risk / Failure Mode | Guard & Contract | Pinned Task & Test |
|---|---|---|---|
| **RF-1** | Android APK wakes from frozen state with dead WebView renderer or back-to-back `#share-target` hash is ignored, or early poller clears `AndroidBridge.sharedPayloadJson` before modal mounts | One-shot `350ms` `__dsAlivePing` probe + dead-renderer reload; atomic `peekPendingSharedPayload` / `consumePendingSharedPayload(id)`; explicit `'ds:native-share-arrived'` event when hash unchanged | Tasks 1.1 & 1.2 · `server/tests/unit/share_target_queue.test.ts` & `./android/gradlew.bat assembleDebug` |
| **RF-2** | Static Tailwind CSS build drops dynamic/template utility classes (`xs:`, `dark:`, `spacing.7.5`, `brand-*`, `animate-fadeIn`) or `index.html` / `sw.js` / `pwa.js` bump breaks `battery_optimization.test.ts` | `tailwind.config.js` mirrors inline CDN config 1:1 scanning `index.html` + `src/**/*.js`; `safelist` covers dynamic badge classes; keep `pwa.js` unversioned `304` + exact `vXX.Y` alignment | Task 1.3 · `server/tests/unit/battery_optimization.test.ts` & Playwright Light/Dark check |
| **RF-3** | Facebook DASH `dashToken` allows SSRF or leaks arbitrary upstream URLs; redirect hop bypasses IP check; Academia/ResearchGate streams HTML error pages as `.pdf` | Per-hop `validateSafeMediaUrl` (`<=5` hops); server-side opaque `dashToken` `Map` (`15m` TTL); reject upstream `text/html` in Academia/RG `proxyStream`; never cache errors | Tasks 2.1, 2.3 & 4.3 · `media_url_cache.test.ts`, `facebook_service.test.ts`, `academic_stream_guard.test.ts` |
| **RF-4** | Async `renderToolPage` double-navigation race mounts wrong tool listeners; ViewSplit idle loop keeps ticking rAF; Hash loads 1GB file into RAM | Monotonic `navigationSeq` guard in `src/app.js`; dirty-flag `requestRender()` idle stop in ViewSplit; 4MB `file.slice()` chunk loop for Hash MD5/SHA-1/256/512 | Tasks 1.4, 3.2 & 3.4 · `tool_lazy_loader.test.ts`, `viewsplit_dirty_render.test.ts`, `hash_streaming.test.ts` |
| **RF-5** | Unauthenticated `save-artifact` bypass or path traversal into `/slideshare`; ViewSplit Loupe/Storage toolbar overflows `360px` or collides with `BottomNav` | Route inside `storage.route.ts` under `storageAuthGuard`; `allowedFolders` allowlist + `sanitizeSafePath`; Option C layout + `hidden xs:inline` wordmark `<420px` + `min-h-[44px]` | Tasks 4.1 & 4.5 · `storage_save_artifact.test.ts` & Playwright `360x740` layout/touch audit |

---

## Phase 1: Android APK Lifecycle, Atomic Share Queue & Sub-1s Web Boot

### Task 1.1 — Android `MainActivity.kt` & `AndroidBridge.kt` Zero-Freeze Watchdog, One-Shot Wakeup Probe & Safe Intent Routing

**Files:**
- Modify: `android/app/src/main/java/vn/alphadaniel/duydevstudio/AndroidBridge.kt`
- Modify: `android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt`
- Test: `android/app/src/test/java/vn/alphadaniel/duydevstudio/IntentRoutingTest.kt` (Create)

**Interfaces:**
- *Produces (to Web JS):* `@JavascriptInterface fun notifyAppReady()`, `'ds:native-share-arrived'` event dispatch on `#share-target` re-entry, `'academia'` / `'researchgate'` deep-link `?url=` handoffs.
- *Consumes (from Web JS):* `window.__dsAlivePing()` returning `'ok'` string (via `evaluateJavascript`).

- [ ] **Step 1: Inspect test source set & write failing Kotlin unit test**
  Verify `android/app/build.gradle.kts` `testImplementation` (`junit:junit` — add if missing) and extract pure helper `IntentUrlRouter.resolveToolRoute(text: String): String?` (called by `MainActivity.handleIntent`). Write failing `IntentRoutingTest.kt` asserting:
  - `academia.edu/12345/Paper` -> `#tool/academia?url=...`
  - `researchgate.net/publication/999` -> `#tool/researchgate?url=...`
  - Existing `scribd`, `tiktok`, `facebook`, `instagram`, `youtube`, `spotify`, `slideshare` mappings remain unchanged.
  - Note: keep exact strings `postDelayed(deepFreezeRunnable, 5000L)`, `taskSafetyTimeoutRunnable, 75000L`, and `executeDeepFreeze()` intact inside `MainActivity.kt` (`battery_optimization.test.ts` contract).
- [ ] **Step 2: Run Gradle test to verify failure**
  Run: `.\android\gradlew.bat -p android testDebugUnitTest --tests "*.IntentRoutingTest"` -> expected FAIL (`Unresolved reference: IntentUrlRouter`).
- [ ] **Step 3: Implement `AndroidBridge.notifyAppReady()`, native 7s watchdog, `350ms` `__dsAlivePing` wakeup, `restoreState` null guard & `IntentUrlRouter`**
  - In `AndroidBridge.kt`: add `@JavascriptInterface fun notifyAppReady()` invoking callback `onAppReady` on `MainActivity` main thread. Keep `getSharedPayload()`, `clearSharedPayload()`, `reportActiveTasks(count)` contracts unchanged.
  - In `MainActivity.kt`:
    - Move `hideSplashOverlay()` out of `onPageCommitVisible()` and invoke it inside `onAppReady` (guarded by `isFinishing` check); retain a `7000ms` splash watchdog `Handler` that surfaces a retry panel (`Button` calling `webView.reload()` + restarting `7000ms` watchdog) inside `splashOverlay` if `notifyAppReady()` never fires or `onReceivedError` triggers on main frame.
    - Check `if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null && !webView.url.isNullOrBlank())` before skipping `loadUrl(targetUrl)`.
    - In `ensureWebViewActive()` (called by `onResume()` after frozen state or `onNewIntent()`): keep `executeDeepFreeze()` in `onPause` (5s) / `onStop`; issue one-shot `webView.evaluateJavascript("window.__dsAlivePing && window.__dsAlivePing()")` with a `350ms` timeout runnable — if `'ok'` arrives, deliver pending intent/event immediately; if it times out, returns null/`undefined`, or `isRendererDead` was flagged by `onRenderProcessGone`, show `splashOverlay` cleanly, reload host URL (preserving pending `AndroidBridge.sharedPayloadJson`), and flush pending Share intent on `notifyAppReady()`.
    - In `onNewIntent`: if `isAppLoaded` and `webView.url?.endsWith("#share-target") == true` (or target hash matches active `#share-target`), call `evaluateJavascript("window.dispatchEvent(new CustomEvent('ds:native-share-arrived'))")` instead of relying on hash assignment.
    - Route `academia.edu` -> `academia` and `researchgate.net` -> `researchgate` through `IntentUrlRouter` in `handleIntent()`.
- [ ] **Step 4: Run Gradle tests, debug APK compile & existing battery suite**
  Run:
  `.\android\gradlew.bat -p android testDebugUnitTest assembleDebug` (expected Exit 0)
  `rtk vitest run --root server tests/unit/battery_optimization.test.ts` (confirm `MainActivity.kt` freeze/safety assertions still PASS).
- [ ] **Step 5: Commit**
  `git add android/` -> `rtk git commit -m "fix(android): add notifyAppReady watchdog, 350ms wakeup ping, and academia/researchgate intent routing"`

---

### Task 1.2 — Frontend Boot Hydration, Non-Blocking Onboarding & Atomic Single-Consume Share Queue

**Files:**
- Modify: `index.html` (watchdog condition line ~313–335)
- Modify: `src/app.js`
- Modify: `src/utilities/shareTargetHelper.js`
- Modify: `src/components/common/ShareTargetModal.js`
- Modify: `src/utilities/smartUrlRouter.js`
- Modify: `src/components/layout/Header.js` (profile indicator dot flag when onboarding incomplete)
- Test: `server/tests/unit/share_target_queue.test.ts` (Create)

**Interfaces:**
- *Consumes:* `window.AndroidBridge.getSharedPayload()`, `clearSharedPayload()`, `notifyAppReady()`.
- *Produces:* `window.__dsAlivePing = () => 'ok'`, `window.__DS_APP_HYDRATED = true`, `peekPendingSharedPayload()`, idempotent `consumePendingSharedPayload(payloadId)`.

- [ ] **Step 1: Write failing unit tests in `server/tests/unit/share_target_queue.test.ts`**
  Mock `window.AndroidBridge` and test:
  1. `peekPendingSharedPayload()` reads payload WITHOUT calling `clearSharedPayload()`, assigning deterministic `payloadId` when absent.
  2. Double call to `consumePendingSharedPayload(payloadId)` only invokes `clearSharedPayload()` once (idempotency under concurrent fast-path + `app.js` + `ds:native-share-arrived`).
  3. `detectSmartRoute` & `App` `#tool/` query dispatcher handle `academia.edu/...` -> `#tool/academia?url=...` and `researchgate.net/...` -> `#tool/researchgate?url=...` as well as back-to-back `ds:native-share-arrived` re-open.
  4. Opening Share flow does NOT trigger blocking `ProfileModal` (`checkAndPromptOnboardingProfile` skips modal auto-open and sets subtle dot state instead).
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/share_target_queue.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement atomic Share queue, boot watchdog hydration flag & non-blocking onboarding**
  - `src/utilities/shareTargetHelper.js`: export `peekPendingSharedPayload()` (reads bridge/SW IDB without clearing and normalizes `payloadId`) and `consumePendingSharedPayload(payloadId)` (tracks consumed IDs in an in-memory `Set` so duplicate calls are no-ops and `AndroidBridge.clearSharedPayload()` / IDB delete runs once). Update `pollPendingSharedData()` to peek only; remove `clearSharedPayload()` from polling.
  - `src/components/common/ShareTargetModal.js`: invoke `consumePendingSharedPayload(payload.payloadId)` only once `#shareTargetPanel` is mounted in DOM (preserving existing `case '#tool/studocu-dl'` untouched).
  - `src/utilities/smartUrlRouter.js`: verify `academia` (`#tool/academia`) & `researchgate` (`#tool/researchgate`) return consistent `route`/`toolId`.
  - `src/app.js`: register `window.__dsAlivePing = () => 'ok'`; after initial `renderCurrentView()` completes, set `window.__DS_APP_HYDRATED = true` and call `window.AndroidBridge?.notifyAppReady?.()`; re-check Share queue when `'ds:native-share-arrived'` fires (`!document.getElementById('shareTargetPanel')` or replaced payload); on `#tool/academia` & `#tool/researchgate` `?url=`, auto-fill & trigger resolve cleanly like TikTok/FB/IG; update `checkAndPromptOnboardingProfile` so `#share-target`, Share deep-links, and APK cold launch never auto-open `ProfileModal` (persist flag read by `Header.js` to show a tiny `w-2 h-2 rounded-full bg-indigo-500` indicator dot on the Profile button).
  - `index.html`: update the emergency boot watchdog timer check to `!window.__DS_APP_HYDRATED` (`7000ms`), and fix any early FastPath script to pass `payloadId` safely without premature `clearSharedPayload()`.
- [ ] **Step 4: Syntax & unit verification**
  Run:
  `rtk err node --check src/app.js src/utilities/shareTargetHelper.js src/components/common/ShareTargetModal.js src/utilities/smartUrlRouter.js`
  `rtk vitest run --root server tests/unit/share_target_queue.test.ts tests/unit/battery_optimization.test.ts`
- [ ] **Step 5: Commit**
  `git add index.html src/app.js src/utilities/shareTargetHelper.js src/components/common/ShareTargetModal.js src/utilities/smartUrlRouter.js src/components/layout/Header.js server/tests/unit/share_target_queue.test.ts` -> `rtk git commit -m "fix(boot,share): add atomic peek/consume Share queue, __DS_APP_HYDRATED watchdog, and non-blocking onboarding"`

---

### Task 1.3 — Static Pre-Built Tailwind CSS, `.gitignore`, Server `@fastify/compress` & Cache/Version Alignment

**Files:**
- Modify: `.gitignore`
- Create: `tailwind.config.js`, `src/styles/tailwind.input.css`, `src/styles/tailwind.generated.css`
- Modify: `package.json`, `scripts/generate-instant-shell.mjs`, `index.html`, `sw.js`, `src/utilities/pwa.js`
- Modify: `server/package.json`, `server/src/app.ts`
- Verify: `server/tests/unit/battery_optimization.test.ts`

**Interfaces:**
- *Produces:* Static minified `src/styles/tailwind.generated.css`, `"build:css"` npm script, Fastify Brotli/Gzip compression plugin, synchronized PWA cache version `duydev-studio-v25.0`.

- [ ] **Step 1: Add `.superpowers/` to `.gitignore` and extract Tailwind v3 config**
  - Append `.superpowers/` to `.gitignore`.
  - Inspect `index.html:196-244` inline `tailwind.config` and copy every setting 1:1 into root `tailwind.config.js` (`darkMode: 'class'`, `content: ['./index.html', './src/**/*.js']`, `screens.xs: '420px'`, `spacing: { '7.5': '1.875rem', '8.5': '2.125rem' }`, `colors.brand`, `keyframes`/`animation` `fadeIn` & `shimmer`, plus a tight `safelist` only if any runtime class names are string-concatenated in JS).
  - Create `src/styles/tailwind.input.css` with `@tailwind base; @tailwind components; @tailwind utilities;`.
- [ ] **Step 2: Install Tailwind CLI (`root`) and `@fastify/compress` (`server`), then run initial `build:css`**
  Run:
  `npm install -D tailwindcss@^3.4.17`
  `npm --prefix server install @fastify/compress@^7.0.3`
  Add `"build:css": "npx tailwindcss -c tailwind.config.js -i src/styles/tailwind.input.css -o src/styles/tailwind.generated.css --minify"` to root `package.json`, update `"build:shell"` / run `npm run build:css` -> verify `src/styles/tailwind.generated.css` builds cleanly with exit 0 and contains `.xs\:inline` / `.animate-fadeIn` / `.animate-shimmer`.
- [ ] **Step 3: Wire static CSS, remove Tailwind CDN, fix `modulepreload`, align `sw.js` & enable `@fastify/compress`**
  - Update `scripts/generate-instant-shell.mjs` and `index.html`: replace `<script src="https://cdn.tailwindcss.com"></script>` + inline `tailwind.config` with `<link rel="stylesheet" href="src/styles/tailwind.generated.css?v=25.0">`; align `href`/`src` `?v=25.0` across `stitch-tokens.css`, `studocu.css`, `highlight-theme.css`, `tailwind.generated.css`, and `app.js` (matching `modulepreload` href cleanly to `src/app.js?v=25.0`). Ensure regenerated instant shell compiles cleanly via `npm run build:shell`.
  - Update `sw.js` (`CACHE_NAME = 'duydev-studio-v25.0'`, include `'./src/styles/tailwind.generated.css?v=25.0'` in `ASSETS_TO_PRECACHE`) and `src/utilities/pwa.js` (`CURRENT_PWA_VERSION = 'duydev-studio-v25.0'`).
  - Update `server/src/app.ts`: register `await app.register(compress, { global: true, threshold: 1024, encodings: ['br', 'gzip'] })` BEFORE static routes; preserve `/src/utilities/pwa.js` `no-cache, must-revalidate` + ETag `304`, `index.html`/`sw.js` `no-cache, must-revalidate` (no `no-store`), and enable ETag / `max-age=0, must-revalidate` for unversioned `/src/` ES modules vs `public, max-age=31536000, immutable` for `?v=` assets.
- [ ] **Step 4: Run TypeScript build + `battery_optimization.test.ts`**
  Run:
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk vitest run --root server tests/unit/battery_optimization.test.ts` -> expected PASS (all Pillar 1–5 checks green).
- [ ] **Step 5: Commit**
  Stage `.gitignore`, `tailwind.config.js`, `src/styles/tailwind.input.css`, `src/styles/tailwind.generated.css`, `package.json`, `package-lock.json`, `scripts/generate-instant-shell.mjs`, `index.html`, `sw.js`, `src/utilities/pwa.js`, `server/package.json`, `server/package-lock.json`, `server/src/app.ts` -> `rtk git commit -m "perf(boot,server): compile static Tailwind CSS, enable Brotli/Gzip compression, and align v25.0 cache"`

---

### Task 1.4 — Lazy Dynamic Tool Loading (`ToolPage.js`) & Race-Free Router (`app.js`)

**Files:**
- Modify: `src/pages/ToolPage.js`
- Modify: `src/app.js`
- Test: `server/tests/unit/tool_lazy_loader.test.ts` (Create)

**Interfaces:**
- *Produces:* `async renderToolPage(toolId, subTab)` returning HTML string after dynamic `import(...)`, `renderToolLoadingSkeleton(tool)` synchronous skeleton HTML, stale navigation sequence cancellation inside `src/app.js`.
- *Consumes:* `../components/tools/studocu/StudocuWorkspace.js` via dynamic import (zero modifications inside `studocu/**`).

- [ ] **Step 1: Write failing unit test `server/tests/unit/tool_lazy_loader.test.ts`**
  Verify by static/AST/import assertion + mocked runner:
  1. `ToolPage.js` contains zero top-level static imports of `components/tools/**`, `ArchivePage.js`, or `StoragePage.js`.
  2. Switching quickly from tool A -> tool B cancels listener attachment for A (`navigationSeq` mismatch).
  3. All 20 tool IDs (including `studocu-dl`, `academia`, `researchgate`, `viewsplit`, `qr-multi`, `qr-scan`, `hash-checksum`, `markdown-docs`, `pdf-*`, `universal-converter`) resolve cleanly without importing `?v=` hardcoded suffix mismatch (`ViewSplitWorkspace.js`).
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/tool_lazy_loader.test.ts` -> expected FAIL.
- [ ] **Step 3: Refactor `ToolPage.js` to lazy loader map & update `app.js` `dispatchTool`**
  - In `src/pages/ToolPage.js`: replace static imports lines 12–36 with `TOOL_LOADERS` dynamic import callbacks caching resolved `{ render, attach }` modules; remove stale `?v=22.11` from `ViewSplitWorkspace.js` import; export `renderToolLoadingSkeleton(tool)` and `async renderToolPage(toolId, subTab)` + `attachToolPageListeners(onReRender)` using the resolved module reference.
  - In `src/app.js`: add `this._navigationSeq = 0` incremented on every `renderCurrentView`; inside `dispatchTool`, render `renderToolLoadingSkeleton` immediately into `#mainContent`, `await renderToolPage(toolId, subTab)`, abort silently if `seq !== this._navigationSeq`, swap HTML, and call `attachToolPageListeners` + `window.lucide?.createIcons({ root: mainContainer })`. Defer `ShareTargetModal.js` load to `#share-target`/Share intent or `requestIdleCallback`. Also update `converterManager` / `pdfQueueManager` imports cleanly if only needed inside tool routes or lazy hook.
- [ ] **Step 4: Run syntax check & unit tests**
  Run:
  `rtk err node --check src/pages/ToolPage.js src/app.js`
  `rtk vitest run --root server tests/unit/tool_lazy_loader.test.ts tests/unit/battery_optimization.test.ts`
- [ ] **Step 5: Commit**
  `git add src/pages/ToolPage.js src/app.js server/tests/unit/tool_lazy_loader.test.ts` -> `rtk git commit -m "perf(router): convert ToolPage to lazy dynamic ES module loaders with sequence guard"`

---

## Phase 2: Instagram & Facebook Cookieless Fast-Race Extraction

### Task 2.1 — Shared Media URL Pre-Resolver, Redirect SSRF Guard, Bounded `TtlCache` & Concurrent Drive Scanner

**Files:**
- Create: `server/src/services/shared/media-url-cache.ts`
- Test: `server/tests/unit/media_url_cache.test.ts` (Create)

**Interfaces:**
- *Produces:*
  - `class BoundedTtlCache<T>(maxEntries = 200, ttlMs = 10 * 60 * 1000)` (`get`, `set`, `delete`, `clear`, LRU/oldest eviction when exceeding `maxEntries`)
  - `expandRedirectUrl(rawUrl, validatorFn, { maxHops = 5, timeoutMs = 4000, allowedHosts? }): Promise<string>` — validates initial URL and EVERY `3xx` `Location` target via `validatorFn` before following, stopping cleanly on non-redirect or hop cap
  - `findExistingDriveMatch(dirPath, matcherFn, concurrency = 8)` — bounded parallel `.meta.json` inspection with early exit on first match (used by both IG & FB `checkExistingInDrive`).

- [ ] **Step 1: Write failing unit test `server/tests/unit/media_url_cache.test.ts`**
  Test:
  1. `BoundedTtlCache` evicts oldest entry at 201 inserts and expires items past TTL cleanly.
  2. `expandRedirectUrl` follows 2 safe redirects (`302 -> 301 -> 200`), rejects on `Location: http://127.0.0.1/secret` (SSRF hop blocked), and throws/stops on `> 5` hops.
  3. `findExistingDriveMatch` caps concurrent filesystem reads at `<= 8` and short-circuits on match.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/media_url_cache.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement `server/src/services/shared/media-url-cache.ts`**
  Implement crisp, small, single-purpose exports using Node `fetch` + `AbortSignal.timeout`.
- [ ] **Step 4: Run test & TypeScript check**
  Run:
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk vitest run --root server tests/unit/media_url_cache.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add server/src/services/shared/media-url-cache.ts server/tests/unit/media_url_cache.test.ts` -> `rtk git commit -m "feat(media): add shared SSRF-safe redirect expander, bounded TTL cache, and concurrent Drive scanner"`

---

### Task 2.2 — Instagram Cookieless Embed + Anonymous GraphQL Tier 1 & Hardened `yt-dlp` Fallback

**Files:**
- Modify: `server/src/services/instagram.service.ts`
- Test: `server/tests/unit/instagram_service.test.ts` (Create)

**Interfaces:**
- *Consumes:* `BoundedTtlCache`, `expandRedirectUrl`, `findExistingDriveMatch` from Task 2.1.
- *Produces:* Cookieless `InstagramService.resolveMedia(url)` resolving single video, single image, Reels, and multi-item Carousels via Embed HTML / anonymous GraphQL within ~`4.5s` before `yt-dlp`.

- [ ] **Step 1: Write failing unit tests `server/tests/unit/instagram_service.test.ts`**
  Mock global `fetch` & `execFile`:
  1. `instagram.com/share/...` or `instagr.am/...` expands redirect first before shortcode parsing.
  2. Tier 1A embed parser extracts Reel `video_url`, Carousel `edge_sidecar_to_children` mixed photo+video items, and fallback `<video>`/`<img>` tags from `/p/{shortcode}/embed/captioned/`.
  3. When Tier 1A HTML lacks `gql_data`, Tier 1B anonymous web GraphQL (`X-IG-App-ID: 936619743392459` using LSD/CSRF token) resolves cleanly without spawning `yt-dlp`.
  4. Repeated calls hit `BoundedTtlCache` (`0` duplicate fetches); failed extraction does NOT populate cache and falls back cleanly to hardened `yt-dlp` (`--no-playlist`, `--socket-timeout 12`, `--retries 2`).
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/instagram_service.test.ts` -> expected FAIL.
- [ ] **Step 3: Refactor `InstagramService` (`instagram.service.ts`)**
  - Wire `expandRedirectUrl` (`instagram.com/share/`, `instagr.am/`) + canonical key normalization (`reel`/`p`/`tv` + shortcode) before `validateSafeMediaUrl`.
  - Wire `BoundedTtlCache` (`200`, `10m`) in `resolveVideo`/`resolveMedia` (never caching failures) and `findExistingDriveMatch` (`concurrency = 8`) in `checkExistingInDrive`.
  - Implement Tier 1A (`/p/{code}/embed/captioned/` & `/reel/{code}/embed/`, `4.5s` timeout, realistic desktop headers + JSON/`<video>`/`<img>`/carousel extractor) racing/cascading cleanly into Tier 1B (anonymous web GraphQL using extracted `lsd`/csrf & `X-IG-App-ID: 936619743392459`, `4.5s` timeout), preserving `RAPIDAPI_KEY` Tier 1C if set, and hardening Tier 2 `yt-dlp` (`22s`, `--no-playlist`, `--socket-timeout 12`, `--retries 2`, optional silent `process.env.IG_COOKIES_FILE` if exists on disk).
- [ ] **Step 4: Run test & TypeScript check**
  Run:
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk vitest run --root server tests/unit/instagram_service.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add server/src/services/instagram.service.ts server/tests/unit/instagram_service.test.ts` -> `rtk git commit -m "perf(instagram): add cookieless embed/GraphQL Tier 1, redirect expander, and TTL cache"`

---

### Task 2.3 — Facebook `Promise.any` Fast-Race & Server-Tokenized Split DASH Muxer

**Files:**
- Modify: `server/src/services/facebook.service.ts`
- Modify: `server/src/schemas/facebook.schema.ts` (add optional `dashToken?: string` on `FacebookMediaFormat`)
- Modify: `server/src/api/controllers/facebook.controller.ts` (verify `stream` / `save-drive` accept `dash://<token>` or `dashToken` cleanly)
- Test: `server/tests/unit/facebook_service.test.ts` (Create)

**Interfaces:**
- *Consumes:* `BoundedTtlCache`, `expandRedirectUrl`, `findExistingDriveMatch` from Task 2.1.
- *Produces:* `FacebookService.resolveVideo(url)` with `Promise.any` race (`Comet` vs `m/mbasic` vs `plugins/video.php`, `5.5s`), MPD DASH parser, opaque `dashToken` registry (`dash://<token>`), and `proxyStream` / `saveToDrive` `ffmpeg -c copy` DASH muxing.

- [ ] **Step 1: Write failing unit tests `server/tests/unit/facebook_service.test.ts`**
  Mock `fetch`, `spawn` (`ffmpeg`), and `execFile` (`yt-dlp`):
  1. `facebook.com/share/r/...`, `/share/v/...`, `/share/p/...`, and `fb.watch/...` expand via `expandRedirectUrl` cleanly.
  2. `Promise.any` returns immediately once fastest valid scraper (`plugins/video.php` / `Comet` / `m.facebook`) extracts media without waiting for a stalled 5.5s sibling source; rejects non-media sources properly so fast failure falls through cleanly.
  3. Comet result containing ONLY `dash_manifest_xml_string` (zero `browser_native_hd_url`/`playable_url`) parses highest-bandwidth `<AdaptationSet mimeType="video/...">` and `audio/...` `<BaseURL>` entries and returns `formats` with `url: "dash://<token>"` + `dashToken`.
  4. `proxyStream('dash://<token>', ...)` resolves server-side token, validates BOTH `videoUrl` & `audioUrl` with `validateSafeMediaUrl`, and rejects expired/unknown `dashToken` with HTTP 404/400 (never trusting raw unvalidated dual client URLs).
  5. Repeated `resolveVideo` calls hit `BoundedTtlCache`.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/facebook_service.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement `FacebookService` fast-race, MPD DASH parser, `dashToken` store & `ffmpeg` muxing**
  - Wire `expandRedirectUrl`, `BoundedTtlCache` (`200`, `10m`), and `findExistingDriveMatch` (`concurrency = 8`).
  - Refactor multi-endpoint fetch to `Promise.any` (`5.5s` AbortSignal per request: `www.facebook.com`, `m.facebook.com`/`mbasic.facebook.com`, and `https://www.facebook.com/plugins/video.php?href=...`), throwing inside any branch that extracts zero media so slower valid branches win.
  - Parse `dash_manifest_xml_string` (unescaping XML entities + picking top-bandwidth video & audio `<BaseURL>`s), mint short-lived token (`15m` TTL + lazy prune `Map`) exposed as `dash://<token>` in `formats` (`videoHdUrl`/`videoSdUrl` fall back cleanly to progressive or first mux URL).
  - In `proxyStream` & `saveToDrive`: if URL starts with `dash://`, resolve `{ videoUrl, audioUrl }` from token store, validate both URLs with `validateSafeMediaUrl`, and run `ffmpeg -y -i <videoUrl> -i <audioUrl> -c copy` (`-movflags frag_keyframe+empty_moov -f mp4 pipe:1` when streaming; `-movflags +faststart <tmpPath>` when saving to Drive). Cleanly kill spawned `ffmpeg` on client socket `'close'`.
  - Pass canonical expanded URL to hardened Tier 2 `yt-dlp` (`--no-playlist`, `--socket-timeout 12`, `--retries 2`, silent `process.env.FB_COOKIES_FILE` support).
- [ ] **Step 4: Run test & TypeScript check**
  Run:
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk vitest run --root server tests/unit/facebook_service.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add server/src/services/facebook.service.ts server/src/schemas/facebook.schema.ts server/src/api/controllers/facebook.controller.ts server/tests/unit/facebook_service.test.ts` -> `rtk git commit -m "perf(facebook): add Promise.any fast-race, share redirect expansion, and tokenized DASH muxing"`

---

## Phase 3: Web Runtime Performance & Battery Efficiency

### Task 3.1 — Dashboard 10-Tier Visual-Preserving Compositor Pruning, 3-Signal Lifecycle Pause & `ResizeObserver`

**Files:**
- Modify: `src/styles/card-tiers-10.css`
- Modify: `src/styles/stitch-tokens.css`
- Modify: `src/components/dashboard/DashboardPage.js`
- Modify: `src/hooks/useToolRegistry.js`
- Modify: `src/app.js`
- Verify: `server/tests/unit/battery_optimization.test.ts`

**Interfaces:**
- *Preserves:* 100% of visible 10-Tier card visuals in Light & Dark modes, `.glass-panel` + `.glass-dock` + `will-change: transform;` + `html.app-backgrounded` in `stitch-tokens.css` (`battery_optimization.test.ts` strings!).
- *Produces:* Root `.ds-animations-paused` / `html.app-backgrounded` pause rule synced with `visibilitychange` + `ds:native-app-paused` / `ds:native-app-resumed`, `.tier-offscreen` `IntersectionObserver`, and `ResizeObserver`-only layout sync (deleting 12s `setInterval`).

- [ ] **Step 1: Add CSS regression assertions in `server/tests/unit/battery_optimization.test.ts` (without removing existing ones)**
  Append assertions checking:
  1. `useToolRegistry.js` no longer contains any global layout `setInterval(..., 12000)`.
  2. `DashboardPage.js` initializes `IntersectionObserver` toggling `.tier-offscreen` and disconnects it in unmount cleanup.
  3. `card-tiers-10.css` keeps all tier gradient/glow rules intact while pausing offscreen/background animations (`.tier-offscreen`, `html.app-backgrounded`, `.ds-animations-paused`).
- [ ] **Step 2: Run `battery_optimization.test.ts` to verify new assertions fail first**
  Run: `rtk vitest run --root server tests/unit/battery_optimization.test.ts` -> expected FAIL on newly added assertions.
- [ ] **Step 3: Implement CSS compositor pruning, 3-signal pause & `ResizeObserver` cleanup**
  - `src/styles/card-tiers-10.css` & `src/styles/stitch-tokens.css`: strip redundant inner `will-change` / `translateZ(0)` on static child layers (`card-tiers-10.css`) while leaving visible tier glows/particles/animations and required `stitch-tokens.css` classes (`.glass-panel`, `.glass-dock`, `will-change: transform;`, `html.app-backgrounded`) 100% intact. Add `html.ds-animations-paused` selector alongside `html.app-backgrounded` / `.tier-offscreen` to pause `animation-play-state`.
  - `src/components/dashboard/DashboardPage.js`: connect `IntersectionObserver` (`rootMargin: '80px'`) adding/removing `.tier-offscreen` on `[data-tier]` cards outside viewport, returning `observer.disconnect()` in cleanup.
  - `src/app.js`: toggle both `html.app-backgrounded` & `html.ds-animations-paused` across `visibilitychange`, `'ds:native-app-paused'`, and `'ds:native-app-resumed'` (clearing immediately on visible/resume).
  - `src/hooks/useToolRegistry.js`: delete the `12000ms` background `setInterval` and drive responsive layout sync strictly through `ResizeObserver` + hash/filter re-renders.
- [ ] **Step 4: Run syntax check & `battery_optimization.test.ts`**
  Run:
  `rtk err node --check src/components/dashboard/DashboardPage.js src/hooks/useToolRegistry.js src/app.js`
  `rtk vitest run --root server tests/unit/battery_optimization.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add src/styles/card-tiers-10.css src/styles/stitch-tokens.css src/components/dashboard/DashboardPage.js src/hooks/useToolRegistry.js src/app.js server/tests/unit/battery_optimization.test.ts` -> `rtk git commit -m "perf(dashboard): prune redundant child compositors, add 3-signal pause, and replace 12s interval with ResizeObserver"`

---

### Task 3.2 — ViewSplit Dirty-Render Engine, Coalesced Input & `dragReorder.js` rAF Batching

**Files:**
- Modify: `src/components/tools/viewsplit/hooks/useViewSplitDom.js`
- Modify: `src/utilities/dragReorder.js`
- Test: `server/tests/unit/viewsplit_dirty_render.test.ts` (Create)

**Interfaces:**
- *Produces:* Event-driven `requestRender()` in `useViewSplitDom.js` (0 idle rAF frames when stationary) + cached bounding rects + pointermove rAF coalescing + batched rAF sibling shifts in `dragReorder.js`.

- [ ] **Step 1: Write failing test `server/tests/unit/viewsplit_dirty_render.test.ts`**
  Simulate ViewSplit rAF scheduler & inspect static/runtime behavior verifying:
  1. `renderCanvasFrame` only re-schedules `requestAnimationFrame` when marked dirty; after drawing 1 clean frame, subsequent idle ticks call `requestAnimationFrame` **0** times (`0` continuous `rafId = requestAnimationFrame(renderCanvasFrame)` self-loop).
  2. Repeated `pointermove`/`mousemove` events in a single frame coalesce to 1 pan/slider/loupe layout draw using cached `getBoundingClientRect()`.
  3. Cleanup function cancels pending rAF and removes listeners cleanly.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/viewsplit_dirty_render.test.ts` -> expected FAIL.
- [ ] **Step 3: Refactor ViewSplit render loop & `dragReorder.js` pointermove**
  - `src/components/tools/viewsplit/hooks/useViewSplitDom.js`: replace unconditional loop (`useViewSplitDom.js:448-451`) with `let isDirty = false; let rafPending = false; function requestRender() { ... }` invoked cleanly by zoom, pan, slider, loupe, layout, filter, pane image load, and resize handlers; update `#viewsplit-zoom-badge-*` only on dirty draw; cache canvas `getBoundingClientRect()` on `mousedown`/`pointerdown`/`resize` and coalesce move updates in rAF; cancel `rafId` on unmount.
  - `src/utilities/dragReorder.js`: inside `onPointerMove` (`231-248`), stage latest `(clientX, clientY)` and apply `transform` + `computeDropIndex2D` + `updateSiblingShifts` once per rAF tick (`cancelAnimationFrame` on `onPointerEnd`/destroy).
- [ ] **Step 4: Run syntax check & unit tests**
  Run:
  `rtk err node --check src/components/tools/viewsplit/hooks/useViewSplitDom.js src/utilities/dragReorder.js`
  `rtk vitest run --root server tests/unit/viewsplit_dirty_render.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add src/components/tools/viewsplit/hooks/useViewSplitDom.js src/utilities/dragReorder.js server/tests/unit/viewsplit_dirty_render.test.ts` -> `rtk git commit -m "perf(viewsplit,dnd): switch ViewSplit to dirty requestRender loop and coalesce pointermove in rAF"`

---

### Task 3.3 — Admin Telemetry SVG Diffing & Scoped `window.lucide.createIcons({ root })` Rollout

**Files:**
- Modify: `src/pages/AdminPage.js`
- Modify: `src/pages/StoragePage.js`
- Modify: `src/components/tools/quiz/hooks/useQuizListeners.js`
- Modify: `src/pages/ServerPage.js`
- Modify: `src/pages/ArchivePage.js`
- Modify: `src/components/tools/scribd/ScribdWorkspace.js`
- Modify: `src/components/tools/youtube/YoutubeWorkspace.js`
- Modify: `src/components/tools/pdf/hooks/usePdfDom.js`
- Modify: `src/components/tools/tiktok/TiktokWorkspace.js`
- Verify: `server/tests/unit/battery_optimization.test.ts`

**Interfaces:**
- *Preserves:* Existing `AdminPage.js` `document.hidden || document.visibilityState === 'hidden' || isPollingPaused` guard checked by `battery_optimization.test.ts`.
- *Produces:* Telemetry gauge diff guard (`lastGaugeKey === "${memPct}|${cpuLoadPct}|${r2Pct}"`), zero unscoped `lucide.createIcons()` calls across listed views/pollers.

- [ ] **Step 1: Add unit assertions in `server/tests/unit/battery_optimization.test.ts` checking scoped Lucide calls & gauge diffing**
  Verify zero bare `lucide.createIcons()` (without `{ root`) remain inside `AdminPage.js`, `StoragePage.js`, `useQuizListeners.js`, `ServerPage.js`, `ArchivePage.js`, `ScribdWorkspace.js`, `YoutubeWorkspace.js`, `usePdfDom.js`, `TiktokWorkspace.js`, and verify `AdminPage.js` caches previous `memPct`/`cpuLoadPct`/`r2Pct` key before mutating `#adminGaugesContainer.innerHTML`.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/battery_optimization.test.ts` -> expected FAIL on new scoped Lucide / gauge-diff assertions.
- [ ] **Step 3: Implement gauge SVG diffing, native background sync & scoped Lucide updates**
  - `src/pages/AdminPage.js`: preserve existing hidden guard verbatim; wire `'ds:native-app-paused'` / `'ds:native-app-resumed'` to pause/resume poll loop immediately; compare `gaugeSignature = "${memPct}|${cpuLoadPct}|${r2Pct}"` against `lastGaugeSignature` before regenerating `#adminGaugesContainer` SVG markup; replace `window.lucide?.createIcons()` on poll ticks with `{ root: targetEl }` only for changed subtrees.
  - `src/pages/StoragePage.js`: deduplicate back-to-back icon refreshes inside `loadDirectory()` and pass `{ root: contentContainer }` to `window.lucide?.createIcons`.
  - Pass `{ root: containerEl }` to every `window.lucide.createIcons(...)` call across `useQuizListeners.js`, `ServerPage.js`, `ArchivePage.js`, `ScribdWorkspace.js`, `YoutubeWorkspace.js`, `usePdfDom.js`, `TiktokWorkspace.js`.
- [ ] **Step 4: Run syntax check & `battery_optimization.test.ts`**
  Run:
  `rtk err node --check src/pages/AdminPage.js src/pages/StoragePage.js src/components/tools/quiz/hooks/useQuizListeners.js src/pages/ServerPage.js src/pages/ArchivePage.js src/components/tools/scribd/ScribdWorkspace.js src/components/tools/youtube/YoutubeWorkspace.js src/components/tools/pdf/hooks/usePdfDom.js src/components/tools/tiktok/TiktokWorkspace.js`
  `rtk vitest run --root server tests/unit/battery_optimization.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add src/pages/AdminPage.js src/pages/StoragePage.js src/components/tools/quiz/hooks/useQuizListeners.js src/pages/ServerPage.js src/pages/ArchivePage.js src/components/tools/scribd/ScribdWorkspace.js src/components/tools/youtube/YoutubeWorkspace.js src/components/tools/pdf/hooks/usePdfDom.js src/components/tools/tiktok/TiktokWorkspace.js server/tests/unit/battery_optimization.test.ts` -> `rtk git commit -m "perf(ui): diff Admin SVG gauges and scope lucide.createIcons to mutated containers"`

---

### Task 3.4 — Markdown Input Debounce, PDF Thumbnail Blur Removal & Hash 4MB Streaming + MD5

**Files:**
- Create: `src/utilities/hashStream.js`
- Modify: `src/components/tools/MarkdownEditor.js`
- Modify: `src/components/tools/pdf/components/PdfPreviewCanvas.js`
- Modify: `src/components/tools/hash/HashStudio.js`
- Modify: `src/components/tools/hash/hooks/useHashActions.js`
- Test: `server/tests/unit/hash_streaming.test.ts` (Create)

**Interfaces:**
- *Produces:*
  - `hashStream.js`: `computeTextHashes(text)` & `computeFileHashesStreaming(file, { chunkSize = 4 * 1024 * 1024, onProgress, signal })` returning `{ md5, sha1, sha256, sha512 }` (zero external dependencies; incremental pure-JS MD5 for all sizes + Web Crypto `subtle.digest` fast-path for `<100MB` SHA + pure-JS incremental SHA-1/256/512 streaming for `>=100MB` files yielding between chunks without full `file.arrayBuffer()` allocation).
  - Synchronous flush function inside `MarkdownEditor.js` cancelling `180ms` debounce before any save/export.

- [ ] **Step 1: Write failing unit tests `server/tests/unit/hash_streaming.test.ts`**
  Cross-verify `hashStream.js` against Node `crypto.createHash` across:
  1. Empty string `""` and empty 0-byte `Blob`/`File` (exact standard MD5 `d41d8cd98f00b204e9800998ecf8427e`, SHA-1, SHA-256, SHA-512).
  2. Multi-chunk Unicode & binary payload (testing chunk boundaries e.g. `chunkSize = 1024` over `>5KB` binary buffer + mocking `100MB` threshold route so both `<100MB` Web Crypto and `>=100MB` incremental SHA engines match Node `crypto` bit-for-bit).
  3. AbortSignal cancellation stops chunk reading promptly without throwing unhandled rejection.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/hash_streaming.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement `hashStream.js`, Hash MD5 UI/streaming, Markdown 180ms debounce & PDF blur removal**
  - `src/utilities/hashStream.js`: implement pure-JS incremental `Md5Hasher`, `Sha1Hasher`, `Sha256Hasher`, `Sha512Hasher` (`update(Uint8Array)`, `hex()`) + `file.slice(offset, end).arrayBuffer()` loop with progress updates (`0..100`) and `AbortSignal` support.
  - `src/components/tools/hash/HashStudio.js` & `useHashActions.js`: debounce text hashing (`150ms`), remove full `await file.arrayBuffer()`, call `computeFileHashesStreaming`, wire an `AbortController` cancelled on unmount/new-file/reset, display **MD5** card + copy + checksum comparator alongside SHA-256, SHA-1, SHA-512.
  - `src/components/tools/MarkdownEditor.js`: debounce keystroke markdown parse + `localStorage` write (`180ms`), clear timeout on unmount, and call `flushMarkdownSync()` before copy/save/export.
  - `src/components/tools/pdf/components/PdfPreviewCanvas.js`: replace `backdrop-blur-sm` on `.btn-preview-page` (`line 47`) with crisp solid overlay `bg-black/65 hover:bg-black/85`.
- [ ] **Step 4: Run syntax check & `hash_streaming.test.ts`**
  Run:
  `rtk err node --check src/utilities/hashStream.js src/components/tools/MarkdownEditor.js src/components/tools/pdf/components/PdfPreviewCanvas.js src/components/tools/hash/HashStudio.js src/components/tools/hash/hooks/useHashActions.js`
  `rtk vitest run --root server tests/unit/hash_streaming.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add src/utilities/hashStream.js src/components/tools/MarkdownEditor.js src/components/tools/pdf/components/PdfPreviewCanvas.js src/components/tools/hash/HashStudio.js src/components/tools/hash/hooks/useHashActions.js server/tests/unit/hash_streaming.test.ts` -> `rtk git commit -m "perf(markdown,pdf,hash): debounce markdown input, strip PDF card blur, and add 4MB streaming MD5/SHA hashing"`

---

## Phase 4: Mobile UI (Option C), Ergonomics, Copy Polish & Feature Suite

### Task 4.1 — Option C Mobile Layouts, `>=44px` Touch Targets, Chrome Count & Copy Purge

**Files:**
- Modify: `src/pages/StoragePage.js`
- Modify: `src/components/tools/viewsplit/components/ViewSplitPixelInspector.js`
- Modify: `src/components/tools/viewsplit/components/ViewSplitToolbar.js`
- Modify: `src/components/layout/Header.js`
- Modify: `src/components/layout/Footer.js`
- Modify: `scripts/generate-instant-shell.mjs`
- Modify: `index.html`
- Modify: `src/components/tools/tiktok/TiktokWorkspace.js`
- Modify: `src/components/tools/quiz/hooks/useQuizListeners.js`
- Modify: `src/components/tools/youtube/YoutubeWorkspace.js`
- Modify: `src/components/tools/pdf/components/ConfigPanel.js`
- Rebuild: `src/styles/tailwind.generated.css` (via `npm run build:css`)
- Test: `server/tests/unit/ui_hygiene.test.ts` (Create)

**Interfaces:**
- *Produces:* Approved Option C 2-row Storage mobile toolbar (`min-h-[44px]`), ViewSplit Top Bar Loupe toggle + zero collapsed bottom-right button (`BottomNav` conflict eliminated), `hidden xs:inline` Header `"DuyDev Studio"` `<420px`, `>=44px` touch targets, clean dynamic tool count (`"${toolCount} công cụ"`), and zero AI-slop / parenthetical copy (`KI-CON-001`).

- [ ] **Step 1: Write failing static UI hygiene test `server/tests/unit/ui_hygiene.test.ts`**
  Assert:
  1. `Footer.js` contains `"mọi người dùng"` (no `"mụi người dùng"`).
  2. `useQuizListeners.js` contains no `"cho bạn nè"`, `"xinh lung linh"`, or `"Ten ten"`.
  3. `YoutubeWorkspace.js` does not contain `"Âm thanh (Audio)"`, and PDF `ConfigPanel.js` does not contain `"(Tùy chọn)"`.
  4. `Header.js` uses dynamic `useToolRegistry` tool count (`!headerContent.includes('trong 21 công cụ')`) and hides `"DuyDev Studio"` on `<420px` (`hidden xs:inline`) with `min-w-[44px] min-h-[44px]` controls.
  5. `ViewSplitPixelInspector.js` returns `''` when `!inspectorOpen` (zero overlapping bottom-right button).
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/ui_hygiene.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement Option C mobile layouts, ergonomic sizes, copy fixes & rebuild Tailwind/Shell**
  - `src/pages/StoragePage.js`: Option C right-side toolbar: Row 1 (`flex items-center gap-2 w-full sm:w-auto`) with `#inputStorageSearch` (`flex-1 min-w-0 min-h-[44px]`), Upload (`min-h-[44px]`), New Folder (`min-h-[44px]`); Row 2 (`overflow-x-auto flex items-center gap-1.5`) with Sort, Grid/List, Select All, Refresh, Lock (`min-h-[44px] min-w-[44px] px-3`). Desktop `sm:` alignment preserved cleanly.
  - `src/components/tools/viewsplit/components/ViewSplitPixelInspector.js` & `ViewSplitToolbar.js`: when `!inspectorOpen`, return `''`; keep open `#viewsplit-pixel-inspector-hud` at `fixed bottom-24 sm:bottom-4 right-3 sm:right-4 z-40 w-[min(320px,calc(100vw-24px))]`; keep Top Bar `data-action="toggle-inspector"` (`min-h-[44px] px-2.5`).
  - `src/components/layout/Header.js` & `scripts/generate-instant-shell.mjs`: apply `min-w-[44px] min-h-[44px]` to logo link + all 6 right-side buttons, wrap `"DuyDev Studio"` span in `hidden xs:inline`, render compact Profile icon-only `<420px` (`hidden xs:inline` on name label), replace hardcoded `21` tool count with live `toolRegistry.getAllTools().length`.
  - `src/components/tools/tiktok/TiktokWorkspace.js`: make mobile paste button `min-h-[44px]`.
  - Copy cleanups: `Footer.js` (`"mọi người dùng"`), `useQuizListeners.js` (`"Đang khởi tạo và kiểm tra tài liệu nguồn..."`, `"Đang dàn trang A4 và xuất PDF..."`, `"Bộ đề thi và đáp án đã sẵn sàng."`), `YoutubeWorkspace.js` (`"Âm thanh"`), PDF `ConfigPanel.js` (`"Dải trang chuyển đổi"`).
  - Run `npm run build:shell` and `npm run build:css` so `index.html` instant shell and `tailwind.generated.css` reflect every new utility class (`min-h-[44px]`, `xs:inline`, `bottom-24`, etc.).
- [ ] **Step 4: Run syntax check, Vitest UI hygiene & battery checks**
  Run:
  `rtk err node --check src/pages/StoragePage.js src/components/tools/viewsplit/components/ViewSplitPixelInspector.js src/components/tools/viewsplit/components/ViewSplitToolbar.js src/components/layout/Header.js src/components/layout/Footer.js`
  `rtk vitest run --root server tests/unit/ui_hygiene.test.ts tests/unit/battery_optimization.test.ts`
- [ ] **Step 5: Commit**
  `git add src/pages/StoragePage.js src/components/tools/viewsplit/components/ViewSplitPixelInspector.js src/components/tools/viewsplit/components/ViewSplitToolbar.js src/components/layout/Header.js src/components/layout/Footer.js scripts/generate-instant-shell.mjs index.html src/styles/tailwind.generated.css src/components/tools/tiktok/TiktokWorkspace.js src/components/tools/quiz/hooks/useQuizListeners.js src/components/tools/youtube/YoutubeWorkspace.js src/components/tools/pdf/components/ConfigPanel.js server/tests/unit/ui_hygiene.test.ts` -> `rtk git commit -m "feat(ui,mobile): apply Option C mobile toolbars, >=44px touch targets, dynamic tool count, and copy cleanup"`

---

### Task 4.2 — Universal `QRCodeStyling` Styling & Preview Across All 5 Creation Tabs

**Files:**
- Modify: `src/components/tools/qr/QrStudio.js`
- Modify: `src/components/tools/qr/components/QrFormStatic.js` (`renderQrActionControls`)
- Modify: `src/components/tools/qr/components/QrPreviewCard.js`
- Modify: `src/components/tools/qr/hooks/useQrActions.js`
- Modify: `src/components/tools/qr/hooks/useQrState.js`
- Modify: `src/components/tools/qr/hooks/useQrListeners.js`
- Test: `server/tests/unit/qr_universal_style.test.ts` (Create)

**Interfaces:**
- *Consumes:* Existing `POST /api/v1/qr/generate` for VietQR EMVCo TLV+CRC16 payload construction & API backward compatibility; `window.QRCodeStyling` (`src/vendor/qr-code-styling.js`).
- *Produces:* Unified `buildStaticQrPayload(state)` + `renderStyledQrToContainer(containerId, dataString)` serving `'url' | 'vietqr' | 'wifi' | 'vcard' | 'text'`.

- [ ] **Step 1: Write failing unit tests `server/tests/unit/qr_universal_style.test.ts`**
  Verify:
  1. `QrStudio.js` renders `renderQrStylePanel(styling)` on `'url'`, `'vietqr'`, `'wifi'`, `'vcard'`, AND `'text'` tabs (no style-less tab).
  2. `buildStaticQrPayload` builds valid Wi-Fi (`WIFI:T:WPA;S:...;;`), vCard (`BEGIN:VCARD...END:VCARD`), and text payloads matching existing server conventions, while style changes (`dotType`, `dotColor`, `gradient`, `cornerSquareType`, `logoUrl`) re-render `QRCodeStyling` without dropping static tab state.
  3. Redundant color picker inside `renderQrActionControls` is merged/removed so only format (`png`/`svg`) + Submit remain cleanly under shared styling accordion.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/qr_universal_style.test.ts` -> expected FAIL.
- [ ] **Step 3: Unify `QrStudio`, `QrStylePanel`, `QrPreviewCard` & `useQrActions`**
  - Update `QrStudio.js`: render `renderQrStylePanel(styling)` below active tab form across ALL 5 creation tabs (`url`, `vietqr`, `wifi`, `vcard`, `text`), with shared format (`PNG`/`SVG`) + primary generate button in `renderQrActionControls` (`QrFormStatic.js`).
  - Update `QrPreviewCard.js` & `useQrActions.js`: mount styled live canvas via `window.QRCodeStyling` in `#qrStyledCanvasContainer` for both Dynamic URL (`shortUrl`) and generated Static/VietQR/Wi-Fi/vCard/Text payload string (`generatedResult.rawPayload` — obtained from `POST /api/v1/qr/generate` for VietQR EMVCo CRC16 or deterministic payload builder), wiring `#btnDownloadQr` / PNG / SVG / Copy Image directly to `activeStyledQr`. Update `useQrListeners.js` so `QrStylePanel` controls immediately refresh preview in any active tab.
- [ ] **Step 4: Run syntax check & unit tests**
  Run:
  `rtk err node --check src/components/tools/qr/QrStudio.js src/components/tools/qr/components/QrFormStatic.js src/components/tools/qr/components/QrPreviewCard.js src/components/tools/qr/hooks/useQrActions.js src/components/tools/qr/hooks/useQrListeners.js`
  `rtk vitest run --root server tests/unit/qr_universal_style.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add src/components/tools/qr/ server/tests/unit/qr_universal_style.test.ts` -> `rtk git commit -m "feat(qr): unify QRCodeStyling customization and preview across all 5 QR creation tabs"`

---

### Task 4.3 — Academia & ResearchGate Direct `"Tải về máy"` & Verified Redirect / MIME Stream Guard

**Files:**
- Modify: `server/src/services/academia.service.ts`
- Modify: `server/src/services/researchgate.service.ts`
- Modify: `src/components/tools/academia/AcademiaWorkspace.js`
- Modify: `src/components/tools/researchgate/ResearchgateWorkspace.js`
- Test: `server/tests/unit/academic_stream_guard.test.ts` (Create)

**Interfaces:**
- *Produces:* Validated OA PDF redirect traversal (`<=5` hops, SSRF host/IP verification per hop, rejecting upstream `text/html` content-type) + `"Tải về máy"` `<a download>` control wired strictly to resolved `pdfUrl`.

- [ ] **Step 1: Write failing unit tests `server/tests/unit/academic_stream_guard.test.ts`**
  Mock `fetch`:
  1. `AcademiaService.proxyStream` & `ResearchGateService.proxyStream` follow valid HTTPS OA redirects (e.g., `openalex.org` -> `publisher/paper.pdf`) validating each hop through SSRF guard (`http://169.254.169.254` or `127.0.0.1` hop -> rejected!).
  2. When upstream responds with `Content-Type: text/html; charset=utf-8` instead of PDF/binary bytes, `proxyStream` throws error / replies `422` without streaming HTML disguised as `.pdf`.
  3. Frontend template check confirms `AcademiaWorkspace.js` & `ResearchgateWorkspace.js` render `"Tải về máy"` pointing to `/api/v1/{academia,researchgate}/stream?...&download=true` only when `pdfUrl` exists, and disable it cleanly when `pdfUrl` is missing (never falling back to `originalUrl`).
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/academic_stream_guard.test.ts` -> expected FAIL.
- [ ] **Step 3: Harden `proxyStream` in both services & add `"Tải về máy"` in workspaces**
  - Reuse `expandRedirectUrl` from `server/src/services/shared/media-url-cache.ts` (with `validateSafeMediaUrl(hopUrl, ALLOWED_ACADEMIA_HOSTS | ALLOWED_RG_HOSTS)` per hop `<=5`, enforcing HTTPS and rejecting upstream `content-type` starting with `text/html` before piping body to `reply`).
  - Add `"Tải về máy"` button beside `"Lưu vào Studio Drive"` in `AcademiaWorkspace.js` & `ResearchgateWorkspace.js` (`min-h-[44px]`), disabled with clear `"Chưa có PDF trực tiếp"` title/state if `!paper.pdfUrl`.
- [ ] **Step 4: Run syntax check, `tsc` & Vitest**
  Run:
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk err node --check src/components/tools/academia/AcademiaWorkspace.js src/components/tools/researchgate/ResearchgateWorkspace.js`
  `rtk vitest run --root server tests/unit/academic_stream_guard.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add server/src/services/academia.service.ts server/src/services/researchgate.service.ts src/components/tools/academia/AcademiaWorkspace.js src/components/tools/researchgate/ResearchgateWorkspace.js server/tests/unit/academic_stream_guard.test.ts` -> `rtk git commit -m "feat(academic): add direct PDF device download and SSRF/MIME-checked OA redirect streaming"`

---

### Task 4.4 — Markdown Docs Full Upgrade (`.docx` Python Engine, Direct `.pdf`, Open Local/Drive `.md`, Sync Scroll & Shortcuts)

**Files:**
- Create: `engines/document/markdown_to_docx.py`
- Create: `server/src/schemas/markdown.schema.ts`
- Create: `server/src/api/controllers/markdown.controller.ts`
- Create: `server/src/api/routes/markdown.route.ts`
- Modify: `server/src/app.ts` (register `markdownRoute`)
- Modify: `src/components/tools/MarkdownEditor.js`
- Test: `server/tests/unit/markdown_export.test.ts` (Create)

**Interfaces:**
- *Produces:*
  - Python CLI: `python engines/document/markdown_to_docx.py <input.md> <output.docx> [--title "..."]` producing valid OOXML `.docx` (`headings`, `**bold**`/`*italic*`/`` `code` ``, lists, tables, blockquotes, fenced code blocks).
  - HTTP Route: `POST /api/v1/markdown/export` (`{ format: 'docx' | 'pdf', markdown, filename? }`) -> creates `FileRecord` + `HistoryRecord`, returns `{ fileId, downloadUrl, fileName, sizeBytes }`.
  - UI: Open Local `.md`/`.txt`, Open from Drive (unlocks Storage PIN if locked via `adminAuth.js` header), Sync Scroll toggle (on by default), `Ctrl/Cmd+B`/`I`/`S` shortcuts, `.docx` + `.pdf` export actions, `"Lưu vào Drive"` integration (connected via Task 4.5 helper).

- [ ] **Step 1: Write failing tests in `server/tests/unit/markdown_export.test.ts` (and Python verification test)**
  Test:
  1. Zod schema validates `format: 'docx' | 'pdf'`, rejects empty/whitespace markdown (`400 BadRequest`), sanitizes output filename against traversal (`../evil`).
  2. Executing `engines/document/markdown_to_docx.py` on sample Markdown (H1/H2, bold/italic/inline code, bullet + numbered list, GFM pipe table, blockquote, fenced code) creates non-empty valid ZIP/OOXML `.docx` parseable by `python-docx`.
  3. `POST /api/v1/markdown/export` (`docx` + `pdf` mocked/real fallback) persists `FileRecord` + returns `/api/v1/files/download/:fileId`.
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/markdown_export.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement `markdown_to_docx.py`, backend export endpoint & MarkdownEditor UI upgrades**
  - `engines/document/markdown_to_docx.py`: implement clean Python converter using `python-docx` (`Document`, paragraph runs parsing `**bold**`, `*italic*`, `` `code` ``, headings, bullet/number lists, blockquotes, fenced code blocks in monospace shaded cell, pipe tables with header bolding). Compile check via `py_compile`.
  - `server/src/api/controllers/markdown.controller.ts` & `markdown.route.ts` & `server/src/app.ts`: register `POST /api/v1/markdown/export`; write `.md` temp file; for `docx` run `markdown_to_docx.py`; for `pdf` render self-contained clean HTML (escaping raw script tags!) and convert via Headless Chromium `--print-to-pdf` or fallback `engines/document/office_converter.sh` LibreOffice (`docx -> pdf`); store result via `StorageManager`, create `prisma.fileRecord` + `prisma.historyRecord`, return `201` metadata.
  - `src/components/tools/MarkdownEditor.js`:
    - Add Open `.md`/`.txt` file button + hidden `<input type="file" accept=".md,.markdown,.txt">`.
    - Add `"Mở từ Drive"` modal/picker querying `/api/v1/storage/list` with `getStorageAuthHeaders()` (if `401` / `!isAdminAuthenticated()`, open existing Storage unlock modal & resume cleanly once unlocked), loading selected `.md`/`.txt` via `/api/v1/storage/download` with auth header.
    - Add proportional scroll sync listener between `#markdownInput` and preview container toggled by button (default active), `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, `Ctrl/Cmd+S` (triggering quick `.md` download) shortcuts, plus **Xuất .DOCX** & **Xuất .PDF** buttons calling `POST /api/v1/markdown/export` and offering Preview / Download / Save-to-Drive.
- [ ] **Step 4: Run Python check, syntax check, `tsc` & Vitest**
  Run:
  `rtk err python -m py_compile engines/document/markdown_to_docx.py`
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk err node --check src/components/tools/MarkdownEditor.js`
  `rtk vitest run --root server tests/unit/markdown_export.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add engines/document/markdown_to_docx.py server/src/schemas/markdown.schema.ts server/src/api/controllers/markdown.controller.ts server/src/api/routes/markdown.route.ts server/src/app.ts src/components/tools/MarkdownEditor.js server/tests/unit/markdown_export.test.ts` -> `rtk git commit -m "feat(markdown): add python-docx export, direct PDF export, local/Drive open, sync scroll, and shortcuts"`

---

### Task 4.5 — Auth-Gated Universal `"Lưu vào Drive"`, Expanded Drive Empty States & Global `Ctrl+V` / Cross-Tool Handoffs

**Files:**
- Modify: `server/src/api/routes/storage.route.ts`
- Modify: `server/src/api/controllers/storage.controller.ts`
- Create: `src/utilities/driveSaveHelper.js` (shared client guard checking `isAdminAuthenticated()`, prompting existing Storage unlock modal and resuming save automatically, calling `POST /api/v1/storage/save-artifact`)
- Create: `src/utilities/toolHandoff.js` (lightweight in-memory + session handoff for passing files/URLs across tools without touching `studocu/**`)
- Modify: `src/pages/StoragePage.js` (expanded folder empty-state quick launcher map)
- Modify: `src/components/tools/converter/components/ConverterResult.js`, `src/components/tools/converter/hooks/useConverterDom.js`, `src/components/tools/converter/ConverterWorkspace.js`
- Modify: `src/components/tools/pdf/components/ResultCard.js`, `src/components/tools/pdf/hooks/usePdfDom.js`
- Modify: `src/components/tools/archive/components/ArchiveCompressPane.js`, `src/components/tools/archive/ArchiveCompressWorkspace.js`
- Modify: `src/components/tools/viewsplit/components/ViewSplitToolbar.js`, `src/components/tools/viewsplit/hooks/useViewSplitDom.js`, `src/components/tools/viewsplit/utilities/viewSplitCompositor.js`
- Modify: `src/components/tools/MarkdownEditor.js` (wire `"Lưu vào Drive"` button using `driveSaveHelper.js`)
- Modify: `src/components/history/HistoryItemRow.js`, `src/pages/HistoryPage.js`
- Modify: `src/components/tools/facebook/FacebookWorkspace.js`, `src/components/tools/instagram/InstagramWorkspace.js`, `src/components/tools/hash/HashStudio.js` (`Ctrl+V` global paste outside inputs)
- Test: `server/tests/unit/storage_save_artifact.test.ts` (Create)

**Interfaces:**
- *Backend Auth & Security:*
  - Route `POST /api/v1/storage/save-artifact` inside `storage.route.ts` (inherits `preHandler: storageAuthGuard` -> `401 UNAUTHORIZED` without valid Admin token/PIN).
  - Target folder allowlist: strictly `'/pdf' | '/converted' | '/archives' | '/images' | '/documents'` (normalized + verified via `StorageManager.sanitizeSafePath`).
  - Supports either JSON (`{ fileId, targetFolder, fileName?, overwrite? }` validated against Prisma `FileRecord` `!isPurged` & disk exists) OR multipart upload (`file`, `targetFolder`, `fileName?`, `overwrite?`, bounded `<=100MB`). Writes `.meta.json` sidecar + `DriveService.invalidateStatsCache()` + duplicate `(1)` suffix unless `overwrite: true`.
  - Keep `GET /api/v1/storage/download` whitelist strictly limited to `/slideshare/`, `/academia/`, `/researchgate/` so saved artifacts stay Admin-PIN-gated.

- [ ] **Step 1: Write failing backend & security tests `server/tests/unit/storage_save_artifact.test.ts`**
  Using Fastify `app.inject`:
  1. Unauthenticated `POST /api/v1/storage/save-artifact` returns `401`.
  2. Authenticated call with unknown/disallowed `targetFolder` (e.g. `'/../escape'`, `'/slideshare'`) returns `400`.
  3. Authenticated call with valid `fileId` copies artifact safely into `/pdf`, writes `.meta.json`, increments duplicate name `(1)` when `!overwrite`, returns `201 { path, name, sizeBytes }`.
  4. Authenticated multipart upload (ViewSplit PNG / Markdown DOCX) writes file + `.meta.json` cleanly; `0`-byte upload fails `400`.
  5. Unauthenticated `GET /api/v1/storage/download?path=/pdf/sample.pdf` still returns `401` (PIN boundary intact!).
- [ ] **Step 2: Run test to verify failure**
  Run: `rtk vitest run --root server tests/unit/storage_save_artifact.test.ts` -> expected FAIL.
- [ ] **Step 3: Implement `saveArtifactHandler`, `driveSaveHelper.js`, UI Save-to-Drive buttons, Empty States, `Ctrl+V` & Cross-Tool Handoffs**
  - `server/src/api/controllers/storage.controller.ts` & `storage.route.ts`: implement `saveArtifactHandler` handling both JSON `fileId` copy and multipart generated upload under strict folder allowlist + `sanitizeSafePath` + `.meta.json` write + `DriveService.invalidateStatsCache()`.
  - `src/utilities/driveSaveHelper.js`: implement `saveArtifactToDrive({ fileId?, blob?, fileName, targetFolder, meta?, onUnlockRequired })` checking `isAdminAuthenticated()`; if locked, invoke existing Storage PIN unlock flow (`verifyAdminPassword` modal) cleanly and automatically retry `POST /api/v1/storage/save-artifact` with `getStorageAuthHeaders()` once unlocked (updating History `driveRelPath` / toast link if applicable).
  - UI Buttons: add `"Lưu vào Drive"` (`min-h-[44px]`) cleanly in `ConverterResult.js` -> `useConverterDom.js` (`/converted`), `ResultCard.js` -> `usePdfDom.js` (`/pdf`), `ArchiveCompressPane.js` -> `ArchiveCompressWorkspace.js` (`/archives`), `ViewSplitToolbar.js` + `viewSplitCompositor.js` + `useViewSplitDom.js` (`/images`), `MarkdownEditor.js` (`/documents`), and `HistoryItemRow.js` + `HistoryPage.js` (respecting auth gate cleanly; non-admin History rows keep temporary `fileId` download/preview intact).
  - `src/pages/StoragePage.js`: replace hardcoded `/youtube`/`/tiktok` empty-state branch with data-driven `FOLDER_EMPTY_LAUNCHERS` mapping `/youtube`, `/tiktok`, `/facebook`, `/instagram`, `/spotify`, `/scribd`, `/slideshare`, `/academia`, `/researchgate`, `/pdf`, `/converted`, `/archives`, `/documents` cleanly to their tool hashes & clear action labels.
  - `src/utilities/toolHandoff.js` & Global `Ctrl+V`: wire `document` `paste` listener inside `ConverterWorkspace`, `FacebookWorkspace`, `InstagramWorkspace`, and `HashStudio` (active ONLY when `!e.target.closest('input, textarea, [contenteditable="true"]')`, cleaned up on unmount) + add lightweight cross-tool send-to-module actions on output cards (e.g. Downloader/PDF/Converter/History -> ViewSplit, PDF Studio, Universal Converter, Hash Checksum, or QR Studio). Ensure zero `document.paste` listener leak across route changes.
- [ ] **Step 4: Run `tsc`, syntax checks & Vitest**
  Run:
  `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
  `rtk err node --check src/utilities/driveSaveHelper.js src/utilities/toolHandoff.js src/pages/StoragePage.js src/components/tools/converter/components/ConverterResult.js src/components/tools/converter/hooks/useConverterDom.js src/components/tools/converter/ConverterWorkspace.js src/components/tools/pdf/components/ResultCard.js src/components/tools/pdf/hooks/usePdfDom.js src/components/tools/archive/components/ArchiveCompressPane.js src/components/tools/archive/ArchiveCompressWorkspace.js src/components/tools/viewsplit/components/ViewSplitToolbar.js src/components/tools/viewsplit/hooks/useViewSplitDom.js src/components/tools/MarkdownEditor.js src/components/history/HistoryItemRow.js src/pages/HistoryPage.js src/components/tools/facebook/FacebookWorkspace.js src/components/tools/instagram/InstagramWorkspace.js src/components/tools/hash/HashStudio.js`
  `rtk vitest run --root server tests/unit/storage_save_artifact.test.ts` -> expected PASS.
- [ ] **Step 5: Commit**
  `git add server/src/api/routes/storage.route.ts server/src/api/controllers/storage.controller.ts server/tests/unit/storage_save_artifact.test.ts src/utilities/driveSaveHelper.js src/utilities/toolHandoff.js src/pages/StoragePage.js src/components/tools/ src/components/history/ src/pages/HistoryPage.js` -> `rtk git commit -m "feat(drive,workflow): add auth-gated save-artifact Drive flow, expanded empty states, Ctrl+V paste, and tool handoffs"`

---

## Final Cross-Phase Verification, Playwright UI Audit & KI Sync

Before concluding the overhaul execution:

1. **Rebuild Production Assets & Typecheck:**
   - `npm run build:shell && npm run build:css`
   - `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`
   - `rtk npm --prefix server run build`
   - `rtk err python -m py_compile engines/document/markdown_to_docx.py`
2. **Affected & All Overhaul Unit Tests (`Vitest`):**
   - `rtk vitest run --root server tests/unit/battery_optimization.test.ts tests/unit/share_target_queue.test.ts tests/unit/tool_lazy_loader.test.ts tests/unit/media_url_cache.test.ts tests/unit/instagram_service.test.ts tests/unit/facebook_service.test.ts tests/unit/viewsplit_dirty_render.test.ts tests/unit/hash_streaming.test.ts tests/unit/ui_hygiene.test.ts tests/unit/qr_universal_style.test.ts tests/unit/academic_stream_guard.test.ts tests/unit/markdown_export.test.ts tests/unit/storage_save_artifact.test.ts`
3. **Android Build Check:**
   - `.\android\gradlew.bat -p android testDebugUnitTest assembleDebug`
4. **Live Playwright UI & Runtime Battery Audit (`360x740`, `390x844`, `1280x800` Light & Dark modes):**
   - Verify uncached dashboard script count (`~12–18` vs prior `207`) and zero broken CSS/preloads/console errors.
   - Verify `0px` horizontal overflow (`scrollWidth <= innerWidth`) across Header, Dashboard, Storage, ViewSplit, QR Studio, Markdown, and Academia.
   - Verify `>=44px` tap targets on Header controls, Storage 2-row toolbar, ViewSplit Top Bar Loupe, and TikTok mobile paste button.
   - Verify ViewSplit Loupe HUD renders cleanly above `BottomNav` with no collapsed bottom-right floating orb.
   - Verify ViewSplit idle `requestAnimationFrame` count = `0` when stationary, Dashboard visible cards retain 10-Tier RPG visuals in Light & Dark modes, and `.tier-offscreen` / `.ds-animations-paused` toggle cleanly.
5. **Quarantine & Knowledge Base Sync:**
   - Verify `git diff --name-only` shows ZERO modifications in `src/components/tools/studocu/**` or `server/src/services/studocu/**`.
   - Sync `docs/GOTCHAS.md` and `docs/knowledge-base/` (`README.md` + new/updated KI entries covering static Tailwind CSS build requirement, `AndroidBridge.notifyAppReady()` + single-consume Share protocol, and Facebook split DASH muxing) and commit `docs/`.
