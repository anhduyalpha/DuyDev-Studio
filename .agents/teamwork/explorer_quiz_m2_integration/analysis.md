# Phân Tích Tích Hợp Kỹ Thuật: WP3 (Micro-Batching Song Song) & WP8 (Retry & Security)

## 1. TỔNG QUAN KIẾN TRÚC & PHẠM VI TÍCH HỢP

Milestone 2 tập trung vào hai Work Package then chốt của Quiz Pipeline v3.0:
1. **WP3 (Parallel Micro-Batching)**: Tách khối câu hỏi thành các micro-batch nhỏ (kích thước `BATCH_SIZE = 5`), chạy song song qua `concurrent.futures.ThreadPoolExecutor` với tối đa `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))` luồng.
2. **WP8 (Smart Retry & Security)**: Xóa triệt để API key hardcode trong source (`DEFAULT_API_KEY`), chuẩn hóa timeout 90s, tái tạo request linh hoạt trong vòng lặp retry (điều chỉnh `temperature: 0.0` và compact prompt khi lỗi JSON), cứu vãn JSON bị cắt ngắn (`_salvage_truncated_json`), và fast-fail khi gặp HTTP 401.

Tích hợp giữa WP3 và WP8 là điểm giao nhau cốt lõi giữa **lớp điều phối song song (Orchestration Layer)** và **lớp thực thi mạng/AI phòng thủ (Defensive Transport Layer)**.

---

## 2. MA TRẬN TƯƠNG TÁC GIỮA `_run_batch` (WP3) VÀ `call_agnes_api` (WP8)

### 2.1 Luồng Gọi Hàm (Call Flow)
```
parse_and_standardize_questions (Main Thread)
  │
  ├── Chốt effective_count & chia windows [5 câu/gói] (kế thừa từ WP2)
  │
  ├── ThreadPoolExecutor(max_workers=MAX_PARALLEL)
  │     │
  │     ├── Worker Thread 0: _run_batch(0) ──► call_agnes_api(..., timeout=90)
  │     ├── Worker Thread 1: _run_batch(1) ──► call_agnes_api(..., timeout=90)
  │     ├── Worker Thread 2: _run_batch(2) ──► call_agnes_api(..., timeout=90)
  │     └── Worker Thread 3: _run_batch(3) ──► call_agnes_api(..., timeout=90)
  │
  ├── as_completed(fut_map) (Main Thread)
  │     ├── Ghi nhận results[i] hoặc errors[i]
  │     └── emit_progress(thread-safe với _EMIT_LOCK)
  │
  ├── Graceful Degradation: lấp chỗ trống gói lỗi bằng parsed_blocks & _guess_answer_from_raw
  │
  └── Dedup stem SHA1, clamp effective_count, cưỡng chế đánh số tuần tự (WP2)
```

### 2.2 Đồng Bộ Hóa Timeout (90s Alignment)
- **Vấn đề tiềm ẩn**: Trước đây `call_agnes_api` có `timeout: int = 180`. Nếu một luồng bị treo mạng, 3 lần retry có thể tốn gần 9,5 phút.
- **Giải pháp đồng bộ**:
  1. Trong WP8, default signature của `call_agnes_api` được rút từ `180` xuống `90`.
  2. Trong WP3, `_run_batch` gọi `call_agnes_api(..., timeout=90)`.
  3. Cả hai lớp thống nhất tuyệt đối timeout 90s cho mỗi HTTP request. Với kích thước micro-batch 5 câu, thời gian phản hồi trung bình của Agnes 3.0 Flash chỉ từ 3-8s. Mức trần 90s cung cấp hệ số an toàn >10x mà không làm đọng luồng quá lâu.
- **Tính toán Worst-Case**:
  - Với 1 batch: `(90s * 3 attempts) + 2s sleep + 4s sleep = ~276s`.
  - Nhờ có 4 luồng song song, các batch khác không bị nghẽn bởi timeout của một batch cá biệt.

