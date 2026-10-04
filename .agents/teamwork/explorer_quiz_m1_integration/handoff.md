# Handoff Report — Explorer 3 (Pipeline Integration & Safety Specialist)

**Milestone**: Milestone 1 (WP1 & WP2) — Quiz Pipeline v3.0  
**Target Recipient**: Parent Orchestrator (`82523155-5971-4e42-a66e-a71df58f4d82`) & Worker Implementer  
**Type**: Hard Handoff (Investigation Complete)  
**Date**: 2026-10-03  

---

## 1. Observation

1. **`engines/quiz/quiz_pipeline.py:1901-1910` (`run_pipeline`)**:
   ```python
   raw_text, actual_pages, extracted_assets, asset_map, source_q_nums = extract_raw_pages(pdf_local, pages, temp_assets_dir)
   pages_desc = f"Trang {', '.join(map(str, actual_pages))}" if actual_pages else f"Trang {pages}"

   emit_progress(45, f"Đang chuẩn hóa câu hỏi đa định dạng GDPT 2018 ({count} câu)...")
   questions = parse_and_standardize_questions(
       raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model, pages_desc=pages_desc
   )

   # Link visual assets to questions using AI match, layout spatial map, and fallbacks
   link_assets_to_questions(questions, extracted_assets, asset_map, source_q_nums)
   ```
   - `extract_raw_pages` trích xuất `source_q_nums` bằng regex sơ bộ trên `stitched_text` (dòng 844-850).
   - `extract_structured_page_content` (dòng 768-796) xây dựng `asset_map` ánh xạ `image_id` (ví dụ `"fig_p1_1"`) với số câu hỏi gốc tìm thấy trực tiếp trong văn bản PDF (`curr_q_num` hoặc `next_qm`).

2. **`engines/quiz/quiz_pipeline.py:537-546` (`link_assets_to_questions` - Bước 2)**:
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
   - Bước 2 sử dụng chỉ số tuần tự `idx` của mảng `questions` để lấy `orig_q_num = source_nums[idx]`, sau đó đối chiếu với `mapped_num` trong `asset_map`.

3. **`engines/quiz/test_quiz_pipeline_v2.py:324-343` (`test_sequential_index_mapping_with_renumbered_questions`)**:
   - Test 15 kiểm tra câu hỏi đã bị đánh số lại thành 1, 2 nhưng `source_nums` là `[14, 15]`, và `asset_map` là `{"fig_p36_1": 14, "fig_p36_2": 15}`. Test xác nhận câu hỏi 1 và 2 nhận đúng ảnh tương ứng 14 và 15.

4. **`server/src/workers/quiz.worker.ts:74-87` (`cleanQuizErrorMessage`)**:
   ```typescript
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
   ```
   - Match regex nhóm 1 dừng lại trước dấu phẩy hoặc dấu chấm `([^,\.]+)`.
   - Tại `quiz_pipeline.py:2018-2021`:
     ```python
     if any(k in err_msg.lower() for k in ["không có câu hỏi", "không tìm thấy câu hỏi", "no questions"]):
         sys.stderr.write("Không có câu hỏi trong trang, vui lòng chọn lại.\n")
     ```
     Đoạn mã hiện tại vô tình ghi đè `desc` cụ thể thành chữ `"trang"`.

5. **`engines/quiz/test_quiz_pipeline_v2.py` (22 test hiện có)**:
   - Đã chạy kiểm thử thực tế qua lệnh:
     `python engines/quiz/test_quiz_pipeline_v2.py`
     Kết quả: `Ran 22 tests in 0.098s - OK`.
   - File test import trực tiếp từ `quiz_pipeline`:
     `from quiz_pipeline import sort_blocks_by_layout, cluster_rects, extract_visual_assets, table_to_markdown, extract_tables_with_structure, stitch_cross_page_text, chunk_questions_sliding_window, link_assets_to_questions, format_tables_in_text, generate_worksheet_html, generate_answer_key_html, normalize_question, clean_image_markers, is_running_header_or_footer, is_section_banner, extract_structured_page_content`
   - Test 7 (`test_sliding_window_chunking`) và Test 20 (`test_chunk_questions_sliding_window_strips_trailing_section_banner`) gọi trực tiếp `chunk_questions_sliding_window`.
   - Test 18 (`test_is_section_banner_detection`) gọi trực tiếp `is_section_banner`.
   - Test 14 (`test_marker_purged_on_direct_match`) gọi trực tiếp `clean_image_markers`.

