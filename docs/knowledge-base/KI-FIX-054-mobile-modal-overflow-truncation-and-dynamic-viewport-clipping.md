---
id: KI-FIX-054
title: Khắc Phục Lỗi Tràn Nút (Button Overflow), Cắt Cụt Tab Title & Kẹp Đáy Modal Trên Màn Hình Di Động
type: troubleshoot
domain: frontend
status: verified
created_at: 2026-11-12
updated_at: 2026-11-12
version: 1.0.0
trigger_conditions:
  - Khi modal/popup trên màn hình hẹp (< 400px hoặc Safari iOS) bị tràn nút hành động ra ngoài mép card
  - Khi tab header bị cắt cụt tiêu đề "Đồng bộ thiết..." trên điện thoại
  - Khi danh sách thiết bị hoặc nội dung modal bị cắt ngang nửa mục sát nút Đóng do thiếu cuộn linh hoạt
search_queries:
  - modal button overflow flex min-w-0
  - mobile popup clipping 100dvh
  - tab title truncation responsive mobile
  - backdrop-filter border-radius overflow clip safari ios
tags:
  - modal
  - mobile
  - flexbox
  - ios-safari
  - pwa
---

# KI-FIX-054: Khắc Phục Lỗi Tràn Nút (Button Overflow), Cắt Cụt Tab Title & Kẹp Đáy Modal Trên Màn Hình Di Động

## 1. Triệu Chứng (Symptoms)
Trên giao diện điện thoại (đặc biệt là iOS Safari và màn hình hẹp < 400px):
1. **Nút bấm văng ra ngoài khung modal**: Trong ProfileModal (tab Đồng bộ), ô nhập mã 6 số cùng nút `[ ✓ Liên kết ]` bị tràn ra mép ngoài của thẻ card, đè lên lớp nền mờ (backdrop).
2. **Cắt cụt tiêu đề Tab**: Hai tab dài ("Hồ sơ cá nhân" và "Đồng bộ thiết bị") cùng nút `[X]` nhồi nhét trên cùng một hàng khiến tab bị cắt cụt thành `Đồng bộ thiết...`.
3. **Kẹp đáy và cắt ngang danh sách thiết bị**: Danh sách thiết bị bị giới hạn cứng `max-h-36` (144px), khiến mục thứ 3 bị cắt ngang làm đôi ngay sát trên nút `Đóng`. Toàn bộ modal card thiếu giới hạn `100dvh` và thiếu thanh cuộn nội dung, dẫn đến nút `Đóng` bị kẹt sát đáy màn hình.

---

## 2. Nguyên Nhân Kỹ Thuật (Root Cause)
1. **Mặc định `min-width: auto` của thẻ `<input>` trong CSS Flexbox**:
   Theo chuẩn CSS Flexbox, thẻ `<input>` có giá trị mặc định `min-width: auto` (tương đương ~20ch). Khi container flex co lại trên màn hình hẹp, `<input>` từ chối co nhỏ dưới kích thước này, ép nút màu đen kế bên bị đẩy văng hoàn toàn ra khỏi lề phải của container.
2. **Lỗi Clip của WebKit trên iOS Safari (`backdrop-filter` + `border-radius`)**:
   Khi một card có thuộc tính `backdrop-filter` / `-webkit-backdrop-filter` đi kèm `border-radius`, thuộc tính `overflow: hidden` của container sẽ không clip các phần tử con bị tràn nếu không có `isolation: isolate` hoặc thiếu `min-w-0` trên các phần tử flex.
3. **Tiêu đề Tab tĩnh không thích ứng màn hình**:
   Nhãn tab hiển thị chuỗi dài 15 ký tự ("Đồng bộ thiết bị") không có breakpoint ẩn/hiện, làm vỡ bố cục trên viewport < 380px.
4. **Thiếu Dynamic Viewport Height (`100dvh`)**:
   Modal không dùng `max-h-[calc(100dvh-32px)]` kết hợp `flex flex-col` và `flex-1 min-h-0 overflow-y-auto`, khiến nội dung cao bị đẩy chạm đáy màn hình và các mục danh sách bị cắt ngang thô bạo.

---

## 3. Giải Pháp & Quy Chuẩn Khắc Phục (Targeted Solution)

### A. Triệt tiêu Button Overflow bằng Flexbox `min-w-0`
Trên container chứa input + button và chính bản thân thẻ input, bắt buộc thêm `min-w-0`:
```html
<div class="flex items-center gap-2 min-w-0 w-full">
  <input 
    type="text" 
    id="dsInputSyncCode"
    class="flex-1 min-w-0 w-full h-11 px-3 rounded-xl ..."
  />
  <button 
    type="button" 
    id="dsSubmitSyncCodeBtn"
    class="h-11 px-3.5 sm:px-4 rounded-xl shrink-0 whitespace-nowrap active:scale-95 ..."
  >
    <i data-lucide="check" class="w-4 h-4 shrink-0"></i>
    <span>Liên kết</span>
  </button>
</div>
```

### B. Responsive Tab Labels
Rút gọn tiêu đề tab trên mobile và mở rộng trên tablet/desktop:
```html
<span class="truncate sm:hidden">Hồ sơ</span>
<span class="truncate hidden sm:inline">Hồ sơ cá nhân</span>

<span class="truncate sm:hidden">Đồng bộ</span>
<span class="truncate hidden sm:inline">Đồng bộ thiết bị</span>
```

### C. Quy Chuẩn Modal Bền Vững Toàn Hệ Thống (Global Modal Standard)
Mọi modal card trên toàn hệ thống (`ProfileModal`, `SoundVolumeModal`, `SlideConfirmModal`, `HistoryConfirmModal`, `MigrationNoticeModal`, `ShareTargetModal`, `FileViewerCore`) phải áp dụng bộ class tiêu chuẩn:
```html
<!-- Modal Outer Card -->
<div class="relative w-full max-w-lg max-h-[calc(100dvh-32px)] sm:max-h-[calc(100dvh-48px)] flex flex-col overflow-hidden isolate box-border rounded-2xl ...">
  
  <!-- Header (Không bị co kéo) -->
  <div class="flex items-center justify-between shrink-0 ...">...</div>

  <!-- Scrollable Body (Tự động cuộn khi nội dung dài) -->
  <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain pr-0.5 space-y-4">
    ...
  </div>
</div>
```

---

## 4. Kiểm Thử & Nghiệm Thu (Verification)
1. **Node syntax check**: `node --check src/components/common/ProfileModal.js` $\rightarrow$ Exit 0.
2. **TypeScript build**: `rtk npm --prefix server run build` $\rightarrow$ Exit 0.
3. **Responsive test**: Kiểm tra trên viewport 360px x 640px, các button `Liên kết`, `Đóng`, tabs, và danh sách thiết bị hiển thị trọn vẹn trong thẻ card, không có bất kỳ pixel nào tràn lề ngang.
