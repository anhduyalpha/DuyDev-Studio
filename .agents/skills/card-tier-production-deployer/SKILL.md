---
name: card-tier-production-deployer
description: Quy trình tự động hoá đổi cấp độ (10-Tier RPG Rarity) cho tool card và triển khai trực tiếp lên production HTTPS (https://studio.duydev.cloud) với kiểm tra tương phản Light/Dark, bump cache SW và chụp ảnh kiểm chứng. Kích hoạt khi người dùng yêu cầu 'Đổi card ... trên https thành tier ...' hoặc 'Áp dụng tier ... cho card ... trên production'.
activation: on-demand
---

# Quy Trình Đổi Tier Card & Triển Khai Production HTTPS

Khi người dùng ra lệnh: `"Đổi card [tên_tool] trên https thành tier [tên_tier]"`:

### Bước 1: Tra cứu Tool & Cập Nhật Registry
1. Mở `src/hooks/useToolRegistry.js`.
2. Tìm đúng tool theo tên/ID (vd: `studocu-dl`, `tiktok-downloader`, `archive-inspect`, `universal-converter`, ...).
3. Cập nhật thuộc tính `tier: '<TIER>'` tương ứng: `E`, `D`, `C`, `B`, `A`, `S`, `SS`, `UR`, `LR`, `EX`.
4. *Bất biến*: Không sửa file trong `src/components/tools/<tool>/**` hoặc `server/src/services/<tool>/**`.

### Bước 2: Kiểm Tra Tương Phản 2 Chế Độ (Light & Dark Parity Check)
Kiểm tra cấu hình CSS của tier tương ứng trong `src/styles/card-tiers-10.css`:
- **Light Mode (`.tier-card.<tier>`):**
  - Nền thẻ phải là tone sáng/kem/pastel hòa nhập với dashboard trắng (tránh biến thành khối đen đơn độc).
  - Tiêu đề (`h3`) và mô tả (`p.text-xs`) dùng tone màu đậm (tương phản $\ge 5:1$).
  - Nhãn specs (`.flex.flex-wrap span`): Phải có nền riêng và màu chữ đậm rõ ràng, không dùng màu vàng/trắng tàng hình.
  - Icon box (`.tool-accent-box`): Nền huy hiệu sáng/rực rỡ, đường nét SVG bên trong không bị nuốt bởi bóng đổ hay nền tối.
  - Hạt (`.spark`) & Tia Sét: Ở Light Mode, stroke và hạt phải dùng tone màu đậm hơn (vd: Hổ phách `#D97706` / `#F59E0B` cho LR) với `z-index` phù hợp để thấy rõ trên nền sáng.
- **Dark Mode (`html.dark .tier-card.<tier>`):**
  - Nền obsidian/tinh vân huyền bí, chữ trắng, hạt và tia sét phát sáng rực rỡ.

### Bước 3: Bump Cache Service Worker & Index (Chống Stale Cache)
- Mở `index.html`: Bump query string của `card-tiers-10.css?v=23.xx` lên `+0.01`.
- Mở `sw.js`: Bump `CACHE_NAME = 'duydev-studio-v23.xx'` và asset tương ứng lên `+0.01`.

### Bước 4: Kiểm Tra Build & Commit Git
1. Build kiểm tra TypeScript: `rtk npm --prefix server run build` (thoát mã 0).
2. Commit theo chuẩn Conventional Commits:
   `rtk git add index.html sw.js src/hooks/useToolRegistry.js src/styles/card-tiers-10.css`
   `rtk git commit -m "feat(dashboard): apply Tier <TIER> to <TOOL> card in production (v<VER>)"`

### Bước 5: Triển Khai Production Homeserver & Kiểm Tra Sức Khỏe
1. Thực thi script deploy production:
   `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-prod.ps1`
2. Kiểm tra endpoint health:
   `curl.exe --connect-timeout 3 --max-time 5 -s http://192.168.2.171:3000/api/v1/health`
   (Phải trả về `{"status":"UP"}`).

### Bước 6: Chụp Ảnh Xác Minh Playwright (Evidence Before Claims)
1. Dùng Playwright chụp trực tiếp card đã đổi trên `http://192.168.2.171:3000/` ở cả 2 chế độ:
   - `<tool>_live_prod_light.png`
   - `<tool>_live_prod_dark.png`
2. Gọi `view_file` xem lại ảnh để xác thực: chữ đọc rõ, icon sắc nét, hiệu ứng hạt và điện đang chớp sống động.

### Bước 7: Báo Cáo Micro-Receipt
Kết thúc turn bằng receipt chuẩn:
`✅ [Verify: deploy-prod.ps1+health->UP | UI: <tool>-tier-<tier>-ok | KI: none]`
