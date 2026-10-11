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
        """Test 'toàn bộ trang 41': starts at 47, count 4, detects both Part I and Part II."""
        if not os.path.isfile(self.sample_pdf):
            self.skipTest("Sample PDF not found")

        res = inspect_page_ground_truth(self.sample_pdf, query_arg="toàn bộ trang 41")
        self.assertTrue(res["success"])
        self.assertEqual(res["pages"], "41")
        self.assertEqual(res["start"], 47)
        self.assertEqual(res["end"], 50)
        self.assertEqual(res["count"], 4)
        self.assertEqual(res["detected_questions"], [47, 48, 49, 50])
        self.assertTrue(res["has_part_i"])
        self.assertTrue(res["has_part_ii"])
        self.assertEqual(res["part_ii_start"], 1)

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


if __name__ == "__main__":
    unittest.main()
