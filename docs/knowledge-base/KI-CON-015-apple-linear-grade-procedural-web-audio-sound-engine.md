# KI-CON-015: Kiến Trúc Hệ Thống Âm Thanh Thủ Tục Web Audio Chuẩn Apple/Linear (Procedural Sound Engine) & Cơ Chế Tiết Kiệm Pin Tuyệt Đối (Zero-Battery Idle Governance)

---

## 1. Metadata
- **ID:** `KI-CON-015`
- **Tiêu đề:** Kiến Trúc Hệ Thống Âm Thanh Thủ Tục Web Audio Chuẩn Apple/Linear (Procedural Sound Engine) & Cơ Chế Tiết Kiệm Pin Tuyệt Đối (Zero-Battery Idle Governance)
- **Loại:** `concept`
- **Lĩnh vực:** `frontend`
- **Tình trạng:** `verified`
- **Tags:** `web-audio-api`, `sound-design`, `procedural-audio`, `battery-drain`, `ki-fix-023`, `linear-style`, `apple-pay-chime`, `zero-asset`
- **Ngày ghi nhận:** 2026-10-17
- **Tác giả:** DuyDev Studio Engineering

---

## 2. Bối cảnh & Mục tiêu Kỹ thuật (Context & Objectives)

Trong các giao diện cao cấp (macOS Sequoia, iOS Apple Pay, Linear), phản hồi âm thanh (acoustic feedback) đóng vai trò then chốt giúp trải nghiệm tương tác trở nên sống động, tinh tế và đáng tin cậy. Tuy nhiên, việc áp dụng âm thanh trên nền web và PWA thường vấp phải 3 sai lầm phổ biến:
1. **Lãng phí băng thông & IO:** Dùng file tĩnh `.mp3` hoặc `.wav` gây tốn bộ nhớ, tăng bundle size và tạo độ trễ tải mạng.
2. **Âm thanh điện tử chói gắt:** Phát sóng vuông (`square`) hoặc sóng răng cưa (`sawtooth`) 8-bit thô ráp gây khó chịu khi đeo tai nghe.
3. **Hao pin nghiêm trọng (Battery Drain):** Khởi tạo `AudioContext` giữ luồng xử lý âm thanh của hệ điều hành (Android OS audio mixer thread) luôn ở trạng thái thức (active wake), vi phạm `KI-FIX-023` và gây sụt pin ngầm khi app ở trạng thái nhàn rỗi hoặc chạy nền.

`SoundEngine.js` được thiết kế nhằm giải quyết triệt để các vấn đề trên với triết lý **Zero-Asset Procedural Synthesis** kết hợp **Strict Zero-Battery Governance**.

---

## 3. Kiến Trúc Định Hình Âm Học (Acoustic Shaping Architecture)

### 3.1. Chuỗi Xử Lý Âm Thanh Tổng Thể (Master Audio Pipeline)
Tất cả các nốt âm và dao động (oscillators) đều được định tuyến qua tầng lọc âm bão hòa ấm và khống chế biên độ an toàn trước khi truyền tới loa:

```
[Oscillator Nodes (Sine / Triangle)]
        ↓
[Individual Note Gain Node] (Smooth Attack 8ms–15ms & Exponential Decay)
        ↓
[Master Gain Node] (Peak Volume <= 0.16–0.18, Gentle on Headphones)
        ↓
[Master BiquadFilterNode] (Lowpass 2200Hz, Q: 0.7 - Warm Resonance)
        ↓
[AudioContext.destination]
```

1. **Bộ lọc thông thấp Master (`BiquadFilterNode`):** Cắt tần số trên 2200Hz với hệ số phẩm chất $Q = 0.7$ giúp triệt tiêu hoàn toàn các hài âm kỹ thuật số thô ráp, tạo độ ấm mềm mại và mượt mà.
2. **Chống tiếng nổ xung đột loa (Click/Pop Elimination):** Tuyệt đối không nhảy giá trị tức thời (`setValueAtTime(0, ...)` rồi bật âm lượng lớn). Luôn khởi đầu từ `0.0001`, ramp tuyến tính (`linearRampToValueAtTime`) trong `8ms–15ms` cho pha attack, và kết thúc bằng đường cong phân rã tự nhiên (`exponentialRampToValueAtTime(0.0001, stopTime)`).

---

## 4. Bảng Âm Sắc Đặc Trưng (Curated 6 Signature Cues)

