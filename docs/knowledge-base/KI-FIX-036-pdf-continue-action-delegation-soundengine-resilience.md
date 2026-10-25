# KI-FIX-036: PDF Result Continuation Event Delegation & SoundEngine Action Resilience

- **ID**: `KI-FIX-036`
- **Type**: `fix`
- **Domain**: `frontend`
- **Status**: `verified`
- **Date**: `2026-10-25`
- **Affected Components**: `src/utilities/soundEngine.js`, `src/components/tools/pdf/hooks/usePdfDom.js`, `src/components/tools/pdf/components/PdfContinueModal.js`, `src/components/tools/pdf/components/PdfHistoryList.js`

---

## 1. Triệu chứng & Nguyên nhân (Root Cause)

### Triệu chứng
Sau khi xử lý PDF hoàn tất trên PDF Studio Pro, người dùng nhấn vào nút **"Xử lý tiếp"** (`#btnContinueWithResult`) trên thẻ kết quả (`ResultCard`), giao diện không phản hồi, không phát ra âm thanh và modal chọn mô-đun xử lý tiếp (`openPdfContinueModal`) không xuất hiện.

### Nguyên nhân kỹ thuật
1. **Missing Method trên `SoundEngine` (`TypeError: soundEngine.playAction is not a function`)**:
   Trong `usePdfDom.js`, `PdfContinueModal.js` và `PdfHistoryList.js`, code gọi `soundEngine.playAction()`. Tuy nhiên, trong `src/utilities/soundEngine.js`, chỉ có `playToggle()`, `playSnap()`, `playStart()`, v.v. Không hề có phương thức `playAction`. Do đó, khi người dùng click vào nút, JavaScript ném unhandled `TypeError` ngay lập tức trước khi gọi hàm `openPdfContinueModal()`, khiến modal không bao giờ mở và không có bất kỳ phản ứng nào.
2. **Thiếu Event Delegation trên Result Container**:
   Việc gán listener trực tiếp qua `resEl.querySelector('#btnContinueWithResult')?.addEventListener(...)` dễ bị rớt event listener khi innerHTML được cập nhật lại hoặc khi Lucide Icons render đè lên phần tử `<button>` bằng SVG.
3. **Z-Index Layering của Modal**:
   Modal `#pdfContinueModal` ban đầu đặt `z-50`, có nguy cơ bị che khuất bởi các thanh điều hướng hoặc modal khác (`z-[999]` - `z-[99999]`).

---

## 2. Giải pháp khắc phục (Targeted Fix & Defense-in-Depth)

1. **Bổ sung `playAction()` vào `SoundEngine` & Sử dụng Optional Chaining**:
   - Thêm alias `playAction() { this.playToggle(); }` vào class `SoundEngine` trong `src/utilities/soundEngine.js`.
   - Tại tất cả các điểm gọi, chuyển sang cú pháp an toàn: `soundEngine.playAction?.() || soundEngine.playToggle?.()`.
2. **Áp dụng Event Delegation trên `#pdfResultContainer`**:
   - Sử dụng `resEl.onclick` với `e.target.closest('#btnContinueWithResult')`, `e.preventDefault()`, `e.stopPropagation()`.
   - Bổ sung fallback context: `const resultObj = queueMgr?.result || window.__ds_pdfQueueManager?.result`.
   - Hiển thị toast cảnh báo nếu không tìm thấy dữ liệu thay vì im lặng thất bại.
3. **Nâng Z-Index & Chống Bubble cho `PdfContinueModal`**:
   - Đặt z-index của modal lên `z-[99999]`.
   - Chặn nổi bọt sự kiện (`e.stopPropagation()`) trên thẻ card để việc click vào các nút bên trong không bao giờ kích hoạt đóng backdrop ngoài ý muốn.
   - Thêm kiểm tra `typeof document === 'undefined'` để bảo đảm an toàn khi chạy SSR hoặc unit test.

---

## 3. Kiểm chứng (Verification)

- **Unit Tests**: `rtk vitest run server/tests/unit/pdf_history_continue.test.ts` (7/7 tests passed: kiểm tra `buildPdfResult`, `storage`, `renderResultCard`, `soundEngine.playAction`, `openPdfContinueModal`).
- **Syntax Check**: `rtk err node --check` toàn bộ 4 file JS đều Exit 0.
- **Production Build**: `rtk npm --prefix server run build` Exit 0.
- **Service Worker Cache**: Bump version lên `v24.02` để client tự động nhận bản cập nhật mới nhất.
