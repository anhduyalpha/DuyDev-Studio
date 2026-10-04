# Kế Hoạch Tích Hợp & An Toàn Pipeline Quiz v3.0 (Milestone 1: WP1 & WP2)

**Explorer 3 — Pipeline Integration & Safety Specialist**  
**Ngày thực hiện**: 2026-10-03  
**Trạng thái**: Hoàn tất điều tra, sẵn sàng bàn giao cho Worker

---

## 1. TỔNG QUAN & BỐI CẢNH ĐIỀU TRA

Milestone 1 bao gồm 2 Work Package nền tảng sống còn của Quiz Pipeline v3.0:
- **WP1 (Pre-parser Deterministic)**: Bóc tách cấu trúc câu hỏi trắc nghiệm (stem, options A/B/C/D, source_number) thuần regex 100%, không gọi AI, xác định chính xác số câu thật `available` có trong tài liệu trước khi gọi AI.
- **WP2 (Fix Lỗi Nhân Đôi Câu Hỏi - P0-1)**: Sửa dứt điểm lỗi nhân đôi câu hỏi khi user yêu cầu `count > số câu thật` (ví dụ trang có 10 câu nhưng user chọn 20 câu -> sinh 18 câu, 8 câu trùng lặp stem nhưng khác số thứ tự); khóa cứng số câu `effective_count = min(count, available)`, cưỡng chế đánh số tuần tự `start_num .. start_num + n - 1`, dedup SHA1 stem (đã strip thẻ HTML), báo lỗi tiếng Việt ngay lập tức nếu `available == 0` trước khi tốn token gọi AI.

Mục tiêu của Explorer 3:
1. Điều tra sâu điểm nối ghép ảnh (`link_assets_to_questions`) và `run_pipeline` (dòng 1901-1910) để đảm bảo sau khi đánh lại số thứ tự câu hỏi, ảnh minh họa **tuyệt đối không bị gán sai hoặc mất liên kết**.
2. Kiểm tra hợp đồng chuỗi thông báo lỗi với Node.js Worker (`server/src/workers/quiz.worker.ts:74-108`) đối với thông báo `"Không có câu hỏi trong ... , vui lòng chọn lại."`.
3. Rà soát toàn diện **22 test case hiện có** trong `engines/quiz/test_quiz_pipeline_v2.py` nhằm đảm bảo tính an toàn tuyệt đối, không có bất kỳ regression nào xảy ra khi tách file và refactor.
4. Tổng hợp blueprint chi tiết từng bước cho Worker thực thi.

---

## 2. ĐIỀU TRA ĐIỂM NỐI GHÉP ẢNH & RUN_PIPELINE (TASK 1)

### 2.1 Hiện trạng `run_pipeline` (dòng 1901-1910)
Tại `engines/quiz/quiz_pipeline.py`:
```python
1901: raw_text, actual_pages, extracted_assets, asset_map, source_q_nums = extract_raw_pages(pdf_local, pages, temp_assets_dir)
1902: pages_desc = f"Trang {', '.join(map(str, actual_pages))}" if actual_pages else f"Trang {pages}"
1903: 
1904: emit_progress(45, f"Đang chuẩn hóa câu hỏi đa định dạng GDPT 2018 ({count} câu)...")
1905: questions = parse_and_standardize_questions(
1906:     raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model, pages_desc=pages_desc
1907: )
1908: 
1909: # Link visual assets to questions using AI match, layout spatial map, and fallbacks
1910: link_assets_to_questions(questions, extracted_assets, asset_map, source_q_nums)
```

### 2.2 Cơ chế ánh xạ ảnh trong `link_assets_to_questions` (dòng 521-588)
Hàm `link_assets_to_questions(questions, assets, asset_question_map=None, source_question_nums=None)` sử dụng 5 tầng fallback:
1. **Tầng 1 (Direct AI Match)**: So khớp `q['image_ref']` do AI gán trực tiếp với `assets_by_id`.
2. **Tầng 2 (Sequential Index Mapping)**:
   ```python
   for idx, q in enumerate(questions):
       if not q.get("image_data") and idx < len(source_nums):
           orig_q_num = source_nums[idx]
           for a_id, mapped_num in asset_map.items():
               if mapped_num == orig_q_num and a_id in assets_by_id and a_id not in assigned_assets:
                   q["image_ref"] = f"{a_id}.png"
                   q["image_data"] = assets_by_id[a_id].get("data_uri")
                   assigned_assets.add(a_id)
                   break
   ```
