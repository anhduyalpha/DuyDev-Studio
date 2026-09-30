---
id: KI-FIX-011-runtime-reference-errors-vanilla-esmodules-render
title: "Phòng Ngừa & Xử Lý Bẫy Lỗi Runtime ReferenceError Trong Template Literal & Object Literal Của Vanilla ES Modules"
type: troubleshoot
status: verified
domain: frontend
tags: [javascript, reference-error, template-literals, object-literal, arrow-function, smoke-test, esmodules]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Lỗi 'ReferenceError: X is not defined' âm thầm làm gãy chuỗi render DOM (khiến danh sách tệp luôn báo '0 tệp' hoặc 'Chưa có tài liệu nào tải về') hoặc làm sập Router."
search_queries:
  - "ReferenceError: b is not defined at StudocuManager.getFilteredItems"
  - "ReferenceError: uploader is not defined at renderDocumentItem"
  - "Template literal undefined variable silent render crash"
  - "Missing arrow function parameters in object literal comparator"
  - "Vanilla JavaScript smoke test component render with Node.js"
related_kis:
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-FIX-007-esmodule-circular-dependency-tdz-crash-pwa
  - KI-FIX-010-selective-dom-diffing-high-frequency-terminal-lag
---

# [KI-FIX-011] Phòng Ngừa & Xử Lý Bẫy Lỗi Runtime ReferenceError Trong Template Literal & Object Literal Của Vanilla ES Modules

## 1. Context & Purpose
Trong các dự án Vanilla ES Modules không sử dụng TypeScript trực tiếp trên frontend (chỉ dùng JavaScript chuẩn trình duyệt), các công cụ phân tích cú pháp tĩnh đơn thuần như `node --check filename.js` **chỉ kiểm tra lỗi cú pháp (SyntaxError)** mà hoàn toàn không thể phát hiện các lỗi **ReferenceError** tại thời điểm chạy (runtime).

Hai bẫy lỗi kinh điển từng làm tê liệt giao diện Studocu:
1. **Bẫy Object Literal Evaluation**:
   - Khi định nghĩa bảng tra cứu hàm sắp xếp `const sorts = { ... }`, nếu vô tình thiếu khai báo tham số `(a, b) =>`, JavaScript engine sẽ đánh giá biểu thức ngay lập tức lúc tạo object thay vì trả về một callback, dẫn đến `ReferenceError: b is not defined`.
2. **Bẫy Template Literal String Interpolation**:
   - Trong template HTML `${escapeHtml(uploader)}`, nếu biến `uploader` chưa được khai báo `const uploader = ...`, trình duyệt sẽ quăng lỗi ngay khi danh sách có từ 1 phần tử trở lên (`items.length > 0`).
   - Lỗi này làm gãy tiến trình gán `innerHTML`, khiến danh sách luôn kẹt ở trạng thái ban đầu: *"Tài Liệu Đã Tải 0 tệp - Chưa có tài liệu nào tải về"*, và không thể cập nhật tài liệu vừa tải xong.

Tài liệu này chuẩn hóa quy tắc viết mã an toàn và quy trình kiểm thử khói (Smoke Test) tự động bằng Node.js trước khi deploy.

---

