---
globs: "src/**/*.js, src/styles/**/*.css, index.html"
description: Autonomous Impeccable UI/UX Protocol for DuyDev-Studio
---

# Autonomous Impeccable UI/UX Protocol

## 1. Tokens & Dual-Theme Parity
- Use CSS variables from `src/styles/stitch-tokens.css` (`--canvas`, `--surface-base`, `--surface-elevated`, `--border-subtle`, `--accent: #4F46E5`). Zero arbitrary hex/neon colors.
- Light Mode First: Validate contrast on `#F4F4F6` base (dark text `#09090B`) and `#09090B` base (light text `#FAFAFA`).

## 2. Anti-AI-Slop & Microcopy
- Strictly ban robotic AI-translated terms: *"Kết xuất"*, *"Trích xuất"*, *"Bóc tách"*, *"Bộ nhớ đệm Cache"*, *"Văn bản vector"*, *"Thực thi tác vụ"*, *"Tiếp nhận yêu cầu"*, *"Khám phá sức mạnh"*, *"Trải nghiệm đỉnh cao"*, *"Hệ sinh thái"*.
- Enforce natural, concise everyday Vietnamese: *"Xử lý"*, *"Tải tài liệu"*, *"Tạo PDF"*, *"Đang tải trang..."*, *"Tải lại bản mới"*, *"Tải Video"*, *"Tải Audio"*, *"Lưu vào Drive"*, *"Sao chép"*, *"Xem trước"*.
- No parenthetical options per KI-CON-001 (`PNG`, not `PNG (Ảnh số)`). No fake telemetry.

## 3. Ergonomics & Polish
- Touch targets $\ge 44\text{px}$; zero horizontal overflow down to $360\text{px}$; honor `pb-safe`.
- Complete states: Empty, Loading, Error, Success.
- DOM hygiene: Run `window.lucide?.createIcons()` on dynamic HTML; prevent duplicate listeners.

## 4. 10-Tier Tool Card List System & Command Protocol
- **10 Cấp Độ Phân Hạng Thẻ (Tool Card Tiers):**
  - Tier 1: `E` (Common - Cơ bản thấp, viền xám tối giản)
  - Tier 2: `D` (Standard - Tiêu chuẩn, viền xanh thanh lịch)
  - Tier 3: `C` (Uncommon - Khá, viền xanh ngọc / lá mạ)
  - Tier 4: `B` (Rare - Hiếm, viền kim loại bạc, bóng kính đa tầng)
  - Tier 5: `A` (Epic - Sử thi, viền vàng đồng quý tộc, vát 45 độ)
  - Tier 6: `S` (Master - Siêu việt, viền tím hoàng gia, ngạnh góc kép)
  - Tier 7: `SS` (Grandmaster - Đại cao thủ, viền năng lượng Crimson-Violet)
  - Tier 8: `UR` (Ultra Rare - Thần thoại, viền quang phổ Holographic, Holo Foil Sheen)
  - Tier 9: `LR` (Legend Rare - Huyền thoại tối thượng, viền đa sắc, ngạnh vương miện, Radial Aura)
  - Tier 10: `EX` (Extra - Đẳng cấp vũ trụ đặc biệt, vầng hào quang tinh tú breathing, 100% GPU)
- **Cú pháp Lệnh Người Dùng:**
  `"Áp dụng box tier [tên_tier] cho card [tên_tool]"`
  *(Ví dụ: "Áp dụng box tier UR cho card Studocu downloader" hoặc "Áp dụng box tier EX cho card TikTok downloader")*
- **Quy trình Thực thi Tự Động của Agent:**
  1. Tra cứu `id` của tool trong `DEFAULT_TOOLS` tại `src/hooks/useToolRegistry.js` (ví dụ: `studocu-dl` hoặc `tiktok-downloader`).
  2. Chuẩn hóa mã tier sang chữ hoa (`E`, `D`, `C`, `B`, `A`, `S`, `SS`, `UR`, `LR`, `EX`).
  3. Gán hoặc cập nhật trường `tier: '[MÃ_TIER]'` vào đúng object của tool trong `DEFAULT_TOOLS`.
  4. Xác thực cú pháp bằng `rtk err node --check src/hooks/useToolRegistry.js`.
  5. Tuyệt đối không chỉnh sửa cấu trúc logic module nội bộ của tool (đặc biệt tuân thủ lệnh cấm đụng chạm module `Studocu`).

## Micro-Receipt
Include UI status in: `✅ [Verify: <cmd->0> | UI: ok | KI: <ID/none>]`
