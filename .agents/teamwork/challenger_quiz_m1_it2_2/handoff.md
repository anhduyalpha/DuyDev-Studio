# Handoff Report — Challenger 2 (Milestone 1 Iteration 2)

**Milestone**: Milestone 1 Iteration 2 (WP2) — Duplicate Elimination, Sequential Renumbering & Visual Asset Mapping  
**Sender**: Challenger 2 (`challenger_quiz_m1_it2_2` / `teamwork_preview_challenger`)  
**Recipient**: Parent Orchestrator (`82523155-5971-4e42-a66e-a71df58f4d82`)  
**Verdict**: **APPROVE**  
**Date**: 2026-10-03T16:48:00Z  

---

## 1. Observation

1. **Adversarial WP2 Suite (`engines/quiz/test_adversarial_wp2.py`)**:
   - Command: `python engines/quiz/test_adversarial_wp2.py`
   - Verbatim result:
     ```
     Ran 20 tests in 0.015s
     OK
     ```
   - All 20 tests across all 7 adversarial categories passed cleanly with 0 failures and 0 errors:
     - Category 1 (SHA1 Dedup & Stem Normalization): 7 tests passed (HTML chemistry `CH4`/`CH<sub>4</sub>`, complex nested tags, prefixes, whitespace, case insensitivity, distinct compound hash differentiation, cross-batch AI duplicate pruning).
     - Category 2 (Chaotic AI Number Overwrite): 2 tests passed (adversarial numbers `[999, -5, 'abc', None, 42]` and reverse numbers `[3, 2, 1]` overwritten monotonically).
     - Category 3 (Count Clamping): 1 test passed (count 100 on 3 questions clamped to 3, exactly 1 API call).
     - Category 4 (Offset Start Number): 1 test passed (`start_num=50` with 7 questions -> strictly 50..56).
     - Category 5 (Fast-Fail Zero Questions): 2 tests passed (header-only preamble and empty string raise Vietnamese `RuntimeError` before any API call).
     - Category 6 (Visual Asset Mapping): 5 tests passed (source number renumbering preserved, multiple assets across questions, direct AI match, text marker `[IMAGE_REF: ...]` fallback and stripping, banner isolation).
     - Category 7 (Adversarial AI Payloads): 2 tests passed (excess questions clamped to `effective_count`, corrupted/empty dicts handled defensively by `normalize_question`).

2. **Parser Unit Tests & Pipeline Integration Tests**:
   - `python engines/quiz/test_mcq_parser.py`: Ran 19 tests in 0.007s — **OK** (19/19 passed).
   - `python engines/quiz/test_quiz_pipeline_v2.py`: Ran 25 tests in 0.110s — **OK** (25/25 passed, including 22 frozen legacy tests + 3 WP2 tests).
   - `python .tmp/adversarial_mcq_test.py`: Ran 20 tests — **20 PASSED, 0 FAILED** (average 0.046 ms/q).

3. **Cross-Iteration Interaction Tests (`.tmp/test_adversarial_m1_it2_interaction.py`)**:
   - Executed newly constructed stress tests exercising the interaction between `mcq_parser`'s updated candidate 4-tuple matching and `parse_and_standardize_questions` + `link_assets_to_questions`:
     - Test 1: Headers with space delimiters (`Câu 14 `) and geometry abbreviations (`tam giác ABC vuông tại A.`, `A. thaliana`) accurately parsed, clamped, and associated with visual assets via `source_nums_for_assets = [14, 15, 16]`. (Passed)
     - Test 2: Cross-batch duplicate pruning with space-delimited vs colon-delimited headers (`Câu 1 ` vs `Câu 6:`) eliminated duplicates cleanly and renumbered sequentially without gaps. (Passed)
     - Test 3: Option bodies with sequential inline letters (`Điểm B.`, `Điểm C.`) preserved question stems and source numbers, linking diagrams with 100% fidelity. (Passed)
   - Result: `Ran 3 tests in 0.009s - OK`.

4. **Server Quality & TypeScript Checks**:
   - `cd server && npx tsc --noEmit`: Exited with code 0 — **0 errors**.
   - `cd server && npx vitest run`: Ran 45 test files — **45 passed (45), 494 passed (494)** in 78.71s.

---

## 2. Logic Chain

