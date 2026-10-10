---
id: KI-HOWTO-003-pwa-service-worker-cache-invalidation-mobile
title: "PWA Dual-Track Staged Caching, ETag Validation & Update Capsule Invalidation Strategy"
type: how-to
status: verified
domain: frontend
tags: [pwa, service-worker, cache-invalidation, etag-validation, dual-track-cache, update-capsule, mobile-webview, offline-first, deployment]
created_at: 2026-09-22
updated_at: 2026-10-10
version: 2.0.0
owner: "@anhduy"
trigger_conditions: "Mobile devices continue running stale JavaScript code after server deployment, PWA experiences double-reload loops, or update occurs during in-flight background uploads/tasks."
search_queries:
  - "PWA mobile không cập nhật code mới sau khi deploy"
  - "Service worker zombie cache invalidation strategy"
  - "Dual-track staged cache ETag validation Fastify"
  - "PWA update capsule non-intrusive notification"
  - "Eliminate skipWaiting reload hazard in service worker"
  - "Cache-busting for vanilla ES module PWA"
related_kis:
  - KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa
  - KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https
---

# [KI-HOWTO-003] Quy Trình Quản Lý & Làm Mới Cache Service Worker Đa Tầng (Dual-Track Staged Cache) Cho PWA

## 1. Context & Purpose
**DuyDev Studio (DS)** hoạt động như một Progressive Web App (PWA) offline-first trên Web, Desktop và Android APK Native Wrapper. Service Worker (`sw.js`) chịu trách nhiệm lưu bộ nhớ đệm (Cache Storage) toàn bộ shell ứng dụng để hỗ trợ khởi chạy tức thì (< 50ms) và làm việc không phụ thuộc mạng.

Tuy nhiên, trong các hệ thống PWA truyền thống, hai bẫy lỗi kinh điển thường xuyên xung đột:
1. **Zombie Service Worker**: Trình duyệt di động lưu cứng file trong Cache Storage hoặc HTTP disk cache 24h, khiến server deploy code mới nhưng người dùng reload mãi vẫn chạy code cũ.
2. **Skip-Waiting Hazard & Vòng lặp Reload 1-2s**: Nếu cấu hình `self.skipWaiting()` tự động khi `install` kết hợp với `controllerchange -> window.location.reload()`, trang sẽ reload bất ngờ giữa chừng, làm gián đoạn tác vụ tải file hoặc tiến trình đang xử lý của người dùng.

Tài liệu này chuẩn hóa **Kiến trúc Cache Đa Tầng (Dual-Track Staged Cache)** kết hợp **Xác thực ETag HTTP 304** và **PWA Update Capsule** (viên thuốc cập nhật kiểu Apple Sequoia), đảm bảo cập nhật code tức thì nhưng hoàn toàn không gây double-reload và không làm đứt gãy tác vụ nền.

---

