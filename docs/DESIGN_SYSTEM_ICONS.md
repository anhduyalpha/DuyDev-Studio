# DuyDev Studio - Dual-Mode Tool Icon System

> **Tài liệu tham khảo nhanh và Triết lý thiết kế bộ Icon công cụ độc quyền của DuyDev Studio.**  
> Chi tiết chuẩn kiến thức: Xem thêm [KI-CON-007](knowledge-base/KI-CON-007-tool-icon-design-philosophy.md).

---

## 1. Tổng Quan Kiến Trúc

Hệ thống icon của DuyDev Studio được đặt tại [`src/components/common/ToolIcons.js`](../src/components/common/ToolIcons.js) và được tích hợp trực tiếp vào thẻ [`ToolCard.js`](../src/components/dashboard/ToolCard.js).

Mỗi icon là một SVG chuẩn hóa trên lưới toạ độ **24×24**, tự động chuyển đổi tương thích giữa **Light Mode** và **Dark Mode** thông qua 3 tầng chiều sâu:

1. **Lớp 1 (Base Substrate)**: Mặt phẳng nền bán trong suốt (`fill-{accent}-500/10 dark:fill-{accent}-400/15`).
2. **Lớp 2 (Structural Anatomy)**: Bộ khung cơ học nét vẽ `1.6px` (`stroke-zinc-700 dark:stroke-zinc-200`).
3. **Lớp 3 (Chromatic Engine Spark)**: Điểm nhấn động cơ mang màu sắc thương hiệu nét vẽ `1.8px-2.0px` (`stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)]`).

---

## 2. Hệ Màu & Độ Tương Phản Hai Chiều (Contrast Mapping)

| Accent Key | Giá trị Dark Mode (`--accent`) | Giá trị Light Mode (`--accent-contrast`) | Tỉ lệ tương phản Light |
|---|---|---|---|
| **Amber** | `#F59E0B` (Amber-500) | `#B45309` (Amber-700) | ≥ 4.8:1 (Đạt WCAG AA) |
| **Sky** | `#0EA5E9` (Sky-500) | `#0369A1` (Sky-700) | ≥ 5.1:1 (Đạt WCAG AA) |
| **Purple** | `#8B5CF6` (Purple-500) | `#6D28D9` (Purple-700) | ≥ 6.2:1 (Đạt WCAG AAA) |
| **Emerald** | `#10B981` (Emerald-500) | `#047857` (Emerald-700) | ≥ 4.9:1 (Đạt WCAG AA) |
| **Indigo** | `#6366F1` (Indigo-500) | `#4338CA` (Indigo-700) | ≥ 6.5:1 (Đạt WCAG AAA) |
| **Cyan** | `#06B6D4` (Cyan-500) | `#0E7490` (Cyan-700) | ≥ 4.6:1 (Đạt WCAG AA) |
| **Slate** | `#64748B` (Slate-500) | `#334155` (Slate-700) | ≥ 7.0:1 (Đạt WCAG AAA) |

---

## 3. Cách Sử Dụng Trong Mã Nguồn

```javascript
import { renderToolIcon } from '../common/ToolIcons.js';

// Tự động lấy SVG độc quyền của tool, hoặc fallback về icon Lucide nếu chưa có
const iconHtml = renderToolIcon(tool.id, tool.icon, 'w-6 h-6 sm:w-6.5 sm:h-6.5');
```

---

## 4. Khung Mẫu Chuẩn Cho Module Mới (Boilerplate Template)

Khi tạo module mới trong [`src/components/common/ToolIcons.js`](../src/components/common/ToolIcons.js), sao chép đoạn mã sau:

```javascript
'{tool-id}': (className = 'w-6 h-6') => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
    <!-- Layer 1: Nền bóng thể (Base Substrate) -->
    <rect x="4" y="4" width="16" height="16" rx="2.5" 
          class="fill-indigo-500/10 dark:fill-indigo-400/15 stroke-zinc-400/20 dark:stroke-white/10 transition-colors duration-200" stroke-width="1.2" />

    <!-- Layer 2: Kết cấu chính (Structural Anatomy) -->
    <path d="M7 9h10 M7 13h7" 
          class="stroke-zinc-700 dark:stroke-zinc-200 transition-colors duration-200" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Layer 3: Điểm nhấn động cơ (Chromatic Engine Spark) -->
    <circle cx="16" cy="15" r="2" 
            class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] transition-colors duration-200" />
    <path d="M14 17l4-4" 
          class="stroke-[var(--accent-contrast)] dark:stroke-[var(--accent)] transition-colors duration-200" stroke-width="1.8" stroke-linecap="round" />
  </svg>
`
```
