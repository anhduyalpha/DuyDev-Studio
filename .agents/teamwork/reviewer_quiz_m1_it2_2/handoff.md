# Reviewer 2 Handoff Report — Milestone 1 Iteration 2

- **Agent**: Reviewer 2 (`reviewer_quiz_m1_it2_2`)
- **Roles**: reviewer, critic
- **Milestone**: Milestone 1 Iteration 2 (WP1 Remediation & Regression Review)
- **Target Deliverables**:
  - `engines/quiz/mcq_parser.py`
  - `engines/quiz/test_mcq_parser.py`
  - `engines/quiz/quiz_pipeline.py`
  - `engines/quiz/test_quiz_pipeline_v2.py`
  - `engines/quiz/text_utils.py`
  - `engines/quiz/test_adversarial_wp2.py`
- **Date**: 2026-10-03T16:48:00Z
- **Verdict**: **`APPROVE`**

---

## 1. Observation

### Observation 1.1: Git Diff & Test Preservation in `test_quiz_pipeline_v2.py`
- Command: `git diff --stat engines/quiz/test_quiz_pipeline_v2.py`
- Output:
  ```text
  engines/quiz/test_quiz_pipeline_v2.py | 104 ++++++++++++++++++++++++++++++++++
  1 file changed, 104 insertions(+)
  ```
- Command: `git grep -c "def test_" HEAD:engines/quiz/test_quiz_pipeline_v2.py`
  - Result: 22 tests in HEAD.
- Command: `grep -c "def test_" engines/quiz/test_quiz_pipeline_v2.py`
  - Result: 25 tests in working tree.
- Verbatim line inspection: Lines 1–476 of `engines/quiz/test_quiz_pipeline_v2.py` are 100% untouched. Exactly 0 lines were modified or deleted from the original 22 test cases. The 3 new test cases appended at lines 479–579 verify:
  1. `test_no_duplicate_questions_when_count_exceeds_available` (lines 481–540)
  2. `test_sequential_numbering_overrides_ai_numbers` (lines 542–566)
  3. `test_zero_questions_raises_before_any_api_call` (lines 568–587)

### Observation 1.2: Error Handling Contract on Zero-Question Inputs
- Location: `engines/quiz/quiz_pipeline.py:1047-1054`
- Verbatim code:
  ```python
  if parsed_blocks is None:
      parsed_blocks = parse_mcq_blocks(raw_text)
  available = len(parsed_blocks)
  if available == 0:
      desc = pages_desc or "trang đã chọn"
      raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
  effective_count = min(count, available)
  ```
- Fast-fail verification: Verified that if `available == 0`, `RuntimeError` is raised immediately before batching logic (line 1056), thread pool instantiation, or any API call. `mock_api.call_count` is verified to be strictly `0`.

### Observation 1.3: Integrity Audit (No Facades or Hardcoded Values)
- Source inspection of `engines/quiz/mcq_parser.py`:
  - Scanned for test stems and expected mock values ("Vitamin A", "phenolB", "quỳ tím", "HCl", "CH4", "Oxi", "ruồi giấm", "tam giác ABC", "A. thaliana", "Oxyz", "Điểm B").
  - Result: Exactly 0 hardcoded test phrases found.
  - The implementation uses general regex boundaries (`BOUNDARY`, `NUM`, `OPT`) and an ordered 4-tuple candidate scoring algorithm (`score_tuple` evaluating `newline_score`, `-sub_delims`, and `mA.start()`).

### Observation 1.4: Test Suite Execution Results
1. `python engines/quiz/test_mcq_parser.py`:
   ```text
   Ran 19 tests in 0.009s
   OK
   ```
2. `python engines/quiz/test_quiz_pipeline_v2.py`:
   ```text
   Ran 25 tests in 0.115s
   OK
   ```
3. `python engines/quiz/test_adversarial_wp2.py`:
   ```text
   Ran 20 tests in 0.024s
   OK
   ```
4. `python .tmp/adversarial_mcq_test.py`:
   ```text
   ADVERSARIAL STRESS TEST FINAL RESULT: 20 PASSED, 0 FAILED
   ```
5. `python .tmp/reviewer2_independent_audit.py` (Reviewer 2 independent suite):
   ```text
   Ran 9 tests in 0.013s
   OK
   ```
6. Server TypeScript Compilation: `cd server && npx tsc --noEmit`:
   ```text
   Exit code 0 (0 errors)
   ```
7. Server Vitest Suite: `cd server && npx vitest run`:
   ```text
   Test Files: 45 passed (45)
   Tests: 494 passed (494)
   Duration: 75.36s
   Exit code 0
   ```

