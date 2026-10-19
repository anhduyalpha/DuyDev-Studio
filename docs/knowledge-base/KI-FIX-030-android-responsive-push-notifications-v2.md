# KI-FIX-030: Hệ Thống Thông Báo Đẩy Android Nhạy Bén V2 & Hợp Nhất Trình Điều Phối Tác Vụ

- **ID**: `KI-FIX-030`
- **Loại**: `KI-FIX`
- **Phạm vi**: `android/` (Native Container), `src/utilities/notificationHelper.js`, `src/utilities/taskCoordinator.js`, `sw.js`
- **Trạng thái**: Đã giải quyết & Triển khai Production (`v23.54`)

---

## 1. Hiện tượng & Vấn đề (Symptoms)
- Trên ứng dụng Android (APK) và PWA trên điện thoại di động:
  - Khi người dùng tải video/âm thanh (YouTube, TikTok), tạo bài tập (Quiz), chuyển đổi file (Converter), hoặc xử lý PDF, thông báo đẩy (push notification) bị ẩn đi, rơi vào nhóm "Thông báo im lặng" (Silent notifications) ở cuối thanh thông báo, hoặc không bao giờ bật lên heads-up banner khi ứng dụng chạy ngầm/chuyển màn hình.
  - Thông báo không có âm thanh chuông mặc định, không rung, và không hiển thị trên màn hình khóa.
  - Trong Service Worker PWA, khi thông báo xuất hiện, việc bấm vào thông báo không đưa cửa sổ ứng dụng lên màn hình trước (focus).

---

## 2. Nguyên nhân cốt lõi (Root Cause)
1. **Thiếu Sound URI & AudioAttributes trên Android Notification Channel (API 26+)**:
   - `DownloadNotificationManager.kt` trước đây chỉ đặt `NotificationManager.IMPORTANCE_HIGH` nhưng không truyền `setSound(soundUri, audioAttributes)`.
   - Trên các giao diện Android OEM tùy biến (Samsung One UI, Xiaomi HyperOS, Oppo ColorOS), một kênh thông báo không có âm thanh tường minh sẽ bị xếp hạng vào nhóm "Thông báo im lặng", tự động triệt tiêu heads-up banner và ẩn khỏi màn hình khóa.
   - Các thuộc tính của `NotificationChannel` là bất biến (immutable) một khi đã được OS khởi tạo, dẫn đến việc thiết bị đã cài đặt app vẫn giữ cấu hình im lặng cũ.
2. **Thiếu thuộc tính hiển thị tối đa trong NotificationCompat.Builder**:
   - Builder thiếu `.setDefaults(NotificationCompat.DEFAULT_ALL)`, `.setCategory(NotificationCompat.CATEGORY_STATUS)`, `.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)`, và `.setPriority(NotificationCompat.PRIORITY_MAX)`.
3. **Frontend TaskCoordinator chỉ dùng in-DOM Toast**:
   - `taskCoordinator.notifyCompletion(task)` chỉ gọi `showActionableToast` và `soundEngine`, không gọi bất kỳ cơ chế native bridge hay Web Push notification nào. Khi thu nhỏ app hoặc tắt màn hình, người dùng hoàn toàn không nhận được thông báo.
4. **Service Worker thiếu sự kiện `notificationclick`**:
   - Khi thông báo web push được kích hoạt, Service Worker không có listener để focus cửa sổ hiện có hoặc điều hướng người dùng về hash route của tác vụ.

---

## 3. Giải pháp Kiến trúc (Architectural Solution)

```
[Module Tác Vụ (YouTube/TikTok/Quiz/PDF/Converter)]
         ↓
[TaskCoordinator / Module Hook]
         ↓
[src/utilities/notificationHelper.js]
    ├── (APK Native Container) ──> window.AndroidBridge.showNotification(...)
    │                                         ↓
    │                                [DownloadNotificationManager.kt]
    │                                  - CHANNEL_PUSH_ID_V2 ("ds_push_channel_v2")
    │                                  - IMPORTANCE_HIGH + DEFAULT_ALL + PRIORITY_MAX
    │                                  - Sound URI (Default notification ringtone)
    │                                  - Vibration pattern: [0, 200, 100, 200]
    │                                  - VISIBILITY_PUBLIC (Lockscreen heads-up banner)
    │                                  - Accent light: #4F46E5 (DD Studio Indigo)
    │
    └── (PWA / Web Mobile) ──────> navigator.serviceWorker.ready.showNotification(...)
                                              ↓
                                         [sw.js (notificationclick)]
                                         - Close notification
                                         - Window focus & navigate deep-link
```

### Chi tiết thay đổi:
1. **`DownloadNotificationManager.kt`**:
   - Khởi tạo kênh mới `ds_push_channel_v2` và `ds_download_channel_v2`.
   - Dọn dẹp kênh cũ `ds_push_channel` và `ds_download_channel`.
   - Thiết lập `soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)`, `AudioAttributes.USAGE_NOTIFICATION`, rung, đèn LED tím indigo, và `VISIBILITY_PUBLIC`.
   - NotificationCompat Builder sử dụng `PRIORITY_MAX`, `DEFAULT_ALL`, `CATEGORY_STATUS`.
2. **`AndroidBridge.kt` & `MainActivity.kt`**:
   - Expose `hasNotificationPermission(): Boolean`, `requestNotificationPermission()`, `openNotificationSettings()`.
3. **`src/utilities/notificationHelper.js`**:
   - Module hợp nhất xử lý kiểm tra quyền, xin quyền, fallback native/web, và các hàm tiện ích `notifyJobComplete` / `notifyJobFailed`.
4. **`src/utilities/taskCoordinator.js`**:
   - Tự động gọi `notifyJobComplete` khi chuyển trạng thái sang `completed`, và `notifyJobFailed` khi sang `error`.
5. **`sw.js`**:
   - Bổ sung `notificationclick` listener để kích hoạt lại tab khi người dùng chạm vào thông báo.

---

## 4. Kiểm chứng (Verification)
- Unit test: `server/tests/unit/android_push_notifications.test.ts` (pass 100%).
- Typecheck: `tsc` backend biên dịch 0 lỗi.
- Syntax check: `node --check` 0 lỗi trên toàn bộ các file JS frontend.
- Production deployment: Đã triển khai lên homeserver `192.168.2.171` và kiểm tra `health` endpoint HTTP 200 UP trên cả LAN và Cloudflare HTTPS (`studio.duydev.cloud`).
