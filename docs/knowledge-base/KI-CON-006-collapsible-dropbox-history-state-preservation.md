---
id: KI-CON-006-collapsible-dropbox-history-state-preservation
title: "Kiến Trúc Hộp Thả Lịch Sử Thu Gọn (Collapsible Dropboxes) & Duy Trì Trạng Thái Tránh Rối Giao Diện Trên Toàn Bộ Mô-Đun"
type: concept
status: verified
domain: frontend
tags: [ui-ux, collapsible-dropbox, accordion, state-preservation, linear-minimalism, history-list, module-ergonomics, disclosure-pattern]
created_at: 2026-10-10
updated_at: 2026-10-10
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi thiết kế giao diện danh sách lịch sử hoặc bảng điều khiển phụ trong các mô-đun công cụ; giải quyết vấn đề box lịch sử mở cố định chiếm diện tích màn hình gây rối mắt, đồng thời bảo toàn trạng thái mở/đóng khi xóa tệp hoặc chuyển tab con."
search_queries:
  - "Chuyển box lịch sử thành dạng dropbox thu gọn"
  - "Collapsible history dropbox state preservation across re-renders"
  - "Thiết kế giao diện tối giản tránh rối mắt Linear Vercel"
  - "Accordion dropdown disclosure pattern vanilla ES modules"
  - "Bảo toàn trạng thái mở dropbox khi xóa item hoặc đổi tab"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-FIX-019-dual-result-pdf-delivery-split-history-sync
---

# [KI-CON-006] Kiến Trúc Hộp Thả Lịch Sử Thu Gọn (Collapsible Dropboxes) & Duy Trì Trạng Thái Tránh Rối Giao Diện Trên Toàn Bộ Mô-Đun

## 1. Context & Purpose
Trong các ứng dụng tiện ích xử lý tệp (PDF Studio, File Converter, QR Studio, Quiz Generator), người dùng thường tương tác tập trung với vùng thao tác chính (Dropzone, Cấu hình chuyển đổi, Nút xử lý). 

Trước đây, mỗi mô-đun đều có một **Box Lịch sử** cố định (Static Card) nằm ở chân trang:
- Luôn hiển thị thường trực toàn bộ danh sách tệp cũ, các tab phân loại, nút xóa, chiếm từ 300px đến 600px chiều dọc màn hình.
- Khi người dùng mới vào module hoặc đang tập trung chuyển đổi tệp mới, box lịch sử to lớn này gây **nhiễu thị giác cực độ (Visual Clutter)** và làm rối giao diện.

**Giải pháp kiến trúc**: Chuyển đổi toàn bộ box lịch sử của mọi mô-đun thành dạng **Dropbox Thu Gọn (Collapsible Dropdown Disclosure)**:
1. **Mặc định thu gọn (Collapsed by Default)**: Chỉ hiển thị một thanh header capsule tinh gọn (chiều cao ~56px) với icon đặc trưng, tiêu đề ngắn gọn, badge số lượng tác vụ và mũi tên chỉ thị xoay.
2. **Mở khi cần (On-Demand Expansion)**: Người dùng bấm vào thanh header mới xổ ra toàn bộ nội dung lịch sử.
3. **Duy trì trạng thái mở (State Preservation)**: Khi người dùng đang mở dropbox và thực hiện các thao tác con (xóa 1 tệp, dọn sạch thùng rác, đổi tab con giữa Lịch sử và Thùng rác), dropbox **không bao giờ bị đóng sập lại đột ngột**, đảm bảo trải nghiệm liền mạch 100%.

---

## 2. So Sánh Kiến Trúc Trước & Sau (Before vs After)

```
[Trước đây: Static Cluttered Card]
┌────────────────────────────────────────────────────────┐
│  Lịch sử chuyển đổi               [Xóa tất cả] [Xem]   │ ← Luôn mở cố định
├────────────────────────────────────────────────────────┤
│  Tệp 1: Document.pdf (2.4 MB) → Word .docx             │   Chiếm từ 400px - 700px
│  Tệp 2: Video_cut.mp4 (48.1 MB) → MP3                   │   Gây rối mắt khi người dùng
│  Tệp 3: Image_hero.png (1.2 MB) → WebP                 │   chỉ muốn nạp tệp mới.
│  ... (chiếm trọn màn hình) ...                         │
└────────────────────────────────────────────────────────┘

[Hiện tại: Collapsible Dropbox Pattern (v22.6)]
┌────────────────────────────────────────────────────────┐
│ 🕒 Lịch sử chuyển đổi  [ 5 mục ]      Xem lịch sử  [v] │ ← Thu gọn thanh thoát (~56px)
└────────────────────────────────────────────────────────┘
                          ↓ (Click để mở)
┌────────────────────────────────────────────────────────┐
│ 🕒 Lịch sử chuyển đổi  [ 5 mục ]         Thu gọn   [^] │
├────────────────────────────────────────────────────────┤
│ Gần đây (5)                       [Xóa tất cả] [Xem]   │ ← Xổ xuống nội dung chi tiết
│ ────────────────────────────────────────────────────── │
│  Tệp 1: Document.pdf (2.4 MB) → Word .docx             │
│  Tệp 2: Video_cut.mp4 (48.1 MB) → MP3                   │
│  Tệp 3: Image_hero.png (1.2 MB) → WebP                 │
└────────────────────────────────────────────────────────┘
```

---

## 3. Quy Chuẩn Thiết Kế & Thực Thi Kỹ Thuật

### 3.1. Cấu Trúc Giao Diện Chuẩn (Standard UI Anatomy)
Mọi component lịch sử (`ConverterHistoryList.js`, `PdfHistoryList.js`, `QrHistoryList.js`, `QuizHistoryList.js`) đều tuân thủ cấu trúc đồng nhất:

