# KI-FIX-024: Phòng Vệ Đa Lớp Cho Universal File Viewer: Triệt Tiêu Lỗ Hổng Iframe Sandbox, Khắc Phục Vòng Lặp Lỗi Media Decoder, Giới Hạn Dòng Text Chống Đơ Trình Duyệt & Chuẩn Hóa RFC 7233 Byte-Range Streaming

---

## 1. Metadata
- **ID:** `KI-FIX-024`
- **Tiêu đề:** Phòng Vệ Đa Lớp Cho Universal File Viewer: Triệt Tiêu Lỗ Hổng Iframe Sandbox, Khắc Phục Vòng Lặp Lỗi Media Decoder, Giới Hạn Dòng Text Chống Đơ Trình Duyệt & Chuẩn Hóa RFC 7233 Byte-Range Streaming
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `fullstack`
- **Tình trạng:** `verified`
- **Tags:** `universal-viewer`, `iframe-sandbox`, `x-content-type-options`, `byte-range`, `rfc7233`, `rfc9110`, `media-error-loop`, `large-file-guard`, `pan-zoom-touch`
- **Ngày ghi nhận:** 2026-10-16
- **Tác giả:** DuyDev Studio Engineering

---

## 2. Triệu chứng & Bối cảnh (Symptoms & Context)
Hệ thống Universal File Viewer (`FileViewerCore.js`, `FileViewerConnector.js`, các renderers trong `src/components/common/viewer/renderers/`) và các API stream tệp (`files.controller.ts`, `viewer.controller.ts`, `storage.controller.ts`, `archive.controller.ts`) gặp phải chuỗi khiếm khuyết bảo mật và độ ổn định:
1. **Lỗ hổng Sandbox Iframe HTML:** Iframe xem trước HTML do người dùng tải lên có `sandbox="allow-same-origin allow-scripts"`, cho phép mã độc bên trong truy cập trực tiếp `localStorage`, cookies và token xác thực của máy chủ cha.
2. **Vòng lặp lỗi Media vô hạn (Infinite Retry Loop):** Khi xem trước file âm thanh (`<audio>`) hoặc video (`<video>`) bị hỏng hoặc định dạng codec không được trình duyệt hỗ trợ, sự kiện `error` kích hoạt hàm retry tạo lại blob URL, dẫn đến vòng lặp vô hạn khiến CPU đạt 100% và treo tab.
3. **Treo trình duyệt với file văn bản / mã nguồn lớn:** Nạp file mã nguồn hoặc text hàng chục nghìn dòng vào highlight.js và DOM khiến RAM tăng đột biến và đơ giao diện hoàn toàn.
4. **Mất sự kiện và vỡ bố cục khi lật tệp (Directional Navigation):** Khi bấm Next/Prev chuyển giữa các loại file khác nhau (ví dụ từ PDF sang Ảnh, hoặc từ Video sang Text), listener điều khiển bị mất và chiều cao container không được co giãn chuẩn (`isFullHeight`).
5. **Backend Range Streaming lỗi HTTP 416 / NaN:** Khi trình phát media (Safari, iOS, Chromium) yêu cầu suffix byte ranges (`bytes=-N`), parser tính toán `parseInt('', 10)` thành `NaN`, đồng thời các tệp 0 byte không trả về chuẩn HTTP 416 `Content-Range: bytes */0`, và thiếu header `X-Content-Type-Options: nosniff`.

---

## 3. Nguyên nhân gốc rễ (Root Cause Analysis)

### 3.1. Iframe Sandbox Cấp Quyền Kép (Double Privilege Hazard)
Theo đặc tả HTML5 Iframe Security, việc đồng thời chỉ định `allow-same-origin` và `allow-scripts` làm vô hiệu hóa hoàn toàn cơ chế cô lập nguồn: script bên trong iframe có thể gọi `parent.localStorage` hoặc gửi request cùng origin với cookie của người dùng.

