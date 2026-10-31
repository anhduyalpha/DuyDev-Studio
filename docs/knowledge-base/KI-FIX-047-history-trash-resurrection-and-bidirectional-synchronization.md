---
id: "KI-FIX-047"
title: "Khắc Phục Triệt Để Hiện Tượng Mục Lịch Sử Đã Xóa Sống Lại (History Resurrection Bug) & Cơ Chế Đồng Bộ Hóa Thùng Rác Hai Chiều Phân Loại Theo Công Cụ"
type: "troubleshoot"
domain: "fullstack"
status: "verified"
tags:
  - "history"
  - "trash"
  - "media-downloaders"
  - "facebook"
  - "instagram"
  - "spotify"
  - "synchronization"
  - "id-preservation"
summary: "Trong các module tải media mới (Facebook, Instagram, Spotify), thao tác chuyển mục vào thùng rác hoặc dọn sạch lịch sử hoạt động bình thường trên giao diện nhưng khi F5 refresh hoặc mở lại trang thì các tệp đã xóa lại xuất hiện trở lại. Nguyên nhân do lệch định danh ID client-server, thiếu đối soát thùng rác trong fetchHistory(), và các nút khôi phục/dọn sạch thùng rác chưa gọi API backend theo từng công cụ."
created_at: "2026-10-31"
updated_at: "2026-10-31"
---

# KI-FIX-047: Khắc Phục Triệt Để Hiện Tượng Mục Lịch Sử Đã Xóa Sống Lại & Đồng Bộ Hóa Thùng Rác Hai Chiều

## 1. Triệu chứng & Vấn đề (Problem Statement)
Trong bộ ba mô-đun tải nội dung trực tuyến mới (Facebook Downloader, Instagram Downloader, Spotify Downloader):
- Khi người dùng bấm biểu tượng thùng rác để xóa mục lịch sử, mục biến mất tức thì trên giao diện.
- Tuy nhiên, khi tải lại trang (F5 / refresh) hoặc thoát khỏi công cụ rồi quay trở lại, **toàn bộ các mục đã xóa lại sống lại trong danh sách lịch sử** và tab Thùng rác không lưu giữ đúng trạng thái.
- Khi người dùng bấm nút "Dọn sạch" hoặc "Khôi phục tất cả" trong tab Thùng rác, các thay đổi chỉ diễn ra cục bộ trong `localStorage` mà không đồng bộ lên cơ sở dữ liệu máy chủ SQLite qua Fastify API.

## 2. Nguyên nhân cốt lõi (Root Causes)

1. **Lệch Định Danh ID Giữa Client và Server (ID Desynchronization)**:
   - Các workspace (`FacebookWorkspace`, `InstagramWorkspace`, `SpotifyWorkspace`) sinh ID cục bộ: `fb-...`, `ig-...`, `sp-...`.
   - Hàm `storage.recordCompletedJob` khi gọi `POST /api/v1/history` không truyền trường `id`, và `createHistorySchema` phía máy chủ không chấp nhận `id`. Máy chủ tự động sinh CUID ngẫu nhiên (`cm2...`).
   - Khi xóa mục, client gọi `DELETE /api/v1/history/sp-...`. Hàm `findHistoryRecordByIdOrUrl` phía backend chỉ tìm theo khóa chính CUID hoặc URL tải trực tiếp chính xác, dẫn đến trả về **404 Not Found**. Bản ghi trên SQLite vẫn giữ nguyên `isDeleted = false`.

2. **Hàm `storage.fetchHistory()` Tái Sinh Mục Đã Xóa Vào Bộ Nhớ Trình Duyệt**:
   - Khi khởi tạo module hoặc mở lại trang, hàm `mount()` gọi `storage.fetchHistory()`.
   - `fetchHistory()` lấy danh sách 50 bản ghi từ máy chủ (`/api/v1/history`), nơi các bản ghi bị xóa hụt vẫn còn `isDeleted = false`.
   - `fetchHistory()` tiến hành merge danh sách máy chủ vào `localStorage` mà không hề đối chiếu với các mục đã có trong danh sách Thùng rác cục bộ (`STORAGE_KEYS.TRASH` - `ds_trash_v2`), dẫn tới việc đưa ngược các mục đã bị xóa về lại danh sách Lịch sử (`STORAGE_KEYS.HISTORY`).

3. **Thiếu Bộ Lọc Phân Vùng Công Cụ (toolId Scope) Cho Các Hành Động Hàng Loạt**:
   - Các API xóa/khôi phục toàn bộ (`DELETE /api/v1/history`, `POST /api/v1/trash/restore-all`, `DELETE /api/v1/trash`) không hỗ trợ tham số `toolId`.
   - Nút "Khôi phục" và "Dọn sạch" trong `MediaHistorySection.js` chỉ gọi hàm sync của `localStorage` mà không phát tín hiệu HTTP đồng bộ lên máy chủ.

