# Original User Request

## 2026-09-24T15:48:53Z

# Teamwork Project: Purge AI UI Annotations & Enforce Production Minimalism

Requested team: 3 subagents (Subagent A: Tools Specialist, Subagent B: Pages & Shell Specialist, Subagent C: QA & Layout Hygiene)

Toàn diện loại bỏ toàn bộ chú thích AI ("AI-ified" UI), văn bản tiếp thị thừa và mở ngoặc giải thích hiển nhiên trên toàn bộ giao diện web (`src/`), đưa UI về chuẩn Production Minimalism (Linear/Vercel utility aesthetic) theo `.agents/rules/ui-standards.md` và `docs/knowledge-base/KI-CON-001-ui-production-minimalism.md`.

Working directory: `c:\Users\AnhDuy\Code\Project\DD Studio`
Integrity mode: `development`

## Requirements

### R1. Tools Modules UI Purging (Tools Specialist)
Rà soát toàn bộ các công cụ trong `src/components/tools/{qr, pdf, archive, converter, hash, image}/`. Cắt bỏ triệt để mọi mở ngoặc giải thích tại radio/select/badge (`(Ảnh số)`, `(Vector in ấn)`, `(Phổ biến)`, `(Mặc định)`), xóa bỏ câu giải thích thừa thãi dưới nút bấm và preview panel (`"Sẵn sàng in ấn qua Zalo..."`, `"Độ nét cao"`), và rút gọn các dropzone tải tệp về định dạng kỹ thuật 1 dòng ngắn gọn.

### R2. Pages & Shell UI Purging (Pages & Shell Specialist)
Rà soát toàn bộ layout và trang chung trong `src/components/layout/`, `src/components/dashboard/`, `src/components/common/`, và `src/pages/`. Xóa bỏ văn bản mang tính hướng dẫn hiển nhiên, mô tả dài dòng ở thẻ công cụ, đưa placeholder và label về chuẩn ngắn gọn, đanh thép, mang phong cách utility hub.

### R3. QA, Layout Hygiene & Verification (QA Specialist)
Dọn dẹp khoảng trắng, margin mồ côi (`mt-1.5`, `space-y-2`) sinh ra do các thẻ text bị xóa bỏ. Bảo toàn 100% các thuộc tính trợ năng (`aria-label`), chức năng form, phím tắt và tính đồng bộ Dark Canvas (`#0B0F17`). Thực thi kiểm tra tự động qua script chẩn đoán `scan_ui_fluff.py` và kiểm tra tĩnh.

## Verification Resources
- Script chẩn đoán fluff: `python C:\Users\AnhDuy\.gemini\config\skills\ui-annotation-purger\scripts\scan_ui_fluff.py "c:\Users\AnhDuy\Code\Project\DD Studio\src"`
- Bộ quy chuẩn: `.agents/rules/ui-standards.md`
- Knowledge Item: `docs/knowledge-base/KI-CON-001-ui-production-minimalism.md`

## Acceptance Criteria

### Content & Copy Standards
- [ ] 0 trường hợp mở ngoặc giải thích hiển nhiên kiểu `(Ảnh số)`, `(Vector)`, `(Phổ biến)`, `(Mặc định)` còn tồn tại trong `src/`.
- [ ] 0 câu tiếp thị/PR/hướng dẫn thừa thãi dưới nút bấm (`"Sẵn sàng in ấn..."`, `"Giải mã tức thì..."`).
- [ ] Toàn bộ dropzone hiển thị 1 dòng ngắn gọn (`"Kéo thả hoặc tải tệp lên"`) kèm danh sách đuôi file kỹ thuật.
- [ ] Toàn bộ placeholder và label ngắn gọn, trực diện, không mang tính trò chuyện bot AI.

### Layout & Functional Hygiene
- [ ] Không có khoảng trống bất thường hoặc margin mồ côi (`mt-2`, `space-y-*`) sau khi xóa text.
- [ ] Giữ nguyên 100% các thuộc tính `aria-label`, `title`, sự kiện bấm, và cấu trúc DOM chức năng.
- [ ] Theme Dark Canvas (`#0B0F17`) và Vercel/Linear dark minimalism đồng bộ trên mọi màn hình.
- [ ] Script chẩn đoán `scan_ui_fluff.py` quét toàn bộ `src/` đạt kết quả 0 lỗi (clean exit code 0).

## 2026-09-24T17:47:04Z

Rà soát toàn diện, chuẩn hóa logic xử lý và tối ưu hóa vượt bậc trải nghiệm giao diện người dùng (UI/UX) cho toàn bộ 9 công cụ trong module PDF Studio Pro (Ghép PDF, Tách trang, Xoay trang, Ảnh sang PDF, Nén PDF, Trích ảnh, Xem PDF, Watermark, Bảo mật) đạt tiêu chuẩn công cụ PDF chuyên nghiệp hàng đầu (production-grade như iLovePDF/Smallpdf/Linear).

