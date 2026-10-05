# Agent Handoff

## Current task
`PLAN-04 — Extraction Window Planner (TASK-05)`

## Status
`DONE — PASS (AUDITED, REPAIRED & VERIFIED)`

---

## PLAN-04 Implementation Summary

### 1. Objective Achieved
Implemented and hardened the Extraction Window Planner capable of deterministically planning physical extraction windows across complex documents with:
- **Printed-Page vs Physical-Page Reconciliation**: Reconciles logical printed page numbers to physical page indices across multiple header/footer patterns (`Trang 40`, `Page 40`, `Trang: 40`, `Trang số 40`, `Trang 40/50`, `- 40 -`) using bounding-box spatial geometry and raw text scanning without artificial page boundary limits (`_find_page_by_printed_page_number`).
- **Bi-Directional Cross-Page Boundary Continuation Stitching**:
  - **Inward Alignment (Stem Continuation)**: Automatically aligns `start_page` back to where a question stem begins when a question is split across page boundaries (e.g. Câu 41 starts at the bottom of physical Page 1 while its options and Linoleic acid structure diagram are on physical Page 2). Works for both explicit question queries and single-page queries (Case C).
  - **Outward Expansion (Trailing Option Continuation)**: Automatically expands `end_page` by 1 when the final question's options continue onto the next page (e.g. Câu 46 on physical Page 2 has Option D on physical Page 3). Verified across explicit ranges (Case A), count-based ranges (Case B), and single-page requests (Case C).
- **Batch Payload Packaging**: Generates batches with clean text from the entire extraction window while removing running headers, footers, website watermarks, and section banners (`BatchPlanner.plan_batches`).
- **Canonical Post-Processing**: Filters strictly to requested target question bounds `[start_question .. start_question + count - 1]` while guaranteeing all 4 options A, B, C, D are present without placeholders.

---

## Golden Regression Verification: "Trang 40 từ câu 41 đến 46"

### 1. Actual Extraction Window Report
- **Reference Document**: `Gốc.pdf` (`.tmp/Diff check/Gốc.pdf`, 3-page excerpt).
- **User Instruction**: `"Trang 40 từ câu 41 đến 46"`.
- **Numeric Constraint Parsed**:
  - `start_page`: 40 (printed)
  - `start_question`: 41
  - `end_question`: 46
  - `question_count`: 6
- **Physical vs Printed Reconciliation**:
  - Printed page "Trang 40" maps to physical Page 2.
  - Câu 41 stem begins at the bottom of physical Page 1 ("Linoleic acid (có cấu tạo như hình bên)...").
  - `start_page` aligns inward to **physical Page 1**.
  - Câu 46 is on physical Page 2, but its Option D ("1 mol G phản ứng hoàn toàn với Na dư thu được 3 mol H2.") continues onto physical Page 3.
  - `end_page` expands outward to **physical Page 3**.
- **Actual Calculated Extraction Window**:
  - **`start_page`**: `1`
  - **`end_page`**: `3`
  - **`start_question`**: `41`
  - **`question_count`**: `6`
  - **`target_question_numbers`**: `[41, 42, 43, 44, 45, 46]`
  - **`batches`**: `1 batch` (`batch_1_p1-2_cands6`) spanning physical pages `[1, 2, 3]`.
  - **`batch_type`**: `visual_heavy`
  - **`questions extracted`**: Exactly 6 questions (41 to 46), each with all 4 options A, B, C, D.
  - **`rich elements`**: Q41 claims Linoleic acid diagram on Page 2 (`asset_p2_img_83_0`); Q42..46 claim 0 assets.

---

## Verification Test Results

1. **Golden Semantic Fidelity Suite (8/8 tests passed)**:
   - Command: `python -m unittest engines/quiz/tests/test_semantic_fidelity_goc.py -v`
   - Verified:
     - `test_regression_trang_40_tu_cau_41_den_46`: PASS.
     - `test_regression_single_page_trang_40`: PASS.
     - `test_regression_page_range_trang_40_den_41`: PASS.
     - `test_range_resolver_expands_to_page_3_for_q35_q46`: PASS.
     - `test_batch_planner_includes_q46_option_d_continuation`: PASS.
     - `test_mcq_parser_extracts_clean_q46_with_all_four_options`: PASS.
     - `test_recover_missing_mcq_options_recovers_d_from_full_document_context`: PASS.
     - `test_end_to_end_layout_renders_two_pages_with_true_option_d`: PASS.
   - Result: **8/8 PASS (4.04s)**.

2. **Smart Recognition Test Suite (9/9 tests passed)**:
   - Command: `python -m unittest engines/quiz/tests/test_smart_recognition.py -v`
   - Verified:
     - `test_parse_numeric_instruction_formats`: PASS.
     - `test_deterministic_range_expansion`: PASS.
     - `test_explicit_page_range`: PASS.
     - `test_cross_page_continuation_expansion`: PASS.
     - `test_single_page_continuation_expansion`: PASS.
     - `test_printed_page_reconciliation_within_page_bounds`: PASS.
     - `test_printed_page_header_formats`: PASS.
     - `test_ai_fallback_on_ambiguous_instruction`: PASS.
     - `test_traversal_safety_limit`: PASS.
   - Result: **9/9 PASS (0.01s)**.

3. **Full Engine Test Discovery (211/211 tests passed across all 21 test files)**:
   - Command: `python -m unittest discover -s engines/quiz/tests -p "test_*.py"`
   - Result: **211/211 PASS (40.49s, 0 failures, 0 errors)**.

4. **Backend TypeScript Compilation**:
   - Command: `cd server && npx tsc --noEmit`
   - Result: **0 errors (PASS)**.

5. **Backend Vitest Suite (515/515 tests passed across 47 test files)**:
   - Command: `cd server && npx vitest run`
   - Result: **515/515 PASS (77.76s)**.

6. **UI Production Minimalism Compliance**:
   - `src/` directory: **0 files modified, 0 lines changed**.

---

## Files Changed

### Created:
- `docs/PLAN-04-EXTRACTION-WINDOW-PLANNER.md` (complete specification of PLAN-04)

### Modified:
- `engines/quiz/recognition/range_resolver.py`:
  - Removed artificial `start_p > total_pages` constraint for printed page lookup.
  - Enhanced `_find_page_by_printed_page_number` with spatial geometry block search and multiple Vietnamese header/footer patterns.
  - Added inward continuation alignment for implicit question queries (`start_question is None`).
  - Fixed Case C (single page) outward continuation expansion and accurate question counting.
  - Fixed Case A candidate filtering on `start_p` by `start_q`.
- `engines/quiz/tests/test_semantic_fidelity_goc.py`:
  - Added `test_regression_trang_40_tu_cau_41_den_46`.
  - Added `test_regression_single_page_trang_40`.
  - Added `test_regression_page_range_trang_40_den_41`.
- `engines/quiz/tests/test_smart_recognition.py`:
  - Added `test_single_page_continuation_expansion`.
  - Added `test_printed_page_reconciliation_within_page_bounds`.
  - Added `test_printed_page_header_formats`.
- `docs/agent-handoff.md`:
  - Updated documentation with full audit findings, test runs, and verification reports.
