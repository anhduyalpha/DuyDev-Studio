---
id: KI-CON-007-tool-icon-design-philosophy
title: "Proprietary Tool Icon System & Dual-Mode Vector Design Philosophy"
type: concept
status: verified
domain: frontend
tags: [frontend, ui-design, icons, vector, svg, light-dark-mode, design-system, linear-style]
created_at: 2026-10-10
updated_at: 2026-10-10
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "When creating new tools, modifying dashboard tool cards, or authoring icons for new modules across DuyDev Studio"
search_queries:
  - "Triết lý thiết kế icon DuyDev Studio"
  - "Cách tạo icon độc quyền cho module mới"
  - "Quy chuẩn icon SVG dual mode light dark"
  - "Tool icon design philosophy and SVG boilerplate"
  - "Hệ thống icon tool card"
related_kis:
  - KI-CON-001-ui-production-minimalism
---

# [KI-CON-007] Triết Lý Thiết Kế Bộ Icon Độc Quyền & Hướng Dẫn Mở Rộng Module Mới

## 1. Bối Cảnh & Mục Tiêu (Context & Purpose)

Trước đây, các thẻ công cụ (`ToolCard`) trên Dashboard của **DuyDev Studio (DS)** sử dụng các biểu tượng dòng đơn 1px của Lucide Icons (`file-text`, `archive`, `refresh-cw`). Mặc dù Lucide hữu ích cho các nút bấm phụ trợ, việc dùng biểu tượng có sẵn cho các tính năng trọng tâm khiến giao diện mang cảm giác giống các template SaaS thông thường, thiếu bản sắc công nghệ riêng biệt.

Tài liệu này xác lập **Triết lý thiết kế bộ icon độc quyền (DS Dual-Mode Vector Glyphs)**:
- Mỗi icon là một tác phẩm vector thủ công được thiết kế riêng trên lưới toạ độ chuẩn **24×24**.
- Tự động chuyển đổi mượt mà giữa **Light Mode** và **Dark Mode** qua CSS transitions (0ms reload, 0 JavaScript mutation).
- Phản ánh chính xác bản chất kỹ thuật bên dưới (PyMuPDF vector nodes, FFmpeg transcode prism, zero-extraction loupe, v.v.).
- Đóng gói tài liệu và khung mẫu chuẩn (Boilerplate) để bất kỳ lập trình viên hoặc AI Agent nào khi tạo module mới cũng có thể bổ sung icon đồng nhất trong vòng dưới 2 phút.

---

## 2. Triết Lý Thiết Kế 3 Lớp (3-Tier Layer Architecture)

Mỗi biểu tượng công cụ độc quyền bắt buộc phải tuân theo cấu trúc phân tầng chiều sâu 3 lớp (3-tier depth stack):

```
┌────────────────────────────────────────────────────────┐
│  LỚP 3: KHỐI TẬP TRUNG NĂNG LƯỢNG (Chromatic Core)     │
│  → var(--accent-contrast) [Light] / var(--accent) [Dark]
├────────────────────────────────────────────────────────┤
│  LỚP 2: BỘ KHUNG KẾT CẤU CHÍNH (Structural Anatomy)    │
│  → stroke-zinc-700 [Light] / stroke-zinc-200 [Dark]    │
├────────────────────────────────────────────────────────┤
│  LỚP 1: MẶT PHẲNG NỀN & BÓNG THỂ (Base Substrate)      │
│  → Duotone fill (10%-15% opacity theo accent tông màu)  │
└────────────────────────────────────────────────────────┘
```

### Lớp 1: Mặt phẳng nền / Bóng thể (Base Substrate Plane)
- **Nhiệm vụ**: Định hình hình khối tổng thể (silhouette) của công cụ khi nhìn lướt qua.
- **Quy chuẩn**: Dùng `<rect>`, `<circle>`, hoặc `<path>` khép kín với bo góc mềm (`rx="2"` hoặc `rx="2.5"`).
- **Màu sắc**: Sử dụng fill màu mờ nhạt tương ứng với danh mục của công cụ:
  `class="fill-{accent}-500/10 dark:fill-{accent}-400/15 stroke-zinc-400/30 dark:stroke-white/10 transition-colors duration-200"`

### Lớp 2: Bộ khung kết cấu chính (Structural Line Anatomy)
- **Nhiệm vụ**: Thể hiện công cụ cơ học thực tế (tờ tài liệu, thùng nén, khung camera quét, bàn phân đoạn slider).
- **Quy chuẩn**:
  - `stroke-width="1.6"`
  - `stroke-linecap="round"`
  - `stroke-linejoin="round"`
- **Màu sắc**:
  `class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200"`
  - *Light Mode*: Nét đậm màu chì than (`zinc-700`) sắc nét trên nền kính sáng.
  - *Dark Mode*: Nét sáng kim loại bạc (`zinc-200`) nổi bật trên nền đen xám.

