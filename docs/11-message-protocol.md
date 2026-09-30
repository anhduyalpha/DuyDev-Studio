# 11 — Message protocol

| Message | Nguồn → Đích | Mục đích |
|---|---|---|
| `STD_PREMIUM_PAGE_START` | `premium_probe.js` → background | Mỗi lần document load/F5, tạo `pageToken` mới và khóa gate ở trạng thái đang kiểm tra. |
| `STD_GET_COOKIE_GATE` | Popup → background | Đọc trạng thái Active Premium của phiên Chrome. |
| `STD_ACTIVE_PREMIUM` | Popup → background | Xóa cookie theo cơ chế v1.8.2, arm probe rồi reload tab. |
| `STD_PREMIUM_PROBE_READY` | `premium_probe.js` → background | Hỏi tab hiện tại có nonce đang chờ xác minh hay không. |
| `STD_PREMIUM_PROBE_RESULT` | `premium_probe.js` → background | Trả kết quả nút Premium còn hiển thị hay đã biến mất sau Active Premium. |
| `STD_PREMIUM_LIVE_STATE` | `premium_probe.js` → background | Cập nhật trực tiếp trạng thái Premium sau mỗi F5; chỉ mở khóa khi `verified: true` và element không còn. |
| `STD_START_BACKGROUND_EXPORT` | Popup → background | Kiểm tra gate rồi enqueue tab hiện tại. |
| `STD_ADD_TO_QUEUE` | Popup/khác → background | Alias enqueue. |
| `STD_QUEUE_ALL_STUDOCU_TABS` | Popup → background | Kiểm tra gate rồi enqueue mọi tab Studocu. |
| `STD_JOB_PROGRESS` | Injected page worker → background | Gửi progress, ETA, chiến lược nội bộ, report và checkpoint. |
| `STD_GET_EXPORT_STATUS` | Popup → background | Lấy job của tab hiện tại và toàn queue. |
| `STD_GET_QUEUE` | Popup → background | Chỉ lấy queue. |
| `STD_SET_JOB_PAUSED` | Popup → background → page | Đặt cờ pause. |
| `STD_CANCEL_BACKGROUND_EXPORT` | Popup → background → page | Hủy job. |
| `STD_REMOVE_QUEUE_JOB` | Popup → background | Xóa/hủy một item queue. |
| `STD_PREVIEW_DECISION` | Popup → background | Chọn download/rebuild/cancel. |
| `STD_SET_LANGUAGE` | Popup → background | Lưu `vi` hoặc `en`. |
| `STD_GET_SETTINGS` | Popup → background | Đọc settings. |
| `STD_SAVE_SETTINGS` | Popup → background | Lưu settings. |
| `STD_GET_HISTORY` | Popup → background | Đọc lịch sử. |
| `STD_CLEAR_HISTORY` | Popup → background | Xóa lịch sử. |
| `STD_PLAY_COMPLETION_SOUND` | Background → offscreen | Phát ting hoàn tất. |
| `STD_PDF_STREAM_START` | Background → offscreen | Khởi tạo bộ đệm Blob cho PDF stream. |
| `STD_PDF_STREAM_APPEND` | Background → offscreen | Nối một chunk PDF. |
| `STD_PDF_STREAM_FINALIZE` | Background → offscreen | Tạo Blob URL và trả URL. |
| `STD_PDF_STREAM_ABORT` | Background → offscreen | Hủy bộ đệm khi stream lỗi. |
| `STD_PDF_BLOB_REVOKE` | Background → offscreen | Thu hồi Blob URL. |

Mọi response quan trọng dùng dạng `{ ok: true, ... }` hoặc `{ ok: false, error }`.

Trong v1.8.6, trường trạng thái nội bộ `bannerPresent` được giữ để tương thích, nhưng mang nghĩa **nút Premium còn hiển thị**. Khi probe đã từng thấy nút rồi nhận mutation làm nút biến mất, kết quả thành công được gửi ngay.

Trong v1.8.8, mọi message revalidation mang `pageToken`. Background bỏ qua message từ document cũ để tránh race condition sau F5.