```html
<div class="bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200/80 dark:border-white/[0.07] overflow-hidden transition-all shadow-xs select-none">
  <!-- 1. Clickable Master Header Button (Full-width Touch Target) -->
  <button type="button" id="btnToggleXxxHistory" class="w-full flex items-center justify-between p-4 sm:p-4.5 cursor-pointer select-none text-left hover:bg-zinc-50/70 dark:hover:bg-white/[0.02] transition-colors">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-8 h-8 rounded-xl ${themeBadgeClass} border flex items-center justify-center shrink-0">
        <i data-lucide="${iconName}" class="w-4 h-4"></i>
      </div>
      <div class="flex items-center gap-2 min-w-0 flex-wrap">
        <span class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">${title}</span>
        <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold ${themeBadgeClass}">
          ${items.length} mục
        </span>
        ${trashCount > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">${trashCount} thùng rác</span>` : ''}
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <span class="text-xs text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
        ${isOpen ? 'Thu gọn' : 'Xem lịch sử'}
      </span>
      <div class="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-transform duration-200 ${isOpen ? 'rotate-180 text-zinc-900 dark:text-zinc-100' : ''}">
        <i data-lucide="chevron-down" class="w-4 h-4"></i>
      </div>
    </div>
  </button>

  <!-- 2. Collapsible Body (Ẩn khi isOpen === false, Hiển thị khi isOpen === true) -->
  <div id="xxxHistoryBody" class="${isOpen ? 'block' : 'hidden'} border-t border-zinc-100 dark:border-white/[0.06] p-4 sm:p-5 space-y-4 bg-zinc-50/30 dark:bg-black/20">
    <!-- Sub-Header Tabs & Actions -->
    ...
    <!-- Item Rows List -->
    ...
  </div>
</div>
```

---

### 3.2. Cơ Chế Bảo Toàn Trạng Thái (State Preservation Pattern)
Trong Vanilla ES Modules, khi người dùng xóa một item hoặc chuyển tab con (ví dụ: chuyển giữa *Lịch sử* và *Thùng rác* trong PDF Studio), hàm cập nhật DOM (`updateXxxHistoryDom`) thường gọi lại hàm render `el.innerHTML = renderXxxHistoryList()` và bind lại event listeners.

**Bẫy lỗi nghiêm trọng**: Nếu trạng thái mở/đóng không được lưu trong biến module scope mà chỉ đọc từ class DOM tạm thời, thì ngay khi người dùng xóa một tệp, DOM re-render sẽ khiến dropbox **tự động đóng sập lại**, gây ức chế tột độ cho người dùng.

**Giải pháp chuẩn hóa**:
1. Khai báo biến module-level:
   ```javascript
   let isHistoryOpen = false; // Mặc định đóng khi vừa vào trang
   export function setHistoryOpen(open) { isHistoryOpen = open; }
   export function isHistoryExpanded() { return isHistoryOpen; }
   ```
2. Trong hàm `bindXxxHistory()`:
   ```javascript
   const btnToggle = el.querySelector('#btnToggleXxxHistory');
   if (btnToggle) {
     btnToggle.onclick = () => {
       isHistoryOpen = !isHistoryOpen;
       updateXxxHistoryDom(manager);
     };
   }
   ```
3. Khi xóa item hoặc đổi tab con:
   ```javascript
   await storage.moveToTrash(itemId);
   // updateXxxHistoryDom được gọi, nhưng isHistoryOpen vẫn là TRUE!
   // Dropbox giữ nguyên trạng thái mở, chỉ có danh sách items bên trong được làm mới.
   updateXxxHistoryDom(manager);
   ```

---

## 4. Gotchas & Edge Cases

> [!WARNING]
> **Click Propagation & Nesting Buttons**:
> Tuyệt đối không đặt các nút con (như nút *Xóa tất cả*, nút chuyển tab) bên trong cùng phần tử `<button id="btnToggle...">` của header, vì click vào nút con sẽ kích hoạt đồng thời sự kiện toggle khiến dropbox vừa thực hiện hành động vừa tự đóng lại. Tất cả các nút tác vụ con bắt buộc phải nằm bên trong phần `Collapsible Body` hoặc sử dụng `e.stopPropagation()`.

> [!NOTE]
> **Trạng Thái Khi Điều Hướng (SPA Route Transitions)**:
> Khi người dùng chuyển sang trang khác (ví dụ: từ `#tool/pdf-studio` sang `#tool/universal-converter` rồi quay lại), trạng thái đóng ban đầu được phục hồi tự nhiên, giúp mỗi khi người dùng bắt đầu một phiên làm việc mới trên công cụ thì giao diện luôn sạch sẽ, không bị rối.

---

## 5. Verification
1. **Kiểm thử tự động trạng thái thu gọn & mở rộng**:
   ```bash
   cd server && npx vitest run tests/unit/collapsible_history.test.ts
   # 8/8 tests passed verifying collapsed defaults, header toggles, and body expansions.
   ```
2. **Kiểm tra cú pháp**:
   ```bash
   node --check src/components/tools/converter/components/ConverterHistoryList.js
   node --check src/components/tools/pdf/components/PdfHistoryList.js
   node --check src/components/tools/qr/components/QrHistoryList.js
   node --check src/components/tools/quiz/components/QuizHistoryList.js
   ```

---

## 6. Changelog
- **2026-10-10 (v1.0.0)**: Khởi tạo Knowledge Item chuẩn hóa kiến trúc Hộp Thả Lịch Sử Thu Gọn (Collapsible Dropboxes) và cơ chế bảo toàn trạng thái trên toàn bộ các mô-đun công cụ (@anhduy).
