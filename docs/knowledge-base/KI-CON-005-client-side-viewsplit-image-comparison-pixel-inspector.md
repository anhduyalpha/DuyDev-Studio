---
id: KI-CON-005-client-side-viewsplit-image-comparison-pixel-inspector
title: "Kiến Trúc So Sánh Ảnh Đa Khung Nhìn Thuần Client-Side (Zero-Upload), Slider Wipe & Soi Điểm Ảnh Pixel Inspector (ViewSplit)"
type: concept
status: verified
domain: frontend
tags: [viewsplit, canvas2d, image-comparison, pixel-inspector, slider-wipe, zero-upload, synchronized-pan-zoom, loupe, coordinates-normalization]
created_at: 2026-10-10
updated_at: 2026-10-10
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi thiết kế, mở rộng hoặc tối ưu mô-đun so sánh ảnh ViewSplit; xử lý không gian tọa độ chuẩn hóa [0,1], đồng bộ Pan/Zoom đa khung nhìn, vẽ Loupe HUD soi điểm ảnh, hoặc điều phối chuyển pane tự động khi nạp/dán ảnh."
search_queries:
  - "Kiến trúc so sánh ảnh đa khung nhìn Canvas 2D ViewSplit"
  - "Zero-upload client-side image comparison architecture"
  - "Pixel inspector loupe 9x9 grid RGB HEX extraction"
  - "Synchronized zoom pan normalized coordinates canvas"
  - "Slider wipe before after split comparison clip rect"
  - "Auto-advance target pane state machine clipboard paste"
related_kis:
  - KI-CON-001-ui-production-minimalism
  - KI-CON-002-native-zero-iframe-tool-module-integration
  - KI-FIX-006-clipboard-paste-validation-browser-permissions
---

# [KI-CON-005] Kiến Trúc So Sánh Ảnh Đa Khung Nhìn Thuần Client-Side (Zero-Upload), Slider Wipe & Soi Điểm Ảnh Pixel Inspector (ViewSplit)

## 1. Context & Purpose
Trong các tác vụ đồ họa, xử lý ảnh, thiết kế UI/UX hoặc đánh giá chất lượng nén/nâng cấp ảnh AI, người dùng cần so sánh chi tiết từng pixel giữa 2 hoặc nhiều phiên bản ảnh (ảnh gốc vs ảnh sau nén, ảnh trước vs sau hiệu chỉnh màu).

Mô-đun **ViewSplit** (`#tool/view-split`) được xây dựng với mục tiêu:
1. **Zero-Upload & 0ms Latency**: Xử lý hoàn toàn trong bộ nhớ trình duyệt bằng HTML5 Canvas 2D / OffscreenCanvas. Ảnh không bao giờ truyền qua mạng, bảo vệ quyền riêng tư 100% và không tiêu tốn băng thông/dung lượng máy chủ.
2. **Đa Bố Cục Khung Nhìn (Multi-Pane Layouts)**: Hỗ trợ 7 bố cục linh hoạt (1 ảnh đơn, 2 ảnh ngang/dọc, 3 ảnh ngang/trái/trên, lưới 4 ảnh).
3. **Thanh Trượt Đè Before/After (Slider Wipe)** & **Difference Diff**: Gạt thanh so sánh tức thì hoặc bóc tách bản đồ sai lệch điểm ảnh theo thang nhiệt.
4. **Soi Điểm Ảnh Siêu Phóng Đại (Pixel Inspector HUD Loupe)**: Kính lúp HUD 9x9 pixel hiển thị ranh giới sắc nét từng pixel, tọa độ nguồn `(X, Y)`, giá trị màu RGB và mã HEX 1-click copy.
5. **Đồng Bộ Không Gian Chuẩn Hóa**: Đồng bộ Zoom (1% - 10,000%), Pan, con trỏ và Crosshair xuyên suốt các khung nhìn theo tọa độ chuẩn hóa `[0, 1]`.

---

## 2. Kiến Trúc Lõi Của ViewSplit (Core Architectural Diagram)

