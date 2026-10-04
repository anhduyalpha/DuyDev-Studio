# Dispatch for Worker (Milestone 2: WP3 & WP8)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m2
- Identity: teamwork_preview_worker
- Role: Concurrency & Security Implementation Specialist
- Milestone: Milestone 2 (WP3 & WP8)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (§WP3 & §WP8)
- Reference Blueprints:
  - WP3 Micro-Batching: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_batching\handoff.md
  - WP8 Retry & Security: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_retry_security\handoff.md
  - Integration Blueprint: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_integration\handoff.md
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A teamwork_preview_auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

## Tasks to Implement in `engines/quiz/quiz_pipeline.py`:
1. **API Key Hygiene (WP8)**:
   - Line 41: Replace `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "sk-zsaZ9j...")` with:
     `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")`
2. **`emit_progress` Thread-Safety (WP3)**:
   - Add module-level `_EMIT_LOCK = threading.Lock()`.
   - Wrap stdout JSON print in `with _EMIT_LOCK:`.
3. **`call_agnes_api` Smart Retry & Salvage (WP8)**:
   - Set default `timeout: int = 90`.
   - Implement `_salvage_truncated_json(raw: str) -> dict | None` tracking bracket depth to recover complete objects from truncated JSON.
   - Reconstruct `payload` and `urllib.request.Request` *inside* `for attempt in range(...)`.
   - Handle exceptions cleanly:
     - On HTTP 401: fast-fail immediately without retrying.
     - On `json.JSONDecodeError`: attempt `_salvage_truncated_json(raw)`. If recovered, return immediately. Otherwise, retry with `temperature: 0.0` and append compact formatting instructions to user prompt.
     - On HTTP 429: backoff retry as currently implemented.
4. **Structured Phase 1 Prompt & Helpers (WP3)**:
   - Implement `_guess_answer_from_raw(raw: str) -> str`.
   - Implement `_build_phase1_prompt(blocks: list[dict], b_start: int) -> str` sending structured JSON payload.
   - Streamline `system_prompt` per §WP3.
5. **Parallel Micro-Batching with Controlled Degradation (WP3)**:
   - In `parse_and_standardize_questions`:
     - Define `MAX_PARALLEL = int(os.environ.get("QUIZ_AI_CONCURRENCY", "4"))`.
     - Implement single-batch worker `_run_batch(b_idx: int) -> list[dict]`.
     - Execute batches using `concurrent.futures.ThreadPoolExecutor(max_workers=MAX_PARALLEL)`.
     - Aggregate results into `results: list[list[dict] | None] = [None] * len(batches)`.
     - If all batches fail: raise first exception with original message.
     - If partial batches fail: degrade gracefully by filling failed batch slots from `windows[i]` using `_guess_answer_from_raw`.
6. **Append 10 Unit Tests in `engines/quiz/test_quiz_pipeline_v2.py`**:
   - DO NOT modify the 25 existing tests.
   - Append 5 tests for WP3:
     `test_batches_run_in_parallel`, `test_result_order_independent_of_completion_order`,
     `test_partial_batch_failure_degrades_gracefully`, `test_all_batches_failure_raises`,
     `test_emit_progress_is_thread_safe`.
   - Append 5 tests for WP8:
     `test_salvage_truncated_json_recovers_complete_objects`, `test_salvage_returns_none_on_unrecoverable`,
     `test_retry_uses_zero_temperature_after_json_error`, `test_http_401_does_not_retry`,
     `test_no_hardcoded_api_key_in_source`.
7. **Verification**:
   - `python engines/quiz/test_mcq_parser.py` (19/19)
   - `python engines/quiz/test_quiz_pipeline_v2.py` (35/35)
   - `cd server && npx tsc --noEmit` (0 errors)
   - `cd server && npx vitest run` (45/45 suites, 494/494 tests)
   - `rg -n "sk-[A-Za-z0-9]{20,}" engines/quiz/` (0 matches)
   - Write `handoff.md` and notify parent via `send_message`.