### 2.3 An Toàn Đa Luồng (Thread-Safety Guarantees)
1. **Thread-Safe `emit_progress`**:
   - `quiz.worker.ts:123-138` parse từng dòng stdout là một JSON object độc lập.
   - Nếu 2 luồng cùng in ra stdout đồng thời, buffer stdout có thể bị xen kẽ (interleaved output), dẫn tới vỡ JSON và làm đứt gãy luồng Server-Sent Events (SSE).
   - Khắc phục bắt buộc: Thêm `_EMIT_LOCK = threading.Lock()` tại cấp module. Mọi lệnh `print` trong `emit_progress` phải bọc trong `with _EMIT_LOCK: print(payload, flush=True)`.
2. **Không có Race Condition trên Shared State**:
   - Mảng `results: list[list[dict] | None] = [None] * len(batches)` và từ điển `errors: dict[int, Exception] = {}` **chỉ được ghi từ Main Thread** trong vòng lặp `as_completed(fut_map)`.
   - Các worker thread trong `ThreadPoolExecutor` chỉ đọc các cấu trúc dữ liệu bất biến (`batches[b_idx]`, `windows[b_idx]`, `api_key`, `system_prompt`) và trả về danh sách câu hỏi qua `fut.result()`.
   - `_run_batch` hoàn toàn thuần túy (pure function) đối với trạng thái toàn cục, không ghi vào bất kỳ biến dùng chung nào.
3. **Re-entrancy của `call_agnes_api`**:
   - Toàn bộ biến bên trong `call_agnes_api` (`payload_data`, `req`, `attempt`, `current_temp`, `current_prompt`) là local variables trên stack của từng luồng.
   - Lệnh `time.sleep` khi retry giải phóng Python Global Interpreter Lock (GIL), cho phép các luồng khác tiếp tục thực thi CPU-bound và I/O-bound tasks mượt mà.

---

## 3. PHÂN CẤP XỬ LÝ LỖI & CHÍNH SÁCH SUY THOÁI CÓ KIỂM SOÁT

Hệ thống xử lý lỗi được phân thành 3 cấp độ phòng thủ:

| Cấp Độ | Vị Trí | Cơ Chế Xử Lý | Hành Vi Hệ Thống |
|---|---|---|---|
| **Cấp 1: Transport & JSON** | `call_agnes_api` | - HTTP 401: Ném `RuntimeError` ngay lập tức, **không retry**.<br>- HTTP 429/5xx: Exponential backoff (`2.0 * (attempt + 1)`), retry tối đa 2 lần.<br>- `json.JSONDecodeError`: Gọi `_salvage_truncated_json`. Nếu cứu được $\ge 1$ câu $\rightarrow$ trả về kết quả; nếu không cứu được $\rightarrow$ retry với `temperature: 0.0` và compact prompt. | Giải quyết ngay trong luồng mạng mà không làm phiền tầng trên. |
| **Cấp 2: Batch Concurrency** | `parse_and_standardize_questions` | - Nếu toàn bộ các batch đều fail (`len(errors) == len(batches)`): Ném lỗi đầu tiên với message tiếng Việt gốc.<br>- Nếu một phần batch fail: **Không crash job**. Gói lỗi được thay thế bằng raw blocks từ `windows[i]` thông qua `_guess_answer_from_raw`.<br>- Batch trả về rỗng `{"questions": []}`: Xử lý như gói lỗi, kích hoạt fallback. | Đảm bảo nguyên tắc: "Thà đề thô mà đủ câu, hơn là làm sập cả job". |
| **Cấp 3: Data Assembly** | `parse_and_standardize_questions` | - Dedup theo SHA1 fingerprint của stem.<br>- Clamp về `effective_count`.<br>- Cưỡng chế đánh số tuần tự từ `start_num`. | Đảm bảo tính toàn vẹn 100% của đề bài đầu ra (kế thừa từ WP2). |

