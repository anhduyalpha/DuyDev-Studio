# Handoff Report — Challenger 2 (Adversarial WP2 Tester)

**Milestone**: Milestone 1 (WP2) — Duplicate Bugfix & Sequential Numbering Adversarial Validation  
**Sender**: Challenger 2 (`teamwork_preview_challenger`)  
**Recipient**: Parent Orchestrator (`82523155-5971-4e42-a66e-a71df58f4d82`)  
**Verdict**: **APPROVE**  
**Date**: 2026-10-03  

---

## 1. Observation

1. **Baseline Test Suite Status**:
   - `python engines/quiz/test_mcq_parser.py`: Ran 14 tests in 0.004s — **OK** (14/14 passed, 0 failures, 0 errors).
   - `python engines/quiz/test_quiz_pipeline_v2.py`: Ran 25 tests in 0.084s — **OK** (22 legacy + 3 new tests, 0 failures, 0 errors).
   - `cd server && npx tsc --noEmit`: Exited with code 0 — **0 errors**.

2. **Empirical Adversarial Stress Testing (`engines/quiz/test_adversarial_wp2.py`)**:
   - Built a comprehensive 20-test adversarial verification suite in `engines/quiz/test_adversarial_wp2.py` directly exercising `parse_and_standardize_questions`, `_stem_fingerprint`, `normalize_question`, and `link_assets_to_questions`.
   - Command: `python engines/quiz/test_adversarial_wp2.py`
   - Result: `Ran 20 tests in 0.014s - OK` (20/20 passed, 0 failures, 0 errors).

3. **Verbatim Observations on Tested Requirements**:
   - **Adversarial SHA1 Dedup**:
     - `_stem_fingerprint({"question": "Khí CH<sub>4</sub> có tác dụng gì..."})` exactly equals `_stem_fingerprint({"question": "Khí CH4 có tác dụng gì..."})` -> Hash: `c1e14945...`.
     - Complex nested tags `<p>Ion <span class='chem'>Fe<sup>3+</sup></span> tác dụng với <b>NaOH</b></p>` produce identical fingerprint to `Ion Fe3+ tác dụng với NaOH`.
     - Prefixes `"Câu 1: ..."`, `"1. ..."`, and raw stems normalize to identical fingerprints.
     - Irregular whitespace, newlines, and tabs normalize correctly.
     - Distinct chemistry compounds (e.g., `"ankan"` vs `"anken"`) produce distinct hashes (0 collisions).
     - When mock AI returns a duplicate in batch 2 with differing HTML markup, batch 2's duplicate is pruned, leaving strictly unique stems.
   - **Chaotic & Out-of-Order AI Numbering Overwrite**:
     - When mock AI returns `number` values `[999, -5, "abc", None, 42]`, pipeline output is strictly overwritten with `[10, 11, 12, 13, 14]` for `start_num=10`.
     - Reverse numbers `[3, 2, 1]` are renumbered strictly as `[1, 2, 3]`.
   - **Clamping Count > Available**:
     - Input text with 3 questions, requested `count=100`: Pipeline returns strictly 3 questions numbered `1..3`. Mock `call_agnes_api` call count is strictly **1** (since `effective_count = min(100, 3) = 3 <= BATCH_SIZE(5)`).
   - **Offset `start_num`**:
     - Requested `start_num=50` with 7 questions across 2 batches (5 + 2): Questions are numbered strictly `50, 51, 52, 53, 54, 55, 56`. Exactly 2 API calls.
   - **Fast-Fail on Zero Questions**:
     - Input with preamble text (0 questions): Raises `RuntimeError("Không có câu hỏi trong Trang 1, vui lòng chọn lại.")`. Mock `call_agnes_api` call count is strictly **0**.
     - Input with empty string: Raises `RuntimeError("Không có câu hỏi trong trang đã chọn, vui lòng chọn lại.")` with 0 API calls.
   - **Visual Asset Mapping Integrity Under Renumbering**:
     - Source PDF questions Câu 15, 16, 17 with `asset_map = {"fig_p2_1": 16}`.
     - Output questions renumbered to 1, 2, 3.
     - `source_nums = [15, 16, 17]` passed to `link_assets_to_questions`.
     - Question at index 1 (new `number=2`, was source 16) correctly receives `image_ref = "fig_p2_1.png"` and valid `image_data`. Questions 1 and 3 receive `None`.
     - Tested multiple assets mapping (`fig_p1_1: 10`, `fig_p1_2: 12`, `fig_p2_1: 15` across 6 questions) -> 100% accurate assignment.
     - Direct AI matches and text markers `[IMAGE_REF: ...]` resolve and markers are stripped cleanly.

