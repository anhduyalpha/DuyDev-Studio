# KI-FIX-052: Sửa Triệt Để Lỗi Không Đồng Bộ Nhóm Thiết Bị Do Rẽ Nhánh Admin & Bổ Sung Lắng Nghe Đa Công Cụ

## 1. Hiện Tượng Lỗi (Symptoms)
- Khi người dùng liên kết điện thoại và laptop qua mã 6 số (OTC) thành công, trên điện thoại có hàng chục mục lịch sử thuộc nhiều công cụ (`facebook-downloader`, `tiktok-downloader`, `spotify-downloader`, `quiz-generator`, `qr-multi`, `markdown-docs`), nhưng khi mở laptop lên thì không thấy bất kỳ mục nào từ điện thoại.
- Ngược lại, điện thoại cũng không nhận được lịch sử xử lý tệp của laptop (`pdf-studio`, `universal-converter`).
- Cả hai thiết bị đều hiển thị đã ghép nối trong modal cài đặt nhưng lịch sử hoàn toàn bị phân mảnh cục bộ theo từng máy.

## 2. Nguyên Nhân Gốc Rễ (Root Cause)
1. **Rẽ Nhánh Admin Vô Hiệu Hóa Lọc Sync Group (`history.controller.ts`)**:
   - Khi laptop đăng nhập bằng tài khoản quản trị viên (`isAdmin === true`), hàm `getHistory()` kiểm tra:
     ```typescript
     if (!isAdmin) {
       if (groupDeviceIds.length > 1) {
         whereClause.deviceId = { in: groupDeviceIds };
       }
     } else if (query.deviceId) {
       whereClause.deviceId = query.deviceId;
     }
     ```
   - Vì `isAdmin === true`, nhánh `if (!isAdmin)` bị bỏ qua và nhảy vào `else if (query.deviceId)`. Client gửi `?deviceId=laptop_id`, dẫn đến việc backend chỉ truy vấn đúng mã thiết bị của laptop (`WHERE device_id = 'laptop_id'`), hoàn toàn gạt bỏ `groupDeviceIds`.
   - Lỗi tương tự xuất hiện trên tất cả các handler: `getTrashItems`, `clearHistoryToTrash`, `restoreAllTrash`, `emptyTrash`.
2. **Giới Hạn Bộ Nhớ Cục Bộ (Slice 50 Mục)**:
   - Client trong `storage.js` áp đặt `limit=50` và `.slice(0, 50)` khi lưu vào `localStorage`. Khi hai máy có tổng cộng hơn 60 mục, các mục cũ hơn bị cắt bớt.
3. **Thiếu Lắng Nghe `dd:history-updated` Trong Một Số Công Cụ**:
   - Các công cụ như `PdfStudio`, `File Converter`, `QR Studio` không đăng ký lắng nghe sự kiện phát sóng `dd:history-updated` hoặc chỉ re-render khi danh sách rỗng, khiến giao diện không cập nhật khi dữ liệu đồng bộ nạp về.

## 3. Giải Pháp & Khắc Phục (Targeted Fixes)
1. **Tách Biệt Ưu Tiên Sync Group Khỏi Vai Trò Admin (`history.controller.ts`)**:
   - Luôn kiểm tra `effectiveGroup.length > 1` lên hàng đầu:
     ```typescript
     let effectiveGroup = groupDeviceIds;
     if (effectiveGroup.length <= 1 && query.deviceId) {
       const qGroup = deviceRegistryService.getSyncGroupDeviceIds(query.deviceId);
       if (qGroup.length > 1) effectiveGroup = qGroup;
     }

     if (effectiveGroup.length > 1) {
       whereClause.deviceId = { in: effectiveGroup };
     } else if (!isAdmin) {
       whereClause.deviceId = deviceId || query.deviceId || '__unidentified_guest__';
     } else if (query.deviceId) {
       whereClause.deviceId = query.deviceId;
     }
     ```
   - Áp dụng logic thống nhất cho cả 5 controller: `getHistory`, `getTrashItems`, `clearHistoryToTrash`, `restoreAllTrash`, `emptyTrash`.
2. **Nâng Cấp Giới Hạn Lưu Trữ Lên 150 Mục & Query Limit 100**:
   - Định nghĩa `MAX_STORAGE_ITEMS = 150` trong `src/utilities/storage.js`.
   - Nâng cấp `historyQuerySchema` trong `history.schema.ts` với `max(200)` và `default(100)`.
3. **Đăng Ký Kênh Reactive Cho Tất Cả Công Cụ**:
   - Bổ sung listener `dd:history-updated` cho `usePdfDom.js`, `useConverterDom.js`, `QrHistoryList.js`.
   - Chuẩn hóa `onHistoryChange` trong `SpotifyWorkspace.js` và `SlideshareWorkspace.js` gọi `this.renderHistory()` vô điều kiện.
4. **Tự Động Đồng Bộ Khi Quay Lại Tab (Tab Focus Sync)**:
   - Trong `src/app.js`, khi sự kiện `visibilitychange` kích hoạt và người dùng quay lại tab sau hơn 20 giây, tự động chạy `storage.syncAllWithServer()` ngầm.

## 4. Kiểm Chứng & Bằng Chứng (Verification)
- Truy vấn trực tiếp API Fastify từ homeserver:
  ```bash
  curl -s 'http://127.0.0.1:3000/api/v1/history?deviceId=dev_mv844tsz_5p4eanfiar&limit=100' | jq '{total: .data.total, tools: (.data.items | map(.toolId) | unique), devices: (.data.items | map(.deviceId) | unique)}'
  ```
  Kết quả trả về chính xác 36 mục thuộc cả 2 thiết bị (`dev_mv844tsz_5p4eanfiar` & `dev_mvbtnusa_zeh0ojfov2`) trải dài trên 8 công cụ (`facebook-downloader`, `tiktok-downloader`, `spotify-downloader`, `pdf-studio`, `universal-converter`, `quiz-generator`, `qr-multi`, `markdown-docs`).
- Đã build và chạy toàn bộ unit tests (`history_bulk.test.ts`, `device_sync_otc.test.ts`) đạt 10/10 tests passed (Exit 0).
