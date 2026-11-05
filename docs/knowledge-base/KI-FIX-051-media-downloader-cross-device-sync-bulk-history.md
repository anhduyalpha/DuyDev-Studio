---
id: KI-FIX-051
title: "Khắc Phục Lỗi Đồng Bộ Lịch Sử Media Downloader Đa Thiết Bị & Cơ Chế Đẩy Dữ Liệu Bulk History Ingestion"
type: troubleshoot
domain: fullstack
status: verified
created_at: 2026-11-05
updated_at: 2026-11-05
version: 1.0.0
trigger_conditions:
  - "Lịch sử tác vụ trên điện thoại không xuất hiện trên máy tính sau khi liên kết qua mã OTC"
  - "Vòng lặp đẩy lịch sử bất đồng bộ không await khiến fetchHistory chạy trước khi lưu DB"
  - "Lỗi xác thực z.number().int() khi kích thước tệp là số thực hoặc chuỗi"
  - "Thiết bị cấp mã OTC không tải lịch sử cục bộ lên máy chủ trước khi cấp mã"
search_queries:
  - "fix lỗi không đồng bộ trên điện thoại lịch sử fb downloader sang laptop"
  - "pushLocalHistoryToServer un-awaited loop fetch"
  - "POST /api/v1/history/bulk ingestion"
  - "device sync OTC group history empty"
tags:
  - sync
  - device-pairing
  - bulk-history
  - facebook-downloader
  - media-history
---

# KI-FIX-051: Khắc Phục Lỗi Đồng Bộ Lịch Sử Media Downloader Đa Thiết Bị & Cơ Chế Đẩy Dữ Liệu Bulk History Ingestion

## 1. Hiện tượng & Triệu chứng (Symptoms)
- Người dùng thực hiện tải/trích xuất 10 tệp video/ảnh trên điện thoại trong mô-đun **Facebook Downloader**.
- Sau đó, người dùng vào **Cài đặt -> Đồng bộ thiết bị**, tạo mã kết nối 6 chữ số (OTC) trên điện thoại và nhập vào máy tính laptop để liên kết.
- Khi vào mô-đun trên laptop, danh sách lịch sử hoàn toàn trống (0 tệp), không hiển thị bất kỳ tệp nào đã tải từ điện thoại.

---

## 2. Nguyên nhân cốt lõi (Root Cause Analysis)
1. **Lỗi 1: Vòng lặp bất đồng bộ không được `await` trong `pushLocalHistoryToServer()`**:
   - Trong `src/utilities/storage.js`, các yêu cầu `fetch('/api/v1/history', { method: 'POST', ... })` nằm trong vòng lặp `for...of` nhưng không có từ khóa `await` hay `Promise.all()`.
   - Hàm `pushLocalHistoryToServer()` lập tức trả về trong 0ms.
   - Ngay sau đó, `syncAllWithServer()` gọi `fetchHistory({ replaceLocal: true })` truy vấn backend trước khi các yêu cầu POST kịp gửi hoặc lưu vào SQLite `history_records`.
2. **Lỗi 2: Thiết bị cấp mã (Điện thoại) không đẩy lịch sử cục bộ khi tạo mã**:
   - Khi bấm "Tạo mã kết nối (6 số)", hàm `generateSyncCode()` chỉ gọi `POST /api/v1/device/sync/code` để lấy mã OTP mà không gọi `pushLocalHistoryToServer()`.
   - Toàn bộ 10 mục lịch sử vẫn nằm kẹt trong `localStorage` của điện thoại, chưa từng được gửi lên database của hệ thống.
   - Khi laptop ghép nối thành công và truy vấn `groupDeviceIds`, database trả về 0 bản ghi.
3. **Lỗi 3: Thiếu endpoint nạp lịch sử hàng loạt (`POST /api/v1/history/bulk`)**:
   - Việc bắn 30-50 request HTTP POST đơn lẻ từ thiết bị di động dễ gặp hiện tượng timeout, nghẽn mạng hoặc race condition.
   - Thiếu đóng gói đầy đủ `detailsJson` (chứa cover, videoHdUrl, author, originalUrl, quality) khiến siêu dữ liệu phong phú của media downloader bị thiếu khi khôi phục từ server.
4. **Lỗi 4: Màn hình đếm ngược không tự động phát hiện khi thiết bị kia đã ghép nối**:
   - Điện thoại nằm ở trạng thái đếm ngược 5 phút mà không thăm dò kiểm tra xem mã đã được máy tính nhập thành công chưa để tự động đồng bộ hai chiều.

---

## 3. Giải pháp kỹ thuật (Targeted Fixes)

### 3.1. Bổ sung API `POST /api/v1/history/bulk` trên Backend Fastify
- Định nghĩa schema `bulkHistorySchema = z.object({ items: z.array(createHistorySchema).min(1).max(100) })` trong `server/src/schemas/history.schema.ts`.
- Triển khai controller `createBulkHistoryItems` trong `server/src/api/controllers/history.controller.ts` xử lý upsert/tạo mới bản ghi hàng loạt theo `targetDeviceId` và `groupDeviceIds`, làm tròn số nguyên không âm `Math.max(0, Math.round(Number(originalSize) || 0))`.
- Đăng ký route trong `server/src/api/routes/history.route.ts`.

### 3.2. Chuẩn hóa & Await Triệt Để Trong `storage.pushLocalHistoryToServer()`
- Đóng gói toàn bộ metadata (cover, thumbnail, author, artist, duration, driveRelPath, originalUrl, quality, mediaType, viewUrl, videoHdUrl, videoSdUrl) vào `detailsJson`.
- Ưu tiên nạp hàng loạt qua `POST /api/v1/history/bulk` và `await` cho đến khi hoàn tất.
- Có cơ chế fallback tự động sang `await Promise.all(...)` với từng request đơn lẻ nếu endpoint bulk gặp lỗi.

### 3.3. Tự Động Đẩy Lịch Sử & Thăm Dò Real-Time Trong `ProfileModal.js`
- Khi bấm "Tạo mã kết nối (6 số)": gọi `await storage.pushLocalHistoryToServer()` trước khi tạo mã.
- Trong `startCountdown(expiresAt)`: định kỳ mỗi 3 giây kiểm tra trạng thái liên kết (`fetchSyncStatus()`). Khi phát hiện máy tính đã liên kết, tự động hủy bộ đếm, bắn toast thành công và kích hoạt `storage.syncAllWithServer({ replaceLocal: true })`.
- Khi nhập mã và liên kết (`redeemSyncCode`): tự động đẩy lịch sử cục bộ của thiết bị nhận trước khi hoàn tất đồng bộ hai chiều.

---

## 4. Kiểm chứng (Verification)
- Đơn vị kiểm thử Vitest: `server/tests/unit/history_bulk.test.ts` (4/4 passed), `server/tests/unit/device_sync_otc.test.ts` (6/6 passed).
- TypeScript compile: `tsc --noEmit` đạt exit code 0.
- Triển khai Production HTTPS: Service status Active, `/api/v1/health` đạt HTTP 200 OK.
