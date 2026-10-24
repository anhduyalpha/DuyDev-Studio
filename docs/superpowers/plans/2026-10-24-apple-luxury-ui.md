# Apple Luxury UI (Human Interface Guidelines) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng tầm toàn diện giao diện DuyDev Studio theo chuẩn Apple Luxury (macOS Sequoia / iOS 18 "Space Black & Ceramic Quartz") với hình học squircle đồng tâm, viền vát specular rim, optical tracking, và fluid haptics mà vẫn bảo toàn 100% độ mượt mà 120Hz/60Hz native compositor.

**Architecture:** Áp dụng 5 trụ cột mỹ thuật công nghiệp của Apple (Color Physics, Specular Rim Lighting, Concentric Squircles, Optical Kerning, và Fluid Motion Curves). Bảo vệ nghiêm ngặt quy chuẩn kiến trúc [`KI-CON-012`](../../knowledge-base/KI-CON-012-120hz-inertial-smooth-scroll-gpu-compositing.md) (0px blur trên thẻ cuộn lặp lại, cô lập GPU layer cho sticky chrome, toàn bộ micro-interactions chạy trên GPU Compositor `transform`/`opacity` không gây repaint hay style recalc).

**Tech Stack:** Vanilla ES Modules, Tailwind CSS CDN, CSS Custom Properties (`stitch-tokens.css`), Lucide Icons, Vitest, TypeScript compiler.

**Spec:** [Senior Architecture Review & Solution Design (2026-10-24)](../../DECISIONS.md)

---

## Global Constraints

- **KI-CON-012 Strict Compliance:** CẤM tuyệt đối thêm `backdrop-filter: blur(...)` vào các phần tử lặp lại trong danh sách cuộn (`.linear-card`, `.recent-activity-card`, `.tool-accent-box`). Toàn bộ test suite `server/tests/unit/smooth_scroll_120hz.test.ts` phải luôn pass 9/9.
- **10-Tier Tool Card Compatibility:** Giữ nguyên vẹn 100% cấu trúc class `tier-card`, `tier-crest-badge`, và các lớp ornament trong `card-tiers-10.css` (`E` đến `EX`).
- **Protected Codebase Paths:** TUYỆT ĐỐI không sửa code logic hay chạm vào bất kỳ file nào trong `src/components/tools/studocu/**` và `server/src/services/studocu/**`.
- **WCAG AA Contrast Parity:** Đảm bảo độ tương phản chữ $\ge 4.5:1$ trên cả 2 chế độ Light Mode (`#09090B` trên `#FFFFFF`/`#F5F5F7`) và Dark Mode (`#FAFAFA`/`#86868B` trên `#16161A`/`#0A0A0C`).
- **Touch Ergonomics:** Touch target tối thiểu $\ge 44\text{px}$, không gây horizontal overflow ở màn hình nhỏ $\ge 360\text{px}$.
- **Zero-Build Architecture:** Không sử dụng Vite/Webpack build steps cho frontend; giữ cấu trúc native ES modules nguyên bản.

## Review Focus

1. **120Hz Scroll Budget (< 8.33ms):** Kiểm tra xem việc thêm specular rim (`box-shadow: inset ...`) có làm tăng GPU paint time không; đảm bảo không kích hoạt style recalc khi cuộn.
2. **Mobile Touch Guard:** Đảm bảo các hiệu ứng hover nâng thẻ được bọc kín trong `@media (hover: hover) and (pointer: fine)` để thao tác vuốt cuộn trên màn hình cảm ứng không bị khựng.
3. **Squircle Ratio Consistency:** Kiểm tra tỷ lệ bo góc giữa card ngoài ($20\text{px}$) và icon container bên trong ($14\text{px}$) có đạt sự hài hòa đồng tâm $R_{\text{inner}} \approx R_{\text{outer}} - \text{padding}$ không.
4. **Light Mode High-Key Parity:** Đảm bảo Light Mode thể hiện đúng chất liệu gốm sứ Alabaster/Ceramic cao cấp, không bị chói mắt và không bị đục màu.
5. **Dark Mode Neutrality:** Loại bỏ triệt để sắc tố xanh lơ cũ (`#151821`), đạt màu đen sâu Space Black `#0A0A0C` và than chì graphite `#16161A`.

---

## Task Decomposition

### Task 1: Calibrate Apple Color Physics & Specular Lighting Tokens

**Files:**
- Modify: `src/styles/stitch-tokens.css:8-56` (CSS Custom Properties)
- Modify: `src/styles/stitch-tokens.css:338-379` (`.glass-pill`, `.glass-search`, `.recent-activity-card`)
- Modify: `src/styles/stitch-tokens.css:576-614` (`.linear-card` base & dark styles)
- Test: `server/tests/unit/smooth_scroll_120hz.test.ts`

**Interfaces:**
- Consumes: CSS variables `--canvas`, `--surface-base`, `--surface-elevated`, `--text-primary`, `--text-muted`
- Produces: Apple calibrated tokens (OLED Space Black `#0A0A0C`, Graphite `#16161A`, Ceramic `#F5F5F7`, Pure White `#FFFFFF`, Specular Chamfer Rims)

