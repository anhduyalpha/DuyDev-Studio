"""
Unit Tests for Selective Vision QA Engine (TASK-10).
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.qa.vision_qa import run_selective_vision_qa
from engines.quiz.qa.models import VisionQAResult, QAIssue, QAIssueType, QASeverity


class TestVisionQA(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_vis_qa_")
        self.sample_pdf = os.path.join(self.temp_dir, "sample.pdf")
        doc = pymupdf.open()
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 100), "Trang 1: Đề thi hóa học", fontsize=12)
        p2 = doc.new_page(width=595.28, height=841.89)
        p2.insert_text((50, 100), "Trang 2: Câu hỏi và hình ảnh", fontsize=12)
        doc.save(self.sample_pdf)
        doc.close()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_vision_qa_without_provider(self):
        # When provider is None, returns PASS safely
        res = run_selective_vision_qa(self.sample_pdf, provider=None)
        self.assertEqual(res.status, "PASS")
        self.assertEqual(res.inspected_pages, [])

    def test_vision_qa_selective_targeting(self):
        # Verifies only flagged pages are targeted and capped
        mock_response = VisionQAResult(status="PASS", issues=[], inspected_pages=[2])
        provider = MockAIProvider(preset_response=mock_response)

        res = run_selective_vision_qa(
            self.sample_pdf,
            flagged_pages=[2],
            provider=provider,
            max_pages=1,
        )
        self.assertEqual(res.inspected_pages, [2])
        self.assertEqual(res.status, "PASS")

    def test_vision_qa_diagnoses_visual_issue(self):
        # AI returns structured issue
        mock_response = VisionQAResult(
            status="FAIL",
            issues=[
                QAIssue(
                    page=1,
                    type=QAIssueType.OVERLAP,
                    severity=QASeverity.HIGH,
                    description="Công thức hóa học bị đè lên hình minh họa.",
                )
            ],
            inspected_pages=[1],
        )
        provider = MockAIProvider(preset_response=mock_response)

        res = run_selective_vision_qa(
            self.sample_pdf,
            flagged_pages=[1],
            provider=provider,
        )
        self.assertEqual(res.status, "FAIL")
        self.assertFalse(res.is_pass())
        self.assertEqual(len(res.issues), 1)
        self.assertEqual(res.issues[0].type, QAIssueType.OVERLAP)


if __name__ == "__main__":
    unittest.main()
