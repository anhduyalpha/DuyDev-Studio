---
id: KI-CON-001-ui-production-minimalism
title: "Enforce Production-Grade UI Minimalism & Prohibit Marketing Filler Annotations"
type: concept
status: verified
domain: frontend
tags: [frontend, ui-design, minimalism, vercel-style, linear-style, copywriting, anti-filler]
created_at: 2026-09-20
updated_at: 2026-09-23
version: 1.1.0
owner: "@anhduy"
trigger_conditions: "When designing, implementing, modifying, or refactoring UI components, forms, dropzones, action buttons, or preview panels across DuyDev Studio"
search_queries:
  - "Quy chuẩn thiết kế giao diện UI DuyDev Studio"
  - "Không thêm chú thích thừa trên giao diện"
  - "Giao diện chuẩn production tối giản Linear Vercel"
  - "UI filler text prohibited copywriting guidelines"
  - "Làm giao diện giống web production"
related_kis: []
---

# [KI-CON-001] Quy Chuẩn Thiết Kế Giao Diện Tối Giản Chuẩn Production & Cấm Chú Thích Thừa

## 1. Context & Purpose
Tài liệu này quy định tiêu chuẩn thiết kế giao diện người dùng (UI) và quy tắc nội dung (Copywriting) cho toàn bộ hệ sinh thái **DuyDev Studio (DS)**. 

Mục tiêu cốt lõi: Giao diện phải mang phong cách **Production-Grade Developer Utility Hub** (tương tự Linear, Vercel, Raycast, Stripe) — chuyên nghiệp, sắc nét, mật độ thông tin cao, tuyệt đối **không có câu từ quảng cáo, chú thích hướng dẫn thừa, giải thích hiển nhiên hoặc văn phong giới thiệu nghiệp dư**.

---

## 2. Core Principles (Nguyên Tắc Cốt Lõi)

1. **Hiển Nhiên Không Cần Giải Thích (Self-Evident UI)**:
   - Các nút bấm, nhãn trường (labels), định dạng xuất file cần được đặt tên gãy gọn, chính xác (ví dụ: `PNG`, `SVG`, `Word`, `JSON`).
   - Tuyệt đối không thêm mở ngoặc giải thích hiển nhiên kiểu người dùng mới (ví dụ: cấm `PNG (Ảnh số)`, `SVG (Vector in ấn)`).

2. **Cấm Tiếp Thị & Dẫn Dắt Tính Năng (Zero Marketing Fluff)**:
   - Đây là công cụ tiện ích cá nhân / nội bộ (Utility Hub), không phải landing page bán hàng.
   - Cấm các câu chào mời, hứa hẹn tiện ích như: *"Sẵn sàng in ấn, chia sẻ qua Zalo, Messenger, AirDrop"*, *"Chất lượng siêu nét"*, *"Giải mã tức thì trên máy bạn"*.

3. **Mật Độ Cao & Tinh Gọn (High Information Density)**:
   - Tiêu đề thẻ xem trước chỉ cần tên thành phần và badge định dạng gọn gàng (`XEM TRƯỚC MÃ QR` • `PNG`), không kèm các khẩu hiệu như `PNG • Độ nét cao`.
   - Dropzone chỉ cần hướng dẫn cốt lõi: *"Kéo thả hoặc tải ảnh lên"*, kèm danh sách đuôi file ngắn gọn.

---

## 3. Anti-Patterns (Những Gì TUYỆT ĐỐI KHÔNG Được Làm)

| Thành Phần UI | ❌ Anti-Pattern Bị Cấm (Filler/Thừa Thãi) | ✅ Chuẩn Production Được Phép |
| :--- | :--- | :--- |
| **Radio định dạng** | `PNG (Ảnh số)` / `SVG (Vector in ấn)` | `PNG` / `SVG` |
| **Radio Word / Docx** | `Word (.docx - Soạn thảo văn bản)` | `Word (.docx)` |
| **Header xem trước** | `Xem Trước Mã QR (PNG • Độ nét cao)` | `Xem Trước Mã QR` kèm badge `PNG` |
| **Dưới nút Tải về** | `Sẵn sàng in ấn, chia sẻ qua Zalo, Messenger, AirDrop` | **Xoá bỏ hoàn toàn**, không để dòng chữ phụ nào |
| **Option Bảo mật Wi-Fi** | `WPA / WPA2 / WPA3 (Phổ biến)` / `Open (Không mật khẩu)` | `WPA / WPA2 / WPA3` / `Không mật khẩu` |
| **Dropzone tải tệp** | `Hỗ trợ ảnh chụp màn hình, ảnh chụp điện thoại (.png, .jpg, .webp) - Giải mã tức thì trực tiếp trên thiết bị của bạn` | `Kéo thả hoặc tải tệp ảnh lên` (Hỗ trợ PNG, JPG, WEBP) |
| **Thông báo kết quả** | `Ảnh 'abc.png' (120 KB) đã tải lên. Hãy đảm bảo ảnh rõ nét...` | Hiển thị thẳng kết quả giải mã thực tế |