- [ ] **Step 1: Run baseline test suite to verify current green state**
  Run: `node server/node_modules/vitest/vitest.mjs run server/tests/unit/smooth_scroll_120hz.test.ts`
  Expected: PASS (9 passed)

- [ ] **Step 2: Update palette variables in `src/styles/stitch-tokens.css`**
  - Light mode:
    ```css
    --canvas: #F5F5F7;
    --surface-base: #FFFFFF;
    --surface-elevated: #FAFAFC;
    --surface-hover: #F0F0F2;
    --border-subtle: rgba(0, 0, 0, 0.06);
    --border-hover: rgba(0, 0, 0, 0.12);
    --text-primary: #1D1D1F;
    --text-secondary: #424245;
    --text-muted: #86868B;
    ```
  - Dark mode:
    ```css
    --canvas: #0A0A0C;
    --surface-base: #121215;
    --surface-elevated: #16161A;
    --surface-hover: #1E1E24;
    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-hover: rgba(255, 255, 255, 0.16);
    --text-primary: #F5F5F7;
    --text-secondary: #A1A1A6;
    --text-muted: #86868B;
    ```

- [ ] **Step 3: Update `.linear-card` surfaces with Specular Chamfer Rim**
  - Light mode `.linear-card`:
    - `background: #FFFFFF;`
    - `border: 1px solid rgba(0, 0, 0, 0.06);`
    - `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 6px 18px -2px rgba(0, 0, 0, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.90);`
    - `border-radius: 20px;`
  - Dark mode `html.dark .linear-card`:
    - `background: #16161A;`
    - `border: 1px solid rgba(255, 255, 255, 0.08);`
    - `box-shadow: 0 2px 6px rgba(0, 0, 0, 0.40), 0 10px 28px -4px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.09);`
  - Hover states: Keep within `@media (hover: hover) and (pointer: fine)` with transform `translateY(-2px)` and smooth box-shadow elevation.

- [ ] **Step 4: Update `.glass-pill`, `.glass-search`, and `.recent-activity-card` to match Apple Space Black/Ceramic theme**
  - Adjust background tone to neutral graphite, eliminating blue slate tint.
  - Maintain 0px blur on `.recent-activity-card` and `.glass-pill`.

- [ ] **Step 5: Verify test suite and commit Task 1**
  Run: `node server/node_modules/vitest/vitest.mjs run server/tests/unit/smooth_scroll_120hz.test.ts`
  Expected: PASS (9 passed, zero regressions against blur limits)
  Command:
  ```bash
  git add src/styles/stitch-tokens.css
  git commit -m "style(tokens): calibrate apple space black and ceramic quartz design tokens"
  ```

---

### Task 2: Refactor Tool Card to Concentric Squircle Geometry & Apple Optical Hierarchy

**Files:**
- Modify: `src/components/dashboard/ToolCard.js:48-100`
- Test: `node --check src/components/dashboard/ToolCard.js`

**Interfaces:**
- Consumes: `tool` object, `getCardTierConfig`, `renderToolIcon`, `renderTierStructuralLayers`
- Produces: Rendered HTML card with Apple HIG typography, concentric squircles, and fluid micro-press

- [ ] **Step 1: Check syntax baseline**
  Run: `cmd.exe /c "node --check src/components/dashboard/ToolCard.js"`
  Expected: PASS (exit code 0)

- [ ] **Step 2: Implement Apple Concentric Squircle & Touch Ergonomics in `renderToolCard`**
  - Outer card wrapper: Change `rounded-2xl` to `rounded-[20px]`, add `touch-manipulation`, add `active:scale-[0.985] transition-transform duration-150 ease-out`.
  - Icon container box: Change `rounded-xl` to `rounded-[14px]` (concentric ratio: $20 - 6 = 14\text{px}$).
  - Title typography: Add `tracking-[-0.025em] font-semibold text-zinc-900 dark:text-[#F5F5F7]`.
  - Description typography: Update muted class to `text-zinc-500 dark:text-[#86868B] leading-[1.45] text-[13px]`.
  - Spec badges: Change to `rounded-[8px] text-[10px] tracking-tight` with neutral border and tabular numbers.

- [ ] **Step 3: Verify syntax and file integrity**
  Run: `cmd.exe /c "node --check src/components/dashboard/ToolCard.js"`
  Expected: PASS (exit code 0)

- [ ] **Step 4: Commit Task 2**
  Command:
  ```bash
  git add src/components/dashboard/ToolCard.js
  git commit -m "style(cards): apply apple concentric squircles optical tracking and fluid haptics"
  ```

---

### Task 3: Refine Category Filter Pills to Apple Segmented Control Aesthetic

**Files:**
- Modify: `src/components/dashboard/CategoryFilters.js:24-49`
- Test: `node --check src/components/dashboard/CategoryFilters.js`

**Interfaces:**
- Consumes: `CATEGORIES`, `counts`, `activeCategory`
- Produces: Rendered Category Filter pill bar matching macOS/iOS Segmented Control