### 3.1 Chi Tiết Thuật Toán `_salvage_truncated_json`
```python
def _salvage_truncated_json(raw: str) -> dict | None:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict) and "questions" in data:
            return data
    except Exception:
        pass

    q_marker = cleaned.find('"questions"')
    if q_marker == -1:
        return None
    arr_start = cleaned.find('[', q_marker)
    if arr_start == -1:
        return None

    in_str = False
    escape = False
    brace_depth = 0
    bracket_depth = 1
    last_valid_q_end = -1

    i = arr_start + 1
    while i < len(cleaned):
        ch = cleaned[i]
        if escape:
            escape = False
        elif ch == '\\':
            escape = True
        elif ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
                if brace_depth == 0 and bracket_depth == 1:
                    last_valid_q_end = i
            elif ch == '[':
                bracket_depth += 1
            elif ch == ']':
                bracket_depth -= 1
        i += 1

    if last_valid_q_end == -1:
        return None

    candidate = cleaned[:last_valid_q_end + 1].rstrip().rstrip(",") + "\n]}"
    try:
        data = json.loads(candidate)
        if isinstance(data, dict) and "questions" in data and len(data["questions"]) > 0:
            return data
    except Exception:
        pass
    return None
```
- **Nguyên lý**: Tokenizer duyệt chuỗi từ đầu mảng `"questions"`, theo dõi độ sâu ngoặc nhọn `{}` và ngoặc vuông `[]` (bỏ qua ký tự bên trong string literals và escapes). Vị trí `}` cuối cùng đưa `brace_depth` về 0 ở cấp độ `bracket_depth == 1` chính là biên đóng của object câu hỏi hoàn chỉnh cuối cùng. Cắt chuỗi tại đó, bỏ dấu phẩy thừa, đóng `\n]}` và parse lại.

---

## 4. BẢO MẬT & API KEY HYGIENE

1. **Xóa Key Hardcode**:
   - `quiz_pipeline.py:41` hiện tại:
     ```python
     DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "sk-zsaZ9jZjzOk9V5rQj4CxkWO3q5AOmRtG3puwUW5SiiI5NCoK")
     ```
   - Sửa thành:
     ```python
     DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")
     ```
   - Khảo sát toàn diện thư mục `engines/quiz/` xác nhận: dòng 41 này là vị trí DUY NHẤT tồn tại key `sk-...`.
2. **Khử Rò Rỉ Key Trong Thông Báo Lỗi**:
   - Trong `call_agnes_api`, khi bắt `urllib.error.HTTPError`, chuỗi `err_msg` từ server upstream cần được kiểm tra: nếu chứa `api_key`, lập tức thay thế bằng `[REDACTED_API_KEY]`.
3. **Cảnh Báo Vận Hành**:
   - Key `sk-zsaZ9j...` đã nằm trong git history. Sau khi merge code mới, khuyến nghị chủ dự án thu hồi (revoke/rotate) key này trên dashboard Agnes AI.

---

## 5. TÍCH HỢP BỘ TEST & KẾ HOẠCH BẢO VỆ 25 TEST HIỆN CÓ

### 5.1 Hiện Trạng Bộ Test
- `test_quiz_pipeline_v2.py` hiện có **25 test case** (22 legacy + 3 WP2 tests).
- Chạy thực tế: `python engines/quiz/test_quiz_pipeline_v2.py` $\rightarrow$ **25 passed in 0.094s (100% OK)**.
- Không có bất kỳ test nào bị hỏng hay phụ thuộc vào hardcoded key.

### 5.2 Kế Hoạch 10 Test Mới (5 WP3 + 5 WP8)
Các test mới sẽ được thêm vào cuối class `TestQuizPipelineV2` trong `test_quiz_pipeline_v2.py`:

