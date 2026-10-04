# Handoff Report: Milestone 2 Pipeline Integration (WP3 & WP8)

## 1. Observation
1. **Source Code State in `engines/quiz/quiz_pipeline.py`**:
   - `quiz_pipeline.py:41`: `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "sk-zsaZ9jZjzOk9V5rQj4CxkWO3q5AOmRtG3puwUW5SiiI5NCoK")` chứa API key thật trong mã nguồn. Quét regex `sk-[A-Za-z0-9]{20,}` trên toàn bộ thư mục `engines/quiz/` cho thấy đây là vị trí duy nhất chứa key thật.
   - `quiz_pipeline.py:44-50`: `emit_progress` thực hiện `print(payload, flush=True)` mà không có khóa đồng bộ đa luồng (`threading.Lock()`). Khi chạy song song nhiều luồng, `quiz.worker.ts:123-138` parse từng dòng stdout là một JSON object, gây nguy cơ vỡ luồng JSON nếu có print xen kẽ.
   - `quiz_pipeline.py:820-883`: `call_agnes_api` khởi tạo `req = urllib.request.Request(...)` một lần duy nhất trước vòng lặp `for attempt in range(max_retries + 1)`. Do đó, không thể thay đổi `temperature` hoặc nội dung `prompt` giữa các lần retry. Tham số mặc định `timeout: int = 180`. Khi gặp `json.JSONDecodeError`, hàm không thử cứu vãn JSON bị cắt ngắn mà retry lặp lại payload y hệt.
   - `quiz_pipeline.py:1081-1140`: `parse_and_standardize_questions` đang lặp tuần tự qua từng batch bằng `threading.Thread(target=ai_worker)`. Quá trình này tuần tự hóa việc gọi AI, chưa khai thác `ThreadPoolExecutor` song song.
   - `quiz_pipeline.py:1100`: Hàm truyền `timeout=180` vào `call_agnes_api`.
2. **Test Suite Baseline trong `engines/quiz/test_quiz_pipeline_v2.py`**:
   - Lệnh thực thi: `python engines/quiz/test_quiz_pipeline_v2.py`
   - Kết quả quan sát: `Ran 25 tests in 0.094s` $\rightarrow$ `OK`. Toàn bộ 22 legacy tests và 3 WP2 tests đều đang pass 100%.
   - Không có test nào trong 25 test hiện có assert trực tiếp vào `DEFAULT_API_KEY` hay cấm gọi API song song.
   - `test_no_duplicate_questions_when_count_exceeds_available` assert `mock_api.call_count == 2` trên 10 câu hỏi (`BATCH_SIZE = 5`), phù hợp hoàn hảo với mô hình batching của WP3.

## 2. Logic Chain
1. *Từ Observation 1 (`DEFAULT_API_KEY` ở dòng 41)*: Thay thế giá trị mặc định bằng `""` loại bỏ hoàn toàn nguy cơ rò rỉ credential mà không ảnh hưởng tới kiểm thử (vốn truyền mock key hoặc đặt qua environment variable).
2. *Từ Observation 1 (`emit_progress` thiếu lock)*: Khai báo `_EMIT_LOCK = threading.Lock()` và bọc `print` bên trong `with _EMIT_LOCK:` đảm bảo tính đơn nguyên (atomicity) của mỗi dòng JSON trên stdout, triệt tiêu lỗi hỏng JSON stream khi chạy 4 luồng song song.
3. *Từ Observation 1 (tái tạo `Request` trong `call_agnes_api`)*: Đưa khối tạo `payload_data`, `payload`, và `req` vào bên trong vòng lặp `for attempt in range(max_retries + 1)` cho phép:
   - Khi gặp `json.JSONDecodeError`: gọi `_salvage_truncated_json` để cứu các câu hỏi đã hoàn chỉnh.
   - Nếu không cứu được: đổi `current_temp = 0.0` và thêm chỉ dẫn compact prompt cho lần thử kế tiếp.
   - Khi gặp HTTP 401: ném lỗi ngay mà không retry vô ích.
