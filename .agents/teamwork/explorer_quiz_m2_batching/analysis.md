# Investigation & Architecture Analysis: Work Package 3 (Parallel Micro-Batching)

## 1. Executive Summary

In Quiz Pipeline v2.0/v3.0 of **DuyDev Studio (DS)**, AI question standardization accounted for **75–80%** of wall-clock processing time (~70–110s for 20 questions, and scaling past 3–4 minutes for 40+ questions). This was caused by sequential batch processing with large batch sizes (`BATCH_SIZE=12`), which not only ran slowly on a single thread but also risked token truncation against the model's `max_tokens: 8192` budget.

This analysis provides the complete architectural design and code specification for **Work Package 3 (WP3: Parallel Micro-Batching)** in `engines/quiz/quiz_pipeline.py`:
1. **Thread-Safe Telemetry (`emit_progress`)**: Enforces atomic line-oriented JSON emissions to `stdout` via `_EMIT_LOCK = threading.Lock()`, preventing line corruption and preserving compatibility with Node.js worker streaming (`server/src/workers/quiz.worker.ts`).
2. **True Concurrency (`ThreadPoolExecutor`)**: Replaces sequential polling threads with `concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL)` (`QUIZ_AI_CONCURRENCY`, default `4`), reducing AI wall-clock time by ~60–75%.
3. **Strict Index-Preserved Aggregation**: Solves non-deterministic completion order by pre-allocating indexed slots `results = [None] * len(batches)` mapped via `fut_map = {ex.submit(...): i}`, ensuring results are assembled strictly by index `0..n`.
4. **Controlled Graceful Degradation**: Protects jobs from partial failures. If a single micro-batch fails or returns empty, the pipeline extracts answers using `_guess_answer_from_raw()` and fills the slot with raw parsed blocks (`windows[i]`) rather than crashing the entire job. If all batches fail, it raises the original Vietnamese error.
5. **Phase 1 Prompt Streamlining**: Replaces unstructured raw text prompts with `_build_phase1_prompt()`, sending structured JSON payload (`number`, `question`, `options`, `raw_fallback`). Removes question boundary detection and explanation generation from Phase 1.
6. **5 Comprehensive Unit Tests**: Designed for `engines/quiz/test_quiz_pipeline_v2.py` verifying concurrency speedup, index ordering independence, partial failure fallback, all-batch failure escalation, and thread-safe stdout streaming.

---

## 2. Baseline & Codebase Context

- **Current State of Engine**:
  - WP1 (`text_utils.py`, `mcq_parser.py`) is already implemented and verified with 19 passing unit tests (`test_mcq_parser.py`).
  - WP2 (dedup via `_stem_fingerprint`, clamping to `effective_count`, sequential numbering override) is implemented in `quiz_pipeline.py:1047-1165` and verified with 25 passing unit tests (`test_quiz_pipeline_v2.py`) and 20 passing adversarial stress tests (`test_adversarial_wp2.py`).
  - However, lines 1081–1140 of `quiz_pipeline.py` still execute batches sequentially via a single `ai_thread = threading.Thread(...)` with a polling loop `while ai_thread.is_alive(): time.sleep(2.0)`.
  - Furthermore, `emit_progress` (lines 44–50) writes directly to `stdout` without a mutual exclusion lock (`Lock`).

- **External Interface Contracts**:
  - **Node.js Fastify Worker (`server/src/workers/quiz.worker.ts`)**:
    - Lines 122–138 read `child.stdout` line-by-line via `readline.createInterface`.
    - Parses each line via `JSON.parse(line.trim())`. If lines are interleaved by concurrent threads, `JSON.parse` crashes and progress events are dropped silently.
    - Lines 74–108 (`cleanQuizErrorMessage`) match Vietnamese error substrings:
      `Không có câu hỏi trong {pages_desc}, vui lòng chọn lại.`
      `không chứa văn bản dạng số/vector` / `ảnh scan thuần túy`
      `vượt quá tổng số`
  - **Frozen API Signatures (`AGENTS.md` & Plan §1.4)**:
    - `parse_and_standardize_questions(raw_text, api_key, count=20, start_num=1, base_url=..., model=..., pages_desc="", parsed_blocks=None)` must preserve its public signature.
    - `emit_progress(pct: int, stage: str) -> None` must preserve its signature and error safety (`try...except Exception: pass`).

