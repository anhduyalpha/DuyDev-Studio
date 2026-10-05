---
id: KI-FIX-020-quiz-pdf-atomic-pagination-latex-layout-calibration
title: "Hiệu Chỉnh Thuật Toán Phân Trang PDF Nguyên Tử (Atomic Pagination), Triệt Tiêu Ngắt Trang Sớm & Đo Đạc Tọa Độ Bằng PyMuPDF"
type: troubleshoot
status: verified
domain: backend
tags: [quiz, pagination, paged-media, katex-latex, layout-solver, pymupdf, atomic-question-block, pdf-rendering]
created_at: 2026-10-05
updated_at: 2026-10-05
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi file PDF đề thi trắc nghiệm gặp hiện tượng: trang 1 bị thừa một khoảng trắng lớn ở chân trang trong khi câu hỏi tiếp theo bị cưỡng chế đẩy sang trang 2, hoặc câu hỏi bị cắt đôi (thân câu hỏi ở trang trước, 4 đáp án A/B/C/D bị đẩy sang trang sau), dẫn đến trang cuối cùng bị trống hơn 70% diện tích"
search_queries:
  - "Lỗi phân trang PDF để lại khoảng trắng lớn ở cuối trang"
  - "Câu hỏi trắc nghiệm bị cắt đôi thân câu một trang đáp án một trang"
  - "Ước tính chiều cao câu hỏi chứa công thức LaTeX KaTeX bị thừa điểm pt"
  - "Page break before đẩy câu hỏi sang trang mới quá sớm"
  - "Đo đạc bounding box câu hỏi PDF bằng PyMuPDF hai pass"
  - "Atomic QuestionBlock CSS break-inside avoid paged media"
related_kis:
  - KI-CON-004-two-column-continuous-flow-quiz-pdf-engine
  - KI-FIX-017-quiz-two-column-mid-banner-scramble-dangling-stitcher
  - KI-FIX-021-python-runtime-future-annotations-polyglot-worker
---

# [KI-FIX-020] Hiệu Chỉnh Thuật Toán Phân Trang PDF Nguyên Tử (Atomic Pagination), Triệt Tiêu Ngắt Trang Sớm & Đo Đạc Tọa Độ Bằng PyMuPDF

## 1. Context & Triệu Chứng (Symptom & Challenges)

Trong quá trình xuất bản tài liệu PDF đề bài trắc nghiệm (`_DeBai.pdf`) sử dụng Chrome Headless và W3C CSS Paged Media (`@page`, `break-inside: avoid`), module `LayoutSolver` xuất hiện 3 lỗi phân trang nghiêm trọng trên tài liệu thực tế (điển hình như `tesst_DeBai.pdf` 12 câu từ Câu 35 đến Câu 46):

1. **Ngắt trang sớm để lại khoảng trống lớn (Premature Page Break)**:
   - Trang 1 kết thúc ở Câu 40, để lại khoảng trống lớn (~200 pt) ở chân trang, trong khi Câu 41 (chứa công thức hóa học và sơ đồ phản ứng) bị cưỡng chế đẩy toàn bộ sang Trang 2.
2. **Cắt đôi câu hỏi bất hợp lý (Severed Question Stem & Options)**:
   - Ở Trang 2, thân câu hỏi (stem) của Câu 45 nằm ở chân trang, nhưng cụm 4 đáp án A/B/C/D lại bị cắt rời và đẩy sang Trang 3.
3. **Trang cuối cùng bị lãng phí diện tích (>70% Empty Space)**:
   - Trang 3 chỉ chứa cụm đáp án Câu 45 + Câu 46 + dòng chữ `--- HẾT ---`, chiếm chưa đầy 30% chiều cao trang A4, gây lãng phí giấy in ấn và mất thẩm mỹ chuyên nghiệp.

---

## 2. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