```
User Ingestion (Drag-and-Drop, File Picker, Ctrl+V Clipboard, URL / Drive)
                         ↓
Auto-Advance Target Pane State Machine (useViewSplit.js)
  ├── Nhận diện Pane đang chọn (activePaneId)
  ├── Nạp ảnh vào bộ nhớ Client (HTMLImageElement)
  └── Tự động kích hoạt Pane kế tiếp chưa có ảnh (1 → 2 → 3 → 4)
                         ↓
Unified Viewport State Store
  ├── Transform: Zoom Level (0.01x - 100x), Normalized Pan Center (normCenterX, normCenterY)
  ├── Layout Mode: SINGLE | SPLIT_H | SPLIT_V | SLIDER | DIFF | TRIPLE_H | TRIPLE_L | TRIPLE_T | QUAD
  └── Sampling Mode: Nearest Neighbor (Pixelated) vs Bilinear (Smooth)
                         ↓
Canvas 2D Rendering Engine (ViewSplitPane.js & viewSplitCompositor.js)
  ├── Viewport Transformation: ctx.setTransform(scale, 0, 0, scale, transX, transY)
  ├── Slider Wipe Slicing: ctx.drawImage with source clip rects [0..splitX] & [splitX..W]
  ├── Pixel Diff Engine: Per-pixel divergence calculation |R1-R2|, |G1-G2|, |B1-B2| with Multiplier
  └── Synchronized Crosshairs: Canvas overlay rendering red crosshairs at normalized coordinates
                         ↓
Pixel Inspector HUD Loupe (ViewSplitPixelInspector.js)
  ├── Read pixel under cursor from OffscreenCanvas: ctx.getImageData(px - 4, py - 4, 9, 9)
  ├── Render 9x9 magnified grid with crisp border boundaries & center reticle
  └── Format Live Telemetry: X, Y, RGB(r, g, b), HEX (#RRGGBB) + 1-Click Clipboard Copy
```

---

## 3. Các Khối Kỹ Thuật Trọng Tâm (Key Architectural Blocks)

### Khối 1: Không Gian Tọa Độ Chuẩn Hóa [0, 1] Cho Đồng Bộ Pan & Zoom
Khi so sánh các ảnh có độ phân giải khác nhau (ví dụ: ảnh 1 là 4K `3840x2160`, ảnh 2 là 1080p `1920x1080`), nếu pan theo pixel màn hình hoặc pixel ảnh thì vị trí hiển thị giữa các pane sẽ bị lệch hoàn toàn.

**Giải pháp**: Sử dụng không gian tọa độ chuẩn hóa `[0.0, 1.0]`:
- Tọa độ tâm màn hình luôn được biểu diễn là `normCenterX = currentCenterX / imageWidth` và `normCenterY = currentCenterY / imageHeight`.
- Khi người dùng cuộn chuột zoom hoặc kéo pan ở bất kỳ pane nào:
  ```javascript
  // Chuyển đổi tọa độ chuột thành normalized coordinates trong ảnh
  const normX = (cursorX - transX) / (imgWidth * scale);
  const normY = (cursorY - transY) / (imgHeight * scale);
  
  // Áp dụng tâm chuẩn hóa này cho tất cả các pane đang bật đồng bộ:
  panes.forEach(pane => {
    pane.normCenterX = normX;
    pane.normCenterY = normY;
    pane.requestRedraw();
  });
  ```
Nhờ vậy, con trỏ luôn chỉ chính xác vào cùng một chi tiết nội dung (ví dụ: góc mắt của chân dung, logo ở góc phải) bất kể độ phân giải của các ảnh khác nhau.

---

### Khối 2: Thanh Trượt Gạt Đè (Slider Wipe / Overlay Slicing)
Chế độ Slider Wipe cho phép xem trực tiếp sự khác biệt giữa Ảnh A và Ảnh B trên cùng một khung nhìn duy nhất:
1. `splitPos` là giá trị phần trăm `[0.0, 1.0]` tương ứng với vị trí thanh trượt gạt.
2. Vẽ Ảnh B (After) làm nền toàn khung nhìn.
3. Vẽ Ảnh A (Before) với clip-rect giới hạn từ tọa độ `0` đến `splitPos * CanvasWidth`:
   ```javascript
   ctx.save();
   ctx.beginPath();
   ctx.rect(0, 0, canvasWidth * splitPos, canvasHeight);
   ctx.clip();
   // Vẽ Ảnh A theo viewport transform
   ctx.drawImage(imgA, ...);
   ctx.restore();
   ```
4. Vẽ thanh chia ngăn dọc (Divider Bar) sắc nét có viền phát sáng, tay nắm gạt hình viên thuốc (Pill Grip) và nhãn `Ảnh 1 (Gốc)` / `Ảnh 2 (So sánh)`.
5. Hỗ trợ thao tác kéo thả chuột, phím mũi tên trái/phải, và vuốt cảm ứng trên di động.

---

