# 01 — Kiến trúc tổng thể

## Mục tiêu

Extension tạo PDF A4 từ tài liệu Studocu mà không chụp toàn màn hình. Mỗi trang được lấy từ DOM đã render, clone cùng style, gộp thành một cây element hoàn chỉnh, scale đúng một lần vào sheet A4 rồi gọi `Page.printToPDF`.

## Các khối chính

### Popup UI

`popup.html`, `popup.css`, `popup.js` cung cấp một chế độ công khai duy nhất là **Tự nhận diện**, cùng hàng đợi, tiến trình, preview, lịch sử, cài đặt và điều khiển pause/cancel. Popup không tự xử lý tài liệu; nó chỉ gửi message đến service worker.

### Service worker

`background.js` giữ:

- Map `exportJobs` chứa trạng thái từng tab.
- Mảng `exportQueue` xác định thứ tự.
- Queue processor đảm bảo chỉ một tài liệu dùng debugger tại một thời điểm.
- Checkpoint trong `chrome.storage.session`.
- Tạo notification; phát âm thanh và ghép stream PDF thành Blob qua offscreen document.
- Gọi `Page.printToPDF` và `chrome.downloads.download`.

### Page-world worker

Hàm `runCleanViewer` được inject bằng `chrome.scripting.executeScript`. Hàm này chạy trong tab Studocu và có quyền truy cập trực tiếp DOM:

1. Tìm các page node.
2. Xác định scroll container.
3. Prefetch lazy content.
4. Chọn pipeline từng trang.
5. Đợi ổn định.
6. Tạo integrity profile và fingerprint.
7. Clone DOM theo chiến lược nội bộ do Tự nhận diện chọn.
8. Kiểm tra clone.
9. Đóng gói vào A4 sheet.
10. Gửi progress/checkpoint về service worker.

### Offscreen audio

Service worker không có DOM đầy đủ. `offscreen.html` + `offscreen.js` tạo một context ẩn để phát `sounds/complete.wav`, nhận các chunk PDF, ghép Blob và giữ Blob URL cho đến khi Downloads API hoàn tất.

## Biên giới trách nhiệm

- Popup chỉ trình bày và gửi lệnh.
- Service worker quản lý lifecycle, queue, debugger, download.
- Tab Studocu chịu trách nhiệm đọc/clone/kiểm tra DOM.
- Chrome CDP chịu trách nhiệm render PDF cuối cùng.