| **Tiêu đề panel cấu hình** | `Cấu hình xử lý` | `Cấu hình` |
| **Nút bấm thực thi** | `Bắt đầu xử lý` | `Bắt đầu` |
| **Nhãn tab module** | `Đọc & Xem` (tên ghép dài dòng) | `Xem PDF` (ngắn gọn, đúng hành động) |
| **Panel cấu hình của tab xem** | Khung xám rỗng chứa text giải thích: `Trình đọc PDF Canvas với cuộn dọc, mục lục và chế độ đêm.` | Hiển thị thẻ metadata tệp thực tế (Tên, dung lượng, trạng thái) & danh sách tệp xem gần đây |

---

## 4. Implementation Guidelines (Hướng Dẫn Triển Khai)

### 4.1. Nút Thao Tác & Hành Động
- Sử dụng động từ dứt khoát + Danh từ trực tiếp:
  - `Bắt đầu`, `Tạo Mã QR`, `Tải Mã Về Máy`, `Sao Chép`, `Quét Mã`, `Xem ngay`.
  - Icon Lucide đi kèm kích thước chuẩn `w-4 h-4` (hoặc `w-3.5 h-3.5`).
- Tránh thêm từ đệm "xử lý" không cần thiết (`Cấu hình` thay vì `Cấu hình xử lý`, `Bắt đầu` thay vì `Bắt đầu xử lý`).
- Tránh thêm văn bản giải thích dưới các nút chính.

### 4.2. Khung Xem Trước & Thông Tin Tệp (Preview & File Info)
- Header: Text nhỏ `text-xs font-medium text-zinc-500` và một badge đơn giản:
  ```html
  <div class="flex items-center justify-between text-xs text-zinc-500 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
    <span class="font-medium">Xem Trước Mã QR</span>
    <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 font-semibold">${format.toUpperCase()}</span>
  </div>
  ```
- Với các tab chỉ có chức năng xem (như Xem PDF):
  - Kéo thả tệp vào phải kích hoạt mở popup xem trực tiếp ngay lập tức.
  - Panel bên cạnh không để text mô tả tính năng mà hiển thị thông số kỹ thuật tệp (kích thước, định dạng, trạng thái) kèm danh sách tệp gần đây để mở lại 1 chạm.

### 4.3. Trường Nhập Liệu & Danh Sách Chọn (Form Controls)
- Luôn sử dụng nền khối cứng chuẩn Dark Mode: `bg-white dark:bg-[#18181B]` và viền `border-zinc-200 dark:border-zinc-700/60`.
- Label chỉ nêu tên trường: `Số Tài Khoản`, `Số Tiền (VND)`, `Nội Dung Chuyển Tiền`, `Mật Khẩu`.
- Placeholder chỉ đưa ví dụ định dạng: `Ví dụ: 100000`, `example@email.com`.

---

## 5. Verification Checklist (Kiểm Tra Trước Khi Merge/Commit)

Trước khi commit bất kỳ thay đổi nào liên quan đến UI:
- [ ] Đã quét toàn bộ file giao diện xem còn xuất hiện các cụm từ giải thích thừa như `(Ảnh số)`, `(Vector in ấn)`, `(Phổ biến)` hay không.
- [ ] Không có bất kỳ đoạn văn bản PR, marketing, giới thiệu tính năng nào dưới các nút bấm hoặc trong khung preview.
- [ ] Các tiêu đề khối và nút bấm đã được tinh giản tối đa (`Cấu hình`, `Bắt đầu`).
- [ ] Các radio button và select box chỉ chứa định dạng và chuẩn kỹ thuật ngắn gọn.
- [ ] Màu sắc và độ tương phản tuân thủ Dark Minimalism (`#18181B` cho surface elevated, `#FAFAFA` cho text).

---

## 6. Changelog
- **2026-09-23 (v1.1.0)**: Bổ sung chuẩn hóa danh xưng nút hành động ('Cấu hình', 'Bắt đầu', 'Xem PDF') và cấm khung mô tả rỗng trong các tab xem tài liệu theo phản hồi của @anhduy.
- **2026-09-20 (v1.0.0)**: Khởi tạo quy chuẩn thiết kế tối giản chuẩn Production theo yêu cầu của @anhduy sau khi rà soát và làm sạch module QR Studio.
