# Handoff Report — Reviewer 2 (Milestone 1: WP1 & WP2)

**Milestone**: Milestone 1 (WP1 & WP2) — Correctness, Error Contract & Test Preservation Review  
**Sender**: Reviewer 2 (`teamwork_preview_reviewer`)  
**Recipient**: Parent Orchestrator (`82523155-5971-4e42-a66e-a71df58f4d82`)  
**Type**: Hard Handoff (Review & Audit Complete)  
**Date**: 2026-10-03  
**Verdict**: **APPROVE**

---

## 1. Observation

1. **Test Preservation & Git Diff Audit**:
   - Inspected `git diff engines/quiz/test_quiz_pipeline_v2.py`.
   - Verified lines 1 to 476 remain 100% untouched. All 22 original test cases are preserved without modifications, skips, or loosened assertions.
   - Verified exactly 3 new test methods were appended to `TestQuizPipelineV2` (lines 479–583):
     - `test_no_duplicate_questions_when_count_exceeds_available`
     - `test_sequential_numbering_overrides_ai_numbers`
     - `test_zero_questions_raises_before_any_api_call`
   - Command: `python engines/quiz/test_quiz_pipeline_v2.py`
   - Result: `Ran 25 tests in 0.089s - OK` (22 legacy + 3 new tests passing).

2. **MCQ Parser & Text Utils Unit Tests (WP1)**:
   - Inspected `engines/quiz/text_utils.py` (50 lines) containing `is_section_banner`, `strip_section_banner`, and `clean_image_markers`.
   - Inspected `engines/quiz/mcq_parser.py` (82 lines) exporting `parse_mcq_blocks` and `count_available_questions`.
   - Inspected `engines/quiz/test_mcq_parser.py` (174 lines) with 14 test cases.
   - Command: `python engines/quiz/test_mcq_parser.py`
   - Result: `Ran 14 tests in 0.004s - OK`.

3. **Re-Export Verification in `quiz_pipeline.py`**:
   - Tested re-export of legacy symbols:
     `from quiz_pipeline import is_section_banner, strip_section_banner, clean_image_markers, parse_mcq_blocks, count_available_questions`
   - Command: `python -c "import sys; sys.path.insert(0, 'engines/quiz'); from quiz_pipeline import is_section_banner, strip_section_banner, clean_image_markers, parse_mcq_blocks, count_available_questions; print('ALL EXPORTS VERIFIED')"`
   - Result: `ALL EXPORTS VERIFIED`.

4. **Error Contract & Fast-Fail Verification**:
   - In `engines/quiz/quiz_pipeline.py`:
     - Line 1051-1054: When `available == 0`, immediately raises:
       `desc = pages_desc or "trang đã chọn"`
       `raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")`
       prior to executing any AI batches or API requests.
     - Lines 2025–2028: CLI `main()` exception handler emits verbatim:
       `sys.stderr.write(f"{err_msg}\n")`
   - In `server/src/workers/quiz.worker.ts:74–87` (`cleanQuizErrorMessage`):
     - `lowerErr.includes('không có câu hỏi')` captures the error.
     - `rawErr.match(/không\s*(?:có|tìm\s*thấy)\s*câu\s*hỏi\s*trong\s*([^,\.]+)/i)` extracts `${pageMatch[1].trim()}` (e.g., `Trang 1-2`).
     - Returns `Không có câu hỏi trong Trang 1-2, vui lòng chọn lại.`.

5. **Server TypeScript & Vitest Suite Compatibility**:
   - Command: `cd server && npx tsc --noEmit`
   - Result: Exit code 0, exactly 0 TypeScript errors.
   - Command: `cd server && npx vitest run tests/unit/quiz.test.ts tests/unit/quiz_history.test.ts tests/unit/quiz_prompt.test.ts`
   - Result: 3 passed test files, 30 passed tests (13 in `quiz.test.ts`, 8 in `quiz_history.test.ts`, 9 in `quiz_prompt.test.ts`), 0 failed.

6. **Adversarial Integrity & Edge Case Stress-Testing**:
   - Integrity scan: Zero hardcoded outputs, zero facade/dummy methods, zero skipped requirements, zero fabricated logs.
   - Tested stem fingerprinting with HTML formatting (`<b>`, `<i>`, `<sub>`, `<sup>`), punctuation, and whitespace variations. All fingerprints match deterministically.
   - Tested ascending option parser under edge cases: identified that capitalized letters matching next option (e.g. `Canh B.`) inside option text can be treated as option delimiters by regex; however, this is fully insulated because `w_text` passed to Agnes AI uses `b["raw"]`.

