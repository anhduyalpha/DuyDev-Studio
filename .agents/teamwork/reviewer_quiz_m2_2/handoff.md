# Independent Review & Adversarial Challenge Report: Milestone 2 (WP3 & WP8)

- **Reviewer**: Reviewer 2 (`reviewer_quiz_m2_2`)
- **Role**: Reviewer & Adversarial Critic
- **Target**: Milestone 2 (WP3 & WP8 of Quiz Pipeline v3.0 Upgrade)
- **Files Under Review**: `engines/quiz/quiz_pipeline.py`, `engines/quiz/test_quiz_pipeline_v2.py`
- **Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Source Code Verification (`engines/quiz/quiz_pipeline.py`)

1. **Thread-Safe Telemetry (`emit_progress`)** (lines 43–53):
   - Mutex lock initialized: `_EMIT_LOCK = threading.Lock()`.
   - In `emit_progress`, JSON encoding occurs before lock acquisition, and standard output write/flush is serialized:
     ```python
     with _EMIT_LOCK:
         print(payload, flush=True)
     ```
   - Only other `print` statement in the file occurs at line 2138 upon pipeline completion after all threads have joined. No uncoordinated writes exist.

2. **Secrets & Security Hygiene**:
   - `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")` (line 41).
   - Regex scan `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/` returned 0 matches across the entire directory.
   - `call_agnes_api` sanitizes error messages by redacting keys: `err_msg.replace(api_key, "[REDACTED_API_KEY]")` (line 963).

3. **Truncated JSON Salvage & Adaptive Retries (`_salvage_truncated_json`, `call_agnes_api`)** (lines 823–985):
   - `_salvage_truncated_json` tracks string literals, escape sequences (`\\`), bracket depth (`bracket_depth`), and brace depth (`brace_depth`). When `brace_depth == 1 and bracket_depth == 1` at a closing `}`, it records valid top-level question object boundaries inside the `"questions"` array.
   - Slices candidate sub-arrays, appends `"\n]}"`, and attempts parsing via `json.loads`. Returns `None` if unrecoverable or if no valid questions exist.
   - `call_agnes_api` constructs dynamic `urllib.request.Request` within the retry loop (`for attempt in range(max_retries + 1)`), allowing attempt 2 to adopt `temperature: 0.0` and append `"Chỉ trả JSON compact..."` instruction upon encountering `json.JSONDecodeError`.
   - Fast-fails on HTTP 401: `if e.code == 401: raise last_err` with 0 retries. Default timeout reduced to 90s (`timeout: int = 90`).

4. **Parallel Micro-Batching & Controlled Degradation (`parse_and_standardize_questions`)** (lines 1201–1290):
   - Micro-batch size reduced to `BATCH_SIZE = 5`.
   - Slices windows directly from `parsed_blocks` (`assert len(windows) == len(batches)`), eliminating the faulty `else raw_text` fallback.
   - Concurrency bounded: `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`, `max_workers = min(MAX_PARALLEL, max(1, len(batches)))`.
   - Managed via context manager: `with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:`, guaranteeing thread cleanup and join on exit.
   - Pre-allocated results array `results: list[list[dict] | None] = [None] * len(batches)` populated by original index `i = fut_map[fut]`, ensuring strict ordering regardless of completion timing.
   - Partial batch failure triggers controlled fallback: builds questions from raw blocks with regex-guessed answers (`_guess_answer_from_raw`), empty explanations, and emits stage notification `emit_progress(72, "Đã chuẩn hóa xong, {len(errors)} gói dùng bản trích xuất gốc...")`.
   - Full batch failure raises the first error, preserving Vietnamese error messages.
   - Post-processing dedups stems via SHA1 of stripped HTML, clamps to `effective_count`, and forces sequential numbering `start_num + i`.
   - `run_pipeline` passes `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]` into `link_assets_to_questions`, ensuring image assets remain mapped to original PDF question numbers.

### 1.2 Test Suite Verification (`engines/quiz/test_quiz_pipeline_v2.py`)

- Baseline preservation: All 22 original tests and 3 WP2 tests remain intact and unmodified.
- 10 new unit tests appended at lines 587–888:
  - WP3: `test_batches_run_in_parallel`, `test_result_order_independent_of_completion_order`, `test_partial_batch_failure_degrades_gracefully`, `test_all_batches_failure_raises`, `test_emit_progress_is_thread_safe`.
  - WP8: `test_salvage_truncated_json_recovers_complete_objects`, `test_salvage_returns_none_on_unrecoverable`, `test_retry_uses_zero_temperature_after_json_error`, `test_http_401_does_not_retry`, `test_no_hardcoded_api_key_in_source`.

### 1.3 Independent Execution Results

