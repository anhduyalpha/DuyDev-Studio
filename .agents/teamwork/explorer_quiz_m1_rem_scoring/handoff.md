# Handoff Report — Milestone 1 Iteration 2 (WP1 Remediation: Candidate Scoring Algorithm)

- **Agent**: Explorer 1 (`explorer_quiz_m1_rem_scoring`) — Candidate Scoring Specialist
- **Milestone**: Milestone 1 Iteration 2 (WP1 Remediation)
- **Target**: `engines/quiz/mcq_parser.py`
- **Reference**: Challenger 1 Feedback (`challenger_quiz_m1_1/handoff.md`)
- **Date**: 2026-10-03T16:32:00Z

---

## 1. Observation

### Observation 1.1: Greedy Sequential Matching in `engines/quiz/mcq_parser.py:38-44`
In `engines/quiz/mcq_parser.py:38-44`:
```python
        idx = 0
        chosen = []
        for m in OPT.finditer(seg):
            if idx < 4 and m.group(1) == expected[idx]:
                chosen.append(m)
                idx += 1
```
When `seg` contains abbreviations or letters in the stem matching `OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")`:
- "Vitamin A.", "tam giác ABC vuông tại A.", "cây mô hình A. thaliana" prematurely binds `expected[0]` ('A').
- The parser advances `idx` to 1 ('B'), completely bypassing the legitimate Option 'A' delimiter.
- When run against `.tmp/adversarial_mcq_test.py`:
  - `Cat7_StemVitaminA_Dot` FAILED: Stem truncated to `'Câu 10. Thiếu Vitamin'`, Option A contains `'dẫn tới bệnh quáng gà và khô giác mạc:\nA. Phát biểu đúng'`
  - `Cat7_StemGeometryVuongTaiA` FAILED: Stem truncated to `'Câu 11. Cho tam giác ABC vuông tại'`, Option A contains `'Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:\nA. 5'`
  - `Cat7_StemA_Thaliana` FAILED: Stem truncated to `'Câu 12. Cây mô hình'`, Option A contains `'thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:\nA. Đúng'`
  - `Cat7_OptionContentSequentialLetters` FAILED: Option A split at inline `'Điểm B.'` instead of newline `'\nB.'`

### Observation 1.2: Question Header Rejection in `engines/quiz/mcq_parser.py:10`
In `engines/quiz/mcq_parser.py:10`:
```python
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.IGNORECASE)
```
- `BOUNDARY` matches `(?:Câu\s*\d+[\.\:\s])`, splitting on `"Câu 14 "` (question number followed only by whitespace).
- Line 30 allows `re.match(r"^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)", seg)`.
- But `NUM.match(seg)` strictly required `[\.\:\)]`, returning `None` and dropping `"Câu 14 "` completely (`Cat7_HeaderWithoutPunctuation` FAILED with verbatim result `[]`).

### Observation 1.3: Empirical Verification of Challenger 1's Candidate 4-Tuple Scoring
We ran a test script simulating Challenger 1's candidate tuple selection on all 20 adversarial tests:
- Command:
  ```bash
  python .tmp/adversarial_mcq_test.py
  ```
- Result with candidate scoring: 20 PASSED, 0 FAILED (execution time: 4.69 ms for 100 questions, ~0.047 ms/q).
- Baseline suites verification:
  - `test_mcq_parser.py`: 14/14 PASSED (0.005s)
  - `test_quiz_pipeline_v2.py`: 25/25 PASSED (0.116s)

### Observation 1.4: Refinement on Indentation and Adjacent Matches
Direct inspection of edge cases revealed two crucial refinements over Challenger 1's initial sketch:
1. **Line Start Indentation**: Challenger 1 checked `m.start() == 0 or seg[m.start()-1] == '\n' or seg[:m.start()].endswith('\n')`. This fails when options have leading spaces (`\n   A.`). Replacing with `m.start() == 0 or seg[m.start()-1] == '\n' or seg[:m.start()].rpartition('\n')[2].strip() == ''` correctly scores indented options.
2. **Adjacent Matches (`<=` vs `<`)**: In `for mB in by_letter['B']: if mB.start() <= mA.end(): continue`, when an option is empty (e.g. `\nB.\nC.`), `mB.end() == mC.start()`, so `<=` erroneously pruned the candidate tuple. Using `<` (`if mB.start() < mA.end(): continue`) properly admits empty options, allowing the parser to capture them and mark `confidence = "low"`.

---

## 2. Logic Chain

1. **Root Cause**: The original greedy sequential loop (`mcq_parser.py:38-44`) committed unconditionally to the first match of each letter. Because standard Vietnamese questions routinely feature letter `'A.'` in stems (geometry vertices, vitamins, taxonomy) and sequential letters inline (`Điểm B.`), greedy matching produced false boundaries.
2. **Candidate Search Space**: An MCQ block contains small numbers of `OPT` matches ($N \le 5$ per letter). Collecting candidate matches by letter (`by_letter = {'A': [], 'B': [], 'C': [], 'D': []}`) and generating ordered 4-tuples with `mA.end() <= mB.start() < mC.start() < mD.start()` requires at most $O(N_A \times N_B \times N_C \times N_D)$ iterations (typically $\le 16$, taking $< 10\,\mu\text{s}$).
3. **Scoring Metric Hierarchy**:
   - **Primary (`newline_score`)**: Rewards markers starting on newlines or at string start (`0..4`). Legitimate options almost always start on a newline, whereas stem abbreviations ("Vitamin A.") and inline letters ("Điểm B.") do not.
   - **Secondary (`-sub_delims`)**: Penalizes tuples whose option body slices contain unused newline markers matching `r'\n\s*[A-D][\.\)\:]'`. If a candidate tuple prematurely matched an inline letter, the real newline option is trapped inside an option body slice, incurring a severe penalty.
   - **Tertiary (`mA.start()`)**: Among ties (such as all-same-line options `A. CH4 B. C2H5OH ...`), choosing the latest `mA.start()` ensures that stem-embedded labels are preserved in the stem rather than amputating the stem.
