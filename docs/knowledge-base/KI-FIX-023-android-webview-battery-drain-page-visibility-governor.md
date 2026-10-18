# KI-FIX-023: Khắc Phục Hiện Tượng Hao Pin Nghiêm Trọng Trên Android APK Bằng Strict WebView Sleep, Adaptive Refresh Rate & Global Page Visibility Governor

---

## 1. Metadata
- **ID:** `KI-FIX-023`
- **Tiêu đề:** Khắc Phục Hiện Tượng Hao Pin Nghiêm Trọng Trên Android APK Bằng Strict WebView Sleep, Adaptive Refresh Rate & Global Page Visibility Governor
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `fullstack`
- **Tình trạng:** `verified`
- **Tags:** `android`, `webview`, `battery-drain`, `wake-lock`, `ltpo`, `120hz`, `visibilitychange`, `css-compositor`
- **Ngày ghi nhận:** 2026-10-15
- **Tác giả:** DuyDev Studio Engineering

---

## 2. Triệu chứng & Bối cảnh (Symptoms & Context)
Người dùng ứng dụng Android APK (`vn.alphadaniel.duydevstudio`) phản hồi thiết bị bị tụt pin nhanh chóng và nóng máy cả khi đã khóa màn hình hoặc chuyển app xuống chạy nền:
1. Pin sụt 5%–10% mỗi giờ dù không thao tác với máy.
2. Màn hình 120Hz/144Hz luôn bị ép chạy ở tần số quét cao nhất, không tự động hạ về 60Hz/10Hz (LTPO) khi giao diện đứng yên.
3. Các tiến trình JavaScript và kết nối mạng ngầm (heartbeat, telemetry, polling) vẫn tiếp tục bắn request liên tục khi màn hình tắt.

---

## 3. Nguyên nhân gốc rễ (Root Cause Analysis)

### 3.1. WebView Native Không Vào Trạng Thái Ngủ Khi Chạy Nền
1. Trong `MainActivity.kt`, khi ứng dụng bị backgrounded (`onPause`/`onStop`), nếu không gọi đầy đủ `webView.onPause()` và `webView.pauseTimers()`, Chromium Web Engine bên dưới tiếp tục chạy bộ đếm thời gian (timers), nạp JS và duy trì IPC pipeline.
2. Khi destroy Activity, nếu không gọi `webView.destroy()` và bóc tách View khỏi ViewGroup, tiến trình render của WebView bị rò rỉ bộ nhớ.
3. Cờ `FLAG_KEEP_SCREEN_ON` nếu bị giữ lại sẽ ngăn chặn cơ chế Android Doze Mode.

### 3.2. Khóa Cứng Tần Số Quét 120Hz (Static Refresh Rate Lock)
Hàm `unlockHighRefreshRate()` gán `window.attributes.preferredDisplayModeId = maxMode.modeId` ép tấm nền màn hình luôn render ở 120Hz cố định, ngăn bộ điều khiển hiển thị (SurfaceFlinger và hardware LTPO) tự động hạ tần số quét xuống 10Hz–60Hz khi người dùng không chạm vào màn hình.

### 3.3. Polling Telemetry Không Throttle Khi `document.hidden`
1. `visitorTracker.js` và `AdminPage.js` gửi heartbeat và poll API telemetry liên tục mỗi 3s–25s ngay cả khi tab/app đang bị ẩn (`document.visibilityState === 'hidden'`), liên tục đánh thức modem Wi-Fi/5G (Radio Wake-ups).
2. Chu kỳ heartbeat quá ngắn trên thiết bị di động (25s) gây tiêu hao năng lượng radio.

### 3.4. Vòng Lặp Vẽ GPU Vô Hạn Trong CSS (`animate-ping`, `@keyframes`)
Các icon trạng thái và dock tiến trình sử dụng CSS `animate-ping` hoặc `animate-pulse` vô hạn. Ngay cả khi app ẩn, bộ compositor GPU vẫn phải rasterize các frame hoạt họa liên tục.

---

## 4. Giải pháp & Triển khai Kỹ thuật (Remediation Architecture)

### 4.1. Lifecycle Sleep & Adaptive Refresh Rate Trong Android Native
1. **Strict Lifecycle Hooks (`MainActivity.kt`):**
   - Trong `onPause()` và `onStop()`: xóa cờ `FLAG_KEEP_SCREEN_ON`, gọi `webView.onPause()` và `webView.pauseTimers()`.
   - Trong `onDestroy()`: gọi `webView.destroy()` và gỡ WebView khỏi View hierarchy.
2. **Adaptive LTPO Refresh Rate:**
   Gán `params.preferredDisplayModeId = 0` (chế độ hệ thống mặc định). Android SurfaceFlinger sẽ tự động tăng 120Hz khi người dùng vuốt chạm và hạ 10Hz/60Hz khi màn hình tĩnh.
