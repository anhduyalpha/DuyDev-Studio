# 07 — Chế độ Tự nhận diện

## Chế độ duy nhất trên giao diện

Người dùng chỉ thấy và sử dụng **Tự nhận diện**. Popup, phím tắt, hàng đợi và message công khai luôn khởi động với giá trị `auto`; không còn lựa chọn thủ công Chữ thuần, Cân bằng, Hình, Scan hay Toàn vẹn.

## Bộ phân loại theo từng trang

Trong renderer vẫn tồn tại các **chiến lược nội bộ** để Tự nhận diện tối ưu từng trang:

- `text`: trang chủ yếu là chữ, không phụ thuộc media.
- `balanced`: trang có chữ và một lượng hình vừa phải.
- `visual`: trang có SVG, canvas, công thức hoặc nhiều lớp đồ họa.
- `scan`: trang chủ yếu là ảnh toàn trang.
- `integrity`: cấu hình kiểm tra nghiêm ngặt còn được giữ trong lõi để hỗ trợ kiểm thử và bảo trì, nhưng entry point phát hành không gọi trực tiếp.

Các tên trên là chi tiết triển khai, không phải mode người dùng. `classifyPageMode()` đánh giá profile của mỗi trang rồi chọn chiến lược. Fingerprint và retry đảm bảo chiến lược nhanh không được dùng khi có nguy cơ mất dữ liệu.

## Lý do giữ chiến lược nội bộ

Gộp tất cả thành một thuật toán duy nhất sẽ khiến trang chữ chậm như trang scan hoặc khiến trang phức tạp bị xử lý quá nhẹ. Giao diện chỉ có một chế độ, còn renderer tự điều phối nhiều chiến lược để đạt cả tốc độ và độ toàn vẹn.