---

## 2. Logic Chain

1. **Elimination of the Root Cause of Question Duplication (Linking Obs 1, 2, 3)**:
   - In legacy code, requesting `count=20` on a 10-question document caused sliding windows to run out, hitting `else raw_text` at line 1102.
   - In WP2, `effective_count = min(count, available)` clamps the request before computing batches.
   - Slicing `windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]` and asserting `len(windows) == len(batches)` mathematically prevents any out-of-bounds window slice or fallback to `raw_text`.
2. **Deterministic Defense-in-Depth Deduplication (Linking Obs 2, 3)**:
   - Even if an AI model re-extracts a question across batches, `_stem_fingerprint` normalizes HTML tags, prefixes, and whitespace. SHA1 hashing collapses identical stems, and `seen_stems` eliminates duplicates before sequential numbering.
3. **Monotonic Sequential Numbering Independent of AI (Linking Obs 2, 3)**:
   - Enforcing `q["number"] = start_num + i` at lines 1156-1157 guarantees that no matter what chaotic payload the AI generates (`None`, negative numbers, strings, out-of-order integers), output numbers are strictly monotonic and sequential.
4. **Preservation of Visual Diagram Alignment (Linking Obs 2, 3)**:
   - Because `extract_structured_page_content` associates assets with the original question numbers in the source PDF (`source_number`), passing `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]` ensures that Step 2 of `link_assets_to_questions` correctly aligns assets by their original document coordinates rather than their newly reassigned indices.

---

## 3. Caveats

1. **Legacy Keyword Fallback in `link_assets_to_questions` (Minor / Existing Code)**:
   - In `quiz_pipeline.py:534-548` (Step 5: Keyword proximity fallback), `unassigned_assets` is constructed from `assets` without filtering `a.get("is_banner")`. In the edge case where an unassigned asset is a decorative banner and a question contains keyword phrases like `"hình vẽ"`, Step 5 could assign the banner to that question. Steps 1-4 are completely immune because they use `assets_by_id`. This is legacy code from Module 1.2 and not a regression from WP2.
2. **Positional Assumption on Asymmetric AI Drops (Theoretical Edge Case)**:
   - Passing `[b["source_number"] for b in parsed_blocks][:effective_count]` relies on the assumption that AI returns questions 1-to-1 matching the provided blocks. If an AI dropped question 1 and only returned questions 2-5, positional index mapping would shift. However, Step 1 (Direct AI `image_ref`) and Step 4 (`[IMAGE_REF: ...]`) anchor assets deterministically regardless of position.
3. **End-to-End Headless Chrome PDF Verification**:
   - Full offline printing and KaTeX CSS/font rendering are governed by Milestone 2 (WP5).

---

## 4. Conclusion

**Verdict: APPROVE.**

The implementation of WP2 in `engines/quiz/quiz_pipeline.py` is solid, deterministic, and empirically verified under hostile adversarial inputs:
- 0 duplicate questions when `count > available`.
- 100% sequential numbering starting strictly at `start_num`.
- SHA1 stem deduplication correctly ignores chemistry HTML markup and whitespace variations.
- Zero questions triggers fast failure with 0 API calls and exact error message formatting.
- Visual asset mapping correctly links diagrams to renumbered questions.
- All 14 tests in `test_mcq_parser.py`, all 25 tests in `test_quiz_pipeline_v2.py`, all 20 tests in `test_adversarial_wp2.py`, and `cd server && npx tsc --noEmit` pass with 0 errors.

---

## 5. Verification Method

To independently reproduce Challenger 2's empirical findings:

1. **Run New Adversarial WP2 Stress Harness**:
   ```bash
   python engines/quiz/test_adversarial_wp2.py
   ```
   *Expected Result*: `Ran 20 tests in ~0.015s - OK`.

2. **Run MCQ Parser Unit Tests**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   ```
   *Expected Result*: `Ran 14 tests in ~0.005s - OK`.

3. **Run Pipeline Unit Tests (Legacy 22 + WP2 3 Tests)**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Expected Result*: `Ran 25 tests in ~0.09s - OK`.

4. **Verify Server TypeScript**:
   ```bash
   cd server && npx tsc --noEmit
   ```
   *Expected Result*: Exits 0 with 0 errors.
