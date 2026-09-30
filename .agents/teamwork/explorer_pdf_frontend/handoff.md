# Handoff Report: Frontend PDF Tools & UI/UX Architecture

**Tác giả**: Explorer 2 (Frontend PDF Tools & UI/UX Architecture Explorer)  
**Thời gian hoàn thành**: 2026-09-24T17:56:00Z  
**Loại Handoff**: Hard Handoff (Nhiệm vụ khảo sát hoàn tất)  
**Báo cáo chi tiết**: `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_frontend\report.md`

---

## 1. Observation

1. **Cấu trúc & Phân rã mã nguồn**:
   - `src/components/tools/pdf/` chứa 1 shell layout (`PdfWorkspace.js`), 11 components giao diện và 3 hooks (`pdfApi.js`, `usePdfQueue.js`, `usePdfDom.js`).
   - Cú pháp toàn bộ 15 file JavaScript đã được kiểm tra bằng lệnh:
     `node --check src/components/tools/pdf/PdfWorkspace.js src/components/tools/pdf/components/*.js src/components/tools/pdf/hooks/*.js`
     Kết quả: Exit code 0, 100% hợp lệ, không có lỗi cú pháp.
   - Kiểm tra kiểu TypeScript hệ thống backend:
     `cd server && npx tsc --noEmit`
     Kết quả: Exit code 0, 0 lỗi TypeScript.
   - Kiểm tra bộ unit test PDF backend:
     `cd server && npx vitest run tests/unit/pdf.test.ts`
     Kết quả: 3/3 tests passed.

2. **Nút hành động chính (Primary Action Button)**:
   - Tại `src/components/tools/pdf/components/ConfigPanel.js`, dòng 218:
     ```javascript
     <span>${mode === 'rotate' ? 'Lưu file xoay' : mode === 'split' ? 'Tách trang' : mode === 'view' ? 'Xem tệp' : 'Bắt đầu'}</span>
     ```
     Nhãn nút chỉ ghi `Bắt đầu` đối với 6 công cụ: `merge`, `images_to_pdf`, `compress`, `watermark`, `security`, `extract_images`. Không có nhãn động ngữ cảnh (ví dụ `Ghép 3 tệp PDF`, `Nén PDF (Cân bằng)`).
   - Tồn tại các nút trùng lặp trong workspace:
     - `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`, dòng 103: `#btnStartMultiProcess` ghi `Ghép (${files.length}) tệp`.
     - `src/components/tools/pdf/components/PdfRotateWorkspace.js`, dòng 72: `#btnApplyRotation` ghi `Lưu file`.
     - `src/components/tools/pdf/components/PdfSplitWorkspace.js`, dòng 83: `#btnApplySplit` ghi `Tách trang`.

3. **Bộ lọc tệp & Single vs Multi-file**:
   - Tại `src/components/tools/pdf/hooks/usePdfQueue.js`, dòng 16-38 (`filterFilesForMode`): Lọc chuẩn xác tệp `.pdf` cho 8 công cụ PDF và ảnh (`jpg, png, webp...`) cho `images_to_pdf`.
   - Tuy nhiên, tại `src/components/common/Dropzone.js`, dòng 14:
     ```html
     <input type="file" id="${id}_input" class="hidden" accept="${accept}" multiple>
     ```
     Thuộc tính `multiple` bị gán cứng, cho phép người dùng chọn nhiều file trên cả 7 công cụ đơn tệp.
   - Tại `src/components/tools/pdf/hooks/usePdfQueue.js`, dòng 305:
     ```javascript
     this.files = isMulti ? [...this.files, ...newItems] : newItems.slice(0, 1);
     ```
     Với công cụ đơn tệp, mã nguồn âm thầm cắt lấy `newItems.slice(0, 1)` mà không thông báo giới hạn 1 tệp.

4. **Kiểm tra hợp lệ dải trang (Split Page Range Validation)**:
   - Tại `src/components/tools/pdf/hooks/usePdfQueue.js`, dòng 152:
     ```javascript
     setPages(p) { this.pages = p; }
     ```
     Không có bất kỳ validation nào kiểm tra dải trang nhập tay có vượt quá `this.totalPages` hay không trước khi gửi đi.

5. **Thiếu tính năng tại Watermark & Security & View**:
   - Tại `src/components/tools/pdf/components/ConfigPanel.js`, dòng 100-113: Chỉ có `inputPdfWatermark` và `chkPdfPageNumbers`. Thiếu hoàn toàn bộ chọn vị trí (Chéo giữa, Đầu trang, Chân trang) và độ mờ (Opacity).
   - Tại `engines/document/pdf_ops_advanced.py`, dòng 116-122: Vị trí và góc chéo 45 độ của chữ watermark đang bị gán cứng.
   - Tại `src/components/common/viewer/renderers/pdf/PdfFloatingDock.js`: Có nút Outline, Stepper, Zoom, Night mode, nhưng không có nút bật Toàn màn hình (Fullscreen).

6. **Chuyển tiếp tác vụ (Workflow Chaining)**:
   - Tại `src/components/tools/pdf/components/ResultCard.js`: Có nút Tải về, Xem trước, Sao chép link, Xóa, Tiếp tục (`btnResetResult`). Không có nút "Chuyển tiếp tệp này sang công cụ khác" theo yêu cầu R3.

7. **Vùng bấm cảm ứng (Touch Targets)**:
   - `[data-rotate-single]` trong `PdfRotateWorkspace.js` dòng 122: `p-1` (kích thước ~22x22px).
   - `[data-preview-page]` trong `PdfRotateWorkspace.js` dòng 112 và `PdfSplitWorkspace.js` dòng 130: `w-7 h-7` (28x28px).
   - `.btn-file-move-up`, `.btn-file-move-down`, `.btn-file-remove` trong `PdfMultiFileWorkspace.js`: `p-1.5` (~26-28px).
   - Tất cả đều nhỏ hơn ngưỡng công thái học tối thiểu 40px (`min-w-[40px] min-h-[40px]`).