```
TestQuizPipelineV2 (Tổng: 35 tests)
├── 22 Legacy Tests (Module 1.1 - 1.7) [ĐÓNG BĂNG]
├── 3 WP2 Tests (Fix nhân đôi, tuần tự, fast-fail 0 câu) [ĐÓNG BĂNG]
├── 5 WP3 Tests:
│   ├── test_batches_run_in_parallel
│   ├── test_result_order_independent_of_completion_order
│   ├── test_partial_batch_failure_degrades_gracefully
│   ├── test_all_batches_failure_raises
│   └── test_emit_progress_is_thread_safe
└── 5 WP8 Tests:
    ├── test_salvage_truncated_json_recovers_complete_objects
    ├── test_salvage_returns_none_on_unrecoverable
    ├── test_retry_uses_zero_temperature_after_json_error
    ├── test_http_401_does_not_retry
    └── test_no_hardcoded_api_key_in_source
```

---

## 6. THIẾT KẾ CHI TIẾT 10 UNIT TESTS

### Nhóm WP3:
1. `test_batches_run_in_parallel`:
   - Mock `call_agnes_api` với `time.sleep(1.0)`.
   - Sinh `raw_text` gồm 20 câu hỏi (tạo ra đúng 4 batches với `BATCH_SIZE = 5`).
   - Chạy với `QUIZ_AI_CONCURRENCY=4`.
   - Đo `elapsed_time`: nếu tuần tự sẽ mất $\ge 4.0s$; song song 4 luồng sẽ hoàn thành trong $\approx 1.05s$.
   - Assert `elapsed < 2.0s`.
2. `test_result_order_independent_of_completion_order`:
   - Chuẩn bị text 10 câu (2 batches).
   - Mock `call_agnes_api`: batch 0 (chứa Q1) `sleep(0.3s)`, batch 1 (chứa Q6) `sleep(0.05s)`.
   - Batch 1 hoàn thành trước batch 0.
   - Assert thứ tự câu trong kết quả cuối cùng vẫn giữ nguyên từ 1 đến 10 (`[q["number"] for q in res] == list(range(1, 11))`).
3. `test_partial_batch_failure_degrades_gracefully`:
   - Chuẩn bị text 10 câu (2 batches).
   - Mock `call_agnes_api`: batch 0 thành công; batch 1 ném `RuntimeError("Network failure")`.
   - Gọi `parse_and_standardize_questions`.
   - Assert job không bị crash, kết quả trả về đủ 10 câu (`len(result) == 10`).
   - Các câu 6..10 có `explanation == ""` và giữ nguyên stem từ `windows[1]`.
4. `test_all_batches_failure_raises`:
   - Chuẩn bị text 10 câu.
   - Mock `call_agnes_api` luôn ném `RuntimeError("Agnes AI service unavailable")`.
   - Assert gọi `parse_and_standardize_questions` ném `RuntimeError` chứa `"Agnes AI service unavailable"`.
5. `test_emit_progress_is_thread_safe`:
   - Tạo 50 luồng đồng thời gọi `emit_progress(i, f"stage {i}")`.
   - Bắt stdout bằng `unittest.mock.patch("sys.stdout", new_callable=io.StringIO)`.
   - Chờ tất cả luồng kết thúc, phân tích từng dòng output.
   - Assert tất cả 50 dòng đều parse được bằng `json.loads` mà không gặp bất kỳ lỗi `JSONDecodeError` nào.

### Nhóm WP8:
6. `test_salvage_truncated_json_recovers_complete_objects`:
   - Tạo payload chuỗi JSON bị đứt đoạn sau 3 object hoàn chỉnh và object thứ 4 dở dang.
   - Gọi `_salvage_truncated_json(truncated_str)`.
   - Assert trả về dict có `len(res["questions"]) == 3`.
