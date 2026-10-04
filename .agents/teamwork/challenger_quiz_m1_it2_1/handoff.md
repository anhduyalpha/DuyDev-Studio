# Handoff Report — Milestone 1 Iteration 2 (WP1 Remediation)

- **Agent**: Challenger 1 (`challenger_quiz_m1_it2_1`)
- **Target**: `engines/quiz/mcq_parser.py`
- **Verdict**: **APPROVE**
- **Date**: 2026-10-03T16:52:00Z

---

## 1. Observation

Direct empirical observations and execution outputs from re-running adversarial tests against the updated `engines/quiz/mcq_parser.py`:

### Observation 1.1: Verification of 5 Previously Failing Tests (Iteration 1 Regressions)
- **Execution Command**:
  ```bash
  python .tmp/adversarial_mcq_test.py
  ```
- **Verbatim Output**:
  ```
  [PASS] Cat1_MixedDelimiters: Mixed delimiters A., B), C:, D.
  [PASS] Cat1_SameLineOptions: All options on same line
  [PASS] Cat2_MultilineOptions: Multi-line options with indentations
  [PASS] Cat3_ImageRefAndBanner: Preserve IMAGE_REF and strip trailing banner
  [PASS] Cat4_MissingOptionsLowConfidence: Missing C and D marks confidence='low'
  [PASS] Cat4_EmptyOptionLowConfidence: Empty option C marks confidence='low'
  [PASS] Cat5_Scale100Questions: Parsed 100 questions in 6.15 ms (0.061 ms/q)
  [PASS] Cat6_EmptyString: Empty string returns []
  [PASS] Cat6_WhitespaceOnly: Whitespace only returns []
  [PASS] Cat6_NoneType: None input returns []
  [PASS] Cat6_NonStringType: Integer input returns []
  [PASS] Cat6_PreambleOnly: Header only returns []
  [PASS] Cat7_StemVitaminABCD: Vitamin A, B, C, D. in stem
  [PASS] Cat7_StemD_Melanogaster: D. melanogaster in stem
  [PASS] Cat7_StemMathVariables: Math variables $A = 5, B = 10$ in stem
  [PASS] Cat7_StemVitaminA_Dot: Stem contains 'Vitamin A.' abbreviation
  [PASS] Cat7_StemGeometryVuongTaiA: Stem contains 'tam giác ABC vuông tại A.'
  [PASS] Cat7_StemA_Thaliana: Stem contains scientific name 'A. thaliana'
  [PASS] Cat7_OptionContentSequentialLetters: Option contents containing next expected letter (Điểm B., Điểm C.)
  [PASS] Cat7_HeaderWithoutPunctuation: Question header 'Câu 14 ' without punctuation

  ============================================================
  ADVERSARIAL STRESS TEST FINAL RESULT: 20 PASSED, 0 FAILED
  ============================================================
  ```
- **Specific Status of Previously Failing Cases**:
  1. `Cat7_StemVitaminA_Dot` ("Vitamin A." in stem): **PASS** (stem intact: `"Câu 10. Thiếu Vitamin A. dẫn tới bệnh quáng gà và khô giác mạc:"`, option A: `"Phát biểu đúng"`, confidence: `"high"`).
  2. `Cat7_StemGeometryVuongTaiA` ("tam giác ABC vuông tại A." in stem): **PASS** (stem intact: `"Câu 11. Cho tam giác ABC vuông tại A. Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:"`, option A: `"5"`, confidence: `"high"`).
  3. `Cat7_StemA_Thaliana` ("A. thaliana" in stem): **PASS** (stem intact: `"Câu 12. Cây mô hình A. thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:"`, option A: `"Đúng"`, confidence: `"high"`).
  4. `Cat7_OptionContentSequentialLetters` ("A. Điểm B. nằm trên..." inline sequential letter options): **PASS** (option A: `"Điểm B. nằm trên trục Ox"`, option B: `"Điểm C. nằm trên trục Oy"`, option C: `"Điểm D. nằm trên trục Oz"`, option D: `"Cả 3 điểm trên"`, confidence: `"high"`).
  5. `Cat7_HeaderWithoutPunctuation` ("Câu 14 " space-only unpunctuated header): **PASS** (source number: `14`, stem intact, options segmented, confidence: `"high"`).

### Observation 1.2: Official Quiz Engine Test Suites
- **Commands & Outputs**:
  - `python engines/quiz/test_mcq_parser.py`:
    ```
    Ran 19 tests in 0.007s — OK
    ```
  - `python engines/quiz/test_quiz_pipeline_v2.py`:
    ```
    Ran 25 tests in 0.149s — OK
    ```
  - `python engines/quiz/test_adversarial_wp2.py`:
    ```
    Ran 20 tests in 0.016s — OK
    ```

### Observation 1.3: Advanced Iteration 2 Adversarial Stress Suite
- **Command**:
  ```bash
  python .tmp/adversarial_mcq_test_it2.py
  ```
