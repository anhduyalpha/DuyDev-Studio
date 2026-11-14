# DuyDev Studio — Comprehensive Overhaul Design Spec

**Date:** 2026-11-14  
**Scope:** Combined 4-track overhaul covering Android APK lifecycle/boot stability, Instagram & Facebook downloader speed/reliability, web runtime performance & battery efficiency, and mobile UI/feature completion.

---

## 1. Intent, Goals, Non-Goals & Anti-Goals

### Goals
1. **Track 1 — Android APK & Cold Boot:** Eliminate unresponsive/"frozen" WebView UI states on cold launch, deep-background resume, and external Share intents; eliminate back-to-back Share failures; cut uncached cold-start time sharply while keeping **0% background battery drain**.
2. **Track 2 — Instagram & Facebook Downloader:** Reduce typical public link extraction latency from 5–20s to ~0.5–3s and fix intermittent extraction misses (including `/share/r/`, `/share/v/`, modern DASH-only Facebook videos/Reels, and Instagram Reels/Posts/Carousels) **automatically without requiring user-pasted cookies**.
3. **Track 3 — Web Runtime Performance & Battery:** Remove continuous CPU/GPU waste across Dashboard, ViewSplit, Admin, Markdown, Hash, PDF, and Storage while keeping visible **10-Tier RPG card effects 100% visually intact**.
4. **Track 4 — UI Polish, Mobile Layout & Feature Gaps:** Apply approved **Option C** mobile layouts (2-row Storage toolbar + Top-Bar ViewSplit Loupe toggle), enforce `>=44px` touch targets, remove AI-slop copy/parentheticals, add universal **Save to Drive** & **Academia/ResearchGate Direct Download**, **Hash MD5 + streaming**, **QR styling across all tabs**, **Markdown `.docx`/direct `.pdf`/open `.md`**, Drive empty-state launchers, and `Ctrl+V` / cross-tool handoffs.

### Non-Goals & Anti-Goals
- **Hard Boundary (`AGENTS.md`):** **NEVER** modify any file under `src/components/tools/studocu/**` or `server/src/services/studocu/**`.
- **Architecture Boundary:** Keep **zero-build Vanilla ES Modules** on frontend (no Vite/Webpack bundling, no framework rewrite). Only Tailwind CSS compiles ahead-of-time into a static stylesheet.
- **Battery Anti-Goal:** Do NOT keep WebView timers active in background, add wake-locks, foreground keep-alive services, or background heartbeat polling to simulate instant resume. Deep-freeze stays active in background.
- **No Cookie Management UI:** Do NOT add Instagram/Facebook cookie paste forms in Admin/UI. Extraction must work cookieless out of the box (server operators retain optional `.env` cookie file support for `yt-dlp` only as a silent fallback).

---

## 2. Track 1 — Android APK Lifecycle, Share Recovery & Fast Cold Boot

### 2.1 Zero-Freeze Splash Handoff & Boot Watchdog
- **Native Splash Hold (`android/.../MainActivity.kt`):**
  - Remove immediate `hideSplashOverlay()` from `onPageCommitVisible()`.
  - Keep `splashOverlay` visible until JS invokes `AndroidBridge.notifyAppReady()` (called inside `src/app.js` `init()` right after `ds:app-ready` / initial route mount & handlers attach).
  - Add a native `Handler` watchdog (default `7000ms` — **`[Author's call]`**): if `notifyAppReady()` has not arrived (or network fails), reveal a native error/retry action button inside the splash overlay instead of dropping the user onto an unclickable HTML shell.
- **HTML Boot Watchdog Fix (`index.html`):**
  - Current checks (`!app.querySelector('main')`) never fire because SSR `#appInstantShell` contains `<main id="mainContent">`.
  - Replace the check with an explicit hydration marker `window.__DS_APP_HYDRATED === true` set at end of initial `src/app.js` route mount (after `#appInstantShell` replacement). If module load throws or stays unhydrated after `7000ms`, render the existing emergency recovery overlay cleanly.

