# Technical Analysis & Implementation Blueprint: WP1 Pre-Parser Deterministic

- **Milestone**: Milestone 1 (WP1) — Quiz Pipeline v3.0
- **Author**: Explorer 1 (MCQ Parser & Text Utils Specialist)
- **Target Files**:
  - `engines/quiz/text_utils.py` (New)
  - `engines/quiz/mcq_parser.py` (New)
  - `engines/quiz/test_mcq_parser.py` (New)
  - `engines/quiz/quiz_pipeline.py` (Edit: re-export & remove redundant definitions)
- **Reference**: `docs/QUIZ_PIPELINE_UPGRADE_PLAN.md` §WP1, `ORIGINAL_REQUEST.md`

---

## 1. Executive Summary

Milestone 1 (WP1) lays the deterministic foundation for Quiz Pipeline v3.0 by extracting question structures using pure regex before any AI model is invoked. This directly resolves the architectural root cause of Bug P0-1 (question duplication when `count > available`), as subsequent stages (WP2, WP3) will know the exact count of available questions in advance.

To support this without introducing circular imports or breaking the existing 22 unit tests in `engines/quiz/test_quiz_pipeline_v2.py`, text processing utilities (`is_section_banner`, `strip_section_banner`, `clean_image_markers`) must be decoupled into `engines/quiz/text_utils.py` and transparently re-exported in `quiz_pipeline.py`.

A prototype of `text_utils` and `mcq_parser` was implemented and validated in the explorer workspace against 14 unit test cases with 100% pass rate in 0.005 seconds.

---

## 2. Investigation of `engines/quiz/quiz_pipeline.py`

### 2.1 Target Function Locations for Extraction

In `engines/quiz/quiz_pipeline.py`:
1. `is_section_banner(text: str) -> bool`
   - **Lines 169–189**: Detects Vietnamese exam section dividers (e.g., `PHẦN I`, `PHẦN II`, `BẢNG ĐÁP ÁN`, `HƯỚNG DẪN GIẢI`).
   - Uses only standard library `re`.
2. `strip_section_banner(text: str) -> str`
   - **Lines 192–201**: Strips trailing or embedded section divider banners using multi-line regex substitution.
   - Uses only standard library `re`.
3. `clean_image_markers(text: str) -> str`
   - **Lines 487–491**: Cleans internal `[IMAGE_REF: ...]` tokens from user-facing text.
   - Uses only standard library `re`.

### 2.2 Trace of Call Sites in Codebase

| Function | Call Sites in `quiz_pipeline.py` | Call Sites in `test_quiz_pipeline_v2.py` |
|---|---|---|
| `is_section_banner` | Lines 453, 458 (spatial layout), 512 (asset filtering), 773, 791 (stitching) | Line 41 (import), Lines 379–389 (`test_is_section_banner_detection`) |
| `strip_section_banner` | Lines 940 (`chunk_questions_sliding_window`), 985, 1004, 1009 (`normalize_question`) | Used transitively via `chunk_questions_sliding_window` (line 420) and `normalize_question` (line 438) |
| `clean_image_markers` | Lines 590, 593, 597, 598 (`link_assets_to_questions`), 1013, 1021 (`normalize_question`), 1179, 1196, 1509 (`render_question_content_html`) | Line 39 (import), verified in `test_marker_purged_on_direct_match` (line 300) |

### 2.3 Re-Export & Backward Compatibility Strategy

`test_quiz_pipeline_v2.py` imports directly from `quiz_pipeline`:
```python
from quiz_pipeline import (
    ...
    clean_image_markers,
    is_running_header_or_footer,
    is_section_banner,
    extract_structured_page_content
)
```

To maintain 100% backwards compatibility with all 22 tests:
1. `engines/quiz/text_utils.py` is created containing `is_section_banner`, `strip_section_banner`, and `clean_image_markers`.
2. In `engines/quiz/quiz_pipeline.py`:
   - At the module top (around lines 33–34), ensure local engine directory is on `sys.path`:
     ```python
     sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
     from text_utils import is_section_banner, strip_section_banner, clean_image_markers
     ```
   - Delete original function definitions at lines 169–201 and lines 487–491.
