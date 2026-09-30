---
id: KI-FIX-008-mobile-horizontal-scroll-tab-snapping-reset
title: "Preventing Mobile Horizontal Tab Scroll Snapping and Jump-Backs during Navigation"
type: troubleshoot
status: verified
domain: frontend
tags: [mobile-ui, scroll-restoration, horizontal-scroll, pwa, tabs, responsive, touch-ux]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Horizontal scrollable tab bar on mobile (e.g., QR Studio tabs, Category filters) violently jumps or resets back to the first tab (scrollLeft = 0) whenever a tab is tapped."
search_queries:
  - "Thanh tabs kéo qua bấm vào tự cuộn về ban đầu"
  - "Mobile horizontal scroll tabs reset on click"
  - "Prevent scroll snapping to start on tab switch"
  - "scrollIntoView inline center smooth mobile tabs"
  - "In-place DOM update for responsive tab navigation"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa
---

# [KI-FIX-008] Khắc Phục Hiện Tượng Giật Lùi Cuộn Về Đầu Trang Khi Bấm Tab Trên Thiết Bị Di Động

## 1. Context & Purpose
Trên màn hình điện thoại (mobile viewport hẹp), các thanh điều hướng phân loại danh mục hoặc mô-đun (như thanh lọc tại Dashboard và thanh chuyển chế độ tại QR Studio) được thiết kế dạng thanh cuộn ngang `overflow-x-auto whitespace-nowrap`.

Người dùng gặp sự cố trải nghiệm: Khi vuốt sang phải để xem các tab nằm khuất (ví dụ: *Quét QR, Hệ thống, Danh bạ*), sau đó chạm ngón tay vào tab đó thì thanh tab lập tức **bị giật nảy / tự động cuộn ngược về vị trí ban đầu (tab đầu tiên)**, khiến người dùng mất phương hướng và không thấy tab mình vừa chọn đang ở đâu.

Tài liệu này ghi lại cơ chế cốt lõi gây ra hiện tượng này và giải pháp xử lý dứt điểm.

---

## 2. Root Cause (Nguyên Nhân Gốc)

### 1. Phá Hủy & Tái Tạo DOM Toàn Phần (Destructive Re-render)
Khi người dùng bấm chọn một tab:
- Trước đây, controller thường gọi lại hàm `renderCurrentView()` hoặc `parentContainer.innerHTML = renderTabs(...)`.
- Khi phần tử thanh cuộn (`#qrTabBar` hoặc `#categoryFiltersContainer`) bị gán lại `innerHTML`, toàn bộ cây DOM bên trong bị hủy và tạo mới từ đầu.
- Vị trí cuộn tự nhiên (`scrollLeft`) của phần tử trình duyệt lập tức bị đặt lại về `0`.

### 2. Thiếu Cơ Chế Neo Tâm (Scroll Centering Anchor)
Ngay cả khi không re-render toàn phần, việc chuyển đổi trạng thái active mà không có lệnh định vị cuộn tương ứng sẽ khiến tab mới được kích hoạt có thể nằm lấp lửng ngoài mép màn hình, gây khó chịu cho thao tác chạm tiếp theo.

---

## 3. Core Solution (Giải Pháp Kỹ Thuật)

### Bước 1: Cập Nhật DOM Cục Bộ Tại Chỗ (In-Place State Update)
Không bao giờ build lại toàn bộ thanh tab khi chỉ cần đổi trạng thái active. Chỉ thay đổi class giao diện giữa tab cũ và tab mới:

```javascript
// Tại Dashboard Category Filters:
document.querySelectorAll('.btn-category-filter').forEach((btn) => {
  btn.classList.toggle('active-style', btn.dataset.category === newCat);
});
// Chỉ thay đổi innerHTML cho container nội dung bên dưới (toolsGridContainer)
```

---

### Bước 2: Tự Động Căn Giữa Tab Bằng `scrollIntoView({ inline: 'center' })`
Sau khi đổi trạng thái, sử dụng `requestAnimationFrame` kết hợp với phương thức tiêu chuẩn của trình duyệt để cuộn mượt mà tab được bấm vào chính giữa tầm mắt người dùng:

```javascript
requestAnimationFrame(() => {
  const activeBtn = document.querySelector(`.btn-qr-tab[data-qr-tab="${targetTab}"]`);
  if (activeBtn) {
    activeBtn.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',    // Căn giữa theo trục ngang
      block: 'nearest'     // Giữ nguyên trục dọc, không gây giật màn hình
    });
  }
});
```

---

### Bước 3: Neo Vị Trí Khi Khởi Tạo Lần Đầu (Initial Mount Restoration)
Khi người dùng truy cập trực tiếp qua liên kết có sub-tab (ví dụ: `#qr/scan` hoặc `#tool/qr-scan`):
Tại hàm gắn sự kiện `attachQrStudioListeners()`:
```javascript
export function attachQrStudioListeners(onReRender) {
  // Tự động tìm nút tab đang active và đưa vào tâm mắt ngay khi load
  const activeBtn = document.querySelector(`.btn-qr-tab[data-qr-tab="${qrState.activeTab}"]`);
  if (activeBtn) {
    activeBtn.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  // ... Gắn các sự kiện click khác ...
}
```

---

## 4. UI/UX Specifications For Mobile Tabs
Theo tiêu chuẩn [KI-CON-001-ui-production-minimalism.md](file:///docs/knowledge-base/KI-CON-001-ui-production-minimalism.md):
- Thanh tab phải có thuộc tính CSS:
  ```css
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Ẩn thanh cuộn xấu xí trên desktop/mobile */
  ```
- Thêm lớp `scroll-smooth` trên container để thao tác cuộn tự nhiên.
- Đảm bảo padding-right và gap đủ lớn để tab cuối cùng không bị che khuất bởi mép màn hình.

---

## 5. Verification Checklist
- [x] Mở chế độ Responsive Mobile (390px - iPhone 14/15/Pixel).
- [x] Cuộn thanh tab sang tab cuối cùng (ví dụ: "Quét QR").
- [x] Chạm vào tab: Thanh tab phải giữ nguyên vị trí hoặc lướt nhẹ đưa tab đó vào giữa màn hình.
- [x] Không còn hiện tượng giật giật về tab đầu tiên.

---

## 6. Changelog
- **2026-09-22 (v1.0.0)**: Khởi tạo Knowledge Item sau khi tinh chỉnh toàn diện trải nghiệm cuộn tab ngang trên giao diện điện thoại (@anhduy).