### 2.2 Zero-Battery Freeze + Instant Resume & Share Self-Healing
- **Preserve Deep Freeze (`MainActivity.kt`):** Keep `onPause()` (5s grace window) and `onStop()` -> `executeDeepFreeze()` (`webView.onPause()`, `webView.pauseTimers()`, dispatch `'ds:native-app-paused'`).
- **One-Shot Liveness Probe on Foreground/Share (`MainActivity.kt`):**
  - When `onResume()` (after returning from frozen/paused state) or `onNewIntent()` executes `ensureWebViewActive()`, post ONE lightweight JS probe (`evaluateJavascript("window.__dsAlivePing?.()", ...)` with a `350ms` timeout — **`[Author's call]`**, no recurring timers).
  - *If JS responds `'ok'`:* deliver pending Share/route immediately without reload.
  - *If JS times out or WebView is dead/unresponsive (`onRenderProcessGone` or silent renderer stall):* briefly show `splashOverlay`, call `webView.reload()` (or `loadUrl(targetUrl)` preserving pending `AndroidBridge.sharedPayloadJson`), then execute Share/route upon `notifyAppReady()`.
- **`savedInstanceState` Null-Safe Restore (`MainActivity.kt`):**
  - Check return value of `webView.restoreState(savedInstanceState)`; if `null` (or `webView.url` is null/`about:blank`), fall back to loading primary host (`getActiveHost()`) + defer `handleIntent` until ready instead of evaluating JS before load.

### 2.3 Atomic Native Share Queue & Intent Fixes
- **Eliminate Early Consume Race (`index.html`, `src/utilities/shareTargetHelper.js`, `src/components/common/ShareTargetModal.js`):**
  - Do NOT call `window.AndroidBridge.clearSharedPayload()` during early poll (`pollPendingSharedData`).
  - Only read via `peekPendingSharedPayload()` until `openShareTargetModal(payload)` confirms `#shareTargetPanel` is mounted in DOM **or** user dispatches/closes the modal; provide an idempotent `consumePendingSharedPayload(payloadId)` guarded against concurrent reads (`index.html` fast-path vs `app.js` Share handler vs `'ds:native-share-arrived'`).
- **Back-to-Back Share & Route Trigger (`MainActivity.kt` `onNewIntent`):**
  - When `isAppLoaded` is true and target hash equals current `window.location.hash` (e.g. `#share-target` triggered twice in a row), explicitly dispatch `window.dispatchEvent(new CustomEvent('ds:native-share-arrived'))` and force Share re-open instead of relying on no-op `window.location.hash = ...`.
  - Add `academia.edu` and `researchgate.net` to `isSpecializedLink` and `toolId` mapping inside `MainActivity.kt` `handleIntent()`, and ensure `'academia'` / `'researchgate'` IDs work identically with `smartUrlRouter.js` auto-start handoffs.
- **Non-Blocking Onboarding (`src/app.js`):**
  - **`[Author's call]`:** Never auto-open `ProfileModal` (`checkAndPromptOnboardingProfile`) during `#share-target`, Share deep-links, or cold Android APK launches; show a subtle indicator dot on Header profile icon so onboarding never blocks first tap or Share flow.

### 2.4 Sub-1s Web Cold Boot & Serving Architecture
- **Pre-Built Static Tailwind CSS (`index.html`, `package.json`, `scripts/generate-instant-shell.mjs`, `.gitignore`):**
  - Replace `<script src="https://cdn.tailwindcss.com"></script>` and inline runtime `tailwind.config` in `index.html` with a pre-built minified stylesheet `src/styles/tailwind.generated.css` generated from a `tailwind.config.js` preserving 1:1 `darkMode: 'class'`, custom `xs: 420px`, spacing `7.5`/`8.5`, `brand` colors, `fadeIn`/`shimmer` animations, and scanning `index.html` + `src/**/*.js`.
  - **`[Author's call]`:** Commit `src/styles/tailwind.generated.css` to Git alongside a local `"build:css"` npm script in root `package.json` (and align `scripts/generate-instant-shell.mjs` + regenerated `index.html`), keeping `scripts/deploy-prod.sh` untouched with zero root frontend build steps on homeserver deploy.
  - Add `.superpowers/` to `.gitignore`; keep Vanilla ES Modules source files completely unbundled.
- **Lazy Dynamic Tool Loading (`src/pages/ToolPage.js`):**
  - Replace the 20 eager static module imports (`ToolPage.js:12-38`) with an async loader registry (`() => import(...)`) so Dashboard initial load only fetches Dashboard + Shell (`~12–18` modules instead of `207` scripts).
  - Render a consistent tool-skeleton placeholder while the selected tool module loads; rely on native browser ES module caching for instant repeat visits. Preload `ShareTargetModal.js` only when Share flags are active or via low-priority idle hint.
