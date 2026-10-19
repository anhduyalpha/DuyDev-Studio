# KI-FIX-032: Đại Tu & Gia Cố Toàn Diện Trình Xem Tệp Đa Nền Tảng (Universal File Viewer Cross-Platform Resilience)

| Thuộc tính (Property) | Giá trị (Value) |
| :--- | :--- |
| **ID** | `KI-FIX-032` |
| **Loại (Type)** | `troubleshoot` |
| **Lĩnh vực (Domain)** | `fullstack` |
| **Trạng thái (Status)** | `verified` |
| **Ngày tạo (Created)** | `19/10/2026` |
| **Phiên bản áp dụng** | `duydev-studio-v23.55` |
| **Mô-đun liên quan** | `FileViewerConnector.js`, `FileViewerCore.js`, `PdfCanvasViewer.js`, `TextRenderer.js`, `DocxRenderer.js`, `SpreadsheetRenderer.js`, `sw.js`, `server/src/app.ts`, `MainActivity.kt` |

---

## 1. Triệu chứng & Vấn đề (Symptoms & Problem Statement)

1. **Lệch chuẩn tham số đầu vào (Caller Contract Mismatches):**
   - Các mô-đun trong ứng dụng (`StoragePage`, `ScribdWorkspace`, `StudocuWorkspace`, `Converter`, `HistoryPage`) truyền tham số vào trình xem tệp không đồng nhất: lúc thì truyền cặp `(url, filename)`, lúc thì đối tượng `{ url, name, path, size, mime }`, lúc thì `Blob` hoặc `File`.
   - Một số tệp tải về thiếu đuôi mở rộng rõ ràng trên URL query string, dẫn đến bị điều hướng sai vào `FallbackRenderer` hoặc hiển thị trống.

2. **Sập bộ nhớ Canvas (Android WebView Canvas Area OOM Crash):**
   - Trên các thiết bị Android màn hình độ phân giải cao (High-DPI 2.5x–3.5x), khi phóng to hoặc kết xuất trang PDF khổ lớn, diện tích Canvas (`canvas.width * canvas.height`) vượt ngưỡng an toàn của Chromium WebView (16,777,216 điểm ảnh hoặc chiều tối đa 4096px trên GPU di động), dẫn đến trang trắng xóa hoặc sập (OOM) hoàn toàn tiến trình WebView.

3. **Service Worker làm nghẽn hoặc hỏng luồng Media / Streaming:**
   - Service Worker can thiệp vào các đường dẫn `/api/v1/storage/download`, `/api/v1/viewer`, hoặc các yêu cầu có tiêu đề `Range: bytes=...`, khiến `<video>` và `<audio>` không thể tua hoặc phát mượt mà trên di động.

4. **Kẹt phím cứng Back trên Android APK:**
   - Khi modal xem tệp đang mở, nhấn nút Back phần cứng của điện thoại sẽ làm thoát ứng dụng thay vì đóng hộp thoại xem tệp.

5. **Treo luồng giao diện khi mở tệp văn bản lớn:**
   - Tệp `.txt`, `.log`, `.json` lớn hàng chục MB tải toàn bộ vào RAM khiến trình duyệt bị đơ (freezing).

---

## 2. Nguyên nhân gốc rễ (Root Causes)

- **Caller Contract Drift:** Không có lớp Normalizer trung gian gom chuẩn các biến thể đầu vào và không có bước phân tích 16 byte đầu (Magic Bytes) khi tên tệp hoặc header HTTP mơ hồ.
- **Canvas Dimension Desynchronization:** Nhân GPU trên Android WebView giới hạn kích thước kết cấu (texture limit) 4096px. Khi nhân tỷ lệ `dpr`, canvas vượt ngưỡng kết xuất nhưng viewport hiển thị không co giãn tương ứng, làm sai lệch ma trận tọa độ PDF.
- **Service Worker Interception:** `sw.js` không bypass hoàn toàn các giao thức `blob:`, các endpoint `/stream`, `/viewer`, và `Range requests`.
- **Thiếu Bridge Flag cho Android Native:** `MainActivity.kt` dựa vào việc tìm DOM id nhưng khi modal đang dựng chưa kịp bắt được thì ứng dụng đã gọi `finish()`.

---

## 3. Giải pháp kỹ thuật chuẩn hóa (Technical Implementation)