---

## 3. Deep Dive: Investigation of Specific Areas

### 3.1. Thread-Safety in `emit_progress`

**Observation in codebase**:
`engines/quiz/quiz_pipeline.py:44-50`:
```python
def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        print(payload, flush=True)
    except Exception:
        pass
```

**Risk Analysis**:
Under `ThreadPoolExecutor(max_workers=4)`, multiple worker threads or background tasks may call `emit_progress()` concurrently. In CPython, while individual Python bytecode operations might have the GIL, low-level buffered I/O writes across threads without a lock can interleave chunks of stdout characters. Even worse, if stdout encoding or formatting encounters contention, output buffers can flush interleaved lines (e.g. `{"progress": 58, {"progress": 72...}`).

**Solution**:
Introduce a module-level lock `_EMIT_LOCK = threading.Lock()`:
```python
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
This guarantees strict serialization: every call to `emit_progress` acquires `_EMIT_LOCK`, outputs an atomic single-line JSON string followed by `\n`, flushes the buffer, and releases the lock.

---

### 3.2. Concurrency Architecture & Index-Ordered Aggregation

**Observation in codebase**:
In `quiz_pipeline.py:1081-1140`, a loop iterates over `enumerate(batches)` one-by-one:
```python
for b_idx, (b_start, b_end, b_count) in enumerate(batches):
    ...
    ai_thread = threading.Thread(target=ai_worker, daemon=True)
    ai_thread.start()
    while ai_thread.is_alive():
        ai_thread.join(timeout=2.0)
