---
id: KI-CON-021
title: Kiến Trúc Tối Ưu Cold Boot (Static Tailwind v3 + Lazy ToolPage), Tiết Kiệm Pin (3-Signal Governor + Dirty ViewSplit) & Cross-Tool Drive Handoff
type: concept
domain: fullstack
status: verified
created_at: 2026-11-15
updated_at: 2026-11-15
version: 1.0.0
trigger_conditions:
  - Khi thêm utility Tailwind mới vào HTML/JS mà giao diện không nhận class do Tailwind CDN đã bị loại bỏ
  - Khi thêm tool mới vào ToolPage.js hoặc cập nhật sw.js / pwa.js / index.html tri-point cache version
  - Khi tối ưu FPS/pin cho Dashboard 10-Tier cards, Canvas ViewSplit, hoặc thêm luồng Lưu vào Drive & Chuyển công cụ
search_queries:
  - tailwind.generated.css build:css build:shell
  - duydev-studio-v25.0 tri-point sync
  - ds-animations-paused tier-offscreen idle raf zero
  - saveArtifactToDrive save-artifact toolHandoff
tags:
  - cold-boot
  - tailwind
  - battery
  - view-split
  - drive
  - handoff
---

# KI-CON-021: Static Tailwind v3, Battery Governor, QR Unified Style & Cross-Tool Handoff (`v25.1`)

## 1. Cold Boot & Tri-Point Cache Sync
- **Static Tailwind CSS**: `index.html` không dùng `cdn.tailwindcss.com`. Mọi utility class được biên dịch trước vào `src/styles/tailwind.generated.css` qua `npm run build:css`. Khi thêm class Tailwind mới ở `src/**` hoặc `index.html`, bắt buộc chạy `npm run build:css` (và `npm run build:shell` nếu sửa cấu trúc shell trong `index.html`) rồi commit file CSS đã build.
- **Tri-Point Version Sync (`duydev-studio-v25.1`)**: Ba tệp [`sw.js`](file:///sw.js), [`src/utilities/pwa.js`](file:///src/utilities/pwa.js) và [`index.html`](file:///index.html) phải luôn đồng bộ cùng chuỗi version cache (`duydev-studio-v25.1` / `?v=25.1`).
- **Zero-Network Cold Boot (`v25.1`)**:
  - Web/PWA: [`index.html`](file:///index.html) trì hoãn không chặn render với Google Fonts & tool CSS (`media="print" onload`), bật `defer` cho `lucide.min.js`, và preload các module Dashboard lõi; [`sw.js`](file:///sw.js) precache đủ 29 module boot và chuyển `navigate` + `/src/*.js,.css` sang **Stale-While-Revalidate** (`<2ms` từ CacheStorage); [`src/app.js`](file:///src/app.js) hydrate Dashboard tại chỗ (`canHydrateInPlace`) không xoá dựng lại DOM `#appInstantShell`.
  - Android APK (`versionCode = 2510` / `25.1.0`): [`DuyDevApplication.kt`](file:///android/app/src/main/java/vn/alphadaniel/duydevstudio/DuyDevApplication.kt) làm ấm Chromium `CookieManager`/`WebStorage` sớm; [`build.gradle.kts`](file:///android/app/build.gradle.kts) (`syncWebBootAssets`) đóng gói app shell tĩnh vào `assets/www/`, [`LocalBootCache.kt`](file:///android/app/src/main/java/vn/alphadaniel/duydevstudio/LocalBootCache.kt) chặn phục vụ shell từ flash cục bộ (`<1ms`, bỏ qua `/api/`, `/sw.js`, `Range` và query share) kèm đồng bộ nền sau `onAppReady()`, còn [`MainActivity.kt`](file:///android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt) ẩn tức thì `splashOverlay` ngay tại `onPageCommitVisible()`.
- **HTTP Compression**: [`server/src/app.ts`](file:///server/src/app.ts) tích hợp `@fastify/compress` (Brotli/Gzip) và tách sạch `buildApp()` khỏi `startServer()`.

## 2. Governor Tiết Kiệm Pin & Hiệu Năng Runtime
- **3-Signal Pause**: [`src/app.js`](file:///src/app.js) gắn class `ds-animations-paused` và `app-backgrounded` khi tab/WebView ẩn hoặc nhận sự kiện `ds:native-app-paused`; [`src/hooks/useToolRegistry.js`](file:///src/hooks/useToolRegistry.js) gắn `.tier-offscreen` cho card nằm ngoài viewport để chỉ giữ 100% hiệu ứng 10-Tier cho card đang hiển thị trên màn hình.
- **ViewSplit Dirty `requestRender()`**: [`src/components/tools/viewsplit/ViewSplitWorkspace.js`](file:///src/components/tools/viewsplit/ViewSplitWorkspace.js) thay thế vòng lặp `requestAnimationFrame` 60fps liên tục bằng render-on-demand (`scheduleRender`), đạt `0` lệnh rAF khi nghỉ (`idle_raf_calls_in_600ms === 0`). Loupe toggle đặt gọn lên top bar (>=44px), giải phóng góc màn hình.
- **Scoped Lucide & SVG Diff**: Mọi màn hình dùng `window.lucide.createIcons({ root })` có phạm vi container; Dashboard & Admin diff thuộc tính SVG thay vì thay toàn bộ DOM.

## 3. Tích Hợp QR, Markdown, Academic OA & Cross-Tool Drive Handoff
- **QR Unified Style**: Cả 5 tab trong `QrStudio` dùng chung `QRCodeStyling` mount vào `#qrStyledCanvasContainer` với fallback an toàn.
- **Storage PIN-Gated Save**: [`/api/v1/storage/save-artifact`](file:///server/src/api/routes/storage.routes.ts) và [`src/utilities/driveSaveHelper.js`](file:///src/utilities/driveSaveHelper.js) bắt buộc mở khóa Storage PIN (`requireAdmin()` / `getStorageAuthHeaders()`) trước khi lưu kết quả từ Markdown/Converter/PDF/Downloaders vào Drive.
- **Media SSRF Proxy & Multi-Asset Extractor**: Các downloader dùng shared [`media-url-cache.ts`](file:///server/src/services/shared/media-url-cache.ts), [`media-extractor.helper.ts`](file:///server/src/services/shared/media-extractor.helper.ts) (Cobalt/Evil0ctal optional adapters, FFmpeg `?format=mp3` transcode stream, `streamMuxedDashMp4`/`muxDashTracksToFile`, balanced JSON extraction) và [`mediaBatchHelper.js`](file:///src/utilities/mediaBatchHelper.js) (album ZIP bundle); TikTok/Douyin tích hợp tier `iesdouyin` `_ROUTER_DATA` (`/playwm/` -> `/play/`, `/note/` + Live Photo + dynamic Douyin Referer), Instagram chặn `parseEmbedHtml` hạ cấp poster `<img>` cho Reels/Videos, `tryYtdlpExtraction` ưu tiên MP4 progressive có âm thanh (kể cả format `'1'/'2'/'3'` không metadata codec) và fallback `dash://` ghép video+audio qua `ffmpeg`, đồng thời hỗ trợ tải Audio MP3 / Cover JPG / Carousel ZIP.
