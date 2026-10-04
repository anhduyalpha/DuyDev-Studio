# Handoff Report: Milestone 4 (WP4: Phase 2 generate_explanations)

## 1. Observation
- **File Under Investigation**: `engines/quiz/quiz_pipeline.py` (2202 lines)
  - `parse_and_standardize_questions` ends at line 1327, currently initializing questions with `"explanation": ""` and formatting only stems, options, and formulas.
  - `emit_progress` (lines 49-57) uses `_EMIT_LOCK` (`threading.Lock()`), safe for concurrent thread calls.
  - `call_agnes_api` (lines 896-970) provides HTTP resilience, retries, and automatic JSON extraction.
  - `generate_answer_key_html` (lines 1668-1685) extracts `clean_image_markers(q.get("explanation", ""))` and renders `<div class="sol-body"><b>Hướng dẫn giải:</b> {expl}</div>`. If `explanation` is empty string, it renders an empty explanation block without crashing.
- **Baseline Test Status**:
  - `python engines/quiz/test_quiz_pipeline_v2.py` -> 38/38 tests passed in 1.471s.
  - `python engines/quiz/test_mcq_parser.py` -> 19/19 tests passed in 0.007s.
  - `python engines/quiz/test_adversarial_wp2.py` -> 20/20 tests passed in 0.017s.
- **Upgrade Plan Contract** (`docs/QUIZ_PIPELINE_UPGRADE_PLAN.md` §WP4 lines 1180-1328):
  - Signature: `def generate_explanations(questions: list[dict], api_key: str, base_url: str = DEFAULT_API_BASE, model: str = DEFAULT_MODEL, batch_size: int = 5, max_workers: int = 4) -> None:`
  - In-place mutation: updates `q["explanation"]` directly on each dictionary in `questions`.
  - Batching: `batch_size = 5`, concurrent execution with `ThreadPoolExecutor`.
  - Progress reporting: `emit_progress` within range 72 -> 80.
  - Failure tolerance: never raise on partial or total failure; leave `q["explanation"] = ""`.
  - Response contract: `{"explanations": {"<number>": "<lời giải>"}}`.

---

## 2. Logic Chain
1. **Separation of Concerns & Token Economy**:
   - In Phase 1 (`parse_and_standardize_questions`), the AI only formats formulas, sub/sup, and verifies answers without generating explanations.
   - For Phase 2, `generate_explanations` constructs a compact prompt containing ONLY `number`, `question`, `options`, and `answer`. Stripping out `image_ref`, `raw`, and table wrappers reduces token payload significantly.
2. **In-Place Mutation**:
   - Python lists and dictionaries are mutable references. Passing `questions: list[dict]` and partitioning them via slice references `batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]` ensures that updates `q["explanation"] = ...` reflect immediately in the caller's list.
3. **Resilient Parsing (`_parse_explanations_response`)**:
   - AI models may return keys as strings (`"1"`), integers (`1`), Vietnamese prefixes (`"Câu 1"`), list representations (`[{"number": 1, "explanation": "..."}]`), or omit the outer `"explanations"` key.
   - `_parse_explanations_response` extracts numeric IDs via `re.search(r"\d+", str(k))` and maps them directly to `str(q["number"])`.
   - Each explanation is sanitized with `strip_section_banner(expl).strip()` to eliminate stray section headers.
4. **Concurrency & Thread Safety**:
   - Each worker thread handles a non-overlapping slice of questions.
   - Work is dispatched to `ThreadPoolExecutor(max_workers=actual_workers)` where `actual_workers = min(max_workers, total_batches)`.
   - Results are collected on completion via `concurrent.futures.as_completed(fut_map)`.
   - `emit_progress` is called sequentially in the completion loop, mapping progress linearly from 72 to 80.
5. **Zero-Crash Failure Policy**:
   - If an individual batch encounters a network or parsing error, it is recorded in `errors[b_idx]`, leaving questions in that batch with `q["explanation"] = ""`.
   - Top-level `try ... except` wraps executor execution so that even catastrophic thread pool failures never bubble up to abort the job.

---

## 3. Caveats
- Explorer 2 is scoped specifically to `generate_explanations` implementation, prompt formatting, response parsing, and unit test suites.
- Explorer 3 handles overlapped compilation in `run_pipeline` (running `_build_and_compile_worksheet` on a background thread while `generate_explanations` executes on the main thread).
- Explorer 1 handles WP6 `cluster_rects` O(n log n) sweep-line optimization.
- The unit test suite must be appended at the end of `engines/quiz/test_quiz_pipeline_v2.py` without modifying any of the 38 existing tests.