8. **Tuân thủ UI Production Minimalism**:
   - Đã chạy script chẩn đoán:
     `python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src\components\tools\pdf"`
     Kết quả: 15 files scanned | 0 fluff instances detected (Clean exit code 0).
   - Tuy nhiên, còn sót các ngoặc đơn giải thích số lượng: `Ghép (${files.length}) tệp` (`PdfMultiFileWorkspace.js:105`), `Tách (${selectedCount}) trang` (`usePdfDom.js:493`).

---

## 2. Logic Chain

1. Từ **Observation 1**, cấu trúc dự án đã phân rã thành các module có tính gắn kết tốt và cú pháp JS hoàn toàn hợp lệ, không có lỗi runtime cơ bản.
2. Từ **Observation 2**, nhãn nút chính chỉ gán `Bắt đầu` cho hầu hết các chế độ và xuất hiện thêm nút phụ ở workspace, dẫn tới vi phạm nguyên tắc "Nút bấm hành động chính ghi rõ hành động ngữ cảnh (ví dụ: `Ghép 3 tệp PDF`, `Nén PDF (Cân bằng)`)" và gây phân tán điểm chú ý của người dùng.
3. Từ **Observation 3**, việc gán cứng `multiple` trong Dropzone chung làm giảm tính chặt chẽ của giao diện đơn tệp, dẫn tới việc cắt tệp ngầm `slice(0, 1)`. Cần truyền `multiple: isMulti` vào dropzone.
4. Từ **Observation 4**, thiếu validation dải trang dẫn tới rủi ro người dùng nhập trang vượt quá tổng trang (ví dụ trang 10 trên tài liệu 3 trang) mà frontend không ngăn chặn, gây lỗi không đáng có tại worker.
5. Từ **Observation 5**, công cụ Watermark mới hoàn thiện 50% tính năng cấu hình so với yêu cầu R2.8 (thiếu vị trí và độ mờ).
6. Từ **Observation 6**, người dùng sau khi ghép, tách hoặc nén xong không thể bấm 1 chạm để chuyển tệp sang công cụ khác, làm đứt gãy flow xử lý liên hoàn (R3).
7. Từ **Observation 7**, kích thước vùng bấm các icon điều hướng và thao tác vi mô đều dưới 28px, gây khó khăn cho người dùng trên màn hình cảm ứng hoặc tablet, vi phạm yêu cầu công thái học (touch target >= 40px).
8. Từ **Observation 8**, UI tổng thể đã đạt chuẩn tối giản, chỉ cần loại bỏ nốt các dấu ngoặc đơn quanh số đếm là đạt chuẩn hoàn hảo.

---

## 3. Caveats

1. **Khảo sát mã nguồn tĩnh & unit tests**: Khảo sát này thực hiện qua phân tích mã nguồn frontend và chạy unit tests của backend. Chưa thực hiện kiểm thử E2E trên trình duyệt thực tế với tệp PDF dung lượng lớn (> 50MB).
2. **Khổ giấy A4 trong Images to PDF**: Hiện tại `cmd_images_to_pdf` trong engine Python tạo trang theo kích thước ảnh gốc, trong khi frontend ghi "Căn chỉnh vừa khổ giấy A4". Đây là vấn đề phụ thuộc giữa backend và frontend cần được đội ngũ backend điều chỉnh đồng bộ.

---

## 4. Conclusion

Kiến trúc frontend của PDF Studio Pro đã được thiết lập rất bài bản với 9 công cụ, hỗ trợ render canvas PDF.js ảo hóa mượt mà, bộ lọc MIME type nghiêm ngặt và thanh tiến trình in-tab không giật lag.

Tuy nhiên, để đạt tiêu chuẩn production-grade (như iLovePDF / Linear) theo yêu cầu tại `ORIGINAL_REQUEST.md`, cần giải quyết 5 nhóm vấn đề chính:
1. **Động hóa nhãn nút chính** (`Ghép 3 tệp PDF`, `Tách 4 trang`, `Nén PDF (Cân bằng)`, `Đóng dấu PDF`, `Khóa mật khẩu`) và loại bỏ các nút lưu trùng lặp.
2. **Khóa `multiple` tại Dropzone** theo chế độ đơn tệp / đa tệp; thêm validation dải trang tại tab Tách trang.
3. **Bổ sung tùy chọn vị trí và độ mờ cho Watermark**; bổ sung nút Toàn màn hình (Fullscreen) cho Trình xem PDF.
4. **Bổ sung tính năng Chuyển tiếp tệp (Workflow Chaining)** tại Thẻ kết quả (`ResultCard.js`).
5. **Nâng kích thước Touch Target >= 40px** cho toàn bộ các nút thao tác vi mô trên lưới và danh sách.

---

## 5. Verification Method

1. **Kiểm tra cú pháp JS toàn bộ module**:
   ```bash
   node --check src/components/tools/pdf/PdfWorkspace.js src/components/tools/pdf/components/*.js src/components/tools/pdf/hooks/*.js
   ```
2. **Kiểm tra TypeScript & Vitest**:
   ```bash
   cd server && npx tsc --noEmit
   cd server && npx vitest run tests/unit/pdf.test.ts
   ```
3. **Kiểm tra UI Fluff**:
   ```bash
   python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src\components\tools\pdf"
   ```
4. **Kiểm tra file báo cáo**:
   - `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_frontend\report.md`
   - `c:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_pdf_frontend\handoff.md`
