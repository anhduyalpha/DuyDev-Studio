# Handoff Report: Milestone 1 (WP2 - P0) Duplicate Question Bugfix Specialist

- **Role**: Explorer 2 (Duplicate Bugfix Specialist)
- **Status**: Complete (Hard Handoff)
- **Target Files**:
  - `engines/quiz/quiz_pipeline.py` (lines 1036–1158, 1904–1912)
  - `engines/quiz/test_quiz_pipeline_v2.py`
- **Dependencies**: `mcq_parser.py` (WP1 output: `parse_mcq_blocks`)

---

## 1. Observation

1. **Vulnerable Batch Scheduling and Fallback**:
   - In `engines/quiz/quiz_pipeline.py:1080-1087`:
     ```python
     remaining = count
     while remaining > 0:
         b_count = min(remaining, BATCH_SIZE)
         b_end = curr_start + b_count - 1
         batches.append((curr_start, b_end, b_count))
         curr_start += b_count
         remaining -= b_count
     ```
   - In `engines/quiz/quiz_pipeline.py:1096`:
     ```python
     windows = chunk_questions_sliding_window(raw_text, target_count=count, window_size=BATCH_SIZE)
     ```
   - In `engines/quiz/quiz_pipeline.py:1102`:
     ```python
     w_text = windows[b_idx][2] if b_idx < len(windows) else raw_text
     ```
   - In `engines/quiz/quiz_pipeline.py:948-950` (`chunk_questions_sliding_window`):
     ```python
     if len(segments) <= window_size:
         clean_full = "\n\n".join(segments[:target_count])
         return [(1, min(len(segments), target_count), clean_full)]
     ```
   - When a document has 10 questions and the user requests `count=20` with `BATCH_SIZE=12`:
     - `batches` produces 2 entries: `[(1, 12, 12), (13, 20, 8)]` (`len(batches) == 2`).
     - `windows` produces 1 entry (`10 <= 12`): `[(1, 10, clean_full)]` (`len(windows) == 1`).
     - In iteration 1 (`b_idx=1`), `b_idx < len(windows)` evaluates to `False`. Line 1102 selects `raw_text` (the entire document).
     - Agnes AI receives prompt to extract up to 8 questions and renumber 13 to 20 from `raw_text`, extracting questions 1..8 again.
     - Total questions returned: 18 questions, with questions 13–20 being duplicates of 1–8.

2. **Absence of Deduplication and Unconstrained Question Renumbering**:
   - In `engines/quiz/quiz_pipeline.py:972-979`:
     ```python
     num = q.get("number")
     if not isinstance(num, int):
         m = re.search(r"\d+", str(num))
         if m:
             num = int(m.group(0))
         else:
             num = fallback_num
     q["number"] = num
     ```
     `normalize_question` trusts AI numbers when they are integers.
   - In `engines/quiz/quiz_pipeline.py:1145-1149`:
     All questions returned by AI batches are appended without stem deduplication or length clamping.

3. **Late RuntimeError on Zero Questions**:
   - In `engines/quiz/quiz_pipeline.py:1139-1143`:
     ```python
     if not batch_qs:
         if all_questions:
             break
         desc = pages_desc if pages_desc else "trang đã chọn"
         raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
     ```
     Zero-question check occurs only AFTER calling Agnes AI API, causing up to 180s delay and wasted API tokens.

4. **Asset Mapping Invariant in `run_pipeline`**:
   - In `engines/quiz/quiz_pipeline.py:537-546` (`link_assets_to_questions`):
     Sequential index mapping requires `source_nums[idx]` to match the original question number from the PDF (`asset_map`), not the newly renumbered index.
   - In `engines/quiz/quiz_pipeline.py:1910`:
     `link_assets_to_questions(questions, extracted_assets, asset_map, source_q_nums)` currently passes `source_q_nums` from regex in `extract_raw_pages`.

5. **Existing Test Suite Baseline**:
   - Command: `python engines/quiz/test_quiz_pipeline_v2.py`
   - Result: 22 tests run, 0 failures, 0 errors in 0.079s.
   - Tests `test_sliding_window_chunking` (line 131) and `test_chunk_questions_sliding_window_strips_trailing_section_banner` (line 420) directly call `chunk_questions_sliding_window`.
   - `parse_and_standardize_questions` is currently NOT tested in `test_quiz_pipeline_v2.py`.

---

## 2. Logic Chain

1. **Causation of Duplication (Linking Obs 1 & Obs 2)**:
   Because `remaining` was initialized to user input `count` rather than available questions, the loop generated extra batches. Because `windows` was smaller than `batches`, iteration 1 executed the `else raw_text` branch. Agnes AI obeyed the prompt instructions and re-extracted questions from the start of the document with numbers 13..20. Because no stem deduplication or count clamping existed, and `normalize_question` preserved AI numbers, 18 questions (with 8 duplicate items) were returned to the user.

