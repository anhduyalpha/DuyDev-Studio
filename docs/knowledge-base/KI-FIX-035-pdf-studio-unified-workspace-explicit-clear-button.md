---
id: KI-FIX-035
title: "Hợp Nhất Master Card Container Cho PDF Workspace & Chuẩn Hóa Nút Xóa Tất Cả 1-Chạm"
type: troubleshoot
domain: frontend
status: verified
created_at: 2026-10-25
updated_at: 2026-10-25
version: 1.0.0
trigger_conditions:
  - "Nút vuốt xóa trên PDF Studio gây khó thao tác hoặc trượt không ăn"
  - "Giao diện workspace PDF bị phân mảnh thành nhiều box rời rạc cạnh tranh thị giác"
  - "Người dùng phản ánh 3 card liên tiếp có kiểu dáng tương đồng nhau gây rối mắt"
search_queries:
  - "pdf studio clear all button"
  - "pdf multi-file workspace master card"
  - "slide to clear vs clear button"
  - "dropzone queue red border fix"
tags:
  - pdf-studio
  - ui-ux
  - impeccable-design
  - master-card-container
---

# KI-FIX-035: Hợp Nhất Master Card Container Cho PDF Workspace & Chuẩn Hóa Nút Xóa Tất Cả 1-Chạm

## 1. Triệu chứng & Vấn đề (Problem Statement)
1. **Rối Mắt Do Phân Mảnh Khối Thẻ (Visual Fragmentation & Sibling Card Clutter)**:
   - Trong `PdfMultiFileWorkspace.js`, giao diện bị chia thành 3 khối thẻ `div` độc lập xếp chồng lên nhau (`Header box`, `File row box`, `Google Drive import box`).
   - Cả 3 khối đều dùng chung định dạng `p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-200/80 dark:border-white/[0.08] shadow-xs`, khiến người dùng có cảm giác các khối này cạnh tranh thị giác với nhau, không rõ đâu là vùng điều khiển chính, đâu là danh sách con và đâu là phụ kiện nạp tệp.
2. **Cản Trở Thao Tác Từ Thanh Trượt Vuốt (Slide-to-Clear Ergonomics)**:
   - Thanh trượt `slideClearTrack` ("Vuốt để xóa hết") chiếm diện tích ngang lớn (44–52), yêu cầu thao tác kéo giữ liên tục dễ gây trượt hụt hoặc xung đột với cử chỉ cuộn trang trên màn hình cảm ứng di động.
3. **Thiếu Nút Xóa Đơn Lẻ Trên Các Không Gian Xoay / Tách / Sắp Xếp / Tệp Đơn**:
   - Trước đây các màn hình chỉ có nút "Đổi tệp" (`#btnChange...`), người dùng muốn xóa hẳn tệp khỏi hàng đợi để quay về Dropzone thì phải bấm đổi rồi hủy.
4. **Viền Đỏ Bất Thường Trên Dropzone Trống**:
   - Khung `pdfDropzone` và `pdfDriveImportCard` bị gán nhầm class viền nét đứt màu đỏ `border-red-500/80` tạo cảm giác trạng thái báo động hoặc lỗi ngay cả khi chưa thao tác gì.

---

## 2. Giải pháp Kiến Trúc & Thiết Kế (Solution & Visual Hierarchy)

### A. Mô Hình Master Card Container Duy Nhất (Single Surface Hierarchy)
Thay vì 3 card rời rạc lơ lửng, hợp nhất toàn bộ workspace thành **1 Master Card Container duy nhất** (`rounded-2xl border bg-white dark:bg-[#121215] shadow-xs overflow-hidden`):
- **Phân cấp 1 - Header Bar Tích Hợp**: Nền xám nhẹ (`bg-zinc-50/70 dark:bg-white/[0.02]`), ngăn cách bằng `border-b`, tích hợp badge số lượng, nút `+ Thêm tệp` và nút `Xóa tất cả` (`#btnClearAllMultiFiles`).
- **Phân cấp 2 - Khung Danh Sách Tệp Lõm Nhẹ**: Nền hơi lùi vào (`bg-zinc-50/40 dark:bg-black/20`), mỗi phần tử tệp là một hàng `rounded-xl bg-white dark:bg-[#16161a]` rõ ràng là phần tử con lồng trong thẻ.
- **Phân cấp 3 - Khay Phụ Nạp Drive Ở Đáy**: Nằm dưới đáy container, ngăn cách bằng `border-t`, xác định rõ vai trò là khay phụ trợ nạp tệp vào danh sách chứ không phải card độc lập cạnh tranh với danh sách.

### B. Chuẩn Hóa Nút Xóa Tất Cả & Xóa Tệp
Thay thế hoàn toàn cử chỉ vuốt trượt phức tạp bằng nút button màu đỏ nhạt tao nhã chuẩn Impeccable Design:
```html
<button id="btnClearAllMultiFiles" type="button"
        class="min-h-[40px] px-3.5 py-2 rounded-xl border border-red-200/80 dark:border-red-500/20 bg-red-50/80 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-[0.98]"
        title="Xóa toàn bộ tệp trong danh sách">
  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
  <span>Xóa tất cả</span>
</button>
```
Đồng thời bổ sung nút `#btnClearSingleFile`, `#btnClearRotateFile`, `#btnClearSplitFile`, `#btnClearOrganizeFile` cho toàn bộ các workspace còn lại trong PDF Studio, gọi `soundEngine.playDelete()`, giải phóng cache qua `pdfPageCache.releaseForFile()` và hiển thị toast `showToast('Đã xóa tệp', 'delete')`.

---

## 3. Mã Nguồn Tham Chiếu (Code Reference)
- `src/components/tools/pdf/components/PdfMultiFileWorkspace.js`: Master container & nút xóa tất cả.
- `src/components/tools/pdf/components/DropzoneQueue.js`: Loại bỏ viền đỏ `border-red-500/80` và hợp nhất `pdfSingleFileCardRoot`.
- `src/components/tools/pdf/components/PdfRotateWorkspace.js`: Nút `#btnClearRotateFile`.
- `src/components/tools/pdf/components/PdfSplitWorkspace.js`: Nút `#btnClearSplitFile`.
- `src/components/tools/pdf/components/PdfOrganizeWorkspace.js`: Nút `#btnClearOrganizeFile`.
- `src/components/tools/pdf/hooks/usePdfDom.js`: Khởi tạo và liên kết sự kiện click xóa tệp và thông báo toast.

---

## 4. Kiểm Chứng & Nghiệm Thu (Verification)
- `rtk err node --check <files>`: Exit 0 (hợp lệ cú pháp).
- `rtk npm --prefix server run build`: Exit 0 (TypeScript biên dịch sạch sẽ).
- `rtk vitest run server/tests/unit/pdf_gestures.test.ts`: Exit 0.
- Production HTTPS (`https://studio.duydev.cloud`): Health check HTTP 200 `UP`, Service Worker đồng bộ phiên bản `v23.99`.