| Command | Expected | Actual Result | Status |
|---|---|---|---|
| `python engines/quiz/test_quiz_pipeline_v2.py` | 35 passed | `Ran 35 tests in 1.465s, OK` | PASS |
| `python engines/quiz/test_mcq_parser.py` | 19 passed | `Ran 19 tests in 0.007s, OK` | PASS |
| `python engines/quiz/test_adversarial_wp2.py` | 20 passed | `Ran 20 tests in 0.017s, OK` | PASS |
| `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/` | 0 matches | Code 1 (0 matches) | PASS |
| `cd server && npx tsc --noEmit` | 0 errors | Code 0 (0 errors) | PASS |
| `cd server && npx vitest run tests/unit/quiz.test.ts` | 13 passed | `13 passed in 4.02s` | PASS |
| `cd server && npx vitest run tests/unit/quiz*.test.ts` | 30 passed | `30 passed in 2.36s` | PASS |
| Scratch adversarial salvage test (8 edge cases) | 8/8 passed | `ALL 8 ADVERSARIAL SALVAGE TESTS PASSED!` | PASS |

---

## 2. Logic Chain

1. **Integrity & Authenticity Audit**:
   - Inspected source code for hardcoded test results, facade logic, mock short-circuits, and TODO placeholders.
   - Confirmed `quiz_pipeline.py` contains genuine production logic: real regex parsing, authentic JSON salvage state machine, real `urllib.request` dispatch, and functional thread synchronization.
   - `rg -n "TODO|FIXME|NotImplementedError" engines/quiz/` returned 0 matches.
   - No integrity violations detected.

2. **Concurrency & Thread Safety Assessment**:
   - `emit_progress` wraps standard output in `_EMIT_LOCK` and calls `flush=True`. Confirmed under 50 concurrent threads releasing simultaneously through a `threading.Barrier(50)`, producing 50 atomic, uncorrupted JSON lines.
   - `ThreadPoolExecutor` is bounded by `min(MAX_PARALLEL, len(batches))`, preventing unbounded thread spawning on short documents.
   - Resource lifecycle: Handled within Python's `with` context manager, which triggers `shutdown(wait=True)` deterministically upon block exit.
   - Order preservation: Pre-allocating `results[i]` indexed by submission ID decouples execution order from completion order, preventing race conditions.

3. **Resilience & Error Protocol Conformance**:
   - Error messages match the exact regex and substring contracts expected by `server/src/workers/quiz.worker.ts:cleanQuizErrorMessage`:
     - `"Không có câu hỏi trong {desc}, vui lòng chọn lại."`
     - `"Trang {p} vượt quá tổng số {total_pages} trang..."`
     - `"Trang được chọn (...) không chứa văn bản dạng số/vector. Tài liệu có thể là ảnh scan thuần túy..."`
   - Graceful degradation: A failure in batch $k$ falls back to raw regex-parsed questions without crashing batches $0..k-1$ or $k+1..n$, ensuring high service availability under volatile upstream AI behavior.

---

## 3. Caveats & Adversarial Challenges

1. **Upstream API Key Revocation Notice**:
   - While the hardcoded key has been completely eradicated from the current codebase (`engines/quiz/`), it exists in earlier git commits prior to this milestone. The repository administrator should ensure that the exposed key is rotated on the Agnes AI dashboard.
2. **Defensive Suggestion for Environment Variable Parsing**:
   - Currently, `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`. If an operator inputs a non-integer or zero string, `int(...)` or `ThreadPoolExecutor(max_workers=0)` will raise an error.
   - *Suggestion (Non-blocking)*: Wrap in `max(1, int(os.environ.get("QUIZ_AI_CONCURRENCY", "4")))` with a try/except fallback to `4`.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 2 (WP3 & WP8) satisfies all architectural and functional criteria outlined in `docs/QUIZ_PIPELINE_UPGRADE_PLAN.md`:
- Micro-batching with size 5 and 4-worker concurrency reduces AI latency while remaining bounded.
- `emit_progress` stdout streaming is 100% thread-safe under high concurrency.
- Truncated JSON salvage and adaptive retries provide resilient error recovery.
- Zero hardcoded API keys remain in source files.
- All 35 tests pass with zero regressions to the original 22 tests.
- Fastify server TypeScript compilation and Vitest suites pass cleanly.

---

## 5. Verification Method

To reproduce the verification findings independently:

```powershell
# 1. Verify 35/35 unit tests in quiz pipeline
python engines/quiz/test_quiz_pipeline_v2.py

# 2. Verify 19/19 MCQ parser tests
python engines/quiz/test_mcq_parser.py

# 3. Verify 20/20 WP2 adversarial tests
python engines/quiz/test_adversarial_wp2.py

# 4. Verify complete absence of hardcoded keys
rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/

# 5. Verify backend TypeScript compilation
cd server; npx tsc --noEmit; cd ..

# 6. Verify backend quiz test suites
cd server; npx vitest run tests/unit/quiz.test.ts tests/unit/quiz_prompt.test.ts tests/unit/quiz_history.test.ts; cd ..
```

**Invalidation Conditions**:
- Any test failure in `test_quiz_pipeline_v2.py`.
- Any unescaped stdout print outside `_EMIT_LOCK`.
- Any matching secret in `engines/quiz/`.
- Any TypeScript error in `server/`.
