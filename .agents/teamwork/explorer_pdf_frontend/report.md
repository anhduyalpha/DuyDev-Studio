# Báo Cáo Khảo Sát Kiến Trúc Frontend PDF Studio & UI/UX Standards

**Dự án**: DuyDev Studio (DS)  
**Thời gian khảo sát**: 2026-09-24T17:55:00Z  
**Người thực hiện**: Explorer 2 (Frontend PDF Tools & UI/UX Architecture Explorer)  
**Trạng thái**: Hoàn tất khảo sát toàn diện (Investigation Complete)  
**Mục tiêu**: Rà soát hiện trạng 9 công cụ PDF, bộ lọc tệp, flow 4 bước, thanh tiến trình & khóa chuyển tab, dọn dẹp tài nguyên, touch targets, phím tắt và tuân thủ UI Production Minimalism.

---

## 1. Tổng Quan Kiến Trúc & Cấu Trúc Mã Nguồn Frontend PDF

### 1.1. Cấu Trúc Thư Mục & Phân Tách Trách Nhiệm (SoC)
Mã nguồn frontend của module PDF Studio Pro được tổ chức chặt chẽ trong `src/components/tools/pdf/` với các tầng rõ ràng:

```
src/components/tools/pdf/
├── PdfWorkspace.js                      # Shell giao diện hợp nhất (< 70 dòng)
├── components/
│   ├── PdfModeSelector.js              # Thanh chuyển 9 tab chế độ (< 40 dòng)
│   ├── DropzoneQueue.js                # Bộ điều phối Workspace/Dropzone (< 110 dòng)
│   ├── ConfigPanel.js                  # Panel cấu hình & thanh tiến trình (< 230 dòng)
│   ├── ResultCard.js                   # Thẻ kết quả xử lý (< 70 dòng)
│   ├── PdfErrorBanner.js               # Banner cảnh báo lỗi (< 20 dòng)
│   ├── PdfHistoryList.js               # Danh sách lịch sử xử lý (< 190 dòng)
│   ├── PdfRotateWorkspace.js           # Lưới xoay trang 4x2 & tương tác (< 195 dòng)
│   ├── PdfSplitWorkspace.js            # Lưới tách trang 4x2 & dải trang (< 205 dòng)
│   ├── PdfPageLightboxModal.js         # Modal phóng to trang độ nét cao (< 215 dòng)
│   ├── PdfMultiFileWorkspace.js        # Workspace sắp xếp danh sách tệp (< 115 dòng)
│   └── PdfViewerInline.js              # Trình đọc PDF nhúng (< 50 dòng)
└── hooks/
    ├── pdfApi.js                       # HTTP client upload & job dispatch (< 100 dòng)
    ├── usePdfQueue.js                  # State machine & queue orchestrator (< 465 dòng)
    └── usePdfDom.js                    # Quản lý DOM events & in-place DOM sync (< 615 dòng)
```

**Thành phần phụ trợ liên quan**:
- `src/utilities/pdfJsHelper.js`: Quản lý nạp động PDF.js worker (`/pdfjs/build/pdf.worker.js`) và render canvas thumbnail.
- `src/components/common/viewer/renderers/PdfRenderer.js`: Trình đọc PDF canvas chuyên sâu kèm Floating Dock HUD và Outline Drawer.
- `src/components/common/viewer/renderers/pdf/`:
  - `PdfCanvasViewer.js`: Engine cuộn liên tục, render canvas ảo hóa với `IntersectionObserver`.
  - `PdfFloatingDock.js`: HUD điều khiển nổi (chuyển trang, zoom, chế độ đêm).
  - `PdfOutlineDrawer.js`: Ngăn kéo mục lục tài liệu.
- `src/pages/ToolPage.js`: Điểm định tuyến chính, chuyển tiếp các hash route (`pdf-studio`, `pdf-merge`, `pdf-lock`, `pdf-convert`) vào `PdfWorkspace`.

### 1.2. Đánh Giá Kích Thước File & Chống Monolith
- Hầu hết các file giao diện presentation (`PdfWorkspace`, `PdfModeSelector`, `DropzoneQueue`, `ResultCard`, `PdfViewerInline`) đều rất gọn gàng (< 120 dòng), tuân thủ tốt nguyên tắc Single Responsibility.
- `usePdfDom.js` (615 dòng) và `usePdfQueue.js` (465 dòng) chứa toàn bộ logic điều phối và gắn sự kiện DOM. Tuy chưa đến mức God File nhưng có dấu hiệu phình to do phải gánh in-place re-rendering cho cả 9 công cụ. Cần giữ tính gắn kết cao, tránh chia nhỏ cơ học làm gãy luồng xử lý.