7. `test_salvage_returns_none_on_unrecoverable`:
   - Tạo payload chuỗi JSON bị đứt đoạn ngay trong object đầu tiên (`{"questions": [{"number": 1, "question": ...`).
   - Gọi `_salvage_truncated_json(broken_str)`.
   - Assert trả về `None`.
8. `test_retry_uses_zero_temperature_after_json_error`:
   - Mock `urllib.request.urlopen`: lần 1 trả response với nội dung JSON hỏng không cứu được; lần 2 trả JSON hợp lệ `{"questions": []}`.
   - Gọi `call_agnes_api(api_key="key", prompt="test prompt", system_prompt="sys")`.
   - Kiểm tra `mock_urlopen.call_args_list`:
     - Lần 1: payload có `temperature == 0.1` và `prompt == "test prompt"`.
     - Lần 2: payload có `temperature == 0.0` và prompt có chứa chuỗi `"Chỉ trả JSON compact, không markdown fence, không giải thích thêm."`.
9. `test_http_401_does_not_retry`:
   - Mock `urllib.request.urlopen` ném `urllib.error.HTTPError(..., code=401, ...)`.
   - Gọi `call_agnes_api(...)`.
   - Assert ném `RuntimeError` và `mock_urlopen.call_count == 1` (không retry thêm lần nào).
10. `test_no_hardcoded_api_key_in_source`:
    - Đọc file `engines/quiz/quiz_pipeline.py`.
    - Assert `re.search(r"sk-[A-Za-z0-9]{20,}", content)` là `None`.

---

## 7. BẢN THI CÔNG CHI TIẾT DÀNH CHO WORKER (BLUEPRINT FOR WORKER)

### 7.1 File: `engines/quiz/quiz_pipeline.py`

#### (A) Dòng 41: Bỏ hardcode key
```python
# TRƯỚC:
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "sk-zsaZ9jZjzOk9V5rQj4CxkWO3q5AOmRtG3puwUW5SiiI5NCoK")

# SAU:
DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")
```

#### (B) Dòng 44-51: Khóa đa luồng `emit_progress`
```python
# THÊM BIẾN TOÀN CỤC TRƯỚC emit_progress:
_EMIT_LOCK = threading.Lock()

def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming (thread-safe)."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        with _EMIT_LOCK:
            print(payload, flush=True)
    except Exception:
        pass
```

#### (C) Trước `call_agnes_api`: Thêm `_salvage_truncated_json`
```python
def _salvage_truncated_json(raw: str) -> dict | None:
    """
    Cứu JSON bị cắt giữa mảng 'questions': cắt tới object hoàn chỉnh cuối cùng,
    đóng ngoặc ']}' rồi parse lại. Trả None nếu không cứu được.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict) and "questions" in data:
            return data
    except Exception:
        pass

    q_marker = cleaned.find('"questions"')
    if q_marker == -1:
        return None
    arr_start = cleaned.find('[', q_marker)
    if arr_start == -1:
        return None

    in_str = False
    escape = False
    brace_depth = 0
    bracket_depth = 1
    last_valid_q_end = -1

    i = arr_start + 1
    while i < len(cleaned):
        ch = cleaned[i]
        if escape:
            escape = False
        elif ch == '\\':
            escape = True
        elif ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
                if brace_depth == 0 and bracket_depth == 1:
                    last_valid_q_end = i
            elif ch == '[':
                bracket_depth += 1
            elif ch == ']':
                bracket_depth -= 1
        i += 1

    if last_valid_q_end == -1:
        return None

    candidate = cleaned[:last_valid_q_end + 1].rstrip().rstrip(",") + "\n]}"
    try:
        data = json.loads(candidate)
        if isinstance(data, dict) and "questions" in data and len(data["questions"]) > 0:
            return data
    except Exception:
        pass
    return None
```

