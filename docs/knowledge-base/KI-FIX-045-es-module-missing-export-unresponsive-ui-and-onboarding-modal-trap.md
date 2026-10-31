---
id: KI-FIX-045
title: Khắc Phục Triệt Để Hiện Tượng Đơ Toàn Bộ Web (Unresponsive UI) Do Missing ES Module Exports, Bẫy Onboarding Modal & Android Splash Click Trap
type: troubleshoot
domain: fullstack
status: verified
created_at: 2026-10-31
updated_at: 2026-10-31
version: 1.0.0
trigger_conditions:
  - Giao diện web hiển thị đầy đủ HTML pre-rendered nhưng hoàn toàn không thể click hoặc tương tác được vào bất kỳ nút bấm hay thẻ công cụ nào ("bị đơ toàn bộ rồi không bấm vào cái gì được hết mặc dù giao diện hiển thị")
  - Trình duyệt báo lỗi `SyntaxError: The requested module '...' does not provide an export named '...'` khiến toàn bộ ES module runtime dừng thực thi
  - Modal định danh hồ sơ (`ProfileModal`) với cờ `isOnboarding: true` khóa chặt màn hình với lớp phủ `fixed inset-0 z-50 backdrop-blur-2xl` mà không có nút đóng hoặc nút bỏ qua, chặn mọi pointer events
  - Lớp phủ khởi động Native Android (`splashOverlay`) bị ẩn nhưng vẫn giữ cờ `android:clickable="true"` chặn các sự kiện chạm vào WebView bên dưới
search_queries:
  - "bị đơ toàn bộ rồi không bấm vào cái gì được hết mặc dù giao diện hiển thị"
  - "SyntaxError The requested module does not provide an export named attachFacebookWorkspaceListeners"
  - "ProfileModal overlay intercepts pointer events"
  - "Android splashOverlay clickable true click trap"
tags:
  - es-modules
  - syntax-error
  - ui-freeze
  - pointer-events
  - profile-modal
  - android-webview
---

# KI-FIX-045: Khắc Phục Triệt Để Hiện Tượng Đơ Toàn Bộ Web Do Missing ES Module Exports, Bẫy Onboarding Modal & Android Splash Click Trap

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)
Sau khi triển khai bản cập nhật giao diện, người dùng báo cáo hiện tượng:
- Trang web hiển thị toàn bộ nội dung (thẻ công cụ, header, footer) nhưng **hoàn toàn đơ cứng**, không thể bấm vào bất kỳ thẻ công cụ, tab hay nút nào.
- Trên điện thoại Android, giao diện web nhìn thấy bình thường qua lớp kính mờ nhưng mọi thao tác chạm/vuốt đều bị chặn.

---

## 2. Phân tích nguyên nhân gốc rễ (Root Cause Analysis)

### 2.1. Cú pháp Import/Export bị thiếu trong Vanilla ES Modules (Fatal SyntaxError)
Trong kiến trúc Zero-Build của DuyDev Studio, các file `.js` được trình duyệt import trực tiếp qua native ES Modules mà không qua bundler (Vite hay Webpack).
Khi `ToolPage.js` được nạp:
```javascript
import { renderFacebookWorkspace, attachFacebookWorkspaceListeners } from '../components/tools/facebook/FacebookWorkspace.js';
import { renderSpotifyWorkspace, attachSpotifyWorkspaceListeners } from '../components/tools/spotify/SpotifyWorkspace.js';
```
Tuy nhiên:
- `FacebookWorkspace.js` chỉ `export class FacebookWorkspace`, hoàn toàn thiếu 2 named exports `renderFacebookWorkspace` và `attachFacebookWorkspaceListeners`.
- `SpotifyWorkspace.js` chỉ export `mountSpotifyWorkspace`, thiếu `attachSpotifyWorkspaceListeners`.

Khi trình duyệt phân tích module graph, nó phát hiện symbol không tồn tại và ném ra:
```
SyntaxError: The requested module '../components/tools/facebook/FacebookWorkspace.js' does not provide an export named 'attachFacebookWorkspaceListeners'
```
Lỗi này xảy ra ngay ở pha nạp module của `src/app.js`, khiến toàn bộ tiến trình JavaScript bị hủy ngay lập tức. Trang web chỉ hiển thị `#appInstantShell` tĩnh được pre-render từ `index.html`, nhưng không có một event listener nào được gắn kết.