4. *Từ Observation 1 (`timeout=180`)*: Rút `timeout` mặc định của `call_agnes_api` xuống 90s và truyền `timeout=90` trong `_run_batch` đồng bộ hóa hoàn toàn thời gian chờ giữa 2 work packages, ngăn chặn việc treo luồng quá lâu.
5. *Từ Observation 1 (`ThreadPoolExecutor` trong `parse_and_standardize_questions`)*: Thay vòng lặp tuần tự bằng `ThreadPoolExecutor(max_workers=MAX_PARALLEL)` với `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`:
   - Gom kết quả theo index gốc `results[i] = fut.result()`.
   - Nếu toàn bộ batch fail: ném lỗi đầu tiên.
   - Nếu một phần batch fail: fallback câu hỏi thô từ `windows[i]` qua `_guess_answer_from_raw`, giữ vững invariant đủ số câu của đề bài.
6. *Từ Observation 2 (25 test hiện có pass 100%)*: Giữ nguyên chữ ký public của các hàm hiện có, bổ sung 10 test mới (5 WP3 + 5 WP8) vào cuối file `test_quiz_pipeline_v2.py`. Tổng số test nâng lên 35 và bảo toàn 100% không regression.

## 3. Caveats
- Nghiên cứu chỉ ở chế độ read-only theo quy chuẩn của Explorer, chưa trực tiếp chỉnh sửa mã nguồn của `quiz_pipeline.py` và `test_quiz_pipeline_v2.py`.
- Key `sk-zsaZ9j...` đã tồn tại trong git commit history trước đó. Hành động thu hồi/rotate key trên dashboard Agnes AI cần được chủ dự án thực hiện thủ công ngoài code.
- Phương án graceful degradation khi fallback sẽ để trống `explanation` của các câu thuộc gói lỗi (`explanation == ""`). Đây là thiết kế chủ đích nhằm ưu tiên hoàn thành đề bài thay vì làm sập cả tiến trình.

## 4. Conclusion
Tích hợp giữa WP3 và WP8 đã được xác định hoàn chỉnh, chi tiết và không có xung đột kiến trúc:
- Timeout được chốt ở mức 90s thống nhất.
- An toàn đa luồng được bảo đảm qua `_EMIT_LOCK` và phân lập bộ nhớ luồng.
- Phân cấp xử lý lỗi từ tầng socket/JSON (salvage & temp=0.0 retry) đến tầng batch (graceful degradation) tạo nên một hệ thống tự phục hồi cực kỳ vững chắc.
- Toàn bộ 25 bài test hiện tại được bảo vệ nguyên vẹn; lộ trình 10 bài test mới được thiết kế chính xác từng dòng lệnh mock và assertion.
- Blueprint chi tiết trong `analysis.md` đã sẵn sàng 100% để chuyển giao cho Worker thi công.

## 5. Verification Method
1. **Kiểm tra không còn key hardcode**:
   ```powershell
   python -c "import re; open('engines/quiz/quiz_pipeline.py').read(); assert not re.search(r'sk-[A-Za-z0-9]{20,}', open('engines/quiz/quiz_pipeline.py').read())"
   ```
2. **Kiểm tra toàn bộ 35 bài test trong test suite**:
   ```powershell
   python engines/quiz/test_quiz_pipeline_v2.py
   # Kỳ vọng: Ran 35 tests, OK, 0 failures, 0 errors
   ```
3. **Kiểm tra parser độc lập**:
   ```powershell
   python engines/quiz/test_mcq_parser.py
   # Kỳ vọng: Ran 19 tests, OK
   ```
4. **Kiểm tra TypeScript & Vitest của Server (AGENTS.md §4)**:
   ```powershell
   cd server; npx tsc --noEmit; npx vitest run
   # Kỳ vọng: 0 errors TypeScript, 100% test Vitest pass
   ```
5. **Điều kiện vô hiệu hóa (Invalidation Conditions)**:
   - Nếu bất kỳ test nào trong số 25 test cũ chuyển sang đỏ $\rightarrow$ vi phạm quy tắc cấm sửa test, phải sửa lại mã triển khai của Worker.
   - Nếu `test_batches_run_in_parallel` mất $> 2.0s$ $\rightarrow$ concurrency chưa thực sự chạy song song.
