---
id: KI-FIX-053
title: Khắc Phục Lỗi Tự Động Lưu Drive, Mất Thumbnail Slide, Nhận Nhầm File Video & Bổ Sung Cơ Chế Retry / Remove Lỗi 404 Trong SlideShare Downloader & Universal Viewer
type: troubleshoot
domain: fullstack
status: verified
created_at: 2026-11-10T22:36:00+07:00
updated_at: 2026-11-10T22:36:00+07:00
version: 1.0.0
trigger_conditions:
  - Khi dán liên kết SlideShare bị tự động lưu file vào Studio Drive và hiển thị nhãn giả "Đã lưu Drive"
  - Khi danh sách lịch sử SlideShare bị mất ảnh thumbnail và chỉ hiện icon xám
  - Khi mở tệp PPTX/PDF từ lịch sử bị FileViewerCore nhận nhầm là video và thông báo "Tệp video không tồn tại trên máy chủ hoặc liên kết đã hết hạn (HTTP 404)"
  - Khi tệp bị lỗi 404 trong Universal Viewer nhưng lại hiển thị nút vô ích "Xem dạng Mã Hex / Văn bản thô" thay vì cho phép tải lại hoặc xóa mục lỗi
search_queries:
  - "slideshare downloader tự lưu drive"
  - "slideshare mất thumbnail lịch sử"
  - "tệp video không tồn tại trên máy chủ slideshare pptx"
  - "lỗi 404 xem dạng mã hex universal viewer"
  - "client challenge slideshare downloader"
tags:
  - slideshare
  - universal-viewer
  - drive
  - thumbnail
  - error-recovery
  - ui-minimalism
---

# KI-FIX-053: Khắc Phục Lỗi Tự Động Lưu Drive, Mất Thumbnail Slide, Nhận Nhầm File Video & Bổ Sung Cơ Chế Retry / Remove Lỗi 404 Trong SlideShare Downloader & Universal Viewer

## 1. Hiện tượng & Triệu chứng thực tế (Symptom Description)
1. **Tự động lưu Drive & Gán nhãn giả**: Mỗi lần người dùng dán hoặc phân tích một liên kết SlideShare, hệ thống tự động chạy ngầm biên dịch và lưu file vào Studio Drive (`/slideshare`), đồng thời gán nhãn `✓ Đã lưu Drive` ngay cả khi file chưa hề được tải.
2. **Mất thumbnail trong Lịch sử**: Các mục trong lịch sử tải xuống của SlideShare chỉ hiện icon xám `<i data-lucide="presentation">` mà không hiển thị ảnh bìa slide.
3. **Nhận nhầm định dạng PPTX/PDF thành Video**: Khi người dùng nhấn "Xem" trên một mục lịch sử SlideShare bị lỗi đường dẫn hoặc đã hết hạn, modal `UniversalFileViewer` hiển thị thông báo: *"Tệp video không tồn tại trên máy chủ hoặc liên kết đã hết hạn (HTTP 404)"*.
4. **AI Slop & Nút vô nghĩa khi gặp 404**: Màn hình lỗi 404 hiển thị nút *"Xem dạng Mã Hex / Văn bản thô"* và *"Tải tệp xuống máy"*, gây khó chịu vì tệp hoàn toàn không tồn tại trên server để xem hex hay tải về máy.
5. **Lưu bản ghi rác `Client Challenge`**: Khi SlideShare trả về trang chống bot của Cloudflare (`<title>Client Challenge</title>`), hệ thống vẫn lưu mục `[SlideShare]_Client Challenge_....pptx` hỏng vào lịch sử.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)

### 2.1. Tự động lưu Drive và Fake Drive Path
- Trong `SlideshareWorkspace.js:resolvePresentation`, sau khi nhận metadata, mã nguồn tự động gọi ngầm `this.saveToDrive({ silent: true })`.
- Đồng thời, `driveRelPath` được gán cứng theo biểu thức `this.savedPptxDrivePath || `/slideshare/${pptxName}``. Khi `savedPptxDrivePath` là null, nó gán chuỗi giả `/slideshare/...`, khiến `MediaHistorySection.js` coi như tệp đã có trong Drive (`hasDrive = true`) và hiển thị nhãn `✓ Đã lưu Drive`.

### 2.2. Lỗi mất Thumbnail (`.thumb.jpg` không tồn tại)
- Trong `MediaHistorySection.js:resolveMediaCover`:
  ```javascript
  if (item.driveRelPath) {
    ...
    const thumbPath = item.driveRelPath.replace(/\.[^.]+$/, '.thumb.jpg');
    return StorageService.getDownloadUrl(thumbPath, true);
  }
  ```
  Khi `driveRelPath` được gán, hệ thống ưu tiên tìm tệp `.thumb.jpg`. Tuy nhiên, `SlideShareService.saveToDrive()` trước đây chỉ tạo file `.pdf` và `.pptx` mà không tạo `.thumb.jpg`. Khi browser gọi `.thumb.jpg` bị 404, sự kiện `onerror="this.style.display='none'"` lập tức ẩn thẻ ảnh, dẫn đến mất trắng thumbnail.

