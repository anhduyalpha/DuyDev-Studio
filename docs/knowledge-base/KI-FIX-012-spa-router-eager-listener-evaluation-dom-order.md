---
id: KI-FIX-012-spa-router-eager-listener-evaluation-dom-order
title: "Khắc Phục Lỗi Tê Liệt Tương Tác Giao Diện Do Eager Parameter Evaluation Trong SPA Router"
type: troubleshoot
status: verified
domain: frontend
tags: [spa, routing, dom-events, event-listeners, eager-evaluation, vanilla-js, pwa]
created_at: 2026-09-23
updated_at: 2026-09-23
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Người dùng không thể bấm chuyển tab trong module (ví dụ: các tab trong module PDF không nhận sự kiện click), kéo thả tệp không phản hồi, hoặc nút bấm hoàn toàn tê liệt sau khi điều hướng route."
search_queries:
  - "Lỗi không bấm được các tab trong module PDF"
  - "Event listeners not attaching in vanilla SPA router"
  - "Eager evaluation in setView causes null getElementById"
  - "attachListeners runs before innerHTML is assigned"
  - "Bây giờ các tool trong module pdf không truy cập được nữa"
related_kis:
  - KI-FIX-011-runtime-reference-errors-vanilla-esmodules-render
  - KI-CON-002-native-zero-iframe-tool-module-integration
---

# [KI-FIX-012] Khắc Phục Lỗi Tê Liệt Tương Tác Giao Diện Do Eager Parameter Evaluation Trong SPA Router

## 1. Context & Purpose
Trong kiến trúc Single Page Application (SPA) viết bằng Vanilla ES Modules (không dùng React/Vue), việc chuyển đổi trang thường được thực hiện qua hàm điều phối Router:
1. Tạo chuỗi HTML giao diện (`renderXxxPage()`).
2. Gán chuỗi HTML vào vùng chứa chính (`mainContainer.innerHTML = htmlContent`).
3. Gắn các bộ lắng nghe sự kiện (`attachXxxListeners()`) vào các phần tử DOM vừa tạo.

Nếu hàm `setView(content, attachFn)` nhận đối số thứ hai là kết quả thực thi trực tiếp của hàm gắn sự kiện (`attachXxxListeners(...)`), trình thông dịch JavaScript sẽ **đánh giá đối số trước khi thực thi thân hàm** (Eager Argument Evaluation). Kết quả là hàm gắn sự kiện chạy khi DOM mới chưa được render, dẫn đến toàn bộ nút bấm, tab và dropzone bị tê liệt hoàn toàn.

---

## 2. Root Cause Analysis

### Bẫy Eager Evaluation Trong Lời Gọi Hàm JavaScript
Xét đoạn mã điều hướng trong `src/app.js`:

```javascript
// ❌ SAI LẦM: attachToolPageListeners() được gọi TRƯỚC KHI setView() bắt đầu chạy!
const setView = (content, cln = null) => {
  mainContainer.innerHTML = content;
  cleanup = cln;
};

const dispatchTool = (id, sub = null) => {
  setView(
    renderToolPage(id, sub), 
    attachToolPageListeners(onSoftReRender) // <--- THỰC THI NGAY TẠI ĐÂY!
  );
};
```

### Cơ chế lỗi từng bước:
1. Trình duyệt chuẩn bị gọi hàm `setView(arg1, arg2)`.
2. Trình duyệt thực thi `arg1`: `renderToolPage(id, sub)` $\to$ trả về chuỗi HTML.
3. Trình duyệt thực thi `arg2`: `attachToolPageListeners(onSoftReRender)`:
   - Hàm tìm `document.getElementById('pdfModeSelectorContainer')`.
   - Vì `mainContainer.innerHTML` vẫn là trang cũ (hoặc rỗng), phần tử này **chưa có trong DOM** $\to$ trả về `null`.
   - Không có bất kỳ sự kiện click hay kéo thả nào được gắn vào các tab hoặc nút bấm.