#### (D) Dòng 820-883: Viết lại `call_agnes_api`
```python
def call_agnes_api(
    api_key: str,
    prompt: str,
    system_prompt: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    timeout: int = 90,
    max_retries: int = 2
) -> dict:
    """Send chat completion request to Agnes AI with JSON formatting, defensive retries, and timeout resilience."""
    current_temp = 0.1
    current_prompt = prompt
    last_err = None

    for attempt in range(max_retries + 1):
        payload_data = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": current_prompt}
            ],
            "temperature": current_temp,
            "response_format": {"type": "json_object"},
            "max_tokens": 8192
        }
        payload = json.dumps(payload_data).encode("utf-8")

        req = urllib.request.Request(
            f"{base_url.rstrip('/')}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "DDStudio-QuizPipeline/2.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                resp_bytes = resp.read()
                data = json.loads(resp_bytes.decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
                    cleaned = re.sub(r"\s*```$", "", cleaned)
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError as jde:
                    salvaged = _salvage_truncated_json(cleaned)
                    if salvaged is not None and isinstance(salvaged, dict) and salvaged.get("questions"):
                        return salvaged
                    if attempt < max_retries:
                        current_temp = 0.0
                        if "Chỉ trả JSON compact" not in current_prompt:
                            current_prompt = current_prompt + "\n\nChỉ trả JSON compact, không markdown fence, không giải thích thêm."
                        time.sleep(1.0 * (attempt + 1))
                        continue
                    raise RuntimeError(f"Lỗi phản hồi Agnes AI API (JSON không hợp lệ và không thể cứu): {jde}")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="replace")
            if api_key and api_key in err_msg:
                err_msg = err_msg.replace(api_key, "[REDACTED_API_KEY]")
            last_err = RuntimeError(f"Agnes AI API error (HTTP {e.code}): {err_msg}")
            if e.code == 401:
                raise last_err
            if e.code in (429, 500, 502, 503, 504) and attempt < max_retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise last_err
        except (TimeoutError, urllib.error.URLError, http.client.RemoteDisconnected) as e:
            last_err = RuntimeError(f"Không thể kết nối đến Agnes AI API (quá thời gian chờ {timeout}s hoặc lỗi mạng): {e}")
            if attempt < max_retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise last_err
        except Exception as e:
            last_err = RuntimeError(f"Lỗi phản hồi Agnes AI API: {e}")
            if attempt < max_retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise last_err

    raise last_err or RuntimeError("Không thể kết nối đến Agnes AI API sau nhiều lần thử lại")
```

#### (E) Thêm helper `_guess_answer_from_raw` & `_build_phase1_prompt` trước `parse_and_standardize_questions`:
```python
def _guess_answer_from_raw(raw: str) -> str:
    """Cố gắng tìm đáp án từ raw text segment, mặc định 'A' nếu không tìm thấy."""
    m = re.search(r"(?:đáp\s*án|answer)\s*[:\.]?\s*([A-D])\b", raw, re.IGNORECASE)
    return m.group(1).upper() if m else "A"


def _build_phase1_prompt(blocks: list[dict], b_start: int) -> str:
    """Tạo structured JSON prompt cho Phase 1 chuẩn hóa câu hỏi."""
    payload_blocks = []
    for off, blk in enumerate(blocks):
        item = {
            "number": b_start + off,
            "question": blk["stem"],
            "options": dict(blk["options"])
        }
        if blk.get("confidence") == "low":
            item["raw_fallback"] = blk.get("raw", "")
        payload_blocks.append(item)

    return (
        "Đã có sẵn cấu trúc câu hỏi dưới dạng JSON. Nhiệm vụ của bạn CHỈ LÀ:\n"
        "1. Chuẩn hoá công thức hoá học bằng HTML <sub>/<sup> (ví dụ C<sub>2</sub>H<sub>5</sub>OH, Fe<sup>3+</sup>).\n"
        "2. Chuẩn hoá biểu thức toán bằng $...$ (KaTeX).\n"
        "3. Giữ NGUYÊN mọi marker [IMAGE_REF: ...] và mọi bảng Markdown.\n"
        "4. Xác định đáp án đúng, trả về \"answer\" là một trong \"A\",\"B\",\"C\",\"D\".\n"
        "5. Nếu một mục có \"raw_fallback\", hãy dùng nó để sửa lại \"question\"/\"options\" cho đúng.\n\n"
        "KHÔNG viết lời giải. KHÔNG thêm câu. KHÔNG bớt câu. KHÔNG đổi giá trị \"number\".\n"
        'Trả về ĐÚNG JSON: {"questions":[{"number":int,"question":str,'
        '"options":{"A":str,"B":str,"C":str,"D":str},"answer":str,"image_ref":str|null}]}\n\n'
        "INPUT:\n"
        f"{json.dumps(payload_blocks, ensure_ascii=False)}"
    )