3. **Tầng 3 (Layout Spatial Map)**: So khớp `mapped_q_num == q['number']`.
4. **Tầng 4 (Text Marker Match)**: Tìm `[IMAGE_REF: ...]` trong text/options/statements của câu.
5. **Tầng 5 (Keyword Proximity Fallback)**: Gán ảnh còn dư cho câu chứa từ khóa "hình vẽ", "thí nghiệm", "đồ thị"...

### 2.3 Phân tích xung đột & rủi ro vỡ mapping
- `asset_map` được xây dựng trong `extract_structured_page_content` (dòng 768-796): mỗi hình ảnh được liên kết với số câu **gốc trong tài liệu PDF** (ví dụ: một đề thi trắc nghiệm từ câu 15 đến câu 25 trên trang 3 thì `asset_map` chứa `{ "fig_p3_1": 18, "fig_p3_2": 20 }`).
- Trong WP2, câu hỏi sau khi chuẩn hóa sẽ bị cưỡng chế đánh số lại theo `start_num .. start_num + n - 1` (ví dụ `start_q = 1` thì câu 18 gốc sẽ mang số `q['number'] = 4`).
- Nếu ở Tầng 3 (Layout Spatial Map), `q['number'] = 4` sẽ **không bao giờ** khớp với `mapped_q_num = 18`.
- Vì vậy, **Tầng 2 (Sequential Index Mapping)** là phao cứu sinh quyết định: câu thứ `idx` trong danh sách xuất ra phải được so khớp với số câu gốc `source_nums[idx] = 18`.
- Nếu `source_q_nums` truyền vào bị sai, bị thiếu, hoặc bị đánh lại thành `[1, 2, 3, ...]`, toàn bộ Tầng 2 sẽ thất bại, dẫn đến ảnh bị gán sai câu hoặc rơi vào Tầng 5 (gán bừa theo từ khóa).

### 2.4 Giải pháp tích hợp: Single-Parse & `parsed_blocks` Parameter Addition
Để đảm bảo tính nhất quán 100%, không parse lặp lại (tiết kiệm CPU) và bảo toàn thứ tự:
1. Trong `run_pipeline`:
   - Sau khi gọi `extract_raw_pages`, thực hiện parse cấu trúc một lần duy nhất qua `parsed_blocks = parse_mcq_blocks(raw_text)`.
   - Lấy `available = len(parsed_blocks)`. Nếu `available == 0`, throw lỗi ngay.
   - Tính `effective_count = min(count, available)`.
   - Trích xuất danh sách số câu gốc tương ứng đúng với các câu được chọn:
     ```python
     source_q_nums = [b["source_number"] for b in parsed_blocks][:effective_count]
     ```
   - Cập nhật thông báo tiến trình hiển thị đúng số câu thật:
     ```python
     emit_progress(45, f"Đang chuẩn hóa câu hỏi đa định dạng GDPT 2018 ({effective_count} câu)...")
     ```
2. Thêm tham số tùy chọn vào `parse_and_standardize_questions`:
   ```python
   def parse_and_standardize_questions(
       raw_text: str,
       api_key: str,
       count: int = 20,
       start_num: int = 1,
       base_url: str = DEFAULT_API_BASE,
       model: str = DEFAULT_MODEL,
       pages_desc: str = "",
       parsed_blocks: list[dict] | None = None
   ) -> list[dict]:
   ```
   - Nếu `parsed_blocks is None` (ví dụ khi gọi trực tiếp trong unit test), hàm tự động gọi `parsed_blocks = parse_mcq_blocks(raw_text)`.
   - Nếu `parsed_blocks` đã được truyền từ `run_pipeline`, hàm tái sử dụng trực tiếp mà không cần regex lại.
3. Bảo toàn marker ảnh `[IMAGE_REF: ...]`:
   - Trong `mcq_parser.py`, trường `"stem"` phải **giữ nguyên vẹn** marker `[IMAGE_REF: ...]`, chỉ strip section banner.
   - Khi chuyển prompt sang AI hoặc khi dùng fallback, marker vẫn nằm trong câu để Tầng 4 (`marker_match`) hoạt động nếu cần.
   - Cuối cùng, hàm `link_assets_to_questions` ở dòng 590 sẽ tự động gọi `clean_image_markers` để làm sạch toàn bộ marker trước khi kết xuất HTML.