- **Server Compression & Cache Alignment (`server/package.json`, `server/src/app.ts`, `sw.js`, `index.html`):**
  - Add `@fastify/compress` (Brotli + Gzip) registered in `server/src/app.ts`.
  - **`[Author's call]`:** APK keeps zero bundled static web assets (`MainActivity.kt` `shouldInterceptRequest` continues intercepting `/__android_share_file__/` only). Align query-versioned assets (`?v=XX.XX`) across `index.html`, `sw.js` `CACHE_NAME` & `ASSETS_TO_PRECACHE`, and `server/src/app.ts` static headers; fix mismatched `modulepreload` URL warnings (`app.js?v=...`).
  - Use ETag / conditional caching (`Cache-Control: public, max-age=0, must-revalidate` with ETag enabled for unversioned ES modules so 304 avoids re-downloading unchanged files; long `max-age` for immutable versioned assets; `no-cache` for `index.html`).

---

## 3. Track 2 — Instagram & Facebook Downloader Overhaul

### 3.1 Canonical URL Normalization, Redirect Expansion & Caching
- **Shared Redirect Pre-Resolver (`server/src/services/instagram.service.ts`, `facebook.service.ts`):**
  - Before extraction, resolve short/share URLs (`facebook.com/share/r/...`, `/share/v/...`, `/share/p/...`, `fb.watch/...`, `instagram.com/share/...`, `instagr.am/...`) via `fetch(..., { redirect: 'follow' })` or manual hop inspection (`<=5` hops, `4s` timeout).
  - Validate final target host/IP against existing SSRF guard `validateSafeMediaUrl` before proceeding.
- **In-Memory TTL Cache:**
  - Add bounded Map TTL cache (`MAX_ENTRIES = 200`, `TTL_MS = 10 * 60 * 1000` — **`[Author's call]`**) keyed by canonical URL/shortcode in both `InstagramService` and `FacebookService`. Repeated calls (`resolve` -> `download` / `saveToDrive` / retry) resolve instantaneously from memory unless cache entry is stale.
- **Parallel Drive Duplicate Lookup (`checkExistingInDrive`):**
  - Replace sequential `for` file reads over `.meta.json` sidecars with bounded concurrent checks (`batch size = 8`, early return on first match).

### 3.2 Instagram Cookieless Multi-Tier Extraction (`instagram.service.ts`)
- **Tier 1A — Embed HTML Hydration (`4.5s` timeout):**
  - Fetch `https://www.instagram.com/p/{shortcode}/embed/captioned/` (and `/reel/{shortcode}/embed/` for `/reel/` URLs) with desktop browser headers (`Accept-Language`, clean `Sec-Fetch-*` headers) and extract embedded JSON (`gql_data` / `shortcode_media` / context JSON) + `<video>`/`<img>` fallback nodes covering single video, single image, and carousels (`edge_sidecar_to_children`).
- **Tier 1B — Anonymous Web GraphQL / Public JSON (`4.5s` timeout):**
  - Run concurrently or fast-cascade with Tier 1A against Instagram's anonymous web endpoints (extract `lsd`/csrf from embed/page HTML or query public GraphQL `doc_id` with `X-IG-App-ID: 936619743392459`), returning first valid `InstagramVideoData`.
- **Tier 1C (Optional API):** Preserve `RAPIDAPI_KEY` tier if environment key is later supplied.
- **Tier 2 — Hardened `yt-dlp` Fallback (`22s` timeout):**
  - Executed only if Tier 1 yields no direct media; pass `--no-playlist`, `--socket-timeout 12`, `--retries 2`, `--no-warnings`, `--no-check-certificates` (plus silent `IG_COOKIES_FILE` support if operator manually sets one in `env`).

### 3.3 Facebook Fast-Race & DASH Extraction (`facebook.service.ts`)
- **Fast-Race Extraction (`Promise.any` across endpoints, `5.5s` per source):**
  - Expand URL canonical host first, then race: (a) Desktop Comet HTML (`www.facebook.com`), (b) Mobile/Basic HTML (`m.facebook.com` / `mbasic.facebook.com`), and (c) Public Video Plugin Embed (`https://www.facebook.com/plugins/video.php?href=...` — effective for Reels & Watch links) via **`Promise.any`** rejecting sources that produce no usable media rather than blocking up to 10s on `Promise.allSettled`.
