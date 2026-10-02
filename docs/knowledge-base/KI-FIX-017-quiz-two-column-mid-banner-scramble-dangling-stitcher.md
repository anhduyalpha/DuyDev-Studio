---
id: KI-FIX-017-quiz-two-column-mid-banner-scramble-dangling-stitcher
title: "Khắc Phục Lỗi Xáo Trộn Bố Cục 2 Cột, Rách Câu Hỏi Giữa Trang (Dangling Questions) & Khoảng Trắng Nhân Tạo Trong A4 PDF Paged Media"
type: troubleshoot
status: verified
domain: backend
tags: [quiz, paged-media, layout-sorting, dangling-questions, artificial-whitespace, pymupdf, two-column]
created_at: 2026-10-02
updated_at: 2026-10-02
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Khi biên soạn đề thi trắc nghiệm A4 2 cột gặp hiện tượng: câu hỏi bị xáo trộn giữa 2 cột, tiêu đề phân đoạn đè lên nội dung, câu hỏi bị rách phương án (dangling), hoặc trang in xuất hiện khoảng trắng nhân tạo khổng lồ"
search_queries:
  - "Lỗi xáo trộn thứ tự đọc tài liệu 2 cột PyMuPDF"
  - "Câu hỏi trắc nghiệm bị đứt gãy qua trang dangling question stitcher"
  - "Khoảng trắng nhân tạo giữa các câu hỏi A4 PDF paged media"
  - "Bố cục 2 cột bị đè banner phân đoạn giữa trang"
related_kis:
  - KI-CON-004-two-column-continuous-flow-quiz-pdf-engine
  - KI-FIX-013-polyglot-cli-subcommand-argparse-inheritance
---

# [KI-FIX-017] Khắc Phục Lỗi Xáo Trộn Bố Cục 2 Cột, Rách Câu Hỏi Giữa Trang (Dangling Questions) & Khoảng Trắng Nhân Tạo Trong A4 PDF Paged Media

## 1. Context & Triệu Chứng (Symptom & Root Causes)

Trong quá trình trích xuất văn bản từ đề thi scan 2 cột và render lại ra PDF A4, hệ thống gặp 3 lỗi nghiêm trọng:

1. **Mid-Banner Column Scramble (Xáo trộn do banner giữa trang)**:
   - *Triệu chứng*: Khi trang đề có một tiêu đề phân đoạn dài vắt ngang 2 cột (ví dụ: `PHẦN II: CÂU TRẮC NGHIỆM ĐÚNG SAI`), thuật toán sắp xếp tọa độ thông thường (`col1_candidates` rồi `col2_candidates`) khiến nửa trên cột 2 bị gộp chung với nửa dưới cột 2, xáo trộn hoàn toàn thứ tự đọc của con người.
2. **Dangling Question Across Page Breaks (Rách câu hỏi qua ranh giới trang)**:
   - *Triệu chứng*: Câu hỏi bắt đầu ở cuối trang $N$ (chỉ có thân câu và phương án A, B), còn phương án C, D nằm ở đầu trang $N+1$. Mô hình AI trích xuất coi đây là 2 câu độc lập, sinh ra câu hỏi cụt không có đáp án.
3. **Artificial Page Whitespace (Khoảng trống trang nhân tạo)**:
   - *Triệu chứng*: Đề thi 2 cột xuất hiện các khoảng trống trắng lớn chiếm 1/2 đến 2/3 trang giấy, đẩy câu tiếp theo sang trang mới dù trang hiện tại còn rất nhiều diện tích trống.

---

## 2. Giải Pháp Triệt Để (Resolution)

### 2.1. Phân đoạn dải băng theo chiều dọc (Band-Based Layout Segmentation)
Trong `engines/quiz/quiz_pipeline.py`, thay thế việc gom cột tĩnh bằng thuật toán chia dải băng động:
```python
# Phân đoạn các khối văn bản trải dài (spanning blocks) đóng vai trò là mốc ranh giới dải băng
spanning_blocks = [b for b in blocks if (b[2] - b[0]) > pw * 0.65]
spanning_blocks.sort(key=lambda b: b[1]) # Sắp xếp từ trên xuống dưới

# Duyệt từng dải băng (band) giữa các banner:
# Trong mỗi dải băng: Lấy hết Cột 1 (trên xuống dưới) -> rồi mới lấy Cột 2 (trên xuống dưới)
ordered_blocks = []
current_y = 0

for span in spanning_blocks:
    band_col1 = [b for b in col1_blocks if current_y <= b[1] < span[1]]
    band_col2 = [b for b in col2_blocks if current_y <= b[1] < span[1]]
    
    ordered_blocks.extend(sorted(band_col1, key=lambda b: b[1]))
    ordered_blocks.extend(sorted(band_col2, key=lambda b: b[1]))
    ordered_blocks.append(span)
    current_y = span[3]

# Xử lý dải băng cuối cùng phía dưới banner cuối cùng
```