```
Each batch takes between 10s to 30s. For 20 questions (4 batches of 5), total runtime is 40s to 120s purely sequential.

**Proposed Solution**:
1. Helper `_run_batch(b_idx: int) -> list[dict]`:
   - Encapsulates execution for a single micro-batch.
   - Retrieves `batches[b_idx]` and `windows[b_idx]`.
   - Generates user prompt using `_build_phase1_prompt(windows[b_idx], b_start)`.
   - Calls `call_agnes_api(..., timeout=90)`.
   - Returns `res.get("questions", [])`.

2. Concurrency Control:
   - `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`.
   - `max_workers = min(MAX_PARALLEL, max(1, len(batches)))`.
   - Context manager `with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:` ensures clean thread cleanup.

3. Index-Ordered Slot Preservation:
   - `as_completed()` yields futures out-of-order as they finish over the network.
   - To prevent scrambles, pre-allocate indexed array: `results: list[list[dict] | None] = [None] * len(batches)`.
   - Map futures to indices: `fut_map = {ex.submit(_run_batch, i): i for i in range(len(batches))}`.
   - When future `fut` completes, assign `results[fut_map[fut]] = fut.result()`.
   - Final assembly iterates `for b_idx, batch_qs in enumerate(results):`, strictly maintaining original sequence order regardless of which thread finished first.

---

### 3.3. Controlled Graceful Degradation Policy

**Failure Modes**:
1. **Network drop or 500 error on one batch**: In current code, any exception in any batch raises immediately and aborts the entire job (throwing away all successful batches).
2. **AI returns empty `questions: []` on one batch**: In current code, an empty batch breaks out or raises `RuntimeError`, killing the job.
3. **All batches fail**: (e.g. invalid API key, complete outage).

**Degradation Strategy**:
1. If `fut.result()` raises an Exception, record `errors[i] = e`.
2. If `res = fut.result()` is empty (`not res`), record `errors[i] = RuntimeError(f"Gói câu hỏi số {i + 1} trả về danh sách rỗng.")`.
3. **All-Batches Failed (`len(errors) == len(batches)`)**:
   - Must fail fast.
   - Raise the first error: `raise errors[min(errors.keys())]`.
   - If the error is due to empty responses across all batches, preserve the Vietnamese error contract:
     `raise RuntimeError(f"Không có câu hỏi trong {pages_desc or 'trang đã chọn'}, vui lòng chọn lại.")`.
4. **Partial Failure (`0 < len(errors) < len(batches)`)**:
   - Do NOT abort the job.
   - For each failed batch index `i`, fallback to raw parsed blocks from `windows[i]`:
     ```python
     for off, blk in enumerate(windows[i]):
         fallback.append({
             "number": b_start + off,
             "type": "mcq",
             "question": blk["stem"] if isinstance(blk, dict) and "stem" in blk else str(blk),
             "options": dict(blk["options"]) if isinstance(blk, dict) and "options" in blk else {"A": "", "B": "", "C": "", "D": ""},
             "answer": _guess_answer_from_raw(blk["raw"] if isinstance(blk, dict) and "raw" in blk else ""),
             "explanation": "",
             "image_ref": None
         })
     results[i] = fallback
     ```
   - Emit warning stage: `emit_progress(72, f"Đã chuẩn hóa xong, {len(errors)} gói dùng bản trích xuất gốc...")`.

**Answer Guessing Helper `_guess_answer_from_raw`**:
```python
def _guess_answer_from_raw(raw: str) -> str:
    """Best-effort regex extraction of answer key from raw question segment. Defaults to 'A'."""
    if not raw or not isinstance(raw, str):
        return "A"
    m = re.search(r"(?:đáp\s*án|answer)\s*[:\.]?\s*([A-D])\b", raw, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return "A"
```

---

### 3.4. Phase 1 Prompt Engineering

**Design Principles**:
- Deterministic extraction in WP1 already separated question boundaries and options.
- The AI's sole responsibility in Phase 1 is:
  1. Sub/superscript chemical formulas (`C<sub>2</sub>H<sub>5</sub>OH`, `Fe<sup>3+</sup>`).
  2. KaTeX inline math (`$...$`).
  3. Preserving image markers (`[IMAGE_REF: ...]`) and markdown tables.
  4. Determining the correct answer letter ("A", "B", "C", "D").
  5. Recovering from `raw_fallback` if a block had `confidence="low"`.
- Explanations (`explanation`) are excluded from Phase 1 prompt, drastically saving output tokens and execution latency (explanation generation will be handled in WP4).

**Builder Function `_build_phase1_prompt`**:
```python
def _build_phase1_prompt(blocks: list[dict], b_start: int) -> str:
    """Build structured Phase 1 prompt for AI format standardization."""
    payload_blocks = []
    for off, blk in enumerate(blocks):
        if isinstance(blk, dict):
            item = {
                "number": b_start + off,
                "question": blk.get("stem", ""),
                "options": blk.get("options", {})
            }
            if blk.get("confidence") == "low":
                item["raw_fallback"] = blk.get("raw", "")
        else:
            item = {
                "number": b_start + off,
                "question": str(blk),
                "options": {}
            }
        payload_blocks.append(item)

    prompt = (
        "Đã có sẵn cấu trúc câu hỏi dưới dạng JSON. Nhiệm vụ của bạn CHỈ LÀ:\n"
        "1. Chuẩn hoá công thức hoá học bằng HTML <sub>/<sup> (ví dụ C<sub>2</sub>H<sub>5</sub>OH, Fe<sup>3+</sup>).\n"
        "2. Chuẩn hoá biểu thức toán bằng $...$ (KaTeX).\n"
        "3. Giữ NGUYÊN mọi marker [IMAGE_REF: ...] và mọi bảng Markdown.\n"
        "4. Xác định đáp án đúng, trả về \"answer\" là một trong \"A\",\"B\",\"C\",\"D\".\n"
        "5. Nếu một mục có \"raw_fallback\", hãy dùng nó để sửa lại \"question\"/\"options\" cho đúng.\n\n"
        "KHÔNG viết lời giải. KHÔNG thêm câu. KHÔNG bớt câu. KHÔNG đổi giá trị \"number\".\n"
        "Trả về ĐÚNG JSON: {\"questions\":[{\"number\":int,\"question\":str,\"options\":{\"A\":str,\"B\":str,\"C\":str,\"D\":str},\"answer\":str,\"image_ref\":str|null}]}\n\n"
        "INPUT:\n"
        f"{json.dumps(payload_blocks, ensure_ascii=False)}"
    )
    return prompt
```

---

## 4. Proposed Concrete Code Diffs

### 4.1. Changes to `engines/quiz/quiz_pipeline.py`

#### Diff Chunk 1: `_EMIT_LOCK` and thread-safe `emit_progress` (lines 40–50)
```python
<<<<
def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        print(payload, flush=True)
    except Exception:
        pass
====
_EMIT_LOCK = threading.Lock()


def emit_progress(pct: int, stage: str) -> None:
    """Emit JSON formatted progress to stdout for worker streaming (thread-safe)."""
    try:
        payload = json.dumps({"progress": pct, "stage": stage}, ensure_ascii=False)
        with _EMIT_LOCK:
            print(payload, flush=True)
    except Exception:
        pass
>>>>
```

#### Diff Chunk 2: Add `_guess_answer_from_raw` and `_build_phase1_prompt` helpers (before `parse_and_standardize_questions`, ~line 1004)
```python
<<<<
def _stem_fingerprint(q: dict) -> str:
    plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
    plain = re.sub(r"^\s*(?:câu\s*\d+[\.\:\s]*|\d+[\.\:]\s*)", "", plain, flags=re.IGNORECASE)
    plain = re.sub(r"\s+", "", plain).lower()
    return hashlib.sha1(plain.encode("utf-8")).hexdigest()


def parse_and_standardize_questions(
====
def _stem_fingerprint(q: dict) -> str:
    plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
    plain = re.sub(r"^\s*(?:câu\s*\d+[\.\:\s]*|\d+[\.\:]\s*)", "", plain, flags=re.IGNORECASE)
    plain = re.sub(r"\s+", "", plain).lower()
    return hashlib.sha1(plain.encode("utf-8")).hexdigest()


def _guess_answer_from_raw(raw: str) -> str:
    """Best-effort regex extraction of answer key from raw question segment. Defaults to 'A'."""
    if not raw or not isinstance(raw, str):
        return "A"
    m = re.search(r"(?:đáp\s*án|answer)\s*[:\.]?\s*([A-D])\b", raw, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    return "A"


def _build_phase1_prompt(blocks: list[dict], b_start: int) -> str:
    """Build structured Phase 1 prompt for AI format standardization."""
    payload_blocks = []
    for off, blk in enumerate(blocks):
        if isinstance(blk, dict):
            item = {
                "number": b_start + off,
                "question": blk.get("stem", ""),
                "options": blk.get("options", {})
            }
            if blk.get("confidence") == "low":
                item["raw_fallback"] = blk.get("raw", "")
        else:
            item = {
                "number": b_start + off,
                "question": str(blk),
                "options": {}
            }
        payload_blocks.append(item)

    prompt = (
        "Đã có sẵn cấu trúc câu hỏi dưới dạng JSON. Nhiệm vụ của bạn CHỈ LÀ:\n"
        "1. Chuẩn hoá công thức hoá học bằng HTML <sub>/<sup> (ví dụ C<sub>2</sub>H<sub>5</sub>OH, Fe<sup>3+</sup>).\n"
        "2. Chuẩn hoá biểu thức toán bằng $...$ (KaTeX).\n"
        "3. Giữ NGUYÊN mọi marker [IMAGE_REF: ...] và mọi bảng Markdown.\n"
        "4. Xác định đáp án đúng, trả về \"answer\" là một trong \"A\",\"B\",\"C\",\"D\".\n"
        "5. Nếu một mục có \"raw_fallback\", hãy dùng nó để sửa lại \"question\"/\"options\" cho đúng.\n\n"
        "KHÔNG viết lời giải. KHÔNG thêm câu. KHÔNG bớt câu. KHÔNG đổi giá trị \"number\".\n"
        "Trả về ĐÚNG JSON: {\"questions\":[{\"number\":int,\"question\":str,\"options\":{\"A\":str,\"B\":str,\"C\":str,\"D\":str},\"answer\":str,\"image_ref\":str|null}]}\n\n"
        "INPUT:\n"
        f"{json.dumps(payload_blocks, ensure_ascii=False)}"
    )
    return prompt


def parse_and_standardize_questions(
>>>>
```

#### Diff Chunk 3: Streamline `system_prompt` and replace sequential loop with `ThreadPoolExecutor` and Graceful Degradation (lines 1019–1140)
```python
<<<<
    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to extract, standardize, and format multiple-choice quiz questions from the provided textbook/exam text.\n"
        "Requirements:\n"
        "1. Identify questions from 'Câu X' or 'X.' accurately in order of appearance.\n"
        "2. All questions are standard multiple-choice questions (MCQ) with 4 options: A, B, C, D. The answer MUST be 'A', 'B', 'C', or 'D'.\n"
        "3. Standardize chemical formulas using HTML tags: indices to <sub> (e.g. C<sub>2</sub>H<sub>5</sub>OH, H<sub>2</sub>SO<sub>4</sub>) and charges to <sup> (e.g. Fe<sup>3+</sup>).\n"
        "4. Standardize mathematical expressions using KaTeX/LaTeX delimiters: inline math between $...$ (e.g. $E = mc^2$, $\\int_0^1 f(x)dx$, $\\frac{-b \\pm \\sqrt{\\Delta}}{2a}$).\n"
        "5. Preserve visual assets: If the question contains an image marker '[IMAGE_REF: fig_pX_Y]' or refers to a figure, diagram, reaction scheme, chart, or spectrum, you MUST preserve 'image_ref': 'fig_pX_Y.png'. If none, set 'image_ref': null.\n"
        "6. Preserve structured tables: If the question or options contain a Markdown table (e.g. | col1 | col2 | ...), you MUST PRESERVE the entire Markdown table verbatim inside 'question' or 'explanation'. Do NOT flatten, compress, or convert tables into plain text.\n"
        "7. In 'explanation', provide a concise, accurate scientific explanation strictly in Vietnamese (1-3 sentences).\n"
        "8. Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "number": 1,\n'
        '      "type": "mcq",\n'
        '      "question": "Question text...",\n'
        '      "image_ref": "fig_p1_1.png",\n'
        '      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},\n'
        '      "explanation": "Concise scientific explanation...",\n'
        '      "answer": "A"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "9. If there are NO questions in the provided text, return {\"questions\": []}."
    )
...
    for b_idx, (b_start, b_end, b_count) in enumerate(batches):
        batch_prog_base = int(start_progress + b_idx * prog_step)

        w_blocks = windows[b_idx]
        w_text = "\n\n".join(
            b["raw"].strip() if isinstance(b, dict) and "raw" in b else str(b).strip()
            for b in w_blocks
        )
        user_prompt = (
            f"Extract up to {b_count} questions from the following text. "
            f"Extract them sequentially in order of appearance and assign sequential numbers from {b_start} to {b_end}:\n\n{w_text}"
        )

        res_holder = {}
        err_holder = {}

        def ai_worker():
            try:
                res_holder["data"] = call_agnes_api(
                    api_key, user_prompt, system_prompt, base_url=base_url, model=model, timeout=180
                )
            except Exception as e:
                err_holder["err"] = e

        ai_thread = threading.Thread(target=ai_worker, daemon=True)
        ai_thread.start()

        elapsed = 0
        current_p = batch_prog_base
        batch_label = f"gói {b_idx + 1}/{total_batches} (Câu {b_start} - {b_end})" if total_batches > 1 else f"{effective_count} câu"

        while ai_thread.is_alive():
            ai_thread.join(timeout=2.0)
            elapsed += 2
            if ai_thread.is_alive():
                if current_p < int(batch_prog_base + prog_step - 2):
                    current_p += 1
                emit_progress(current_p, f"Đang chuẩn hóa {batch_label} ({elapsed}s)...")

        if "err" in err_holder:
            raise err_holder["err"]

        res = res_holder.get("data", {})
        batch_qs = res.get("questions", [])
        if not batch_qs:
            if all_questions:
                break
            desc = pages_desc if pages_desc else "trang đã chọn"
            raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")

        for idx, q in enumerate(batch_qs):
            target_num = b_start + idx
            norm_q = normalize_question(q, fallback_num=target_num)
            all_questions.append(norm_q)

        emit_progress(
            int(start_progress + (b_idx + 1) * prog_step),
            f"Đã chuẩn hóa xong {batch_label} ({len(all_questions)}/{effective_count} câu)..."
        )
====
    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to standardize and format multiple-choice quiz questions from the provided textbook/exam JSON payload.\n"
        "Requirements:\n"
        "1. All questions are standard multiple-choice questions (MCQ) with 4 options: A, B, C, D. The answer MUST be 'A', 'B', 'C', or 'D'.\n"
        "2. Standardize chemical formulas using HTML tags: indices to <sub> (e.g. C<sub>2</sub>H<sub>5</sub>OH, H<sub>2</sub>SO<sub>4</sub>) and charges to <sup> (e.g. Fe<sup>3+</sup>).\n"
        "3. Standardize mathematical expressions using KaTeX/LaTeX delimiters: inline math between $...$ (e.g. $E = mc^2$, $\\int_0^1 f(x)dx$, $\\frac{-b \\pm \\sqrt{\\Delta}}{2a}$).\n"
        "4. Preserve visual assets: If the question contains an image marker '[IMAGE_REF: fig_pX_Y]' or refers to a figure, diagram, reaction scheme, chart, or spectrum, you MUST preserve 'image_ref': 'fig_pX_Y.png'. If none, set 'image_ref': null.\n"
        "5. Preserve structured tables: If the question or options contain a Markdown table (e.g. | col1 | col2 | ...), you MUST PRESERVE the entire Markdown table verbatim inside 'question'. Do NOT flatten, compress, or convert tables into plain text.\n"
        "6. Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "number": 1,\n'
        '      "type": "mcq",\n'
        '      "question": "Question text...",\n'
        '      "image_ref": "fig_p1_1.png",\n'
        '      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},\n'
        '      "answer": "A"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "7. If there are NO questions in the provided text, return {\"questions\": []}."
    )

    # (3) Slicing windows trực tiếp từ parsed_blocks
    windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]

    # (4) Bắt buộc 1-1, bỏ hoàn toàn fallback else raw_text
    assert len(windows) == len(batches), "windows và batches phải khớp 1-1"

    MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))

    def _run_batch(b_idx: int) -> list[dict]:
        """Gọi AI cho đúng một batch. Trả về list câu hỏi thô (chưa normalize)."""
        b_start, b_end, b_count = batches[b_idx]
        w_blocks = windows[b_idx]
        user_prompt = _build_phase1_prompt(w_blocks, b_start)
        res = call_agnes_api(
            api_key, user_prompt, system_prompt,
            base_url=base_url, model=model, timeout=90
        )
        return res.get("questions", [])

    results: list[list[dict] | None] = [None] * len(batches)
    errors: dict[int, Exception] = {}

    max_workers = min(MAX_PARALLEL, max(1, len(batches)))

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        fut_map = {ex.submit(_run_batch, i): i for i in range(len(batches))}
        done_n = 0
        for fut in concurrent.futures.as_completed(fut_map):
            i = fut_map[fut]
            try:
                res = fut.result()
                if not res:
                    errors[i] = RuntimeError(f"Gói câu hỏi số {i + 1} trả về danh sách rỗng.")
                else:
                    results[i] = res
            except Exception as e:
                errors[i] = e
            done_n += 1
            emit_progress(
                int(start_progress + (done_n / len(batches)) * (max_ai_progress - start_progress)),
                f"Đang chuẩn hóa {done_n}/{len(batches)} gói "
                f"({min(done_n * BATCH_SIZE, effective_count)}/{effective_count} câu)..."
            )

    # Nếu tất cả các gói đều thất bại -> raise lỗi đầu tiên
    if len(errors) == len(batches):
        first_idx = min(errors.keys())
        first_err = errors[first_idx]
        if isinstance(first_err, RuntimeError) and "trả về danh sách rỗng" in str(first_err):
            desc = pages_desc or "trang đã chọn"
            raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
        raise first_err

    # Degradation có kiểm soát: lấp chỗ trống cho các batch bị lỗi
    if errors:
        for i, err in errors.items():
            b_start, b_end, b_count = batches[i]
            fallback = []
            for off, blk in enumerate(windows[i]):
                fallback.append({
                    "number": b_start + off,
                    "type": "mcq",
                    "question": blk["stem"] if isinstance(blk, dict) and "stem" in blk else str(blk),
                    "options": dict(blk["options"]) if isinstance(blk, dict) and "options" in blk else {"A": "", "B": "", "C": "", "D": ""},
                    "answer": _guess_answer_from_raw(blk["raw"] if isinstance(blk, dict) and "raw" in blk else ""),
                    "explanation": "",
                    "image_ref": None
                })
            results[i] = fallback

        emit_progress(72, f"Đã chuẩn hóa xong, {len(errors)} gói dùng bản trích xuất gốc...")

    # Ghép kết quả theo thứ tự index gốc results[0..n]
    all_questions = []
    for b_idx, batch_qs in enumerate(results):
        if not batch_qs:
            continue
        b_start, b_end, b_count = batches[b_idx]
        for idx, q in enumerate(batch_qs):
            target_num = b_start + idx
            norm_q = normalize_question(q, fallback_num=target_num)
            all_questions.append(norm_q)