- **Verbatim Output**:
  ```
  [PASS] A1_VitaminA_Dot: Stem with 'Vitamin A.' preserves stem and options
  [PASS] A2_GeometryVuongTaiA: Stem with 'vuông tại A.' preserved
  [PASS] A3_SpeciesA_Thaliana: Stem with species 'A. thaliana' preserved
  [PASS] A4_OptionSequentialLetters: Options containing sequential letter tokens 'B.', 'C.', 'D.'
  [PASS] A5_UnpunctuatedHeader: Question header 'Câu 14 ' without punctuation
  [PASS] B1_StemContainsFullABCDTuple: Stem containing candidate A, B, C, D tuple does not hijack options
  [PASS] B2_StemMultipleA_SameLineOptions: Stem with multiple 'A.' tokens and same-line options
  [PASS] B3_MultiQuestionMixedHeaders: 5 consecutive questions with 5 different header styles
  [PASS] B4_OptionsWithLaTeXDelimiters: LaTeX expressions with dots inside option values
  [PASS] B5_Degraded2OptionsLowConfidence: Two options (True/False) parsed with confidence='low'
  [PASS] B6_Degraded3OptionsLowConfidence: Three options parsed with confidence='low'
  [PASS] B7_TabsInSameLineOptions: Tabs separating options on same line
  [PASS] B8_Stress200DiverseQuestions: Parsed 200 diverse adversarial questions in 10.37 ms (0.052 ms/q)
  [PASS] B9_CountAvailableInvariant: count_available_questions matches len(parse_mcq_blocks) == 200

  =================================================================
  ADVERSARIAL SUITE IT2 RESULT: 14 PASSED, 0 FAILED
  =================================================================
  ```

### Observation 1.4: Backend System Health
- `cd server && npx tsc --noEmit`: Exited 0 with **0 errors**.
- `cd server && npx vitest run`: **45 test files passed, 494 tests passed, 0 failed**.

---

## 2. Logic Chain

1. **Root Cause Remediation**:
   - In Iteration 1, `mcq_parser.py` greedily matched the first occurrence of `A.` via a forward state machine, truncating stems on abbreviations (`Vitamin A.`, `vuông tại A.`) and shifting options on inline sequential letters (`Điểm B.`).
   - In Iteration 2, the worker refactored `mcq_parser.py` (lines 38-78) to generate candidate ordered 4-tuples $(m_A, m_B, m_C, m_D)$ where $m_A < m_B < m_C < m_D$.
2. **Tuple Scoring Invariant Verification**:
   - The candidate scoring function calculates:
     $$\text{score} = (\text{newline\_score},\; -\text{sub\_delims},\; m_A.\text{start}())$$
   - *Newline preference*: Delimiters at line start or indentation receive $+1$.
   - *Sub-delimiter penalty*: If an option body contains a line-starting delimiter (`\n\s*[A-D][\.\)\:]`), it is penalized. When a stem candidate tuple is considered, the trailing option body slice encompasses the genuine option block, inducing severe negative penalty.
   - *Proximity bias*: Between ties, the latest $m_A$ closest to the real option block wins.
3. **Punctuation Independence**:
   - `NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)` now cleanly accepts space-only delimiters like `Câu 14 `, preventing dropped questions.
4. **Fallback Safety**:
   - When no valid 4-tuple exists (such as 2-option True/False questions or 3-option fragments), lines 80-87 fall back to prefix matching and mark `confidence: "low"`, ensuring graceful degradation without pipeline failure.

---

## 3. Caveats

- **No caveats.** The implementation in `engines/quiz/mcq_parser.py` satisfies all functional requirements and performance benchmarks (~0.05 ms/question), with zero regressions across both the Python engine and Fastify backend test suites.

---

## 4. Conclusion

**Verdict**: **APPROVE**

All 5 previously reported defects have been verified as fully resolved:
1. `Vitamin A.` stem preservation: **FIXED & VERIFIED**
2. `vuông tại A.` geometry stem preservation: **FIXED & VERIFIED**
3. `A. thaliana` biological nomenclature: **FIXED & VERIFIED**
4. Inline sequential letter options (`Điểm B.`): **FIXED & VERIFIED**
5. Unpunctuated question headers (`Câu 14 `): **FIXED & VERIFIED**

In addition, 14 advanced adversarial test cases (spanning multi-question mixed formats, LaTeX dot delimiters, tab indentation, degraded questions, and 200-question high volume stress testing) passed with 100% success. Milestone 1 (WP1 & WP2) is complete, robust, and ready for Milestone 2.

---

## 5. Verification Method

To independently verify the test results:

```bash
# 1. Run Iteration 1 adversarial suite (20 tests)
python .tmp/adversarial_mcq_test.py

# 2. Run Iteration 2 advanced adversarial suite (14 tests)
python .tmp/adversarial_mcq_test_it2.py

# 3. Run official engine test suites
python engines/quiz/test_mcq_parser.py
python engines/quiz/test_quiz_pipeline_v2.py
python engines/quiz/test_adversarial_wp2.py

# 4. Verify TypeScript gateway and Vitest suite
cd server && npx tsc --noEmit
cd server && npx vitest run
```