## 2. Prerequisites
- Môi trường Node.js hỗ trợ ES Modules (`"type": "module"` trong `package.json`).
- Các component frontend: [`useStudocu.js`](file:///src/components/tools/studocu/hooks/useStudocu.js) và [`DocumentItem.js`](file:///src/components/tools/studocu/components/DocumentItem.js).

---

## 3. Root Cause Analysis

### Bẫy 1: Thiếu Arrow Function Parameters Trong Object Literal
```javascript
// ❌ SAI: Biểu thức (b.name || '') được tính toán ngay lập tức khi khởi tạo đối tượng sorts!
// Vì b chưa tồn tại trong scope hiện tại => ReferenceError: b is not defined!
const sorts = {
  name_asc: (a, b) => (a.name || '').localeCompare(b.name || '', 'vi'),
  name_desc: (b.name || '').localeCompare(a.name || '', 'vi'), // <--- Thiếu (a, b) =>
};

//  ĐÚNG: Phải luôn là hàm nhận hai tham số a và b:
const sorts = {
  name_asc: (a, b) => (a.name || '').localeCompare(b.name || '', 'vi'),
  name_desc: (a, b) => (b.name || '').localeCompare(a.name || '', 'vi'),
};
```

### Bẫy 2: Biến Chưa Khai Báo Trong Template Literal
```javascript
// ❌ SAI: Gọi uploader trong chuỗi template nhưng quên khai báo biến ở đầu hàm:
export function renderDocumentItem(doc, isTrash = false) {
  const docId = doc.id || doc.name;
  // ... thiếu const uploader = ...
  return `
    <span class="meta-pill meta-user">
      <span>${escapeHtml(uploader)}</span> <!-- ReferenceError: uploader is not defined -->
    </span>
  `;
}
```
Khi danh sách rỗng (`items = []`), vòng lặp `items.map(...)` không chạy nên không sinh lỗi. Nhưng ngay khi server trả về 1 file hoặc người dùng vừa tải xong 1 file, hàm lập tức nổ lỗi và gãy DOM update.

---

## 4. Core Instructions / Solution

### Bước 1: Khai Báo Biến Phòng Vệ Với Giá Trị Mặc Định (Defensive Extraction)
Luôn trích xuất và định nghĩa giá trị fallback an toàn cho mọi trường dữ liệu trước khi ghép vào chuỗi HTML:

```javascript
export function renderDocumentItem(doc, isTrash = false) {
  const isPdf = Boolean(doc.is_pdf ?? (doc.format === 'pdf' || (doc.name && doc.name.toLowerCase().endsWith('.pdf'))));
  const docId = doc.id || doc.name;
  const docName = doc.name || 'Tài liệu không tên';
  const docSize = doc.size || (doc.size_mb ? `${doc.size_mb} MB` : (doc.size_bytes ? `${(doc.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ''));
  const timeStr = doc.time || '';
  // Fallback an toàn cho metadata người tải:
  const uploader = doc.downloaded_by?.name || doc.downloaded_by?.device || doc.uploader || 'Web';
  
  // ...
}
```

### Bước 2: Thiết Lập Quy Trình Smoke Test Tự Động Với Node.js
Vì `node --check` không bắt được lỗi biến runtime trong hàm chưa được gọi, bắt buộc phải chạy lệnh giả lập render với dữ liệu mẫu thật trước khi đóng gói hoặc deploy:

```bash
# Test render danh sách khi có dữ liệu thật:
node -e "
import('./src/components/tools/studocu/components/DocumentListCard.js').then(m => {
  const html = m.renderDocumentListCard({
    currentTab: 'pdf',
    filteredItems: [{ id: 'test-1', name: 'sample.pdf', size: '1.5 MB' }],
    counts: { pdf: 1, trash: 0 }
  });
  console.log('DocumentListCard smoke test OK, length:', html.length);
}).catch(err => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
"
```

```bash
# Test render workspace tổng thể:
node -e "
import('./src/components/tools/studocu/StudocuWorkspace.js').then(m => {
  const html = m.renderStudocuWorkspace();
  console.log('StudocuWorkspace smoke test OK, length:', html.length);
}).catch(err => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
"
```

---

## 5. Gotchas & Edge Cases
- **Lừa thị giác khi danh sách rỗng**: Tuyệt đối không kiểm tra giao diện chỉ khi danh sách rỗng (0 items). Luôn phải kiểm tra trường hợp có dữ liệu (>= 1 item) vì mã template literal của từng hàng chỉ chạy khi có item.
- **Node.js import ESM**: Khi chạy smoke test bằng lệnh `node -e "import(...)"`, đảm bảo đường dẫn module dùng đuôi `.js` rõ ràng theo chuẩn ECMAScript Module.

---

## 6. Verification
Chạy chuỗi lệnh xác minh bắt buộc trước khi kết luận hoàn tất:
1. `node -e "import('./src/components/tools/studocu/components/DocumentListCard.js').then(...)"` ➔ Phải in ra `smoke test OK` và exit code 0.
2. `node -e "import('./src/components/tools/studocu/StudocuWorkspace.js').then(...)"` ➔ Phải in ra `smoke test OK` và exit code 0.
3. Mở tab Studocu trên trình duyệt: Danh sách tài liệu phải hiện ngay lập tức số lượng tệp thật thay vì con số 0.

---

## 7. Changelog
- **2026-09-22 (v1.0.0)**: Khởi tạo Knowledge Item giải quyết tận gốc hai bẫy lỗi ReferenceError trong Vanilla ES Modules và chuẩn hóa lệnh Smoke Test tự động (@anhduy).
