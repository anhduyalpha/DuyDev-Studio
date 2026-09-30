# 06 — Preview, print và download

## Integrity Preview

Bật trong popup bằng **Xem báo cáo toàn vẹn trước khi tải**. Sau khi DOM đã chuẩn bị và verify, job dừng ở `preview_ready`.

Preview hiển thị:

- Tên file.
- Số trang phát hiện/đã dựng.
- Phân bố pipeline.
- Số trang phục hồi.
- Trang có fingerprint warning.
- Các index mẫu đầu/giữa/cuối.

## Quyết định

- **Tải PDF:** tiếp tục `Page.printToPDF`.
- **Quét lại trang nghi vấn:** xóa viewer tạm và chạy lại toàn bộ bằng Tự nhận diện, không chuyển sang mode công khai khác.
- **Hủy:** dọn dữ liệu, detach debugger, không tải file.

## Tạo PDF

`preferCSSPageSize: true` dùng CSS `@page size: A4`. Mỗi `.std-a4-sheet` có đúng 210×297 mm. Child DOM được scale một lần bên trong `.std-a4-stage`.

## Đặt tên

Tên lấy từ metadata, h1, JSON-LD, title hoặc URL; ký tự cấm Windows bị thay bằng dấu `-`. Downloads API và `onDeterminingFilename` cùng cưỡng chế tên.
