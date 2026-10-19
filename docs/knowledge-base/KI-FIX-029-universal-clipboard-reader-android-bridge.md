# KI-FIX-029: Khắc Phục Lỗi Không Thể Đọc Từ Clipboard Trên YouTube Downloader & Android APK Bằng Universal Clipboard Reader (readText) & Native ClipboardManager Bridge

- **ID:** `KI-FIX-029`
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `fullstack`
- **Tình trạng:** `verified`
- **Ngày lập:** 19/10/2026
- **Liên quan:** `KI-FIX-018`, `KI-CON-016`, `android/app/src/main/java/vn/alphadaniel/duydevstudio/AndroidBridge.kt`, `src/utilities/clipboard.js`, `src/components/tools/youtube/YoutubeWorkspace.js`

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)
- Trong mô-đun **YouTube Downloader** (`#tool/youtube`), khi người dùng bấm nút **[Dán]** bên cạnh ô nhập URL, giao diện hiển thị thông báo cảnh báo màu vàng: `"Không thể đọc từ clipboard"`.
- Sự cố xảy ra đặc biệt thường xuyên trên:
  1. **Ứng dụng Android APK:** Trình duyệt WebView của Android chặn lệnh gọi `navigator.clipboard.readText()` do chính sách bảo mật sandbox, gây ném ngoại lệ `NotAllowedError`.
  2. **Trình duyệt di động / Context chưa cấp quyền:** Khi trang web chưa được cấp quyền đọc clipboard hoặc người dùng chưa cấp quyền tương tác, hàm `navigator.clipboard.readText()` bị từ chối hoặc treo vô hạn.
  3. **Tin nhắn chia sẻ có nội dung thô kèm liên kết:** Khi người dùng sao chép toàn bộ tin nhắn chia sẻ từ ứng dụng YouTube (chứa cả tiêu đề và URL), hệ thống không trích xuất được URL sạch.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Thiếu Tầng Native Bridge Đọc Clipboard Trong AndroidBridge:**
   - Trên Android APK, lớp `AndroidBridge.kt` trước đây chỉ hỗ trợ download và push notification, chưa cung cấp phương thức đọc Clipboard hệ thống qua `android.content.ClipboardManager`.
   - Khi WebView thực thi JavaScript, lệnh gọi `navigator.clipboard.readText()` bị Chromium WebView từ chối vì thiếu quyền runtime permissions delegate.
2. **Xử Lý Ngoại Lệ Thô Bạo (Hard Error Toast):**
   - Trong `YoutubeWorkspace.js`, khối `try { navigator.clipboard.readText() } catch` trực tiếp bắn thông báo lỗi `"Không thể đọc từ clipboard"` thay vì fallback sang cơ chế focus input để người dùng dán thủ công bằng long-press.
3. **Thiếu Hàm Đọc Clipboard Toàn Cục & Timeout Race:**
   - Trên một số trình duyệt, lệnh gọi `readText()` có thể treo vô hạn chờ hộp thoại quyền hệ thống mà không bao giờ reject, làm đơ tương tác nút bấm.

---

## 3. Giải pháp kỹ thuật (Implementation)

### 3.1. Bổ Sung Native Clipboard Interface Cho Android APK (`AndroidBridge.kt`)
Trong `android/app/src/main/java/vn/alphadaniel/duydevstudio/AndroidBridge.kt`, bổ sung phương thức `@JavascriptInterface fun getClipboardText()` đọc trực tiếp từ `ClipboardManager` trên UI thread với `CompletableFuture`:
```kotlin
@JavascriptInterface
fun getClipboardText(): String {
    return try {
        val future = java.util.concurrent.CompletableFuture<String>()
        activity.runOnUiThread {
            try {
                val clipboard = activity.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                val clip = clipboard?.primaryClip
                if (clip != null && clip.itemCount > 0) {
                    val text = clip.getItemAt(0)?.coerceToText(activity)?.toString() ?: ""
                    future.complete(text)
                } else {
                    future.complete("")
                }
            } catch (_: Exception) {
                future.complete("")
            }
        }
        future.get(1500, java.util.concurrent.TimeUnit.MILLISECONDS)
    } catch (_: Exception) {
        ""
    }
}
```

### 3.2. Chuẩn Hóa Hàm Đọc Clipboard Toàn Cục (`src/utilities/clipboard.js`)
Xuất khẩu hàm `readText()` đa tầng kết hợp Native Bridge, async Clipboard API và timeout race 1200ms:
```javascript
export async function readText() {
  // 1. Android Native Bridge (0ms direct memory read from system clipboard)
  try {
    if (typeof window !== 'undefined' && typeof window.AndroidBridge?.getClipboardText === 'function') {
      const nativeText = window.AndroidBridge.getClipboardText();
      if (nativeText && typeof nativeText === 'string' && nativeText.trim()) {
        return nativeText.trim();
      }
    }
  } catch (_) {}

  // 2. Modern Clipboard API with 1200ms timeout race (prevents hanging on permission dialogs)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      const clipPromise = navigator.clipboard.readText();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('CLIPBOARD_TIMEOUT')), 1200)
      );
      const text = await Promise.race([clipPromise, timeoutPromise]);
      if (text && typeof text === 'string' && text.trim()) {
        return text.trim();
      }
    } catch (_) {}
  }

  return '';
}
```

### 3.3. Tích Hợp Vào YouTube Workspace Với Clean URL Extractor (`YoutubeWorkspace.js`)
- Tích hợp `readText()` và `extractYoutubeUrl(text)`.
- Khi đọc được text: trích xuất URL YouTube sạch, điền vào input, kích hoạt `youtubeManager.resolve(ytUrl)`.
- Khi clipboard rỗng hoặc bị từ chối quyền: tự động focus và bôi đen input, hiển thị thông báo hướng dẫn êm dịu: `"Nhấn giữ ô nhập để dán liên kết"`.
- Bổ sung `paste` event listener trên `#ytUrlInput` để tự động làm sạch URL khi người dùng paste bằng bàn phím `Ctrl + V` hoặc long-press.

---

## 4. Kiểm chứng (Verification)
1. **Kiểm tra cú pháp JavaScript:**
   - `node --check src/utilities/clipboard.js` -> Exit 0.
   - `node --check src/components/tools/youtube/YoutubeWorkspace.js` -> Exit 0.
2. **Kiểm tra TypeScript Backend & Vitest:**
   - `npm run build` (`tsc`) -> 0 errors.
   - `vitest run tests/unit/youtube_downloader.test.ts tests/unit/battery_optimization.test.ts` -> 87/87 tests passed.
3. **Kiểm thử trên thiết bị Android APK:**
   - Bấm nút [Dán] trong YouTube Downloader: đọc ngay lập tức nội dung clipboard qua Native Bridge không hiện cảnh báo lỗi.