### 3.2. Media Error Re-dispatch Loop
`AudioRenderer.js` và `VideoRenderer.js` lắng nghe sự kiện `error` trên thẻ `<audio>`/`<video>`. Khi codec không hỗ trợ hoặc tệp hỏng, handler thực hiện `fetch(state.viewUrl)` -> `URL.createObjectURL(blob)` -> gán lại `element.src`. Vì chính blob đó cũng không giải mã được, thẻ media lại phát ra sự kiện `error`, tạo ra vòng lặp đệ quy vô tận.

### 3.3. DOM & Syntax Highlight Thrashing Trên Text Lớn
`TextRenderer.js` chia toàn bộ chuỗi text thành các dòng DOM và chạy qua `hljs.highlightAuto`. Với các tệp dung lượng lớn (>3.000 - 100.000 dòng), việc chèn hàng vạn DOM nodes đồng thời làm tê liệt UI thread.

### 3.4. Byte-Range Parsing Sai Lệch & Thiếu X-Content-Type-Options
1. Khi client gửi header `Range: bytes=-500` (suffix range), chuỗi split theo `-` trả về `['', '500']`. `parseInt(parts[0], 10)` cho ra `NaN`, dẫn đến lỗi tính toán độ dài payload stream.
2. Với file 0 byte, `start >= total` kích hoạt điều kiện out-of-bounds nhưng không sinh đúng `Content-Range: bytes */0`.
3. Thiếu `X-Content-Type-Options: nosniff` khiến trình duyệt tự suy đoán MIME type đối với các file nhị phân giả mạo.

---

## 4. Giải pháp & Triển khai Kỹ thuật (Remediation Architecture)

### 4.1. Khóa Chặt Sandbox Iframe (`HtmlRenderer.js`)
Loại bỏ hoàn toàn `allow-same-origin`, giữ lại các quyền tối thiểu cần thiết để render an toàn trong origin mờ (opaque origin):
```html
<iframe sandbox="allow-scripts allow-forms allow-modals" ...></iframe>
```

### 4.2. Cắt Đứt Vòng Lặp Media Bằng Single Retry Guard (`AudioRenderer.js`, `VideoRenderer.js`)
Bổ sung cờ `hasRetried`:
```javascript
let hasRetried = false;
mediaEl.addEventListener('error', async () => {
  if (hasRetried) {
    showFallbackErrorUI();
    return;
  }
  hasRetried = true;
  // Tiến hành fetch blob dự phòng duy nhất 1 lần...
});
```

### 4.3. Giới Hạn Kép Cho Văn Bản & Mã Nguồn Lớn (`TextRenderer.js`)
Thiết lập ngưỡng an toàn kép: tối đa 3.000 dòng HOẶC 300.000 ký tự (loại trừ nguy cơ tệp minified 1 dòng dung lượng lớn làm đơ trình duyệt). Hiển thị rõ nguyên nhân cắt ngắn và loại bỏ việc cấp phát `new Blob([text])` lặp lại trong bộ nhớ.

### 4.4. Thao Tác Chạm Đa Điểm Mobile & Hồi Phục Sự Kiện (`ImageRenderer.js`)
Tích hợp gesture `touchstart`, `touchmove`, `touchend`, `touchcancel` hỗ trợ kéo rê 1 ngón (pan) và phóng to/thu nhỏ 2 ngón (pinch-to-zoom). Xử lý mượt mà quá trình nhấc 1 ngón sau khi pinch zoom để chuyển tiếp sang pan thay vì bị đơ cử chỉ, đồng thời giải phóng an toàn khi gặp `touchcancel`.

### 4.5. Cơ Chế srcdoc Cho Blob & Xử Lý Lỗi Xem Trước HTML (`HtmlRenderer.js`)
Sử dụng `srcdoc` thay cho `src="blob:..."` đối với các tệp tải lên cục bộ, khắc phục giới hạn bảo mật của trình duyệt Chrome/Firefox chặn nạp `blob:` từ origin ngoài vào sandbox opaque. Bổ sung giao diện fallback báo lỗi và chuyển sang chế độ xem mã nguồn khi render thất bại.