3. This guarantees that:
   - External callers importing from `quiz_pipeline` receive identical symbols without any breaking change.
   - Internal functions in `quiz_pipeline.py` continue resolving these symbols from module globals.
   - `mcq_parser.py` can import `strip_section_banner` from `text_utils` without importing `quiz_pipeline.py` (which imports `pymupdf` and other heavy modules), completely eliminating circular imports.

---

## 3. Design of `engines/quiz/mcq_parser.py`

### 3.1 Public Interface & Data Contract

`mcq_parser.py` exports two public functions:
```python
def parse_mcq_blocks(text: str) -> list[dict]:
    """Parse stitched text into structured MCQ question blocks using deterministic regex."""

def count_available_questions(text: str) -> int:
    """Return count of detected questions, equivalent to len(parse_mcq_blocks(text))."""
```

Each parsed question dictionary follows this exact contract:
```python
{
    "source_number": int,    # Original question number from document (e.g. 12 from "Câu 12.")
    "stem": str,             # Question stem, stripped of section banners, preserving [IMAGE_REF: ...]
    "options": {             # Exactly 4 option keys (A, B, C, D)
        "A": str,
        "B": str,
        "C": str,
        "D": str
    },
    "confidence": str,       # "high" | "low"
    "raw": str               # Verbatim segment string for fallback in AI degradation
}
```

### 3.2 Regex Architecture & State Machine

#### Step 1: Question Boundary Splitting
```python
BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
```
- Reuses the battle-tested boundary expression from `quiz_pipeline.py:929`.
- Splits the full stitched document into question candidates.
- Any segment that does not start with `^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)` is discarded as preamble or document header.

#### Step 2: Source Number Extraction
```python
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.IGNORECASE)
```
- Matches `"Câu 1."`, `"Câu 1:"`, `"Câu 1)"`, `"1."`, `"1:"`, `"1)"`.
- Extracts `int(m.group(1))` as `source_number`. If unmatched, segment is skipped.

#### Step 3: Option Label Matching with Lookbehind
```python
OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")
```
- **Crucial Lookbehind `(?<=\s)`**: Guarantees that option letters are preceded by whitespace or string start.
- Prevents false-positive matches inside words, e.g. `phenolB.y` will NOT match because `B` is preceded by `l`.
- Supports delimiters `.`, `)`, and `:`.

#### Step 4: Ascending Option Selection Algorithm (A -> B -> C -> D)
Vietnamese stems frequently contain abbreviations ending with a period, such as `"Câu 3. Vitamin D. có vai trò gì?"` or `"Cho sơ đồ biến hóa chất D."`. If all regex matches were collected naively, `D.` in the stem would match option `D` before option `A`, corrupting both the stem and option mapping.

The parser uses a strict ascending state machine:
```python
expected = ["A", "B", "C", "D"]
idx = 0
chosen = []
for m in OPT.finditer(seg):
    if idx < 4 and m.group(1) == expected[idx]:
        chosen.append(m)
        idx += 1
```
- When `idx == 0`, only an `"A"` match is accepted. Any `"D."` in `"Vitamin D."` is skipped.
- Once `"A"` is found, only `"B"` is accepted, then `"C"`, then `"D"`.
- Once 4 options are found (`idx == 4`), further matches are ignored.

#### Step 5: Stem & Option Boundary Slicing
- Stem slice: `seg[:chosen[0].start()]` if `chosen` is non-empty; otherwise `seg`.
- Option `k` slice: text from `chosen[k].end()` to `chosen[k+1].start()` (or `len(seg)` for the last option).
- Banner sanitization:
  - `stem = strip_section_banner(stem).strip()`
  - For each option `k`: `options[letter] = strip_section_banner(seg[start:end]).strip()`
  - **Preserves Image Markers**: Does NOT invoke `clean_image_markers`, ensuring `[IMAGE_REF: ...]` remains intact for `link_assets_to_questions` downstream.

#### Step 6: Confidence Scoring
A question block receives `confidence = "high"` if and only if:
1. `len(chosen) == 4` (all 4 options A, B, C, D present in ascending order).
2. All 4 options (`options["A"]`, `"B"`, `"C"`, `"D"`) are non-empty strings after `.strip()`.
3. `stem` is a non-empty string after stripping banners.