- **Full DASH Stream Support (`facebook.service.ts:483-504, 609-611`):**
  - Stop discarding Comet results when legacy `browser_native_hd_url` / `playable_url` are absent on video/Reel links!
  - Parse `dash_manifest_xml_string` (MPD XML `<AdaptationSet mimeType="video/...">` and `<AdaptationSet mimeType="audio/...">`, picking highest bandwidth `<BaseURL>`) alongside existing progressive URLs.
  - Progressive MP4 URLs keep direct low-latency `proxyStream` piping.
  - **`[Author's call]`:** For DASH-only formats (e.g. `1080p`/`720p` split video+audio), register an opaque short-lived **server-side token** (`Map<tokenId, { videoUrl, audioUrl, expiresAt }>` in `FacebookService`) returned as `dashToken` in `formats` metadata so client does not pass unvalidated external dual URLs directly; `proxyStream` / `saveToDrive` checks `validateSafeMediaUrl` on both URLs and streams/saves a clean MP4 muxed via `ffmpeg -c copy` (`-movflags frag_keyframe+empty_moov` for streaming, `-movflags +faststart` for Drive files).
- **Tier 2 — Hardened `yt-dlp` Fallback:** Receives canonical resolved URL (`--no-playlist`, `--socket-timeout 12`, `--retries 2`, optional silent `FB_COOKIES_FILE` if configured).

---

## 4. Track 3 — Web Performance, Compositor & Battery Efficiency

### 4.1 Dashboard & 10-Tier Card Optimization (100% Visual Parity)
- **Visual Invariant:** Every visible card on screen MUST keep identical colors, gradients, borders, glows, particles, and continuous infinite animations in both Light and Dark modes.
- **Compositor Pruning (`src/styles/card-tiers-10.css`, `src/styles/stitch-tokens.css`):**
  - Remove redundant child `will-change` / `transform: translateZ(0)` promotions on static inner wrappers where the parent tier layer already promotes, reducing mobile GPU texture memory without altering visual pixels.
  - Keep `.glass-dock`/`.glass-panel` appearance while trimming excessive `will-change` hints outside active animations.
- **3-Signal Lifecycle Animation Pause (`src/components/dashboard/DashboardPage.js`, `src/app.js`):**
  - Pause offscreen cards via `IntersectionObserver` (`.tier-offscreen`), pause globally on `document.hidden` (`visibilitychange`), AND pause on `ds:native-app-paused` (`.ds-animations-paused` root class cleared immediately on `resume` / `visibilitychange` visible!).
- **Remove 12s Background Polling (`src/hooks/useToolRegistry.js`):**
  - Delete the 12s global layout `setInterval` and drive responsive card/grid adjustments strictly from `ResizeObserver` + hash/filter re-renders.

### 4.2 ViewSplit Dirty-Render Engine & Event Coalescing (`useViewSplitDom.js`, `dragReorder.js`)
- Replace unconditional `rafId = requestAnimationFrame(renderCanvasFrame)` in `useViewSplitDom.js:448-451` with **`requestRender()`** triggered ONLY when zoom/pan/slider/loupe/pane state becomes dirty -> draws frame, updates `#viewsplit-zoom-badge-*`, clears dirty flag, and goes idle (0% CPU/GPU).
- Coalesce global `mousemove` / `pointermove` handlers (`slider`, `pan`, `loupe`) through a single `rAF` frame tick and cache container bounding boxes (`getBoundingClientRect()`) per pointer-down/resize rather than reading layout synchronously inside move events.
- Apply `rAF` batching to sibling transforms in `src/utilities/dragReorder.js:231-248`.

### 4.3 Admin Telemetry Diffing & Scoped Lucide Updates
- **Admin Dashboard (`src/pages/AdminPage.js`):**
  - Suspend telemetry polling strictly when `document.hidden` or `ds:native-app-paused` (existing guard strengthened with `visibilitychange` + native event sync).
  - Diff `memPct`, `cpuLoadPct`, `r2Pct` against last rendered snapshot before rebuilding `#adminGaugesContainer` SVG HTML.
  - Replace global `window.lucide.createIcons()` in poll ticks (`line 1529`) with scoped `window.lucide.createIcons({ root: targetContainer })` only inside containers whose markup changed.
