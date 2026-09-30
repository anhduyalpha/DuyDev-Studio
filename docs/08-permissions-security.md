# 08 — Quyền, bảo mật và dữ liệu

## Quyền

- `cookies`: xóa cookie Studocu theo nút người dùng.
- `scripting`: inject hàm xử lý DOM.
- `activeTab`: thao tác tab hiện tại.
- `debugger`: gọi CDP `Page.printToPDF`.
- `downloads`: lưu và hiện file.
- `offscreen`: phát âm thanh, ghép các chunk PDF thành Blob và giữ Blob URL tạm thời trong lúc tải.
- `storage`: settings, history, queue checkpoint.
- `notifications`: thông báo hoàn tất.

## Host permission

Chỉ Studocu `.com` và `.vn`.

## Dữ liệu lưu

- Settings và history trong `storage.local`.
- Queue/checkpoint tạm trong `storage.session`.
- Checkpoint không lưu text/ảnh; chỉ index, chiến lược nội bộ, bộ đếm/hash.

## Dữ liệu không gửi đi

Project không có fetch đến server bên thứ ba, analytics hay telemetry. PDF được tạo và tải cục bộ trong Chrome.
