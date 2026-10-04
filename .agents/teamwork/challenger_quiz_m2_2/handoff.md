# Handoff Report: Challenger 2 for Milestone 2 (WP3 & WP8)

- **Agent**: Challenger 2 (`challenger_quiz_m2_2`)
- **Parent Agent ID**: `973de344-1990-4ba0-bff2-d8fc79ff96f1`
- **Target**: `engines/quiz/quiz_pipeline.py`, `engines/quiz/test_quiz_pipeline_v2.py`
- **Verdict**: **APPROVE**
- **Date**: 2026-10-04T07:25:00Z

---

## 1. Observation

Direct empirical observations, commands, outputs, and line references collected during adversarial evaluation of Milestone 2 (WP3 & WP8):

### Observation 1.1: Empirical Adversarial Stress Suite (`.tmp/test_adversarial_m2.py`)
- **Execution Command**:
  ```bash
  python .tmp/test_adversarial_m2.py
  ```
- **Verbatim Output**:
  ```text
  test_all_5_batches_fail_with_api_error_raises_exception (__main__.AdversarialMilestone2Tests.test_all_5_batches_fail_with_api_error_raises_exception)
  Challenge: All 5 batches fail with API error. Raises first exception with error message preserved. ... ok
  test_all_5_batches_return_empty_questions_raises_vietnamese_contract (__main__.AdversarialMilestone2Tests.test_all_5_batches_return_empty_questions_raises_vietnamese_contract)
  Challenge: All 5 batches return empty list. Raises exact Vietnamese contract error. ... ok
  test_emit_progress_100_threads_zero_json_corruption (__main__.AdversarialMilestone2Tests.test_emit_progress_100_threads_zero_json_corruption)
  Challenge: 100 concurrent threads calling emit_progress produces 100 parseable JSON lines. ... ok
  test_guess_answer_from_raw_edge_cases (__main__.AdversarialMilestone2Tests.test_guess_answer_from_raw_edge_cases)
  Challenge: _guess_answer_from_raw with diverse patterns and defaults. ... ok
  test_http_401_redacts_api_key_in_exception (__main__.AdversarialMilestone2Tests.test_http_401_redacts_api_key_in_exception)
  Challenge: HTTP 401 containing raw API key in body is redacted to [REDACTED_API_KEY]. ... ok
  test_http_500_retries_without_altering_temperature (__main__.AdversarialMilestone2Tests.test_http_500_retries_without_altering_temperature)
  Challenge: HTTP 500 error triggers retry, but preserves temperature == 0.1 (not altered). ... ok
  test_legacy_25_tests_suite_all_pass (__main__.AdversarialMilestone2Tests.test_legacy_25_tests_suite_all_pass)
  Challenge: Verify that all 25 legacy tests pass completely without modification. ... ok
  test_mixed_failure_modes_across_batches (__main__.AdversarialMilestone2Tests.test_mixed_failure_modes_across_batches)
  Challenge: Mixed failures (Batch 0: HTTP 500, Batch 1: empty list, Batch 2: bad JSON, Batches 3 & 4: ok). ... ok
  test_no_hardcoded_keys_in_engines_quiz (__main__.AdversarialMilestone2Tests.test_no_hardcoded_keys_in_engines_quiz)
  Challenge: Zero hardcoded API keys matching sk-[A-Za-z0-9]{20,} in engines/quiz/. ... ok
  test_no_unresolved_todos_in_engines_quiz (__main__.AdversarialMilestone2Tests.test_no_unresolved_todos_in_engines_quiz)
  Challenge: Zero TODO, FIXME, or NotImplementedError in engines/quiz/ source files. ... ok
  test_out_of_order_batch_completion_preserves_strict_slot_order (__main__.AdversarialMilestone2Tests.test_out_of_order_batch_completion_preserves_strict_slot_order)
  Challenge: 5 batches completing in reverse order (4, 3, 2, 1, 0) are strictly reassembled. ... ok
  test_partial_failure_2_out_of_5_batches (__main__.AdversarialMilestone2Tests.test_partial_failure_2_out_of_5_batches)
  Challenge: 2 of 5 batches fail (Batches 1 & 3). Returns 25 questions, fallback for 1 & 3. ... ok
  test_partial_failure_4_out_of_5_batches (__main__.AdversarialMilestone2Tests.test_partial_failure_4_out_of_5_batches)
  Challenge: 4 of 5 batches fail (Batches 0, 1, 2, 3 fail, only Batch 4 succeeds). ... ok
  test_retry_json_error_lowers_temperature_and_expands_prompt (__main__.AdversarialMilestone2Tests.test_retry_json_error_lowers_temperature_and_expands_prompt)
  Challenge: Attempt 0 fails JSON decode -> Attempt 1 called with temp 0.0 and prompt suffix. ... ok
  test_retry_prompt_expansion_is_idempotent_across_multiple_retries (__main__.AdversarialMilestone2Tests.test_retry_prompt_expansion_is_idempotent_across_multiple_retries)
  Challenge: Consecutive JSON failures (Attempt 0 & 1) do NOT duplicate compact instruction in Attempt 2. ... ok
  test_salvage_on_attempt_0_avoids_any_retry (__main__.AdversarialMilestone2Tests.test_salvage_on_attempt_0_avoids_any_retry)
  Challenge: When attempt 0 response has truncated JSON, salvage succeeds immediately with 0 retries. ... ok
  test_salvage_with_escaped_quotes_and_latex (__main__.AdversarialMilestone2Tests.test_salvage_with_escaped_quotes_and_latex)
  Challenge: Salvage handles strings containing escaped quotes and LaTeX formulas. ... ok
  test_salvage_with_surrounding_markdown_fences (__main__.AdversarialMilestone2Tests.test_salvage_with_surrounding_markdown_fences)
  Challenge: Salvage handles markdown code fence wrapping. ... ok

  ----------------------------------------------------------------------
  Ran 18 tests in 0.471s

  OK
  ```