- **All Other Modules (`StoragePage.js`, `useQuizListeners.js`, `ServerPage.js`, `ArchivePage.js`, `ScribdWorkspace.js`, `YoutubeWorkspace.js`, `usePdfDom.js`, `TiktokWorkspace.js`):**
  - Pass `{ root: containerEl }` to all `window.lucide.createIcons(...)` calls and eliminate duplicate back-to-back calls inside `StoragePage.loadDirectory()`.

### 4.4 Markdown, Hash Streaming & PDF Layer Optimization
- **Markdown (`src/components/tools/MarkdownEditor.js`):** Debounce editor `input` parsing & `localStorage` writes (`180ms` **`[Author's call]`**); ensure `save` / `export` flushes latest editor state synchronously without waiting on timer.
- **Hash (`src/components/tools/hash/HashStudio.js`, `useHashActions.js`):**
  - Debounce text hashing (`150ms`).
  - Eliminate full-file OOM (`await file.arrayBuffer()`): implement **4MB chunked slice reader** (`file.slice(offset, end).arrayBuffer()`). Compute incremental pure-JS **MD5** across all file sizes, and **`[Author's call]`** use Web Crypto `crypto.subtle.digest` fast-path for SHA-1/256/512 when `file.size < 100 * 1024 * 1024` (100 MB) and pure-JS incremental streaming SHA-1/256/512 (zero external runtime dependency) with live progress percentage updates for files `>= 100 MB` (or small WASM/JS worker if needed — keep main thread responsive by yielding or Web Worker).
- **PDF Studio (`src/components/tools/pdf/components/PdfPreviewCanvas.js`):** Remove `backdrop-blur-sm` from per-page `.btn-preview-page` overlay (`bg-black/65 hover:bg-black/85` crisp fill instead, eliminating 50–200 blur layers on large PDFs).

---

## 5. Track 4 — Mobile UI (Option C), Ergonomics, Copy Polish & Feature Suite

### 5.1 Approved Mobile UI Layouts (Option C)
- **Storage Mobile Toolbar (`src/pages/StoragePage.js`):**
  - Restructure right-side toolbar into 2 ergonomic rows on `<640px` (`sm:flex-row` desktop layout preserved cleanly):
    - **Row 1:** Search `#inputStorageSearch` (`flex-1 min-w-0 min-h-[44px]`), **Tải lên** (`min-h-[44px]`), **Thư mục mới** (`min-h-[44px]`).
    - **Row 2:** Horizontal scrollable rail (`overflow-x-auto flex items-center gap-1.5`) containing Sort select, Grid/List toggle, Select All, Refresh, Lock — every tap target `min-h-[44px] min-w-[44px]` (`px-3`), zero awkward wrapping.
- **ViewSplit Loupe Relocation (`ViewSplitPixelInspector.js`, `ViewSplitToolbar.js`):**
  - Remove the collapsed floating bottom-right button in `ViewSplitPixelInspector.js:17-28` (`!inspectorOpen` returns `''`) so nothing overlaps `BottomNav`.
  - Keep Top Bar `Loupe` toggle (`ViewSplitToolbar.js:209-221`) always visible cleanly (`min-h-[44px] px-2.5`) with clear `zoom-in` icon + compact label/tooltip.
  - Anchor open `#viewsplit-pixel-inspector-hud` at `fixed bottom-24 sm:bottom-4 right-3 sm:right-4 z-40 w-[min(320px,calc(100vw-24px))]` so it stays cleanly above mobile `BottomNav` and within `360px` viewports.

### 5.2 Touch Targets, Chrome Accuracy & Copy Hygiene
- **Header & Shell (`src/components/layout/Header.js`, `scripts/generate-instant-shell.mjs`, `index.html`):**
  - Enforce `min-w-[44px] min-h-[44px]` (`w-11 h-11`) across all 6 right-side Header controls (Mobile Search, Storage, Trash, Sound [double-click Admin], Theme, Profile) and the left brand link.
  - On ultra-narrow viewports `<420px` (`hidden xs:inline`), hide the `"DuyDev Studio"` wordmark text (showing logo icon only) and render Profile compactly (icon/avatar only `<420px`, full name pill `>=420px`) with tight container padding so all controls fit cleanly on `360x740` with `0px` horizontal overflow; update TikTok paste button to `min-h-[44px]` on mobile.
  - Replace hardcoded `"Tìm kiếm trong 21 công cụ..."` with dynamic visible tool count from `useToolRegistry.js`.