---

## 2. Logic Chain

1. **Regression Safety Guarantee**:
   - `git diff` confirms zero lines removed or altered in original test suites (`0 deletions, 104 insertions`).
   - Running `engines/quiz/test_quiz_pipeline_v2.py` executes all 22 original tests and 3 new tests, completing in 0.115s with 100% PASS. No regressions exist.

2. **Deterministic Pre-Parser & Candidate Scoring Correctness**:
   - The greedy sequential regex flaw from Iteration 1 has been replaced by `mcq_parser.py:44-78`.
   - By collecting all candidates `OPT.finditer(seg)` and filtering for strictly ordered 4-tuples $(m_A, m_B, m_C, m_D)$ where $m_A.end() \le m_B.start() \le m_C.start() \le m_D.start()$, the parser evaluates all structurally possible interpretations.
   - The ranking function `score_tuple` prioritizes line-starting option markers (`newline_score`) and heavily penalizes unconsumed line-starting markers trapped inside option bodies (`-sub_delims`). In the event of ties (e.g. same-line options), it selects the latest $m_A.start()$, safely preserving inline abbreviations in question stems.
   - Independent testing verified edge cases such as circuit nodes `A, B, C, D` in stem text, LaTeX vector dot products (`\vec{A}. \vec{B} = 0`), space-delimited headers (`Câu 14 `), and biological binomial nomenclature (`A. thaliana`).

3. **Fast-Fail Error Contract & API Shielding**:
   - When given zero-question inputs (empty strings, preamble headers, non-MCQ text), `parse_mcq_blocks` returns `[]`.
   - `parse_and_standardize_questions` raises `RuntimeError("Không có câu hỏi trong ..., vui lòng chọn lại.")` at line 1052, prior to executing any AI batches.
   - Stderr contract in `main()` catches and outputs the error cleanly with exit code 1.

4. **Clamping, Monotonic Renumbering & Deduplication**:
   - `effective_count = min(count, available)` prevents requesting or manufacturing phantom questions.
   - Slicing `windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]` eliminates the legacy fallback branch `else raw_text`, completely preventing duplicate chunk injection.
   - Post-AI SHA1 dedup on normalized question stems (`_stem_fingerprint`) strips HTML tags, question number prefixes, whitespace, and case differences, eliminating duplicate questions even if AI generates erratic variations.
   - Sequential renumbering (`q["number"] = start_num + i`) guarantees an uninterrupted monotonically increasing sequence independent of AI output numbers.

5. **Server & Gateway Compatibility**:
   - TypeScript compilation (`npx tsc --noEmit`) passes with 0 errors.
   - Vitest suite executes 45 test files and 494 unit/integration tests with 100% pass rate.

---

## 3. Caveats

- **No Caveats**: The remediation satisfies all requirements outlined in `ORIGINAL_REQUEST.md` and `docs/QUIZ_PIPELINE_UPGRADE_PLAN.md` without introducing regressions, facades, or architectural compromises.

---

## 4. Conclusion

Worker 2's remediation deliverables for Milestone 1 Iteration 2 are **production-ready**, robust, and fully verified.
- Integrity: 100% genuine algorithmic logic; zero hardcoded mock solutions or shortcuts.
- Regression safety: 22 original tests untouched; 25/25 passing.
- Fast-fail contract: Deterministically guarded before any API invocation.
- Server health: TypeScript and Vitest passing with 0 errors.

**Official Verdict**: **`APPROVE`**

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Check 22 Original Tests Untouched**:
   ```powershell
   git diff --stat engines/quiz/test_quiz_pipeline_v2.py
   # Confirms 104 insertions, 0 deletions
   ```

2. **Run MCQ Parser Tests**:
   ```powershell
   python engines/quiz/test_mcq_parser.py
   # Confirms 19/19 PASSED
   ```

3. **Run Quiz Pipeline v2 Suite**:
   ```powershell
   python engines/quiz/test_quiz_pipeline_v2.py
   # Confirms 25/25 PASSED
   ```

4. **Run Adversarial WP2 Stress Suite**:
   ```powershell
   python engines/quiz/test_adversarial_wp2.py
   # Confirms 20/20 PASSED
   ```

5. **Run Reviewer 2 Independent Audit Suite**:
   ```powershell
   python .tmp/reviewer2_independent_audit.py
   # Confirms 9/9 PASSED
   ```

6. **Run TypeScript Check & Server Tests**:
   ```powershell
   cd server
   npx tsc --noEmit
   npx vitest run tests/unit/quiz.test.ts tests/unit/quiz_history.test.ts tests/unit/quiz_prompt.test.ts
   ```