Otherwise, `confidence = "low"`.
Low-confidence blocks are **retained** in the returned list so that WP3 can salvage them using AI or fallback to `raw`.

---

## 4. Test Suite Design: `engines/quiz/test_mcq_parser.py`

The test suite covers 14 specific scenarios:

| # | Test Method | Scenario Covered | Expected Result |
|---|---|---|---|
| 1 | `test_standard_dot_delimiter` | `Câu 1. ... A. x B. y C. z D. w` | `confidence: "high"`, 4 options extracted |
| 2 | `test_parenthesis_delimiter` | `Câu 2: ... A) x B) y C) z D) w` | `confidence: "high"`, 4 options extracted |
| 3 | `test_colon_delimiter` | `3. ... A: x B: y C: z D: w` | `confidence: "high"`, numeric prefix without "Câu" |
| 4 | `test_same_line_options` | `A. CH4 B. C2H5OH\nC. CaCO3 D) Fe2O3` | Options on same line cleanly split |
| 5 | `test_abbreviation_in_stem` | `Câu 3. Vitamin D. có vai trò gì?...` | Stem keeps `Vitamin D.`, options A–D matched correctly |
| 6 | `test_embedded_label_in_word` | `Câu 5. Hợp chất phenolB.y...` | Lookbehind prevents `B.` in `phenolB.y` from matching |
| 7 | `test_missing_option_d` | Question with only A, B, C (missing D) | `confidence: "low"`, `options["D"] == ""` |
| 8 | `test_empty_option_value` | Option B has empty value (`B.\nC. z`) | `confidence: "low"`, `options["B"] == ""` |
| 9 | `test_preserves_image_ref` | Stem with `[IMAGE_REF: fig_p1_1]` | Marker preserved verbatim in stem |
| 10 | `test_trailing_section_banner` | Option D followed by `PHẦN II...` | Section banner stripped from option D |
| 11 | `test_empty_and_preamble_only` | Empty text, whitespace, or preamble without questions | Returns `[]`, count = 0 |
| 12 | `test_count_available_questions` | 3 questions with document header | `count_available_questions(...) == 3` |
| 13 | `test_source_number_preserved` | `Câu 18. ...` | `source_number == 18` |
| 14 | `test_low_confidence_retained` | 3 questions, 1 of which is missing options | All 3 returned; low confidence block kept in list |

---

## 5. Concrete Code Implementation

