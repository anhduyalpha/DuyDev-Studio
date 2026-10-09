# Báo Cáo Kỹ Thuật: Audit Giao Diện & Phương Án Khắc Phục Trùng Màu Nền (DuyDev Studio)

> **Mục tiêu**: Đánh giá toàn diện nguyên nhân khiến các thẻ công cụ và khu vực tác vụ bị hòa lẫn vào màu nền (Canvas Bleed-through), chấm điểm kỹ thuật theo tiêu chuẩn Impeccable (5 chiều kích), và xây dựng 3 phương án sửa chữa khả thi.

---

## 1. Audit Health Score

| # | Chiều kích (Dimension) | Điểm (0-4) | Vấn đề trọng tâm |
|---|------------------------|------------|------------------|
| 1 | **Accessibility (A11y)** | **2/4** | Độ tương phản ranh giới thẻ (Non-text Contrast WCAG 1.4.11) < 1.2:1 trên nền gradient; thẻ màu tím/xanh ngọc bị ngụy trang hoàn toàn vào ánh sáng nền. |
| 2 | **Performance** | **2/4** | Hơn 30 bề mặt cùng tính toán `backdrop-filter: blur(28px)` chồng lên 5 lớp radial gradient lớn (950px) gây hao tổn GPU fill-rate. |
| 3 | **Theming** | **2/4** | Thẻ công cụ bỏ qua token `--surface-base` (#131317) và `--surface-elevated` (#1A1A20), lạm dụng RGBA có độ trong suốt quá cao (0.02 - 0.65). |
| 4 | **Responsive Design** | **3/4** | Lưới thẻ co giãn tốt, cuộn ngang bộ lọc mượt mà; một số nút thao tác nhanh ở Tác vụ gần đây có kích thước ~38px (dưới chuẩn chạm 44px). |
| 5 | **Implementation Integrity** | **2/4** | Hiện tượng "Double-Ghost" ở Tác vụ gần đây (hộp kính trong suốt lồng trong hộp kính trong suốt); màu accent xung đột với nền. |
| **Tổng** | | **11/20** | **Acceptable (Cần cải tổ độ tương phản bề mặt)** |

---

## 2. Phân Tích Cội Rễ Kỹ Thuật (Root Causes)

Dựa trên hình ảnh chụp màn hình thực tế và kiểm tra mã nguồn:

1. **Hiệu ứng Kính Quá Trong Suốt (Over-translucent Glass)**:
   - Trong `src/styles/stitch-tokens.css` (dòng 470–483), `html.dark .linear-card` có gradient chạy từ `rgba(255, 255, 255, 0.075)` đến `rgba(255, 255, 255, 0.02)` ở giữa, và đáy là `rgba(18, 20, 32, 0.65)`.
   - Vì không có lớp đế màu đục (Opaque Grounding), hơn 80% diện tích thẻ là kính mỏng cho phép toàn bộ màu nền phía sau xuyên thẳng qua, triệt tiêu cảm giác khối hộp nổi (Elevation).

2. **Ánh Sáng Nền Radial Quá Rực Và Chiếm Toàn Bộ Màn Hình (Aggressive Background Mesh)**:
   - Trong `src/styles/stitch-tokens.css` (dòng 438–446), `body::before` kích hoạt 5 đốm sáng cực lớn:
     - Góc trái trên: `circle 950px` màu tím `#6366F1` với opacity 0.38.
     - Góc phải trên: `circle 880px` màu xanh ngọc `#10B981` với opacity 0.28.
     - Giữa và đáy: các đốm 800px–850px màu xanh dương `#0EA5E9` và chàm.
   - Các đốm sáng này nằm ngay sau lưới công cụ, làm cho:
     - Thẻ **Tạo Bài Tập Trắc Nghiệm** (màu tím `#8B5CF6`) nằm đè lên nền tím $\rightarrow$ Biến mất hoàn toàn.
     - Thẻ **Soi Tệp Nén & Nén ZIP** (màu xanh `#0EA5E9`) và **Mã QR** (màu lục `#10B981`) nằm đè lên nền xanh/lục $\rightarrow$ Hòa tan hoàn toàn.
     - Thẻ **PDF Studio** (màu cam `#F59E0B`) nằm đè lên nền tím $\rightarrow$ Bị lem màu và tương phản lệch pha nhức mắt.

3. **Cái Bẫy Lồng Kính Kép (Double-Ghost Trap) ở Tác Vụ Gần Đây**:
   - Vỏ ngoài dùng `.glass-panel-contained` (`rgba(12, 14, 22, 0.65)`).
   - 3 thẻ bên trong lại dùng `.glass-pill` (`rgba(255, 255, 255, 0.05)`).
   - Hai lớp kính trong suốt lồng nhau trên nền tối tạo ra độ chênh lệch màu gần như bằng 0 (delta luminance < 1.08:1), khiến người dùng chỉ nhìn thấy chữ lơ lửng, không nhận diện được đâu là ranh giới thẻ.

---

## 3. Ba Phương Án Sửa Chữa (Solution Candidates)

### 🥇 Phương Án 1: Apple Sequoia Grounded Frost Glass (Khuyên dùng - Đạt chuẩn Apple)
- **Cơ chế**: Giữ nguyên vẻ sang trọng của kính mờ Apple nhưng bổ sung **Lớp Đế Tối Vững Chãi (Opaque Foundation)**:
  - Nâng độ đục của thân thẻ `.linear-card` lên 90%–94% bằng tone màu tối sâu Apple:  
    `linear-gradient(165deg, rgba(24, 27, 38, 0.92) 0%, rgba(15, 17, 25, 0.96) 100%)`.
  - Giữ nguyên viền phản quang Specular Rim siêu nét: `inset 0 1px 0 0 rgba(255, 255, 255, 0.20)` và viền kính ngoài `1px solid rgba(255, 255, 255, 0.13)`.
  - Tinh chỉnh `body::before`: Hạ opacity đốm sáng nền từ `0.38` xuống `0.12–0.15`, thu hẹp bán kính và đẩy ra viền mép (Vignette Glow), tạo chiều sâu không gian huyền ảo mà không xâm lấn nội dung.
  - Tách lớp Tác vụ gần đây: Vỏ ngoài dùng nền tối vững (`rgba(16, 18, 26, 0.88)`), các thẻ con bên trong dùng nền elevated `#1A1D2A` với viền rõ ràng.

### 🥈 Phương Án 2: Linear/Raycast Studio Utility (Tối giản Đậm Chất Dev Hub)
- **Cơ chế**: Tách biệt dứt khoát theo chuẩn Linear/Vercel:
  - Thẻ công cụ chuyển sang nền tối đặc chuẩn token `--surface-base` (`#121318` kết hợp lớp phủ vi mô `rgba(255,255,255,0.03)`).
  - Background hoàn toàn là Dark Canvas nguyên bản `#09090B` kết hợp họa tiết chấm kỹ thuật số (Subtle Dot Matrix), loại bỏ toàn bộ radial gradient màu rực.
  - Điểm nhấn màu sắc chỉ tập trung sắc bén tại icon, badge và Top Accent Beam.
  - Đạt hiệu năng cuộn 60fps mượt mà tuyệt đối trên mọi cấu hình.

### 🥉 Phương Án 3: Adaptive Tinted Glass Matrix (Kính Nhuộm Màu Theo Nhóm)
- **Cơ chế**: Mỗi thẻ công cụ được phủ một lớp kính nhuộm nhẹ theo chính màu đại diện (accent) của nó:
  - Nền thẻ dùng `color-mix(in srgb, var(--accent) 7%, #12141E 93%)` với độ đục 92%.
  - Nền background chuyển về tone tối trung tính không màu (Neutral Dark Slate).
  - Nhóm PDF ánh hổ phách, nhóm Chuyển đổi ánh tím, nhóm File nén ánh xanh dương, nhóm QR ánh ngọc lục bảo.
