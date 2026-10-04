# Handoff Report — Milestone 1 (WP1) Adversarial Review

- **Agent**: Challenger 1 (`challenger_quiz_m1_1`)
- **Target**: `engines/quiz/mcq_parser.py`
- **Verdict**: **REQUEST_CHANGES**
- **Date**: 2026-10-03T16:25:00Z

---

## 1. Observation

Direct empirical observations and execution outputs from stress testing `engines/quiz/mcq_parser.py`:

### Observation 1.1: Truncation of Stem and Corruption of Option A on "Vitamin A."
- **Command**:
  ```bash
  python -c "import json, sys, os; sys.stdout.reconfigure(encoding='utf-8'); sys.path.insert(0, 'engines/quiz'); from mcq_parser import parse_mcq_blocks; text = '''Câu 10. Thiếu Vitamin A. dẫn tới bệnh quáng gà và khô giác mạc:\nA. Phát biểu đúng\nB. Phát biểu sai\nC. Chưa đủ dữ kiện\nD. Không liên quan'''; print(json.dumps(parse_mcq_blocks(text), indent=2, ensure_ascii=False))"
  ```
- **Verbatim Output**:
  ```json
  [
    {
      "source_number": 10,
      "stem": "Câu 10. Thiếu Vitamin",
      "options": {
        "A": "dẫn tới bệnh quáng gà và khô giác mạc:\nA. Phát biểu đúng",
        "B": "Phát biểu sai",
        "C": "Chưa đủ dữ kiện",
        "D": "Không liên quan"
      },
      "confidence": "high",
      "raw": "Câu 10. Thiếu Vitamin A. dẫn tới bệnh quáng gà và khô giác mạc:\nA. Phát biểu đúng\nB. Phát biểu sai\nC. Chưa đủ dữ kiện\nD. Không liên quan"
    }
  ]
  ```
- **File & Lines**: `engines/quiz/mcq_parser.py:38-44`
  ```python
  38:         idx = 0
  39:         chosen = []
  40:         for m in OPT.finditer(seg):
  41:             if idx < 4 and m.group(1) == expected[idx]:
  42:                 chosen.append(m)
  43:                 idx += 1
  ```
- **Result**: Stem is truncated to `"Câu 10. Thiếu Vitamin"`. The stem remainder and the actual option A are pushed into `options["A"]`. The block is marked with `"confidence": "high"`.

### Observation 1.2: Geometry Question with "vuông tại A." Corrupted
- **Command**:
  ```bash
  python -c "import json, sys, os; sys.stdout.reconfigure(encoding='utf-8'); sys.path.insert(0, 'engines/quiz'); from mcq_parser import parse_mcq_blocks; text = '''Câu 11. Cho tam giác ABC vuông tại A. Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:\nA. 5\nB. 6\nC. 7\nD. 8'''; print(json.dumps(parse_mcq_blocks(text), indent=2, ensure_ascii=False))"
  ```
- **Verbatim Output**:
  ```json
  [
    {
      "source_number": 11,
      "stem": "Câu 11. Cho tam giác ABC vuông tại",
      "options": {
        "A": "Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:\nA. 5",
        "B": "6",
        "C": "7",
        "D": "8"
      },
      "confidence": "high"
    }
  ]
  ```
- **Result**: "vuông tại A." in math geometry triggers option A delimiter. Stem truncated, option A polluted, confidence falsely marked `"high"`.

### Observation 1.3: Scientific Name "A. thaliana" Corrupted
- **Command**:
  ```bash
  python -c "import json, sys, os; sys.stdout.reconfigure(encoding='utf-8'); sys.path.insert(0, 'engines/quiz'); from mcq_parser import parse_mcq_blocks; text = '''Câu 12. Cây mô hình A. thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:\nA. Đúng\nB. Sai\nC. Không xác định\nD. Chưa rõ'''; print(json.dumps(parse_mcq_blocks(text), indent=2, ensure_ascii=False))"
  ```
- **Verbatim Output**:
  ```json
  [
    {
      "source_number": 12,
      "stem": "Câu 12. Cây mô hình",
      "options": {
        "A": "thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:\nA. Đúng",
        "B": "Sai",
        "C": "Không xác định",
        "D": "Chưa rõ"
      },
      "confidence": "high"
    }
  ]
  ```

### Observation 1.4: Premature Split on Sequential Letters in Option Body
- **Command**:
  ```bash
  python -c "import json, sys, os; sys.stdout.reconfigure(encoding='utf-8'); sys.path.insert(0, 'engines/quiz'); from mcq_parser import parse_mcq_blocks; text = '''Câu 13. Trong không gian Oxyz, chọn mệnh đề đúng:\nA. Điểm B. nằm trên trục Ox\nB. Điểm C. nằm trên trục Oy\nC. Điểm D. nằm trên trục Oz\nD. Cả 3 điểm trên'''; print(json.dumps(parse_mcq_blocks(text), indent=2, ensure_ascii=False))"
  ```
- **Verbatim Output**:
  ```json
  [
    {
      "source_number": 13,
      "stem": "Câu 13. Trong không gian Oxyz, chọn mệnh đề đúng:",
      "options": {
        "A": "Điểm",
        "B": "nằm trên trục Ox\nB. Điểm",
        "C": "nằm trên trục Oy\nC. Điểm",
        "D": "nằm trên trục Oz\nD. Cả 3 điểm trên"
      },
      "confidence": "high"
    }
  ]
  ```
