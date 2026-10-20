---
globs: "src/**/*.js, src/styles/**/*.css, index.html"
description: UI Production Minimalism & Anti-Filler Standards
---

# UI Production Minimalism Standards

## 1. Prohibitions
- Banned filler: *"Sẵn sàng in ấn..."*, *"Giải mã tức thì..."*, *"PNG • Độ nét cao"*.
- Banned parentheticals: Use `"PNG"` (not `"PNG (Ảnh số)"`), `"SVG"` (not `"SVG (Vector in ấn)"`), `"WPA / WPA2"` (not `"(Phổ biến)"`).
- Dropzones: Clean `"Kéo thả hoặc tải tệp lên"` with format list (`PNG, JPG, WEBP, PDF`).
- Feedback: Real output / actual server status only (no fake telemetries).

## 2. Desktop & Mobile Parity
- Mobile touch targets $\ge 44\text{px}$; compact viewports $375\text{px}–430\text{px}$; safe-areas; OLED contrast.
- Never hide primary actions on mobile; use responsive breakpoints (`sm:`, `md:`, `lg:`).
- Tune spotlights/gradients to mobile ratios without washing out dark mode.