---

## 2. Khảo Sát Chi Tiết 9 Công Cụ PDF Studio Pro

Bảng tổng hợp hiện trạng đối chiếu theo yêu cầu tại `ORIGINAL_REQUEST.md`:

| STT | Công Cụ | Chế Độ Tệp | Hiện Trạng Triển Khai | Mức Độ Tuân Thủ | Điểm Cần Khắc Phục / Nâng Cấp |
|:---:|:---|:---:|:---|:---:|:---|
| 1 | **Ghép PDF** (`merge`) | Multi-file | Đã có `PdfMultiFileWorkspace`, nút Di chuyển Lên/Xuống, Thêm tệp, Xóa tệp, tổng dung lượng. | ⚠️ 80% | - Chưa có kéo thả đổi thứ tự HTML5 drag-and-drop.<br>- Tồn tại 2 nút bắt đầu trùng lặp (`btnStartMultiProcess` và `btnStartProcess`).<br>- Nút bấm có dấu ngoặc `Ghép (${files.length}) tệp`. |
| 2 | **Tách trang** (`split`) | Single-file | Đã có lưới 4x2 (8 trang/view), Lightbox phóng to, nút chọn Tất cả/Chẵn/Lẻ/Bỏ chọn, dải trang `1-3, 5`. | ⚠️ 85% | - **Chưa bắt lỗi dải trang vượt quá tổng số trang** trên frontend.<br>- Nút bấm hiển thị `Tách (${selectedCount}) trang` (dính dấu ngoặc).<br>- Touch target con mắt và checkbox còn nhỏ (< 30px). |
| 3 | **Xoay trang** (`rotate`) | Single-file | Đã có lưới 4x2, xoay từng trang (+90°), xoay tất cả (+90° / -90°), đặt lại, Lightbox xoay trực tiếp, gửi `/Rotate` dict. | ⚠️ 90% | - Nút xoay đơn trang trên thẻ có touch target nhỏ (~22px).<br>- Tồn tại nút lưu file trùng lặp (`btnApplyRotation` và `btnStartProcess`). |
| 4 | **Ảnh sang PDF** (`images_to_pdf`) | Multi-file | Đã có upload nhiều ảnh, preview thumbnail ảnh, điều chỉnh thứ tự, lọc ảnh. | ⚠️ 70% | - Text UI ghi "Căn chỉnh vừa khổ giấy A4" nhưng **backend Python chưa resize/center về A4 (595x842 pt)** mà đang lấy nguyên kích thước ảnh.<br>- Chưa có tùy chọn hướng trang hoặc lề. |
| 5 | **Nén PDF** (`compress`) | Single-file | Đã có 3 preset: Nén cao, Cân bằng, Nén nhẹ. Thẻ kết quả hiển thị dung lượng trước/sau và % tiết kiệm. | ⚠️ 90% | - Nút hành động chính tại ConfigPanel chưa hiển thị nhãn động theo preset (chỉ ghi `Bắt đầu` thay vì `Nén PDF (Cân bằng)`). |
| 6 | **Trích ảnh** (`extract_images`) | Single-file | Đã có giao diện đơn tệp, kết nối backend xuất `.zip`. | ⚠️ 90% | - Nút hành động ghi chung chung `Bắt đầu` thay vì `Trích xuất ảnh`. |
| 7 | **Xem PDF** (`view`) | Single-file | Đã có viewer canvas liên tục, Floating Dock HUD, Outline, Night mode, nạp cMap/standard fonts. | ⚠️ 85% | - **Thiếu nút Toàn màn hình (Fullscreen)** trên thanh công cụ Floating Dock.<br>- Touch target các nút trên dock còn nhỏ (~28px). |
| 8 | **Watermark** (`watermark`) | Single-file | Chỉ mới có ô nhập text watermark và checkbox đánh số trang (`chkPdfPageNumbers`). | ❌ 50% | - **Thiếu hoàn toàn bộ chọn vị trí** (Chéo giữa trang, Đầu trang, Chân trang).<br>- **Thiếu bộ chỉnh độ mờ (Opacity)**.<br>- Backend Python đang fix cứng tọa độ chéo giữa và màu xám cố định. |
| 9 | **Bảo mật** (`security`) | Single-file | Đã có 2 tab Đặt mật khẩu (`lock`) và Gỡ mật khẩu (`unlock`), ô nhập mật khẩu. | ⚠️ 80% | - Chưa có lựa chọn thuật toán mã hóa AES-128 / AES-256 (mặc định backend đang dùng AES-256).<br>- Nút hành động chỉ ghi `Bắt đầu` thay vì `Khóa mật khẩu` / `Gỡ mật khẩu`. |