- **Result**: Inside option A, the string `"Điểm B."` matches `OPT` for letter 'B' (since `idx == 1`). It captures `B.` at inline position instead of `\nB.` at line start. All subsequent options shift incorrectly.

### Observation 1.5: Question Number without Punctuation Dropped
- **Command**:
  ```bash
  python -c "import sys, os; sys.path.insert(0, 'engines/quiz'); from mcq_parser import parse_mcq_blocks; text = '''Câu 14 Tìm x biết 2x + 1 = 5:\nA. x = 2\nB. x = 3\nC. x = 4\nD. x = 5'''; print(parse_mcq_blocks(text))"
  ```
- **Verbatim Output**: `[]`
- **File & Lines**: `engines/quiz/mcq_parser.py:10`
  ```python
  10: NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.IGNORECASE)
  ```
- **Result**: `BOUNDARY` (line 9) splits on `(?:Câu\s*\d+[\.\:\s])`, but `NUM` strictly requires `[\.\:\)]` and rejects space-only delimiter `Câu 14 `, causing question 14 to be dropped completely.

---

## 2. Logic Chain

1. **Greedy Single-Pass State Machine**: `mcq_parser.py:38-44` uses a single forward loop looking for `A`, then `B`, then `C`, then `D`. It binds `A` to the very first token in `seg` matching `OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")`.
2. **False Assumptions in WP1 Specification**: The spec (`docs/QUIZ_PIPELINE_UPGRADE_PLAN.md:417-420`) assumed abbreviations in stems would only be later letters like `"Vitamin D."`. It failed to consider letter `"A."`, which is standard in Vietnamese exams (`tam giác vuông tại A.`, `Vitamin A.`, `chất A.`, `điểm A.`, `A. thaliana`).
3. **Cascading Failure & Masking**: When `"A."` in the stem is matched:
   - The stem is truncated at that point.
   - The real `A.` option is skipped because `idx` is already looking for `B`.
   - Real `B.`, `C.`, `D.` match normally.
   - All 4 options are non-empty, and stem is non-empty.
   - `is_high` evaluates to `True`, tagging the question as `"confidence": "high"`.
4. **Blast Radius on Downstream WP3**: Because `confidence == "high"`, WP3 assumes structural extraction was 100% successful and only sends options to AI for KaTeX/chemical formatting. Downstream PDF generation compiles corrupt worksheets with amputated stems and polluted options without any error being raised.

---

## 3. Caveats

- For standard questions without single-letter abbreviations in the stem, the parser correctly identifies 100% of questions and achieves exceptional performance (4.47 ms for 100 questions).
- The baseline test suite (`test_mcq_parser.py` with 14 tests and `test_quiz_pipeline_v2.py` with 22 tests) passes 100%, but lacked coverage for letter 'A' in stems and inline sequential letters.
- No other external components are broken; the issue is localized to `mcq_parser.py`.

---

## 4. Conclusion & Required Changes

**Verdict**: **REQUEST_CHANGES**

`mcq_parser.py` must be upgraded before WP2 and WP3 proceed. The greedy first-match approach must be replaced with a candidate 4-tuple selection algorithm that prioritizes line-anchored delimiters and ensures options do not contain unparsed option delimiters.

### Recommended Fix for Worker

Replace the greedy loop in `engines/quiz/mcq_parser.py:38-56` with candidate tuple scoring:

```python
        # Collect candidate option markers
        matches = list(OPT.finditer(seg))
        by_letter = {'A': [], 'B': [], 'C': [], 'D': []}
        for m in matches:
            by_letter[m.group(1)].append(m)

        # Find all valid ordered 4-tuples (A < B < C < D)
        valid_tuples = []
        for mA in by_letter['A']:
            for mB in by_letter['B']:
                if mB.start() <= mA.end(): continue
                for mC in by_letter['C']:
                    if mC.start() <= mB.end(): continue
                    for mD in by_letter['D']:
                        if mD.start() <= mC.end(): continue
                        valid_tuples.append((mA, mB, mC, mD))

        if valid_tuples:
            def score_tuple(tup):
                mA, mB, mC, mD = tup
                # Prefer markers starting on newlines
                newline_score = sum(
                    1 for m in tup
                    if m.start() == 0 or seg[m.start()-1] == '\n' or seg[:m.start()].endswith('\n')
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

And in `NUM`:
```python
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)
```

Also add the 5 failing test cases into `engines/quiz/test_mcq_parser.py` to prevent regression.

---

## 5. Verification Method

To independently verify the bug and reproduction:

1. Run the test script in `.tmp/adversarial_mcq_test.py`:
   ```bash
   python .tmp/adversarial_mcq_test.py
   ```
   **Expected**: 5 test cases fail in Category 7 (`Cat7_StemVitaminA_Dot`, `Cat7_StemGeometryVuongTaiA`, `Cat7_StemA_Thaliana`, `Cat7_OptionContentSequentialLetters`, `Cat7_HeaderWithoutPunctuation`).

2. Invalidation condition:
   Applying the recommended fix in `mcq_parser.py` makes `.tmp/adversarial_mcq_test.py` pass 20/20 tests with 0 failures, while preserving 100% pass rate in `test_quiz_pipeline_v2.py`.
