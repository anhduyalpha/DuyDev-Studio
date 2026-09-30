# 03 — Reliable Queue

## Vì sao cần queue

Chrome debugger và việc clone nhiều DOM lớn tiêu tốn bộ nhớ. Chạy đồng thời nhiều tab dễ tạo xung đột và làm tab bị throttle. v1.7.0 xử lý tuần tự.

## Cấu trúc dữ liệu

- `exportJobs: Map<tabId, job>`: trạng thái chi tiết.
- `exportQueue: tabId[]`: thứ tự chờ.
- `activeQueueTabId`: job đang chiếm debugger.
- `queueProcessorRunning`: khóa chống chạy hai processor.

## Thêm job

`startBackgroundExport()`:

- Chống thêm trùng tab đang chạy/chờ.
- Xác thực domain Studocu.
- Lấy tên chuẩn.
- Tạo `documentKey` từ origin, pathname và title.
- Push tabId vào queue.
- Persist rồi gọi processor.

## Xử lý nhiều tab

`queueAllStudocuTabs()` query tất cả tab, lọc URL Studocu và gọi cùng API enqueue. Job đã tồn tại được báo `alreadyQueued` thay vì tạo bản sao.

## Khôi phục service worker

MV3 có thể suspend worker. Khi worker thức dậy, `hydrateReliableQueueState()` đọc `chrome.storage.session`, kiểm tra tab còn tồn tại rồi đưa job chưa xong trở lại queue.
