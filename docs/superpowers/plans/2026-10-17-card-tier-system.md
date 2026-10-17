# 10-Tier Tool Card Template & Styling System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Architecture & Scope
Tạo sẵn hệ thống Template Khung Viền & 10 Cấp Độ Phân Hạng Thẻ (Tool Card Tier List 10 Levels) cho Trang Chủ Dashboard mà chưa kích hoạt hàng loạt lên các card hiện tại.
Đảm bảo khi người dùng ra lệnh (ví dụ: *"Áp dụng box tier UR cho card Studocu downloader"*), chỉ cần gán trường `tier: 'UR'` trong `src/hooks/useToolRegistry.js` là card sẽ tự động hiển thị đầy đủ hiệu ứng khung viền, ngạnh góc, huy hiệu và ánh quang.
**Tuyệt đối không chỉnh sửa bất kỳ file nào thuộc module `Studocu`** (`src/components/tools/studocu/**`, `server/src/services/studocu/**`, `src/styles/studocu.css`).

---

### Task 1: Định nghĩa 10 Cấp Độ trong `src/hooks/useToolRegistry.js`
- [ ] Định nghĩa hằng số `CARD_TIERS` với 10 cấp độ từ `E` đến `EX`:
  1. `E` (Common - Cơ bản thấp)
  2. `D` (Standard - Tiêu chuẩn)
  3. `C` (Uncommon - Khá)
  4. `B` (Rare - Hiếm)
  5. `A` (Epic - Sử thi)
  6. `S` (Master - Siêu việt)
  7. `SS` (Grandmaster - Đại cao thủ)
  8. `UR` (Ultra Rare - Thần thoại)
  9. `LR` (Legend Rare - Huyền thoại tối thượng)
  10. `EX` (Extra - Đẳng cấp vũ trụ đặc biệt)
- [ ] Export helper `getCardTierConfig(tierKey)` và các phương thức hỗ trợ trên `ToolRegistry`.
- [ ] Giữ nguyên danh sách công cụ hiện tại trong `DEFAULT_TOOLS` (chưa gán hàng loạt).
- [ ] Kiểm tra cú pháp bằng `rtk err node --check src/hooks/useToolRegistry.js`.

### Task 2: Cập nhật `src/components/dashboard/ToolCard.js` để Hỗ trợ Hiển thị Tier Template
- [ ] Import `getCardTierConfig` từ `useToolRegistry.js`.
- [ ] Kiểm tra nếu `tool.tier` tồn tại:
  - Bổ sung class `tier-card ${tierConfig.className}` vào card container.
  - Render Corner Ornaments (`tier-corner-ornament` 4 góc).
  - Render Crest Badge (`tier-crest-badge` với mã tier & huy hiệu).
  - Render Ambient Radial Aura & Holo Foil Sheen tương ứng với cấp độ (`UR`, `LR`, `EX`).
- [ ] Nếu `tool.tier` không có, card hiển thị hoàn toàn bình thường như cũ (Zero Regression).
- [ ] Kiểm tra cú pháp bằng `rtk err node --check src/components/dashboard/ToolCard.js`.

### Task 3: Xây dựng Bộ Khung CSS 10 Cấp Độ `src/styles/card-tiers-10.css`
- [ ] Tạo file `src/styles/card-tiers-10.css` với đầy đủ:
  - Cấp 1–3 (`E`, `D`, `C`): Viền tối giản, màu sắc trung tính (Xám, Xanh nhạt, Xanh lá mạ), bo góc gọn gàng.
  - Cấp 4–6 (`B`, `A`, `S`): Viền kim loại nổi khối, hiệu ứng bóng kính đa tầng, huy hiệu tên bậc rõ nét (Bạc, Vàng đồng, Hoàng gia).
  - Cấp 7–8 (`SS`, `UR`): Viền năng lượng chuyển sắc (Crimson-Violet, Prismatic Holographic), ngạnh góc sắc sảo, hiệu ứng quét sáng mặt kính (Holo Foil Sheen) khi tương tác.
  - Cấp 9–10 (`LR`, `EX`): Đẳng cấp tối thượng đa sắc, vầng hào quang tỏa sáng (Radial Aura), ngạnh vương miện 4 góc tinh xảo, 100% GPU (`transform`/`opacity`), sleep khi backgrounded (`KI-FIX-023`).
  - Hỗ trợ đầy đủ Light Mode và Dark Mode.
- [ ] Tích hợp `src/styles/card-tiers-10.css` vào `index.html` và `sw.js` (bump version lên `v23.26`).

### Task 4: Cập nhật `AGENTS.md` & Quy Tắc Cú Pháp Lệnh
- [ ] Bổ sung hướng dẫn cú pháp lệnh `"Áp dụng box tier [tên_tier] cho card [tên_tool]"` vào `AGENTS.md` và `.agents/rules/impeccable-auto.md`.
- [ ] Ghi rõ bảng mapping 10 tier để Agent nắm bắt nhanh.

### Task 5: Kiểm tra Toàn diện & Báo cáo Hoàn tất
- [ ] Xác minh không chạm vào bất kỳ file nào thuộc module `Studocu` bằng `rtk git status`.
- [ ] Kiểm tra `rtk err node --check src/hooks/useToolRegistry.js`.
- [ ] Kiểm tra `rtk err node --check src/components/dashboard/ToolCard.js`.
- [ ] Kiểm tra `rtk err "server/node_modules/.bin/tsc.cmd" -p server/tsconfig.json --noEmit`.
- [ ] Xuất biên lai 1 dòng chuẩn theo yêu cầu.
