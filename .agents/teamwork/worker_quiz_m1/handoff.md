# Handoff Report — Worker 1 (Polyglot Pipeline Implementation Specialist)

**Milestone**: Milestone 1 (WP1 & WP2) — Quiz Pipeline v3.0 Upgrade  
**Sender**: Worker 1 (`teamwork_preview_worker`)  
**Recipient**: Parent Orchestrator (`82523155-5971-4e42-a66e-a71df58f4d82`) / Reviewer Auditor  
**Type**: Hard Handoff (Tasks Complete)  
**Date**: 2026-10-03  

---

## 1. Observation

1. **Baseline State**:
   - Running `python engines/quiz/test_quiz_pipeline_v2.py` before any edits showed:
     `Ran 22 tests in 0.082s - OK`.
   - Running `cd server && npx tsc --noEmit` showed 0 errors.

2. **Creation of `engines/quiz/text_utils.py` (WP1)**:
   - Created `engines/quiz/text_utils.py` containing verbatim definitions of:
     - `is_section_banner(text: str) -> bool`
     - `strip_section_banner(text: str) -> str`
     - `clean_image_markers(text: str) -> str`
   - Pure standard library regex dependencies (`import re`), zero circular imports.

3. **Creation of `engines/quiz/mcq_parser.py` (WP1)**:
   - Created `engines/quiz/mcq_parser.py` containing:
     - `parse_mcq_blocks(text: str) -> list[dict]`
     - `count_available_questions(text: str) -> int`
   - Contract compliance: Returns dict with keys `source_number` (int), `stem` (str), `options` (dict with A, B, C, D), `confidence` ("high" | "low"), `raw` (str).
   - Enforces ascending option state machine (`expected = ["A", "B", "C", "D"]`, `idx = 0..4`) to prevent premature matching on abbreviations in stems (such as "Vitamin D.").
   - Uses lookbehind `(?<=\s)|^` to avoid matching inside compound tokens like `phenolB.y`.
   - Preserves `[IMAGE_REF: ...]` inside `stem`.

4. **Creation of `engines/quiz/test_mcq_parser.py` (WP1)**:
   - Implemented 14 comprehensive unit test cases covering dot delimiter, parenthesis, colon, same-line options, abbreviations in stem, embedded labels in words, missing option D, empty option values, `[IMAGE_REF: ...]` preservation, trailing section banner stripping, empty/preamble-only input, question count matching parse length, source number preservation, and low-confidence block retention.
   - Command: `python engines/quiz/test_mcq_parser.py`
   - Result: `Ran 14 tests in 0.004s - OK`.

5. **Modification of `engines/quiz/quiz_pipeline.py` (WP1 & WP2)**:
   - Line 25-28: Added `import hashlib`, `from text_utils import is_section_banner, strip_section_banner, clean_image_markers`, and `from mcq_parser import parse_mcq_blocks, count_available_questions`.
   - Removed duplicate definitions of `is_section_banner` and `strip_section_banner` (previously lines 173-205).
   - Removed duplicate definition of `clean_image_markers` (previously lines 456-462).
   - Added `_stem_fingerprint(q: dict) -> str` (stripping HTML tags, numbering prefixes `Câu X:` or `X.`, and whitespace, hashed via SHA1).
   - Updated `parse_and_standardize_questions` signature with `parsed_blocks: list[dict] | None = None`.
   - Implemented early question count check: if `available == 0`, raises `RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")` without calling Agnes AI.
   - Clamped `effective_count = min(count, available)`.
   - Set `BATCH_SIZE = 5` and calculated `remaining = effective_count`.
   - Sliced `windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]`.
   - Dropped the `else raw_text` fallback completely; enforced `assert len(windows) == len(batches)`.
   - Implemented post-batch deduplication via `_stem_fingerprint`.
   - Clamped final results to `all_questions = all_questions[:effective_count]`.
   - Overrode AI-generated numbers with strict monotonic sequence `q["number"] = start_num + i`.
   - In `run_pipeline`: Parsed `parsed_blocks = parse_mcq_blocks(raw_text)` once, passed to `parse_and_standardize_questions`, and passed `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]` to `link_assets_to_questions`.
   - In CLI `main()` exception handler: Changed to `sys.stderr.write(f"{err_msg}\n")` to preserve specific page descriptions.
   - PRESERVED INTACT: `chunk_questions_sliding_window` remains defined at lines 885-925 without any modifications.

6. **Appending 3 Unit Tests to `engines/quiz/test_quiz_pipeline_v2.py` (WP2)**:
   - Left all 22 existing tests untouched (lines 1-477).
   - Appended 3 new tests:
     - `test_no_duplicate_questions_when_count_exceeds_available`: Text with 10 questions, requested `count=20`. Verified result length is exactly 10, numbers 1..10, 0 duplicate stems, and exactly 2 API calls (10÷5).
     - `test_sequential_numbering_overrides_ai_numbers`: AI returns numbers 5, 99, 2. Verified output numbers are strictly 1..3 (or 18..20).
     - `test_zero_questions_raises_before_any_api_call`: Preamble text with 0 questions. Verified Vietnamese `RuntimeError("Không có câu hỏi trong Trang 1-2, vui lòng chọn lại.")` is raised with 0 API calls.
   - Command: `python engines/quiz/test_quiz_pipeline_v2.py`
   - Result: `Ran 25 tests in 0.091s - OK` (22 legacy + 3 new).

