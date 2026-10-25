# KI-FIX-034: Khắc Phục Lỗi Mất Lịch Sử Xử Lý Tệp PDF & Bổ Sung Luồng Tiếp Tục Chỉnh Sửa Trong PDF Studio

## 1. Hiện Tượng & Nguyên Nhân Gốc (Root Cause)
1. **Lệch Định Danh Thiết Bị (Device Partitioning Mismatch)**:
   - Khi `enqueuePdfJob` được gọi, `deviceId` từ header `x-device-id` không được truyền vào BullMQ payload của `pdf_process`.
   - `pdf.worker.ts` tạo bản ghi `prisma.historyRecord.create` với `deviceId: null`.
   - Khi client gọi `GET /api/v1/history`, controller áp dụng `where: { deviceId: req.headers['x-device-id'] }` (theo KI-CON-011), dẫn đến việc không khớp và trả về danh sách rỗng (`[]`).
2. **Ghi Đè Làm Trắng Bộ Nhớ Cục Bộ (LocalStorage History Overwrite)**:
   - `src/utilities/storage.js` hàm `fetchHistory()` trước đây gán thẳng `localStorage.setItem(..., JSON.stringify(serverItems))`. Khi máy chủ trả về `[]`, toàn bộ các tệp vừa lưu cục bộ qua `recordCompletedJob` bị xóa sạch ngay lập tức.
3. **Mất Dấu Tệp Khi Bấm "Tiếp tục"**:
   - Nút "Tiếp tục" (`#btnResetResult`) trên thẻ `ResultCard.js` kích hoạt `qm.resetResult()`, giải phóng toàn bộ `this.files = []` và ẩn kết quả.
   - Do tệp không vào được lịch sử (bị lỗi ở mục 1 và 2), người dùng quay lại giao diện thấy trống trơn, mất hoàn toàn tệp đã xử lý.
   - Người dùng cũng không có tùy chọn nạp lại tệp PDF vừa tạo để thực hiện chuỗi thao tác kế tiếp (ghép xong muốn nén hoặc đóng dấu watermark).

---

## 2. Giải Pháp Kỹ Thuật (Targeted Solution)
1. **Truyền & Gán `deviceId` Xuyên Suốt Pipeline**:
   - `jobs.controller.ts`: Trích xuất `deviceId` từ header `x-device-id` và truyền vào `job.optionsJson` cùng payload BullMQ.
   - `pdf.worker.ts`: Đọc `payload.deviceId` và lưu trực tiếp vào trường `deviceId` của `prisma.historyRecord.create`.
   - `history.controller.ts`: Trong `createHistoryItem`, nếu bản ghi đã tồn tại theo `resultFileId` / `downloadUrl` nhưng `deviceId` đang là `null`, tự động liên kết với `targetDeviceId` của client.
2. **Hợp Nhất Lịch Sử Chống Mất Mát Dữ Liệu (`storage.js`)**:
   - `storage.fetchHistory()`: Hợp nhất `serverItems` và `localItems` (`deduplicateList([...serverItems, ...localItems])`), đảm bảo không bao giờ làm trắng lịch sử cục bộ.
   - `storage.recordCompletedJob()`: Lưu đầy đủ `mode`, `savedPct`, `targetFormat` và tự động gửi `POST /api/v1/history` ngầm với header `x-device-id` để máy chủ luôn có dữ liệu.
3. **Bổ Sung Thao Tác "Xử Lý Tiếp" & Tự Động Mở Lịch Sử (`usePdfDom.js` & `ResultCard.js`)**:
   - Bổ sung nút `[Xử lý tiếp]` (`#btnContinueWithResult`) trên `ResultCard.js` đối với tệp kết quả PDF. Khi click, hệ thống tự động tải blob tệp kết quả và nạp vào danh sách `qm.files`, cho phép người dùng chuyển tab và thao tác tiếp tục.
   - Khi click nút `[Tiếp tục]` (`#btnResetResult`), tự động kích hoạt `setPdfHistoryOpen(true)` để khối lịch sử hiển thị mở rộng ngay phía dưới, giúp người dùng nhìn thấy ngay tệp vừa xử lý.

---

## 3. Kiểm Chứng (Verification)
- Đơn vị: `server/tests/unit/pdf_history_continue.test.ts` (100% pass).
- TypeScript: `rtk npm --prefix server run build` (`tsc` -> 0 errors).
- PWA Version: Nâng cấp `v23.98` (`sw.js`, `index.html`, `pwa.js`, `releaseNotes.js`).
- Triển khai & Health check: Đã deploy thành công lên homeserver `192.168.2.171` và domain HTTPS `https://studio.duydev.cloud`.