---

## 2. Logic Chain

1. **Preservation of Baseline Guarantees (Linking Obs 1, 3)**:
   The strict requirement was that all 22 tests in `test_quiz_pipeline_v2.py` must remain completely intact. Git diff inspection confirms 0 edits to lines 1–476. The re-export of `is_section_banner`, `strip_section_banner`, and `clean_image_markers` from `text_utils.py` into `quiz_pipeline.py` maintains seamless backward compatibility for all existing call sites and unit tests.
2. **Deterministic Elimination of Duplicates (Linking Obs 1, 2)**:
   In legacy code, requesting `count=20` on a 10-question page triggered a fallback `else raw_text` in batch 2, causing the AI to re-extract earlier questions and renumber them 13–20.
   In Worker 1's implementation:
   - `available = len(parsed_blocks)` is determined deterministically via regex.
   - `effective_count = min(count, available)` bounds the target count.
   - `batches` and `windows` are sliced directly from `effective_count`, enforcing `len(windows) == len(batches)`.
   - The fallback `else raw_text` is completely eliminated.
   - A secondary SHA-1 stem fingerprinting filter (`_stem_fingerprint`) removes any duplicate stems across batches.
   - Monotonic renumbering (`q["number"] = start_num + i`) guarantees sequential numbering.
3. **Preservation of Visual Diagram Alignment (Linking Obs 1)**:
   `run_pipeline` passes `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]` to `link_assets_to_questions`. This ensures diagrams extracted from PDF spatial coordinates remain associated with the original question numbering from the document, regardless of final sequential renumbering.
4. **Server Error Contract Fidelity (Linking Obs 4, 5)**:
   By removing the blanket error overwrite in `main()` and outputting `sys.stderr.write(f"{err_msg}\n")`, the exact message `Không có câu hỏi trong Trang X, vui lòng chọn lại.` is transmitted across the process boundary to `quiz.worker.ts`, where regex extraction formats it cleanly for the frontend. Full TypeScript compilation and Vitest suites pass with 0 regressions.

---

## 3. Caveats

1. **Scope Division**: Concurrency scaling (WP3: 4 parallel threads via `ThreadPoolExecutor`) and KaTeX offline vendoring (WP5) are designated for subsequent milestones as planned.
2. **Regex Boundary Syntax**: The question boundary regex `BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)` does not match standalone parenthesis format without space (e.g. `Câu 4)`). This pattern was explicitly mandated by the Master Plan to match legacy line 929, so this behavior is by-design and preserves legacy compatibility.
3. **No Implementation Caveats**: All deliverables for Milestone 1 meet or exceed specification requirements.

---

## 4. Conclusion

Worker 1's deliverables for Milestone 1 (WP1 & WP2) are fully verified and meet all architectural, correctness, error handling, and test preservation criteria.
- 0 regressions introduced.
- P0 duplicate question bug is completely resolved.
- Error handling fast-fails with 0 AI API calls on empty questions.
- Server typecheck and unit tests pass with 100% success rate.
- Zero integrity violations detected.

**Final Verdict**: **APPROVE**. Milestone 1 can be merged and the team can proceed to Milestone 2 (WP3 / WP5).

---

## 5. Verification Method

To independently reproduce the verification findings, run:

1. **Verify Python Unit Tests**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Expected*: `test_mcq_parser.py` runs 14 tests (OK); `test_quiz_pipeline_v2.py` runs 25 tests (OK).

2. **Verify Module Re-exports**:
   ```bash
   python -c "import sys; sys.path.insert(0, 'engines/quiz'); from quiz_pipeline import is_section_banner, strip_section_banner, clean_image_markers, parse_mcq_blocks, count_available_questions; print('ALL EXPORTS VERIFIED')"
   ```
   *Expected*: `ALL EXPORTS VERIFIED`.

3. **Verify Server Typecheck & Vitest**:
   ```bash
   cd server && npx tsc --noEmit
   cd server && npx vitest run tests/unit/quiz.test.ts tests/unit/quiz_history.test.ts tests/unit/quiz_prompt.test.ts
   ```
   *Expected*: `tsc` exits 0 with no errors; Vitest reports 3/3 test files passed, 30/30 tests passed.
