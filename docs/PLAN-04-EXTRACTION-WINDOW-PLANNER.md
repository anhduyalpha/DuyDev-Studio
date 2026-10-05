# PLAN-04 — Extraction Window Planner

## Includes

- TASK-05 (Smart Recognition & Adaptive Range Resolver)
- Printed-Page vs Physical-Page Reconciliation
- Bi-Directional Cross-Page Boundary Continuation Stitching

## Goal

Accurately plan and extract the complete physical extraction window (`start_page`, `end_page`, `start_question`, `question_count`, `batches`) for arbitrary user instructions, correctly resolving printed-page vs physical-page discrepancies, cross-page stem continuations, and cross-page trailing option continuations (e.g. "Trang 40 từ câu 41 đến 46").

## Architecture & Implementation Principles

1. **Deterministic Fast-Path Numeric Parser (`rule_parser.py`)**:
   - Parses explicit page bounds, single pages, question ranges (e.g. "Câu 41 đến 46"), and counts.
   - Zero AI provider calls for deterministically parseable numeric instructions.

2. **Printed vs Physical Page Reconciliation (`range_resolver.py`)**:
   - When requested page numbers exceed total document physical page count (e.g. "Trang 40" on a 3-page excerpt PDF), inspects running headers and footers for printed page markers (`Trang <N>`, `Page <N>`) to reconcile logical printed page to physical page index.

3. **Inward Boundary Alignment (Stem Continuation)**:
   - If the requested start question begins on the preceding page (e.g. Câu 41 stem starts at the bottom of physical Page 1 while its options and figure are on physical Page 2), automatically aligns `start_page` to where the canonical question begins (`start_p = found_p`).

4. **Outward Boundary Expansion (Trailing Option Continuation)**:
   - If the last question on `end_page` continues into `end_page + 1` (e.g. Câu 46 on physical Page 2 has Option D continuing onto physical Page 3), automatically expands `end_page` by 1 to capture trailing options and avoid Option D dropouts.

5. **Batch Payload Packaging (`batch_planner.py`)**:
   - Packages extraction batches with clean text from all pages in the extraction window (`[start_page .. end_page]`).
   - Appends sanitized cross-page continuation text while stripping running headers and structural banners.

6. **Canonical Invariant Enforcement (`post_processor.py`)**:
   - Restricts reconstructed questions strictly to the target window `[start_question .. start_question + count - 1]`.
   - Recovers missing options from document context and validates that every question has all required options.

## Golden Test Case

- Reference Document: `Gốc.pdf` (`.tmp/Diff check/Gốc.pdf`).
- User instruction: `Trang 40 từ câu 41 đến 46`.
- Document characteristics:
  - Physical Page 1 has running header "Trang 39", containing Câu 31 to Câu 41 (stem).
  - Physical Page 2 has running header "Trang 40", containing Câu 41 (options + Linoleic acid structure diagram), Câu 42..45, and Câu 46 (stem + options A, B, C).
  - Physical Page 3 has running header "Trang 41", containing Câu 46 (Option D continuation).
- Actual Calculated Extraction Window:
  - `start_page`: 1
  - `end_page`: 3
  - `start_question`: 41
  - `question_count`: 6
  - `target_question_numbers`: `[41, 42, 43, 44, 45, 46]`
  - `pages`: `[1, 2, 3]`

## Exit Criteria

- Specification documented in `docs/PLAN-04-EXTRACTION-WINDOW-PLANNER.md`.
- `range_resolver.py` supports printed page reconciliation and cross-page window alignment.
- Regression test for "Trang 40 từ câu 41 đến 46" executes and passes.
- All unit, integration, and golden test suites pass with 0 errors (`npx tsc`, `vitest`, `unittest discover`).