## 2. Prerequisites
- Quyền truy cập tệp mã nguồn: [`sw.js`](file:///sw.js), [`index.html`](file:///index.html), [`src/utilities/pwa.js`](file:///src/utilities/pwa.js), và backend [`server/src/app.ts`](file:///server/src/app.ts).
- Đảm bảo tuân thủ **Quy tắc Tam Giác Phiên Bản (Tri-Point Version Synchronization)**: `CACHE_NAME` trong `sw.js`, tham số `?v=` trong `index.html`, và `CURRENT_PWA_VERSION` trong `pwa.js` phải luôn trùng khớp nhau (ví dụ: `v22.6`).

---

## 3. Kiến Trúc Cache Đa Tầng (Dual-Track Staged Cache Architecture)

```
Browser Request (Same-Origin Script / Style)
  ↓
Service Worker Fetch Hook [sw.js]
  ├── Navigation Mode (HTML) → Network-First with Cache Fallback
  └── Sub-resources (JS, CSS) → fetch(req, { cache: 'no-cache' })
                                  ↓
Fastify Backend Gateway [server/src/app.ts]
  ├── Unversioned JS/CSS: Cache-Control: 'no-cache, must-revalidate' + ETag: true
  │     ├── File KHÔNG đổi: HTTP 304 Not Modified (1ms, 0 byte payload)
  │     └── File ĐÃ đổi: HTTP 200 OK + Byte mới tức thì
  ├── Versioned Assets (?v=...): Cache-Control: 'public, max-age=31536000, immutable'
  └── Entry (index.html, sw.js): Cache-Control: 'no-cache, must-revalidate'
                                  ↓
Client PWA Manager [src/utilities/pwa.js]
  ├── Phát hiện Service Worker mới ở trạng thái `waiting`
  ├── Kiểm tra bảo vệ tác vụ nền: taskCoordinator.getActiveTasks().length === 0
  └── Hiển thị Capsule: "Đã có bản cập nhật mới (v22.6)" [Cập nhật] [✕]
        └── Người dùng click [Cập nhật] → Gửi postMessage({ type: 'SKIP_WAITING' }) → Safe Reload
```

---

## 4. Step-by-Step Execution Guide (Quy Trình Triển Khai & Cập Nhật)

### Bước 1: Nâng Số Phiên Bản Đồng Bộ (Tri-Point Version Bump)
Bắt buộc nâng đồng bộ 3 vị trí sau:

1. **Tại `sw.js`**:
   ```javascript
   const CACHE_NAME = 'duydev-studio-v22.6';
   
   const ASSETS_TO_PRECACHE = [
     './',
     './index.html',
     './manifest.webmanifest',
     './src/styles/stitch-tokens.css?v=22.6',
     './src/styles/studocu.css?v=22.6',
     './src/styles/highlight-theme.css?v=22.6',
     './src/app.js?v=22.6',
     './src/hooks/useToolRegistry.js',
     './src/pages/DashboardPage.js'
   ];
   ```

2. **Tại `src/utilities/pwa.js`**:
   ```javascript
   export const CURRENT_PWA_VERSION = 'duydev-studio-v22.6';
   ```

3. **Tại `index.html`**:
   ```html
   <link rel="stylesheet" href="src/styles/stitch-tokens.css?v=22.6">
   <link rel="stylesheet" href="src/styles/studocu.css?v=22.6">
   <link rel="stylesheet" href="src/styles/highlight-theme.css?v=22.6">
   
   <script type="module" src="src/app.js?v=22.6"></script>
   ```

---

### Bước 2: Cấu Hình HTTP Headers Phân Tầng Tại Backend (`server/src/app.ts`)
Loại bỏ hoàn toàn anti-pattern `no-store` toàn cục (gây hao pin 4G/5G do tải lại liên tục) và thay thế bằng phân tầng ETag thông minh:

```typescript
// Trong fastifyStatic.setHeaders:
if (pathName.endsWith('index.html') || pathName.endsWith('sw.js')) {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (pathName.endsWith('sw.js')) {
    res.setHeader('Service-Worker-Allowed', '/');
  }
} else if (reqUrl.includes('?v=') || reqUrl.includes('/vendor/')) {
  // Versioned assets có hash hoặc query ?v= -> Cache vĩnh viễn
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
} else if (pathName.endsWith('.js') || pathName.endsWith('.mjs') || pathName.endsWith('.css')) {
  // Mã nguồn ứng dụng unversioned -> Cho phép Fastify ETag trả về 304 Not Modified
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
} else {
  // Ảnh, font, icon tĩnh
  res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
}
```

---

### Bước 3: Triệt Tiêu Skip-Waiting Hazard Tại `sw.js`
1. **Tuyệt đối KHÔNG gọi `self.skipWaiting()` tự động trong `install` event**:
   Giữ worker mới ở trạng thái `installed / waiting` cho đến khi client cho phép kích hoạt.
2. **Kích hoạt có kiểm soát qua tin nhắn IPC**:
   ```javascript
   self.addEventListener('message', (event) => {
     if (event.data?.type === 'SKIP_WAITING') {
       console.log('[SW] SKIP_WAITING received from client. Activating now...');
       self.skipWaiting();
     }
   });
   ```

---

### Bước 4: Kiểm Soát Reload An Toàn Bằng PWA Update Capsule (`src/utilities/pwa.js`)
1. Lắng nghe worker ở trạng thái chờ qua `listenForWaitingWorker(reg)`.
2. Hiển thị thanh Capsule kính mờ Sequoia ở góc dưới màn hình.
3. Khi người dùng bấm `[Làm mới]`:
   - Kiểm tra tác vụ nền: nếu có upload hoặc chuyển đổi đang chạy (`getActiveTasks().length > 0`), hiển thị thông báo nhắc nhở và không reload.
   - Nếu an toàn: đánh dấu cờ `userRequestedReload = true`, gửi `SKIP_WAITING` sang worker.
4. Trong sự kiện `controllerchange`: chỉ thực hiện `performSafeReload()` khi và chỉ khi `userRequestedReload === true`.

---

## 5. Gotchas & Edge Cases

> [!WARNING]
> **Bẫy Lỗi Lặp Reload (Reload Loop)**:
> Nếu không có cờ `userRequestedReload` và `hadExistingController`, sự kiện `controllerchange` sẽ tự động trigger reload ngay khi trang vừa tải xong, tạo ra hiện tượng trang web load 1-2 giây rồi tự động reload lại tiếp tục.

> [!NOTE]
> **Khả Năng Tương Thích Offline**:
> Khi ngắt kết nối hoàn toàn, Service Worker sẽ tự động fallback về Cache Storage của phiên bản hiện tại, đảm bảo ứng dụng vẫn khởi chạy 100% không bị màn hình trắng.

---

## 6. Verification
1. **Kiểm tra cú pháp & kiểm thử tự động**:
   ```bash
   node --check sw.js
   node --check src/utilities/pwa.js
   cd server && npx vitest run tests/unit/pwa_lifecycle.test.ts tests/unit/battery_optimization.test.ts
   ```
2. **Kiểm tra phản hồi HTTP ETag 304**:
   ```bash
   # Gửi request có If-None-Match header:
   curl -sI -H "If-None-Match: \"xyz\"" http://192.168.2.171:3000/src/app.js
   # Output mong đợi: HTTP/1.1 304 Not Modified
   ```
3. **Xác minh phiên bản trực tiếp**:
   ```bash
   curl -s http://192.168.2.171:3000/ | Select-String "app.js\?v="
   # Output mong đợi: <script type="module" src="src/app.js?v=22.6"></script>
   ```

---

## 7. Changelog
- **2026-10-10 (v2.0.0)**: Đại tu toàn diện kiến trúc Cache Đa Tầng (Dual-Track Staged Cache) với Fastify ETag validation, triệt tiêu hoàn toàn Skip-Waiting Hazard, và tích hợp PWA Update Capsule bảo vệ tác vụ nền (@anhduy).
- **2026-09-22 (v1.1.0)**: Nâng cấp chuẩn Network-First cho same-origin và cập nhật quy chuẩn cache-busting v5.7 (@anhduy).
- **2026-09-22 (v1.0.0)**: Khởi tạo Knowledge Item chuẩn hóa chiến lược làm mới cache PWA (@anhduy).