Working directory: `c:\Users\AnhDuy\Code\Project\DD Studio`
Integrity mode: demo

## Requirements

### R1. Chuẩn hóa bộ lọc tệp đầu vào & Validation độc lập cho từng công cụ
- Mỗi công cụ trong 9 công cụ phải có bộ lọc định dạng tệp (MIME type & extension) nghiêm ngặt trước khi nhận:
  - **Ghép PDF, Tách trang, Xoay trang, Nén PDF, Trích ảnh, Xem PDF, Watermark, Bảo mật**: Chỉ chấp nhận tệp `.pdf` (`application/pdf`). Khi người dùng kéo thả hoặc chọn tệp lạ (ảnh, nén, word...), lập tức chặn lại và hiển thị toast cảnh báo rõ ràng.
  - **Ảnh sang PDF**: Chỉ chấp nhận các định dạng ảnh hợp lệ (`.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`, `.tiff`), từ chối tệp không phải ảnh.
- Khóa cứng giới hạn số lượng tệp theo đặc thù công cụ:
  - Ghép PDF, Ảnh sang PDF: Hỗ trợ nhiều tệp (multi-file), cho phép kéo thả hoặc nhấn nút để đổi thứ tự trang/tệp.
  - Tách trang, Xoay trang, Nén PDF, Trích ảnh, Xem PDF, Watermark, Bảo mật: Chế độ đơn tệp (single-file), tự động thay thế tệp cũ khi chọn tệp mới.

### R2. Tinh chỉnh Logic xử lý chuyên biệt cho từng công cụ (9 Tools Standard)
1. **Ghép PDF (Merge)**:
   - Cho phép sắp xếp thứ tự danh sách tệp trực quan (kéo thả hoặc nút mũi tên Lên/Xuống).
   - Hiển thị tổng số tệp và dung lượng ước tính. Ghép đúng 100% thứ tự tệp đầu vào.
2. **Tách trang (Split)**:
   - Hiển thị lưới thumbnail phân trang thông minh (8 trang/trang xem, 4 hàng trên 4 hàng dưới), có nút icon con mắt phóng to toàn màn hình (Lightbox).
   - Hỗ trợ chọn nhanh từng trang hoặc nhập dải trang (`1-3, 5, 8-10`). Bắt lỗi nếu nhập trang vượt quá tổng số trang.
   - Tách tệp chính xác, không làm giảm độ phân giải vector của trang.
3. **Xoay trang (Rotate)**:
   - Hiển thị lưới trang với góc xoay trực quan. Cho phép xoay từng trang riêng lẻ ($90^\circ, 180^\circ, 270^\circ$) và nút "Xoay tất cả".
   - Áp dụng góc xoay chuẩn vào thuộc tính trang (`/Rotate`), không re-render làm mờ chữ.
4. **Ảnh sang PDF (Images to PDF)**:
   - Tự động căn chỉnh ảnh vừa khổ giấy chuẩn A4 portrait (595x842 pt), giữ nguyên tỷ lệ khung hình (aspect ratio), căn giữa trang và nén stream ảnh tối ưu.
5. **Nén PDF (Compress)**:
   - 3 cấp độ rõ ràng: Nén cao (high), Cân bằng (medium), Nén nhẹ (low).
   - Cơ chế bảo vệ: Nếu tệp đã tối ưu sẵn mà việc nén làm tăng kích thước, tự động giữ nguyên tệp gốc.
   - Thẻ kết quả hiển thị minh bạch dung lượng trước/sau và tỷ lệ phần trăm tiết kiệm được.
6. **Trích ảnh (Extract Images)**:
   - Trích xuất toàn bộ ảnh gốc nhúng trong PDF mà không làm mất chất lượng nén, đóng gói thành tệp `.zip` hoàn chỉnh với tên ảnh đánh số thứ tự (`image_001.png`, `image_002.jpg`...).
7. **Xem PDF (View)**:
   - Trình xem PDF nội tuyến mượt mà, đầy đủ thanh công cụ: chuyển trang (Trang trước/sau, ô nhập số trang), Thu phóng (Zoom In/Out/Fit Width), Toàn màn hình.
   - Nạp đầy đủ phông chữ chuẩn (`standardFontDataUrl`) và bản đồ ký tự (`cMapUrl`) để không bị lỗi ký tự toán học, font hiếm.
8. **Watermark (Đóng dấu)**:
   - Cho phép nhập nội dung chữ đóng dấu, chọn vị trí (Chéo giữa trang, Đầu trang, Chân trang), độ mờ (Opacity) và tùy chọn đánh số trang tự động (`Trang X / N`).
9. **Bảo mật (Security)**:
   - Đặt mật khẩu (Lock): Mã hóa PDF bằng chuẩn mã hóa an toàn AES-128/AES-256.
   - Gỡ mật khẩu (Unlock): Yêu cầu nhập mật khẩu hiện tại, giải mã và lưu lại bản PDF không khóa.