4. Sau khi hai đối số đã có kết quả, `setView` mới bắt đầu chạy:
   - `mainContainer.innerHTML = content` chèn cây DOM mới vào trang.
   - Nhưng toàn bộ các thẻ mới này đã bị bỏ qua bước gắn sự kiện!
5. Hậu quả: Giao diện hiển thị đầy đủ, nhưng bấm vào các tab ("Ghép PDF", "Tách trang", "Xoay trang", "Bảo mật"...) hoàn toàn không phản hồi.

---

## 3. Core Instructions / Solution

### Bước 1: Chuẩn Hóa `setView` Nhận Callback Lười (Lazy Execution)
Chuyển đổi tham số thứ hai của `setView` thành một callback hàm và chỉ kích hoạt nó **SAU KHI** đã hoàn tất việc gán `innerHTML`:

```javascript
// src/app.js
let cleanup = null;

const setView = (content, attachFn = null) => {
  // 1. Gán DOM mới vào trang trước
  mainContainer.innerHTML = isSoftUpdate ? content.replace(/\banimate-fadeIn\b/g, '') : content;
  
  // 2. Kích hoạt lazy callback để gắn sự kiện lên cây DOM vừa xuất hiện
  cleanup = typeof attachFn === 'function' ? attachFn() : attachFn;
};
```

### Bước 2: Bọc Tất Cả Lời Gọi `attachListeners` Trong Arrow Function
Tại mọi điểm dispatch route, luôn truyền arrow function `() => attach...()` thay vì gọi hàm trực tiếp:

```javascript
//  ĐÚNG: Arrow function hoãn việc thực thi cho tới khi setView() chủ động gọi nó:
const dispatchTool = (id, sub = null) => {
  setView(renderToolPage(id, sub), () => attachToolPageListeners(onSoftReRender));
};

// Áp dụng đồng bộ cho mọi route trong Router:
if (!hash || hash === '#dashboard') {
  setView(renderDashboardPage(), () => attachDashboardListeners(onSoftReRender));
} else if (hash.startsWith('#tool/')) {
  const parts = hash.replace('#tool/', '').split('/');
  dispatchTool(parts[0], parts[1] || null);
} else if (hash === '#archive') {
  setView(renderArchivePage(mode), () => attachArchivePageListeners(onSoftReRender));
} else if (hash === '#history') {
  setView(renderHistoryPage('history'), () => attachHistoryPageListeners(onSoftReRender));
} else if (hash === '#server') {
  setView(renderServerPage(), () => attachServerPageListeners());
}
```

---

## 4. Gotchas & Edge Cases

- **Cleanup Function Leakage**: Nếu `attachListeners` trả về một hàm hủy đăng ký (ví dụ `queueManager.subscribe(...)`), `typeof attachFn === 'function' ? attachFn() : attachFn` sẽ lưu hàm hủy đó vào biến `cleanup` để `cleanupCurrentView()` thu hồi đúng lúc chuyển trang, tránh rò rỉ bộ nhớ.
- **Deep-Link Sub-Route Normalization**: Khi chuyển hướng từ URL rút gọn (ví dụ `#tool/pdf-merge` sang `#tool/pdf-studio/merge`), cần đảm bảo Router phân tách `parts[1]` và gọi `setMode(subTab, true)` đồng bộ trước khi render để tab tương ứng sáng màu ngay lần tải đầu tiên.

---

## 5. Verification

1. Mở trang PDF Studio Pro (`#tool/pdf-studio`).
2. Mở Console trình duyệt, nhấp lần lượt vào các tab:
   - "Ghép PDF"
   - "Tách trang"
   - "Xoay trang"
   - "Bảo mật"
   - "Xem PDF"
3. Xác nhận giao diện khu vực cấu hình và dropzone cập nhật ngay lập tức mà không cần F5 tải lại trang.
4. Kéo thả tệp vào dropzone, kiểm tra nút bấm "Bắt đầu" chuyển từ disabled sang active.

---

## 6. Changelog
- **2026-09-23 (v1.0.0)**: Khởi tạo KI ghi nhận và xử lý triệt để lỗi eager listener evaluation làm tê liệt toàn bộ tabs trong module PDF Studio Pro.
