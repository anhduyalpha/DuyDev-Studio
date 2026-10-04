# Dispatch for Worker (Milestone 1: WP1 & WP2)

- Working Directory: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m1
- Identity: teamwork_preview_worker
- Role: Polyglot Pipeline Implementation Specialist
- Milestone: Milestone 1 (WP1 & WP2)
- Authoritative Requirements: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
- Specification Plan: C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (see §WP1 and §WP2)
- Project Root: C:\Users\AnhDuy\Code\Project\DD Studio
- Project Scope: C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\orchestrator_quiz\PROJECT.md

## Reference Analysis & Prototypes from Explorers:
- Explorer 1 (WP1 Parser): `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_parser\handoff.md` (and `analysis.md`, `mcq_parser_prototype.py`, `text_utils_prototype.py`, `test_prototype.py`)
- Explorer 2 (WP2 Duplicate Fix): `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_duplicate_fix\handoff.md` (and `analysis.md`)
- Explorer 3 (Integration & Safety): `C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_integration\handoff.md` (and `analysis.md`)

## Mandatory Integrity Warning
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A teamwork_preview_auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

## Detailed Tasks to Implement

### Step 1: Create `engines/quiz/text_utils.py` (WP1)
Extract verbatim (zero logic change) from `engines/quiz/quiz_pipeline.py`:
- `is_section_banner(text: str) -> bool`
- `strip_section_banner(text: str) -> str`
- `clean_image_markers(text: str) -> str`
Include standard UTF-8 headers and regex imports.

### Step 2: Create `engines/quiz/mcq_parser.py` (WP1)
Implement `parse_mcq_blocks(text: str) -> list[dict]` and `count_available_questions(text: str) -> int`:
- Exact contract: `source_number` (int), `stem` (str), `options` (dict A/B/C/D), `confidence` ("high"/"low"), `raw` (str).
- Re-use boundary regex: `BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)`.
- Option regex with lookbehind: `OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")`.
- Enforce ascending option match state machine (`idx = 0; expected = ["A", "B", "C", "D"]`) so stems like `"Câu 3. Vitamin D. có vai trò gì?"` do not prematurely match `"D."`.
- Strip banners from stem using `strip_section_banner` while preserving `[IMAGE_REF: ...]`.
- High confidence requires exactly 4 non-empty options and non-empty stem. Keep low confidence blocks in the list.

### Step 3: Create `engines/quiz/test_mcq_parser.py` (WP1)
Implement 14 comprehensive unit tests based on Explorer 1's validated prototype, covering all edge cases in §WP1.

### Step 4: Update `engines/quiz/quiz_pipeline.py` (WP1 & WP2)
1. Import and re-export `text_utils` at the top of `quiz_pipeline.py`:
   `from text_utils import is_section_banner, strip_section_banner, clean_image_markers`
   and import `from mcq_parser import parse_mcq_blocks, count_available_questions`.
2. Remove old duplicate definitions of `is_section_banner`, `strip_section_banner`, and `clean_image_markers`.
3. In `parse_and_standardize_questions`:
   - Update signature to accept `parsed_blocks: list[dict] | None = None`.
   - Compute `parsed_blocks = parsed_blocks if parsed_blocks is not None else parse_mcq_blocks(raw_text)`.
   - Fast-fail if `len(parsed_blocks) == 0`: raise `RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")`.
   - Clamp `effective_count = min(count, available)`.
   - Set `BATCH_SIZE = 5` and partition `batches` based on `effective_count` (not `count`).
   - Slice `windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]`.
   - Drop the `else raw_text` fallback completely. Assert `len(windows) == len(batches)`.
   - Add stem SHA1 deduplication (stripping HTML tags, numbering prefixes, whitespace).
   - Clamp `all_questions = all_questions[:effective_count]`.
   - Enforce sequential renumbering: `q["number"] = start_num + i`.
4. In `run_pipeline`:
   - Call `parsed_blocks = parse_mcq_blocks(raw_text)` once.
   - Compute `effective_count = min(count, len(parsed_blocks))`.
   - Pass `parsed_blocks=parsed_blocks` to `parse_and_standardize_questions`.
   - Pass `source_q_nums = [b["source_number"] for b in parsed_blocks][:effective_count]` to `link_assets_to_questions` so image mapping aligns with PDF source questions.
5. In CLI exception handler (`quiz_pipeline.py:main`):
   - Output `sys.stderr.write(f"{err_msg}\n")` to preserve specific page description.
6. **PRESERVE INTACT**: `chunk_questions_sliding_window` MUST remain in `quiz_pipeline.py` with identical signature.

### Step 5: Append 3 Unit Tests to `engines/quiz/test_quiz_pipeline_v2.py` (WP2)
DO NOT TOUCH or modify any of the existing 22 test cases.
Append to the end of the file:
1. `test_no_duplicate_questions_when_count_exceeds_available`
2. `test_sequential_numbering_overrides_ai_numbers`
3. `test_zero_questions_raises_before_any_api_call`

### Step 6: Verify and Document
Run:
- `python engines/quiz/test_mcq_parser.py` (14/14 pass)
- `python engines/quiz/test_quiz_pipeline_v2.py` (25/25 pass: 22 legacy + 3 new)
- `cd server && npx tsc --noEmit` (0 errors)
- `cd server && npx vitest run` (100% pass)
Document results in `handoff.md` and report completion via `send_message`.


## 2026-10-03T16:06:47Z
You are Worker 1 (Polyglot Pipeline Implementation Specialist) for Milestone 1 (WP1 & WP2) of the Quiz Pipeline v3.0 Upgrade.
Your working directory is:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m1

Read your instructions and requirements in:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\worker_quiz_m1\DISPATCH.md
and the authoritative user requirements in:
C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\ORIGINAL_REQUEST.md
and the master plan in:
C:\Users\AnhDuy\Code\Project\DD Studio\docs\QUIZ_PIPELINE_UPGRADE_PLAN.md (specifically §WP1 and §WP2)

Reference the Explorer handoffs and prototypes:
- C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_parser\handoff.md
- C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_duplicate_fix\handoff.md
- C:\Users\AnhDuy\Code\Project\DD Studio\.agents\teamwork\explorer_quiz_m1_integration\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your tasks:
1. Implement engines/quiz/text_utils.py (extract is_section_banner, strip_section_banner, clean_image_markers).
2. Implement engines/quiz/mcq_parser.py (parse_mcq_blocks, count_available_questions).
3. Implement engines/quiz/test_mcq_parser.py (14 unit tests).
4. Update engines/quiz/quiz_pipeline.py:
   - Import and re-export text_utils functions.
   - Remove duplicate definitions of extracted functions.
   - Update parse_and_standardize_questions (early count check, clamp effective_count, BATCH_SIZE=5, drop else raw_text fallback, stem SHA1 dedup, clamp all_questions, sequential numbering start_num + i).
   - In run_pipeline: parse_mcq_blocks once, pass source_q_nums to link_assets_to_questions.
   - In CLI main(): write sys.stderr.write(f"{err_msg}\n").
   - PRESERVE INTACT chunk_questions_sliding_window.
5. Append 3 new unit tests to test_quiz_pipeline_v2.py without touching or modifying the 22 existing tests.
6. Verify:
   - python engines/quiz/test_mcq_parser.py
   - python engines/quiz/test_quiz_pipeline_v2.py
   - cd server && npx tsc --noEmit
   - cd server && npx vitest run
7. Write progress.md and handoff.md in your working directory and notify parent via send_message.