| Tên Hàm | Sự Kiện Kích Hoạt | Thiết Kế Âm Học Chi Tiết |
| :--- | :--- | :--- |
| `playJobComplete()` / `playSuccess()` | Tác vụ chuyển đổi/tải xong 100% | Chuỗi hợp âm thủy tinh rải 4 nốt đi lên: $C_5 (523.25\text{Hz}) \to E_5 (659.25\text{Hz}) \to G_5 (783.99\text{Hz}) \to B_5 (987.77\text{Hz})$ so le $65\text{ms}$. Mỗi nốt kết hợp sóng `sine` nguyên chất và hài sóng `triangle` nhẹ, đuôi âm mượt dài $650\text{ms}$. |
| `playStart()` / `playPaste()` | Khởi chạy tải/chuyển đổi, Smart Paste | Âm bật gỗ/giọt nước ấm: tần số trượt dốc đi lên $320\text{Hz} \to 580\text{Hz}$ trong $75\text{ms}$, kèm xung rung haptic nhẹ $10\text{ms}$ (`navigator.vibrate(10)`) trên thiết bị di động. |
| `playNotification()` | Thông báo Toast thông tin/thành công | Giọt chuông đơn thanh thoát: nốt chủ $A_5 (880\text{Hz})$ kết hợp âm nền trầm ấm $A_4 (440\text{Hz})$, độ phân rã tự nhiên $280\text{ms}$. |
| `playError()` | Lỗi tác vụ hoặc thông báo cảnh báo đỏ | Tiếng gõ kép (double-tap) trầm ấm: nốt $220\text{Hz} \to 174.61\text{Hz}$ ($F_3$) qua bộ lọc riêng $900\text{Hz}$ trong $220\text{ms}$, báo lỗi dứt khoát nhưng không làm người dùng giật mình. |
| `playWarning()` | Cảnh báo trạng thái hoặc hạn chế | Âm chuyển nhẹ quãng trầm $F_4 (349.23\text{Hz}) \to D_4 (293.66\text{Hz})$, sóng tam giác êm dịu trong $180\text{ms}$. |
| `playToggle()` / `playSnap()` | Bật tắt theme, sao chép clipboard | Tiếng vi-click siêu ngắn: xung sóng sine $1100\text{Hz}$ dài $12\text{ms}$ với âm lượng micro $0.06$, mang lại cảm giác phản hồi cơ học cao cấp. |

---

## 5. Cơ Chế Tiết Kiệm Pin & Quản Trị Autoplay (Zero-Battery Governance)

Tuân thủ nghiêm ngặt chuẩn quản trị năng lượng trong `KI-FIX-023`:

### 5.1. Mobile & APK Hardware Audio Unlock
- **1-Sample Silent Buffer Prime**: Trên iOS Safari và Android Mobile WebKit/Blink, chỉ gọi `ctx.resume()` không thể mở khóa phần cứng âm thanh. `SoundEngine` tự động tạo và kích hoạt một buffer im lặng 1-sample (`createBuffer(1, 1, 22050) -> start(0)`) trong sự kiện chạm đầu tiên (`click`, `touchstart`, `touchend`, `pointerup`, `keydown`), giải phóng ngay lập tức audio hardware pipeline.
- **Android WebView `mediaPlaybackRequiresUserGesture = false`**: Cấu hình trong `MainActivity.kt` cho phép WebView chạy Web Audio API tự do mà không bị chặn khi các sự kiện bất đồng bộ (SSE, WebSocket, download/convert hoàn thành) kích hoạt chuông âm thanh từ background.

### 5.2. Quản Trị Ngủ Nhàn Rỗi Thông Minh (Smart Foreground vs Background Suspend)
- **Trên Mobile & APK**: Không tự ý suspend `AudioContext` khi app vẫn đang hiển thị ở foreground (`visibilityState === 'visible'`). Nhờ đó, các thông báo âm thanh khi tác vụ chạy xong 10-30s sau luôn phát được 100% mà không bị hệ điều hành chặn vì thiếu cử chỉ người dùng mới.
- **Tuân thủ trạng thái ẩn/chạy nền (`KI-FIX-023`)**: Ngay khi nhận sự kiện `visibilitychange` (`hidden`) hoặc `ds:native-app-paused`:
  - Lập tức gọi `audioCtx.suspend()`, giải phóng hoàn toàn luồng mixer OS (tiết kiệm 100% pin khi ẩn app).
  - Khi app mở lại (`visible` / `ds:native-app-resumed`), tự động gọi `unlockAudioContext()` để sẵn sàng phát âm thanh.