3. **AndroidBridge Safe Wake-lock:**
   Cung cấp `setKeepScreenOn(enabled)` qua `@JavascriptInterface` để chỉ bật wake-lock khi thực sự có tác vụ chuyển đổi/tải tệp tiền cảnh đang chạy.

### 4.2. Global Page Visibility Governor Trong Frontend
1. **Central ClassList Toggle (`src/app.js`):**
   Lắng nghe `visibilitychange` và dispatch event nội bộ `ds:visibility-change`, đồng thời bật/tắt class `app-backgrounded` trên thẻ `<html>`:
   ```javascript
   document.addEventListener('visibilitychange', () => {
     const isHidden = document.hidden || document.visibilityState === 'hidden';
     document.documentElement.classList.toggle('app-backgrounded', isHidden);
     if (isHidden) {
       document.querySelectorAll('audio, video').forEach(m => { try { m.pause(); } catch {} });
       taskCoordinator.stopHeartbeat();
     } else {
       taskCoordinator.updateHeartbeatState();
     }
     window.dispatchEvent(new CustomEvent('ds:visibility-change', { detail: { hidden: isHidden } }));
   });
   ```
2. **Telemetry & Polling Suspension:**
   - Trong `visitorTracker.js`: Nhân đôi chu kỳ heartbeat trên di động/APK (50s thay vì 25s). Dừng gửi khi `document.hidden` hoặc nhận event `ds:visibility-change`/`ds:native-app-paused`. Thêm 20s debounce khi app quay lại trạng thái visible.
   - Trong `AdminPage.js` & `AdminIpTrafficManager.js`: Tự động ngừng poll khi `document.hidden` hoặc `ds:visibility-change`. Kéo dài chu kỳ 2x trên mobile (6s cho AdminPage, 16s cho traffic sessions). Hủy sạch listener khi unmount (`stopAdminPolling`).
   - Trong `Header.js`: Nhân đôi chu kỳ telemetry refresh trên mobile/APK (60s thay vì 30s) và debounce 20s khi foreground resume.
   - Trong `taskCoordinator.js`: Nhân đôi chu kỳ đồng bộ tác vụ mobile (5000ms thay vì 2500ms) và tự động bật/tắt `AndroidBridge.setKeepScreenOn` khớp với các tác vụ đang chạy thực tế trên tiền cảnh.

### 4.3. Ngừng Toàn Bộ GPU Redraw Khi Ẩn Trong CSS
1. **Global Sleep Governor (`src/styles/stitch-tokens.css`):**
   ```css
   html.app-backgrounded *,
   html.app-backgrounded *::before,
   html.app-backgrounded *::after {
     animation-play-state: paused !important;
     transition: none !important;
   }
   ```
2. **Loại Bỏ `will-change: transform` Thừa:**
   Chỉ giữ `will-change: transform` trên Header (`.glass-panel`) và BottomNav (`.glass-dock`), loại bỏ hoàn toàn khỏi các phần tử tĩnh như `body::before` và `#globalTaskDockCapsule`, triệt tiêu lãng phí VRAM trên các lớp không chuyển vị.
3. **Thay Thế Infinite Animation Bằng Static Glowing Dots:**
   Chuyển các chấm `animate-ping` và `animate-pulse` trên `GlobalTaskDock.js`, `AdminPage.js`, `AdminAiAgentsCard.js` và `AdminIpTrafficManager.js` thành chấm sáng tĩnh có chiều sâu (`shadow-[0_0_8px_rgba(16,185,129,0.7)]`).

### 4.4. Chính Sách Zero-Idle-Animation Tiền Cảnh & Tối Ưu Tần Số Quét LTPO 1Hz (Foreground GPU Optimization)
1. **Khóa Cổng Hoạt Họa `border-beam-spin` Dưới `.is-processing` & Triệt Tiêu `@property` (`studocu.css`):**
   - Loại bỏ hoàn toàn `animation: border-beam-spin ... infinite` và bộ lọc tính toán nặng `filter: blur(10px)` ở trạng thái nhàn rỗi (idle) mặc định của `.border-beam-card` và `.studocu-hero-card`.
   - Loại bỏ hoàn toàn Houdini `@property --beam-angle` (vốn ép GPU repaint conic-gradient trên từng frame). Thay thế bằng hoạt họa `transform` và `opacity` thân thiện với compositor khi thẻ workspace có class `.is-processing` (trong khi tác vụ trích xuất/tải xuống đang chạy thực sự).
   - `StudocuWorkspace.js` và `ScribdWorkspace.js` kích hoạt `.is-processing` khi bắt đầu tải và hủy sạch trong `finally`/completion/abort handlers.
