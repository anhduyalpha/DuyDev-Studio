# Dispatch for Explorer 2 (Duplicate Fix Specialist)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_duplicate_fix
- Identity: teamwork_preview_explorer
- Role: Duplicate Bugfix Specialist
- Milestone: Milestone 1 (WP2)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (see §WP2)
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio
- Project Scope: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_quiz\PROJECT.md

## Mission & Instructions
Investigate fixing the duplicate questions bug (P0 / WP2) in `engines/quiz/quiz_pipeline.py`:
1. Inspect `parse_and_standardize_questions` (around lines 1036-1158):
   - Trace the bug cause: why `batches` calculated from `count` and fallback `else raw_text` at line 1102 duplicate questions when count > available questions.
   - Specify the 7 required code changes:
     (1) Count check immediately after system prompt using `parse_mcq_blocks`, raise Vietnamese `RuntimeError("Không có câu hỏi trong {desc}, vui lòng chọn lại.")` if available == 0. Clamp `effective_count = min(count, available)`.
     (2) Compute `remaining` and `batches` from `effective_count` (not `count`).
     (3) Slice `windows` directly from `parsed_blocks` (`windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]`).
     (4) Drop fallback `else raw_text` completely. Assert `len(windows) == len(batches)`.
     (5) Dedup question stem by SHA1 hash of stem after stripping HTML tags and whitespace.
     (6) Clamp `all_questions = all_questions[:effective_count]`.
     (7) Enforce sequential numbering: `q["number"] = start_num + i`.
2. Inspect `chunk_questions_sliding_window`: verify that its function definition remains intact (signature frozen) because existing tests call it, but verify that `parse_and_standardize_questions` stops calling it.
3. Design 3 new unit tests to be added at the end of `engines/quiz/test_quiz_pipeline_v2.py`:
   - `test_no_duplicate_questions_when_count_exceeds_available`
   - `test_sequential_numbering_overrides_ai_numbers`
   - `test_zero_questions_raises_before_any_api_call`
4. Document findings and step-by-step diff proposal in `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_duplicate_fix\analysis.md` and `handoff.md`.


## 2026-10-03T15:58:49Z
Received task delegation from parent (82523155-5971-4e42-a66e-a71df58f4d82):
Explorer 2 (Duplicate Bugfix Specialist) for Milestone 1 (WP2 - P0) of the Quiz Pipeline v3.0 Upgrade.
Tasks:
1. Deeply inspect engines/quiz/quiz_pipeline.py around lines 1036-1158 (parse_and_standardize_questions).
2. Trace the exact root causes of the duplicate question bug (count > available questions, fallback else raw_text at line 1102).
3. Plan the 7 specific code modifications detailed in §WP2.
4. Verify chunk_questions_sliding_window remains intact for existing tests.
5. Design 3 new unit tests to append to test_quiz_pipeline_v2.py without touching the 22 existing tests.
6. Write detailed analysis to analysis.md and handoff.md in working directory.
7. Report completion to parent via send_message.
