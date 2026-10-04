# Dispatch for Explorer 2 (Milestone 2: WP8 Retry & Security Specialist)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m2_retry_security
- Identity: teamwork_preview_explorer
- Role: Smart Retry & Security Specialist
- Milestone: Milestone 2 (WP8)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (see §WP8)
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio
- Project Scope: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_quiz\PROJECT.md

## Investigation Tasks
Investigate the smart retry and security requirements (WP8) in `engines/quiz/quiz_pipeline.py`:
1. Remove Hardcoded API Key:
   - Line 37: `DEFAULT_API_KEY = os.environ.get("AGNES_AI_API_KEY", "")` (remove any embedded key).
2. Refactor `call_agnes_api`:
   - Reduce default `timeout: int = 180` to `90`.
   - Reconstruct `Request` and payload *inside* the retry loop (`for attempt in range(...)`) so temperature and prompt can be adjusted on retries.
   - Catch `json.JSONDecodeError` separately before generic `Exception`.
3. Truncated JSON Salvage:
   - Implement `_salvage_truncated_json(raw: str) -> dict | None`: find last valid closing object within `"questions"` array, append `"]}"`, and attempt parse.
4. Adjusted Retry:
   - If salvage returns None, retry with `temperature: 0.0` and append compact instruction to prompt.
   - Fast-fail on HTTP 401 (no retry).
5. Design 5 new unit tests for `test_quiz_pipeline_v2.py`:
   - `test_salvage_truncated_json_recovers_complete_objects`
   - `test_salvage_returns_none_on_unrecoverable`
   - `test_retry_uses_zero_temperature_after_json_error`
   - `test_http_401_does_not_retry`
   - `test_no_hardcoded_api_key_in_source`
6. Write findings to `analysis.md` and `handoff.md`.

## 2026-10-03T16:50:37Z
You are Explorer 2 for Milestone 2 (WP8 Smart Retry & Security Specialist).
Investigate removal of hardcoded API key, call_agnes_api refactoring (timeout 90s, dynamic Request inside retry loop), truncated JSON salvage, and the 5 new unit tests. Write analysis.md and handoff.md, then report to parent via send_message.
