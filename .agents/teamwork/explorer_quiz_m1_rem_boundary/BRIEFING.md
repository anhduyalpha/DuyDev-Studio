# BRIEFING — 2026-10-03T16:35:00Z

## Mission
Investigate NUM regex and question boundary edge cases in engines/quiz/mcq_parser.py to safely handle space-delimited headers without dropping questions.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: NUM Boundary Specialist, Remediation Explorer
- Working directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_boundary
- Original parent: 82523155-5971-4e42-a66e-a71df58f4d82
- Milestone: Milestone 1 - Remediation (WP1)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in production code
- Propose precise diffs/fixes in handoff.md and handoff report
- Ensure zero regression on existing Vietnamese quiz parsing

## Current Parent
- Conversation ID: 82523155-5971-4e42-a66e-a71df58f4d82
- Updated: 2026-10-03T16:35:00Z

## Investigation State
- **Explored paths**:
  - `engines/quiz/mcq_parser.py` (lines 9-37)
  - `engines/quiz/test_mcq_parser.py`
  - `engines/quiz/test_quiz_pipeline_v2.py`
  - `.tmp/adversarial_mcq_test.py`
  - `docs/QUIZ_PIPELINE_UPGRADE_PLAN.md` (WP1 specifications)
  - `test_regex_candidates.py` (empirical simulation script)
- **Key findings**:
  1. `NUM` regex mismatch with `BOUNDARY`: `BOUNDARY` and Line 30 matched `Câu 14 `, but `NUM` rejected it due to `[\.\:\)]`, dropping question 14.
  2. Challenger's proposed fix `NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)` safely extracts `source_number` for space-delimited headers without false positives due to Line 30 guard.
  3. Parenthesis blindspot discovered: `NUM` had `\)`, but `BOUNDARY` and Line 30 lacked `\)`, causing `Câu 1)` to be ignored.
  4. Bare numbers without "Câu" (e.g. `14 quả cam` or `1) Mệnh đề`) must strictly require punctuation `.` or `:` to prevent destroying question stems.
  5. `Bài` headers should NOT be treated as MCQ question boundaries; empirical testing proved that doing so erroneously converts textbook lesson/chapter titles (`Bài 1. ESTE`) into low-confidence questions.
- **Unexplored areas**: None within scope.

## Key Decisions Made
- Recommending Challenger 1's `NUM` fix as Core Fix + recommending cohesive `BOUNDARY` update to include `\)` for `Câu` and leading whitespace consumption `[ \t]*`.
- Explicitly rejecting `Bài` as question boundary due to high risk of false positive on lesson titles.

## Artifact Index
- DISPATCH.md — Task assignment and instructions
- BRIEFING.md — Persistent working memory
- progress.md — Liveness heartbeat
- test_regex_candidates.py — Simulation script testing edge cases
- handoff.md — Final 5-component remediation report