### R3. Tối ưu hóa UI/UX & Flow Thao tác Chuẩn Production (Production-Grade Ergonomics)
- **Flow 4 bước mạch lạc, trực quan**:
  1. *Bước 1: Nạp tệp* — Kéo thả hoặc bấm chọn tệp với phản hồi kéo thả đổi màu viền tức thì, hiển thị ngay thẻ thông tin tệp (Tên tệp, Dung lượng, Tổng số trang, Nút đổi tệp khác nhanh mà không cần F5).
  2. *Bước 2: Cấu hình trực quan* — Tùy chọn hiển thị tập trung tại thanh điều khiển bên cạnh; mọi thay đổi (xoay trang, chọn trang tách) cập nhật tức thì trên giao diện (WYSIWYG).
  3. *Bước 3: Thực thi rõ ràng* — Nút bấm hành động chính (Primary Action Button) ghi rõ hành động (ví dụ: `Ghép 3 tệp PDF`, `Tách 4 trang đã chọn`, `Nén PDF (Cân bằng)`), trạng thái disable rõ ràng khi chưa đủ điều kiện.
  4. *Bước 4: Thẻ kết quả đa năng* — Tải về tức thì, sao chép liên kết, mở xem trước trực tiếp (Preview), và nút nối tiếp thao tác ("Chuyển tiếp tệp này sang công cụ khác").
- **Tương tác công thái học (Ergonomic Micro-interactions)**:
  - Phím tắt tiện ích: Nhấn phím mũi tên `←` / `→` để lật trang trong Lightbox xem to, phím `Esc` để đóng modal tức thì.
  - Phản hồi trạng thái tức thời (Zero Blind Spot): Luôn hiển thị huy hiệu (Badge) số lượng trang đã chọn, góc xoay tích lũy, mức độ nén hiện tại.
  - Hỗ trợ hoàn hảo cả màn hình cảm ứng di động và chuột máy tính: Kích thước vùng bấm (touch target) tối thiểu 40px, bố cục responsive không bị tràn màn hình.

### R4. Đồng bộ Trạng thái, Thanh tiến trình & Chống Race Condition (Rule 1 & Rule 3)
- **Thanh tiến trình tức thì**: Khi bấm "Bắt đầu xử lý", thanh tiến trình phải hiển thị ngay tại tab hiện tại kèm nhãn giai đoạn thực tế (0% -> 100%), không yêu cầu chuyển tab.
- **Khóa chuyển tab khi đang xử lý**: Khi `isProcessing === true`, vô hiệu hóa các nút chuyển tab chế độ để chống race condition và đơ giao diện.
- **Dọn dẹp tài nguyên**: Thu hồi toàn bộ `URL.revokeObjectURL()`, đóng `EventSource` và hủy bỏ các tiến trình ngầm khi chuyển trang hoặc hủy tác vụ.
- **UI Production Minimalism**: Tuân thủ nghiêm ngặt tiêu chuẩn Vercel/Linear tối giản: xóa sạch văn bản marketing/tutorial rườm rà dưới các nút/thẻ, sử dụng typography Geist / JetBrains Mono sắc nét và độ tương phản cao.

### R5. Chuẩn hóa Backend Fastify, BullMQ Worker & Python PyMuPDF Engine
- Rà soát `server/src/workers/pdf.worker.ts`, `server/src/api/controllers/pdf.controller.ts`, và `engines/document/pdf_engine.py`:
  - Đảm bảo tất cả 9 hoạt động (`compress`, `merge`, `split`, `rotate`, `images_to_pdf`, `extract_images`, `watermark`, `lock`, `unlock`) đều có endpoint API, schema validation Zod, và logic worker xử lý hoàn chỉnh.
  - Sử dụng SHA-256 stream `StorageManager.computeSha256` khi lưu tệp thành phẩm để không gây OOM.
  - Xử lý ngoại lệ file hỏng (`FileCorruptedError`) với mã lỗi HTTP rõ ràng, không để worker bị crash.

## Acceptance Criteria

### Tính toàn vẹn cú pháp & Hệ thống
- [ ] `cd server && npx tsc --noEmit` đạt chính xác **0 lỗi TypeScript**.
- [ ] `cd server && npx vitest run` vượt qua **100% test suites** (bao gồm `tests/unit/pdf.test.ts` và toàn bộ các bộ test tích hợp).
- [ ] Cú pháp toàn bộ file JavaScript trong `src/components/tools/pdf/` đạt 100% chuẩn hợp lệ (`node --check`).
- [ ] Không có file nào vi phạm cấu trúc đơn nhiệm (Single Responsibility), kích thước file tự nhiên dưới 250 dòng (hoặc gắn kết cao, không có "god file").