---

## 3. Khảo Sát Bộ Lọc Tệp & Xử Lý Đơn Tệp vs Đa Tệp

### 3.1. Cơ Chế Lọc Tệp Đầu Vào (`filterFilesForMode`)
Trong `src/components/tools/pdf/hooks/usePdfQueue.js`:
- Với `images_to_pdf`: Kiểm tra MIME type `image/*` hoặc đuôi mở rộng trong danh sách: `jpg, jpeg, png, webp, avif, gif, bmp, tiff, tif, svg`.
- Với 8 công cụ PDF còn lại: Kiểm tra nghiêm ngặt `mime === 'application/pdf' || ext === 'pdf'`.
- Khi người dùng kéo thả tệp không hợp lệ:
  - Nếu toàn bộ tệp bị từ chối: Bật toast cảnh báo rõ ràng (`Chỉ chấp nhận tệp định dạng PDF (.pdf)` hoặc `Chỉ chấp nhận tệp hình ảnh...`).
  - Nếu tệp hợp lệ lẫn tệp không hợp lệ: Bật toast thông báo số lượng tệp đã bỏ qua.
  - **Đánh giá**: Hoạt động chuẩn xác, ngăn chặn được tệp lạ (.exe, .docx, .zip) kéo thả vào.

### 3.2. Quản Lý Đơn Tệp vs Đa Tệp & Khiếm Khuyết Tại Dropzone
- **Phân loại chế độ**:
  - Đa tệp: `merge`, `images_to_pdf` (`isMulti = true`).
  - Đơn tệp: 7 công cụ còn lại (`isMulti = false`).
- **Khiếm khuyết phát hiện**:
  1. Trong `src/components/common/Dropzone.js`: Thẻ `<input type="file" ... multiple>` bị gán cứng thuộc tính `multiple` trong template. Do đó khi ở chế độ đơn tệp (như Nén, Tách, Xoay), hộp thoại mở file của hệ điều hành vẫn cho phép người dùng quét chọn nhiều tệp. Khi người dùng chọn nhiều tệp, hàm `addFiles` trong `usePdfQueue.js` tự động cắt lấy `newItems.slice(0, 1)` mà không cảnh báo người dùng rằng chế độ này chỉ nhận 1 tệp.
  2. Nút "Thêm tệp" trong `PdfMultiFileWorkspace.js` (`#inputAddMoreFiles`) đã có `accept` và `multiple` đúng chuẩn, tuy nhiên chưa có cơ chế kéo thả trực tiếp tệp mới vào danh sách đã có.

---

## 4. Khảo Sát Flow Thao Tác 4 Bước (UX Flow)

### 4.1. Bước 1: Nạp Tệp (File Drop / Upload)
- **Điểm tốt**:
  - Khi chưa có tệp: Render dropzone sạch sẽ, có hiệu ứng đổi viền/nền khi hover/kéo đè.
  - Khi đã có tệp: Chuyển ngay sang thẻ tệp hoặc lưới làm việc tương ứng (Zero Blind Spot).
  - Có nút "Đổi tệp" (`#btnChangeSingleFile`, `#btnChangeRotateFile`, `#btnChangeSplitFile`) hoặc "Xóa tất cả", giúp người dùng nạp tệp khác tức thì mà không phải F5.
- **Tồn tại**:
  - Thẻ tệp đơn chưa hiển thị trực quan tỷ lệ/kích thước trang hoặc thông tin bảo mật (có mã hóa hay không) trước khi vào bước 2.

