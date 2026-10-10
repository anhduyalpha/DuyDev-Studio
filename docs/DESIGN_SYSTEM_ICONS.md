# DuyDev Studio - Apple-Grade Dual-Mode Tool Icon System

> **Tài liệu tham khảo nhanh & Triết lý thiết kế bộ Icon công cụ chuẩn Apple (macOS Sequoia / iOS 18 / visionOS).**  
> Chi tiết chuẩn kiến thức: Xem thêm [KI-CON-002](knowledge-base/KI-CON-002-tool-icon-design-philosophy.md).

---

## 1. Tổng Quan Kiến Trúc

Hệ thống icon của DuyDev Studio được đặt tại [`src/components/common/ToolIcons.js`](../src/components/common/ToolIcons.js) và được nhúng trực tiếp vào thẻ [`ToolCard.js`](../src/components/dashboard/ToolCard.js).

Mỗi icon là một SVG chuẩn hóa trên lưới toạ độ **24×24**, tự động chuyển đổi tương thích giữa **Light Mode** và **Dark Mode** thông qua 3 tầng chiều sâu vật lý:

1. **Tầng 1 (Substrate Base Plate)**: Mặt phẳng đế nền nhận ánh sáng 135° với dải gradient mờ nhẹ (`10%-25%` opacity).
2. **Tầng 2 (Structural Titanium/Glass)**: Khung kim loại / kính mờ bo tròn chuẩn Apple nét vẽ `1.5px - 1.6px` (`stroke-zinc-700/80` trong Light Mode, `stroke-zinc-300` trong Dark Mode).
3. **Tầng 3 (Specular Engine Gem)**: Linh kiện hội tụ quang học đa diện mang màu sắc thương hiệu (`--accent` và `--accent-contrast`), có điểm chói sáng (optical glints) và viền phản xạ sắc sảo.

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

// Tự động render SVG độc quyền của tool, hoặc fallback về icon Lucide nếu chưa có
const iconHtml = renderToolIcon(tool.id, tool.icon, 'w-6 h-6 sm:w-6.5 sm:h-6.5');
```

---

## 4. Khung Mẫu Chuẩn Cho Module Mới (Boilerplate Template)

Khi tạo module mới trong [`src/components/common/ToolIcons.js`](../src/components/common/ToolIcons.js), sao chép đoạn mã sau:

```javascript
'{tool-id}': (className = 'w-6 h-6') => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="${className} select-none" aria-hidden="true">
    <defs>
      <linearGradient id="ds-apple-{id}-base" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
        <stop offset="100%" stop-color="var(--accent-contrast)" stop-opacity="0.06" />
      </linearGradient>
    </defs>

    <!-- Tầng 1: Đế nền bo góc mềm -->
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="url(#ds-apple-{id}-base)" class="stroke-zinc-400/30 dark:stroke-white/10" stroke-width="1.2" />

    <!-- Tầng 2: Kết cấu cơ học chính -->
    <path d="M..." class="stroke-zinc-700/80 dark:stroke-zinc-300" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Tầng 3: Linh kiện hội tụ quang học -->
    <circle cx="12" cy="12" r="2.5" class="fill-[var(--accent-contrast)] dark:fill-[var(--accent)] stroke-white dark:stroke-zinc-900" stroke-width="1" />
  </svg>
`
```