2. **Resolution Mechanism (7 Required Changes)**:
   - *Step 1*: Calling `parse_mcq_blocks(raw_text)` immediately detects available questions. If 0, fast-fail with `RuntimeError` before any AI API call (resolves Obs 3). Clamping `effective_count = min(count, available)` prevents any overshoot.
   - *Step 2*: Partitioning `batches` from `effective_count` guarantees `len(batches)` matches the exact number of batches required for real questions. Standardizing `BATCH_SIZE = 5` matches §WP2 and prepares for §WP3.
   - *Step 3 & 4*: Slicing `windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]` produces identical length to `batches`. Eliminating `else raw_text` and asserting `len(windows) == len(batches)` mathematically removes the possibility of fallback duplication.
   - *Step 5*: SHA1 fingerprinting on question stems (after stripping HTML tags, leading numbering prefixes, and whitespace) provides a second defense line against any duplicate questions across batches.
   - *Step 6*: Clamping `all_questions = all_questions[:effective_count]` ensures output length never exceeds available questions.
   - *Step 7*: Post-processing `q["number"] = start_num + i` overrides all AI-generated numbers, ensuring strictly sequential indexing from `start_num`.

3. **Preserving Backwards Compatibility (Linking Obs 5)**:
   `chunk_questions_sliding_window` must not be deleted or modified in signature because existing tests (lines 131 and 420) test it directly. Only calls inside `parse_and_standardize_questions` are replaced.

4. **Preserving Visual Asset Mapping (Linking Obs 4)**:
   Calling `parsed_blocks = parse_mcq_blocks(raw_text)` in `run_pipeline`, passing it down to `parse_and_standardize_questions(..., parsed_blocks=parsed_blocks)`, and passing `[b["source_number"] for b in parsed_blocks][:effective_count]` as `source_nums` to `link_assets_to_questions` preserves visual asset alignment for renumbered questions without redundant parsing.

---

## 3. Caveats

1. **Dependency on WP1 (`mcq_parser.py`)**:
   `quiz_pipeline.py` requires `parse_mcq_blocks` from `engines/quiz/mcq_parser.py`. If `mcq_parser.py` is not yet on disk, WP1 must be completed and committed before WP2 code can execute.
2. **Batch Size Selection in WP2 vs WP3**:
   The plan specifies `BATCH_SIZE = 5` in WP3, but §WP2 test requirements (`10 câu thật, count=20 | ra đúng 10 câu, đúng 2 API call (10÷5)`) require `BATCH_SIZE = 5` in `parse_and_standardize_questions` so that 10 questions yield exactly 2 batches. Implementing `BATCH_SIZE = 5` in WP2 is completely safe because no existing tests call `parse_and_standardize_questions`.
3. **Exact Error String Match**:
   `quiz.worker.ts:77-87` relies on the exact Vietnamese string: `"Không có câu hỏi trong ..., vui lòng chọn lại."`. The error message format must not be altered.

---

## 4. Conclusion

The duplicate question bug is fully understood and diagnosed. The 7-step remediation strategy in §WP2 is completely designed and specified with exact diffs in `analysis.md`.
The implementation can be executed with zero regressions on existing tests, 100% adherence to AGENTS.md, and complete resolution of P0-1.

---

## 5. Verification Method

1. **Pre-flight verification**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   Must pass 22/22 tests with 0 errors.

2. **Post-implementation verification (WP1 + WP2)**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   Must pass 25/25 tests (22 legacy tests + 3 new WP2 unit tests).
   - Test 1: `test_no_duplicate_questions_when_count_exceeds_available` -> 10 questions, 2 API calls, no duplicate stems.
   - Test 2: `test_sequential_numbering_overrides_ai_numbers` -> overrides AI numbers to sequential `1..N` or `start_num..start_num+N-1`.
   - Test 3: `test_zero_questions_raises_before_any_api_call` -> raises Vietnamese `RuntimeError`, 0 API calls.

3. **Backend Typecheck**:
   ```bash
   cd server && npx tsc --noEmit
   ```
   Must exit with 0 errors.

4. **Invalidation Conditions**:
   - If `test_sliding_window_chunking` fails, `chunk_questions_sliding_window` was mistakenly modified or removed.
   - If `test_zero_questions_raises_before_any_api_call` registers `mock_api.call_count > 0`, the early count check was bypassed.
   - If `test_no_duplicate_questions_when_count_exceeds_available` returns > 10 questions or duplicate stems, clamping or dedup failed.
