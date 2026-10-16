# KI-FIX-027: Chuẩn Hóa Khoảng Đệm Đáy & Khoảng Cách Thoáng Đãng Chân Trang (Bottom Breathing Room & Footer Clearance) Trên Toàn Bộ Web

- **ID:** `KI-FIX-027`
- **Loại:** `troubleshoot`
- **Lĩnh vực:** `frontend`
- **Tình trạng:** `verified`
- **Ngày lập:** 16/10/2026
- **Liên quan:** `KI-CON-001`, `KI-CON-006`, `src/app.js`, `src/components/layout/Footer.js`, `src/components/tools/qr/QrStudio.js`

---

## 1. Triệu chứng & Bối cảnh (Symptoms & Context)
- Trên các trang công cụ (đặc biệt là `#tool/qr`, `#tool/hash-checksum`, `#tool/pdf`, `#tool/converter`), khi nội dung hiển thị ở cuối trang (như khối "Tùy Biến Giao Diện" hoặc danh sách "Lịch sử tạo QR"), đáy của thẻ card cuối cùng bị dính chặt vào đường kẻ viền Footer (`border-t border-zinc-200`) với khoảng cách 0px–32px.
- Trên thiết bị di động, nội dung cuối trang có nguy cơ bị che khuất bởi thanh điều hướng chân trang (Bottom Navigation Bar) nếu thiếu khoảng đệm an toàn.
- Giao diện có cảm giác bị chèn ép, thiếu không gian thở (breathing room) theo quy chuẩn thiết kế Impeccable Design System.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)
1. **Lớp Đệm Đáy Desktop Trên Khung Vỏ `#mainContent` Bị Thu Hẹp Quá Mức (`sm:py-8`):**
   - Tại `src/app.js`, thẻ `<main id="mainContent">` được áp dụng lớp `pt-4 pb-36 sm:py-8`.
   - Tiền tố `sm:py-8` trên màn hình $\ge 640\text{px}$ đã ghi đè toàn bộ `padding-bottom` thành `2rem` (chỉ 32px), khiến khoảng cách giữa phần tử nội dung cuối cùng và đáy khung chính chỉ còn 32px.
2. **Thanh Footer Sử Dụng `mt-auto` Không Kèm Khoảng Cách Tối Thiểu:**
   - Trong `src/components/layout/Footer.js`, thẻ `<footer>` chỉ có thuộc tính `mt-auto`.
   - Theo mô hình Flexbox (`flex flex-col min-h-screen`), khi chiều cao nội dung trang vượt quá chiều cao màn hình, `mt-auto` sẽ tự động co lại thành `margin-top: 0px`. Do đó, Footer sẽ bám dính sát ngay dưới đáy của `#mainContent`.
3. **Các Workspace Công Cụ Thiếu Đệm Đáy Cục Bộ (`pb-12 md:pb-16`):**
   - Hầu hết các container gốc của công cụ (`QrStudio.js`, `HashStudio.js`, `StoragePage.js`, `ViewSplitWorkspace.js`, `QuizWorkspace.js`, v.v.) chỉ khai báo `space-y-6` mà không có `pb-12 md:pb-16`.
   - Các khối Lịch sử gắn bên dưới các bảng điều khiển thiếu khoảng đệm phân tách (`pt-2` thay vì `pt-4 sm:pt-6`).

---

## 3. Giải pháp kỹ thuật (Implementation)

### 3.1. Nâng Cấp Khung Vỏ Chính `#mainContent` (`src/app.js`)
Thay thế `sm:py-8` bằng phân tách rõ ràng padding trên và đệm đáy rộng rãi:
```html
<main id="mainContent" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 pt-4 pb-36 sm:pt-8 sm:pb-20 lg:pb-24 min-w-0 overflow-x-clip"></main>
```
- **Mobile (< 640px):** Duy trì `pb-36` (144px) bảo đảm vùng an toàn tuyệt đối, tránh che khuất bởi Bottom Nav cố định.
- **Desktop (>= 640px):** `sm:pb-20 lg:pb-24` tạo khoảng đệm thoáng đãng 80px đến 96px.

### 3.2. Cố Định Khoảng Cách Vật Lý Cho Footer (`src/components/layout/Footer.js`)
Bổ sung `mt-12 md:mt-16` song song với `mt-auto`:
```html
<footer class="w-full border-t border-zinc-200 dark:border-white/5 px-4 lg:px-8 py-6 mt-auto mt-12 md:mt-16 text-sm text-zinc-600 dark:text-zinc-400 mb-16 md:mb-0">
```
- Đảm bảo ngay cả khi trang có nội dung rất dài và cuộn trang, thanh Footer vẫn luôn cách đáy nội dung tối thiểu 48px–64px.

### 3.3. Đồng Bộ Đệm Đáy Chuẩn Trên Toàn Bộ Workspace Công Cụ
- Thêm `pb-12 md:pb-16` vào các container gốc: `QrStudio.js`, `HashStudio.js`, `PdfWorkspace.js`, `ConverterWorkspace.js`, `StudocuWorkspace.js`, `ScribdWorkspace.js`, `QuizWorkspace.js`, `StoragePage.js`, `ViewSplitWorkspace.js`, `MarkdownEditor.js`, `DashboardPage.js`, `ServerPage.js`, `ArchiveWorkspace.js`, `TiktokWorkspace.js`.
- Bọc khối danh sách Lịch sử trong container phân tách chuyên biệt với `pt-4 sm:pt-6`.

---

## 4. Kiểm chứng tự động (Automated Verification)
- **Playwright Visual Audit:** Script đo đạc tọa độ thực tế trên headless Chromium:
  - Desktop 1440x900px: Đạt khoảng cách thực tế giữa card cuối cùng và mép trên Footer từ **160px đến 290px** (vượt xa yêu cầu $\ge 48\text{px}$).
  - Mobile 390x844px: Duy trì đệm đáy `144px` bảo vệ toàn diện.
  - Kiểm tra `scrollWidth <= innerWidth`: 100% các route không phát sinh thanh cuộn ngang ngoài ý muốn (`overflow: D=False / M=False`).