---

## 3. HỢP ĐỒNG LỖI VỚI NODE.JS WORKER (TASK 2)

### 3.1 Kiểm tra `server/src/workers/quiz.worker.ts:74-108`
Hàm `cleanQuizErrorMessage(rawErr: string)` xử lý lỗi từ tiến trình Python:
```typescript
function cleanQuizErrorMessage(rawErr: string): string {
  if (!rawErr) return 'Đã xảy ra lỗi không xác định khi tạo bài tập.';
  const lowerErr = rawErr.toLowerCase();
  if (
    lowerErr.includes('không có câu hỏi') ||
    lowerErr.includes('không tìm thấy câu hỏi') ||
    lowerErr.includes('no questions')
  ) {
    const pageMatch = rawErr.match(/không\s*(?:có|tìm\s*thấy)\s*câu\s*hỏi\s*trong\s*([^,\.]+)/i);
    if (pageMatch) {
      return `Không có câu hỏi trong ${pageMatch[1].trim()}, vui lòng chọn lại.`;
    }
    return 'Không có câu hỏi trong trang, vui lòng chọn lại.';
  }
  if (lowerErr.includes('không chứa văn bản dạng số/vector') || lowerErr.includes('ảnh scan thuần túy')) {
    return 'Trang đã chọn không chứa văn bản trắc nghiệm. Vui lòng chọn trang có lớp chữ hoặc OCR trước.';
  }
  if (lowerErr.includes('vượt quá tổng số')) {
    const lastLine = rawErr.trim().split('\n').pop() || '';
    return lastLine.replace(/^ValueError:\s*/, '').trim() || lastLine.trim();
  }
  ...
}
```

### 3.2 Phát hiện quan trọng tại `quiz_pipeline.py:2016-2022`
Trong khối CLI `main()` hiện tại:
```python
2016: except Exception as e:
2017:     err_msg = str(e).strip()
2018:     if any(k in err_msg.lower() for k in ["không có câu hỏi", "không tìm thấy câu hỏi", "no questions"]):
2019:         sys.stderr.write("Không có câu hỏi trong trang, vui lòng chọn lại.\n")
2020:     else:
2021:         sys.stderr.write(f"{err_msg}\n")
2022:     sys.exit(1)
```
- **Vấn đề**: Dòng 2018-2019 đang ghi đè thông báo cụ thể (ví dụ `RuntimeError("Không có câu hỏi trong Trang 11, vui lòng chọn lại.")`) thành thông báo chung chung `"Không có câu hỏi trong trang, vui lòng chọn lại."`.
- **Hệ quả**: Regex ở `quiz.worker.ts:82` (`([^,\.]+)`) chỉ bắt được chữ `"trang"`.
- **Khuyến nghị chuẩn hóa**: Trong `main()` của `quiz_pipeline.py`, Worker cần ghi thẳng `sys.stderr.write(f"{err_msg}\n")` ra stderr. Khi đó:
  - Nếu `pages_desc` là `"Trang 11"`, Python ném `Không có câu hỏi trong Trang 11, vui lòng chọn lại.` -> Worker regex match `Trang 11` -> Trả về UI chuẩn xác: `"Không có câu hỏi trong Trang 11, vui lòng chọn lại."`.
  - Nếu `pages_desc` rỗng, fallback về `"trang đã chọn"` -> Trả về UI: `"Không có câu hỏi trong trang đã chọn, vui lòng chọn lại."`.
  - Cả hai trường hợp đều thỏa mãn 100% hợp đồng `cleanQuizErrorMessage`.

---

## 4. RÀ SOÁT AN TOÀN 22 TEST HIỆN CÓ TRONG TEST_QUIZ_PIPELINE_V2.PY (TASK 3)

### 4.1 Danh mục 22 Test Case Hiện Có
Toàn bộ 22 test case hiện tại đã được chạy thực tế qua `python engines/quiz/test_quiz_pipeline_v2.py` và đạt kết quả:
**Ran 22 tests in 0.098s — OK (Exit Code 0)**.