### Observation 1.2: Partial Batch Failure Stress Details
1. **2 of 5 Batches Fail (40% Failure)**:
   - Batches 1 & 3 threw errors; Batches 0, 2, 4 succeeded.
   - Result: Exactly 25 questions returned, numbers strictly 1..25.
   - Fallback questions: `explanation == ""`, answer guessed from raw text (`"C"`), stem intact.
   - Emitted progress: `{"progress": 72, "stage": "Đã chuẩn hóa xong, 2 gói dùng bản trích xuất gốc..."}`.
2. **4 of 5 Batches Fail (80% Failure)**:
   - Batches 0, 1, 2, 3 failed; only Batch 4 succeeded.
   - Result: Exactly 25 questions returned, numbers strictly 1..25.
   - Emitted progress: `{"progress": 72, "stage": "Đã chuẩn hóa xong, 4 gói dùng bản trích xuất gốc..."}`.
3. **All 5 Batches Fail (100% Failure)**:
   - When all batches fail due to API/network error: raises `RuntimeError` immediately with original error string preserved.
   - When all batches return empty questions `{"questions": []}`: raises `RuntimeError: "Không có câu hỏi trong Tập tin đề thi mẫu, vui lòng chọn lại."`, matching `cleanQuizErrorMessage` regex in `server/src/workers/quiz.worker.ts:77-87`.

### Observation 1.3: Adaptive Retry & Call Argument Verification
1. **JSON Decode Error**:
   - Call 0: `temperature == 0.1`, original user prompt.
   - Call 1: `temperature == 0.0`, prompt suffixed with `"\n\nChỉ trả JSON compact, không markdown fence, không giải thích thêm."`. Rebuilt inside `for attempt in range(max_retries + 1)`.
2. **Prompt Expansion Idempotency**:
   - Consecutive JSON failures on attempt 0 & 1: attempt 2 contains the compact suffix exactly once (`count == 1`).
3. **Truncated JSON Salvage**:
   - Salvage on attempt 0 with 3 complete questions and 1 truncated question: returned 3 questions immediately with `call_count == 1` (0 extra network calls).
   - Unsalvageable JSON (truncated inside 1st question): retried attempt 1 with `temperature: 0.0`.
4. **HTTP 500 / 429**:
   - Retried with `temperature == 0.1` preserved (not lowered to 0.0).
5. **HTTP 401 & Redaction**:
   - Fast-fails immediately on attempt 0 (`call_count == 1`).
   - If raw API key is in the HTTP error response body, it is replaced with `[REDACTED_API_KEY]`.

### Observation 1.4: Legacy 25 Tests & Static Checks
1. **Legacy 25 Tests**:
   - Ran all 25 legacy tests in `test_quiz_pipeline_v2.py` in isolation: `Ran 25 tests in 0.134s — OK`.
   - Full suite `test_quiz_pipeline_v2.py`: `Ran 35 tests in 1.492s — OK` (25 legacy + 10 appended).
   - `git diff engines/quiz/test_quiz_pipeline_v2.py`: Confirmed zero modifications to lines 1–586; only 10 tests were appended at the end.