---

## 4. Conclusion & Proposed Implementation

### A. Drop-in Implementation for `engines/quiz/quiz_pipeline.py`
Insert the following functions immediately after `parse_and_standardize_questions` (around line 1327):

```python
# ==============================================================================
# PHASE 2: EXPLANATIONS GENERATION (WP4)
# ==============================================================================

def _build_phase2_prompt(batch_slice: list[dict]) -> str:
    """Build compact Phase 2 prompt for explanation generation (stem + options + answer)."""
    items = []
    for q in batch_slice:
        opts = q.get("options", {})
        if not isinstance(opts, dict):
            opts = {}
        items.append({
            "number": q.get("number"),
            "question": q.get("question", ""),
            "options": dict(opts),
            "answer": q.get("answer", "")
        })

    prompt = (
        "Với mỗi câu hỏi trắc nghiệm dưới đây (đã biết đáp án đúng), hãy viết lời giải "
        "ngắn gọn, chính xác về mặt khoa học, bằng tiếng Việt, 1-3 câu.\n"
        "Dùng HTML <sub>/<sup> cho công thức hoá học và $...$ cho biểu thức toán.\n"
        'Trả về ĐÚNG JSON: {"explanations": {"<number>": "<lời giải>"}}\n\n'
        "INPUT:\n"
        f"{json.dumps(items, ensure_ascii=False)}"
    )
    return prompt


def _parse_explanations_response(res: dict | None) -> dict[str, str]:
    """
    Safely parse AI response into a mapping of str(question_number) -> explanation text.
    Handles standard {"explanations": {"<num>": "<text>"}}, list representations,
    and number-prefixed keys like "Câu 1".
    """
    parsed_map: dict[str, str] = {}
    if not res or not isinstance(res, dict):
        return parsed_map

    exp_data = None
    if "explanations" in res:
        exp_data = res["explanations"]
    elif "questions" in res and isinstance(res["questions"], list):
        for item in res["questions"]:
            if isinstance(item, dict) and "number" in item:
                num = item.get("number")
                text = item.get("explanation") or item.get("text") or ""
                parsed_map[str(num)] = str(text).strip()
        return parsed_map
    else:
        exp_data = res

    if isinstance(exp_data, dict):
        for k, v in exp_data.items():
            m = re.search(r"\d+", str(k))
            clean_k = m.group(0) if m else str(k).strip()
            if isinstance(v, str):
                parsed_map[clean_k] = v.strip()
            elif isinstance(v, dict):
                text = v.get("explanation") or v.get("text") or v.get("content") or ""
                parsed_map[clean_k] = str(text).strip()
            elif v is not None:
                parsed_map[clean_k] = str(v).strip()
    elif isinstance(exp_data, list):
        for item in exp_data:
            if isinstance(item, dict):
                num = item.get("number")
                text = item.get("explanation") or item.get("text") or item.get("content") or ""
                if num is not None:
                    parsed_map[str(num)] = str(text).strip()

    return parsed_map


def generate_explanations(
    questions: list[dict],
    api_key: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    batch_size: int = 5,
    max_workers: int = 4
) -> None:
    """
    Generate detailed explanations for questions in Phase 2, mutating q["explanation"] IN-PLACE.
    Never raises an exception on partial or total failure; failed questions retain explanation = "".
    """
    if not questions:
        return

    # Ensure all questions have an explanation field initialized
    for q in questions:
        if "explanation" not in q or q["explanation"] is None:
            q["explanation"] = ""

    if not api_key:
        emit_progress(80, "Bỏ qua tạo lời giải chi tiết (thiếu API key)...")
        return

    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to write concise, scientifically accurate explanations in Vietnamese (1-3 sentences) "
        "for the provided multiple-choice questions with known correct answers.\n"
        "Use HTML <sub>/<sup> for chemical formulas and $...$ for mathematical expressions.\n"
        'Return ONLY a valid JSON object matching: {"explanations": {"<number>": "<lời giải>"}}'
    )

    batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]
    total_batches = len(batches)
    if total_batches == 0:
        return

    concurrency_env = os.environ.get("QUIZ_AI_CONCURRENCY")
    effective_workers = int(concurrency_env) if concurrency_env else max_workers
    actual_workers = min(max(1, effective_workers), total_batches)

    def _run_exp_batch(b_idx: int) -> dict[str, str]:
        b_slice = batches[b_idx]
        user_prompt = _build_phase2_prompt(b_slice)
        res = call_agnes_api(
            api_key, user_prompt, system_prompt,
            base_url=base_url, model=model, timeout=90
        )
        return _parse_explanations_response(res)

    errors: dict[int, Exception] = {}
    start_prog = 72
    max_prog = 80
    prog_range = max_prog - start_prog

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=actual_workers) as ex:
            fut_map = {ex.submit(_run_exp_batch, i): i for i in range(total_batches)}
            done_n = 0
            for fut in concurrent.futures.as_completed(fut_map):
                b_idx = fut_map[fut]
                try:
                    exp_map = fut.result()
                    for q in batches[b_idx]:
                        q_num_str = str(q.get("number"))
                        if q_num_str in exp_map and exp_map[q_num_str]:
                            raw_exp = exp_map[q_num_str]
                            q["explanation"] = strip_section_banner(raw_exp).strip()
                except Exception as e:
                    errors[b_idx] = e
                done_n += 1
                pct = int(start_prog + (done_n / total_batches) * prog_range)
                emit_progress(
                    pct,
                    f"Đang viết lời giải chi tiết {done_n}/{total_batches} gói "
                    f"({min(done_n * batch_size, len(questions))}/{len(questions)} câu)..."
                )
    except Exception:
        emit_progress(80, "Không thể tạo lời giải chi tiết, dùng bảng đáp án rút gọn...")
        return

    if errors:
        if len(errors) == total_batches:
            emit_progress(80, "Không thể tạo lời giải chi tiết, dùng bảng đáp án rút gọn...")
        else:
            emit_progress(80, f"Đã viết xong lời giải, {len(errors)}/{total_batches} gói dùng đáp án rút gọn...")
```

