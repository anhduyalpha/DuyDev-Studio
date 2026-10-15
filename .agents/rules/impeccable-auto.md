---
globs:
  - "src/**/*.js"
  - "src/styles/**/*.css"
  - "index.html"
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

## Micro-Receipt
Include UI status in: `✅ [Verify: <cmd->0> | UI: ok | KI: <ID/none>]`
