# KI-FIX-040: Triệt Tiêu Nhấp Nháy Toàn Trang Khi Bấm Dropbox Lịch Sử Media Bằng In-Place DOM Mutation & Isolated History Container

---
id: KI-FIX-040
title: Triệt Tiêu Nhấp Nháy Toàn Trang Khi Bấm Dropbox Lịch Sử Media Bằng In-Place DOM Mutation & Isolated History Container
type: troubleshoot
domain: frontend
status: verified
created_at: 2026-10-27
tags: [media-downloader, facebook, instagram, spotify, collapsible-dropbox, zero-flicker, in-place-mutation, isolated-container, ui-ux]
---

## 1. Triệu chứng & Vấn đề (Symptoms)
- Ở bộ 3 công cụ Media mới (Facebook Downloader, Instagram Downloader, Spotify Downloader), khi người dùng click vào thanh header dropbox lịch sử (`#btnToggleMediaHistory`) để mở hoặc thu gọn:
  - Toàn bộ trang web bị nhấp nháy, chớp giật (flash) như thể trang web bị reload hoặc cập nhật lại toàn diện.
  - Người dùng đang gõ liên kết trong thanh input bị mất tiêu điểm (focus) con trỏ chuột.
  - Trong khi đó, các công cụ khác như PDF Studio, Universal Converter, Quiz Generator, TikTok Downloader hoạt động rất mượt mà và không hề bị hiện tượng này.

---

## 2. Nguyên nhân gốc rễ (Root Cause Investigation)
1. **Thiếu Isolated History Container & Gọi Full Workspace Re-render**:
   - Trong `FacebookWorkspace.js`, `InstagramWorkspace.js`, và `SpotifyWorkspace.js`, khối HTML lịch sử được gắn trực tiếp vào chuỗi template của toàn bộ workspace thông qua `${renderMediaHistorySection(...)}`.
   - Khi có bất kỳ sự kiện nào xảy ra từ lịch sử (bấm toggle mở/đóng, chuyển tab Lịch sử/Thùng rác, xóa item), callback `onHistoryChange` đều kích hoạt `this.render()`.
2. **Kích Hoạt Lại CSS Animation `animate-fadeIn` Trên Root Element**:
   - `this.render()` ghi đè toàn bộ `this.container.innerHTML` với thẻ gốc `<div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">`.
   - Việc huỷ và tạo lại DOM gốc khiến trình duyệt áp dụng lại animation `fadeIn` (mờ từ opacity 0 lên 1) cho toàn bộ trang (từ breadcrumbs, tiêu đề, thanh input dán link, các nút thao tác đến thẻ kết quả), gây ra hiệu ứng nhấp nháy toàn màn hình.
3. **Phản Ứng Dư Thừa Khi Click Nút Toggle Dropbox**:
   - `attachMediaHistoryListeners` trong `MediaHistorySection.js` khi bắt sự kiện click `#btnToggleMediaHistory` lại gọi ngược về `onHistoryChange()`, ép toàn bộ workspace phải re-render chỉ để đổi trạng thái ẩn/hiện của thẻ `#mediaHistoryBody`.

---

## 3. Giải pháp kỹ thuật (Targeted Fix & Implementation)

### 3.1. Cập Nhật Mở/Thu Gọn Tại Chỗ (In-Place DOM Mutation)
Trong `src/components/tools/common/MediaHistorySection.js`:
- Bổ sung định danh cố định:
  - Nhãn text: `<span id="lblToggleMediaHistory">`
  - Mũi tên: `<div id="iconChevronMediaHistory">`
- Khi người dùng click `#btnToggleMediaHistory`:
  - Trực tiếp thay đổi `classList` của `#mediaHistoryBody` (`hidden` $\leftrightarrow$ `block`).
  - Xoay mũi tên `rotate-180` mượt mà thông qua CSS transition.
  - Cập nhật nhãn text sang `'Thu gọn'` hoặc `'Xem lịch sử'`.
  - Cập nhật thuộc tính `aria-expanded`.
  - Phát âm thanh phản hồi `soundEngine?.playToggle?.()`.
  - **Tuyệt đối không gọi `onHistoryChange()` hay re-render toàn workspace**. Quá trình diễn ra trong 0ms với 0 layout shift và 0 flicker.

### 3.2. Thiết Lập Isolated History Container Trong 3 Module Media
Trong `FacebookWorkspace.js`, `InstagramWorkspace.js`, và `SpotifyWorkspace.js`:
1. Bọc phân vùng lịch sử trong container độc lập:
   ```html
   <!-- Media History Section -->
   <div id="mediaHistoryContainer">
     ${renderMediaHistorySection({ ... })}
   </div>
   ```
2. Bổ sung các phương thức chuyên trách:
   - `attachHistoryListeners()`: Gắn các listener cho khu vực lịch sử, phạm vi cô lập chỉ bên trong `#mediaHistoryContainer`.
   - `renderHistory()`: Chỉ cập nhật `historyContainer.innerHTML`, không chạm vào bất kỳ phần tử nào phía trên của workspace.
3. Tách biệt vòng đời:
   - Khi chuyển tab Lịch sử / Thùng rác: gọi `this.renderHistory()`.
   - Khi xóa tệp, dọn rác, khôi phục: gọi `this.renderHistory()`.
   - Khi tải xong lịch sử ban đầu từ máy chủ (`storage.fetchHistory()`): chỉ gọi `this.renderHistory()`, giữ nguyên trang chính.
   - Khi lưu tệp lịch sử vào Studio Drive (`saveHistoryItemToDrive`): chỉ gọi `this.renderHistory()`.

---

## 4. Kiểm chứng thực tế (Verification)
1. **Unit Test Suite**:
   - Bổ sung test suite mục 6 trong `server/tests/unit/collapsible_history.test.ts`:
     - Kiểm tra render collapsible header với các ID `#btnToggleMediaHistory`, `#lblToggleMediaHistory`, `#iconChevronMediaHistory`.
     - Xác nhận việc click nút toggle kích hoạt in-place mutation, thay đổi label, mở body mà **KHÔNG** kích hoạt `onHistoryChange` (Zero-Workspace-Rerender).
   - Kết quả: `14/14 passed` (Exit code 0).
2. **TypeScript & JS Syntax**:
   - `rtk npm --prefix server run build` (`tsc`): **Exit 0**.
   - `rtk err node --check` trên cả 4 file (`MediaHistorySection.js`, `FacebookWorkspace.js`, `InstagramWorkspace.js`, `SpotifyWorkspace.js`): **0 errors**.
3. **PWA Version Bump**:
   - Nâng cấp phiên bản PWA lên **`v24.17`** (`sw.js`, `index.html`, `pwa.js`, `releaseNotes.js`).
