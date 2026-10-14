---
activation: always
trigger: always_on
globs:
  - "src/**"
  - "index.html"
  - "src/styles/**"
description: Autonomous Impeccable Design System & UI/UX Enforcement Pipeline for DuyDev-Studio
---

# Autonomous Impeccable UI/UX Enforcement Protocol

## Objective
Enforce production-grade craft across all **DuyDev-Studio** UI touchpoints. You must treat any edit to `src/pages/**`, `src/components/**`, `src/styles/**`, or `index.html` as a high-stakes UI/UX task—regardless of whether the file extension is `.js`, `.html`, or `.css`—and automatically execute this 3-stage pipeline without user prompting.

---

## 1. STAGE 1 — PRE-RENDER TOKEN & PATTERN ALIGNMENT (Before Editing UI Code)

1. **Strict Design Token Consumption**:
   - Always consume CSS custom properties from [src/styles/stitch-tokens.css](../../src/styles/stitch-tokens.css).
   - **BANNED**: Arbitrary hardcoded hex values (e.g. `#1e1e24`, `#2a2b36`), random neon gradients, or mismatched border-radii (`rounded-3xl` on strict utility components).
   - **REQUIRED Core Tokens**:
     * **Surfaces**: `var(--canvas)`, `var(--surface-base)`, `var(--surface-elevated)`, `var(--surface-hover)`
     * **Borders**: `var(--border-subtle)` (10-12% opacity), `var(--border-hover)`, `var(--border-active)`
     * **Typography**: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
     * **Brand Accent**: `var(--accent)` (`#4F46E5`), `var(--accent-light)` (`#6366F1`)
     * **Glass & Shadows**: `var(--glass-dock)`, `var(--glass-panel)`, `var(--glass-card)`, `var(--dock-shadow)`

2. **Light Mode First Parity**:
   - Every surface, border, chip, badge, input, and overlay MUST be verified in BOTH modes:
     * **Light Mode Base**: `#F4F4F6` canvas with pure white `#FFFFFF` cards, dark text (`#09090B`), and subtle borders (`rgba(0,0,0,0.09)`).
     * **Dark Mode Base**: `#09090B` canvas with dark elevated `#131317` / `#1a1a20` cards, light text (`#FAFAFA`), and dark borders (`rgba(255,255,255,0.12)`).
   - Explicitly avoid unreadable dark-on-dark or washed-out white-on-white text in `<select>`, `<input>`, or modal backdrops.

---

## 2. STAGE 2 — ANTI-AI-SLOP COPYWRITING & VISUAL GUARDRAILS

1. **Natural, Utilitarian Vietnamese Microcopy**:
   - **STRICTLY BANNED Marketing Buzzwords & Robotic Translations**:
     * ❌ *"Bóc tách luồng video"* / *"Bóc tách"* $\rightarrow$ ✅ *"Tải Video"* hoặc *"Xử lý"*
     * ❌ *"Khám phá sức mạnh"* / *"Trải nghiệm đỉnh cao"* $\rightarrow$ **Xoá bỏ hoàn toàn**
     * ❌ *"Hệ sinh thái toàn diện"* $\rightarrow$ **Xoá bỏ hoàn toàn**
     * ❌ *"Sẵn sàng in ấn, chia sẻ qua Zalo, Messenger, AirDrop"* $\rightarrow$ **Xoá bỏ hoàn toàn**
     * ❌ *"Giải mã tức thì trực tiếp trên thiết bị của bạn"* $\rightarrow$ **Xoá bỏ hoàn toàn**
     * ❌ *"PNG (Ảnh số)"*, *"SVG (Vector in ấn)"* $\rightarrow$ ✅ *"PNG"*, *"SVG"*
   - **REQUIRED Utilitarian Action Verbs**:
     * Use direct, clear verbs: *"Tải xuống"*, *"Tải Video"*, *"Tải Audio (mp3)"*, *"Lưu vào Drive"*, *"Sao chép"*, *"Xem trước"*, *"Làm mới"*, *"Xoá lịch sử"*.

2. **Visual Restraint (`KI-CON-001` + `.impeccable`)**:
   - No fake telemetry counters, no ornamental dividers, no gratuitous glow badges.
   - Maintain High Information Density: Clean labels, compact chips, and subtle icons.
   - Zero Layout Shift: Pre-allocate card heights or use skeleton placeholders to prevent layout jumps during surgical DOM updates.

---

## 3. STAGE 3 — AUTONOMOUS POST-EDIT "CRITIQUE & POLISH" PASS

Before finalizing any frontend change, autonomously verify the following checklist:

1. **Hierarchy & Spacing**:
   - Consistent padding (`p-4` to `p-6` on cards, `p-3` on inputs) and standard gap rhythm (`gap-2` for micro-actions, `gap-4` to `gap-6` for sections).
2. **Mobile & APK Ergonomics**:
   - Touch targets for all interactive buttons, pills, and tabs must be $\ge 44\text{px}$ in height/width.
   - Test responsive layout: Zero horizontal scroll / overflow on narrow screens down to $360\text{px}$.
   - Ensure sticky headers and bottom floating docks honor Android gesture bars and safe-areas (`pb-safe`).
3. **State Completeness**:
   - Explicitly verify all 4 UI states:
     * **Empty**: Clean, minimal state with single action or dropzone.
     * **Loading**: Subtle pulse/spinner with disabled interactive elements.
     * **Error**: Red accent toast or inline message with actionable retry, not silent failure.
     * **Success / Duplicate**: Clear confirmation chip or notification without disruptive modal popups.
4. **Vanilla DOM Hygiene**:
   - Ensure `window.lucide?.createIcons()` is called after injecting dynamic HTML templates.
   - Respect singleton state managers (`StorageManager`, `TiktokManager`) and do not attach duplicate listeners on re-renders.

---

## 4. Mandatory UI Completion Receipt
Whenever any task touches `src/**` or `index.html`, append this receipt line immediately above the KI Lifecycle receipt:

```text
🎨 [Impeccable UI]: Tokens: [Verified stitch-tokens/Light+Dark] | Copy: [Natural VI] | Polish: [Passed mobile/hierarchy check]
```