### 2.3. Nhận nhầm video & Nút Hex vô nghĩa trên 404
- Trong `MediaHistorySection.js` bộ xử lý sự kiện `data-action-preview`:
  ```javascript
  category: isAudio ? 'audio' : (isImage ? 'image' : 'video'),
  mimeType: isAudio ? 'audio/mpeg' : (isImage ? 'image/jpeg' : 'video/mp4')
  ```
  Vì file PPTX/PDF không phải `isAudio` cũng không phải `isImage`, nó bị ép cứng sang `category: 'video'` và gọi `VideoRenderer.js`.
- Khi `VideoRenderer.js` fetch URL bị 404, nó trả về thông báo cứng: *"Tệp video không tồn tại trên máy chủ hoặc liên kết đã hết hạn (HTTP 404)."* và gọi `showErrorFallback`.
- Trong `FileViewerCore.js`, `renderFallbackErrorCard` mặc định luôn render nút *"Xem dạng Mã Hex / Văn bản thô"* kể cả khi mã lỗi là 404.

---

## 3. Giải pháp kỹ thuật chuẩn hóa (Standardized Solution)

### 3.1. Chặn `Client Challenge` & Thêm Fallback oEmbed tại Backend
- Trong `SlideShareService.resolvePresentation`:
  Kiểm tra tiêu đề và mảng slide: nếu chứa `Client Challenge`, `Just a moment` hoặc `slideImages.length === 0`, tự động gọi fallback sang SlideShare oEmbed API (`https://www.slideshare.net/api/oembed/2?url=...`). Nếu vẫn thất bại, quăng `BadRequestError` ngay lập tức để không bao giờ lưu bản ghi hỏng vào lịch sử.

### 3.2. Bổ sung endpoint biên dịch tạm (`POST /api/v1/slideshare/compile`)
- Cho phép người dùng bấm **Tải PDF** hoặc **Tải PPTX** trực tiếp về máy: hệ thống biên dịch slide vào `resolvedStoragePaths.temp` và phục vụ luồng tải qua `/api/v1/slideshare/download?file=...&temp=1` mà không làm ô nhiễm Studio Drive.
- Chỉ lưu vào Drive khi người dùng chủ động bấm **"Lưu vào Drive"**.

### 3.3. Tự động xuất `.thumb.jpg` & Fallback Thumbnail thông minh
- Trong `SlideShareService.saveToDrive()`, sao chép trang slide đầu tiên (`downloadedImages[0]`) thành `[SlideShare]_${cleanTitle}_${id.slice(-8)}.thumb.jpg` vào thư mục `/slideshare/`.
- Trong `MediaHistorySection.js`, gắn thuộc tính `data-fallback` trên thẻ `<img>`. Nếu `.thumb.jpg` trên server chưa kịp tạo hoặc 404, `onerror` sẽ tự chuyển sang URL slide gốc từ CDN thay vì ẩn thẻ.

### 3.4. Chuẩn hóa phân loại tệp trong `MediaHistorySection.js`
- Nhận diện đúng `.pdf` (`category: 'pdf'`) và `.pptx` (`category: 'presentation'`).
- Không ép cứng `category: 'video'` đối với các tệp tài liệu.

### 3.5. Cơ chế Retry & Remove thông minh trong File Viewer
- Trong `FileViewerCore.js`:
  - Khi gặp lỗi 404: Ẩn nút xem Hex Dump vô nghĩa.
  - Hiển thị 2 nút tương tác:
    - **🔄 Thử tải lại từ nguồn (Retry)**: Đóng viewer và tự động kích hoạt `onReResolve` để nạp lại dữ liệu bài thuyết trình.
    - **🗑️ Xóa tệp lỗi (Remove)**: Đóng viewer và tự động chuyển bản ghi hỏng vào thùng rác.
- Trong `SlideshareWorkspace.js`: Thêm hàm `sanitizeCorruptedHistory()` tự động dọn sạch mọi bản ghi cũ chứa `Client Challenge` ngay khi khởi tạo module.

---

## 4. Tiêu chuẩn nghiệm thu (Acceptance Criteria)
1. **Zero Auto-Save to Drive**: Dán link vào SlideShare Downloader không tạo file trong `/slideshare/` và không gắn nhãn `✓ Đã lưu Drive` giả.
2. **Instant Thumbnail**: Mọi slide sau khi phân tích đều hiển thị thumbnail trang bìa rõ nét trong danh sách lịch sử.
3. **Accurate Viewer & 404 Recovery**:
   - Khi mở file tài liệu không bị gọi nhầm là "Tệp video".
   - Khi tệp bị 404, modal hiển thị 2 nút **"Thử tải lại từ nguồn"** và **"Xóa tệp lỗi"**, không còn nút Hex Dump.
4. **Purged Slop**: Giao diện gọn gàng, không chứa mô tả tiếp thị thừa.