### Lớp 3: Điểm nhấn động cơ (Chromatic Engine Spark)
- **Nhiệm vụ**: Điểm xuyết chi tiết bản quyền của động cơ kỹ thuật bên trong (ví dụ: điểm neo vector của PyMuPDF, tia laser quét mã QR, khối lăng kính chuyển mã FFmpeg, mắt LED lưu trữ NVMe).
- **Quy chuẩn**:
  - `stroke-width="1.8"` đến `2.0"`
  - Kế thừa biến màu động của thẻ công cụ:
    `class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200"` hoặc `class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200"`
- **Cơ chế Dual-Mode**:
  - **Light Mode (`--accent-contrast`)**: Sử dụng tone đậm bão hoà cao (ví dụ: Amber-700 `#B45309`, Sky-700 `#0369A1`, Emerald-700 `#047857`) đảm bảo độ tương phản WCAG ≥ 4.5:1, không bị chói hay bạc màu trên nền trắng.
  - **Dark Mode (`--accent`)**: Sử dụng tone neon tươi sáng (ví dụ: Amber `#F59E0B`, Sky `#0EA5E9`, Emerald `#10B981`) phát sáng tinh tế trên kính tối.

---

## 3. Quy Chuẩn Lưới Toạ Độ & Kỹ Thuật (Grid & Geometry Specifications)

| Tiêu chí | Thông số chuẩn | Ghi chú |
|---|---|---|
| **ViewBox** | `0 0 24 24` | Toạ độ gốc 24px chuẩn hệ vector |
| **Vùng an toàn (Active Canvas)** | `20 × 20 px` (từ toạ độ `(2,2)` tới `(22,22)`) | Đệm ngoài 2px để tránh bị clip khi hover scale |
| **Kích thước hiển thị thẻ** | `w-6 h-6 sm:w-6.5 sm:h-6.5` | Vừa vặn trong hộp `tool-accent-box` 44px/48px |
| **Độ dày nét chính (Lớp 2)** | `stroke-width="1.6"` | Đảm bảo tính nhất quán giữa các icon |
| **Độ dày nét nhấn (Lớp 3)** | `stroke-width="1.8"` hoặc `2.0"` | Tạo điểm nhấn thị giác ngay lập tức |
| **Bo góc nét vẽ** | `stroke-linecap="round"` `stroke-linejoin="round"` | Tránh góc nhọn gãy thô ráp |
| **Khả năng tiếp cận** | `aria-hidden="true"` và `select-none` | Thẻ card cha đã mang đầy đủ `aria-label` |

---

## 4. Danh Mục 12 Icon Chuẩn & Ẩn Dụ Thị Giác (Visual Metaphors)

| Tool ID | Tên công cụ | Tông màu Accent | Ẩn dụ thị giác & Chi tiết đồ hoạ |
|---|---|---|---|
| `pdf-studio` | PDF Studio | Amber `#F59E0B` | 2 trang tài liệu lồng nhau, góc gấp và đường cong Bezier vector kèm các node điều khiển PyMuPDF. |
| `quiz-generator` | Tạo Trắc Nghiệm | Purple `#8B5CF6` | Bảng đề thi A4, các dòng câu hỏi, nút tích đáp án hợp lệ và ngôi sao AI Neural Spark ở góc trên. |
| `archive-inspect` | Soi Tệp Nén | Sky `#0EA5E9` | Két lưu trữ ZIP với sống răng cưa, kính lúp soi không cần giải nén chứa các nhánh thư mục bên trong. |
| `server-archive` | Nén Tệp ZIP | Sky `#0EA5E9` | Hai má kẹp nén ép vào từ trên và dưới, gom khối tệp rời rạc thành một khối lưu trữ ZIP nén chặt. |
| `universal-converter` | File Converter | Indigo `#6366F1` | Quỹ đạo chuyển đổi 2 chiều khí động học ôm quanh viên ngọc lăng kính đa diện đại diện cho 65+ định dạng. |
| `markdown-docs` | Văn Bản & Tài Liệu | Purple `#8B5CF6` | Trang tài liệu chia đôi: nửa trái là mã nguồn Markdown (`#`, `>`), nửa phải là văn bản rich-text định dạng. |
| `qr-multi` | QR Studio | Emerald `#10B981` | Ma trận mã QR với 3 mắt định vị đồng tâm và tia sét trung tâm đại diện cho thanh toán VietQR / link động. |
| `qr-scan` | Quét Mã QR | Emerald `#10B981` | 4 góc ống ngắm camera reticle, các điểm dữ liệu ma trận và vệt laser quét tốc độ cao cắt ngang qua tâm. |
| `view-split` | ViewSplit | Cyan `#06B6D4` | 2 khung nhìn so sánh đặt cạnh nhau, thanh trượt wipe Before/After ở giữa và kính lúp soi từng pixel. |
| `hash-checksum` | Mã Băm & Base64 | Slate `#64748B` | Khiên an ninh mật mã bảo vệ cấu trúc lưới băm `#` kèm ấn tín kiểm định toàn vẹn dữ liệu. |
| `studocu-dl` | Studocu Downloader | Indigo `#6366F1` | Chồng slide bài giảng trên mây bị tia vector hút thẳng đứng xuống khay tài liệu PDF đóng gói hoàn chỉnh. |
| `storage` | Bộ Nhớ Lưu Trữ | Indigo `#6366F1` | Khay ổ cứng kép chuẩn rack NVMe, dải bus truyền tín hiệu và 2 đèn LED chỉ báo trạng thái đọc ghi. |