### 2.1. Sai số cộng dồn khi ước tính chiều dài công thức LaTeX (Phantom Height)
Trong `LayoutSolver.estimate_question_components`, chiều cao thân câu hỏi và các phương án được ước tính dựa trên số lượng ký tự văn bản (`len(text)`).
- **Thực tế**: Các công thức toán/hóa học KaTeX có cú pháp thô rất dài (ví dụ: `\xrightarrow[\text{nước ép quả nho chín}]{\text{tráng bạc}}`, `\mathrm{C_{17}H_{33}COOH}` dài hơn 80-120 ký tự thô).
- **Khi render thực tế**: KaTeX biên dịch thành các ký hiệu toán học chỉ chiếm từ 15-25 ký tự thị giác trên một dòng duy nhất.
- Ngoài ra, thuật toán cũ tự động cộng thêm padding cố định (+6 pt stem, +6 pt options, +16 pt container padding) cho mỗi câu hỏi.
- **Hệ quả**: Sau 6 câu hỏi (Câu 35–40), sai số ước tính cộng dồn lên đến **~220 pt ảo**. Bộ giải thuật toán tưởng rằng Trang 1 chỉ còn 67.2 pt hữu dụng, trong khi thực tế còn hơn 250 pt, dẫn tới việc áp đặt cờ `.page-break-before` cưỡng bức đẩy Câu 41 sang Trang 2.

### 2.2. Ngưỡng cho phép chia câu (`can_split`) quá lỏng lẻo
- Bộ giải trước đây quy định: nếu chiều cao còn lại của trang $\ge 60\text{ pt}$ và chiều cao thân câu hỏi $stem\_h \ge 45\text{ pt}$, câu hỏi được phép chia cắt (`can_split = True`).
- Thân Câu 45 cao 54 pt (đáp ứng điều kiện $\ge 45\text{ pt}$), thuật toán liền giữ lại thân câu ở Trang 2 và đẩy cụm phương án sang Trang 3, phá vỡ tính nguyên tử của câu hỏi trắc nghiệm (Atomic Question Unit).

### 2.3. Xung đột giữa ngắt trang suy đoán và CSS Paged Media Containment
- Trình duyệt Chrome Headless khi render CSS Paged Media đã có cơ chế tự động cân bằng trang thông qua `.question-item { break-inside: avoid !important }`.
- Khi thuật toán phân trang suy đoán chèn thủ công class `.page-break-before` dựa trên số liệu ước tính sai lệch, nó đã vô hiệu hóa khả năng dàn trang tự nhiên tối ưu của Blink Engine.

---

## 3. Giải Pháp Triệt Để (Resolution)

### 3.1. Chuẩn Hóa Chiều Dài Ký Tự Thị Giác (`estimate_visual_text_length`)
Trong `engines/quiz/rendering/layout.py`, triển khai hàm chuẩn hóa loại bỏ cú pháp markup trước khi tính số dòng:
```python
@classmethod
def estimate_visual_text_length(cls, text: str) -> int:
    """Normalize LaTeX math, chemical formulas, and HTML tags to visual character count."""
    if not text:
        return 0
    cleaned = cls.clean_text_for_length(text)
    # Loại bỏ các lệnh mũi tên phản ứng dài \xrightarrow[...]
    cleaned = re.sub(r"\\xrightarrow(?:\[.*?\])?(?:\{.*?\})?", " --> ", cleaned)
    # Rút gọn các lệnh định dạng font LaTeX (\mathrm{X}, \mathbf{X})
    cleaned = re.sub(r"\\[a-zA-Z]+(?:\{([^}]*)\})?", r"\1", cleaned)
    # Loại bỏ dấu ngoặc nhọn, dấu gạch dưới, mũ số
    cleaned = re.sub(r"[{}\^_\$\\]", "", cleaned)
    # Chuẩn hóa khoảng trắng
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return len(cleaned)
```

### 3.2. Đọc Kích Thước Ảnh Vật Lý Chính Xác từ Đĩa (PIL Inspection)
Thay vì gán cứng chiều cao ảnh giả định (120 pt), đọc trực tiếp kích thước ảnh bằng `PIL.Image` và co giãn theo giới hạn CSS (`max-width: 457 pt`, `max-height: 180 pt`):
```python
if visual_asset and visual_asset.file_path and os.path.isfile(visual_asset.file_path):
    try:
        from PIL import Image
        with Image.open(visual_asset.file_path) as img:
            w_px, h_px = img.size
            if w_px > 0 and h_px > 0:
                aspect = h_px / w_px
                render_w = min(float(w_px), 457.0)
                render_h = min(render_w * aspect, 180.0)
                rich_content_height_pt = max(render_h + 12.0, 36.0)
    except Exception:
        rich_content_height_pt = 100.0
```