### Chuẩn hóa UI/UX & Flow thao tác
- [ ] Flow 4 bước (Nạp tệp -> Cấu hình -> Thực thi -> Tải về/Chuyển tiếp) hoạt động mượt mà, trực quan, không cần hướng dẫn phụ.
- [ ] Nút hành động chính hiển thị nhãn động theo ngữ cảnh (ví dụ: `Ghép 3 tệp PDF`, `Tách 5 trang`), tự động vô hiệu hóa nếu dữ liệu đầu vào chưa hợp lệ.
- [ ] Có nút "Đổi tệp khác" hoặc "Xóa tệp" tiện lợi ngay tại vùng làm việc mà không cần tải lại trang.
- [ ] Hỗ trợ phím tắt `Esc` đóng lightbox, mũi tên `←` / `→` chuyển trang lightbox khi xem chi tiết.
- [ ] Giao diện co giãn chuẩn trên cả Desktop và Mobile (Responsive), không bị vỡ layout hay che khuất nút thao tác.

### Kiểm thử chức năng 9 công cụ PDF
- [ ] Ghép PDF: Nối 2+ tệp PDF thành 1 tệp duy nhất đúng thứ tự chỉ định, mở đọc bình thường.
- [ ] Tách trang: Tách chính xác các trang đã chọn từ thumbnail/input dải trang, không thiếu trang.
- [ ] Xoay trang: Xoay trang đơn lẻ hoặc toàn bộ file theo góc $90^\circ, 180^\circ, 270^\circ$, mở xem hiển thị đúng hướng.
- [ ] Ảnh sang PDF: Chuyển đổi mảng ảnh JPG/PNG/WebP thành tệp PDF chuẩn A4 căn giữa, không méo hình.
- [ ] Nén PDF: Nén thành công với các mức độ, hiển thị đúng tỷ lệ tiết kiệm dung lượng, không làm hỏng layout.
- [ ] Trích ảnh: Xuất tệp ZIP chứa đầy đủ tất cả ảnh nhúng trong tài liệu PDF.
- [ ] Xem PDF: Hiển thị đầy đủ chữ và ký tự đặc biệt, phóng to/thu nhỏ và nhảy trang hoạt động mượt mà.
- [ ] Watermark: Chèn chữ chìm hoặc số trang lên tài liệu với độ mờ và vị trí chuẩn xác.
- [ ] Bảo mật: Khóa mật khẩu thành công (mở PDF yêu cầu nhập pass) và gỡ mật khẩu thành công.
- [ ] Bộ lọc tệp lạ: Kéo thả file lạ (.exe, .zip, .docx) vào các tab yêu cầu PDF bị từ chối kèm thông báo lỗi rõ ràng.

### Triển khai & Kiểm tra thực tế
- [ ] Đồng bộ toàn bộ mã nguồn đã hoàn thiện lên homeserver `192.168.2.171`.
- [ ] Dịch vụ `dd-studio.service` khởi động lại trơn tru và phản hồi `status: UP` tại `/api/v1/health`.
- [ ] Giao diện Web PWA hoạt động mượt mà, thanh tiến trình hiển thị tức thì, không bị đơ giật.

## 2026-09-27T12:14:56Z

Hoàn thiện toàn diện module PDF Studio Pro cho DD Studio, giải quyết triệt để lỗi hiển thị thumbnail và cử chỉ cảm ứng, đồng thời nâng cấp toàn bộ 9 công cụ PDF đạt chuẩn công cụ chuyên nghiệp cao cấp hàng đầu (Linear/iLovePDF standard).

Working directory: `c:\Users\AnhDuy\Code\Project\DD Studio`
Integrity mode: demo

## Requirements

### R1. Khắc phục triệt để hiện tượng đen màn hình và xoay spinner vô tận ở Panel Thumbnail 8 trang
- Khi người dùng bấm "Bắt đầu xử lý" hoặc khi tiến trình xử lý đang diễn ra trong các công cụ có chế độ trực quan (Tách trang, Xoay trang), lưới 8 thumbnail trang phải giữ nguyên hiển thị liên tục (continuous canvas display), không bị chớp đen, không bị reset canvas và không quay vòng spinner vô hạn.
- Cơ chế lưu đệm trang (Page Cache) phải đảm bảo khôi phục tức thời hình ảnh trang đã kết xuất từ bộ nhớ đệm bitmap khi chuyển trang hoặc cập nhật trạng thái tác vụ.

### R2. Cử chỉ vuốt để xóa tất cả (Swipe-to-Clear) và Tương tác Cảm ứng Công thái học
- Trang bị cử chỉ vuốt nhạy bén (Swipe gesture) hỗ trợ cả màn hình cảm ứng di động (Touch events) lẫn chuột máy tính (Mouse/Pointer drag) trên thanh công cụ/danh sách tệp để xóa toàn bộ hàng đợi hoặc tệp đang chọn nhanh chóng, kèm animation trượt mượt mà và phản hồi rung nhẹ (Haptic feedback nếu có).
- Hỗ trợ đầy đủ phím tắt tiện ích trong Lightbox xem to trang PDF (`Esc` để đóng, `←` / `→` để lật trang liền mạch) và kéo thả đổi thứ tự tệp/trang không giật lag.