---

## 5. Quy Trình 4 Bước Tạo Icon Cho Module Mới (Step-by-Step SOP)

Khi phát triển thêm module thứ 13, 14... (ví dụ: `image-cropper`, `audio-studio`, `terminal-ssh`), thực hiện đúng các bước sau:

### Bước 1: Xác định bản sắc & Ẩn dụ cốt lõi
- Chọn mã màu chủ đạo (Accent Hex) và màu tương phản cao (Contrast Map) theo chuẩn Tailwind 700.
- Tìm kiếm ẩn dụ cốt lõi: Module này làm gì ở mức bản chất kỹ thuật? Tránh vẽ các hình khối chung chung vô nghĩa.

### Bước 2: Thiết kế mã SVG theo khung 3 lớp
Sử dụng mẫu chuẩn sau:

```javascript
// src/components/common/ToolIcons.js
'{new-tool-id}': (className = 'w-6 h-6') => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="\${className} select-none" aria-hidden="true">
    <!-- Lớp 1: Mặt phẳng nền & Bóng thể -->
    <rect x="4" y="4" width="16" height="16" rx="2.5" 
          class="fill-{accent}-500/10 dark:fill-{accent}-400/15 stroke-zinc-400/20 dark:stroke-white/10 transition-colors duration-200" stroke-width="1.2" />

    <!-- Lớp 2: Khung kết cấu công cụ cơ bản -->
    <path d="M..." 
          class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Lớp 3: Điểm nhấn động cơ thương hiệu -->
    <path d="M..." 
          class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="..." cy="..." r="1.5" 
            class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
  </svg>
`
```

### Bước 3: Đăng ký vào Tool Catalog & ToolCard
1. Mở [`src/hooks/useToolRegistry.js`](file:///c:/Users/AnhDuy/Code/Project/DD%20Studio/src/hooks/useToolRegistry.js) và khai báo module với `id: '{new-tool-id}'`.
2. Đăng ký hàm render vào đối tượng `TOOL_ICONS` trong [`src/components/common/ToolIcons.js`](file:///c:/Users/AnhDuy/Code/Project/DD%20Studio/src/components/common/ToolIcons.js).
3. Thẻ công cụ [`ToolCard.js`](file:///c:/Users/AnhDuy/Code/Project/DD%20Studio/src/components/dashboard/ToolCard.js) sẽ tự động gọi `renderToolIcon(tool.id, tool.icon)` và hiển thị ngay tức thì.

### Bước 4: Kiểm thử kiểm tra chất lượng (Verification)
1. Bật Light Mode và Dark Mode trên trình duyệt để kiểm tra:
   - Trong Light Mode: Các nét vẽ có sắc cạnh không? Màu accent có dễ đọc không (`var(--accent-contrast)`)?
   - Trong Dark Mode: Icon có phát sáng hài hoà trên nền đen không?
2. Chạy công cụ kiểm tra tự động:
   `impeccable detect src/components/common/ToolIcons.js src/components/dashboard/ToolCard.js`

---

## 6. Các Điều Cấm Kỵ (Anti-Patterns to Avoid)

- ❌ **CẤM dùng ký tự Unicode / Emoji** để thay thế icon (vi phạm quy chuẩn `craft-floor.md`).
- ❌ **CẤM dùng gradient màu lòe loẹt làm text/icon** (gây mất tập trung và khó đọc trên mobile).
- ❌ **CẤM vẽ icon vượt ra ngoài lề 24x24** (sẽ bị cắt xén khi hiệu ứng hover scale 1.05 kích hoạt).
- ❌ **CẤM hardcode mã màu cố định** như `#F59E0B` trực tiếp vào stroke mà không có biến tương phản dual-mode (sẽ bị nhạt màu trên nền sáng hoặc tối đen trên nền tối).
- ❌ **CẤM dùng quá nhiều chi tiết vụn vặt** (ở kích thước 24px, quá nhiều chi tiết sẽ biến thành vết bẩn thị giác).