- **Footer (`src/components/layout/Footer.js:11`):** Fix `"mụi người dùng"` -> `"mọi người dùng"`.
- **Copy Cleanup (`KI-CON-001`):**
  - `useQuizListeners.js:35-52`: replace chatty/cutesy progress lines (`"...cho bạn nè..."`, `"...xinh lung linh..."`, `"Ten ten!"`) with crisp, professional Vietnamese stage descriptions (`"Đang khởi tạo và kiểm tra tài liệu nguồn..."`, `"Đang dàn trang A4 và xuất PDF..."`, `"Bộ đề thi và đáp án đã sẵn sàng."`).
  - `YoutubeWorkspace.js:426`: change `"Âm thanh (Audio)"` -> `"Âm thanh"`.
  - PDF `ConfigPanel.js:172`: remove `(Tùy chọn)` -> `"Dải trang chuyển đổi"`.

### 5.3 Feature Completion & Cross-Tool Workflow
1. **Hash MD5 Support (`HashStudio.js`, `useHashActions.js`):** Compute & display `MD5` card alongside `SHA-256`, `SHA-1`, `SHA-512` for both text & streaming files; include `MD5` in hash checksum match verification.
2. **QR Studio Universal Styling (`QrStudio.js`, `QrPreviewCard.js`, `useQrActions.js`, `server/src/services/qr.service.ts`):**
   - **`[Author's call]`:** Unify all 5 creation tabs (`url`, `vietqr`, `wifi`, `vcard`, `text`) on client-side `window.QRCodeStyling` (`src/vendor/qr-code-styling.js`) rendering `renderQrStylePanel(styling)` (colors, dots, corners, center logo) with live preview updates and consistent SVG/PNG export; merge/replace redundant classic `QrActionControls` fields cleanly. Backend continues computing canonical VietQR EMVCo TLV+CRC16 payload strings and retains `POST /api/v1/qr/generate` for payload/API compatibility.
3. **Direct Device Download on Academia & ResearchGate (`AcademiaWorkspace.js`, `ResearchgateWorkspace.js`, `academia.service.ts`, `researchgate.service.ts`):**
   - Add `"Tải về máy"` beside `"Lưu vào Studio Drive"`, wired to `GET /api/v1/academia/stream?url=...&download=true&filename=...` and `GET /api/v1/researchgate/stream?url=...&download=true&filename=...`.
   - **`[Author's call]`:** Disable `"Tải về máy"` (with clear unavailable state) whenever resolved `pdfUrl` is absent rather than falling back to `originalUrl`. Update `proxyStream` in both services to safely allow/follow validated OpenAlex/Unpaywall OA HTTPS PDF redirects (enforcing SSRF IP/port rules and rejecting `text/html` upstream Content-Type responses so broken HTML-as-PDF downloads never occur).
4. **Markdown Docs Full Upgrade (`MarkdownEditor.js` + `server/` + `engines/document/`):**
   - **Open `.md` File:** Add toolbar button supporting local `.md`/`.txt` picker (`<input type="file">`) AND "Mở từ Drive" (available once Storage session is unlocked; prompts unlock if locked).
   - **Sync Scroll & Keyboard Shortcuts:** Add `Ctrl/Cmd+B` (bold), `Ctrl/Cmd+I` (italic), `Ctrl/Cmd+S` (quick download/save `.md`), and proportional editor<->preview sync scroll toggle (`[Author's call]`: on by default).
   - **Real `.docx` & Direct `.pdf` Export:** Add backend route `POST /api/v1/markdown/export` (`format: 'docx' | 'pdf'`, `markdown`, `filename`):
     - `docx`: new Python helper `engines/document/markdown_to_docx.py` using existing `python-docx` (`requirements.txt`) preserving headings, bold/italic/inline code, lists, tables, blockquotes, and fenced code blocks.
     - `pdf`: **`[Author's call]`** render clean print-ready HTML -> PDF via Headless Chromium if present or existing `LibreOffice` pipeline (`engines/document/office_converter.sh`), returning a downloadable `.pdf` (`FileRecord` ID) so Android APK/mobile never relies on broken `window.print()`. Register generated file in `History` + support "Lưu vào Drive" (requires unlocked Storage).