6. **Môi trường Server (`server/`)**:
   - `npm run build` (`tsc`): Hoàn thành với mã thoát 0 (0 lỗi).
   - `npx vitest run`: 45 test files passed (45/45), 494 tests passed (494/494).

---

## 2. Logic Chain

1. **Từ Quan sát 1 & 2**:
   - `asset_map` lưu số câu gốc từ tài liệu PDF (ví dụ 14, 15), trong khi WP2 cưỡng chế đánh lại số câu đầu ra theo thứ tự `start_num .. start_num + n - 1` (ví dụ 1, 2).
   - Do đó, Tầng 3 (Layout Spatial Map so khớp `mapped_q_num == q['number']`) sẽ không khớp.
   - Cơ chế bảo toàn duy nhất là Tầng 2 (Sequential Index Mapping): vị trí `idx` của mảng `questions` phải ánh xạ chính xác tới số câu gốc `source_nums[idx]`.

2. **Từ Quan sát 1, 2 & 3**:
   - Nếu trong `run_pipeline`, ta phân tích cú pháp một lần duy nhất qua `parsed_blocks = parse_mcq_blocks(raw_text)`, ta có được chính xác `b["source_number"]` của từng khối câu hỏi thực tế.
   - Khi giới hạn `effective_count = min(count, len(parsed_blocks))`, danh sách số câu gốc tương ứng chính xác với các câu được chọn là `source_q_nums = [b["source_number"] for b in parsed_blocks][:effective_count]`.
   - Bằng cách truyền danh sách `source_q_nums` này vào `link_assets_to_questions(questions, extracted_assets, asset_map, source_q_nums)`, chỉ số `idx` của câu hỏi thứ `idx` sẽ đối chiếu đúng 100% với `asset_map`, hoàn toàn thỏa mãn ràng buộc đã được chứng minh trong Test 15.

3. **Từ Quan sát 1 & Logic 2**:
   - Để tránh việc `parse_and_standardize_questions` phải chạy lại regex lặp vô ích trên `raw_text`, ta thêm tham số tùy chọn:
     `parsed_blocks: list[dict] | None = None`.
   - Khi được gọi từ `run_pipeline`, nó tái sử dụng `parsed_blocks` đã tính.
   - Khi được gọi độc lập từ test case cũ hoặc script ngoài mà không truyền `parsed_blocks`, tham số mang giá trị `None` và hàm sẽ tự động gọi `parse_mcq_blocks(raw_text)`. Tính tương thích ngược được bảo toàn 100%.

4. **Từ Quan sát 4**:
   - Node worker `cleanQuizErrorMessage` bắt lỗi bằng regex `không\s*(?:có|tìm\s*thấy)\s*câu\s*hỏi\s*trong\s*([^,\.]+)`.
   - Nếu `quiz_pipeline.py` ném `RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")` và ghi nguyên văn ra stderr (`sys.stderr.write(f"{err_msg}\n")`), regex của Worker sẽ trích xuất trọn vẹn `{desc}` (ví dụ `"Trang 11"` hoặc `"trang đã chọn"`) và phản hồi chính xác đến giao diện người dùng.

5. **Từ Quan sát 5**:
   - Di chuyển 3 hàm `is_section_banner`, `strip_section_banner`, `clean_image_markers` sang `text_utils.py` đòi hỏi `quiz_pipeline.py` phải **re-export** 3 hàm này để các bài kiểm thử hiện có không bị lỗi `ImportError`.
   - Hàm `chunk_questions_sliding_window` bắt buộc phải được giữ lại trong `quiz_pipeline.py` (không được xóa) để Test 7 và Test 20 không bị đỏ.

