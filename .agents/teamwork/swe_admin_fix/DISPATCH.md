## 2026-10-11T22:39:16Z
You are the SWE Light Orchestrator for DuyDev Studio.

Your working directory is:
`c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\swe_admin_fix`

The authoritative user request is recorded in:
`c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md`

## Task Overview
Hoàn thiện trang quản trị Admin Mission Control của DuyDev Studio, triệt tiêu toàn bộ các cảnh báo lỗi giả (false-positive errors), chuẩn hóa bộ lọc telemetry và đảm bảo trang điều hành phản ánh chính xác 100% tình trạng vận hành thực tế của hệ thống.

Working directory: `c:\Users\AnhDuy\Code\Project\DD Studio`
Integrity mode: development

## Requirements

### R1. Phân loại chuẩn xác & Loại bỏ lỗi giả trong Failed Jobs Inspector
- Phân biệt rõ rệt giữa lỗi hệ thống thực sự (core engine crash, missing dependencies, worker timeout, database unhandled exception) với các trường hợp tác vụ bị người dùng chủ động huỷ (`USER_CANCELLED`), tệp đầu vào rỗng hoặc sai cấu trúc do người dùng (`BAD_INPUT`), hoặc kiểm tra link Drive chưa công khai (`ACCESS_RESTRICTED`).
- Gán nhãn và mức độ nghiêm trọng chính xác: Chuyển các lỗi do người dùng từ màu đỏ `CRITICAL` sang mức độ `INFO` hoặc `USER_ACTION` để người quản trị không bị báo động giả.

### R2. Chuẩn hóa Telemetry & Trạng thái Thẻ AI Agents (Fallback Recovery)
- Khi một tác vụ AI gặp trục trặc ở key chính nhưng đã tự động kích hoạt key dự phòng (fallback key) thành công và hoàn tất công việc, hệ thống không tính đó là lỗi thất bại toàn cục.
- Ghi nhận trạng thái chính xác: `FALLBACK_RECOVERED` (hiển thị badge vàng/xanh kèm thông tin key dự phòng đã cứu vãn), không gắn cờ đỏ `504 ERR` gây hiểu nhầm rằng hệ thống AI bị lỗi.

### R3. Tách biệt Nhiễu Quét Bot khỏi Thống kê Sức Khỏe Traffic (Noise Isolation)
- Lọc và tách riêng các truy vấn dò quét tự động từ bot ngoài Internet (các mã 404 cho URL rác như `/wp-login.php`, `.env`, `/phpmyadmin`, hoặc 403 do IP bị chặn) ra khỏi công thức tính tỷ lệ lỗi chung của hệ thống.
- Chỉ số Tỷ lệ Lỗi (Error Rate %) và Trạng thái Sức khỏe Web (System Health) phải phản ánh đúng chất lượng phục vụ cho người dùng thực trên các route nghiệp vụ hợp lệ.

### R4. Tối ưu Hiển thị & Trạng thái Trực tiếp của Queues và Dịch vụ Phụ Trợ
- Đảm bảo khi các hàng đợi (PDF, Converter, Quiz) hoặc Redis đang rỗng (0 tác vụ đang chờ), bảng điều khiển hiển thị trạng thái sẵn sàng (`IDLE / READY`) thay vì báo lỗi mất kết nối giả mạo.
- Các nút tương tác quản trị (Retry failed job, reset traffic, dọn rác, tối ưu database) phản hồi tức thì với toast thông báo rõ ràng, không phát sinh ngoại lệ trong JavaScript console.

## Acceptance Criteria

### Tính chính xác của Phân loại Lỗi & Telemetry
- [ ] Các tác vụ do người dùng huỷ hoặc tệp lỗi người dùng không bị gán cờ `CRITICAL` trong Bảng Lịch sử Lỗi; hiển thị rõ nhãn phân loại (Lỗi người dùng vs Lỗi hệ thống).
- [ ] Cuộc gọi AI được cứu vãn thành công qua API Key fallback hiển thị trạng thái `FALLBACK_RECOVERED`, không kích hoạt chỉ số lỗi đỏ trên thẻ AI Agents.
- [ ] Các truy vấn 404 từ scanner ngoài không làm biến dạng chỉ số sức khỏe hệ thống (System Health).

### Kiểm thử & Tương thích Kỹ thuật (Verification)
- [ ] Bộ kiểm thử tự động `server/tests/unit/admin_false_positive_elimination.test.ts` (hoặc tương đương) được bổ sung và pass 100%.
- [ ] Biên dịch TypeScript toàn bộ backend (`npm --prefix server run build`) đạt 0 lỗi typecheck.
- [ ] Kiểm tra cú pháp JavaScript frontend (`node --check`) đạt 0 lỗi cú pháp.
- [ ] Triển khai lên máy chủ homeserver `192.168.2.171`, khởi động lại dịch vụ `dd-studio.service` thành công, kiểm tra `curl http://192.168.2.171:3000/api/v1/health` đạt HTTP 200 UP.

Regularly update `progress.md` in your working directory. When complete, deliver your handoff report to me.