5. **Universal "Lưu vào Drive" — Storage-Auth Gated (`Converter`, `PDF Studio`, `Archive Compress`, `ViewSplit`, `Markdown`, `History`):**
   - Add `"Lưu vào Drive"` button on completed output cards (`ConverterResult.js`, `ResultCard.js`, `ArchiveCompressPane.js`, `ViewSplitToolbar.js` composite export / result action, `MarkdownEditor.js`, `HistoryItemRow.js`).
   - **Security & Auth Policy (User Decision):** Protect `POST /api/v1/storage/save-artifact` under existing `storageAuthGuard` (`storage.route.ts`), and keep `GET /api/v1/storage/download` strictly Admin-PIN-gated for `/pdf`, `/converted`, `/archives`, `/images`, `/documents` (only existing `/slideshare/`, `/academia/`, `/researchgate/` whitelist remains unauthenticated).
   - Frontend checks active Storage session token before calling `save-artifact`; if locked, open existing Storage Admin unlock modal and resume save automatically once unlocked. Non-admin History items keep downloading/previewing via temporary job `fileId` URLs (`/api/v1/files/download/:fileId` / `/view/:fileId`); items saved into protected Drive folders prompt Storage unlock if accessed while locked unless their temporary `fileId` remains valid.
   - Server validates `fileId` against Prisma `FileRecord` OR small generated multipart upload (ViewSplit PNG / Markdown DOCX/PDF), writes safely into sanitized category folders (`/pdf`, `/converted`, `/archives`, `/images`, `/documents`) via `StorageManager.sanitizeSafePath`, writes `.meta.json`, invalidates stats cache, and handles overwrite/duplicate naming cleanly.
6. **Expanded Drive Folder Empty States (`StoragePage.js`):**
   - Generalize empty-state quick launcher beyond `/youtube` and `/tiktok` using a clean config map covering `/facebook`, `/instagram`, `/spotify`, `/scribd`, `/slideshare`, `/academia`, `/researchgate`, `/pdf`, `/converted`, `/archives`, `/documents`.
7. **Global `Ctrl+V` Paste & Cross-Tool Handoffs:**
   - Inside `ConverterWorkspace`, `FacebookWorkspace`, `InstagramWorkspace`, `HashStudio`: handle `document` `paste` when focus is outside `<input>`/`<textarea>` to auto-populate pasted link or dropped file.
   - Add lightweight cross-tool send-to-module actions (e.g., History item / Downloader / PDF / Converter result -> open in `ViewSplit`, `PDF Studio`, `Universal Converter`, `Hash Checksum`, or `QR Studio` via existing `smartUrlRouter.js` / in-memory file handoff registry).

---

## 6. Verification Expectations (For Implementation Planning)
- **Automated Checks:** Typecheck (`tsc --noEmit`), existing + new Vitest unit tests (IG/FB DASH/Embed/cache unit tests, `/api/v1/markdown/export`, `/api/v1/files/save-to-drive`, `shareTargetHelper` peek/consume), Python compile/tests (`py_compile` + `markdown_to_docx.py`), frontend `node --check` on touched JS modules, Android `./gradlew assembleDebug` (or Kotlin compile check if SDK/gradle wrapper present).
- **Runtime / UI Audit:** Playwright mobile (`360x740`, `390x844`) & desktop (`1280x800`) verification in both Light & Dark modes confirming zero horizontal overflow, `>=44px` Header/Storage/ViewSplit touch targets, no Loupe/BottomNav overlap, 0% idle `requestAnimationFrame` work in ViewSplit, `ds:native-app-paused` / offscreen tier animation pause, and cold-boot timing reduction.
- **KI Sync:** Update `docs/GOTCHAS.md` / `docs/knowledge-base/` post-implementation (`Tailwind static CSS build step`, `AndroidBridge notifyAppReady + single-consume Share protocol`, `Facebook DASH mux`).