7. **Server Verification**:
   - `cd server && npx tsc --noEmit` -> 0 errors.
   - `cd server && npx vitest run` -> 45 test files passed (45/45), 494 tests passed (494/494), 0 failed in 69.64s.

---

## 2. Logic Chain

1. **Decoupled Architecture (Linking Obs 2, 3, 5)**:
   Extracting `is_section_banner`, `strip_section_banner`, and `clean_image_markers` into `text_utils.py` and re-exporting them in `quiz_pipeline.py` prevents circular dependencies between `quiz_pipeline` and `mcq_parser`, while maintaining 100% backward compatibility for all test files importing those utilities from `quiz_pipeline`.
2. **Root-Cause Elimination of Duplicate Questions (Linking Obs 5, 6)**:
   In legacy code, when `count > available`, `batches` exceeded `windows`, causing line 1102 to fall back to `raw_text`. Agnes AI re-extracted earlier questions with numbers 13..20. By determining `available` via `parse_mcq_blocks` before invoking AI, clamping `effective_count = min(count, available)`, deriving `batches` and `windows` solely from `effective_count`, and removing the `else raw_text` fallback, the condition that triggered duplicates is mathematically eliminated.
3. **Defense-in-Depth Deduplication & Sequential Numbering (Linking Obs 5, 6)**:
   Even if an AI model hallucinated questions across batches, the SHA1 fingerprinting on normalized stems (`_stem_fingerprint`) prunes duplicate questions. Clamping `all_questions[:effective_count]` guarantees the list length never exceeds available questions. Overriding question numbers with `start_num + i` guarantees strict sequential numbering regardless of AI outputs.
4. **Visual Asset Alignment Preservation (Linking Obs 5)**:
   `asset_map` maps diagram IDs to the original question numbers in the PDF document (`source_number`). By passing `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]` into `link_assets_to_questions`, diagrams remain accurately associated with their corresponding questions even after sequential renumbering.
5. **Fast Failure & Clear User Reporting (Linking Obs 5, 6)**:
   Checking `available == 0` before any AI API call saves 90-180 seconds of latency and unnecessary token usage. Emitting `sys.stderr.write(f"{err_msg}\n")` preserves the page description (`Trang X`) for `server/src/workers/quiz.worker.ts:cleanQuizErrorMessage`.

---

## 3. Caveats

1. **Scope Boundary**: KaTeX offline vendoring and PDF printing race condition fixes belong to Milestone 2 (WP5). Concurrency scaling (4 parallel threads via `ThreadPoolExecutor`) and dynamic retry logic belong to WP3/WP8.
2. **Backwards Compatibility**: `chunk_questions_sliding_window` is retained solely for legacy test compatibility; `parse_and_standardize_questions` now slices directly from `parsed_blocks`.
3. **No Caveats on Implementation**: All requirements of WP1 and WP2 have been executed and tested without regressions.

---

## 4. Conclusion

Milestone 1 (WP1 & WP2) is completely implemented and verified:
- P0 bug (duplicate questions when `count > available`) is permanently resolved.
- 0 questions fast-fails immediately with 0 AI API calls.
- All question numbering is strictly sequential from `start_num`.
- Visual diagrams map accurately to original PDF question numbers.
- 100% test pass rate achieved across 39 unit tests (14 new in `test_mcq_parser.py`, 25 in `test_quiz_pipeline_v2.py`) and 494 server tests in Vitest.

---

## 5. Verification Method

To independently verify Worker 1's deliverables, execute the following commands from repository root:

1. **Verify new MCQ Parser (WP1)**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   ```
   *Expected*: `Ran 14 tests in 0.004s - OK`.

2. **Verify Quiz Pipeline Engine & Duplicate Bugfix (WP1 & WP2)**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Expected*: `Ran 25 tests in ~0.09s - OK` (22 legacy + 3 new WP2 tests).

3. **Verify Re-exports**:
   ```bash
   python -c "import sys; sys.path.insert(0, 'engines/quiz'); from quiz_pipeline import is_section_banner, strip_section_banner, clean_image_markers, parse_mcq_blocks, count_available_questions; print('ALL EXPORTS VERIFIED')"
   ```
   *Expected*: `ALL EXPORTS VERIFIED`.

4. **Verify Server Typecheck & Vitest Suite**:
   ```bash
   cd server && npx tsc --noEmit
   cd server && npx vitest run
   ```
   *Expected*: `tsc` exits 0 with no errors; Vitest reports 45/45 passed, 494/494 passed.

5. **Static Integrity Audit**:
   ```bash
   git diff --name-only
   ```
   *Expected*: Only `engines/quiz/quiz_pipeline.py` and `engines/quiz/test_quiz_pipeline_v2.py` modified in `engines/quiz/`. No existing tests modified or removed.
