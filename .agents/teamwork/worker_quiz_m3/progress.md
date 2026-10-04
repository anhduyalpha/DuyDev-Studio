# Progress - Milestone 3 (WP5) Worker

Last visited: 2026-10-04T00:43:30Z
Current Status: Completed

## Tasks
- [x] 1. Read key documents (ORIGINAL_REQUEST.md, QUIZ_PIPELINE_UPGRADE_PLAN.md §WP5, 3 Explorer handoffs).
- [x] 2. Inspect `.gitignore` and add `!engines/quiz/assets/**`.
- [x] 3. Inspect KaTeX assets in `engines/quiz/assets/katex/` to confirm structure (CSS, JS, auto-render, 20 woff2 fonts).
- [x] 4. Update `engines/quiz/quiz_pipeline.py`:
  - [x] Define `ENGINE_DIR` and `KATEX_SRC_DIR`.
  - [x] Update `generate_worksheet_html` & `generate_answer_key_html` (remove `questions_per_page`, local katex links, move script to body end, no defer/DOMContentLoaded).
  - [x] Update `compile_pdf` -> `run_chrome_worker` (4 flags, 15s timeout).
  - [x] Update `run_pipeline` (fail-fast KaTeX check, per-job temp dir, copy katex, html paths, cleanup in finally).
- [x] 5. Update and extend `engines/quiz/test_quiz_pipeline_v2.py`:
  - [x] Update `test_katex_delimiters_and_ignored_classes`.
  - [x] Add `test_katex_assets_exist_locally`.
  - [x] Add `test_run_pipeline_fails_fast_when_katex_missing`.
  - [x] Add `test_job_html_dir_cleaned_up_in_finally`.
- [x] 6. Verification:
  - [x] CDN search check (`rg "cdn.jsdelivr" engines/quiz/`) -> 0 matches.
  - [x] Python test suites:
    - `test_quiz_pipeline_v2.py`: 38/38 PASS.
    - `test_mcq_parser.py`: 19/19 PASS.
    - `test_adversarial_wp2.py`: 20/20 PASS.
    - `test_adversarial_wp3_wp8.py`: 14/14 PASS.
  - [x] Server TypeScript & Vitest:
    - `tsc --noEmit`: 0 errors.
    - `vitest run tests/unit/quiz.test.ts`: 13/13 PASS.
  - [x] Headless print probe: 0 raw `$` in text layer, 100% offline rendering.
- [x] 7. Write handoff.md and report to parent orchestrator.
