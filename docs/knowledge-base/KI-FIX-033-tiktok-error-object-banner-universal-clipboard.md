# KI-FIX-033: Khắc Phục Lỗi [object Object] Trong Banner Cảnh Báo TikTok & Tích Hợp Universal Clipboard Cho Nút Dán TikTok Downloader

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)

1. **Lỗi [object Object] trên Banner Cảnh báo:**
   - Trong mô-đun **TikTok Downloader** (`#tool/tiktok-downloader`), khi xảy ra lỗi trích xuất hoặc mạng bị gián đoạn, banner cảnh báo màu đỏ hiển thị chuỗi ký tự vô nghĩa: `[object Object]`.
   - Đôi khi sau khi video đã được tải thành công, banner này vẫn còn lưu lại nếu không được xóa triệt để hoặc do đối tượng lỗi bị ép kiểu thô bạo.

2. **Nút "Dán" (Paste Button) không hoạt động:**
   - Khi bấm nút **[Dán]** bên trong ô nhập liên kết, giao diện không dán được link từ bộ nhớ tạm, đặc biệt trên thiết bị Android (qua ứng dụng PWA / APK WebView) hoặc trên các môi trường mạng LAN HTTP (`http://192.168.2.171:3000`).
   - Giao diện lập tức hiện toast thông báo `"Nhấn giữ ô nhập để dán liên kết"` mà không thực hiện hành vi dán tự động, gây hiểu nhầm nút Dán bị hỏng.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)

1. **Lỗi Ép Kiểu Object Sang String Trong Client API (`tiktokApi.js`):**
   - Fastify Global Error Handler (`server/src/api/middleware/error.middleware.ts`) trả về định dạng chuẩn hóa:
     ```json
     {
       "success": false,
       "error": {
         "code": "BAD_REQUEST_PAYLOAD",
         "message": "Không thể trích xuất video TikTok này...",
         "details": null,
         "requestId": "req-...",
         "timestamp": "..."
       }
     }
     ```
   - Trong `src/components/tools/tiktok/services/tiktokApi.js`, đoạn mã kiểm tra lỗi:
     ```javascript
     throw new Error(json.message || json.error || 'Không thể trích xuất video TikTok');
     ```
   - Vì `json.message` là `undefined`, biểu thức trả về `json.error` (vốn là một JavaScript Object `{ code: ..., message: ... }`).
   - Khi gọi `new Error(obj)`, JavaScript tự động ép kiểu `String(obj)` thành `"[object Object]"`!
   - Dẫn tới `err.message` luôn là `"[object Object]"`, hiển thị trực tiếp lên giao diện người dùng.

2. **Bỏ Quên Universal Clipboard Reader (`readText`):**
   - Trong `src/components/tools/tiktok/TiktokWorkspace.js`, nút dán gọi trực tiếp `navigator.clipboard.readText()`.
   - Trên Android WebView (APK), `navigator.clipboard.readText()` bị sandbox của Chromium chặn cứng (`NotAllowedError`).
   - Trên HTTP LAN, `navigator.clipboard` là `undefined` (chỉ khả dụng trong Secure Context `https://` hoặc `localhost`).
   - Module TikTok đã không sử dụng hàm `readText()` từ `src/utilities/clipboard.js` (được xây dựng từ `KI-FIX-029`), vốn đã hỗ trợ `window.AndroidBridge.getClipboardText()` đọc trực tiếp bộ nhớ clipboard hệ thống của Android.

---

## 3. Giải pháp kỹ thuật (Implementation)

1. **Chuẩn Hóa Trích Xuất Lỗi Trong `tiktokApi.js`:**
   ```javascript
   const errMsg = json.message ||
     (typeof json.error === 'string' ? json.error : json.error?.message) ||
     `Lỗi trích xuất video TikTok (HTTP ${res.status})`;
   throw new Error(errMsg);
   ```

2. **Phòng Vệ Đa Tầng Trong `useTiktok.js` & `TiktokWorkspace.js`:**
   - Trong `useTiktok.js`, khi `resolveVideo()` thành công, luôn đảm bảo gán `this.state.error = null`.
   - Trong `catch (err)`, trích xuất `err?.message` an toàn, loại bỏ triệt để chuỗi `"[object Object]"`:
     ```javascript
     let rawMsg = err?.message || err;
     if (typeof rawMsg === 'object' && rawMsg !== null) {
       rawMsg = rawMsg.message || rawMsg.error || JSON.stringify(rawMsg);
     }
     const cleanMsg = typeof rawMsg === 'string' && rawMsg !== '[object Object]' && rawMsg.trim()
       ? rawMsg
       : 'Không thể trích xuất liên kết TikTok này';
     this.state.error = cleanMsg;
     ```

3. **Tích Hợp `readText` Đa Tầng Cho Nút Dán:**
   - Import `readText` từ `src/utilities/clipboard.js` vào `TiktokWorkspace.js`.
   - Bấm nút dán sẽ đọc clipboard qua Android Native Bridge nếu ở trong APK, hoặc qua Async Clipboard API nếu ở trên trình duyệt.
   - Khi có dữ liệu, tự động trích xuất link TikTok, điền vào ô input, phát âm thanh click và kích hoạt phân tích video tức thì.