| # | Tên Test Case | Hàm / Module Được Kiểm Thử | Kiểm Tra Điều Gì | Blast Radius Khi Sửa WP1 & WP2 |
|---|---|---|---|---|
| 1 | `test_2_column_layout_sorting` | `sort_blocks_by_layout` | Bố cục 2 cột: Header -> Cột 1 (Q1, Q2) -> Cột 2 (Q3, Q4) | Không chạm |
| 2 | `test_running_header_footer_filtering` | `sort_blocks_by_layout` | Lọc tiêu đề trang và chân trang (y < 40 hoặc y > 760) | Không chạm |
| 3 | `test_cluster_rects` | `cluster_rects` | Gom cụm bounding box lân cận trong margin 10pt | Không chạm ở M1 (WP6 mới tối ưu) |
| 4 | `test_table_to_markdown` | `table_to_markdown` | Chuyển mảng 2D thành bảng Markdown chuẩn | Không chạm |
| 5 | `test_format_tables_in_text` | `format_tables_in_text` | Render bảng Markdown thành HTML `<table class="q-table">` | Không chạm |
| 6 | `test_cross_page_stitcher` | `stitch_cross_page_text` | Nối câu bị ngắt giữa 2 trang, không chèn page break | Không chạm |
| 7 | `test_sliding_window_chunking` | `chunk_questions_sliding_window` | Chia 25 câu thành 3 window trượt (kích thước 10) | **BẮT BUỘC GIỮ HÀM**: Dù WP2 không gọi hàm này trong pipeline chính, hàm vẫn phải tồn tại nguyên vẹn signature và logic để test này tiếp tục pass |
| 8 | `test_html_generation_mcq` | `generate_worksheet_html`, `generate_answer_key_html` | Render HTML đề bài và đáp án với grid options, katex | Không chạm |
| 9 | `test_visual_assets_extraction_and_linking` | `extract_visual_assets`, `link_assets_to_questions` | Trích xuất hình vẽ và liên kết với câu hỏi có ảnh | Không chạm |
| 10 | `test_2_column_mid_page_banner_sorting` | `sort_blocks_by_layout` | Phân đoạn 2 cột có dải băng phân cách ở giữa trang ("PHẦN II") | Không chạm |
| 11 | `test_school_header_filtering` | `sort_blocks_by_layout` | Lọc thông tin trường, số báo danh, mã đề thi | Không chạm |
| 12 | `test_true_false_and_parenthesis_cross_page_stitching` | `stitch_cross_page_text` | Nối câu hỏi Đúng/Sai (`a) ... b)`) và lựa chọn đóng ngoặc (`A) ... B)`) qua trang | Không chạm |
| 13 | `test_defensive_question_normalization` | `normalize_question` | Chuẩn hóa options dạng array hoặc chữ thường (`a`, `b`) | Không chạm |
| 14 | `test_marker_purged_on_direct_match` | `link_assets_to_questions` | Khớp trực tiếp `[IMAGE_REF: ...]` và xóa marker khỏi đề bài | Không chạm |
| 15 | `test_sequential_index_mapping_with_renumbered_questions` | `link_assets_to_questions` | **Cực kỳ quan trọng**: Kiểm chứng câu đánh số 1, 2 vẫn nhận đúng ảnh từ câu gốc 14, 15 qua `source_nums` | **Khẳng định tính đúng đắn** của thiết kế truyền `source_q_nums` ở Task 1 |
| 16 | `test_no_artificial_page_breaks_in_worksheet_and_answer_key` | `generate_*_html` | Kiểm tra không chèn `page-break-before`, có `break-inside: avoid;` | Không chạm |
| 17 | `test_katex_delimiters_and_ignored_classes` | `generate_*_html` | Kiểm tra KaTeX auto-render delimiters (`\\(`, `\\[`) và ignoredClasses | Giữ nguyên ở M1 (WP5 mới cập nhật assert local) |
| 18 | `test_is_section_banner_detection` | `is_section_banner` | Nhận diện dải băng phân cách phần ("PHẦN I", "PHẦN II"...) | **Yêu cầu Re-export**: Hàm được chuyển sang `text_utils.py` nhưng phải được re-export tại `quiz_pipeline.py` |
| 19 | `test_extract_visual_assets_filters_banners_and_tables` | `extract_visual_assets` | Lọc bỏ hình vẽ dính vào banner hoặc bảng biểu | Không chạm |
| 20 | `test_chunk_questions_sliding_window_strips_trailing_section_banner` | `chunk_questions_sliding_window` | Cắt bỏ banner dính ở đuôi câu cuối | **BẮT BUỘC GIỮ HÀM**: Tương tự test 7 |
| 21 | `test_normalize_question_sanitizes_section_banner` | `normalize_question` | Làm sạch banner dính trong đề bài, đáp án, giải thích | Không chạm |
| 22 | `test_spatial_asset_map_resets_on_section_banner` | `extract_structured_page_content` | Reset context câu hỏi khi gặp banner để không map sai ảnh | Không chạm |

