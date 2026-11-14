---
id: KI-FIX-055
title: Khắc Phục Hiệu Ứng Card Tier Không Lặp Vô Tận (Dead Holds, Lỗi Keyframe UR) & Triệt Tiêu Hiện Tượng Đơ Hoạt Họa Khi Cuộn (is-swiping)
type: troubleshoot
domain: frontend
status: verified
created_at: 2026-11-14
updated_at: 2026-11-14
version: 1.0.0
trigger_conditions:
  - Khi hiệu ứng quét sáng/shimmer/beam trên card tier B, A, UR, LR bị khựng giữa chừng hoặc biến mất lâu rồi giật lùi
  - Khi vòng mandala trong của card Tier UR đứng im hoàn toàn không xoay
  - Khi cuộn trang làm đơ/đứng toàn bộ hiệu ứng chuyển động trên Dashboard
search_queries:
  - card-tiers-10 infinity loop dead hold
  - is-swiping animation-play-state paused scroll freeze
  - tierViewportGovernor root class thrashing
  - ur-mandala-inner spin-counter-clockwise
tags:
  - card-tiers
  - css-animations
  - 120hz
  - compositor
  - performance
---

# KI-FIX-055: Khắc Phục Hiệu Ứng Card Tier Không Lặp Vô Tận & Triệt Tiêu Hiện Tượng Đơ Hoạt Họa Khi Cuộn

## 1. Triệu Chứng (Symptoms)
1. **Hiệu ứng card tier bị khựng và giật lùi (Broken Infinity Loop)**:
   - Vệt quét sáng (`blade-sheen-sweep`, `sweep-shimmer`, `solar-beam-sweep`) chỉ quét trong `28%–35%` đầu chu kỳ rồi đứng im `2.7s–4.9s` (`28%, 100%` / `30%, 100%` / `35%, 100%`) và giật lùi về mốc `0%`.
   - `sweep-holo-foil` và `ur-prismatic-sweep` dùng đường cong `cubic-bezier` / `ease-in-out` trên biên độ quá rộng (`400%` container với `translate3d(+-120%)`), khiến ánh sáng chạy vụt qua rồi tắt ngấm phần lớn chu kỳ.
   - Nhịp tim `blood-heartbeat` đứng im ở `48%–100%`.
   - Vòng xoay trong của thẻ Tier UR (`.ur-mandala-inner`) liệt hoàn toàn.
2. **Đơ toàn bộ hiệu ứng khi cuộn trang**:
   - Khi cuộn chuột hoặc vuốt chạm, toàn bộ vòng xoay, tia sáng và hạt lơ lửng trên mọi card tier bị đóng băng trong suốt thời gian cuộn và `120ms` sau đó.

---

## 2. Nguyên Nhân Kỹ Thuật (Root Cause)
1. **Dead Holds & Sai Hệ Quy Chiếu Phần Trăm Trong Keyframes (`src/styles/card-tiers-10.css`)**:
   - Các khối `@keyframes blade-sheen-sweep`, `sweep-shimmer`, `solar-beam-sweep` khóa cứng cùng một `transform` từ `28%/30%/35%` đến `100%`.
   - Các phần tử `inset: -150%; width: 400%;` khiến `translate3d(120%, ...)` dịch chuyển tới `480%` kích thước card, dành tới >70% thời gian chu kỳ ở ngoài vùng hiển thị.
   - Selector `.ur-mandala-inner` gọi `@keyframes spin-counter-clockwise` không tồn tại (tên chuẩn trong file là `spin-counter`).
2. **Scroll Freeze từ `tierViewportGovernor.js` & `html.is-swiping`**:
   - `tierViewportGovernor.js` lắng nghe `scroll`/`touchmove` toàn cục và gắn class `is-swiping` lên `<html>` (`KI-CON-012` violation), kích hoạt rule `html.is-swiping ... { animation-play-state: paused !important; }`.

---

## 3. Giải Pháp Chuẩn Hóa (Verified Fix)
1. **True Infinity Loops (`src/styles/card-tiers-10.css`)**:
   - Loại bỏ toàn bộ điểm chết (`28%, 100%`, `35%, 100%`, `48%..100%`).
   - Chuẩn hóa biên độ `translate3d` khớp tỉ lệ phần tử `400%` / `300%` / `220%` (`-48% -> +48%` cho `blade-sheen-sweep` và `solar-beam-sweep`; `-55% -> +55%` cho `sweep-shimmer`; `-80% -> +80%` cho `ur-prismatic-sweep`; `-100% -> +100%` cho `sweep-holo-foil`) với đường cong `linear infinite` và mượt hóa `opacity` tại rìa `0%/12%/88%/100%`.
   - Sửa `.ur-mandala-inner` sang `spin-counter 15s linear infinite`.
   - Tối ưu `blood-heartbeat` thành sóng tâm thu–tâm trương liên hoàn 0%–100%.
2. **Gỡ bỏ Scroll Freeze (`tierViewportGovernor.js`, `DashboardPage.js`, `card-tiers-10.css`)**:
   - Xóa rule CSS `html.is-swiping ... { animation-play-state: paused !important; }`.
   - Chuyển `initTierViewportGovernor()` thành no-op an toàn và gỡ bỏ lời gọi trong `DashboardPage.js`, giữ nguyên `IntersectionObserver` (`.tier-offscreen`) và `visibilitychange` (`html.app-backgrounded`) để tiết kiệm pin.
3. **Đồng bộ Tri-Point Version `v24.67`**:
   - Đồng bộ `sw.js`, `index.html`, và `src/utilities/pwa.js`.

---

## 4. Kiểm Chứng (Verification)
- `node --check src/utilities/tierViewportGovernor.js; node --check src/pages/DashboardPage.js; node --check src/utilities/pwa.js; node --check sw.js` -> Exit 0.
- `rtk npm --prefix server run build` -> Exit 0.
- `rtk vitest run tests/unit/smooth_scroll_120hz.test.ts tests/unit/battery_optimization.test.ts tests/unit/pwa_lifecycle.test.ts tests/unit/viewer_hardening.test.ts tests/unit/domain_migration.test.ts` -> `PASS (143) FAIL (0)`.
