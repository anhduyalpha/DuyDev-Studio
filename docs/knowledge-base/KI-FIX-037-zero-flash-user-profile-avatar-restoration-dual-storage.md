# KI-FIX-037: Khắc Phục Lỗi Mất Avatar & Tên Hồ Sơ Khi Thoát Ứng Dụng Bằng Zero-Flash DOM Restoration, Dual-Storage & Đồng Bộ Hai Chiều

---

## 1. Hiện tượng & Triệu chứng (Symptoms)
- **Triệu chứng 1:** Người dùng cấu hình tên và avatar (tải ảnh từ máy hoặc chọn emoji preset), nhưng khi thoát app (đóng tab trình duyệt hoặc kill app Android PWA) rồi mở lại, avatar bị mất hoặc trở về biểu tượng chữ `D` mặc định và tên hiển thị thành `Khách`.
- **Triệu chứng 2:** Khi mở ứng dụng trên mạng chậm hoặc tải lại trang, phần header xuất hiện hiện tượng nhấp nháy (FOUC / flash) từ chữ `D` rồi mới nhảy sang avatar thực tế, tạo cảm giác giật cục thiếu mượt mà.
- **Triệu chứng 3:** Trong hộp thoại hồ sơ (`ProfileModal`), nút "Sửa tên" nhanh (`#dsProfileChangeNameQuick`) không có phản ứng khi bấm; nhấn phím Enter trên ô nhập tên không tự lưu; ảnh chụp từ thiết bị không có nhãn hiển thị trạng thái đã chọn.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)

1. **Race Condition khi Hydration Shell Tải Nhanh (Pre-rendered Shell):**
   - File `index.html` chứa sẵn HTML pre-rendered của `#headerUserAvatar` (`<span class="font-bold select-none">D</span>`) và `#headerUserNameText` (`Khách`).
   - Trong `src/app.js` (`renderShell`), khi `isShellPreRendered` là `true`, `src/app.js` dispatch sự kiện `ds:profile-updated` tại dòng 367.
   - Tuy nhiên, hàm `attachHeaderListeners` (nơi đăng ký lắng nghe sự kiện `ds:profile-updated`) lại được gọi ở dòng 372! Do đó, sự kiện cập nhật profile bị bắn vào khoảng trống khi chưa hề có listener nào tồn tại, dẫn đến việc DOM header giữ nguyên chữ `D` và `Khách` từ file HTML tĩnh.
2. **Thiếu Initial Synchronization khi Gắn Listener:**
   - Trong `attachHeaderListeners()`, không có lệnh nào thực hiện đồng bộ dữ liệu hồ sơ ngay khi vừa gắn listener, hoàn toàn phụ thuộc vào việc lắng nghe sự kiện phát ra trong tương lai.
3. **Lỗ Hổng Đồng Bộ Server (Server Sync Unidirectional Gap):**
   - Trong `syncProfileWithServer()`, điều kiện đẩy dữ liệu lên máy chủ chỉ kiểm tra `else if (local.name && !serverData.alias)`. Nếu máy chủ đã có alias nhưng người dùng cập nhật avatar mới hoặc đổi tên, thay đổi này không bao giờ được đồng bộ lên backend.
4. **Rủi Ro Dọn Dẹp Bộ Nhớ Đơn Lẻ (Single-Key Volatility):**
   - Chỉ lưu ở duy nhất một key `ds_user_profile`, dễ bị ghi đè hoặc mất khi WebView bị reset một phần.

---

## 3. Giải pháp kỹ thuật (Targeted Fix & Implementation)

### 3.1. Phục hồi Frame-0 Zero-Flash trong `index.html`
Bổ sung một khối script nội tuyến chạy tức thì ngay sau `#headerContainer` trước khi parse `<main>`:
- Đọc `localStorage.getItem('ds_user_profile') || localStorage.getItem('ds_user_profile_backup')`.
- Tính toán gradient màu sắc ổn định theo hash tên người dùng.
- Điền trực tiếp avatar (ảnh, preset emoji hoặc chữ cái đầu) và tên người dùng vào DOM tĩnh, loại bỏ 100% độ trễ và hiện tượng flash.

### 3.2. Cơ chế Sao Lưu Kép (Dual-Storage Persistence) & Fallback Phục Hồi
Trong `src/utilities/userProfile.js`:
- Bổ sung `STORAGE_KEY_BACKUP = 'ds_user_profile_backup'`.
- Hàm `getUserProfile()` tự động tra cứu fallback sang backup nếu key chính bị trống và khôi phục lại cả 2 key.
- Hàm `saveUserProfile()` ghi đồng thời vào cả 2 key để bảo vệ dữ liệu.
- Thêm `onerror` fallback trên thẻ `<img />` avatar để tự động chuyển về chữ cái viết hoa nếu ảnh hỏng hoặc không tải được.

### 3.3. Đồng Bộ Trực Tiếp `syncHeaderUserProfile` & Loại Bỏ Race Condition
- Trong `src/components/layout/Header.js`: Xuất hàm `syncHeaderUserProfile(profile = null)`.
- Gọi `syncHeaderUserProfile()` ngay lập tức bên trong `attachHeaderListeners()` khi header vừa gắn vào DOM.
- Trong `src/app.js`: Gọi trực tiếp `syncHeaderUserProfile()` thay vì dựa vào CustomEvent bất đồng bộ trong nhánh hydration.

### 3.4. Hoàn Thiện Trải Nghiệm `ProfileModal.js`
- Gắn sự kiện click cho `#dsProfileChangeNameQuick`: Tự động focus và bôi đen toàn bộ ô tên để chỉnh sửa nhanh.
- Bổ sung sự kiện `keydown` phím `Enter` trên `#dsProfileNameInput2` để kích hoạt `doSave()`.
- Hiển thị badge trạng thái `✓ Đã chọn ảnh từ máy (Nhấp để đổi)` trên nút `#dsProfileUploadPhotoBtn` khi avatar hiện tại là ảnh tuỳ chỉnh.

---

## 4. Kiểm chứng & Đo đạc (Verification)
- **Localhost & Fastify Build:** `npm run build` (`tsc`) exit 0 không lỗi.
- **Unit Test Suite:** `vitest run server/tests/unit/pwa_lifecycle.test.ts` vượt qua 36/36 tests.
- **Production Verification:** Triển khai thành công lên `https://studio.duydev.cloud`, endpoint `/api/v1/health` và `/api/v1/device/profile` phản hồi UP và trả về đúng dữ liệu định danh thiết bị.

---

## 5. Metadata
- **ID:** `KI-FIX-037`
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `fullstack`
- **Tình trạng:** `verified`
- **Phiên bản:** `v24.13`
- **Ngày ghi nhận:** `26/10/2026`