- [ ] **Step 1: Check syntax baseline**
  Run: `cmd.exe /c "node --check src/components/dashboard/CategoryFilters.js"`
  Expected: PASS (exit code 0)

- [ ] **Step 2: Update pill styling in `renderCategoryFilters`**
  - Pill container: Ensure smooth horizontal scroll with `custom-scrollbar` and `scroll-smooth`.
  - Active pill:
    - Light: `bg-[#1D1D1F] text-white font-semibold shadow-xs border-[#1D1D1F]`
    - Dark: `bg-white/[0.14] text-white font-semibold shadow-xs border-white/[0.16] inset 0 1px 0 rgba(255,255,255,0.18)`
  - Inactive pill: `rounded-[12px] bg-white dark:bg-[#16161A] text-zinc-600 dark:text-[#86868B] border border-black/[0.06] dark:border-white/[0.08]`
  - Badge: `rounded-[6px] px-1.5 py-0.5 text-[11px] font-mono`
  - Fluid press: `active:scale-[0.96] transition-transform duration-100`

- [ ] **Step 3: Verify syntax and commit Task 3**
  Run: `cmd.exe /c "node --check src/components/dashboard/CategoryFilters.js"`
  Expected: PASS (exit code 0)
  Command:
  ```bash
  git add src/components/dashboard/CategoryFilters.js
  git commit -m "style(filters): modernize category filter pills to apple segmented control aesthetic"
  ```

---

### Task 4: Polish Header & Bottom Dock with Apple Specular Glass Rim

**Files:**
- Modify: `src/styles/stitch-tokens.css` (`.glass-panel`, `.glass-dock`)
- Test: `server/tests/unit/smooth_scroll_120hz.test.ts`

**Interfaces:**
- Consumes: `.glass-panel` (header) and `.glass-dock` (bottom navigation)
- Produces: Dedicated GPU layer with specular chamfered lighting rim

- [ ] **Step 1: Update `.glass-panel` (Header) styling in `src/styles/stitch-tokens.css`**
  - Maintain `transform: translateZ(0)`, `will-change: transform`, `backface-visibility: hidden`.
  - Set blur strictly to `blur(12px)`.
  - In Dark mode: Add bottom specular border `border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(10, 10, 12, 0.80);`.
  - In Light mode: `border-bottom: 1px solid rgba(0, 0, 0, 0.06); background: rgba(255, 255, 255, 0.82);`.

- [ ] **Step 2: Update `.glass-dock` (Bottom Navigation) in `src/styles/stitch-tokens.css`**
  - In Dark mode: Add specular top rim `box-shadow: 0 -1px 0 0 rgba(255, 255, 255, 0.10), 0 12px 32px rgba(0, 0, 0, 0.55);`.
  - In Light mode: `box-shadow: 0 -1px 0 0 rgba(0, 0, 0, 0.05), 0 12px 32px rgba(0, 0, 0, 0.08);`.

- [ ] **Step 3: Verify 120Hz test suite and commit Task 4**
  Run: `node server/node_modules/vitest/vitest.mjs run server/tests/unit/smooth_scroll_120hz.test.ts`
  Expected: PASS (9 passed)
  Command:
  ```bash
  git add src/styles/stitch-tokens.css
  git commit -m "style(chrome): add specular glass rim to header and bottom dock"
  ```

---

### Task 5: End-to-End Verification, SW Cache Alignment, & Production Readiness

**Files:**
- Modify: `sw.js` (bump cache version)
- Modify: `index.html` (bump stylesheet query parameter `?v=...`)
- Test: Vitest suite & TypeScript compilation

- [ ] **Step 1: Run TypeScript compiler check**
  Run: `cmd.exe /c "server\node_modules\.bin\tsc.cmd -p server\tsconfig.json --noEmit"`
  Expected: PASS (0 errors)

- [ ] **Step 2: Run all backend unit test suites**
  Run: `node server/node_modules/vitest/vitest.mjs run`
  Expected: PASS (All test suites pass)

- [ ] **Step 3: Bump PWA Service Worker cache version**
  - In `sw.js`: Bump version from `duydev-studio-v22.50` (or current) to new milestone version (e.g. `duydev-studio-v23.90`).
  - In `index.html`: Align asset versions on `stitch-tokens.css?v=23.90`.

- [ ] **Step 4: Commit and tag completion**
  Command:
  ```bash
  git add sw.js index.html
  git commit -m "chore(pwa): bump sw cache to v23.90 for apple luxury ui rollout"
  ```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 5 Apple luxury pillars (Color Physics, Specular Rim, Squircle Geometry, Optical Kerning, Fluid Haptics) are covered in dedicated tasks.
- [x] **Step scan:** Every step contains the exact files, CSS properties, commands, and expected results.
- [x] **Type & Syntax consistency:** All modifications conform to Vanilla ES Modules and Fastify TypeScript contracts.
- [x] **Zero regressions against `KI-CON-012`:** Zero `backdrop-filter` added to repeating cards; 120Hz compositor invariant strictly verified in Task 1, Task 4, and Task 5.
- [x] **Protected modules respected:** Zero edits to `Studocu` or `Scribd` code.