### 2.2. Khâu nối câu hỏi bị đứt gãy bằng `is_question_dangling` & `stitch_cross_page_text`
Nhận diện câu hỏi chưa hoàn thành ở cuối trang để tự động khâu nối với trang kế tiếp trước khi gửi vào LLM:
```python
def is_question_dangling(text: str) -> bool:
    """
    Kiểm tra câu hỏi ở cuối trang có bị thiếu phương án lựa chọn hay không.
    Hỗ trợ cả dạng A., A) và True/False.
    """
    trimmed = text.strip()
    q_matches = list(re.finditer(r"(?:Câu|Bài)\s*\d+[\.\:]", trimmed, re.IGNORECASE))
    if not q_matches:
        return False

    last_q_text = trimmed[q_matches[-1].start():]
    has_mcq_a = bool(re.search(r"(?:^|\s)[A][\.\)\:]", last_q_text))
    has_mcq_c = bool(re.search(r"(?:^|\s)[C][\.\)\:]", last_q_text))

    # Nếu có bắt đầu Câu hỏi và có phương án A nhưng chưa tới phương án C/D -> Câu hỏi bị rách
    return has_mcq_a and not has_mcq_c
```
Khi phát hiện `is_question_dangling(page_n) == True`, hàm `stitch_cross_page_text` không ngắt đoạn bằng dấu phân trang mà nối trực tiếp dòng đầu của `page_{n+1}` vào khối văn bản hiện tại.

### 2.3. Loại bỏ ngắt trang nhân tạo trong CSS Paged Media
Trong các hàm sinh HTML (`generate_worksheet_html` và `generate_answer_key_html`):
- **CẤM** sử dụng:
  ```css
  /* ❌ ANTI-PATTERN: Gây khoảng trắng nhân tạo khổng lồ */
  .question-block {
      page-break-before: auto;
      break-before: column;
  }
  ```
- **BẮT BUỘC** sử dụng:
  ```css
  /* ✅ PRODUCTION STANDARD: Dòng chảy 2 cột tự nhiên, chống xé lẻ câu */
  .worksheet-body {
      column-count: 2;
      column-gap: 8mm;
      column-fill: auto;
  }

  .question-block {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 3.5mm;
  }
  ```

---

## 3. Gotchas & Edge Cases (Lưu Ý Quan Trọng)

> [!WARNING]
> 1. **Header & Footer đè vào rãnh cột**: Luôn chạy `is_running_header_or_footer` trước khi tính rãnh cột (`detect_column_gutter`). Số trang hoặc tên trường ở đầu/cuối trang nếu không lọc sẽ làm lệch tọa độ `x_split`.
> 2. **Ảnh câu hỏi quá cao (> 1/2 chiều cao cột)**: Nếu câu hỏi có hình ảnh lớn, không đặt cố định `height: auto` không giới hạn vì `break-inside: avoid` sẽ đẩy toàn bộ câu hỏi sang cột sau tạo khoảng trống lớn. Luôn khống chế:
>    ```css
>    .question-image {
>        max-height: 48mm;
>        object-fit: contain;
>    }
>    ```

---

## 4. Verification (Tiêu Chuẩn Kiểm Thử)

Chạy bộ unit test tự động trong `engines/quiz/test_quiz_pipeline_v2.py`:
```bash
python -m unittest engines/quiz/test_quiz_pipeline_v2.py -v
```

Kết quả kỳ vọng:
- `test_no_artificial_page_breaks_in_worksheet_and_answer_key`: PASS (Xác nhận 0 xuất hiện `page-break-before` trong toàn bộ DOM).
- `test_is_question_dangling_detection`: PASS (Nhận diện chính xác câu rách phương án).
- `test_layout_sorting_mid_banner`: PASS (Thứ tự đọc sau khi sort khớp 100% tài liệu gốc).

---

## 5. Changelog
- **2026-10-02 (v1.0.0)**: Khởi tạo KI-FIX-017 trích xuất từ commit `1c62d59` và `33bfaa1`.