### R3. Chuẩn hóa & Nâng cấp Trải nghiệm Cao cấp Toàn diện 9 Công cụ PDF
- Rà soát và hoàn thiện trải nghiệm nhất quán cho cả 9 công cụ PDF:
  1. **Ghép PDF (Merge)**: Sắp xếp thứ tự trực quan, hiển thị tổng dung lượng và số lượng tệp tức thời.
  2. **Tách trang (Split)**: Phân trang lưới 8 thumbnail 4x2 mượt mà, chọn nhanh tất cả / chẵn / lẻ, nhập dải trang linh hoạt và lightbox xem to trang đơn.
  3. **Xoay trang (Rotate)**: Xoay trực quan từng trang ($90^\circ, 180^\circ, 270^\circ$) hoặc xoay đồng loạt, giữ nguyên góc xoay tích lũy.
  4. **Ảnh sang PDF (Images to PDF)**: Căn chỉnh vừa khổ giấy A4 chuẩn (595x842 pt), giữ nguyên tỷ lệ khung hình và tối ưu dung lượng.
  5. **Nén PDF (Compress)**: 3 mức nén minh bạch, thẻ kết quả hiển thị trực quan dung lượng trước/sau và tỷ lệ phần trăm tiết kiệm.
  6. **Trích ảnh (Extract Images)**: Trích xuất toàn bộ ảnh gốc không giảm chất lượng, đóng gói tệp ZIP hoàn chỉnh với tên đánh số thứ tự.
  7. **Xem PDF (View)**: Trình xem tài liệu PDF nội tuyến mượt mà, đầy đủ công cụ chuyển trang, thu phóng và toàn màn hình.
  8. **Watermark (Đóng dấu)**: Đóng dấu chữ hoặc đánh số trang tùy biến vị trí và độ mờ.
  9. **Bảo mật (Security)**: Đặt mật khẩu mã hóa AES và giải mã mật khẩu nhanh chóng.

### R4. Flow Thao tác Tối giản & Ngăn chặn Race Condition (Production Minimalism)
- Tuân thủ nghiêm ngặt tiêu chuẩn Vercel/Linear: xóa sạch văn bản marketing/tutorial rườm rà dưới các nút/thẻ, sử dụng typography Geist / JetBrains Mono sắc nét và độ tương phản cao.
- Khóa chuyển tab và vô hiệu hóa nút hành động khi đang xử lý tác vụ (`isProcessing === true`) để chống race condition và đơ giao diện.
- Thu hồi triệt để tài nguyên (`URL.revokeObjectURL`, hủy AbortController, dọn dẹp canvas bitmap) khi rời trang hoặc thay đổi tệp.

## Acceptance Criteria

### Tính toàn vẹn cú pháp & Hệ thống
- [ ] `cd server && npx tsc --noEmit` đạt chính xác **0 lỗi TypeScript**.
- [ ] `cd server && npx vitest run` vượt qua **100% test suites** (bao gồm `pdf.test.ts` và toàn bộ các bộ test tích hợp).
- [ ] Cú pháp toàn bộ file JavaScript trong `src/components/tools/pdf/` đạt 100% chuẩn hợp lệ (`node --check`).
- [ ] Không có file nào vi phạm cấu trúc đơn nhiệm (Single Responsibility), kiến trúc Zero-Build Native ES Modules được bảo toàn nguyên vẹn.

### Kiểm thử Giao diện & Trải nghiệm Người dùng
- [ ] Khi chọn file PDF ở chế độ Tách trang hoặc Xoay trang và nhấn "Bắt đầu xử lý", lưới 8 thumbnail trang hiển thị liên tục, **tuyệt đối không bị chuyển sang màu đen hoặc quay vòng spinner**.
- [ ] Thao tác vuốt ngang (Swipe left/right) trên danh sách tệp hoặc thanh quản lý tệp trên thiết bị di động/chuột thực hiện xóa hàng đợi thành công với hiệu ứng trượt mượt mà.
- [ ] Khi xem Lightbox trang lớn, nhấn phím `Esc` đóng modal ngay lập tức, phím mũi tên `←` / `→` chuyển qua lại giữa các trang mượt mà.
- [ ] Nút hành động chính (Primary Action Button) hiển thị nhãn động theo ngữ cảnh (ví dụ: `Ghép 3 tệp PDF`, `Tách 5 trang đã chọn`, `Nén PDF (Cân bằng)`), tự động disabled khi chưa hợp lệ.
- [ ] Cả 9 công cụ PDF thực thi trơn tru với phản hồi tiến trình SSE và hiển thị thẻ kết quả đầy đủ các hành động Tải về, Sao chép link, Xem trước và Nối tiếp công cụ khác (Chaining).