2. **Secrets & Linters**:
   - `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/`: 0 matches in source files (only in unit test assertions).
   - `rg -n "\b(TODO|FIXME|NotImplementedError)\b" engines/quiz/`: 0 matches.
   - `engines/quiz/test_mcq_parser.py`: `Ran 19 tests in 0.014s — OK`.
   - `engines/quiz/test_adversarial_wp2.py`: `Ran 20 tests in 0.035s — OK`.

### Observation 1.5: Server Integration
- `cd server && npx tsc --noEmit`: Exited 0 with **0 errors**.
- `cd server && npx vitest run tests/unit/quiz.test.ts tests/unit/quiz_prompt.test.ts tests/unit/quiz_history.test.ts`: **3 test files passed, 30 tests passed, 0 failed**.

---

## 2. Logic Chain

1. **WP3 Fallback & Degradation Integrity (Supported by Obs 1.1, 1.2)**:
   - When batches fail partially (e.g. 2/5 or 4/5), `parse_and_standardize_questions` does not abort or drop questions.
   - It correctly fills failed batches from `windows[i]` parsed blocks using `_guess_answer_from_raw`, sets `explanation: ""`, and maintains 1..N monotonic numbering.
   - It emits exact Vietnamese progress telemetry notifying that `{len(errors)} gói dùng bản trích xuất gốc`.
   - When all batches fail, it cleanly escalates the exception without silent masking, matching the worker error contract.
2. **WP8 Defensive Retry & Salvage Correctness (Supported by Obs 1.1, 1.3)**:
   - Refactoring `Request` and `payload` creation into the retry loop enables dynamic temperature and prompt adjustment.
   - Attempt 0 uses default 0.1; JSON errors switch attempt 1 to 0.0 and inject compact formatting instructions idempotently.
   - Salvage helper `_salvage_truncated_json` successfully extracts valid questions from truncated JSON, saving API retries.
   - Security constraints are satisfied: API keys are excluded from source, and redacted from error logs.
3. **Concurrency & Thread Safety (Supported by Obs 1.1, Area 4)**:
   - Asynchronous batch completion with inverted sleeps demonstrates that results are indexed by submission slot `results[i]`, not completion order.
   - 100 concurrent threads calling `emit_progress` produce zero JSON line mangling, proving `_EMIT_LOCK` operates correctly.
4. **Zero Regressions (Supported by Obs 1.4, 1.5)**:
   - Legacy 25 unit tests pass 100% without modification.
   - TypeScript compiles cleanly (0 errors) and Fastify server quiz test suites pass 100%.

---

## 3. Caveats

- **Mock Isolation**: All adversarial tests use mock HTTP connections to guarantee hermetic and reproducible execution without incurring external Agnes AI charges or network latency. Live end-to-end network interaction is tested in downstream smoke tests.
- **Upstream Key Rotation**: As previously flagged, any historical API key present in git commits prior to this milestone should still be rotated on the Agnes AI dashboard by the repository administrator.

---

## 4. Conclusion

The implementation of Milestone 2 (WP3 Parallel Micro-Batching & WP8 Advanced Retry/Fallback) is empirically sound, resilient under stress, and fully compliant with all architectural contracts.

Verdict: **APPROVE**.

---

## 5. Verification Method

To independently reproduce all findings:

```bash
# 1. Run Challenger 2 Adversarial Stress Suite (18 tests)
python .tmp/test_adversarial_m2.py

# 2. Run Quiz Pipeline Test Suite (35 tests)
python engines/quiz/test_quiz_pipeline_v2.py

# 3. Run MCQ Parser & WP2 Adversarial Suites (39 tests)
python engines/quiz/test_mcq_parser.py
python engines/quiz/test_adversarial_wp2.py

# 4. Scan for hardcoded keys and lingering TODOs
rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/
rg -n "\b(TODO|FIXME|NotImplementedError)\b" engines/quiz/

# 5. Verify Backend TypeScript and Unit Tests
cd server && npx tsc --noEmit
cd server && npx vitest run tests/unit/quiz.test.ts tests/unit/quiz_prompt.test.ts tests/unit/quiz_history.test.ts
```

**Invalidation Conditions**:
- Any failure among the 18 tests in `.tmp/test_adversarial_m2.py`.
- Any failure among the 35 tests in `test_quiz_pipeline_v2.py`.
- Any hardcoded secret matching `sk-[A-Za-z0-9]{20,}` in `engines/quiz/`.
- TypeScript errors in `server/`.