4. **Fallback Safety**: If no complete 4-tuple exists (e.g. 3-option or malformed questions), falling back to prefix matching guarantees zero crash and backward compatibility, correctly tagging `confidence = "low"`.
5. **Header Regex Alignment**: Updating `NUM` to `r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)"` aligns with `BOUNDARY`, successfully extracting questions formatted as `"Câu 14 Tìm x"`.

---

## 3. Caveats

- **Extreme Non-Standard Delimiters**: If an exam uses roman numerals or non-standard bullet symbols (e.g., `(1)`, `(2)`, `(3)`, `(4)`), `OPT` expects `[A-D]`. This is by design in v3.0 pre-parser; non-standard formats get flagged as `confidence = "low"` and handled by AI repair if needed.
- **Microsecond Overhead**: The 4-tuple generation adds $< 0.05\,\text{ms}$ per question block, remaining over 100x faster than network or AI calls.

---

## 4. Conclusion & Required Changes

The candidate 4-tuple scoring algorithm recommended by Challenger 1, with our refinements for line indentation and adjacent matches, completely resolves all 5 failure modes identified in Milestone 1 Adversarial Review while maintaining 100% backward compatibility and sub-millisecond throughput.

### Concrete Implementation Changes

#### 1. File: `engines/quiz/mcq_parser.py`
Replace lines 10 and 38-44 with:

```python
# Line 10:
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)

# Lines 38-44 replaced with:
        # Collect candidate option markers
        matches = list(OPT.finditer(seg))
        by_letter = {'A': [], 'B': [], 'C': [], 'D': []}
        for m in matches:
            by_letter[m.group(1)].append(m)

        # Find all valid ordered 4-tuples (A < B < C < D)
        valid_tuples = []
        if by_letter['A'] and by_letter['B'] and by_letter['C'] and by_letter['D']:
            for mA in by_letter['A']:
                for mB in by_letter['B']:
                    if mB.start() < mA.end():
                        continue
                    for mC in by_letter['C']:
                        if mC.start() < mB.end():
                            continue
                        for mD in by_letter['D']:
                            if mD.start() < mC.end():
                                continue
                            valid_tuples.append((mA, mB, mC, mD))

        if valid_tuples:
            def score_tuple(tup):
                mA, mB, mC, mD = tup
                # Prefer markers starting on newlines or at line start with indentation
                newline_score = sum(
                    1 for m in tup
                    if m.start() == 0 or seg[m.start() - 1] == '\n' or seg[:m.start()].rpartition('\n')[2].strip() == ''
                )
                # Penalize if option bodies contain newline option delimiters
                slices = [
                    seg[mA.end():mB.start()],
                    seg[mB.end():mC.start()],
                    seg[mC.end():mD.start()],
                    seg[mD.end():]
                ]
                sub_delims = sum(1 for sl in slices if re.search(r'\n\s*[A-D][\.\)\:]', sl))
                # Maximize newline_score, minimize sub_delims, prefer latest mA (closest to option block)
                return (newline_score, -sub_delims, mA.start())

            chosen = list(max(valid_tuples, key=score_tuple))
        else:
            # Fallback to prefix matching for incomplete/malformed options (< 4 options)
            idx = 0
            chosen = []
            for m in matches:
                if idx < 4 and m.group(1) == expected[idx]:
                    chosen.append(m)
                    idx += 1
```

#### 2. File: `engines/quiz/test_mcq_parser.py`
Append the 5 regression unit tests from `.agents/teamwork/explorer_quiz_m1_rem_scoring/proposed_test_mcq_parser_additions.py`:
- `test_stem_with_vitamin_a_dot`
- `test_stem_with_geometry_vuong_tai_a`
- `test_stem_with_scientific_name_a_thaliana`
- `test_option_content_sequential_letters`
- `test_question_number_without_punctuation`

#### 3. Ready-to-Apply Artifacts
- Full replacement file: `.agents/teamwork/explorer_quiz_m1_rem_scoring/proposed_mcq_parser.py`
- Patch diff: `.agents/teamwork/explorer_quiz_m1_rem_scoring/proposed_mcq_parser.patch`
- Unit tests to add: `.agents/teamwork/explorer_quiz_m1_rem_scoring/proposed_test_mcq_parser_additions.py`

---

## 5. Verification Method

1. **Verify Adversarial Stress Suite**:
   ```bash
   python .tmp/adversarial_mcq_test.py
   ```
   **Expected**: 20/20 PASSED (0 failures).

2. **Verify MCQ Parser Unit Suite**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   ```
   **Expected**: 19/19 PASSED (14 original + 5 new).

3. **Verify Regression Suite**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   **Expected**: 25/25 PASSED (all pipeline tests pass with 0 regressions).
