---
id: KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa
title: "Resolving ES Module Circular Dependency TDZ Crashes & Hardening PWA Boot Resilience"
type: troubleshoot
status: verified
domain: frontend
tags: [es-modules, circular-dependency, tdz, pwa, router, error-boundary, mobile-webview, qr-studio]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Mobile or desktop PWA fails to boot with 'Khởi động giao diện thất bại - Lỗi không xác định', reloading repeats the crash, or console shows ReferenceError: Cannot access variable before initialization."
search_queries:
  - "Khởi động giao diện thất bại Lỗi không xác định"
  - "Cannot access FILE_CATEGORIES before initialization"
  - "ES module circular dependency Temporal Dead Zone"
  - "PWA mobile boot crash reload loop"
  - "QRCodeStyling string exception app crash"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-FIX-006-clipboard-paste-validation-browser-permissions
---

# [KI-FIX-007] Xử Lý Lỗi Sập Khởi Động PWA Do Phụ Thuộc Vòng (Circular Dependency TDZ) & Nâng Cao Năng Lực Phòng Vệ Router

## 1. Context & Purpose
Trong kiến trúc Single Page Application (PWA) thuần Vanilla ES Modules của DuyDev Studio, toàn bộ ứng dụng được tải trực tiếp trên trình duyệt (desktop và mobile webview) mà không qua bundler. 

Khi người dùng mở ứng dụng trên điện thoại di động, màn hình xuất hiện thông báo lỗi nghiêm trọng:
> **Khởi động giao diện thất bại**  
> *Lỗi không xác định*  
> [Tải lại trang]

Bấm nút "Tải lại trang" không giải quyết được vấn đề mà tiếp tục lặp lại lỗi (Fatal Reload Loop).

Tài liệu này ghi lại toàn bộ quy trình chẩn đoán từ nguyên lý JavaScript Engine, cô lập nguyên nhân gốc và kiến trúc phòng vệ triệt để đã triển khai.

---

## 2. Root Cause Analysis (Phân Tích Nguyên Nhân Gốc)