### 4.6. Đồng Bộ Trạng Thái Điều Khiển Khi Lật Tệp (`FileViewerCore.js`)
Quản lý `currentViewerState` tập trung: khi điều hướng Prev/Next trong thư mục/playlist, các nút "Sao chép liên kết" và "Mở tab mới" luôn tự động trỏ đúng URL và trạng thái của tệp đang hiển thị.

### 4.7. Chuẩn Hóa Streaming RFC 7232 / 7233 / 9110 & Phòng Vệ Đường Dẫn
1. Tạo module `http.utils.ts` triển khai hàm `checkETagMatch` hỗ trợ so sánh ETag yếu (`W/`), ký tự đại diện (`*`) và danh sách tag phân tách bằng dấu phẩy theo chuẩn RFC 7232.
2. Thẩm định `If-None-Match` trả về HTTP 304 Not Modified trước khi bóc tách Range, tiết kiệm băng thông.
3. Bổ sung `Cache-Control: no-cache` cho HTTP 206 Partial Content và `Cache-Control: public, max-age=600, must-revalidate` cho HTTP 200 trên các endpoint lưu trữ.
4. Gia cố `StorageManager.sanitizeSafePath`: chặn đứng tấn công Null Byte Injection (`\0`), đồng thời làm sạch basename trong `getUploadPath`, `getProcessedPath`, `getTempPath` để ngăn chặn hoàn toàn directory traversal.

### 4.8. Khử Race Condition Bằng `renderSessionId` Tuần Tự & `AbortController`
Trong `FileViewerCore.js`, mỗi lần gọi `openFileViewer` hoặc chuyển tệp (Next/Prev) sẽ tăng biến đếm nguyên tử `currentSessionId++` và kích hoạt `currentAbortController.abort()`. Các tác vụ bất đồng bộ (tải tài liệu, phân tích PDF/DOCX/XLSX, nạp ảnh, fetch range) đều truyền `abortSignal` và kiểm tra `if (thisSessionId !== currentSessionId) return;` trước khi ghi đè DOM, triệt tiêu hoàn toàn lỗi chồng lấn renderer.

### 4.9. Universal Error Boundary Fallback Card & Nút Phục Hồi Nhanh
Tất cả các renderer (`PdfRenderer`, `DocxRenderer`, `SpreadsheetRenderer`, `VideoRenderer`, `AudioRenderer`, `ArchiveRenderer`, `ImageRenderer`) đều được bọc trong cấu trúc try/catch và gắn handler lỗi chuẩn hóa gọi về `showViewerFallbackCard`. Giao diện lỗi hiển thị thông báo tiếng Việt trực quan, mã lỗi chi tiết và 2 nút hành động cứu cánh:
1. **Xem dạng Mã Hex / Văn bản thô:** Chuyển ngay sang chế độ Hex Inspector an toàn mà không làm sập modal, thiết lập lại phiên render mới (`currentSessionId++`) và cấp phát `AbortController` mới để kích hoạt tải dữ liệu Hex tức thì mà không bị kẹt `AbortError`.
2. **Tải tệp xuống máy:** Kích hoạt tải trực tiếp tệp về máy người dùng.