- **Trên Desktop**: Duy trì bộ đếm nhàn rỗi hào phóng 30s sau khi phát âm thanh trước khi tạm suspend.

---

## 6. Khuếch Đại Âm Lượng & Bộ Nén Dynamics Compressor (Gain Staging & Volume Control)

1. **Chuỗi Tín Hiệu Âm Thanh (Audio Signal Chain):**
   ```
   Oscillator Nodes -> MasterGain (Base 0.60 * Volume) -> MasterFilter (Lowpass 2200Hz, Q: 0.7) -> DynamicsCompressorNode -> Destination
   ```
2. **Bộ Nén Giới Hạn Tự Động (DynamicsCompressorNode):**
   - Thiết lập `threshold: -6dB`, `knee: 6`, `ratio: 4`, `attack: 0.003s`, `release: 0.15s`.
   - Ngăn chặn hoàn toàn hiện tượng méo tiếng (digital clipping) khi tăng âm lượng lên $200\% - 250\%$, đồng thời giữ cho âm sắc ấm áp, tròn trịa và rõ ràng trên loa ngoài điện thoại lẫn laptop.
3. **Cơ Chế Điều Khiển Cho Admin & User:**
   - **Header (`#btnSoundToggle`)**:
     - 1 chạm: Bật/tắt nhanh âm thanh (Mute/Unmute).
     - Nhấp đúp, nhấn giữ (>350ms trên điện thoại), hoặc chuột phải: Mở hộp thoại `SoundVolumeModal` tùy chỉnh khuếch đại từ $0\%$ đến $250\%$.
   - **Trang Cài Đặt (`#settings` - `ServerPage.js`)**:
     - Thẻ "Âm thanh & Khuếch đại" với thanh trượt volume, các nút gán sẵn $50\%, 100\%, 150\%, 200\%, 250\%$, và hệ thống nút "Nghe thử" 5 loại âm thanh trực tiếp.
     - Trạng thái lưu trong `localStorage.getItem('ds_sound_volume')` (mặc định $1.0 = 100\%$).

---

## 7. Điểm Tích Hợp & Quy Tắc Cách Ly (Integration Points & Quarantine Rules)

1. **`GlobalTaskDock.js` & `taskCoordinator.js`:**
   - Sử dụng bộ bảo vệ nguyên tử `completedTaskIds = new Set()` và phương thức `soundEngine.playJobCompleteOnce(taskId)` để đảm bảo chuông hoàn tất tác vụ chỉ ngân vang **đúng một lần duy nhất** cho mỗi tác vụ, không lặp lại khi re-render.
2. **`clipboard.js` & `toast.js`:**
   - Kích hoạt `playToggle()` khi sao chép thành công.
   - Kích hoạt `playNotification()`, `playWarning()`, `playError()` tương ứng với các biến thể Toast thông báo.
3. **`Header.js`:**
   - Nút chuyển trạng thái âm thanh `#btnSoundToggle` nằm cạnh nút giao diện sáng/tối với icon `volume-2` và `volume-x`.
   - Trạng thái lưu trữ trong `localStorage.getItem('ds_sound_enabled')` (mặc định bật) và `localStorage.getItem('ds_sound_volume')`.
4. **Quy Tắc Cách Ly Studocu (Quarantine Rule):**
   - Tuyệt đối không chèn trực tiếp mã vào các tệp thuộc mô-đun `src/components/tools/studocu/`. Âm thanh hoàn tất tác vụ Studocu được điều phối tập trung thông qua `GlobalTaskDock.js` và `taskCoordinator.js`.

---

## 8. Tiêu Chuẩn Nghiệm Thu & Lệnh Xác Minh (Verification Commands)

```powershell
# 1. Chạy toàn bộ test kiểm thử SoundEngine & hồi quy
cmd /c "server\node_modules\.bin\vitest.cmd run server/tests/unit/sound_engine.test.ts server/tests/unit/global_task_dock.test.ts server/tests/unit/toast_queue.test.ts"

# 2. Kiểm tra typecheck TypeScript strict mode (Exit 0)
cmd /c "server\node_modules\.bin\tsc.cmd -p server/tsconfig.json --noEmit"
```