### 4.2. Bước 2: Cấu Hình Trực Quan (Visual Configuration & WYSIWYG)
- **Điểm tốt**:
  - Panel cấu hình (`ConfigPanel.js`) nằm gọn ở cột bên phải, phản ánh tức thời các thông số kỹ thuật (tổng số trang, số trang đã xoay, số trang đã chọn).
  - Tương tác WYSIWYG trên lưới thumbnail ở tab Xoay và Tách rất mượt mà: bấm vào thẻ trang là xoay ngay canvas và hiện badge góc xoay; bấm vào trang tách là bật checkbox và viền amber.
  - Lightbox modal cho phép phóng to trang kiểm tra chi tiết trước khi quyết định xoay hoặc tách.
- **Tồn tại**:
  - Tab Watermark còn thiếu cấu hình vị trí và độ mờ.
  - Tab Tách trang chưa có kiểm tra ràng buộc dải trang nhập tay (nhập `999` không báo đỏ ô input).

### 4.3. Bước 3: Thực Thi Rõ Ràng (Primary Action Button)
- **Khiếm khuyết nghiêm trọng (Critical UX Flaw)**:
  1. **Nhãn nút không động theo ngữ cảnh**: Nút chính trong `ConfigPanel.js` dòng 218 chỉ kiểm tra đơn giản:
     ```javascript
     mode === 'rotate' ? 'Lưu file xoay' : mode === 'split' ? 'Tách trang' : mode === 'view' ? 'Xem tệp' : 'Bắt đầu'
     ```
     Dẫn đến:
     - Nén PDF: chỉ hiển thị `Bắt đầu` (yêu cầu: `Nén PDF (Cân bằng)`).
     - Ghép PDF: chỉ hiển thị `Bắt đầu` (yêu cầu: `Ghép 3 tệp PDF`).
     - Đóng dấu: chỉ hiển thị `Bắt đầu` (yêu cầu: `Đóng dấu PDF`).
     - Bảo mật: chỉ hiển thị `Bắt đầu` (yêu cầu: `Khóa mật khẩu` hoặc `Gỡ mật khẩu`).
     - Trích ảnh: chỉ hiển thị `Bắt đầu` (yêu cầu: `Trích xuất ảnh`).
  2. **Trùng lặp nút hành động (Duplicate Action Buttons)**:
     - Tại `PdfMultiFileWorkspace.js`: Có nút `#btnStartMultiProcess` ở chân danh sách.
     - Tại `PdfRotateWorkspace.js`: Có nút `#btnApplyRotation` trên thanh toolbar.
     - Tại `PdfSplitWorkspace.js`: Có nút `#btnApplySplit` trên thanh toolbar.
     Trong khi đó, ở cột bên phải `ConfigPanel.js` luôn có nút `#btnStartProcess`. Việc có 2 nút thực thi cùng lúc trên 1 màn hình gây bối rối cho người dùng và không tuân thủ quy chuẩn tập trung nút hành động.

### 4.4. Bước 4: Thẻ Kết Quả Đa Năng (Result Card)
- **Điểm tốt**:
  - Hiển thị đầy đủ: tên file thành phẩm, thời gian xử lý, kích thước trước/sau và tỷ lệ % tiết kiệm.
  - Các nút: Tải về, Xem trước, Sao chép liên kết, Xóa vào thùng rác, Tiếp tục.
- **Tồn tại**:
  - **Thiếu hoàn toàn tính năng "Chuyển tiếp tệp này sang công cụ khác" (Workflow Chaining)** theo yêu cầu R3. Khi xử lý xong 1 tệp (ví dụ ghép 3 PDF thành 1), người dùng không thể chuyển tiếp ngay tệp vừa ghép sang tab Nén hoặc Đóng dấu mà phải tải về rồi tải lên lại.

---

## 5. Khảo Sát Đồng Bộ Trạng Thái, Công Thái Học & Quản Lý Tài Nguyên

### 5.1. Thanh Tiến Trình & Khóa Chuyển Tab Trong Lúc Xử Lý
- **Thanh tiến trình tức thì**: Nằm ngay trong `ConfigPanel.js` tại tab hiện tại, hiển thị tiến độ % và nhãn công đoạn thực tế (kết nối qua SSE / Polling). Không bị chuyển tab hoặc giật màn hình.
- **Khóa chuyển tab**:
  - Trong `usePdfDom.js` và `usePdfQueue.js`: Đã có chặn sự kiện click và hiển thị toast warning nếu `isProcessing === true`.
  - **Điểm yếu**: Chưa cập nhật giao diện của các tab chế độ sang trạng thái disabled (`opacity-50 cursor-not-allowed pointer-events-none`). Người dùng vẫn thấy các tab sáng rõ và chỉ biết bị khóa khi bấm vào.