2. **Triệt Tiêu Vòng Lặp `animate-pulse` & `animate-ping` Nhàn Rỗi Trên Toàn Repo:**
   - `FormatSelector.js`: Thay thế chấm nhấp nháy "Định dạng đích" bằng chấm phát sáng tĩnh có độ sâu (`shadow-[0_0_8px_rgba(99,102,241,0.6)]`).
   - `ViewSplitSliderOverlay.js`, `ViewSplitPane.js`, `ViewSplitToolbar.js`, `useViewSplitDom.js`: Thay thế toàn bộ huy hiệu "ĐANG CHỌN" và chấm active pane nhấp nháy bằng viền sắc nét tĩnh và bóng phát sáng nhẹ (`shadow-[0_0_8px_rgba(6,182,212,0.25)]`), triệt tiêu 100% GPU drain khi người dùng soi so sánh ảnh.
   - `useViewSplitDom.js`: Tự động ngắt vòng lặp Canvas RAF (`renderCanvasFrame`) khi tab bị ẩn (`document.hidden`) và tự phục hồi khi tab hiển thị trở lại.
   - `StoragePage.js`, `TiktokWorkspace.js`, `ConverterProgress.js`: Khóa cờ `animate-ping` chỉ xuất hiện khi `state.isUploading`, `batchQueue.isActive` hoặc `isConverting` thực sự hoạt động; loại bỏ hoạt họa vô tận khỏi modal tĩnh (`MigrationNoticeModal.js`).

### 4.5. Khắc Phục Hiện Tượng Lệch Tâm Hào Quang & Triệt Tiêu Scroll Lag 120 FPS Trên Android (v23.48)
1. **Neo Trực Tiếp Hào Quang Vào Tâm Hộp Icon (Concentric Halo Anchor):**
   - Bọc hộp icon `.tool-accent-box` trong `<div class="relative inline-flex items-center justify-center shrink-0">`.
   - Các vòng hào quang (`.tier-icon-dual-halo`, `.tier-icon-rune-ss`, `.tier-icon-halo-ur`, `.tier-icon-solar-lr`, `.tier-astrolabe-ex`) được đặt bên trong thẻ neo với `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);`, đạt độ đồng tâm 100% tuyệt đối trên cả mobile (44px) và desktop (48px).
2. **Triệt Tiêu 4 Điểm Nghẽn GPU Khi Cuộn Trên Android:**
   - **Loại bỏ `blur-2xl`:** Thay khối bloom nền thẻ `<div class="... blur-2xl">` bằng `radial-gradient(circle, var(--accent) 0%, transparent 70%)` tĩnh, loại bỏ 40px Gaussian blur trên mỗi thẻ.
   - **Xóa `-webkit-mask-composite: xor`:** Ẩn lớp perimeter xoay conic gradient tạo offscreen FBO buffer, tận dụng viền đa sắc gốc của trình duyệt `border: 2.5px solid transparent; background: ... padding-box, linear-gradient(...) border-box`.
   - **Tách `box-shadow` khỏi vòng xoay:** Đặt quầng sáng tĩnh trên thẻ cha (`.ur-halo-aura`), vòng xoay `.ur-halo-ring` chỉ render nét đứt vector thuần túy (`will-change: transform; backface-visibility: hidden;`).
   - **Thu gọn `.tier-holo-foil-sheen`:** Thu nhỏ từ `400% x 400%` về `100% x 100%` với `translate3d` keyframes, giảm 16 lần diện tích overdraw GPU.
   - **Passive Swipe Governor (`tierViewportGovernor.js`):** Lắng nghe `touchmove`/`scroll` (`{ passive: true }`), tự động tạm dừng `animation-play-state` của các vi chuyển động khi ngón tay đang chạm vuốt và phục hồi sau 120ms mà không gây layout thrash hay repaint.

---

## 5. Quy trình Kiểm thử & Xác minh (Verification)
1. **Visual Testing:** Chụp ảnh Playwright trên viewport mobile `390x844` (`mobile_studocu_ur_light.png`, `mobile_scribd_ur_light.png`, `mobile_studocu_ur_dark.png`, `mobile_scribd_ur_dark.png`), xác nhận vòng hào quang đồng tâm 100% với hộp icon và chữ hiển thị rõ nét không bị che.
2. **Cú pháp JS & TS:** `rtk err node --check` trên tất cả file frontend đã sửa (`ToolCard.js`, `TierFrameAssets.js`, `DashboardPage.js`, `tierViewportGovernor.js`, `pwa.js`, `releaseNotes.js`, `sw.js`) đều thoát mã 0.
3. **Quy Tắc Tam Giác Phiên Bản:** Đồng bộ tuyệt đối phiên bản `duydev-studio-v23.48` qua `sw.js`, `index.html`, `pwa.js` và `releaseNotes.js`. Deploy trực tiếp lên production HTTPS (`studio.duydev.cloud`).
