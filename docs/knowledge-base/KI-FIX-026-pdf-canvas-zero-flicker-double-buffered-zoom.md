# KI-FIX-026: Khắc Phục Hiện Tượng Nhấp Nháy Đen Khi Thu Phóng PDF Bằng Cơ Chế Double-Buffering & Hoán Đổi Canvas Nguyên Tử

- **ID:** `KI-FIX-026`
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `frontend`
- **Tình trạng:** `verified`
- **Ngày lập:** 16/10/2026
- **Liên quan:** `KI-CON-013`, `KI-FIX-025`, `src/components/common/viewer/renderers/pdf/PdfCanvasViewer.js`, `src/styles/stitch-tokens.css`

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)
- Khi người dùng thu phóng tài liệu PDF (qua phím tắt `Ctrl + +/-`, nút bấm trên thanh nổi Floating Dock, cuộn chuột `Ctrl + Wheel`, hoặc cử chỉ 2 ngón tay Pinch-to-zoom trên màn hình cảm ứng), khung hình hiển thị trang tài liệu bị giật, chuyển sang màu đen đặc hoặc nhấp nháy đen trong khoảng 100ms - 300ms rồi mới hiển thị trang đã phóng to ("nháy đen rồi mới zoom ra").
- Trải nghiệm thị giác bị đứt gãy, gây khó chịu cho mắt và làm mất đi cảm giác chuyển động mượt mà 60fps/120fps.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Xóa Trắng DOM & Gắn Canvas Chưa Render (`box.innerHTML = ''`):**
   - Trong `setScale()`, khi debounce timer 150ms hết hạn, hàm thực hiện `this.renderedPages.clear()` rồi gọi `renderVisiblePages()`.
   - Trong `renderPage(pageNum)`, mã nguồn thực thi `box.innerHTML = ''; box.appendChild(canvas);` ngay lập tức TRƯỚC KHI `await renderTask.promise` hoàn tất.
2. **Khởi Tạo Bộ Đệm Canvas Opaque Black Với `{ alpha: false }`:**
   - Ngữ cảnh 2D được tạo bằng `canvas.getContext('2d', { alpha: false })` để tối ưu hóa hiệu năng render không cần kênh alpha. Theo đặc tả HTML5 Canvas, bộ đệm màu của canvas `alpha: false` mặc định được khởi tạo là màu đen mờ (`#000000` / `rgba(0,0,0,1)`).
   - Khi gắn phần tử canvas này vào DOM trong khi PDF.js đang rasterize trong nền, người dùng nhìn thấy một hình chữ nhật đen xì trên màn hình suốt thời gian chờ `renderTask.promise` hoàn tất (50ms - 400ms tùy độ phức tạp của trang).
3. **Thiếu Hàng Đợi Đồng Bộ Hóa Đa Bộ Đệm (Double-Buffering):**
   - Không có cơ chế đệm kép: canvas cũ bị xóa sổ ngay khi bắt đầu vẽ canvas mới thay vì giữ lại khung hình cũ và hoán đổi nguyên tử (atomic swap).

---

## 3. Giải pháp kỹ thuật (Implementation)
1. **Kiến Trúc Double-Buffering & Zero-Flicker Canvas Swapping:**
   - **Giữ nguyên canvas cũ trên màn hình:** Khi `setScale()` được kích hoạt, kích thước hộp chứa `box.style.width/height` được cập nhật đồng bộ tức thì. Phần tử `<canvas>` cũ bên trong hộp (có lớp CSS `w-full h-full`) tự động co giãn theo thời gian thực (0ms visual feedback) nhờ bộ lọc bilinear filtering của GPU.
   - **Vẽ trước trong bộ nhớ nền (Off-DOM Rasterization):** Canvas mới được tạo hoàn toàn off-DOM và được tô ngay lớp nền giấy trắng phòng vệ (`ctx.fillStyle = '#ffffff'; ctx.fillRect(...)`) để triệt tiêu mọi khả năng hiển thị bộ đệm đen rỗng.
   - **Hoán đổi nguyên tử (Atomic In-Place Replacement):** Chỉ khi `await renderTask.promise` hoàn tất 100%, canvas mới mới được hoán đổi vào vị trí canvas cũ bằng `oldCanvas.replaceWith(newCanvas)` hoặc `box.replaceChild(newCanvas, oldCanvas)` trong cùng một frame duy nhất.
2. **Tối Ưu Tương Tác 120Hz & Triệt Tiêu Quá Tải CPU/GPU (`inFlightRenders`):**
   - Quản lý các tác vụ đang vẽ nền qua `this.inFlightRenders = new Map()`.
   - Khi người dùng cuộn chuột hoặc pinch liên tục, các tác vụ vẽ nền của tỷ lệ cũ bị hủy ngay lập tức (`renderTask.cancel()`), tránh lãng phí tài nguyên CPU/GPU cho các khung hình trung gian đã lỗi thời.
   - Debounce 150ms cho việc rasterize lại độ phân giải cao, bảo toàn tốc độ cuộn mượt 120Hz trên compositor thread.
3. **Phòng Vệ Nền Khung Trang & GPU Compositor Layer:**
   - Bổ sung cấu hình CSS chuẩn hóa trong `src/styles/stitch-tokens.css`:
     ```css
     .pdf-page-box {
       background-color: #ffffff;
       will-change: width, height;
     }
     .pdf-canvas {
       image-rendering: auto;
       image-rendering: -webkit-optimize-contrast;
       transform: translateZ(0);
       backface-visibility: hidden;
     }
     ```
   - Đảm bảo `.pdf-page-box` luôn duy trì màu nền giấy trắng (hoặc giấy tối màu khi bật Dark/Sepia mode) mà không bao giờ để lộ màu nền tối `#09090b` của viewer root.

---

## 4. Xác minh (Verification Evidence)
- **Kiểm thử tự động:** `server/tests/unit/pdf_viewer_engine.test.ts` (Section 8) bổ sung 4 ca kiểm thử chuyên sâu:
  - Kiểm tra tô nền trắng phòng vệ ngay khi tạo canvas mới trước khi rasterize.
  - Kiểm tra bảo toàn canvas cũ trong DOM và cập nhật kích thước hộp 0ms khi `setScale`.
  - Kiểm tra hoán đổi nguyên tử `replaceWith` sau khi `renderTask.promise` hoàn thành.
  - Kiểm tra loại bỏ tác vụ vẽ nền lỗi thời khi tỷ lệ zoom thay đổi liên tiếp.
- **Kết quả thực thi:**
  - `rtk vitest run tests/unit/pdf_viewer_engine.test.ts tests/unit/battery_optimization.test.ts tests/unit/pwa_lifecycle.test.ts tests/unit/viewer_hardening.test.ts` -> **PASS (120) FAIL (0)**.
  - `rtk npm --prefix server run build` (`tsc`) -> **Exit 0**.
  - `rtk err node --check ...` -> **Exit 0**.
  - Cache Version: Đã nâng cấp đồng bộ lên **v23.10** (`sw.js`, `index.html`, `pwa.js`, `releaseNotes.js`).
