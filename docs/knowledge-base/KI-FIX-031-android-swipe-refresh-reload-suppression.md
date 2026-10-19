# KI-FIX-031: Khắc Phục Lỗi Vuốt Từ Trên Xuống Gây Reload Trang Trên Android APK Bằng Cách Vô Hiệu Hóa SwipeRefreshLayout & Chặn Pull-To-Refresh

- **ID**: `KI-FIX-031`
- **Loại**: `KI-FIX`
- **Phạm vi**: `android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt`, `android/app/build.gradle.kts`
- **Trạng thái**: Đã giải quyết & Triển khai Bản phát hành APK `v23.54.0`

---

## 1. Hiện tượng & Vấn đề (Symptoms)
- Trên ứng dụng Android Native (APK):
  - Khi người dùng đang tương tác với ứng dụng (cuộn xem trang web, duyệt tài liệu PDF, vuốt công cụ, thao tác trên YouTube Downloader hoặc Quiz Workspace) và ngón tay lướt vuốt từ trên xuống khi vị trí cuộn đang ở gần đầu trang (`scrollY <= 0`), ứng dụng bất ngờ kích hoạt vòng tròn tải lại (pull-to-refresh spinner) và reload toàn bộ WebView (`webView.reload()`).
  - Việc reload đột ngột này khiến:
    - Trạng thái công việc đang nhập dở (form input, link đã phân tích, file đang chuẩn bị xử lý) bị xóa trắng.
    - Kết nối WebSocket/SSE hoặc tiến trình tải ngầm bị ngắt quãng.
    - Trải nghiệm người dùng bị gián đoạn nghiêm trọng ("rất khó chịu").

---

## 2. Nguyên nhân cốt lõi (Root Cause)
1. **SwipeRefreshLayout mặc định kích hoạt (`isEnabled = true`)**:
   - Trong `activity_main.xml`, `SwipeRefreshLayout` bao bọc trực tiếp `WebView`.
   - Trong `MainActivity.kt` `initViews()`:
     ```kotlin
     swipeRefreshLayout.setOnRefreshListener {
         webView.reload()
     }
     ```
   - Do `swipeRefreshLayout.isEnabled` không được set thành `false`, `SwipeRefreshLayout` mặc định luôn bật và bắt mọi cử chỉ vuốt kéo xuống (`MotionEvent.ACTION_MOVE` với $\Delta Y > 0$ khi `canChildScrollUp() == false`), lập tức gọi `webView.reload()`.
2. **DD Studio là Single Page Application (PWA/SPA)**:
   - Các ứng dụng SPA hiện đại có hệ thống router nội bộ (`#hash`), cơ chế cập nhật realtime (SSE, Background Tasks, PWA Update Capsule) và các nút điều khiển trực tiếp trên UI. Việc để native pull-to-refresh reload toàn bộ WebView là phản quy chuẩn UX cho ứng dụng dạng này.

---

## 3. Giải pháp Kiến trúc Phòng Vệ Kép (Two-Layer Defense)

```
[Người dùng vuốt ngón tay từ trên xuống]
                 ↓
[Lớp 1: swipeRefreshLayout.isEnabled = false]
       ├── onInterceptTouchEvent trả về false ngay lập tức
       └── Không chiếm quyền điều khiển cảm ứng
                 ↓
[Lớp 2: setOnChildScrollUpCallback { _, _ -> true }]
       └── Báo cáo với layout rằng nội dung con luôn có thể cuộn lên
           (triệt tiêu hoàn toàn khả năng kích hoạt pull-to-refresh)
                 ↓
[Lớp 3: setOnRefreshListener { isRefreshing = false }]
       └── Loại bỏ hoàn toàn lệnh webView.reload()
                 ↓
[Cảm ứng truyền nguyên vẹn vào WebView -> Cuộn mượt mà 120Hz không bị reload]
```

### Chi tiết mã nguồn (`MainActivity.kt`):
```kotlin
// Disable swipe-to-refresh pull gesture completely to eliminate accidental page reloads
swipeRefreshLayout.isEnabled = false
swipeRefreshLayout.setOnChildScrollUpCallback { _, _ -> true }
swipeRefreshLayout.setOnRefreshListener {
    swipeRefreshLayout.isRefreshing = false
}
```

---

## 4. Kiểm chứng (Verification)
- **Unit Test**: `server/tests/unit/android_push_notifications.test.ts` kiểm tra các assertion:
  - `swipeRefreshLayout.isEnabled = false`
  - `swipeRefreshLayout.setOnChildScrollUpCallback { _, _ -> true }`
  - `build.gradle.kts` được nâng cấp lên `versionCode = 2354` và `versionName = "23.54.0"`
- **Release Automation**: Đẩy git tag `v23.54.0` kích hoạt workflow GitHub Actions `.github/workflows/build-apk.yml` để tự động biên dịch, ký số và phát hành bản APK mới nhất cho người dùng.