### Triển khai & Kiểm thử Môi trường Thực tế
- [ ] Đồng bộ toàn bộ mã nguồn đã hoàn thiện lên homeserver `192.168.2.171`.
- [ ] Dịch vụ `dd-studio.service` khởi động lại trơn tru và phản hồi `status: UP` tại `/api/v1/health`.
- [ ] Giao diện Web PWA hoạt động trơn tru trên cả desktop và mobile, không có lỗi console rác.

## Follow-up — 2026-09-27T15:38:35Z

Hệ thống đã phục hồi quota và hoạt động trở lại. Tiếp tục thực hiện nhiệm vụ hoàn thiện toàn diện PDF Studio Pro từ trạng thái hiện tại trong `.agents/teamwork/orchestrator_pdf_v2`. Hãy rà soát lại GATE_STATUS.md của Milestone 1, khắc phục yêu cầu thay đổi từ reviewer và chuyển tiếp sang Milestone 2 (Cử chỉ vuốt Swipe-to-Clear & phím tắt Lightbox), Milestone 3 và Milestone 4.

## Follow-up — 2026-09-27T16:34:38Z

Hệ thống vừa khởi động lại sau server restart. Hãy tiếp tục thực thi nhiệm vụ hoàn thiện toàn diện PDF Studio Pro từ `.agents/teamwork/orchestrator_pdf_v2`. Tiếp tục hoàn tất Milestone 3, tiến hành Milestone 4 (chạy toàn bộ kiểm thử npx tsc, npx vitest, đồng bộ lên homeserver 192.168.2.171 và khởi động lại dịch vụ) và bàn giao kết quả cuối cùng.


## 2026-10-03T15:54:19Z

# Teamwork Project Prompt

> Requested team: [Full Team — Multi-agent engineering team for polyglot pipeline upgrade]

Nâng cấp toàn diện kiến trúc module "Tạo Bài Tập Trắc Nghiệm" (Quiz Pipeline v3.0) của DuyDev Studio theo đặc tả chi tiết tại docs/QUIZ_PIPELINE_UPGRADE_PLAN.md, giải quyết triệt để 2 lỗi chặn phát hành P0 (sinh đề sai số câu, không in được PDF khi offline), tối ưu hóa tốc độ xử lý AI song song, giảm độ phức tạp thuật toán và tích hợp cơ chế cache đa tầng.

Working directory: C:\Users\AnhDuy\Code\Project\DD Studio
Branch: main
Integrity mode: development
Reference document: docs/QUIZ_PIPELINE_UPGRADE_PLAN.md

## Requirements

### R1. Pre-parser Deterministic & Fix Lỗi Nhân Đôi Câu Hỏi (WP1 & WP2 — P0)
- Xây dựng module `engines/quiz/mcq_parser.py` và `engines/quiz/text_utils.py` để bóc tách cấu trúc câu hỏi (stem, options A/B/C/D, source_number) bằng regex thuần, không dùng AI, đảm bảo biết chính xác số câu thật `available` trước khi xử lý.
- Sửa triệt để bug nhân đôi câu hỏi tại `parse_and_standardize_questions`:
  - Clamp `effective_count = min(count, available)`.
  - Tính batches từ `effective_count`, bỏ hoàn toàn nhánh fallback `else raw_text`.
  - Cưỡng chế đánh số tuần tự `start_num .. start_num + n - 1` độc lập với số do AI trả về.
  - Dedup nội dung câu hỏi bằng SHA1 hash của stem đã lọc bỏ thẻ HTML.
  - Báo lỗi ngay lập tức bằng tiếng Việt nếu không tìm thấy câu hỏi nào trước khi gọi API.
- Đóng băng tuyệt đối 22 test case hiện có trong `engines/quiz/test_quiz_pipeline_v2.py` (không được sửa, xoá hay skip).

### R2. Micro-Batching Song Song & Xử Lý Lỗi Thông Minh (WP3 & WP8)
- Giảm kích thước batch từ 12 câu xuống 5 câu để ngăn ngừa vượt ngưỡng `max_tokens: 8192`.
- Thay thế cơ chế luồng tuần tự bằng `ThreadPoolExecutor` (mặc định 4 luồng song song qua `QUIZ_AI_CONCURRENCY`).
- Đảm bảo `emit_progress` thread-safe với khóa `threading.Lock` để tránh làm hỏng stream JSON stdout lên Node.js worker.
- Cài đặt cơ chế degradation có kiểm soát: nếu 1 batch AI thất bại, tự động fallback về cấu trúc thô từ pre-parser thay vì làm chết toàn bộ job.
- Xóa bỏ hoàn toàn API key thật hardcode trong `engines/quiz/quiz_pipeline.py`.
- Bổ sung cơ chế salvage JSON bị cắt cụt giữa chừng và retry có điều chỉnh (`temperature: 0.0`) thay vì lặp lại request lỗi.