>>>>
```

---

### 4.2. 5 Unit Tests to Add to `engines/quiz/test_quiz_pipeline_v2.py`

Appended at the end of `TestQuizPipelineV2` (lines 583+), strictly preserving existing tests 1–25:

```python
    @patch("quiz_pipeline.call_agnes_api")
    def test_batches_run_in_parallel(self, mock_api):
        """WP3: Verify that 4 batches run concurrently via ThreadPoolExecutor in < 2.0s."""
        import time
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu hỏi số {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 21)
        )

        def slow_api(*args, **kwargs):
            time.sleep(1.0)
            return {
                "questions": [
                    {"number": 1, "type": "mcq", "question": "Q", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                    for _ in range(5)
                ]
            }

        mock_api.side_effect = slow_api

        with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "4"}):
            start = time.time()
            res = parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=20,
                start_num=1
            )
            elapsed = time.time() - start

        self.assertEqual(len(res), 20)
        self.assertEqual(mock_api.call_count, 4)
        # Sequential execution would require >= 4.0s; 4 parallel workers finish in < 2.0s (~1.0-1.3s)
        self.assertLess(elapsed, 2.0)

    @patch("quiz_pipeline.call_agnes_api")
    def test_result_order_independent_of_completion_order(self, mock_api):
        """WP3: Verify that result ordering remains strictly sequential even if later batches finish earlier."""
        import time
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu hỏi số {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 11)
        )

        def out_of_order_api(api_key, user_prompt, system_prompt, **kwargs):
            # Batch 0 sleeps 0.3s; Batch 1 finishes immediately
            if '"number": 1' in user_prompt or "Câu 1" in user_prompt:
                time.sleep(0.3)
                qs = [
                    {"number": i, "type": "mcq", "question": f"Stem {i}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                    for i in range(1, 6)
                ]
            else:
                qs = [
                    {"number": i, "type": "mcq", "question": f"Stem {i}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"}
                    for i in range(6, 11)
                ]
            return {"questions": qs}

        mock_api.side_effect = out_of_order_api

        with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "2"}):
            res = parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=10,
                start_num=1
            )

        self.assertEqual(len(res), 10)
        self.assertEqual([q["number"] for q in res], list(range(1, 11)))
        self.assertEqual([q["question"] for q in res], [f"Stem {i}" for i in range(1, 11)])

    @patch("quiz_pipeline.call_agnes_api")
    def test_partial_batch_failure_degrades_gracefully(self, mock_api):
        """WP3: Verify that 1 failing batch falls back to raw parsed blocks without aborting the job."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu {i}.\nA. 1\nB. 2\nC. 3\nD. 4\nĐáp án: C"
            for i in range(1, 11)
        )

        def partial_failure_api(api_key, user_prompt, system_prompt, **kwargs):
            if '"number": 1' in user_prompt or "Câu 1" in user_prompt:
                return {
                    "questions": [
                        {"number": i, "type": "mcq", "question": f"Đề bài câu {i}.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A", "explanation": f"Giải thích {i}"}
                        for i in range(1, 6)
                    ]
                }
            else:
                raise RuntimeError("Agnes API 500 Internal Server Error")

        mock_api.side_effect = partial_failure_api

        res = parse_and_standardize_questions(
            raw_text=raw_text,
            api_key="mock_key",
            count=10,
            start_num=1
        )

        self.assertEqual(len(res), 10)
        self.assertEqual([q["number"] for q in res], list(range(1, 11)))
        # Batch 0 succeeded with explanation
        for q in res[:5]:
            self.assertIn("Giải thích", q["explanation"])
            self.assertEqual(q["answer"], "A")
        # Batch 1 degraded: empty explanation, answer guessed from raw regex as "C"
        for q in res[5:]:
            self.assertEqual(q["explanation"], "")
            self.assertEqual(q["answer"], "C")
            self.assertIn("Đề bài câu", q["question"])

    @patch("quiz_pipeline.call_agnes_api")
    def test_all_batches_failure_raises(self, mock_api):
        """WP3: Verify that when all batches fail, the pipeline raises the underlying RuntimeError."""
        from quiz_pipeline import parse_and_standardize_questions

        raw_text = "\n\n".join(
            f"Câu {i}: Đề bài câu {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 11)
        )
        mock_api.side_effect = RuntimeError("Agnes AI service completely unavailable")

        with self.assertRaises(RuntimeError) as ctx:
            parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=10,
                start_num=1
            )

        self.assertIn("Agnes AI service completely unavailable", str(ctx.exception))

    def test_emit_progress_is_thread_safe(self):
        """WP3: Verify that concurrent calls to emit_progress from 50 threads do not interleave stdout JSON lines."""
        import io
        import threading
        from contextlib import redirect_stdout
        from quiz_pipeline import emit_progress

        f = io.StringIO()
        num_threads = 50
        barrier = threading.Barrier(num_threads)

        def worker(idx):
            barrier.wait()
            emit_progress(idx, f"Đang tiến hành bước kiểm tra đa luồng số {idx}")

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]

        with redirect_stdout(f):
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        lines = [line.strip() for line in f.getvalue().strip().split("\n") if line.strip()]
        self.assertEqual(len(lines), num_threads)
        for line in lines:
            data = json.loads(line)
            self.assertIn("progress", data)
            self.assertIn("stage", data)
            self.assertIn("Đang tiến hành bước kiểm tra", data["stage"])
```

---

## 5. Risk Assessment & Verification Method

1. **Regression Risk on Existing Test Suite**:
   - `test_quiz_pipeline_v2.py`: 22 legacy tests + 3 WP2 tests = 25 tests. All must remain green.
   - `test_no_duplicate_questions_when_count_exceeds_available` checks for `"Câu 1"` in prompt: preserved because `_build_phase1_prompt` embeds `stem` (which retains `"Câu 1:"`).
   - `test_sequential_numbering_overrides_ai_numbers`: preserved because sequential override loop runs after aggregation.
   - `test_zero_questions_raises_before_any_api_call`: preserved because zero-question guard executes before batching.
2. **Resource Cleanup**:
   - `ThreadPoolExecutor` wrapped in `with ... as ex:` context manager guarantees thread termination.
3. **Execution Verification Command**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_adversarial_wp2.py
   ```
   **Pass Criteria**:
   - 30 tests in `test_quiz_pipeline_v2.py` PASS with 0 failures, 0 errors, 0 skips.
   - 19 tests in `test_mcq_parser.py` PASS.
   - 20 tests in `test_adversarial_wp2.py` PASS.