### 3.1. Bộ chuẩn hóa tham số đầu vào & Nhận diện Magic Bytes (`FileViewerConnector.js`)
- Xây dựng `ViewerConnector.normalizeViewerItem(item, maybeFilename)` hỗ trợ:
  - Cặp `(url, filename)`
  - Đối tượng `{ url, name, path, size, mime, blob, file }`
  - Instance `File` hoặc `Blob` cục bộ
  - Tự động nhận dạng 16 byte đầu qua `detectCategoryFromMagicBytes`:
    - `%PDF` $\rightarrow$ PDF
    - `\x89PNG` / `\xFF\xD8\xFF` / `RIFF....WEBP` / `GIF` $\rightarrow$ IMAGE
    - `PK\x03\x04` + `word/` $\rightarrow$ WORD, `xl/` $\rightarrow$ SHEET, `ppt/` $\rightarrow$ PRESENTATION, còn lại $\rightarrow$ ARCHIVE
    - `ID3` / `0xFF 0xFB` $\rightarrow$ AUDIO
    - `ftyp` / `\x1A\x45\xDF\xA3` $\rightarrow$ VIDEO
    - `Rar!` / `7z` $\rightarrow$ ARCHIVE

### 3.2. Thuật toán kẹp kích thước Canvas PDF chống OOM (`PdfCanvasViewer.js`)
```javascript
export function clampCanvasDimensions(viewportWidth, viewportHeight, dpr = 1) {
  const MAX_AREA = 16777216; // 16M pixels max texture buffer
  const MAX_DIM = 4096;      // Max dimension on mobile GPUs
  let targetWidth = Math.round(viewportWidth * dpr);
  let targetHeight = Math.round(viewportHeight * dpr);

  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    const scale = Math.min(MAX_DIM / targetWidth, MAX_DIM / targetHeight);
    targetWidth = Math.max(1, Math.floor(targetWidth * scale));
    targetHeight = Math.max(1, Math.floor(targetHeight * scale));
  }

  const currentArea = targetWidth * targetHeight;
  if (currentArea > MAX_AREA) {
    const areaScale = Math.sqrt(MAX_AREA / currentArea);
    targetWidth = Math.max(1, Math.floor(targetWidth * areaScale));
    targetHeight = Math.max(1, Math.floor(targetHeight * areaScale));
  }

  const finalDpr = targetWidth / viewportWidth;
  return { width: targetWidth, height: targetHeight, finalDpr };
}
```

### 3.3. Bypass triệt để Service Worker (`sw.js`)
Bỏ qua hoàn toàn bộ nhớ cache Service Worker cho mọi yêu cầu:
- `url.protocol === 'blob:'`
- `url.pathname.startsWith('/api/')`
- `url.pathname.includes('/download')`
- `url.pathname.includes('/viewer')`
- `url.pathname.includes('/stream')`
- `event.request.headers.has('range')`

### 3.4. Giới hạn đọc văn bản theo chunk 128KB (`TextRenderer.js`)
Sử dụng header `Range: bytes=0-131071` (128KB) qua `window.__ddViewerFetch` để kết xuất văn bản thô hoặc mã nguồn lớn trong $<30$ms mà không gây nghẽn UI thread.

### 3.5. Tích hợp phím cứng Android (`MainActivity.kt` & `FileViewerCore.js`)
Gán cờ toàn cục `window.__ddFileViewerOpen = true` khi modal mở và `false` khi đóng. `setupBackHandler()` trong Android Native ưu tiên kiểm tra cờ này để gọi `window.closeFileViewer()` trước khi xử lý các hành vi khác.

---

## 4. Kiểm chứng & Đo lường (Verification & Metrics)

- **Test Suite:**
  - `server/tests/unit/viewer_hardening.test.ts` (14 test suites, kiểm tra toàn bộ magic bytes, URL normalization, clampCanvasDimensions).
  - `server/tests/unit/universal_viewer.test.ts` (100% passed).
- **Typecheck & Cú pháp:**
  - `rtk npm --prefix server run build` (`tsc`): 0 lỗi.
  - `node --check` qua 16 tệp JS frontend: 0 lỗi.
- **PWA Cache Version:**
  - Đồng bộ `duydev-studio-v23.55` trên `sw.js`, `index.html`, `pwa.js`, và `releaseNotes.js`.

---

## 5. Quy tắc phòng vệ tương lai (Guardrails)

1. Khi gọi xem tệp từ bất kỳ màn hình nào, luôn dùng `ViewerConnector.preview(item)` hoặc `window.openFileViewer(item)`.
2. Không bao giờ gán trực tiếp `canvas.width = viewport.width * window.devicePixelRatio` mà không thông qua `clampCanvasDimensions`.
3. Không can thiệp vào `engines/studocu/**` theo Quy ước cách ly (Quarantine Rule).