### R3. In PDF Offline Hoàn Toàn & Khử Phụ Thuộc CDN KaTeX (WP5 — P0)
- Tải và vendor cục bộ trọn bộ KaTeX v0.16.11 (CSS, JS, auto-render, font files `.woff2`) vào `engines/quiz/assets/katex/`, đảm bảo không bị gitignore loại trừ.
- Cấu hình per-job HTML directory trong temp dir, copy KaTeX asset cục bộ phục vụ việc in và tự động dọn dẹp sạch sẽ trong khối `finally`.
- Cập nhật cả 2 template HTML (Worksheet và Answer Key) trỏ về `./katex/`, di chuyển script xuống cuối thẻ `<body>`, bỏ `defer` và `DOMContentLoaded` để loại bỏ race condition khi in PDF.
- Bổ sung các cờ Chrome headless: `--allow-file-access-from-files`, `--virtual-time-budget=8000`, `--run-all-compositor-stages-before-draw`, `--disable-features=NetworkService` và giảm timeout chờ in từ 30s xuống 15s.
- Ngoại lệ duy nhất cho phép sửa test: cập nhật assert đường dẫn CDN trong `test_katex_delimiters_and_ignored_classes` sang đường dẫn cục bộ `./katex/...`.

### R4. Tối Ưu Phức Tạp Thuật Toán Vector & Chồng Lấn Tiến Trình In (WP6 & WP4)
- Viết lại hàm `cluster_rects` từ O(n^3) về O(n log n) bằng thuật toán sweep-line kết hợp Union-Find (disjoint-set) và grid-bucketing khi số lượng rect > 1500. Giữ nguyên 100% semantics và public signature.
- Tách việc sinh lời giải chi tiết (`explanation`) thành Phase 2 độc lập qua hàm `generate_explanations`, chỉ gửi stem + options + answer.
- Thực hiện song song hóa chồng lấn trong `run_pipeline`: tiến hành compile PDF Worksheet ngay trên luồng nền trong khi AI đang viết lời giải cho Answer Key.

### R5. Cache Đa Tầng Theo Content-Hash & Dọn Rác Janitor (WP7)
- Xây dựng module `engines/quiz/quiz_cache.py` hỗ trợ 2 tầng cache: Extract PDF cache và AI batch cache dưới dạng JSON atomic write, TTL 7 ngày, kèm định danh phiên bản `PROMPT_VERSION = "v3"`.
- Bổ sung hàm tĩnh `cleanupQuizCache()` vào `server/src/services/janitor.service.ts` khớp chính xác đường dẫn với Python để tự động quét dọn cache quá hạn trong chu kỳ bảo trì.
- Đảm bảo TypeScript compilation và test suite phía server hoạt động trơn tru không lỗi.

## Verification Resources & Commands

Quá trình thi công từng Work Package bắt buộc thực hiện kiểm chứng khách quan:

1. **Kiểm tra Unit Test Engine (Python)**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Yêu cầu*: 22 test cũ giữ nguyên pass 100%, tất cả test case mới được bổ sung theo từng WP phải đạt 100% pass, 0 fail, 0 skip.

2. **Kiểm tra Backend Gateway & Service (TypeScript / Fastify)**:
   ```bash
   cd server && npx tsc --noEmit
   cd server && npx vitest run
   ```
   *Yêu cầu*: TypeScript biên dịch đạt đúng 0 lỗi; toàn bộ test suites vitest pass 100%.

3. **Kiểm tra Tĩnh & Bảo Mật (Grep Audits)**:
   ```bash
   rg "cdn.jsdelivr" engines/quiz/
   rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/
   rg -n "TODO|FIXME|NotImplementedError" engines/quiz/
   ```
   *Yêu cầu*: Toàn bộ 3 lệnh đều phải trả về đúng 0 kết quả.

4. **Smoke Test Thực Tế Offline**:
   ```bash
   python engines/quiz/quiz_pipeline.py <pdf_path> --pages 11 --count 20 --prefix smoke_test --output-dir ./.tmp/quiz_smoke
   ```
   *Yêu cầu*: Sinh đủ 2 tệp PDF hợp lệ (`DeBai.pdf` và `DapAn.pdf`), với tài liệu có 10 câu thì xuất ra chính xác 10 câu đánh số 1..10 không trùng lặp, mở PDF xem được công thức toán KaTeX khi ngắt mạng.

## Acceptance Criteria