### B. Unit Test Suite for `engines/quiz/test_quiz_pipeline_v2.py`
Append the following tests to `test_quiz_pipeline_v2.py`:

```python
    @patch("quiz_pipeline.call_agnes_api")
    def test_generate_explanations_in_place_mutation_success(self, mock_api):
        """WP4: Verify that generate_explanations mutates q['explanation'] in-place and returns None."""
        from quiz_pipeline import generate_explanations
        mock_api.return_value = {
            "explanations": {
                "1": "C2H6O ứng với ancol etylic C2H5OH.",
                "2": "Bạc (Ag) dẫn điện tốt nhất.",
                "3": "NaCl phân li hoàn toàn trong nước."
            }
        }
        qs = [
            {"number": 1, "question": "HCHC X có CTPT C2H6O", "options": {"A": "ancol", "B": "axit"}, "answer": "A", "explanation": ""},
            {"number": 2, "question": "Kim loại nào dẫn điện tốt nhất?", "options": {"A": "Cu", "B": "Ag"}, "answer": "B", "explanation": ""},
            {"number": 3, "question": "Chất nào là chất điện ly mạnh?", "options": {"A": "NaCl", "B": "H2O"}, "answer": "A", "explanation": ""},
        ]
        ret = generate_explanations(qs, "dummy_key", batch_size=5)
        self.assertIsNone(ret)
        self.assertEqual(qs[0]["explanation"], "C2H6O ứng với ancol etylic C2H5OH.")
        self.assertEqual(qs[1]["explanation"], "Bạc (Ag) dẫn điện tốt nhất.")
        self.assertEqual(qs[2]["explanation"], "NaCl phân li hoàn toàn trong nước.")

    @patch("quiz_pipeline.call_agnes_api")
    def test_generate_explanations_batching_multiple_slices(self, mock_api):
        """WP4: Verify that 12 questions with batch_size=5 are partitioned into 3 batches."""
        from quiz_pipeline import generate_explanations
        qs = [
            {"number": i, "question": f"Câu {i}", "options": {"A": "1", "B": "2"}, "answer": "A", "explanation": ""}
            for i in range(1, 13)
        ]
        def side_effect(key, prompt, system_prompt, **kwargs):
            m = re.findall(r'"number":\s*(\d+)', prompt)
            return {"explanations": {n: f"Giải thích {n}" for n in m}}

        mock_api.side_effect = side_effect
        generate_explanations(qs, "dummy_key", batch_size=5, max_workers=2)
        self.assertEqual(mock_api.call_count, 3)
        for q in qs:
            self.assertEqual(q["explanation"], f"Giải thích {q['number']}")

    @patch("quiz_pipeline.call_agnes_api")
    def test_generate_explanations_partial_failure_graceful_degradation(self, mock_api):
        """WP4: Verify that 1 failing batch leaves its questions with empty explanation without raising."""
        from quiz_pipeline import generate_explanations
        qs = [
            {"number": i, "question": f"Câu {i}", "options": {"A": "1", "B": "2"}, "answer": "A", "explanation": ""}
            for i in range(1, 11)
        ]
        def side_effect(key, prompt, system_prompt, **kwargs):
            if '"number": 1' in prompt:
                return {"explanations": {str(i): f"Giải thích {i}" for i in range(1, 6)}}
            else:
                raise RuntimeError("Agnes API 500 Server Error")

        mock_api.side_effect = side_effect
        generate_explanations(qs, "dummy_key", batch_size=5)
        for i in range(5):
            self.assertEqual(qs[i]["explanation"], f"Giải thích {i + 1}")
        for i in range(5, 10):
            self.assertEqual(qs[i]["explanation"], "")

    @patch("quiz_pipeline.call_agnes_api")
    def test_generate_explanations_total_failure_graceful_degradation(self, mock_api):
        """WP4: Verify that total API failure never raises and preserves empty explanations."""
        from quiz_pipeline import generate_explanations
        qs = [
            {"number": 1, "question": "Q1", "options": {"A": "1"}, "answer": "A", "explanation": ""},
            {"number": 2, "question": "Q2", "options": {"A": "1"}, "answer": "A", "explanation": ""}
        ]
        mock_api.side_effect = RuntimeError("Network unreachable")
        generate_explanations(qs, "dummy_key", batch_size=5)
        for q in qs:
            self.assertEqual(q["explanation"], "")

    @patch("quiz_pipeline.call_agnes_api")
    def test_generate_explanations_flexible_parsing_formats(self, mock_api):
        """WP4: Verify that parser handles 'Câu 1' keys, list formats, and root-level dictionaries."""
        from quiz_pipeline import generate_explanations
        qs = [
            {"number": 1, "question": "Q1", "options": {"A": "1"}, "answer": "A", "explanation": ""},
            {"number": 2, "question": "Q2", "options": {"A": "1"}, "answer": "A", "explanation": ""},
            {"number": 3, "question": "Q3", "options": {"A": "1"}, "answer": "A", "explanation": ""}
        ]
        mock_api.return_value = {"explanations": {"Câu 1": "Exp 1", "2": "Exp 2", "Câu 3": "Exp 3"}}
        generate_explanations(qs, "dummy_key")
        self.assertEqual(qs[0]["explanation"], "Exp 1")
        self.assertEqual(qs[1]["explanation"], "Exp 2")
        self.assertEqual(qs[2]["explanation"], "Exp 3")

    @patch("quiz_pipeline.call_agnes_api")
    def test_generate_explanations_compact_prompt_tokens(self, mock_api):
        """WP4: Verify that Phase 2 prompt omits image_ref and raw markers to minimize token usage."""
        from quiz_pipeline import generate_explanations
        mock_api.return_value = {"explanations": {"1": "ok"}}
        qs = [{
            "number": 1,
            "question": "Question text",
            "options": {"A": "1", "B": "2"},
            "answer": "A",
            "image_ref": "fig_p1_1.png",
            "raw": "Câu 1. Raw text...",
            "explanation": ""
        }]
        generate_explanations(qs, "dummy_key")
        user_prompt = mock_api.call_args[0][1]
        self.assertNotIn("fig_p1_1.png", user_prompt)
        self.assertNotIn("Raw text", user_prompt)
        self.assertIn("Question text", user_prompt)
```

---

## 5. Verification Method

1. **Standalone Verification Prototype**:
   Execute the standalone validation suite:
   ```powershell
   python .agents/teamwork/explorer_quiz_m4_explanations/validate_explanations.py
   ```
   *Expected Result*: Ran 8 tests in ~0.012s, OK (100% pass).

2. **Integration Verification after Implementation**:
   Once applied to `engines/quiz/quiz_pipeline.py` and `engines/quiz/test_quiz_pipeline_v2.py`:
   ```powershell
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Expected Result*: All 38 existing tests pass + 6 new tests pass = 44 tests passing, 0 errors, 0 skips.

3. **Grep Audits**:
   Ensure no hardcoded keys, CDN links, or unfinished stubs:
   ```powershell
   rg "cdn.jsdelivr" engines/quiz/
   rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/
   rg -n "TODO|FIXME|NotImplementedError" engines/quiz/
   ```
   *Expected Result*: 0 matches.