### 1. Phụ Thuộc Vòng (Circular Dependency) Dẫn Tới Temporal Dead Zone (TDZ)
- Khi mô-đun hóa Universal File Viewer, hai tệp tin đã vô tình import chéo lẫn nhau:
  - [`FileViewerConnector.js`](file:///src/components/common/viewer/FileViewerConnector.js) import `openFileViewer` từ [`FileViewerCore.js`](file:///src/components/common/viewer/FileViewerCore.js).
  - [`FileViewerCore.js`](file:///src/components/common/viewer/FileViewerCore.js) lại import `FILE_CATEGORIES` từ [`FileViewerConnector.js`](file:///src/components/common/viewer/FileViewerConnector.js).
- Trong chuẩn ES6 Modules:
  - Khi trình duyệt duyệt qua cây dependency graph, nếu gặp vòng lặp `A -> B -> A`, JavaScript Engine sẽ tạo binding chưa được khởi tạo (uninitialized binding) cho `FILE_CATEGORIES`.
  - Khai báo `const` hoặc `let` nằm trong **Temporal Dead Zone (TDZ)** cho đến khi dòng code gán giá trị được thực thi.
  - Khi một mô-đun con (như `QrHistoryList.js` hoặc `DashboardPage.js`) nạp `FileViewerConnector.js`, `FileViewerCore` chạy trước khi biến `const FILE_CATEGORIES` kịp hoàn thành khởi tạo ➔ Trình duyệt quăng `ReferenceError: Cannot access 'FILE_CATEGORIES' before initialization`.

### 2. Thông Báo Bị Mặt Nạ Hóa Thành "Lỗi không xác định"
Tại hàm `boot()` trong `src/app.js`:
```javascript
} catch (err) {
  root.innerHTML = `<p>${err.message || 'Lỗi không xác định'}</p>`;
}
```
- Khi một thư viện bên thứ ba (như `qr-code-styling.js`) quăng ngoại lệ dạng chuỗi (`throw "Container should be a single DOM node"` hoặc `throw "Field 'colorStops' is required in gradient"`):
  - Chuỗi (string) trong JavaScript **không có thuộc tính `.message`** (`("string").message === undefined`).
  - Biểu thức `err.message || 'Lỗi không xác định'` lập tức rơi vào fallback `'Lỗi không xác định'`, che giấu hoàn toàn nguyên nhân thực sự khiến việc gỡ lỗi trở nên cực kỳ khó khăn.

### 3. Vòng Lặp Reload Không Thể Tự Phục Hồi (Deadlock Reload Loop)
- Router lưu tuyến đường gần nhất vào LocalStorage (`ds_last_route`).
- Nếu tuyến đường `#qr` hoặc `#tool/qr-scan` chứa một tham số bị lỗi, mỗi khi người dùng tải lại trang (`window.location.reload()`), ứng dụng lại tự động đọc lại `ds_last_route` đó và kích hoạt lại đúng khối mã lỗi, giam người dùng vĩnh viễn trong màn hình sập.

---

## 3. Core Solutions (Giải Pháp Triệt Để)

### Giải Pháp 1: Khử Triệt Để Phụ Thuộc Vòng
Đưa định nghĩa `FILE_CATEGORIES` về gốc tại [`FileViewerCore.js`](file:///src/components/common/viewer/FileViewerCore.js) và chỉ re-export một chiều tại [`FileViewerConnector.js`](file:///src/components/common/viewer/FileViewerConnector.js):

```javascript
// FileViewerCore.js (Gốc - Không import ngược từ Connector)
export const FILE_CATEGORIES = {
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  PDF: 'pdf',
  TEXT: 'text',
  FALLBACK: 'fallback'
};

// FileViewerConnector.js (Chỉ import 1 chiều)
import { openFileViewer, FILE_CATEGORIES } from './FileViewerCore.js';
export { FILE_CATEGORIES };
```
*Kết quả xác minh qua script AST Graph:* `No circular dependencies detected in src!`.

---

### Giải Pháp 2: Tường Lửa Router (Non-Crashing Error Boundary)
Bọc khối `handleRoute()` trong [`src/app.js`](file:///src/app.js) với `try / catch`. Khi một mô-đun công cụ con gặp lỗi, **không đánh sập toàn bộ khung giao diện ứng dụng (Shell)** mà chỉ hiển thị thẻ cảnh báo inline cục bộ tại vùng `#mainContent`:

```javascript
handleRoute() {
  try {
    this.cleanupCurrentView();
    // ... Render router view bình thường ...
  } catch (err) {
    console.error('[Router] Error rendering route:', err);
    const mainContainer = document.getElementById('mainContent');
    if (mainContainer) {
      const errorMsg = err?.stack || err?.message || String(err);
      mainContainer.innerHTML = `
        <div class="p-6 rounded-2xl bg-white dark:bg-[#121215] border border-red-500/30 text-center space-y-4 max-w-lg mx-auto my-12">
          <h3 class="text-red-500 font-bold text-base">Không thể hiển thị trang công cụ</h3>
          <div class="p-3 bg-zinc-100 dark:bg-black/40 rounded-xl text-left font-mono text-xs text-zinc-700 dark:text-zinc-300 max-h-40 overflow-y-auto break-all">
            ${errorMsg}
          </div>
          <button onclick="localStorage.removeItem('ds_last_route'); window.location.hash = ''; window.location.reload();" 
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
            Về trang chủ
          </button>
        </div>
      `;
    }
  }
}
```

---

### Giải Pháp 3: Cung Cấp Lối Thoát Khởi Động & Hiện Toàn Bộ Stack Trace
Nâng cấp hàm `boot()` trong [`src/app.js`](file:///src/app.js):
1. Đọc toàn diện `err?.stack || err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))`.
2. Bổ sung nút bấm **"Về trang chủ (Reset Cache)"** tự động dọn sạch `ds_last_route` và `ds_state_qr` trong `localStorage` trước khi reload, đảm bảo người dùng luôn có đường thoát khẩn cấp 100%.

---

### Giải Pháp 4: Bọc An Toàn Cho Thư Viện Đồ Họa Ngoại Lai
Thư viện `QRCodeStyling` ném lỗi dạng chuỗi nếu cấu hình gradient hoặc canvas không hợp lệ. Trong [`useQrActions.js`](file:///src/components/tools/qr/hooks/useQrActions.js):
```javascript
export function renderStyledQrToContainer(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container || !window.QRCodeStyling) return;
    // ... Khởi tạo QRCodeStyling với fallback an toàn ...
    activeStyledQr.append(container);
  } catch (err) {
    console.warn('[QR] Failed to render styled QR preview:', err);
  }
}
```

---

## 4. Verification & Prevention Checklist
- [x] Chạy script kiểm tra chu trình đồ thị import `check_cycles.mjs` trước khi release.
- [x] Tuyệt đối không import chéo giữa Core Orchestrator và Connector Adapter.
- [x] Luôn bọc các phương thức gọi thư viện đồ họa DOM ngoại lai trong `try / catch`.
- [x] Không bao giờ giả định `err` luôn là thể hiện của `Error` có thuộc tính `.message`.
- [x] Luôn cung cấp cơ chế xóa sạch `lastRoute` trong LocalStorage khi gặp ngoại lệ khởi động.

---

## 5. Changelog
- **2026-09-22 (v1.0.0)**: Khởi tạo Knowledge Item sau khi cô lập và giải quyết triệt để lỗi sập giao diện khởi động PWA (@anhduy).
