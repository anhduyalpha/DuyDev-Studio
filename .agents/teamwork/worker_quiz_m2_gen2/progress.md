# Progress - worker_quiz_m2_gen2

Last visited: 2026-10-04T07:13:50Z

## Milestone 2 (WP3 & WP8) Status: IMPLEMENTED & VERIFIED

### Completed Items:
1. Checked and verified all WP3 & WP8 implementation logic in `engines/quiz/quiz_pipeline.py`:
   - `_EMIT_LOCK = threading.Lock()` and thread-safe `emit_progress`.
   - `BATCH_SIZE = 5`.
   - `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))` with `ThreadPoolExecutor` for micro-batching.
   - Index-preserved result collection (`results: list[list[dict] | None] = [None] * len(batches)`).
   - Controlled graceful degradation (`_guess_answer_from_raw`, falling back to raw parsed blocks if single batch fails; raising if all fail).
   - `_build_phase1_prompt` sending structured JSON (omitting stem detection & explanation from system prompt).
   - `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")` (zero hardcoded secrets).
   - `_salvage_truncated_json` recovering complete objects from truncated JSON.
   - `call_agnes_api`: timeout default 90s, dynamic `Request` creation inside retry loop, separate catch for `json.JSONDecodeError` with salvage and retry at `temperature: 0.0`, fast-fail on HTTP 401.

2. Appended 10 new unit tests to `engines/quiz/test_quiz_pipeline_v2.py`:
   - WP3 Tests (5 tests):
     - `test_batches_run_in_parallel` (Passed - elapsed < 2.0s with 4 workers)
     - `test_result_order_independent_of_completion_order` (Passed - out-of-order completion preserves monotonic ordering)
     - `test_partial_batch_failure_degrades_gracefully` (Passed - 1 failed batch falls back to raw blocks without aborting)
     - `test_all_batches_failure_raises` (Passed - all failed batches raise RuntimeError)
     - `test_emit_progress_is_thread_safe` (Passed - 50 concurrent threads output valid single-line JSON)
   - WP8 Tests (5 tests):
     - `test_salvage_truncated_json_recovers_complete_objects` (Passed - recovers 3 completed questions)
     - `test_salvage_returns_none_on_unrecoverable` (Passed - unrecoverable/empty strings return None)
     - `test_retry_uses_zero_temperature_after_json_error` (Passed - retry payload uses temperature: 0.0 and compact instruction)
     - `test_http_401_does_not_retry` (Passed - exactly 1 call, raises immediately)
     - `test_no_hardcoded_api_key_in_source` (Passed - 0 matches for sk-[A-Za-z0-9]{20,})

3. Verification Completed:
   - `python engines/quiz/test_quiz_pipeline_v2.py`: 35/35 passing (0 failed, 0 skipped).
   - `python engines/quiz/test_mcq_parser.py`: 19/19 passing.
   - `python engines/quiz/test_adversarial_wp2.py`: 20/20 passing.
   - `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/`: 0 matches.
   - `cd server && npx tsc --noEmit`: 0 errors.