### 4.2 Môi trường thực thi & Console Encoding trên Windows
- File test `test_quiz_pipeline_v2.py` đã có khối xử lý an toàn:
  ```python
  if sys.platform == "win32":
      try:
          sys.stdout.reconfigure(encoding="utf-8", errors="replace")
      except Exception:
          pass
  sys.path.insert(0, os.path.dirname(__file__))
  ```
- File test mới `test_mcq_parser.py` (tạo ở WP1) bắt buộc phải sao chép chính xác khối reconfigure và sys.path này để không bị lỗi `UnicodeEncodeError` trên Windows cp1252/cp936.
- Tại `engines/quiz/quiz_pipeline.py`, ở đầu file cần đảm bảo có `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` để lệnh `from text_utils import ...` và `from mcq_parser import ...` luôn hoạt động dù pipeline được gọi từ project root hay từ thư mục con.

---

## 5. BLUEPRINT TRIỂN KHAI CHO WORKER (TASK 4)

Sau đây là trình tự thực thi bất di bất dịch dành cho Worker Milestone 1:

### Giai đoạn 1: Triển khai WP1 (Pre-parser Deterministic)
1. **Tạo `engines/quiz/text_utils.py`**:
   - Di chuyển 3 hàm từ `quiz_pipeline.py`:
     - `is_section_banner(text: str) -> bool`
     - `strip_section_banner(text: str) -> str`
     - `clean_image_markers(text: str) -> str`
   - Đảm bảo đầy đủ import cần thiết (`re`).
2. **Cập nhật `engines/quiz/quiz_pipeline.py`**:
   - Thêm `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` ở đầu file.
   - Thêm re-export:
     ```python
     from text_utils import is_section_banner, strip_section_banner, clean_image_markers
     ```
   - Xóa bỏ định nghĩa gốc của 3 hàm này trong `quiz_pipeline.py` để tránh trùng lặp.
3. **Tạo `engines/quiz/mcq_parser.py`**:
   - Export 2 hàm chính: `parse_mcq_blocks(text: str) -> list[dict]` và `count_available_questions(text: str) -> int`.
   - Cài đặt 7 bước bóc tách chuẩn theo đặc tả:
     - Bước 1: Boundary regex `(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))`.
     - Bước 2: Number regex `^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]`.
     - Bước 3 & 4: Option lookbehind `(?:(?<=\s)|^)([A-D])[\.\)\:]\s*` với **thuật toán tăng dần nghiêm ngặt** `expected = ["A", "B", "C", "D"]`.
     - Bước 5: Cắt stem và 4 options.
     - Bước 6: Gọi `strip_section_banner(stem)`.
     - Bước 7: Đánh giá confidence (`"high"` nếu đủ 4 options non-empty và stem non-empty; ngược lại `"low"`).
4. **Tạo `engines/quiz/test_mcq_parser.py`**:
   - Tối thiểu 11 test case kiểm thử toàn bộ edge cases:
     - Dấu chấm chuẩn, dấu ngoặc đơn, dấu hai chấm.
     - Options nằm trên cùng 1 dòng.
     - Viết tắt trong stem ("Vitamin D.").
     - Nhãn dính vào từ ("phenolB.y" không bị nhận nhầm).
     - Thiếu option D (confidence = low).
     - Option rỗng (confidence = low).
     - Bảo toàn `[IMAGE_REF: ...]`.
     - Strip banner ở đuôi câu.
     - Chuỗi rỗng & văn bản không có câu hỏi nào.
     - `test_count_available_questions_matches_parse_length`.
     - `test_source_number_preserved_from_pdf`.
     - `test_low_confidence_blocks_are_kept_not_dropped`.
