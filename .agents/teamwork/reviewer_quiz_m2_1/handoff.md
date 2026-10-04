# Review & Adversarial Critic Report: Milestone 2 (WP3 & WP8)

**Agent**: Reviewer 1 (`reviewer_quiz_m2_1`)  
**Role**: reviewer, adversarial critic  
**Target Milestone**: Milestone 2 (WP3 & WP8) — Quiz Pipeline v3.0 Upgrade  
**Reviewed Worker**: `worker_quiz_m2_gen2`  
**Verdict**: **APPROVE**  

---

## 1. Observation

1. **Test Freeze & Diff Verification on `engines/quiz/test_quiz_pipeline_v2.py`**:
   - `git diff --stat engines/quiz/test_quiz_pipeline_v2.py`:
     ```text
     engines/quiz/test_quiz_pipeline_v2.py | 412 ++++++++++++++++++++++++++++++++++
     1 file changed, 412 insertions(+)
     ```
   - 0 deletions, 0 modifications to lines 1–480 (containing the 25 existing tests).
   - 0 skipped tests (`rg -n "skip" engines/quiz/test_quiz_pipeline_v2.py` returned exit code 1 with 0 matches).
   - Exactly 10 unit tests added to `TestQuizPipelineV2` (lines 587–888):
     - WP3 tests: `test_batches_run_in_parallel`, `test_result_order_independent_of_completion_order`, `test_partial_batch_failure_degrades_gracefully`, `test_all_batches_failure_raises`, `test_emit_progress_is_thread_safe`.
     - WP8 tests: `test_salvage_truncated_json_recovers_complete_objects`, `test_salvage_returns_none_on_unrecoverable`, `test_retry_uses_zero_temperature_after_json_error`, `test_http_401_does_not_retry`, `test_no_hardcoded_api_key_in_source`.

2. **Source Code Implementation Inspection (`engines/quiz/quiz_pipeline.py`)**:
   - **Secret sanitization** (line 41):
     `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")`
   - **Thread safety** (lines 43–53):
     `_EMIT_LOCK = threading.Lock()` wraps `print(payload, flush=True)`.
   - **Truncated JSON salvage** (lines 823–890):
     `_salvage_truncated_json(raw: str)` uses a state machine tracking bracket depth and string escapes, correctly extracting intact candidate objects within `questions` array.
   - **Adaptive retries & error handling** (lines 893–985):
     - Timeout set to 90s (`timeout: int = 90`).
     - Dynamic `Request` and `payload` built per attempt inside retry loop.
     - `except json.JSONDecodeError` triggers `_salvage_truncated_json`; on failure to salvage, retries with `temperature: 0.0` and appends compact JSON formatting instruction.
     - HTTP 401 raises immediately (`if e.code == 401: raise last_err`) with 0 retries.
   - **Parallel micro-batching** (lines 1152–1324):
     - `BATCH_SIZE = 5`.
     - Concurrency controlled via `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`.
     - Pre-allocated index slots `results = [None] * len(batches)`.
     - Controlled degradation: failed batches populated with fallback using `_guess_answer_from_raw`, `explanation: ""`, and stage progress notification.
     - Structured Phase 1 prompt via `_build_phase1_prompt` (lines 1117–1149), omitting explanation generation from system prompt.

3. **Verbatim Execution of Required Verification Commands**:
   - `python engines/quiz/test_quiz_pipeline_v2.py`:
     ```text
     Ran 35 tests in 1.481s
     OK
     ```
   - `python engines/quiz/test_mcq_parser.py`:
     ```text
     Ran 19 tests in 0.004s
     OK
     ```
   - `python engines/quiz/test_adversarial_wp2.py`:
     ```text
     Ran 20 tests in 0.016s
     OK
     ```
   - `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/`:
     ```text
     Exited with code 1 (0 matches).
     ```
   - `cd server && npx tsc --noEmit`:
     ```text
     Exited with code 0 (0 errors).
     ```
   - `cd server && npx vitest run tests/unit/quiz.test.ts`:
     ```text
     Test Files  1 passed (1)
          Tests  13 passed (13)
     ```

