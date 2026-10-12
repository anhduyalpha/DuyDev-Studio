"""
Unit Tests for Ground-Truth Page Inspection, Statement Lists, and Image Ref Purging
"""

import os
import unittest

from engines.quiz.recognition.inspect_cli import inspect_page_ground_truth
from engines.quiz.reconstruction.statement_formatter import (
    parse_statement_question,
    format_stem_html
)
from engines.quiz.text_utils import clean_image_markers
from engines.quiz.reconstruction.post_processor import clean_question_stem


class TestInspectCliAndStatements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sample_pdf = os.path.abspath(".tmp/sample.pdf")

    def test_inspect_page_41_all(self):
        """Test 'toàn bộ trang 41': starts at 47, count 5, detects both Part I and Part II."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="toàn bộ trang 41")
        self.assertTrue(res["success"])
        self.assertEqual(res["pages"], "41")
        self.assertEqual(res["start"], 47)
        self.assertEqual(res["end"], 50)
        self.assertEqual(res["count"], 5)
        self.assertEqual(res["detected_questions"], [47, 48, 49, 50, 1])
        self.assertTrue(res["has_part_i"])
        self.assertTrue(res["has_part_ii"])
        self.assertFalse(res["has_part_iii"])
        self.assertEqual(res["part_i_count"], 4)
        self.assertEqual(res["part_ii_start"], 1)
        self.assertEqual(res["part_ii_count"], 1)
        self.assertEqual(res["section_filter"], "all")

    def test_inspect_page_46_part_ii_and_part_iii(self):
        """Test inspecting page 46: correctly classifies Part II (19, 20) and Part III (1)."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, pages_arg="46")
        self.assertTrue(res["success"])
        self.assertFalse(res["has_part_i"])
        self.assertTrue(res["has_part_ii"])
        self.assertTrue(res["has_part_iii"])
        self.assertEqual(res["part_ii_count"], 2)
        self.assertEqual(res["part_iii_count"], 1)
        self.assertEqual(res["part_ii_start"], 19)
        self.assertEqual(res["part_iii_start"], 1)
        self.assertEqual(res["detected_questions"], [19, 20, 1])

    def test_inspect_page_47_cross_page_part_iii_inheritance(self):
        """Test inspecting page 47: inherits Part III from page 46."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, pages_arg="47")
        self.assertTrue(res["success"])
        self.assertFalse(res["has_part_i"])
        self.assertFalse(res["has_part_ii"])
        self.assertTrue(res["has_part_iii"])
        self.assertEqual(res["part_iii_count"], 10)
        self.assertEqual(res["detected_questions"], [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])

    def test_inspect_page_41_odd_questions(self):
        """Test 'các câu lẻ trang 41': returns [47, 49]."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="các câu lẻ trang 41")
        self.assertTrue(res["success"])
        self.assertEqual(res["parity_filter"], "odd")
        self.assertEqual(res["detected_questions"], [47, 49])
        self.assertEqual(res["start"], 47)
        self.assertEqual(res["count"], 2)

    def test_inspect_page_41_even_questions(self):
        """Test 'các câu chẵn trang 41': returns [48, 50]."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="các câu chẵn trang 41")
        self.assertTrue(res["success"])
        self.assertEqual(res["parity_filter"], "even")
        self.assertEqual(res["detected_questions"], [48, 50])
        self.assertEqual(res["start"], 48)
        self.assertEqual(res["count"], 2)

    def test_inspect_page_41_part_ii_only(self):
        """Test 'chỉ lấy phần đúng sai trang 41': returns Part II question 1."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="chỉ lấy phần đúng sai trang 41")
        self.assertTrue(res["success"])
        self.assertEqual(res["detected_questions"], [1])
        self.assertEqual(res["start"], 1)
        self.assertEqual(res["count"], 1)

    def test_inspect_exam_code_and_prefix(self):
        """Test 'Đề số 1 trang 12 lấy 10 câu': extracts exam code prefix and title."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="Đề số 1 trang 12 lấy 10 câu")
        self.assertTrue(res["success"])
        self.assertEqual(res["prefix"], "De_So_1")
        self.assertEqual(res["title"], "ĐỀ SỐ 1 - TRANG 12")
        self.assertEqual(res["count"], 10)

    def test_statement_formatter_câu_49(self):
        """Test parsing and HTML formatting of statement counting questions like Câu 49."""
        stem = (
            "Cho các phát biểu sau đây: "
            "a) Các triglyceride đều có phản ứng cộng hydrogen. "
            "b) Chỉ có các chất béo ở thể lỏng mới có phản ứng cộng hydrogen. "
            "c) Các triglyceride có gốc acid béo no thường là chất rắn ở điều kiện thường. "
            "d) Có thể dùng nước để phân biệt ester với alcohol hoặc với acid tạo nên chính ester đó. "
            "Số phát biểu đúng là"
        )
        parsed = parse_statement_question(stem)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["lead_in"], "Cho các phát biểu sau đây:")
        self.assertEqual(len(parsed["statements"]), 4)
        self.assertEqual(parsed["statements"][0]["label"], "a)")
        self.assertEqual(parsed["statements"][1]["label"], "b)")
        self.assertEqual(parsed["conclusion"], "Số phát biểu đúng là")

        rendered = format_stem_html(stem)
        self.assertIn('class="q-lead-in"', rendered)
        self.assertIn('class="q-statement-list"', rendered)
        self.assertIn('class="q-statement-item"', rendered)
        self.assertIn('class="q-stmt-label">a)</span>', rendered)
        self.assertIn('class="q-conclusion"', rendered)

    def test_statement_formatter_câu_50_numeric(self):
        """Test parsing statement counting question with numeric markers like (1), (2), (3), (4)."""
        stem = (
            "Cho các phát biểu sau: "
            "(1) ARA thuộc loại acid béo omega-6. "
            "(2) Trong một phân tử ARA có 11 nhóm methylene. "
            "(3) Triester của glycerol với ARA có công thức phân tử C63H92O6. "
            "(4) a mol ARA tác dụng tối đa với 4a mol H2 (xt, t°, p). "
            "Số phát biểu đúng là"
        )
        parsed = parse_statement_question(stem)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed["statements"]), 4)
        self.assertEqual(parsed["statements"][0]["label"], "(1)")
        self.assertEqual(parsed["statements"][3]["label"], "(4)")

    def test_purge_image_ref_markers(self):
        """Test 100% removal of internal image markers across all formats."""
        raw_stem = "Hợp chất X có cấu tạo như hình bên: [IMAGE_REF: missing_structure_1] Cho biết X là gì?"
        cleaned = clean_image_markers(raw_stem)
        self.assertEqual(cleaned, "Hợp chất X có cấu tạo như hình bên: Cho biết X là gì?")

        raw_stem_2 = "Phản ứng [image_ref: crop_01] tạo ra [IMAGE_REF:crop_02]"
        cleaned_2 = clean_image_markers(raw_stem_2)
        self.assertEqual(cleaned_2, "Phản ứng tạo ra")

        # Test through clean_question_stem
        cleaned_stem = clean_question_stem("Câu 15: Cho hình [IMAGE_REF: ref_x] sau đây:")
        self.assertNotIn("IMAGE_REF", cleaned_stem)
        self.assertNotIn("Câu 15:", cleaned_stem)

    def test_statement_formatter_roman_numerals(self):
        """Test parsing statement questions with Roman numerals I., II., III. or (I), (II)."""
        stem = (
            "Cho các phát biểu sau: "
            "I. Hợp chất hữu cơ nhất thiết phải chứa carbon. "
            "II. Liên kết hóa học trong phân tử chất hữu cơ chủ yếu là liên kết cộng hóa trị. "
            "III. Các chất hữu cơ thường kém bền với nhiệt. "
            "Số phát biểu đúng là:"
        )
        parsed = parse_statement_question(stem)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed["statements"]), 3)
        self.assertEqual(parsed["statements"][0]["label"], "I.")
        self.assertEqual(parsed["statements"][1]["label"], "II.")
        self.assertEqual(parsed["conclusion"], "Số phát biểu đúng là:")

    def test_statement_formatter_lowercase_roman(self):
        """Test parsing statement questions with lowercase Roman numerals (i), (ii), (iii)."""
        stem = (
            "Cho các phát biểu sau: "
            "(i) Benzene không làm mất màu nước bromine ở điều kiện thường. "
            "(ii) Toluene làm mất màu dung dịch KMnO4 khi đun nóng. "
            "(iii) Styrene có khả năng tham gia phản ứng trùng hợp. "
            "Số phát biểu đúng là:"
        )
        parsed = parse_statement_question(stem)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed["statements"]), 3)
        self.assertEqual(parsed["statements"][0]["label"], "(i)")
        self.assertEqual(parsed["statements"][2]["label"], "(iii)")
        self.assertEqual(parsed["conclusion"], "Số phát biểu đúng là:")

    def test_statement_formatter_experiment_counting(self):
        """Test chemistry experiment counting question with conclusion 'Số thí nghiệm xảy ra là:'."""
        stem = (
            "Cho các thí nghiệm sau: "
            "a) Cho Fe vào dung dịch CuSO4. "
            "b) Cho Cu vào dung dịch FeCl3. "
            "c) Cho Ag vào dung dịch HCl. "
            "Số thí nghiệm xảy ra phản ứng là:"
        )
        parsed = parse_statement_question(stem)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed["statements"]), 3)
        self.assertEqual(parsed["statements"][0]["label"], "a)")
        self.assertEqual(parsed["statements"][1]["label"], "b)")
        self.assertEqual(parsed["statements"][2]["text"], "Cho Ag vào dung dịch HCl.")
        self.assertEqual(parsed["conclusion"], "Số thí nghiệm xảy ra phản ứng là:")

    def test_statement_formatter_dash_bullets(self):
        """Test parsing statement questions with dash bullets '- '."""
        stem = (
            "Cho các nhận định sau:\n"
            "- Glucose là hợp chất tạp chức.\n"
            "- Fructose là đồng phân của glucose.\n"
            "Số nhận định đúng là:"
        )
        parsed = parse_statement_question(stem)
        self.assertIsNotNone(parsed)
        self.assertEqual(len(parsed["statements"]), 2)
        self.assertEqual(parsed["statements"][0]["label"], "-")
        self.assertEqual(parsed["conclusion"], "Số nhận định đúng là:")

    def test_inspect_single_question_on_page(self):
        """Test inspecting a single question on page: 'câu 47 trang 41' -> start=47, count=1."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="câu 47 trang 41")
        self.assertTrue(res["success"])
        self.assertEqual(res["start"], 47)
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["detected_questions"], [47])

    def test_parse_requested_pages_syntax(self):
        """Test parsing various natural language and explicit page syntax."""
        from engines.quiz.recognition.inspect_cli import parse_requested_pages

        self.assertEqual(parse_requested_pages("", "trang 15,16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15, 16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15 và 16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15 với 16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15 & 16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15-16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15 đến 16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "từ trang 15 đến trang 16"), [15, 16])
        self.assertEqual(parse_requested_pages("", "trang 15, 18"), [15, 18])
        self.assertEqual(parse_requested_pages("", "trang 15,16 lấy 4 câu"), [15, 16])
        self.assertEqual(parse_requested_pages("15,16", ""), [15, 16])
        self.assertEqual(parse_requested_pages("15, 18", ""), [15, 18])

    def test_rule_parser_page_bounded_numeric_constraints(self):
        """Test rule parser properly flags is_page_bounded when no explicit count is requested."""
        from engines.quiz.recognition.rule_parser import parse_numeric_instruction

        res1 = parse_numeric_instruction("Trang 15,16")
        self.assertIsNotNone(res1)
        self.assertTrue(res1.is_page_bounded)
        self.assertEqual(res1.pages, [15, 16])
        self.assertIsNone(res1.question_count)

        res2 = parse_numeric_instruction("Trang 15 và 16")
        self.assertIsNotNone(res2)
        self.assertTrue(res2.is_page_bounded)
        self.assertEqual(res2.pages, [15, 16])
        self.assertIsNone(res2.question_count)

        res3 = parse_numeric_instruction("Trang 15, 18 lấy 4 câu")
        self.assertIsNotNone(res3)
        self.assertFalse(res3.is_page_bounded)
        self.assertEqual(res3.pages, [15, 18])
        self.assertEqual(res3.question_count, 4)

    def test_inspect_page_bounded_ground_truth(self):
        """Test ground-truth inspection on fixture returns exact count and is_page_bounded."""
        fixture_path = os.path.abspath("test_gf11_fixture.pdf")
        if not os.path.isfile(fixture_path):
            self.skipTest("test_gf11_fixture.pdf not found")

        res_p1 = inspect_page_ground_truth(fixture_path, query_arg="trang 1")
        self.assertTrue(res_p1["success"])
        self.assertEqual(res_p1["pages"], "1")
        self.assertEqual(res_p1["start"], 31)
        self.assertEqual(res_p1["end"], 38)
        self.assertEqual(res_p1["count"], 8)
        self.assertTrue(res_p1["is_page_bounded"])

        res_p1_2 = inspect_page_ground_truth(fixture_path, query_arg="trang 1,2")
        self.assertTrue(res_p1_2["success"])
        self.assertEqual(res_p1_2["pages"], "1-2")
        self.assertEqual(res_p1_2["start"], 31)
        self.assertEqual(res_p1_2["end"], 46)
        self.assertEqual(res_p1_2["count"], 16)
        self.assertTrue(res_p1_2["is_page_bounded"])


if __name__ == "__main__":
    unittest.main()
