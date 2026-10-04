## 2026-10-04T00:05:11Z
You are the Implementation Worker for Milestone 2 (Work Packages WP3 & WP8) of the Quiz Pipeline v3.0 Upgrade in DuyDev Studio.

## Working Directory
`C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m2_gen2`

## Key Documents to Read
1. `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md` (Read this first!)
2. `C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md` (Specifically §WP3 and §WP8)
3. Explorer Reports:
   - `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_batching\handoff.md`
   - `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_retry_security\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Scope of Work
1. Inspect `engines/quiz/quiz_pipeline.py`:
   - Verify that all WP3 & WP8 implementation logic is in place:
     - `_EMIT_LOCK = threading.Lock()` and thread-safe `emit_progress`.
     - `BATCH_SIZE = 5`.
     - `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))` and `ThreadPoolExecutor` for parallel micro-batching.
     - Index-preserved result collection (`results = [None] * len(batches)`).
     - Controlled graceful degradation (`_guess_answer_from_raw`, falling back to raw parsed blocks if single batch fails; raising if all fail).
     - `_build_phase1_prompt` sending structured JSON (omitting stem detection & explanation from system prompt).
     - `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")` (NO hardcoded key!).
     - `_salvage_truncated_json` recovering complete objects from truncated JSON.
     - `call_agnes_api`: timeout default 90s, dynamic `Request` creation inside retry loop, separate catch for `json.JSONDecodeError` with salvage and retry at `temperature: 0.0`, fast-fail on HTTP 401.
   - If any logic is missing or broken, implement it cleanly.

2. Append 10 Unit Tests into `engines/quiz/test_quiz_pipeline_v2.py`:
   - STRICT CONSTRAINT: DO NOT MODIFY, DELETE, OR SKIP ANY OF THE 25 EXISTING TEST CASES. All 25 must remain 100% frozen and passing. Only append the 10 new tests to the end of the file.
   - WP3 Tests (5 tests):
     1. `test_batches_run_in_parallel`: Mock `call_agnes_api` with `time.sleep(1.0)`, 4 batches, `QUIZ_AI_CONCURRENCY=4` -> assert elapsed `< 2.0s`.
     2. `test_result_order_independent_of_completion_order`: Mock out-of-order resolution -> assert questions remain monotonically ordered by `q["number"]`.
     3. `test_partial_batch_failure_degrades_gracefully`: 1 batch fails -> returns `effective_count` questions with raw fallback and `explanation == ""`.
     4. `test_all_batches_failure_raises`: All batches fail -> raises `RuntimeError` with Vietnamese message.
     5. `test_emit_progress_is_thread_safe`: 50 threads calling `emit_progress` concurrently -> all lines parse valid JSON.
   - WP8 Tests (5 tests):
     1. `test_salvage_truncated_json_recovers_complete_objects`: JSON cut off after 3 complete objects -> recovers 3 questions.
     2. `test_salvage_returns_none_on_unrecoverable`: JSON cut off mid-first object -> returns `None`.
     3. `test_retry_uses_zero_temperature_after_json_error`: Mock urlopen, 1st call invalid JSON, 2nd call valid -> assert 2nd call payload has `"temperature": 0.0`.
     4. `test_http_401_does_not_retry`: HTTP 401 error -> assert urlopen called exactly 1 time, no retry.
     5. `test_no_hardcoded_api_key_in_source`: Read `quiz_pipeline.py` text -> assert regex `sk-[A-Za-z0-9]{20,}` has 0 matches.

3. Execute and verify all checks:
   - `python engines/quiz/test_quiz_pipeline_v2.py` (Must be 35/35 passing).
   - `python engines/quiz/test_mcq_parser.py` (19/19 passing).
   - `python engines/quiz/test_adversarial_wp2.py` (20/20 passing).
   - `cd server && npx tsc --noEmit` (0 errors).
   - `cd server && npx vitest run` (100% passing).
   - `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/` (0 matches).

4. Write detailed `handoff.md` in your working directory and notify the parent orchestrator with send_message.