### 5.1 `engines/quiz/text_utils.py`
```python
"""
Text utility functions for Quiz Pipeline v3.0:
- Section banner detection and stripping
- Image marker cleanup
"""

import re


def is_section_banner(text: str) -> bool:
    """
    Detect if text is a section divider or banner (e.g. 'PHẦN I', 'PHẦN II', 'PHẦN 1',
    'PHẦN II. Câu trắc nghiệm đúng sai.', 'CÂU TRẮC NGHIỆM ĐÚNG SAI', 'BẢNG ĐÁP ÁN', 'HƯỚNG DẪN GIẢI').
    Such banners are structural layout dividers and must never be extracted as images,
    nor merged into the preceding question's body.
    """
    if not text:
        return False
    t = text.strip()
    if re.match(r"^\s*(?:câu\s*\d+|\d+[\.\:])", t, re.IGNORECASE):
        return False
    if re.search(r"^\s*(?:[-•*]\s*)?PH[ẦAÀẢÃẠÂẦẤẨẪẬa-z\ufffd\W]*N\s*[:\.]?\s*(?:[IVXLCDM]+|\d+)", t, re.IGNORECASE):
        return True
    if re.search(r"tr[ắa\ufffd\W]?c\s*nghi[ệe\ufffd\W]?m\s*(?:[đd\ufffd\W]?[úu\ufffd\W]?ng\s*sai|nhi[ềe\ufffd\W]?u|tr[ảa\ufffd\W]?\s*l[ờo\ufffd\W]?i)", t, re.IGNORECASE):
        return True
    if re.search(r"^\s*(?:[-•*]\s*)?(?:B[ẢA\ufffd\W]?NG\s*Đ[ÁA\ufffd\W]?P\s*[ÁA\ufffd\W]?N|H[ƯU\ufffd\W]?ỚNG\s*D[ẪA\ufffd\W]?N\s*GI[ẢA\ufffd\W]?I|L[ỜO\ufffd\W]?I\s*GI[ẢA\ufffd\W]?I\s*CHI\s*TI[ẾE\ufffd\W]?T|Đ[ÁA\ufffd\W]?P\s*[ÁA\ufffd\W]?N\s*CHI\s*TI[ẾE\ufffd\W]?T)\b", t, re.IGNORECASE):
        return True
    if re.search(r"^\s*(?:[-•*]\s*)?(?:MỤC|MUC|CHUY[ÊE\ufffd\W]?N\s*Đ[ỀE\ufffd\W]?)\s*[:\.]?\s*(?:[IVXLCDM]+|\d+)", t, re.IGNORECASE):
        return True
    return False


def strip_section_banner(text: str) -> str:
    """Strip any trailing or embedded section divider banners from text."""
    if not text:
        return ""
    pattern = (
        r"(?:^|\n)\s*(?:(?:[-•*]\s*)?PH[ẦAÀẢÃẠÂẦẤẨẪẬa-z\ufffd\W]*N\s*[:\.]?\s*(?:[IVXLCDM]+|\d+)|"
        r"tr[ắa\ufffd\W]?c\s*nghi[ệe\ufffd\W]?m\s*(?:[đd\ufffd\W]?[úu\ufffd\W]?ng\s*sai|nhi[ềe\ufffd\W]?u|tr[ảa\ufffd\W]?\s*l[ờo\ufffd\W]?i)|"
        r"B[ẢA\ufffd\W]?NG\s*Đ[ÁA\ufffd\W]?P\s*[ÁA\ufffd\W]?N|H[ƯU\ufffd\W]?ỚNG\s*D[ẪA\ufffd\W]?N\s*GI[ẢA\ufffd\W]?I\b).*$"
    )
    return re.sub(pattern, "", str(text), flags=re.IGNORECASE | re.MULTILINE).strip()


def clean_image_markers(text: str) -> str:
    """Purge internal [IMAGE_REF: ...] markers from human-facing text."""
    if not text:
        return ""
    return re.sub(r"\[IMAGE_REF:\s*[^\]]+\]", "", str(text)).strip()
```

### 5.2 `engines/quiz/mcq_parser.py`
```python
"""
MCQ Parser Module for Quiz Pipeline v3.0 (WP1)
Deterministic regex-based multiple choice question pre-parser (zero AI dependencies).
"""

import re
import sys
import os

# Ensure local engine modules are discoverable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_utils import strip_section_banner


BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.IGNORECASE)
OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")


def parse_mcq_blocks(text: str) -> list[dict]:
    """
    Parse stitched text into structured multiple-choice questions (MCQ) using deterministic regex.
    Does NOT call AI. Returns blocks in exact order of appearance.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return []

    splits = BOUNDARY.split(text)
    blocks = []
    expected = ["A", "B", "C", "D"]

    for s in splits:
        seg = s.strip()
        if not seg:
            continue
        if not re.match(r"^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)", seg, re.IGNORECASE):
            continue

        num_m = NUM.match(seg)
        if not num_m:
            continue
        source_number = int(num_m.group(1))

        # Ascending option matching: A -> B -> C -> D
        idx = 0
        chosen = []
        for m in OPT.finditer(seg):
            if idx < 4 and m.group(1) == expected[idx]:
                chosen.append(m)
                idx += 1

        options = {"A": "", "B": "", "C": "", "D": ""}
        if chosen:
            stem = seg[:chosen[0].start()]
            for k in range(len(chosen)):
                letter = chosen[k].group(1)
                start = chosen[k].end()
                end = chosen[k + 1].start() if k + 1 < len(chosen) else len(seg)
                opt_val = strip_section_banner(seg[start:end]).strip()
                options[letter] = opt_val
        else:
            stem = seg

        # Strip any section banner in stem while preserving [IMAGE_REF: ...]
        stem = strip_section_banner(stem).strip()

        # Confidence assessment
        is_high = (
            len(chosen) == 4
            and all(bool(options[k]) for k in ["A", "B", "C", "D"])
            and bool(stem)
        )
        confidence = "high" if is_high else "low"

        blocks.append({
            "source_number": source_number,
            "stem": stem,
            "options": options,
            "confidence": confidence,
            "raw": seg
        })

    return blocks


def count_available_questions(text: str) -> int:
    """Return count of available MCQ questions found in text. Equivalent to len(parse_mcq_blocks(text))."""
    return len(parse_mcq_blocks(text))
```

