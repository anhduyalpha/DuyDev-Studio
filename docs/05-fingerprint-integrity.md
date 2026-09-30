# 05 — Fingerprint và Integrity Guard

## Integrity profile

Mỗi trang nguồn được đo:

- Độ dài text chuẩn hóa.
- Số text node và text element.
- Số ảnh, ảnh đã tải và diện tích ảnh.
- Số SVG/canvas.
- Tổng element, chiều dài HTML, diện tích trang.
- Cờ scan-like và images-ready.

## Fingerprint

Hash FNV-1a được tạo từ text hash, signature bộ đếm, kích thước và mô tả media. Checkpoint chỉ lưu hash, không lưu text.

## Kiểm tra clone

Tùy strategy:

- `text-fast`: so tỷ lệ text và text node.
- `essential/full`: so text, node, text element, media và element count.
- `scan-media`: yêu cầu ít nhất một media đã clone.

Capture lưu cả fingerprint nguồn và fingerprint clone. Báo cáo cuối liệt kê trang có text hash không khớp để người dùng có thể chọn **Quét lại trang nghi vấn**.

## Giới hạn

Fingerprint là kiểm tra cấu trúc và tính đầy đủ, không chứng minh ý nghĩa học thuật của nội dung. Nó chủ yếu phát hiện mất chữ, mất media, DOM chưa tải hoặc clone thiếu node.
