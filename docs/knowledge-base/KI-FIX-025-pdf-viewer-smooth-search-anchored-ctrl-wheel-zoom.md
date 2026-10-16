# KI-FIX-025: Khắc Phục Hiện Tượng Nhảy Giật Trang Khi Thu Phóng PDF & Tìm Kiếm Từ Khóa, Đồng Bộ Tức Thì Tỷ Lệ Zoom Ctrl+Wheel Với HUD Dock

- **ID:** `KI-FIX-025`
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `frontend`
- **Tình trạng:** `verified`
- **Ngày lập:** 16/10/2026
- **Liên quan:** `KI-CON-013`, `src/components/common/viewer/renderers/pdf/PdfCanvasViewer.js`, `src/components/common/viewer/renderers/PdfRenderer.js`

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)
- **Nhảy giật khi tìm kiếm từ khóa:** Khi người dùng bấm Enter (Next match) hoặc Shift+Enter (Prev match) trên thanh tìm kiếm nổi (`PdfSearchBar`), viewer gọi liên tiếp `jumpToPage(next.pageNum)` rồi sau đó lại gọi `scrollIntoView` trên thẻ highlight. Cả hai lệnh smooth scroll đồng thời tranh chấp nhau khiến trang nhảy lùi lên đầu trang rồi mới giật xuống từ khóa. Thậm chí các kết quả trên cùng một trang cũng kích hoạt `jumpToPage` gây reset vị trí viewport liên tục.
- **Lạc trôi tọa độ và giật hình khi phóng to / thu nhỏ:** Khi thu phóng qua `Ctrl + Wheel` hoặc thanh dock, CSS `transform` trên `#pdfPagesWrapper` có class `transition-transform duration-150` gây trễ khung hình. Khi debounce timer hết hạn, `transform` bị trả về `none` đồng thời gán `scrollTop` mới khiến giao diện giật cục mạnh. Tỷ lệ `scale` không được cập nhật ngay lập tức khiến các lần cuộn chuột liên tiếp nhân đè lên `scale` cũ chưa chốt.
- **Mất đồng bộ HUD Dock:** Nhãn phần trăm `#pdfZoomPctLabel` trên thanh HUD Dock không được cập nhật theo thời gian thực khi cuộn chuột vì thiếu callback thông báo trực tiếp từ `PdfCanvasViewer`.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Rogue Timeout & Duplicate Scroll:** Trong `highlightPageMatches`, có hàm `setTimeout(() => span.querySelector('.highlight.selected')?.scrollIntoView(...), 50)` nằm lồng trong vòng lặp duyệt `span`, gây ra hàng loạt lời gọi scroll cạnh tranh với `jumpToPage(target, 'start')`.
2. **Transform Rubber-Banding vs DOM Resizing:** Việc gán CSS `transform = scale(...)` cho thẻ cha rồi hoàn nguyên về `'none'` sau 150ms trên phần tử có CSS `transition-transform duration-150` tạo ra hiệu ứng giằng co trực quan với việc cập nhật `style.width` và `style.height` của các hộp trang (`.pdf-page-box`).
3. **Stale Scale Reference in Wheel Handler:** Biến `this.scale` chỉ được cập nhật sau khi debounce 150ms. Khi người dùng cuộn chuột nhanh, các sự kiện `wheel` tiếp theo vẫn đọc giá trị `this.scale` cũ, làm sai lệch tỷ lệ lũy kế.
4. **Coordinate Mismatches:** Dùng `offsetTop` tính toán trang chính giữa phụ thuộc vào `offsetParent`, gây sai lệch khi container cuộn có padding hoặc thanh công cụ.

---

## 3. Giải pháp kỹ thuật (Implementation)
1. **Điều hướng tìm kiếm trực tiếp không gián đoạn (`navigateToMatch` & `scrollToMatchElement`):**
   - Loại bỏ hoàn toàn lời gọi `jumpToPage` khi duyệt kết quả tìm kiếm.
   - Thêm phương thức `navigateToMatch(match, query, matches)` và `scrollToMatchElement(targetPage, matchIndex)`:
     - Nạp trước trang đích nếu chưa render vào bộ nhớ.
     - Tính toán vị trí phần tử `.highlight.selected` và cuộn mượt `containerEl` căn giữa phần tử trong khung nhìn có tính đến padding tránh bị che khuất bởi thanh công cụ.
   - Xóa bỏ triệt để đoạn `setTimeout` tự cuộn trong `highlightPageMatches`.
2. **Cập nhật kích thước & Neo tọa độ đồng bộ (`setScale` Synchronous Anchoring):**
   - Cập nhật tức thì `this.scale = targetScale` (giới hạn trong khoảng `0.25` đến `4.0`).
   - Kích thước `.pdf-page-box` (`style.width`, `style.height`) và tọa độ cuộn neo theo con trỏ chuột (`scrollLeft`, `scrollTop`) được tính toán và áp dụng ngay trong cùng frame.
   - Bỏ class `transition-transform duration-150` trên `#pdfPagesWrapper` để triệt tiêu hiệu ứng cao su.
   - Chỉ debounce tác vụ nặng: hủy và vẽ lại canvas độ phân giải cao (`renderVisiblePages`) sau 150ms khi người dùng dừng thao tác thu phóng.
3. **Đồng bộ thời gian thực với HUD Dock (`onScaleChange`):**
   - Bổ sung callback `onScaleChange` vào constructor `PdfCanvasViewer`.
   - Mỗi khi tỷ lệ thay đổi (qua phím tắt, `Ctrl + Wheel`, nút bấm Dock, hoặc pinch di động), gọi ngay `onScaleChange(this.scale)` để cập nhật nhãn `#pdfZoomPctLabel`.

---

## 4. Xác minh (Verification Evidence)
- **Kiểm thử tự động:** Bộ test `server/tests/unit/pdf_viewer_engine.test.ts` (Section 7) bổ sung kiểm thử cho:
  - Bắt sự kiện Ctrl + Wheel, kích hoạt `onScaleChange` và cập nhật nhãn HUD Dock.
  - Kẹp giới hạn zoom trong ngưỡng 0.25 - 4.0 và duy trì neo tọa độ cuộn ổn định.
  - Điều hướng từ khóa mượt mà không bị reset vị trí trang.
- **Thực thi:**
  - `rtk vitest run tests/unit/pdf_viewer_engine.test.ts tests/unit/battery_optimization.test.ts tests/unit/pwa_lifecycle.test.ts tests/unit/viewer_hardening.test.ts` -> **PASS (114) FAIL (0)**.
  - `rtk npm --prefix server run build` (`tsc`) -> **Exit 0**.
  - `rtk err node --check ...` -> **Exit 0**.
  - Production Homeserver (`192.168.2.171:3000`) & Cloudflare Tunnel (`studio.duydev.cloud`) -> **UP (v23.09)**.
