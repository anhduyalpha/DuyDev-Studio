# KI-FIX-022: Khắc Phục Lỗi PWA Kẹt Màn Hình Khởi Động Do Sai Lệch Hoa Thường (Case Sensitivity) Của ES Module Trên Máy Chủ Linux

---

## 1. Metadata
- **ID:** `KI-FIX-022`
- **Tiêu đề:** Khắc Phục Lỗi PWA Kẹt Màn Hình Khởi Động Do Sai Lệch Hoa Thường (Case Sensitivity) Của ES Module Trên Máy Chủ Linux
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `fullstack`
- **Tình trạng:** `verified`
- **Tags:** `pwa`, `es-modules`, `linux`, `case-sensitive`, `fastify-static`, `boot-watchdog`, `404-not-found`
- **Ngày ghi nhận:** 2026-10-14
- **Tác giả:** DuyDev Studio Engineering

---

## 2. Triệu chứng & Bối cảnh (Symptoms & Context)
Người dùng truy cập vào PWA (`studio.duydev.cloud` hoặc `192.168.2.171:3000`) gặp màn hình khởi động bị kẹt sau 4 giây kèm thông báo:
> *"Đang khởi động DuyDev Studio... Khởi động lâu hơn bình thường... [Tải lại] [Làm mới toàn bộ cache]"*

Dù bấm *"Tải lại"* hay *"Làm mới toàn bộ cache"* thì ứng dụng vẫn không thể khởi động vào Dashboard, trong khi chạy trên máy dev Windows cục bộ thì hoàn toàn không phát hiện lỗi gì.

---

## 3. Nguyên nhân gốc rễ (Root Cause Analysis)

### 3.1. Sự khác biệt giữa File System Windows (NTFS) và Linux (ext4)
1. **Môi trường Development (Windows 11 / NTFS):**
   Hệ điều hành Windows có hệ thống tập tin NTFS mặc định là **Case-Insensitive** (không phân biệt hoa thường). Khi một tệp có tên thật trên đĩa là `adminAuth.js`, việc gọi `import { ... } from './utilities/AdminAuth.js'` vẫn được Windows giải quyết trơn tru. Lệnh `node --check src/app.js` cũng vượt qua thành công.

2. **Môi trường Production (Linux Homeserver Ubuntu / ext4):**
   Hệ thống tập tin ext4 trên Linux là **Case-Sensitive** (phân biệt nghiêm ngặt chữ hoa và chữ thường).
   Khi trình duyệt nạp `src/app.js`, engine ES Module của trình duyệt gửi request HTTP:
   `GET /src/utilities/AdminAuth.js`
   Fastify Static plugin trên máy chủ Linux tìm kiếm tệp `AdminAuth.js`, không thấy tệp khớp chữ hoa `A`, và trả về **HTTP 404 Not Found**.

### 3.2. Hiệu ứng sập chuỗi Bootstrapper (Boot Chain Collapse)
1. Khi request module `AdminAuth.js` bị 404, toàn bộ quá trình parse/evaluate `src/app.js` bị huỷ bỏ (Module Link Error).
2. Lệnh `App.boot()` ở cuối `src/app.js` không bao giờ được gọi.
3. Biến cờ `window.__dsAppReady` không bao giờ được gán thành `true`.
4. Sau 4000ms, bộ hẹn giờ watchdog dự phòng trong `index.html` kích hoạt:
   ```javascript
   setTimeout(function() {
     var loader = document.getElementById('appStartupLoader');
     if (loader && !window.__dsAppReady) {
       // Hiển thị 'Khởi động lâu hơn bình thường...' kèm 2 nút cứu hộ
     }
   }, 4000);
   ```

---

## 4. Giải pháp khắc phục (Targeted Fix & Verification)

### 4.1. Chuẩn hóa đường dẫn import chữ thường đồng bộ
Sửa lại tất cả các câu lệnh import từ chữ hoa `AdminAuth.js` sang đúng tên tệp thực tế trên đĩa `adminAuth.js`:
- `src/app.js`:
  ```javascript
  // Trước:
  import { isAdminAuthenticated } from './utilities/AdminAuth.js';
  // Sau:
  import { isAdminAuthenticated } from './utilities/adminAuth.js';
  ```
- `src/utilities/visitorTracker.js`:
  ```javascript
  // Trước:
  import { isAdminAuthenticated } from './AdminAuth.js';
  // Sau:
  import { isAdminAuthenticated } from './adminAuth.js';
  ```

### 4.2. Nâng version cache PWA (v22.71)
Đồng bộ nâng phiên bản cache từ `v22.70` lên `v22.71` tại `sw.js`, `index.html`, và `src/utilities/pwa.js` để Service Worker xóa sạch cache tệp lỗi và nạp ngay bộ mã nguồn chuẩn hóa.

### 4.3. Bằng chứng kiểm thử (CLI Evidence)
- Kiểm tra trực tiếp trên máy chủ Homeserver (`192.168.2.171`):
  ```bash
  curl -I -s http://192.168.2.171:3000/src/utilities/adminAuth.js
  # Kết quả: HTTP/1.1 200 OK
  
  curl -I -s http://192.168.2.171:3000/src/utilities/AdminAuth.js
  # Kết quả: HTTP/1.1 404 Not Found
  ```
- Toàn bộ 41 unit tests trong `pwa_lifecycle.test.ts` và `admin_visitor_sessions.test.ts` đều PASS.
- Health check `GET /api/v1/health` đạt `{"status":"UP"}`.

---

## 5. Quy tắc phòng ngừa tái diễn (Defense-in-Depth)
1. **Quy ước đặt tên file & import:** Mọi tệp tiện ích trong `src/utilities/` tuân thủ quy ước `camelCase.js` (ví dụ: `adminAuth.js`, `deviceId.js`, `visitorTracker.js`).
2. **Kiểm tra Case-Sensitivity trước khi commit:**
   Khi thêm import mới trên Windows, luôn kiểm tra tên tệp chính xác bằng `git ls-files` hoặc `ls src/...` để đảm bảo 100% khớp chữ hoa/chữ thường.
