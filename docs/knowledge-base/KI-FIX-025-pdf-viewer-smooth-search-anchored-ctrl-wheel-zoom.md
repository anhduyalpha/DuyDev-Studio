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
2. **CSS Transition Delay Trên Hộp Trang (`transition-all duration-200`):** Mỗi thẻ `.pdf-page-box` có class `transition-all duration-200`. Khi `setScale` cập nhật `style.width` và `style.height`, trình duyệt thực hiện hoạt ảnh kéo dài 200ms trong khi `scrollTop`/`scrollLeft` bị gán tức thì, tạo ra hiện tượng lệch kích thước khung DOM và giật nảy liên tục khi cuộn chuột nhanh.
3. **Tranh Chấp Midpoint Giữa IntersectionObserver và Smooth Scroll:** Khi cuộn mượt đến trang xa (ví dụ từ trang 1 đến trang 10), `IntersectionObserver` bắt các trang trung gian ở giữa màn hình và kích hoạt `onPageChange` liên tục khiến HUD dock nhảy số loạn xạ (1 -> 10 -> 2 -> 3... -> 10). Đồng thời `unrenderPage(10)` hủy mất canvas/textLayer của trang đích trước khi trình duyệt cuộn tới nơi.
4. **Lỗi Thoát Sớm Của `zoomFit`:** Hàm `calcFitWidthScale()` tự gán `this.scale`, khiến khi gọi tiếp `setScale(this.scale)` điều kiện `Math.abs(targetScale - this.scale) < 0.001` kích hoạt và thoát sớm mà không cập nhật kích thước trang hay vẽ lại.
5. **Sai Lệch Tọa Độ Neo Zoom:** Công thức `docY * ratio - ay` ngầm giả định tài liệu không có padding và gap giữa các trang. Với tài liệu nhiều trang có gap 16px và padding 24px, tọa độ điểm dưới con trỏ chuột bị trôi dần khi phóng to.

---

## 3. Giải pháp kỹ thuật (Implementation)
1. **Điều hướng tìm kiếm & Khóa tranh chấp Midpoint (`setNavigating` & `scrollToMatchElement`):**
   - Loại bỏ hoàn toàn lời gọi `jumpToPage` khi duyệt kết quả tìm kiếm.
   - Thêm cờ khóa `isNavigating` và `targetNavPage` (tự giải phóng sau 600ms):
     - Trong lúc cuộn mượt, `IntersectionObserver` bỏ qua việc cập nhật `this.currentPage` để chống loạn số trang.
     - `unrenderPage` tuyệt đối không giải phóng trang đang được điều hướng đến (`targetNavPage`).
   - `scrollToMatchElement(targetPage, matchIndex)` căn giữa từ khóa cả 2 chiều dọc và ngang (`top` & `left`) kèm đệm thích hợp và dùng `this.containerEl.scrollTo` thay vì `scrollIntoView` để tránh làm cuộn cửa sổ ngoài.
2. **Cập nhật kích thước & Neo tọa độ đồng bộ chuẩn xác (`setScale` True Anchor):**
   - Thay thế `transition-all duration-200` trên `.pdf-page-box` bằng `transition-colors duration-150` để kích thước trang thay đổi đồng bộ tức thì không có độ trễ CSS.
   - Xác định chính xác trang và tỷ lệ phần trăm tọa độ `(fractionX, fractionY)` ngay dưới con trỏ chuột trước khi zoom. Sau khi đổi kích thước các hộp trang, tính toán `newAnchorY = targetBox.offsetTop + fractionY * newBoxHeight` để giữ cố định điểm dưới con trỏ chuột với sai số 0px.
   - Sửa `calcFitWidthScale()` chỉ tính toán và trả về tỷ lệ số, giúp `zoomFit()` kích hoạt `setScale` hoàn chỉnh.
   - Hỗ trợ cả nấc cuộn chuột rời rạc (`|deltaY| >= 50`) và trackpad cảm ứng nhạy mượt (`|deltaY| < 50`).
3. **Đồng bộ thời gian thực với HUD Dock (`onScaleChange`):**
   - Bổ sung callback `onScaleChange` vào constructor `PdfCanvasViewer`.
   - Mỗi khi tỷ lệ thay đổi (qua phím tắt, `Ctrl + Wheel`, nút bấm Dock, hoặc pinch di động), gọi ngay `onScaleChange(this.scale)` để cập nhật nhãn `#pdfZoomPctLabel`.

---

## 4. Xác minh (Verification Evidence)
- **Kiểm thử tự động:** Bộ test `server/tests/unit/pdf_viewer_engine.test.ts` (Section 7) bổ sung kiểm thử cho:
   - Bắt sự kiện Ctrl + Wheel, kích hoạt `onScaleChange` và cập nhật nhãn HUD Dock.
   - Kẹp giới hạn zoom trong ngưỡng 0.25 - 4.0 và duy trì neo tọa độ cuộn ổn định.
   - Điều hướng từ khóa mượt mà không bị reset vị trí trang.
   - Kiểm tra `zoomFit` tính toán lại tỷ lệ và thực thi không bị thoát sớm.
   - Khóa `isNavigating` ngăn tranh chấp midpoint và bảo vệ trang đích không bị unrender.
- **Thực thi:**
   - `rtk vitest run tests/unit/pdf_viewer_engine.test.ts tests/unit/battery_optimization.test.ts tests/unit/pwa_lifecycle.test.ts tests/unit/viewer_hardening.test.ts` -> **PASS (116) FAIL (0)**.
   - `rtk npm --prefix server run build` (`tsc`) -> **Exit 0**.
   - `rtk err node --check ...` -> **Exit 0**.
   - Production Homeserver (`192.168.2.171:3000`) & Cloudflare Tunnel (`studio.duydev.cloud`) -> **UP (v23.09)**.
