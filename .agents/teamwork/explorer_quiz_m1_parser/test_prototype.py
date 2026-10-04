import sys
import os
import unittest

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(__file__))
from mcq_parser_prototype import parse_mcq_blocks, count_available_questions
from text_utils_prototype import is_section_banner, strip_section_banner, clean_image_markers


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
