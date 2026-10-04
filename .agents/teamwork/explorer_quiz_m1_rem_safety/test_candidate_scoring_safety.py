import sys
import os
import re
import unittest

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ENGINES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "engines", "quiz"))
sys.path.insert(0, ENGINES_DIR)

from text_utils import strip_section_banner

BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)
OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")

def candidate_parse_mcq_blocks(text: str) -> list[dict]:
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

        matches = list(OPT.finditer(seg))
        by_letter = {'A': [], 'B': [], 'C': [], 'D': []}
        for m in matches:
            by_letter[m.group(1)].append(m)

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
                newline_score = sum(
                    1 for m in tup
                    if m.start() == 0 or seg[:m.start()].rstrip(' \t').endswith('\n')
                )
                slices = [
                    seg[mA.end():mB.start()],
                    seg[mB.end():mC.start()],
                    seg[mC.end():mD.start()],
                    seg[mD.end():]
                ]
                sub_delims = sum(1 for sl in slices if re.search(r'\n\s*[A-D][\.\)\:]', sl))
                return (newline_score, -sub_delims, mA.start())

            chosen = list(max(valid_tuples, key=score_tuple))
        else:
            idx = 0
            chosen = []
            for m in matches:
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

        stem = strip_section_banner(stem).strip()

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


class TestNewFiveCases(unittest.TestCase):
    def test_stem_contains_vitamin_a_dot(self):
        text = (
            "Câu 10. Thiếu Vitamin A. dẫn tới bệnh quáng gà và khô giác mạc:\n"
            "A. Phát biểu đúng\n"
            "B. Phát biểu sai\n"
            "C. Chưa đủ dữ kiện\n"
            "D. Không liên quan"
        )
        blocks = candidate_parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 10)
        self.assertEqual(b["confidence"], "high")
        self.assertIn("Vitamin A.", b["stem"])
        self.assertEqual(b["stem"], "Câu 10. Thiếu Vitamin A. dẫn tới bệnh quáng gà và khô giác mạc:")
        self.assertEqual(b["options"]["A"], "Phát biểu đúng")
        self.assertEqual(b["options"]["B"], "Phát biểu sai")
        self.assertEqual(b["options"]["C"], "Chưa đủ dữ kiện")
        self.assertEqual(b["options"]["D"], "Không liên quan")

    def test_stem_contains_geometry_vuong_tai_a(self):
        text = (
            "Câu 11. Cho tam giác ABC vuông tại A. Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:\n"
            "A. 5\n"
            "B. 6\n"
            "C. 7\n"
            "D. 8"
        )
        blocks = candidate_parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 11)
        self.assertEqual(b["confidence"], "high")
        self.assertIn("vuông tại A.", b["stem"])
        self.assertEqual(b["stem"], "Câu 11. Cho tam giác ABC vuông tại A. Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:")
        self.assertEqual(b["options"]["A"], "5")
        self.assertEqual(b["options"]["B"], "6")
        self.assertEqual(b["options"]["C"], "7")
        self.assertEqual(b["options"]["D"], "8")

    def test_stem_contains_species_a_thaliana(self):
        text = (
            "Câu 12. Cây mô hình A. thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:\n"
            "A. Đúng\n"
            "B. Sai\n"
            "C. Không xác định\n"
            "D. Chưa rõ"
        )
        blocks = candidate_parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 12)
        self.assertEqual(b["confidence"], "high")
        self.assertIn("A. thaliana", b["stem"])
        self.assertEqual(b["stem"], "Câu 12. Cây mô hình A. thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:")
        self.assertEqual(b["options"]["A"], "Đúng")
        self.assertEqual(b["options"]["B"], "Sai")
        self.assertEqual(b["options"]["C"], "Không xác định")
        self.assertEqual(b["options"]["D"], "Chưa rõ")

    def test_option_body_contains_inline_sequential_letters(self):
        text = (
            "Câu 13. Trong không gian Oxyz, chọn mệnh đề đúng:\n"
            "A. Điểm B. nằm trên trục Ox\n"
            "B. Điểm C. nằm trên trục Oy\n"
            "C. Điểm D. nằm trên trục Oz\n"
            "D. Cả 3 điểm trên"
        )
        blocks = candidate_parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 13)
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["stem"], "Câu 13. Trong không gian Oxyz, chọn mệnh đề đúng:")
        self.assertEqual(b["options"]["A"], "Điểm B. nằm trên trục Ox")
        self.assertEqual(b["options"]["B"], "Điểm C. nằm trên trục Oy")
        self.assertEqual(b["options"]["C"], "Điểm D. nằm trên trục Oz")
        self.assertEqual(b["options"]["D"], "Cả 3 điểm trên")

    def test_header_without_punctuation_space_only(self):
        text = (
            "Câu 14 Tìm x biết 2x + 1 = 5:\n"
            "A. x = 2\n"
            "B. x = 3\n"
            "C. x = 4\n"
            "D. x = 5"
        )
        blocks = candidate_parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 14)
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["stem"], "Câu 14 Tìm x biết 2x + 1 = 5:")
        self.assertEqual(b["options"]["A"], "x = 2")
        self.assertEqual(b["options"]["B"], "x = 3")
        self.assertEqual(b["options"]["C"], "x = 4")
        self.assertEqual(b["options"]["D"], "x = 5")


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestNewFiveCases)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    print(f"5 New Tests Result: passed={res.wasSuccessful()}")
