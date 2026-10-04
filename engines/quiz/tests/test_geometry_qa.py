"""
Unit Tests for Fast Deterministic Geometry QA (TASK-10).
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.qa.geometry_qa import validate_pdf_geometry
from engines.quiz.qa.models import QAIssueType, QASeverity


class TestGeometryQA(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_geom_qa_")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_missing_or_empty_pdf(self):
        missing_path = os.path.join(self.temp_dir, "non_existent.pdf")
        res = validate_pdf_geometry(missing_path)
        self.assertEqual(res.status, "FAIL")
        self.assertFalse(res.is_pass())
        self.assertEqual(res.issues[0].type, QAIssueType.MISSING_FILE)

    def test_valid_a4_pdf_passes(self):
        valid_pdf = os.path.join(self.temp_dir, "valid_a4.pdf")
        doc = pymupdf.open()
        page = doc.new_page(width=595.28, height=841.89)
        # Insert normal text inside margin bounds
        page.insert_text((50, 100), "BÀI TẬP TRẮC NGHIỆM HÓA HỌC", fontsize=12)
        page.insert_text((50, 150), "Câu 1: Cho hỗn hợp tác dụng với dung dịch kiềm.", fontsize=10)
        # Insert running footer
        page.insert_text((50, 825), "Trang 1 / 1", fontsize=8)
        doc.save(valid_pdf)
        doc.close()

        res = validate_pdf_geometry(valid_pdf)
        self.assertIn(res.status, ("PASS", "WARN"))
        self.assertTrue(res.is_a4_compliant)
        self.assertTrue(res.is_pass())

    def test_non_a4_dimensions_flagged(self):
        non_a4_pdf = os.path.join(self.temp_dir, "non_a4.pdf")
        doc = pymupdf.open()
        # Create landscape or custom dimension
        p = doc.new_page(width=800.0, height=400.0)
        p.insert_text((50, 50), "Non A4 page content test text here", fontsize=12)
        doc.save(non_a4_pdf)
        doc.close()

        res = validate_pdf_geometry(non_a4_pdf)
        self.assertEqual(res.status, "FAIL")
        self.assertFalse(res.is_a4_compliant)
        self.assertTrue(any(i.type == QAIssueType.OVERFLOW and i.severity == QASeverity.HIGH for i in res.issues))

    def test_margin_overflow_detected(self):
        overflow_pdf = os.path.join(self.temp_dir, "overflow.pdf")
        doc = pymupdf.open()
        page = doc.new_page(width=595.28, height=841.89)
        # Insert text protruding far into bottom margin past 820pt (not footer)
        page.insert_text((50, 835), "Nội dung câu hỏi bị tràn lề xuống sát mép giấy dưới đáy", fontsize=10)
        doc.save(overflow_pdf)
        doc.close()

        res = validate_pdf_geometry(overflow_pdf)
        # Should flag overflow issue
        self.assertTrue(any(i.type == QAIssueType.OVERFLOW for i in res.issues))

    def test_split_question_detected(self):
        split_pdf = os.path.join(self.temp_dir, "split.pdf")
        doc = pymupdf.open()
        # Page 1: question starts right at bottom
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 785), "Câu 10: Phát biểu nào sau đây về este là đúng?", fontsize=10)
        # Page 2: starts immediately with options
        p2 = doc.new_page(width=595.28, height=841.89)
        p2.insert_text((50, 60), "A. Este có nhiệt độ sôi cao hơn axit.", fontsize=10)
        doc.save(split_pdf)
        doc.close()

        res = validate_pdf_geometry(split_pdf)
        self.assertTrue(any(i.type == QAIssueType.SPLIT_QUESTION for i in res.issues))


if __name__ == "__main__":
    unittest.main()