### 5.2. Quản Lý Tài Nguyên & Dọn Dẹp Bộ Nhớ (Resource Lifecycle)
- **Điểm tốt**:
  - `removeFile` và `clearFiles` trong `usePdfQueue.js` đã thực hiện `URL.revokeObjectURL(f.localUrl)` và gọi `f.cachedDoc.destroy()`.
  - `closePdfPageLightbox` đã gỡ bỏ listener `keydown`.
  - `PdfCanvasViewer` sử dụng `IntersectionObserver` để giải phóng canvas của những trang đã cuộn khuất tầm nhìn, tránh tràn RAM (OOM).
- **Điểm yếu**:
  - Khi tác vụ đang chạy (`isProcessing = true`), nếu người dùng nhấn chuyển trang qua menu chính của DD Studio hoặc đóng tab, kết nối SSE `activeEventSource` và bộ đếm polling trong `watchJobProgress` **không có cơ chế hủy (abort)** do `usePdfQueue.js` không lưu giữ hàm `cleanup` trả về từ `watchJobProgress`.

### 5.3. Công Thái Học: Vùng Bấm (Touch Targets) & Phím Tắt
- **Kích thước vùng bấm (Touch Target Size)**:
  - **Vi phạm tiêu chuẩn >= 40px**:
    - Nút xoay đơn trang trên thẻ (`[data-rotate-single]`): Kích thước thực tế chỉ ~22x22px (`p-1` + icon `w-3.5 h-3.5`).
    - Nút con mắt xem toàn màn hình (`[data-preview-page]`): Kích thước 28x28px (`w-7 h-7`).
    - Nút di chuyển lên/xuống và xóa trong danh sách tệp (`.btn-file-move-up`, `.btn-file-move-down`, `.btn-file-remove`): Kích thước ~26x26px (`p-1.5`).
    - Nút phân trang (Trang trước/Trang sau): Chiều cao chỉ ~28px (`py-1.5`).
    - Các nút trên Floating Dock PDF: Kích thước ~28x28px (`p-1.5`).
  - **Khuyến nghị**: Toàn bộ các nút bấm tương tác cảm ứng cần có vùng bấm tối thiểu `min-h-[40px] min-w-[40px]` (có thể giữ icon nhỏ nhưng tăng padding hoặc đặt kích thước khung bấm chuẩn).
- **Phím tắt**:
  - Lightbox đã hỗ trợ phím `Esc` để đóng, phím mũi tên `←` / `→` để lật trang trước/sau.
  - Trình xem PDF nội tuyến (`PdfCanvasViewer`) chưa có phím tắt điều hướng nhanh (PageUp/PageDown, Home/End, `+` / `-` zoom).

---

## 6. Khảo Sát Tuân Thủ UI Production Minimalism & Anti-Filler Rules

### 6.1. Quét Tự Động Bằng Script Chẩn Đoán
- Đã thực thi script kiểm tra `scan_ui_fluff.py` trên toàn bộ thư mục `src/components/tools/pdf/`:
  - **Kết quả**: 15 files scanned | 0 fluff instances detected. Đạt Clean exit code 0.
  - Không có câu quảng cáo tiếp thị sáo rỗng (*"Sẵn sàng in ấn qua Zalo..."*, *"Độ nét cao"*...).

### 6.2. Rà Soát Thủ Công Các Ngoặc Đơn & Chú Thích Nghiệp Dư
Phát hiện một số trường hợp dùng dấu ngoặc đơn không cần thiết, làm giảm tính đanh thép của giao diện:
1. `PdfMultiFileWorkspace.js` dòng 105: `Ghép (${files.length}) tệp` và `Ghép (${files.length}) ảnh` -> Cần sửa thành: `Ghép ${files.length} tệp PDF` / `Ghép ${files.length} ảnh`.
2. `usePdfDom.js` dòng 493: `Tách (${selectedCount}) trang` -> Cần sửa thành: `Tách ${selectedCount} trang`.
3. `PdfRotateWorkspace.js` dòng 89 & `PdfSplitWorkspace.js` dòng 99: `(Hiển thị 1 - 8 / 15 trang)` -> Cần bỏ ngoặc: `Hiển thị 1 - 8 / 15 trang`.