4. **Adversarial Stress-Testing**:
   - Tested `_salvage_truncated_json` against LaTeX math formulas containing curly braces (`\frac{a}{b}`, `{1, 2}`), escaped quotes (`\"Hello\"`), and markdown code fences. Verified it correctly extracts intact questions without mistaking internal braces for object boundaries.
   - Tested `_guess_answer_from_raw` across various casing and delimiters (`ĐÁP ÁN: D`, `Đáp án. B`, `Answer: C`, missing answer fallback).
   - Tested `parse_and_standardize_questions` when `count < available` (clamping and single batch), `QUIZ_AI_CONCURRENCY=1`, single batch failure fallback, and all-batch failure escalation matching `quiz.worker.ts` error patterns.

---

## 2. Logic Chain

1. **Integrity Audit**:
   - Observations 1 and 2 confirmed no hardcoded test outputs or dummy facades exist in `quiz_pipeline.py`.
   - The parallel batching, locking, salvage logic, and retry mechanism are fully functional and substantiated by real algorithmic implementations.
   - Observation 3 confirmed that test runs were genuine, reproducible, and passed without modification or fabrication.
   - Conclusion: ZERO integrity violations detected.

2. **Test Freeze & Non-Regression**:
   - Observation 1 confirmed that git diff had 0 deletions in `test_quiz_pipeline_v2.py`.
   - All 25 existing test cases (22 legacy + 3 WP2) remain untouched and pass cleanly.
   - Exactly 10 high-value unit tests were appended, thoroughly validating WP3 and WP8.

3. **Requirements Conformance (WP3 & WP8)**:
   - WP3: `BATCH_SIZE = 5` and `ThreadPoolExecutor` parallel micro-batching are implemented. `_EMIT_LOCK` prevents interleaved stdout lines. Pre-allocated index slots ensure output order is independent of thread completion order. Partial failures degrade gracefully to raw parsed blocks. Phase 1 prompt is structured as specified.
   - WP8: Hardcoded secret `sk-...` is completely excised. `_salvage_truncated_json` salvages incomplete JSON arrays. Timeout is lowered to 90s. Retries adaptively set `temperature: 0.0` and append compact formatting instructions. HTTP 401 fails fast.

---

## 3. Caveats

- **Upstream Key Rotation**: While `quiz_pipeline.py` is free of hardcoded API keys, the previously exposed key was present in earlier git commits. The project maintainer should rotate/revoke this key on the Agnes AI dashboard.
- **No other caveats**: The implementation is thread-safe, resilient against network failures, and fully compliant with project standards.

---

## 4. Conclusion

The implementation and verification for Milestone 2 (WP3 & WP8) meet all requirements, respect all constraints, and introduce no regressions.

**Verdict: APPROVE**

---

## 5. Verification Method

To independently reproduce this verification:

```powershell
# 1. Python Unit & Regression Tests (35 passing)
python engines/quiz/test_quiz_pipeline_v2.py

# 2. MCQ Parser Tests (19 passing)
python engines/quiz/test_mcq_parser.py

# 3. Adversarial WP2 Tests (20 passing)
python engines/quiz/test_adversarial_wp2.py

# 4. Grep Audit for Leaked Keys (0 matches)
rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/

# 5. Fastify Server TypeScript Typecheck (0 errors)
cd server; npx tsc --noEmit; cd ..

# 6. Fastify Quiz Unit Test Suite (13 passing)
cd server; npx vitest run tests/unit/quiz.test.ts; cd ..
```

**Invalidation Conditions**:
- Any test failure in `test_quiz_pipeline_v2.py`.
- Any match for `sk-[A-Za-z0-9]{20,}` in `engines/quiz/`.
- TypeScript errors in `server/`.