### Khối 3: Kính Lúp Soi Điểm Ảnh Pixel Inspector HUD (9x9 Loupe)
Kính lúp nổi hiển thị thông số chi tiết của điểm ảnh dưới con trỏ chuột:
- **Đọc dữ liệu điểm ảnh**: Sử dụng `getImageData(px - 4, py - 4, 9, 9)` trên canvas bộ nhớ đệm (OffscreenCanvas) để lấy ma trận 81 điểm ảnh xung quanh con trỏ.
- **Vẽ lưới kính lúp 9x9**: Phóng to mỗi pixel thành ô vuông kích thước 12x12 px với viền lưới mờ phân tách.
- **Điểm tâm ngắm (Reticle Center)**: Ô pixel trung tâm (vị trí `4, 4`) được đánh dấu bằng viền đôi tương phản cao (vàng/trắng) để nhận diện pixel chính xác đang xét.
- **HUD Telemetry**:
  - Tọa độ gốc: `X: 1240, Y: 852` (theo hệ tọa độ kích thước thực của tệp ảnh).
  - Kênh màu: `R: 240, G: 128, B: 32`.
  - Mã HEX: `#F08020` kèm ô xem trước màu (Color Swatch).
  - Click vào badge HEX lập tức copy mã màu vào Clipboard với phản hồi rung/toast.

---

### Khối 4: Máy Trạng Thái Tự Động Chuyển Pane Khi Nạp Ảnh (Auto-Advance State Machine)
Khi người dùng thực hiện nạp ảnh (qua kéo thả, file picker, hoặc bấm `Ctrl+V` dán ảnh liên tiếp từ clipboard):
- **Vấn đề trước đây**: Sau khi dán ảnh vào Box 1, ứng dụng bị kẹt ở Box 1; dán tiếp sẽ ghi đè đè lên Box 1 thay vì sang Box 2.
- **Giải pháp**: Máy trạng thái `getNextTargetPaneId(currentPaneId)`:
  1. Xác định số lượng khung nhìn hiển thị của bố cục hiện tại (`visibleCount`).
  2. Quét tìm pane đầu tiên còn trống (`!pane.image`) bắt đầu từ vị trí kế tiếp của pane hiện tại (vòng tròn modulo `visibleCount`).
  3. Nếu tất cả các pane đều đã có ảnh, tự động luân chuyển tuần tự: `nextId = ((currentId - 1 + 1) % visibleCount) + 1`.
  4. Cập nhật `activePaneId = nextId`, đổi viền xanh ngọc (Cyan Ring) nổi bật `ring-2 ring-cyan-500` và badge `ĐANG CHỌN` sang pane mới, sẵn sàng cho cú dán ảnh kế tiếp.

---

## 4. Gotchas & Edge Cases

> [!WARNING]
> **Bộ Lọc Lấy Mẫu (Sampling Filter Blur)**:
> Khi zoom vượt mức 400% (4x), thuật toán Bilinear mặc định của trình duyệt sẽ làm mờ các ranh giới pixel. Bắt buộc phải cung cấp công tắc **Nearest Neighbor** (`ctx.imageSmoothingEnabled = false` và CSS `image-rendering: pixelated`) để các kỹ sư có thể soi ranh giới điểm ảnh sắc bén không bị nhòe nội suy.

> [!NOTE]
> **Hiệu Năng GPU & Rò Rỉ Bộ Nhớ**:
> Khi người dùng đổi ảnh liên tục, các đối tượng `HTMLImageElement` và `OffscreenCanvas` cũ phải được giải phóng bộ nhớ (`img.src = ''`, hủy kích thước canvas) để tránh rò rỉ RAM GPU khi xử lý ảnh độ phân giải cao (> 50-100MP).

---

## 5. Verification
1. **Kiểm thử tự động toán học tọa độ & chuyển pane**:
   ```bash
   cd server && npx vitest run tests/unit/viewsplit.test.ts
   # 44/44 tests passed: layout count, normalized transform, loupe math, auto-advance state machine.
   ```
2. **Kiểm tra cú pháp frontend**:
   ```bash
   node --check src/components/tools/viewsplit/hooks/useViewSplit.js
   node --check src/components/tools/viewsplit/components/ViewSplitPixelInspector.js
   ```

---

## 6. Changelog
- **2026-10-10 (v1.0.0)**: Khởi tạo Knowledge Item chuẩn hóa kiến trúc so sánh ảnh đa khung nhìn ViewSplit, thanh trượt Slider Wipe, và kính lúp Pixel Inspector (@anhduy).