### Tính Đúng Đắn & Khắc Phục Lỗi P0
- [ ] Khi trích xuất trang có 10 câu với tham số `--count 20`, kết quả sinh ra đúng 10 câu, số thứ tự tuần tự từ 1 đến 10, không có bất kỳ câu nào trùng lặp nội dung stem.
- [ ] Pipeline biên dịch thành công 2 file PDF A4 trong môi trường offline hoàn toàn (không có internet), công thức toán học và công thức hóa học được hiển thị chuẩn xác (0 ký tự `$` thô trong text layer).
- [ ] Không còn bất kỳ đường dẫn CDN (`cdn.jsdelivr.net`) nào trong mã nguồn `engines/quiz/`.

### Hiệu Năng & Ổn Định
- [ ] Hàm `cluster_rects` xử lý 2000 rects ngẫu nhiên hoàn thành dưới 1.5 giây và cho kết quả bbox tương đương 100% so với thuật toán mẫu.
- [ ] Quá trình gọi AI chuẩn hóa chạy song song 4 luồng, hoàn thành các batch với thời gian wall-clock giảm rõ rệt.
- [ ] File PDF Worksheet được kích hoạt in song song ngay trong khi Phase 2 đang tạo lời giải cho Answer Key.
- [ ] Cơ chế stream progress ra stdout được đồng bộ hóa với thread lock, không bao giờ sinh ra dòng JSON lỗi.

### An Toàn Mã Nguồn & Chất Lượng Phần Mềm
- [ ] Không còn API key nào hardcode trong mã nguồn `engines/quiz/`.
- [ ] Toàn bộ 22 unit test ban đầu trong `test_quiz_pipeline_v2.py` pass nguyên vẹn (ngoại trừ assert CDN đã cập nhật đường dẫn local).
- [ ] File test mới `test_mcq_parser.py` đạt tối thiểu 11 unit test bao phủ đầy đủ các edge cases định dạng đề thi.
- [ ] `cd server && npx tsc --noEmit` đạt 0 lỗi.
- [ ] `cd server && npx vitest run` pass 100%.
- [ ] Janitor service tự động dọn sạch cache quiz cũ hơn 7 ngày mà không làm gián đoạn chu kỳ quét.
- [ ] Thư mục tạm `./.tmp/quiz_smoke` được dọn sạch sau khi kiểm thử.


## Follow-up — 2026-10-04T00:01:34Z

# Teamwork Project Prompt — Resumed Execution

> Requested team: [Full Team — Multi-agent engineering team for polyglot pipeline upgrade]

Tiếp tục triển khai các task còn lại trong kế hoạch nâng cấp kiến trúc Quiz Pipeline v3.0 của DuyDev Studio theo docs/QUIZ_PIPELINE_UPGRADE_PLAN.md.

LƯU Ý QUAN TRỌNG VỀ HIỆN TRẠNG ĐÃ THỰC HIỆN:
1. Milestone 1 (R1: WP1 & WP2 — P0) ĐÃ HOÀN THÀNH 100% VÀ PASS TOÀN BỘ TEST:
   - engines/quiz/text_utils.py đã tạo mới.
   - engines/quiz/mcq_parser.py đã tạo mới với candidate tuple scoring (xử lý cả "Vitamin A.").
   - test_mcq_parser.py (19/19 tests pass).
   - test_adversarial_wp2.py (20/20 tests pass).
   - test_quiz_pipeline_v2.py (25/25 tests pass).
2. Milestone 2 (WP3 & WP8): Code trong engines/quiz/quiz_pipeline.py đã hoàn tất:
   - Batch size 5 câu, ThreadPoolExecutor 4 luồng (QUIZ_AI_CONCURRENCY).
   - _EMIT_LOCK thread-safe.
   - DEFAULT_API_KEY không còn hardcode key thật.
   - _salvage_truncated_json và retry temperature 0.0.
   - Cần bổ sung 10 unit tests cho WP3 & WP8 vào test_quiz_pipeline_v2.py và chạy verify.

Nhiệm vụ còn lại cần hoàn tất:
- Hoàn tất verification Milestone 2 (WP3 & WP8) với 10 unit tests.
- Thi công Milestone 3 (WP5 — P0): Vendor KaTeX v0.16.11 cục bộ vào engines/quiz/assets/katex/, per-job HTML dir, cập nhật 2 template HTML, cờ Chrome headless, 0 cdn.jsdelivr.
- Thi công Milestone 4 (WP6 & WP4): Thuật toán cluster_rects sweep-line O(n log n) và Phase 2 generate_explanations chồng lấn in PDF Worksheet.
- Thi công Milestone 5 (WP7): Hệ thống cache đa tầng content-hash quiz_cache.py và tích hợp cleanupQuizCache() vào server/src/services/janitor.service.ts.
- Nghiệm thu toàn diện (DoD): tsc --noEmit 0 error, vitest 100%, 0 cdn, 0 sk-, offline smoke test.

Working directory: C:\Users\AnhDuy\Code\Project\DD Studio
Branch: main
Integrity mode: development
Reference document: docs/QUIZ_PIPELINE_UPGRADE_PLAN.md
