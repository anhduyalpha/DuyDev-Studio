# Agent Handoff

## Current task
`PLAN-05 — Page Neighborhood Scanner + Question Index`

## Status
`DONE — PASS (SKEPTICALLY AUDITED, BUGS RESOLVED & FULLY VERIFIED)`

---

## PLAN-05 Implementation & Audit Summary

### 1. Objective Achieved
Implemented the Page Neighborhood Scanner & Question Index layer running strictly **prior to extraction and reconstruction**, guaranteeing that any requested question range is completely accounted for before processing, eliminating silent partial drops:
- **Full-Page Question Inventory (`build_page_index`)**:
  - Scans target physical pages deterministically using spatial layout and text block geometry without requiring external AI provider calls.
  - Populates `QuestionIndexEntry` records tracking physical pages, bounding boxes, text spans, detection methods, and option markers (`A, B, C, D`).
- **Two-Column Layout Reading Order Awareness**:
  - Identifies two-column examination layouts via block spatial coordinate clustering across the horizontal midpoint.
  - Enforces column-aware reading order (left column top-to-bottom, followed by right column top-to-bottom) preventing interleaving between columns.
- **Lightweight Page Neighborhood Scanner (`build_neighborhood_index`)**:
  - Targets requested physical page while scanning lightweight boundary context:
    - **Previous Page**: Detects if a question stem began on the preceding page and continues onto the target page (inward continuation).
    - **Next Page**: Detects if trailing options for the last question on the target page continue onto the following page (outward continuation).
  - Explicitly categorizes document pages into `target`, `continuation`, and `context`.
  - Derives precise continuation bounding boxes from adjacent questions rather than hardcoded fractions.
- **Target / Continuation / Context Isolation**:
  - Downstream extraction window planners (`BatchPlanner.plan_batches`) and post-processors (`post_process_questions`) strictly filter candidates to `target_question_numbers`.
  - Context pages used for boundary resolution are strictly quarantined and never leak extraneous questions (e.g. Q45 on page 14) into final output.
- **Hard Gate Range Validator (`validate_requested_range` & `build_extraction_plan`)**:
  - Verifies that all expected question numbers `[start_q .. end_q]` are present.
  - If a discrepancy occurs, engages **Missing Question Recovery** (deep regex text span re-scan on target, bidirectional previous AND next neighbor page boundary inspection, targeted vision fallback with full page text context).
  - If questions remain missing, raises `QuizEngineError(ErrorCode.RANGE_MISMATCH)` with `DiagnosticLayer.RECOGNITION_FAILURE` — **never silently proceeds with a partial range**.
- **Atomic Cache Tier (`quiz_cache.py`)**:
  - Caches page question inventories (`q_index_<hash>`) with a 7-day TTL.

---

## What Was Found & Fixed in Second-Pass Review

1. **Missing `next_page` recovery in `_recover_missing_questions`**:
   - *Issue*: Step 2 only inspected `previous_page`. If a requested range spanned into `next_page`, recovery failed to inspect `next_page`.
   - *Fix*: Added bidirectional neighbor scanning checking both `previous_page` and `next_page`, with dynamic continuation role assignment.
2. **Brittle substring matching on neighbor pages**:
   - *Issue*: Used `f"Câu {q_num}"` instead of regex, failing for non-"Câu" prefixes (e.g., "Bài", "Question", "15.").
   - *Fix*: Upgraded to generic multi-pattern regex matching across all recovery stages.
3. **Hardcoded Recovery Bounding Boxes**:
   - *Issue*: Hardcoded `(50, 100, width - 50, 150)` for recovered items.
   - *Fix*: Implemented `_find_question_bbox` to extract real line coordinates from `PageRepresentation.blocks`.
4. **Empty Prompt Input in `_targeted_vision_fallback`**:
   - *Issue*: AI prompt input passed only `page` number and `target_missing_questions` without document text or context.
   - *Fix*: Provided full `page_text`, line count, and image metadata in `prompt_builder.set_input`.
5. **Guard Against Empty `target_pages`**:
   - *Issue*: `target_pages = []` caused `IndexError: list index out of range` in `build_multi_page_neighborhood_index`.
   - *Fix*: Added defensive guard returning empty `PageNeighborhood`.
6. **1-Based AI Renumbering Fallback in `post_processor.py`**:
   - *Issue*: If AI renumbered questions 1..N while requested questions were 30..44, `post_processor` returned empty list.
   - *Fix*: Added canonical mapping fallback when candidate count matches target count.
7. **Distant Backwards Alignment in `range_resolver.py`**:
   - *Issue*: Jumping backwards to distant chapters if a question number matched an earlier exam.
   - *Fix*: Restrained alignment to immediate previous page (`start_p - 1`) or when target page has no candidates.

---

## Production Regression Verification

### 1. Regression Test 1: "Trang 13 câu 30 đến 44"
- **Reference Document**: `.tmp/sample.pdf` (75-page chemistry document, Page 13 contains Câu 30 to Câu 44).
- **User Instruction**: `"Trang 13 câu 30 đến 44"`.
- **Pre-Extraction Inventory**:
  - Target physical page: `13`.
  - Question index on Page 13: 15 questions detected (`[30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44]`).
  - Validation: Expected 15, Detected 15, Missing 0 -> `RANGE_VALID`.