---

## 7. Đề Xuất Kế Hoạch Chuẩn Hóa & Danh Sách Công Việc Cho Đội Ngũ Thực Thi

### Ưu tiên 1: Chuẩn Hóa Logic Xử Lý & Bộ Lọc
1. **Bộ lọc Dropzone**: Truyền cờ `multiple: isMulti` vào `renderDropzone` để hộp thoại tệp chỉ cho phép chọn 1 tệp đối với 7 công cụ đơn tệp.
2. **Kiểm tra dải trang Tách trang**: Viết hàm validate range `validatePageRange(input, totalPages)` trên frontend; nếu nhập trang vượt quá `totalPages` (ví dụ nhập `1-10` trên file 5 trang) thì hiển thị cảnh báo đỏ và vô hiệu hóa nút Tách.
3. **Chuẩn hóa A4 cho Ảnh sang PDF**: Phối hợp với backend để cập nhật `cmd_images_to_pdf` tự động scale ảnh vừa khổ A4 (595x842 pt), căn giữa trang theo đúng cam kết giao diện.

### Ưu tiên 2: Tối Ưu Hóa Flow 4 Bước & Nút Hành Động Động
1. **Động hóa nhãn nút chính trong `ConfigPanel.js`**:
   - Merge: `Ghép ${files.length} tệp PDF`
   - Images to PDF: `Ghép ${files.length} ảnh sang PDF`
   - Split: `Tách ${selectedSplitPages.size} trang`
   - Rotate: `Lưu ${rotatedCount} trang đã xoay`
   - Compress: `Nén PDF (${presetLabel})`
   - Extract Images: `Trích xuất ảnh (.zip)`
   - Watermark: `Đóng dấu PDF`
   - Security: `Khóa mật khẩu` / `Gỡ mật khẩu`
   - View: `Xem PDF`
2. **Hợp nhất nút hành động**: Loại bỏ các nút lưu/thực thi phụ ở workspace chính (`btnStartMultiProcess`, `btnApplyRotation`, `btnApplySplit`), dồn toàn bộ quyền kích hoạt về nút chính tại `ConfigPanel` (hoặc đồng bộ trạng thái và nhãn 100% giữa hai vị trí).
3. **Thêm tính năng Chuyển tiếp (Workflow Chaining) vào `ResultCard.js`**: Thêm nút menu "Chuyển tiếp tệp sang..." để đưa tệp kết quả trực tiếp sang công cụ PDF khác (Nén, Đóng dấu, Bảo mật) mà không cần tải lại.

### Ưu tiên 3: Hoàn Thiện Tùy Chọn Cấu Hình Cho Watermark & Security
1. **Bổ sung controls cho Watermark**:
   - Thêm bộ chọn vị trí: `Chéo giữa`, `Đầu trang`, `Chân trang`.
   - Thêm thanh trượt / bộ chọn độ mờ (Opacity): `15%`, `30%`, `50%`, `70%`.
   - Cập nhật payload gửi sang API backend `/api/v1/jobs/pdf`.
2. **Bảo mật**: Thêm radio chọn chuẩn mã hóa `AES-256` (Khuyên dùng) / `AES-128`.

### Ưu tiên 4: Nâng Cấp Công Thái Học & Quản Lý Vùng Bấm
1. **Tăng kích thước Touch Target**: Cập nhật toàn bộ các nút bấm nhỏ (`[data-rotate-single]`, `[data-preview-page]`, các nút phân trang, nút di chuyển tệp) đạt chuẩn tối thiểu `min-w-[40px] min-h-[40px]`.
2. **Khóa trực quan tab chế độ**: Khi `isProcessing === true`, thêm class `opacity-40 cursor-not-allowed pointer-events-none` lên các nút tab chế độ.
3. **Bổ sung nút Toàn màn hình**: Thêm icon `maximize` vào Floating Dock của trình xem PDF để mở Fullscreen native.
4. **Hủy Job khi unmount / reset**: Lưu trữ hàm `cleanup` từ `watchJobProgress` và gọi khi người dùng reset hoặc rời trang.