5. **Chạy kiểm thử Gate WP1**:
   ```bash
   python engines/quiz/test_mcq_parser.py        # Phải pass 100%
   python engines/quiz/test_quiz_pipeline_v2.py    # Phải pass 22/22 tests
   ```

### Giai đoạn 2: Triển khai WP2 (Fix Nhân Đôi Câu Hỏi & Khóa Số Câu)
1. **Sửa `parse_and_standardize_questions` trong `engines/quiz/quiz_pipeline.py`**:
   - Bổ sung tham số `parsed_blocks: list[dict] | None = None`.
   - Nếu `parsed_blocks is None`, gán `parsed_blocks = parse_mcq_blocks(raw_text)`.
   - Bắt lỗi khi không có câu hỏi trước khi gọi AI:
     ```python
     available = len(parsed_blocks)
     if available == 0:
         desc = pages_desc or "trang đã chọn"
         raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
     effective_count = min(count, available)
     ```
   - Tính toán batch dựa trên `effective_count`: `remaining = effective_count`.
   - Tính window trực tiếp từ `parsed_blocks`:
     ```python
     windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]
     assert len(windows) == len(batches)
     ```
   - Loại bỏ hoàn toàn dòng fallback cũ:
     `# w_text = windows[b_idx][2] if b_idx < len(windows) else raw_text`
   - Dedup kết quả AI theo SHA1 stem sau khi strip HTML:
     ```python
     def _stem_fingerprint(q: dict) -> str:
         plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
         plain = re.sub(r"\s+", "", plain).lower()
         return hashlib.sha1(plain.encode("utf-8")).hexdigest()
     ```
   - Clamp kết quả: `all_questions = all_questions[:effective_count]`.
   - Cưỡng chế đánh số tuần tự: `q["number"] = start_num + i`.
   - **LƯU Ý**: Giữ nguyên định nghĩa hàm `chunk_questions_sliding_window` trong file để phục vụ test 7 và 20.
2. **Sửa `run_pipeline` trong `engines/quiz/quiz_pipeline.py`**:
   - Gọi `parse_mcq_blocks(raw_text)` ngay sau `extract_raw_pages`.
   - Xác định `effective_count = min(count, len(parsed_blocks))`.
   - Trích xuất `source_q_nums = [b["source_number"] for b in parsed_blocks][:effective_count]`.
   - Truyền `source_q_nums` vào `link_assets_to_questions(questions, extracted_assets, asset_map, source_q_nums)`.
   - Truyền `parsed_blocks=parsed_blocks` và `count=effective_count` vào `parse_and_standardize_questions`.
   - Trong `main()`, sửa exception handler để `sys.stderr.write(f"{err_msg}\n")`.
3. **Thêm test mới vào cuối `engines/quiz/test_quiz_pipeline_v2.py`**:
   - **Tuyệt đối cấm** sửa 22 test cũ.
   - Thêm lớp `TestQuizPipelineV2WP2(unittest.TestCase)` ở cuối file với 3 test:
     1. `test_no_duplicate_questions_when_count_exceeds_available`
     2. `test_sequential_numbering_overrides_ai_numbers`
     3. `test_zero_questions_raises_before_any_api_call`
4. **Chạy kiểm thử Gate WP2**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_quiz_pipeline_v2.py    # Phải pass 25 tests (22 cũ + 3 mới)
   cd server && npx tsc --noEmit                 # Phải đạt 0 error
   cd server && npx vitest run                    # Phải pass 100%
   ```

---

## 6. KẾT LUẬN & ĐÁNH GIÁ SẴN SÀNG

Toàn bộ các yêu cầu kỹ thuật và điểm mù rủi ro của Milestone 1 (WP1 & WP2) đã được làm rõ và kiểm chứng thực nghiệm:
- **Image Mapping Integrity**: Đã có giải pháp chắc chắn với cơ chế single-parse và truyền `source_q_nums` gốc.
- **Worker Error Contract**: Đã làm rõ chuỗi xử lý và chuẩn hóa thông báo tiếng Việt khớp hoàn toàn với `quiz.worker.ts`.
- **Regression Zero Tolerance**: Đã kiểm tra 22 test hiện có, xác định điều kiện tiên quyết (re-export và giữ hàm cũ).
- **Worker Blueprint**: Đã cung cấp chỉ dẫn từng bước rõ ràng, mạch lạc, sẵn sàng thi công ngay lập tức.