### 2.2. Bẫy tương tác trong ProfileModal (Pointer Events Click Trap)
Khi người dùng chưa thiết lập hồ sơ (khách mới hoặc sau khi xóa session), `openProfileModal({ isOnboarding: true })` tự động kích hoạt.
Ở chế độ `isOnboarding: true`:
- Lớp phủ `#dsProfileModalOverlay` có thuộc tính `fixed inset-0 z-50 backdrop-blur-2xl`.
- Không render nút đóng `✕`.
- Không render nút "Để sau" hoặc "Bỏ qua".
- Sự kiện `modalOverlay.onclick` có lệnh `if (isOnboarding) return;` ngăn cản đóng modal khi nhấp ra ngoài.
Kết quả là lớp phủ vô tình chặn 100% pointer events của toàn bộ trang web.

### 2.3. Bẫy click trên Native Android Splash Overlay
Trong `android/app/src/main/res/layout/activity_main.xml`, phần tử `splashOverlay` có thuộc tính:
```xml
android:clickable="true"
android:focusable="true"
```
Khi `hideSplashOverlay()` thực hiện hoạt họa fade out (`alpha = 0f`), nếu hoạt họa bị hủy hoặc trễ, overlay hoàn toàn trong suốt nhưng vẫn chặn mọi sự kiện chạm vào `WebView`.

---

## 3. Giải pháp khắc phục (Targeted Remediation)

### 3.1. Bổ sung đầy đủ Module Exports & Tự động kiểm tra Import
Trong `FacebookWorkspace.js`:
```javascript
let activeFacebookWorkspace = null;

export function renderFacebookWorkspace() {
  return '<div id="facebookWorkspaceContainer" class="w-full"></div>';
}

export function attachFacebookWorkspaceListeners(onReRender) {
  const container = document.getElementById('facebookWorkspaceContainer');
  if (!container) return;

  if (activeFacebookWorkspace) {
    activeFacebookWorkspace.unmount();
    activeFacebookWorkspace = null;
  }

  activeFacebookWorkspace = new FacebookWorkspace(container);
  activeFacebookWorkspace.mount();

  return () => {
    if (activeFacebookWorkspace) {
      activeFacebookWorkspace.unmount();
      activeFacebookWorkspace = null;
    }
  };
}
```
Tương tự cho `SpotifyWorkspace.js`, export thêm `attachSpotifyWorkspaceListeners`.
Xây dựng script `scripts/verify_es_imports.mjs` quét toàn bộ codebase để đảm bảo mọi named import đều khớp chính xác 100% với file nguồn.

### 3.2. Mở khóa tương tác cho ProfileModal
Trong `ProfileModal.js`:
1. Luôn hiển thị nút đóng `✕` trên góc phải.
2. Bổ sung nút "Để sau" ở Step 1 cạnh nút "Tiếp tục".
3. Cho phép nhấp ra ngoài overlay để đóng modal:
```javascript
const handleDismiss = () => {
  if (isOnboarding) {
    try { sessionStorage.setItem('ds_profile_prompt_dismissed', '1'); } catch {}
  }
  closeProfileModal();
};

modalOverlay.onclick = (e) => {
  if (e.target === modalOverlay) handleDismiss();
};
```
4. Trong `src/app.js`, bỏ qua prompt nếu `ds_profile_prompt_dismissed === '1'` trong cùng phiên duyệt web.

### 3.3. Vô hiệu hóa Click Trap trên Android Splash
1. Trong `activity_main.xml`, đặt `android:clickable="false"` và `android:focusable="false"`.
2. Trong `MainActivity.kt`:
```kotlin
private fun hideSplashOverlay() {
    if (!::splashOverlay.isInitialized || splashOverlay.visibility == View.GONE) return
    splashOverlay.isClickable = false
    splashOverlay.isFocusable = false
    splashOverlay.animate()
        .alpha(0f)
        .setDuration(160L)
        .withEndAction {
            splashOverlay.visibility = View.GONE
            splashOverlay.alpha = 1f
        }
        .start()
    splashOverlay.postDelayed({
        if (::splashOverlay.isInitialized) {
            splashOverlay.visibility = View.GONE
            splashOverlay.isClickable = false
            splashOverlay.isFocusable = false
        }
    }, 300L)
}
```

---

## 4. Kiểm chứng thực tế (Verification)
- `node scripts/verify_es_imports.mjs` -> `Scan completed. Total errors: 0. All ES module named imports verified cleanly.`
- Headless Playwright Test:
  - Khởi động trang web: `App ready: True`
  - Modal onboarding xuất hiện -> Click "Để sau" -> Modal đóng ngay tức thì, overlay count về `0`.
  - Click các thẻ công cụ:
    - `#tool/facebook-downloader` -> `FB Workspace mounted: True`
    - `#tool/spotify-downloader` -> `Spotify Workspace mounted: True`
    - `#tool/instagram-downloader` -> `Instagram Workspace mounted: True`
- `rtk err node server/node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` -> Exit 0.
- `rtk vitest run` -> 100% test suites passed.
- Tri-point version đồng bộ `v24.29` trên `sw.js`, `pwa.js`, `index.html` và `releaseNotes.js`.
