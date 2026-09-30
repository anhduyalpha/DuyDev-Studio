---
id: KI-HOWTO-003-pwa-service-worker-cache-invalidation-mobile
title: "PWA Service Worker Cache Invalidation & Modular Asset Synchronization Strategy"
type: how-to
status: verified
domain: frontend
tags: [pwa, service-worker, cache-invalidation, cache-busting, mobile-webview, offline-first, deployment]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.1.0
owner: "@anhduy"
trigger_conditions: "Mobile devices continue running stale JavaScript code after server deployment, or newly added sub-modules throw 404/Cache Miss errors in PWA offline mode."
search_queries:
  - "PWA mobile không cập nhật code mới sau khi deploy"
  - "Service worker zombie cache invalidation strategy"
  - "Cache-busting for vanilla ES module PWA"
  - "Xóa cache service worker trên điện thoại"
  - "Pre-caching modular sub-components in ASSETS_TO_CACHE"
related_kis:
  - KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa
  - KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https
---

# [KI-HOWTO-003] Quy Trình Quản Lý & Làm Mới Cache Service Worker Cho Ứng Dụng PWA Trên Thiết Bị Di Động

## 1. Context & Purpose
**DuyDev Studio** hoạt động như một Progressive Web App (PWA) offline-first. Service Worker (`sw.js`) chịu trách nhiệm lưu bộ nhớ đệm (Cache Storage) toàn bộ shell ứng dụng để hỗ trợ cài đặt vào màn hình chính điện thoại và tăng tốc độ tải trang về gần 0ms.

Tuy nhiên, cơ chế **Cache-First** (`caches.match`) rất dễ gây ra hiện tượng **"Zombie Service Worker"**:
- Máy chủ đã cập nhật tính năng và sửa lỗi mới.
- Nhưng điện thoại người dùng vẫn liên tục chạy code cũ được lưu cứng trong Cache Storage của trình duyệt.
- Nếu một file lớn được bẻ nhỏ thành nhiều mô-đun con mà danh sách `ASSETS_TO_CACHE` chưa kịp khai báo, PWA sẽ bị lỗi không tải được component mới.

Tài liệu này chuẩn hóa quy trình 4 bước để đảm bảo mọi bản phát hành mới đều được đồng bộ tức thì xuống thiết bị di động.

---

## 2. Prerequisites
- Quyền truy cập tệp mã nguồn frontend: [`sw.js`](file:///sw.js) và [`index.html`](file:///index.html).
- Quyền SSH / SCP tới homeserver để cập nhật mã nguồn thực tế.

---

## 3. Step-by-Step Execution Guide (Quy Trình 4 Bước)

### Bước 1: Nâng Số Phiên Bản Cache Tại `sw.js`
Trong [`sw.js`](file:///sw.js), thay đổi hằng số `CACHE_NAME`:

```javascript
// Thay đổi lên v5.7
const CACHE_NAME = 'duydev-studio-v5.7';
```

Khi chuỗi `CACHE_NAME` thay đổi, trình duyệt sẽ nhận diện tệp `sw.js` đã bị biến đổi từng byte và lập tức kích hoạt chu kỳ cài đặt worker mới (`install` event).

---

### Bước 2: Cập Nhật Danh Sách Tệp Mô-Đun Trong `ASSETS_TO_CACHE`
Khi thực hiện tái cấu trúc chia nhỏ file theo nguyên tắc Single Responsibility & Anti-Monolith, bắt buộc phải thêm toàn bộ các tệp hook, sub-component mới vào danh sách pre-cache:

```javascript
const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/stitch-tokens.css?v=5.7',
  './src/styles/studocu.css?v=5.7',
  './src/vendor/thinking-orbs.js',
  './src/vendor/qr-code-styling.js',
  './src/app.js?v=5.7',
  './src/assets/logo-ds.svg',
  './src/assets/icon-192.svg',
  './src/assets/icon-512.svg'
];
```

---

### Bước 3: Cache-Busting Query String Trên File `index.html`
Trình duyệt di động có xu hướng giữ lại phiên bản biên dịch của module entry. Bổ sung tham số phiên bản `?v=X.X` tại thẻ link CSS và script bootstrapper trong [`index.html`](file:///index.html):

```html
<!-- CSS Tokens & Stylesheets -->
<link rel="stylesheet" href="src/styles/stitch-tokens.css?v=5.7">
<link rel="stylesheet" href="src/styles/studocu.css?v=5.7">

<!-- Main Module Bootstrapper -->
<script type="module" src="src/app.js?v=5.7"></script>
```

---

### Bước 4: Kích Hoạt Dọn Dẹp Cache Cũ (`activate` Hook) & Network-First
Đảm bảo mã nguồn trong sự kiện `activate` của `sw.js` xóa sạch các cache phiên bản trước và tự động chiếm quyền điều khiển các client đang mở (`clients.claim()`):

```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing obsolete cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});
```

Đồng thời, đối với cùng origin, sử dụng chiến lược **Network-First with Cache Fallback** để luôn lấy code mới nhất khi có kết nối:
```javascript
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
      .catch(() => caches.match(event.request))
  );
}
```

---

## 4. Emergency Mobile Cache Reset (Cơ Chế Thoát Hiểm Khẩn Cấp)

Nếu người dùng đang bị kẹt trong màn hình lỗi cũ mà không thể kéo xuống để vuốt reload:
1. **Nút bấm khẩn cấp trên UI**: Đã tích hợp nút *"Về trang chủ (Reset Cache)"* trong giao diện `boot()` của `src/app.js`:
   ```javascript
   localStorage.removeItem('ds_last_route');
   localStorage.removeItem('ds_state_qr');
   window.location.hash = '';
   window.location.reload();
   ```
2. **Thao tác thủ công trên trình duyệt di động**:
   - **Chrome Android**: Bấm vào biểu tượng ổ khóa hoặc icon điều hướng ➔ *Cài đặt trang web (Site settings)* ➔ *Xóa & đặt lại dữ liệu (Clear & reset)*.
   - **Safari iOS**: Vào *Cài đặt máy (Settings)* ➔ *Safari* ➔ *Nâng cao (Advanced)* ➔ *Dữ liệu trang web (Website Data)* ➔ Tìm `alphadaniel.io.vn` và xóa.

---

## 5. Verification
1. Triển khai code lên homeserver qua SCP:
   ```bash
   scp -r src index.html sw.js anhduy@192.168.2.171:/home/anhduy/dd-studio/
   ```
2. Kiểm tra phản hồi HTTP Header từ xa:
   ```bash
   curl.exe -sI https://duydevstudio.alphadaniel.io.vn/
   ```
3. Xác minh script version:
   ```bash
   curl.exe -s https://duydevstudio.alphadaniel.io.vn/ | Select-String "app.js"
   # Output: <script type="module" src="src/app.js?v=5.7"></script>
   ```

---

## 6. Changelog
- **2026-09-22 (v1.1.0)**: Nâng cấp chuẩn Network-First cho same-origin và cập nhật quy chuẩn cache-busting v5.7 (@anhduy).
- **2026-09-22 (v1.0.0)**: Khởi tạo Knowledge Item chuẩn hóa chiến lược làm mới cache PWA (@anhduy).