1. **Worker 2 Remediation Impact on WP2 Invariants (Connecting Obs 1, 2, 3)**:
   - Worker 2 replaced greedy sequential option matching in `mcq_parser.py` with ordered 4-tuple candidate scoring (`(mA, mB, mC, mD)`), widened `BOUNDARY` and `NUM` to support space-only delimiters (`Câu 14 `), and added boundary symmetry for `\)`.
   - In `quiz_pipeline.py`, `parse_and_standardize_questions` receives `parsed_blocks` (or calls `parse_mcq_blocks(raw_text)`). Because the updated parser returns correct block counts and clean stems without amputating lines at `Vitamin A.` or `vuông tại A.`, `effective_count = min(count, available)` and `windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]` retain exact 1-to-1 matching with batches (`assert len(windows) == len(batches)`).
2. **Robustness of Duplicate Elimination (Connecting Obs 1, 3)**:
   - `_stem_fingerprint` operates by stripping HTML tags, prefixes (`câu \d+`, `\d+\.`), and all whitespace before hashing via SHA1.
   - Whether headers are formatted as `Câu 1:`, `Câu 1.`, or `Câu 1 `, identical question stems produce identical SHA1 hashes.
   - When mock AI duplicates a question in batch 2, `seen_stems` prunes the duplicate, and the output is clamped to `effective_count`.
3. **Sequential Renumbering Invariant (Connecting Obs 1, 2, 3)**:
   - Enforcing `q["number"] = start_num + i` at lines 1156-1157 guarantees strictly monotonic numbering from `start_num` to `start_num + len(all_questions) - 1`, regardless of AI hallucinated numbers or order.
4. **Visual Asset Mapping Determinism (Connecting Obs 1, 3)**:
   - In `run_pipeline`, `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]`.
   - `link_assets_to_questions` Step 2 maps `source_nums[idx]` against `asset_map` (which was constructed from original PDF layout coordinates).
   - Space-delimited headers like `Câu 14 ` and stem abbreviations like `vuông tại A.` now correctly retain their true `source_number` (14, 15, 16), ensuring that visual diagrams attached to source question 15 map to the correct renumbered question index.

---

## 3. Caveats

1. **Non-Standard Option Markers (< 4 options)**:
   - If an exam block has fewer than 4 options (e.g., true/false or incomplete scans), `mcq_parser.py` falls back to prefix matching and tags `confidence = "low"`. This is intended behavior under the specification and is cleanly passed to AI standardization.
2. **Milestone 2 Scope**:
   - Headless Chrome offline rendering and KaTeX local vendor assets belong to Milestone 2 (WP5). Milestone 1 focuses on pre-parser determinism (WP1) and duplicate elimination / renumbering / asset mapping (WP2).

---

## 4. Conclusion

**Verdict: APPROVE.**

The changes implemented in `mcq_parser.py` during Milestone 1 Iteration 2 have not introduced any regressions to `parse_and_standardize_questions`, duplicate elimination, sequential renumbering, or visual asset mapping.
All invariants remain 100% robust:
- 0 duplicate questions when `count > available`.
- 100% monotonic sequential numbering starting at `start_num`.
- SHA1 stem deduplication remains immune to HTML formatting, whitespace, and header variations.
- Visual asset mapping continues to link diagrams to renumbered questions with 100% accuracy.
- All test suites (20 adversarial WP2 tests, 19 parser unit tests, 25 pipeline integration tests, 20 adversarial stress tests, 3 interaction tests, TypeScript check, and 494 Vitest server tests) pass with 0 errors.

---

## 5. Verification Method

To independently verify Challenger 2's empirical findings:

1. **Adversarial WP2 Verification Suite (20 tests)**:
   ```bash
   python engines/quiz/test_adversarial_wp2.py
   ```
   *Expected Result*: `Ran 20 tests in ~0.015s - OK`.

2. **Parser Unit Test Suite (19 tests)**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   ```
   *Expected Result*: `Ran 19 tests in ~0.007s - OK`.

3. **Pipeline Integration Suite (25 tests)**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Expected Result*: `Ran 25 tests in ~0.11s - OK`.

4. **Cross-Interaction Stress Test (3 tests)**:
   ```bash
   python .tmp/test_adversarial_m1_it2_interaction.py
   ```
   *Expected Result*: `Ran 3 tests in ~0.01s - OK`.

5. **Server TypeScript & Vitest Suite**:
   ```bash
   cd server && npx tsc --noEmit
   cd server && npx vitest run
   ```
   *Expected Result*: TypeScript exits 0 with 0 errors; Vitest passes 45 test files, 494/494 tests.
