# Validation — v1.8.6

## Kiểm tra tĩnh bắt buộc

- `node --check background.js`
- `node --check popup.js`
- `node --check premium_probe.js`
- `node --check offscreen.js`
- parse `manifest.json` bằng JSON parser
- xác nhận version `1.8.6`
- xác nhận chỉ có một thư mục gốc `Studocu lỏ` trong ZIP
- xác nhận các key VI/EN trùng nhau và mọi `data-i18n` đều tồn tại
- xác nhận content script `premium_probe.js` chạy ở `document_start`

## Kiểm thử probe

1. Nút Premium xuất hiện rồi biến mất: probe phải trả `present: false` ngay tại mutation làm nút biến mất.
2. Nút Premium còn hiển thị đến hard timeout: probe phải trả `present: true`.
3. Nút không xuất hiện: probe trả `present: false` sau khi viewer sẵn sàng hoặc tại timeout an toàn.
4. Popup chỉ chuyển xanh khi gate nhận `ready: true`.

## Hành vi cần kiểm thử trực tiếp trên Studocu

- Bấm Active Premium, tab reload và trạng thái chuyển xanh ngay khi nút Premium/Free Trial trên trang biến mất.
- Nếu nút vẫn còn, trạng thái phải đỏ và Tạo PDF/Hàng đợi tiếp tục bị khóa.
- Renderer PDF phải giữ hành vi của nhánh nhanh v1.8.2.

Kiểm tra tĩnh không thay thế được kiểm thử trên phiên Studocu đang đăng nhập.