```

#### (F) Trong `parse_and_standardize_questions`: Thay vòng lặp threading tuần tự bằng `ThreadPoolExecutor`:
```python
    MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))

    def _run_batch(b_idx: int) -> list[dict]:
        b_start, b_end, b_count = batches[b_idx]
        w_blocks = windows[b_idx]
        user_prompt = _build_phase1_prompt(w_blocks, b_start)
        res = call_agnes_api(api_key, user_prompt, system_prompt,
                             base_url=base_url, model=model, timeout=90)
        return res.get("questions", [])

    results: list[list[dict] | None] = [None] * len(batches)
    errors: dict[int, Exception] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL) as ex:
        fut_map = {ex.submit(_run_batch, i): i for i in range(len(batches))}
        done_n = 0
        for fut in concurrent.futures.as_completed(fut_map):
            i = fut_map[fut]
            try:
                batch_res = fut.result()
                if not batch_res:
                    errors[i] = RuntimeError(f"Gói {i + 1} trả về danh sách câu hỏi rỗng từ AI.")
                else:
                    results[i] = batch_res
            except Exception as e:
                errors[i] = e
            done_n += 1
            emit_progress(
                int(45 + (done_n / len(batches)) * (72 - 45)),
                f"Đang chuẩn hóa {done_n}/{len(batches)} gói "
                f"({min(done_n * BATCH_SIZE, effective_count)}/{effective_count} câu)..."
            )

    if len(errors) == len(batches):
        first_err = errors[0] if 0 in errors else next(iter(errors.values()))
        raise first_err

    if errors:
        for i in errors:
            b_start, b_end, b_count = batches[i]
            fallback = []
            for off, blk in enumerate(windows[i]):
                fallback.append({
                    "number": b_start + off,
                    "type": "mcq",
                    "question": blk["stem"],
                    "options": dict(blk["options"]),
                    "answer": _guess_answer_from_raw(blk["raw"]),
                    "explanation": "",
                    "image_ref": None
                })
            results[i] = fallback
        emit_progress(72, f"Đã chuẩn hóa xong, {len(errors)} gói dùng bản trích xuất gốc...")

    for batch_qs in results:
        if batch_qs:
            for idx, q in enumerate(batch_qs):
                norm_q = normalize_question(q, fallback_num=start_num + len(all_questions))
                all_questions.append(norm_q)
```

---

## 8. KẾT LUẬN & SẴN SÀNG CHO WORKER

1. **Tính tương thích hoàn toàn**: Giữ nguyên public signatures, không làm thay đổi các assertion của 25 test hiện có.
2. **Loại bỏ điểm nghẽn**: Giải phóng pipeline khỏi tuần tự 180s timeout, chuyển sang song song 4 luồng với 90s timeout.
3. **Bảo mật tuyệt đối**: Xóa triệt để API key hardcode, ngăn chặn rò rỉ key trong error messages.
4. **Độ ổn định nâng cấp**: Thêm salvage JSON cắt ngắn, retry linh hoạt với `temperature: 0.0`, và graceful degradation đảm bảo không rớt đề.