### 5.3 `engines/quiz/test_mcq_parser.py`
```python
"""
Unit tests for deterministic MCQ pre-parser (WP1).
Covers 14 edge cases for format variability, abbreviations, lookbehinds, banners, and confidence.
"""

import sys
import os
import unittest

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcq_parser import parse_mcq_blocks, count_available_questions


class TestMCQParser(unittest.TestCase):

    def test_standard_dot_delimiter(self):
        text = "Câu 1. Dung dịch nào sau đây làm quỳ tím hóa đỏ?\nA. HCl\nB. NaOH\nC. NaCl\nD. H2O"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 1)
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["stem"], "Câu 1. Dung dịch nào sau đây làm quỳ tím hóa đỏ?")
        self.assertEqual(b["options"]["A"], "HCl")
        self.assertEqual(b["options"]["B"], "NaOH")
        self.assertEqual(b["options"]["C"], "NaCl")
        self.assertEqual(b["options"]["D"], "H2O")

    def test_parenthesis_delimiter(self):
        text = "Câu 2: Nguyên tử khối của Oxi là\nA) 16\nB) 32\nC) 8\nD) 64"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 2)
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["options"]["A"], "16")
        self.assertEqual(b["options"]["B"], "32")
        self.assertEqual(b["options"]["C"], "8")
        self.assertEqual(b["options"]["D"], "64")

    def test_colon_delimiter(self):
        text = "3. Kim loại nào nhẹ nhất?\nA: Li\nB: Na\nC: K\nD: Cs"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 3)
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["options"]["A"], "Li")
        self.assertEqual(b["options"]["B"], "Na")
        self.assertEqual(b["options"]["C"], "K")
        self.assertEqual(b["options"]["D"], "Cs")

    def test_same_line_options(self):
        text = "Câu 4. Cho các chất:\nA. CH4 B. C2H5OH\nC. CaCO3 D) Fe2O3"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["options"]["A"], "CH4")
        self.assertEqual(b["options"]["B"], "C2H5OH")
        self.assertEqual(b["options"]["C"], "CaCO3")
        self.assertEqual(b["options"]["D"], "Fe2O3")

    def test_abbreviation_in_stem_not_prematurely_matched(self):
        text = "Câu 3. Vitamin D. có vai trò gì quan trọng trong cơ thể?\nA. Hấp thu canxi\nB. Cung cấp năng lượng\nC. Tạo máu\nD. Chống oxy hóa"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertIn("Vitamin D.", b["stem"])
        self.assertEqual(b["options"]["A"], "Hấp thu canxi")
        self.assertEqual(b["options"]["B"], "Cung cấp năng lượng")
        self.assertEqual(b["options"]["C"], "Tạo máu")
        self.assertEqual(b["options"]["D"], "Chống oxy hóa")

    def test_embedded_label_in_word_ignored(self):
        text = "Câu 5. Hợp chất phenolB.y tham gia phản ứng:\nA. Tác dụng với Na\nB. Tác dụng với NaOH\nC. Tác dụng với Br2\nD. Cả 3 đáp án trên"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertIn("phenolB.y", b["stem"])
        self.assertEqual(b["options"]["A"], "Tác dụng với Na")

    def test_missing_option_d_low_confidence(self):
        text = "Câu 6. Đề thi bị rách chỉ còn 3 phương án:\nA. Lựa chọn 1\nB. Lựa chọn 2\nC. Lựa chọn 3"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "low")
        self.assertEqual(b["options"]["A"], "Lựa chọn 1")
        self.assertEqual(b["options"]["B"], "Lựa chọn 2")
        self.assertEqual(b["options"]["C"], "Lựa chọn 3")
        self.assertEqual(b["options"]["D"], "")

    def test_empty_option_value_low_confidence(self):
        text = "Câu 7. Lỗi in ấn phương án B bị bỏ trống:\nA. Có nội dung\nB.\nC. Nội dung C\nD. Nội dung D"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "low")
        self.assertEqual(b["options"]["B"], "")

    def test_preserves_image_ref_in_stem(self):
        text = "Câu 8. Cho hình vẽ thí nghiệm dưới đây [IMAGE_REF: fig_p1_1]. Hiện tượng xảy ra là:\nA. Có kết tủa\nB. Sủi bọt khí\nC. Không phản ứng\nD. Đổi màu"
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertIn("[IMAGE_REF: fig_p1_1]", b["stem"])

    def test_trailing_section_banner_stripped(self):
        text = (
            "Câu 9. Chất nào sau đây là ankan?\n"
            "A. C2H4\n"
            "B. C2H2\n"
            "C. C6H6\n"
            "D. CH4\n"
            "PHẦN II. Câu trắc nghiệm đúng sai.\n"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["options"]["D"], "CH4")
        self.assertNotIn("PHẦN II", b["options"]["D"])

    def test_empty_and_preamble_only_text(self):
        self.assertEqual(parse_mcq_blocks(""), [])
        self.assertEqual(count_available_questions(""), 0)
        self.assertEqual(parse_mcq_blocks("   \n\t  "), [])
        self.assertEqual(count_available_questions("   \n\t  "), 0)
        self.assertEqual(parse_mcq_blocks("BỘ GIÁO DỤC VÀ ĐÀO TẠO\nĐỀ THI THỬ TỐT NGHIỆP THPT"), [])
        self.assertEqual(count_available_questions("BỘ GIÁO DỤC VÀ ĐÀO TẠO\nĐỀ THI THỬ TỐT NGHIỆP THPT"), 0)

    def test_count_available_questions_matches_parse_length(self):
        text = (
            "SỞ GIÁO DỤC ĐÀO TẠO\n\n"
            "Câu 1. Khí laughing gas là:\nA. N2O\nB. NO\nC. NO2\nD. N2\n\n"
            "Câu 2. Chất nào là muối ăn?\nA. NaCl\nB. KCl\nC. CaCl2\nD. BaCl2\n\n"
            "Câu 3. Nước vôi trong là dung dịch:\nA. Ca(OH)2\nB. NaOH\nC. KOH\nD. Ba(OH)2\n"
        )
        self.assertEqual(count_available_questions(text), 3)
        self.assertEqual(len(parse_mcq_blocks(text)), 3)

    def test_source_number_preserved_from_pdf(self):
        text = (
            "Câu 18. Cho m gam sắt tác dụng với dung dịch HCl dư:\n"
            "A. 1,12 lít\nB. 2,24 lít\nC. 3,36 lít\nD. 4,48 lít"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["source_number"], 18)

    def test_low_confidence_blocks_are_kept_not_dropped(self):
        text = (
            "Câu 1. Câu hỏi bình thường\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 2. Câu hỏi thiếu phương án\nA. 1\nB. 2\n\n"
            "Câu 3. Câu hỏi bình thường khác\nA. a\nB. b\nC. c\nD. d"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 3)
        self.assertEqual(blocks[0]["confidence"], "high")
        self.assertEqual(blocks[1]["confidence"], "low")
        self.assertEqual(blocks[2]["confidence"], "high")
        self.assertEqual(blocks[1]["source_number"], 2)


if __name__ == "__main__":
    unittest.main()
```

### 5.4 Exact Diff Plan for `engines/quiz/quiz_pipeline.py`

#### Edit 1: Re-export in header
Around line 33:
```python
# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure engines/quiz directory is on sys.path for direct imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_utils import is_section_banner, strip_section_banner, clean_image_markers
```

#### Edit 2: Remove redundant definitions
- Remove lines 169–201:
  - `def is_section_banner(text: str) -> bool: ...`
  - `def strip_section_banner(text: str) -> str: ...`
- Remove lines 487–491:
  - `def clean_image_markers(text: str) -> str: ...`

---

## 6. Verification Criteria for WP1

1. **New Unit Tests**:
   ```bash
   python engines/quiz/test_mcq_parser.py
   ```
   *Requirement*: 14 tests run, 14 pass, 0 fail, 0 errors.

2. **Existing Regression Suite**:
   ```bash
   python engines/quiz/test_quiz_pipeline_v2.py
   ```
   *Requirement*: All 22 existing tests continue passing with 100% pass rate, 0 fail, 0 errors, 0 skip.