### 3.3. Siết Chặt Tính Nguyên Tử (Atomic Invariant)
Quy định bất biến: **Không bao giờ được cắt rời thân câu hỏi và các phương án A/B/C/D** trừ khi câu hỏi đó đơn lẻ vượt quá chiều cao hữu dụng của cả một trang A4 ($> 680\text{ pt}$):
```python
# Chỉ cho phép chia câu khi một câu duy nhất cao vượt quá chiều cao một trang A4
can_split = (q_total > usable_page_height_pt) and (remaining_height_pt >= 150.0)
```

### 3.4. Cơ Chế Đo Đạc Bounding Box Tọa Độ Thực Tế (Two-Pass PyMuPDF Measurement)
Bổ sung phương thức `LayoutSolver.measure_pdf_rendered_questions` sử dụng PyMuPDF để trích xuất tọa độ bbox render thực tế từ file PDF:
```python
@staticmethod
def measure_pdf_rendered_questions(pdf_path: str, doc_ir: CanonicalDocumentIR | None = None) -> dict[str, dict[str, Any]]:
    """Inspect rendered PDF with PyMuPDF to extract exact physical coordinates of questions."""
    doc = pymupdf.open(pdf_path)
    # Duyệt qua các text blocks và rects để xác định:
    # - stem_page, options_page
    # - is_split: True nếu stem và options nằm ở 2 trang khác nhau
    # - missing_options: Kiểm tra có đủ các nhãn A, B, C, D không
    # - total_height, stem_height, options_height
    ...
```

Trong `PDFCompiler.compile_both`:
- **Pass 1**: Biên dịch HTML dựa trên CSS Containment tự nhiên của Chrome (`.question-item { break-inside: avoid !important }`).
- **Inspection**: Dùng PyMuPDF đo đạc file PDF vừa tạo.
- **Pass 2 (Tự chữa lành)**: Nếu phát hiện bất kỳ câu hỏi nào bị cắt ngang trang hoặc xuất hiện lỗi layout, truyền `rendered_measurements` chứa tọa độ thực tế vào `LayoutSolver.plan_atomic_pagination` để biên dịch lại Pass 2 hoàn hảo.

---

## 4. Gotchas & Điểm Cần Lưu Ý

> [!WARNING]
> **Không lạm dụng `page-break-before: always` suy đoán**: Khi ép ngắt trang bằng CSS dựa trên ước lượng thuần túy, mọi sai số dù chỉ vài pt cũng sẽ tạo ra các trang bị bỏ trống vô ích. Hãy ưu tiên để Blink Engine tự ngắt trang với `break-inside: avoid`, và chỉ can thiệp ở Pass 2 khi đo đạc thực tế phát hiện lỗi.

> [!IMPORTANT]
> **Đo lường visual text length là bắt buộc đối với đề thi tự nhiên**: Các biểu thức hóa học, công thức tích phân hay ma trận chứa lượng ký tự mã nguồn rất lớn nhưng diện tích chiếm dụng thực tế rất nhỏ. Tuyệt đối không dùng `len(raw_latex)` để tính số dòng văn bản.

---

## 5. Verification (Quy Trình Kiểm Chứng)

1. **Chạy Regression Test Tự Động Phân Trang**:
   ```bash
   python -m unittest engines/quiz/tests/test_regression_pagination_tesst.py
   ```
   *Yêu cầu*: Test assert 12 câu từ Câu 35 đến Câu 46 sinh ra chính xác **2 trang** (Trang 1: Câu 35..41; Trang 2: Câu 42..46 + HẾT), 0 câu bị chia cắt, 0 đáp án bị thiếu.
2. **Kiểm tra Toàn Bộ Suite Quiz**:
   ```bash
   python -m unittest discover -s engines/quiz/tests
   ```
   *Yêu cầu*: 184/184 tests passed.
3. **Kiểm tra Trực Quan (Visual Verification)**:
   Chuyển đổi các trang PDF thành ảnh PNG 150 DPI và kiểm tra:
   - Trang 1 không còn khoảng trống bất thường ở chân trang.
   - Trang 2 chứa trọn vẹn Câu 45 và Câu 46 kèm đầy đủ 4 đáp án A, B, C, D.
   - Trang 3 hoàn toàn bị triệt tiêu.

---

## 6. Changelog
- **2026-10-05 (v1.0.0)**: Khởi tạo KI sau khi hiệu chỉnh thành công thuật toán phân trang PDF cho Quiz Pipeline v3.0 (@anhduy).