4. **Thiếu Tải Trước Thùng Rác (Pre-fetch Trash) Khi Khởi Động**:
   - Trong `mount()` chỉ gọi `storage.fetchHistory()` mà không gọi `storage.fetchTrash()`, dẫn đến khi người dùng chuyển sang tab Thùng rác, dữ liệu có thể bị rỗng hoặc lỗi thời.

## 3. Giải pháp triển khai (Implementation Details)

### 3.1. Đồng bộ hóa ID Client-Server & Tăng cường phân giải (Backend)
- Cập nhật `server/src/schemas/history.schema.ts`:
  - `createHistorySchema`: Chấp nhận `id: z.string().optional().nullable()`.
  - `historyQuerySchema`: Bổ sung `toolId: z.string().optional()`.
- Cập nhật `server/src/api/controllers/history.controller.ts`:
  - Trong `createHistoryItem`: Lưu trữ `...(body.id ? { id: body.id } : {})`. Đồng thời kiểm tra nếu `body.id` đã tồn tại thì cập nhật lại bản ghi và reset `isDeleted: false, deletedAt: null`.
  - Trong `findHistoryRecordByIdOrUrl`: Mở rộng tìm kiếm sang `{ detailsJson: { contains: id } }` và `{ downloadUrl: { contains: id } }` để nhận diện chính xác các mã client-side ngay cả với bản ghi cũ.
  - Trong `clearHistoryToTrash`, `restoreAllTrash`, `emptyTrash`, `getHistory`, `getTrashItems`: Bổ sung xử lý lọc theo `toolId` (chuẩn hóa bao gồm cả dạng hậu tố `-downloader`).

### 3.2. Chống tái sinh mục đã xóa & Hợp nhất thùng rác (Frontend `storage.js`)
- Trong `recordCompletedJob`: Truyền `id: itemPayload.id` trong payload gửi lên máy chủ `POST /api/v1/history`.
- Trong `fetchHistory`: Xây dựng `trashedIds` từ `this.getLocalTrash()`. Tự động loại bỏ bất kỳ bản ghi nào từ máy chủ hoặc cục bộ có ID hoặc URL trùng với danh sách thùng rác trước khi lưu vào `STORAGE_KEYS.HISTORY`.
- Trong `fetchTrash`: Hợp nhất `localTrash` và `serverTrash` khử trùng lặp (`deduplicateList([...localTrash, ...serverTrash])`) để đảm bảo các mục mới xóa ở client không bị mất trước khi backend hoàn tất xử lý.
- Bổ sung `restoreToolTrash(toolId)` và `emptyToolTrash(toolId)`: Vừa cập nhật tức thì `localStorage` vừa gửi request HTTP xóa/khôi phục theo đúng `toolId` lên máy chủ.

### 3.3. Kết nối toàn diện MediaHistorySection & Các Workspace
- Trong `MediaHistorySection.js`:
  - Nút "Khôi phục tất cả": Gọi `await storage.restoreToolTrash(toolId)`.
  - Nút "Dọn sạch": Gọi `await storage.emptyToolTrash(toolId)`.
  - Khi người dùng bấm tab `trash`: Kích hoạt ngầm `storage.fetchTrash()`.
- Trong `FacebookWorkspace.js`, `InstagramWorkspace.js`, `SpotifyWorkspace.js`, `TemplateWorkspace.js`:
  - Tại hàm `mount()`: Gọi đồng thời `Promise.all([storage.fetchHistory(), storage.fetchTrash()]).then(() => this.renderHistory())`.

## 4. Kiểm chứng & Đo lường (Verification & Metrics)
- **Unit & E2E Tests**: Bộ kiểm thử `server/tests/unit/history_trash_persistence.test.ts` gồm 6 test cases đạt 100% Pass:
  1. Tạo bản ghi lịch sử với custom ID client-side thành công.
  2. Truy vấn `getHistory` lọc chính xác theo `toolId` và `deviceId`.
  3. Xóa mềm (Soft Delete) theo custom ID ẩn khỏi `getHistory` và xuất hiện trong `getTrashItems`.
  4. Khôi phục từ thùng rác theo custom ID đưa bản ghi trở lại `getHistory`.
  5. Xóa lịch sử theo `toolId` chỉ chuyển đúng các mục của công cụ đó vào thùng rác.
  6. Dọn sạch thùng rác (Empty Trash) theo `toolId` xóa vĩnh viễn tệp đính kèm và bản ghi.
- **Service Worker Cache**: Tăng phiên bản `CACHE_NAME` lên `duydev-studio-v24.30` trong `sw.js` và cập nhật changelog trong `src/utilities/releaseNotes.js`.