### 4.10. Giới Hạn Range 64KB Hex Inspector & 512KB Text Chunking Chống OOM
1. `FallbackRenderer.js` gửi request `Range: bytes=0-65535` (64KB) và áp dụng cơ chế đọc stream có chặn (`ReadableStreamDefaultReader` kết hợp `reader.cancel()`): chỉ đọc tối đa 64KB đầu tiên từ mạng rồi ngắt luồng ngay lập tức. Ngay cả khi máy chủ trả về HTTP 200 (không hỗ trợ Range) cho tệp ISO/BIN dung lượng hàng chục Gigabyte, trình duyệt cũng không bao giờ tải quá 64KB vào bộ nhớ, triệt tiêu 100% nguy cơ sập RAM / OOM.
2. `TextRenderer.js` kiểm tra kích thước tệp hoặc tệp không rõ kích thước: chỉ fetch và đọc tối đa 512KB đầu tiên (`Range: bytes=0-524287` qua stream reader bị hủy sau 512KB hoặc `blob.slice(0, 524288)`) kèm thông báo rõ ràng về số byte đã nạp, triệt tiêu hoàn toàn tình trạng đơ UI thread.
3. `VideoRenderer.js` & `AudioRenderer.js` chặn hoàn toàn việc tải Blob dự phòng khi gặp mã lỗi `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4 - codec không được hỗ trợ như HEVC, AC3, AVI) hoặc tệp đa phương tiện kích thước lớn (>20MB - 25MB), chuyển thẳng sang Fallback Card để tránh tải hàng Gigabyte video vào bộ nhớ gây crash tab.

### 4.11. Giới Hạn DPR, Kích Thước Canvas Mobile & Thu Hồi Tài Nguyên PDF.js (`PdfCanvasViewer.js`)
1. Trên các thiết bị di động có màn hình Retina/High-DPI (`window.devicePixelRatio >= 3`), canvas vẽ trang PDF độ phân giải cao có thể vượt quá giới hạn phần cứng đồ họa (vượt quá 4096px). Bổ sung cơ chế bảo vệ: nếu chiều rộng hoặc chiều cao ước tính nhân với DPR vượt quá 4096px, DPR sẽ được tự động điều chỉnh giảm xuống mức an toàn, loại bỏ triệt để hiện tượng sập bộ nhớ GPU / canvas crash trên điện thoại.
2. Lưu trữ tham chiếu `page` và gọi tường minh `page.cleanup()` khi cuộn trang ra khỏi viewport (`unrenderPage`), khi co giãn tỷ lệ (`applyScaleUpdate`) và khi hủy viewer (`destroy`), giải phóng hoàn toàn bộ nhớ cache glyphs và ảnh nhị phân trong bộ nhớ PDF.js.

### 4.12. Gia Cố LibreOffice Process & Kiểm Tra Thư Mục Hợp Lệ
Trong `viewer.service.ts`:
1. Bổ sung các cờ bảo vệ bắt buộc khi khởi tạo tiến trình LibreOffice headless: `--invisible --nologo --nodefault --nofirststartwizard --nolockcheck --norestore`.
2. Hỗ trợ ngắt toàn bộ cây tiến trình đa nền tảng (`taskkill /pid <PID> /T /F` trên Windows để diệt cả worker `soffice.bin`, hoặc `process.kill(-PID, 'SIGKILL')` trên Unix) khi hết hạn timeout (30 giây), triệt tiêu hoàn toàn tiến trình zombie chạy ngầm.
3. Phát hiện sớm lỗi tài liệu có mật khẩu bảo vệ hoặc file bị hỏng để trả về mã lỗi rõ ràng.
4. Trong `viewer.controller.ts`, kiểm tra `fs.statSync(sourcePath).isDirectory()` để từ chối chuyển đổi xem trước thư mục, tránh gây lỗi tiến trình ngoài ý muốn.

---

## 5. Kiểm thử & Xác minh (Verification Record)
- **Unit & Integration Tests:** Chạy toàn bộ test suites liên quan bằng `rtk vitest run` (`universal_viewer.test.ts`, `viewer_hardening.test.ts`, `pwa_lifecycle.test.ts`, `battery_optimization.test.ts`, `archive.test.ts`, `converter.test.ts`, `drive_import.test.ts`) - 133/133 tests PASS (0 fail).
- **TypeScript Typecheck:** `rtk tsc --noEmit` trên `server/` thành công 100% (No errors found).
- **Frontend Syntax Check:** `node --check` kiểm tra toàn bộ 12 module renderer, connector, utility và `sw.js`.
- **PWA Service Worker Cache Alignment:** Đồng bộ phiên bản `duydev-studio-v23.05` trên `sw.js`, `pwa.js`, `releaseNotes.js` và `index.html`.