---

## 3. Caveats

1. **KaTeX Offline (WP5)**: KaTeX hiện tại vẫn đang trỏ về CDN trong các template HTML và sẽ được xử lý ở Milestone sau (WP5). Các kiểm thử trong WP1 và WP2 không được chỉnh sửa KaTeX URL.
2. **Batch Concurrency (WP3)**: Việc chuyển sang đa luồng 4 worker và giảm batch size xuống 5 câu là phạm vi của WP3. Trong WP1 và WP2, cấu trúc batch vẫn giữ nguyên hoặc chuẩn bị sẵn sàng cho WP3.
3. **Môi trường Console Windows**: Khi chạy unit test trên Windows terminal, console mặc định có thể là cp1252. File test mới `test_mcq_parser.py` bắt buộc phải có block `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`.

---

## 4. Conclusion

1. **Điểm nối ghép hình ảnh & run_pipeline**:
   - Thêm tham số `parsed_blocks: list[dict] | None = None` vào `parse_and_standardize_questions`.
   - Trong `run_pipeline`, trích xuất `parsed_blocks = parse_mcq_blocks(raw_text)`, tính `source_q_nums = [b["source_number"] for b in parsed_blocks][:effective_count]`, và truyền trực tiếp vào `link_assets_to_questions`.
   - Giữ nguyên marker `[IMAGE_REF: ...]` trong trường `"stem"` của `parsed_blocks` cho đến khi `link_assets_to_questions` hoàn tất làm sạch ở cuối pipeline.
2. **Hợp đồng lỗi với Worker**:
   - Sử dụng định dạng chuẩn `RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")` (với `desc = pages_desc or "trang đã chọn"`).
   - In trực tiếp `sys.stderr.write(f"{err_msg}\n")` trong khối ngoại lệ CLI của `quiz_pipeline.py`.
3. **An toàn kiểm thử (0 Regression)**:
   - Toàn bộ 22 test trong `test_quiz_pipeline_v2.py` được đóng băng tuyệt đối.
   - Đảm bảo re-export các hàm được di chuyển và giữ lại các hàm trích xuất cũ.
   - Thêm 3 test mới ở cuối file để bảo vệ hành vi mới của WP2.

---

## 5. Verification Method

Để thẩm định độc lập và kiểm tra kết quả sau khi triển khai Milestone 1:

1. **Kiểm thử bộ Parser mới (WP1)**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   ```
   *Tiêu chí*: Tối thiểu 11 unit test pass 100%, 0 fail, 0 skip.

2. **Kiểm thử hồi quy toàn bộ Pipeline Engine (WP1 & WP2)**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Tiêu chí*: 22 test cũ pass nguyên vẹn + 3 test mới của WP2 pass (Tổng 25 tests, 0 fail, 0 error).

3. **Kiểm thử biên dịch Server Backend Gateway**:
   ```bash
   cd server && npm run build
   ```
   *Tiêu chí*: TypeScript biên dịch thành công, đúng 0 lỗi (Exit Code 0).

4. **Kiểm thử tích hợp Server**:
   ```bash
   cd server && npx vitest run
   ```
   *Tiêu chí*: Toàn bộ 45 test files (494 tests) pass 100%.

5. **Điều kiện vô hiệu hóa (Invalidation Conditions)**:
   - Nếu bất kỳ test nào trong 22 test cũ bị sửa đổi, xóa bỏ hoặc skip -> Vi phạm quy chuẩn.
   - Nếu `source_q_nums` truyền vào `link_assets_to_questions` là danh sách số đánh lại (`1..n`) thay vì số gốc (`parsed_blocks["source_number"]`) -> Test 15 hoặc tính năng map ảnh thực tế sẽ thất bại.
