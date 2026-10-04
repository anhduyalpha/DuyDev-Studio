# Dispatch for Explorer 1 (MCQ Parser & Text Utils Specialist)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_parser
- Identity: teamwork_preview_explorer
- Role: MCQ Parser Specialist
- Milestone: Milestone 1 (WP1)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (see §WP1)
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio
- Project Scope: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_quiz\PROJECT.md

## Mission & Instructions
Investigate the deterministic pre-parser requirements (WP1) for Quiz Pipeline v3.0:
1. Examine `engines/quiz/quiz_pipeline.py` lines 169-201 and 487-491 (to be extracted to `engines/quiz/text_utils.py`). Verify exact functions: `is_section_banner`, `strip_section_banner`, `clean_image_markers`. Verify re-export requirements in `quiz_pipeline.py` to prevent circular imports and keep existing tests passing.
2. Investigate the design of `engines/quiz/mcq_parser.py`:
   - Exact signatures: `parse_mcq_blocks(text: str) -> list[dict]`, `count_available_questions(text: str) -> int`.
   - Data contract of returned block: `source_number`, `stem`, `options` (A/B/C/D), `confidence` ("high"/"low"), `raw`.
   - Regex boundaries and lookbehind patterns (`(?<=\s)`).
   - Ascending option letter selection algorithm (A -> B -> C -> D) to prevent abbreviations like "Vitamin D." from falsely matching option D before option A.
   - Banner stripping from stem while preserving `[IMAGE_REF: ...]`.
3. Design the test suite `engines/quiz/test_mcq_parser.py` covering all 11+ edge cases specified in §WP1.
4. Document full implementation plan and evidence in `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_parser\analysis.md` and `handoff.md`.


## 2026-10-03T15:58:49Z
You are Explorer 1 (MCQ Parser Specialist) for Milestone 1 (WP1) of the Quiz Pipeline v3.0 Upgrade.
Your working directory is:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_parser

Read your instructions in:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_parser\DISPATCH.md
and the authoritative requirements in:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
and the upgrade plan in:
C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (specifically §WP1)

Your tasks:
1. Inspect engines/quiz/quiz_pipeline.py lines 169-201 and 487-491. Plan extraction of is_section_banner, strip_section_banner, clean_image_markers into engines/quiz/text_utils.py, and plan the re-export in quiz_pipeline.py so all 22 existing tests continue passing without regression.
2. Design engines/quiz/mcq_parser.py: parse_mcq_blocks(text) and count_available_questions(text). Verify regex BOUNDARY, NUM, OPT with lookbehind (?<=\s), ascending option matching (A->B->C->D) to prevent "Vitamin D." in stem from prematurely matching D, confidence assignment, banner stripping.
3. Design 11+ unit tests for engines/quiz/test_mcq_parser.py covering all edge cases in §WP1.
4. Write your detailed analysis to analysis.md and your summary report to handoff.md in your working directory.
When done, use send_message to report your completion to your parent.
