# KI-FIX-038: Trích Xuất Phần Mở Rộng An Toàn (Safe Extension Extraction) & Chống Tràn Badge Trên Thanh Tiện Ích Universal File Viewer

---

## 1. Hiện tượng & Triệu chứng (Symptoms)
- **Triệu chứng 1:** Khi mở xem trước tệp media (video/audio/ảnh từ mạng xã hội hoặc web) bằng Universal File Viewer (`FileViewerCore`), huy hiệu định dạng ở góc trên bên trái (`#viewerFileExtBadge`) hiển thị nguyên cả một chuỗi dài (ví dụ: `7M VIEWS • 140K REACTIONS | WHAT IS EARTH WITHOUT ART`).
- **Triệu chứng 2:** Huy hiệu định dạng bị kéo dài chiếm gần như toàn bộ chiều rộng thanh tiêu đề (header bar), khiến các nút hành động bên phải (`btnCopyViewerLink`, `btnOpenViewerTab`, `btnDownloadViewerFile`, thanh phân cách và nút đóng `btnCloseFileViewer`) bị đè và hiển thị chồng chéo trực tiếp lên nội dung chữ của huy hiệu.

---

## 2. Nguyên nhân gốc rễ (Root Cause Analysis)

1. **Thuật Toán Trích Xuất Đuôi Tệp Ngây Thơ (`split('.').pop()`):**
   - Trong `FileViewerCore.js`, logic trích xuất đuôi tệp trước đây là:
     ```javascript
     const ext = state.name && state.name.includes('.')
       ? (state.name.split('.').pop()?.toUpperCase() || 'FILE')
       : (state.mimeType ? state.mimeType.split('/')[1]?.toUpperCase() : (state.category?.toUpperCase() || 'FILE'));
     ```
   - Khi tên tệp chứa số thập phân (như `6.7M views · 140K reactions | What is Earth without art`), điều kiện `state.name.includes('.')` trả về `true` do có dấu chấm trong `6.7M`.
   - Phép tách `state.name.split('.').pop()` lấy toàn bộ phần ký tự phía sau dấu chấm đầu tiên, biến chuỗi 60+ ký tự thành đuôi tệp.
2. **Thiếu Ràng Buộc Kích Thước & Truncation Trên CSS Flexbox:**
   - Phần tử `#viewerFileExtBadge` sở hữu class `shrink-0` nhưng thiếu giới hạn `max-w` và `truncate`.
   - Vùng chứa bên trái (`<div class="flex items-center gap-2 min-w-0 flex-1">`) không có `overflow-hidden`.
   - Khối nút bấm bên phải không có `z-index` độc lập, dẫn đến khi badge mở rộng tối đa, layout flexbox bị đẩy tràn và các phần tử đè lên nhau.

---

## 3. Giải pháp kỹ thuật (Targeted Fix & Implementation)

### 3.1. Hàm Trích Xuất Phần Mở Rộng An Toàn `extractSafeExtension`
Trong `src/components/common/viewer/FileViewerCore.js`:
- Định nghĩa hàm chuyên dụng chuẩn hóa:
  ```javascript
  export function extractSafeExtension(name = '', mimeType = '', category = '') {
    if (typeof name === 'string' && name.trim()) {
      const clean = name.trim().split(/[?#]/)[0];
      const match = clean.match(/\.([a-zA-Z0-9]{1,8})$/);
      if (match) {
        return match[1].toUpperCase();
      }
    }

    if (typeof mimeType === 'string' && mimeType.includes('/')) {
      const sub = mimeType.split('/')[1]?.split(';')[0]?.trim();
      if (sub && /^[a-zA-Z0-9]{1,8}$/.test(sub)) {
        return sub.toUpperCase();
      }
    }

    if (typeof category === 'string' && category.trim()) {
      const cleanCat = category.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, '');
      if (cleanCat) {
        return cleanCat.slice(0, 8);
      }
    }

    return 'FILE';
  }
  ```
- Thay thế toàn bộ naive splitting trong `renderFallbackErrorCard`, `switchCategory`, `showFileViewerModal`, và `openFileViewer`.

### 3.2. Gia Cố CSS Header Flexbox & Badge Truncation
- Thêm `max-w-[72px] truncate inline-block text-center` vào `#viewerFileExtBadge`.
- Thêm `overflow-hidden` vào khối chứa bên trái của thanh tiêu đề.
- Bổ sung `z-10 relative` cho nhóm nút thao tác bên phải, bảo đảm tách bạch phân lớp thị giác tuyệt đối.

### 3.3. Đồng Bộ Sang `FileViewerConnector` & Các Trình Kết Xuất
- Áp dụng kiểm tra regex `/\.([a-zA-Z0-9]{1,8})$/` trong `extractFileExtension()` của `FileViewerConnector.js`.
- Cập nhật các renderer (`FallbackRenderer.js`, `FontRenderer.js`, `SpreadsheetRenderer.js`) để kẹp độ dài đuôi tệp tối đa 8 ký tự và bổ sung `truncate` vào badge.

---

## 4. Kiểm chứng (Verification)
- **Unit Test:** Đã bổ sung bộ kiểm thử `describe('10. Safe File Extension Extraction & Toolbar Overflow Prevention')` trong `server/tests/unit/viewer_hardening.test.ts` (52/52 tests pass).
- **TypeScript & Build:** `npm --prefix server run build` hoàn thành với mã thoát 0.
- **Production Health Check:** Dịch vụ phản hồi `status: UP` tại `https://studio.duydev.cloud/api/v1/health`.