- **Extracted Question Output**: Exactly 15 questions (Q30..Q44).
- **Generated Artifacts**:
  - DeBai PDF: `.tmp/regression_plan05/run_q30_44/REG_Trang13_Q30_44_DeBai.pdf` (92,025 bytes, verified present).
  - DapAn PDF: `.tmp/regression_plan05/run_q30_44/REG_Trang13_Q30_44_DapAn.pdf` (134,606 bytes).

### 2. Regression Test 2: "Trang 13 câu 31 đến 43"
- **User Instruction**: `"Trang 13 câu 31 đến 43"`.
- **Pre-Extraction Inventory**:
  - Target physical page: `13`.
  - Filtered question bounds: Exactly 13 questions (`[31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]`).
  - Validation: Expected 13, Detected 13, Missing 0 -> `RANGE_VALID`.
- **Extracted Question Output**: Exactly 13 questions (Q31..Q43).
  - Q30 is strictly excluded.
  - Q44 is strictly excluded.
- **Generated Artifacts**:
  - DeBai PDF: `.tmp/regression_plan05/run_q31_43/REG_Trang13_Q31_43_DeBai.pdf` (88,790 bytes, verified present).
  - DapAn PDF: `.tmp/regression_plan05/run_q31_43/REG_Trang13_Q31_43_DapAn.pdf` (128,505 bytes).

### 3. Edge Case Boundary & Layout Tests
- **Case C (Inward Continuation)**: Q40 stem starts on Page 1, options on Page 2. Query Q40..41 returns both Q40 and Q41; Page 1 questions (Q39) do not leak.
- **Case D (Outward Continuation)**: Q44 on Page 2 continues with Option D on Page 3. Query Q44 captures Option D from Page 3; Page 3 Q45 does not leak.
- **Case D (Next-Page Missing Recovery)**: Query Q44..Q45 on Page 2 recovers Q45 on Page 3 seamlessly.
- **Case E (Two-Column Layout)**: Left column questions Q1..Q3 and right column questions Q4..Q6 maintain natural top-to-bottom reading order (Q1, Q2, Q3, Q4, Q5, Q6).
- **Case F (Rich-Content Questions)**: Preserves diagrams, drawings, and KaTeX math formulas with exact bounding boxes.
- **Case G (Hard Gate Validation)**: Query Q30..Q44 on a document with only Q41..Q44 triggers hard gate `RANGE_MISMATCH`, preventing silent partial output.
- **Case H (Non-Standard Markers)**: Correctly indexes and recovers questions with "Bài", "Question", or standalone numeric prefixes.

---

## Verification Test Results

1. **PLAN-05 Dedicated Suite (13/13 tests passed)**:
   - Command: `python -m unittest engines/quiz/tests/test_plan05_question_index.py -v`
   - Result: **13/13 PASS (11.99s, 0 failures, 0 errors)**.

2. **Full Quiz Engine Test Discovery (224/224 tests passed across all 22 test files)**:
   - Command: `python -m unittest discover -s engines/quiz/tests -p "test_*.py"`
   - Result: **224/224 PASS (63.21s, 0 failures, 0 errors)**.

3. **Backend TypeScript Compilation**:
   - Command: `cd server && npx tsc --noEmit`
   - Result: **0 errors (PASS)**.

4. **Backend Vitest Unit Suite (463/463 tests passed across 39 test files)**:
   - Command: `cd server && npx vitest run tests/unit`
   - Result: **463/463 PASS (69.96s)**.

5. **UI Production Minimalism Compliance**:
   - `src/` directory: **0 files modified, 0 lines changed**.

---

## Files Changed

### Created:
- `docs/PLAN-05-PAGE-NEIGHBORHOOD-SCANNER-QUESTION-INDEX.md`: Complete specification of PLAN-05.
- `engines/quiz/recognition/question_index.py`: `QuestionIndexService` implementation.
- `engines/quiz/tests/test_plan05_question_index.py`: Unit and regression test suite covering Cases A through H.

### Modified:
- `engines/quiz/common/errors.py`: Added `ErrorCode.RANGE_MISMATCH` and `DiagnosticLayer.RECOGNITION_FAILURE`.
- `engines/quiz/recognition/models.py`: Added `QuestionSegment`, `QuestionIndexEntry`, `PageIndex`, `PageNeighborhood`, `ExtractionPlan`.
- `engines/quiz/recognition/__init__.py`: Exported new models and `QuestionIndexService`.
- `engines/quiz/quiz_cache.py`: Added `get_question_index_cache` and `set_question_index_cache`.
- `engines/quiz/reconstruction/batch_planner.py`: Supported `target_question_numbers` filtering in `plan_batches`.
- `engines/quiz/reconstruction/post_processor.py`: Supported `target_question_numbers` isolation and 1-based renumbering fallback in `post_process_questions`.
- `engines/quiz/recognition/range_resolver.py`: Constrained backwards alignment to immediate neighbors to prevent jumping across chapters.
- `engines/quiz/orchestrator/pipeline.py`: Integrated `QuestionIndexService` and hard-gate range validation into JobStage.PLANNING.
- `server/src/workers/quiz.worker.ts`: Cleaned error reporting for `RANGE_MISMATCH`.
- `docs/agent-handoff.md`: Updated handoff report with audit and verification details.
