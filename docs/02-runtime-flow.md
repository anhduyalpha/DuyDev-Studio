# 02 — Luồng chạy từ nút bấm đến PDF

1. Người dùng bấm **Tạo PDF A4** hoặc thêm tab vào queue.
2. Popup gửi `STD_START_BACKGROUND_EXPORT`.
3. Service worker xác minh URL, lấy tiêu đề tài liệu và tạo `documentKey`.
4. Job được đưa vào `exportQueue` rồi lưu vào `chrome.storage.session`.
5. `processExportQueue()` lấy job đầu tiên.
6. Extension attach `chrome.debugger` và giữ lifecycle tab ở trạng thái active.
7. `runCleanViewer()` được inject vào tab.
8. Hàm tìm toàn bộ page placeholder, cuộn prefetch, xử lý từng trang.
9. Sau mỗi trang, checkpoint gồm index, chiến lược nội bộ và fingerprint được gửi về background.
10. Các trang thiếu được verify/retry riêng.
11. Mọi capture được sắp thứ tự và append vào `#clean-viewer-container`.
12. `verifyPreparedDom()` kiểm tra số sheet, kích thước, ảnh lỗi và trang rỗng.
13. Nếu bật preview, job chuyển sang `preview_ready` và chờ lựa chọn.
14. `Page.printToPDF` tạo PDF từ DOM A4.
15. Downloads API lưu bằng tên tài liệu.
16. Extension phát ting, notification, lưu history.
17. Cleanup trả vị trí cuộn, xóa DOM/style tạm, detach debugger và xóa checkpoint.

## Trạng thái job

`queued → starting/recovering → scanning → creating_pdf → preview_ready (tùy chọn) → completed`

Nhánh lỗi: `error`; nhánh hủy: `cancelled`; tạm dừng: `paused`.
