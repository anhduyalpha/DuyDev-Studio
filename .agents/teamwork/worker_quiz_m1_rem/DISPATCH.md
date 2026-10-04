# Dispatch for Remediation Worker (Milestone 1 Iteration 2)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m1_rem
- Identity: teamwork_preview_worker
- Role: Remediation Implementation Specialist
- Milestone: Milestone 1 Iteration 2 (WP1 Remediation)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md
- Challenger 1 Findings: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\challenger_quiz_m1_1\handoff.md
- Remediation Explorer 1 (Scoring Patch): C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_scoring\handoff.md
- Remediation Explorer 2 (NUM Boundary): C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_boundary\handoff.md
- Remediation Explorer 3 (Test Formulations): C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_safety\handoff.md
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A teamwork_preview_auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

## Tasks to Execute:
1. Update `engines/quiz/mcq_parser.py`:
   - Replace greedy option matching with candidate 4-tuple scoring algorithm from Explorer 1 & 3:
     - Find ordered tuples `mA.end() <= mB.start() < mC.start() < mD.start()`.
     - Score tuples: maximize `newline_score` (reward markers following newline/indentation), penalize `sub_delims` (embedded newline delimiters in option bodies), prefer latest `mA.start()` to preserve stem completeness.
     - Fallback gracefully to prefix matching for incomplete/malformed blocks (< 4 options).
   - Update `BOUNDARY` regex and line 30 guard to include `\)`:
     `BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\)\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)`
   - Update `NUM` regex to accept space delimiter:
     `NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)`
2. Update `engines/quiz/test_mcq_parser.py`:
   - Append the 5 new unit tests from Explorer 3:
     1. `test_stem_contains_vitamin_a_dot`
     2. `test_stem_contains_geometry_vuong_tai_a`
     3. `test_stem_contains_species_a_thaliana`
     4. `test_option_body_contains_inline_sequential_letters`
     5. `test_header_without_punctuation_space_only`
3. Execute and verify:
   - `python engines/quiz/test_mcq_parser.py` (Must pass 19/19 tests)
   - `python engines/quiz/test_quiz_pipeline_v2.py` (Must pass 25/25 tests)
   - `python engines/quiz/test_adversarial_wp2.py` (Must pass 20/20 tests)
   - `cd server && npx tsc --noEmit` (0 errors)
4. Write `handoff.md` and report completion via `send_message`.


## 2026-10-03T16:36:09Z
You are Worker 2 (Remediation Implementation Specialist) for Milestone 1 Iteration 2.
Your working directory is:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m1_rem

Read your instructions in:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m1_rem\DISPATCH.md
and reference the Explorer handoffs:
- C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_scoring\handoff.md
- C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_boundary\handoff.md
- C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_rem_safety\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your tasks:
1. Update engines/quiz/mcq_parser.py: implement candidate 4-tuple scoring algorithm, symmetrical BOUNDARY regex, and space-tolerant NUM regex.
2. Update engines/quiz/test_mcq_parser.py: append the 5 new unit tests.
3. Run verification:
   - python engines/quiz/test_mcq_parser.py (19/19 tests pass)
   - python engines/quiz/test_quiz_pipeline_v2.py (25/25 tests pass)
   - cd server && npx tsc --noEmit (0 errors)
4. Write handoff.md in your working directory and report completion via send_message.
