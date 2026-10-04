"""
Unit Tests for Smart Recognition & Range Resolver (TASK-05)
Tests regex rule parser, deterministic candidate expansion, cross-page continuation,
and AI fallback when instructions are ambiguous.
"""

import unittest
from engines.quiz.perception.models import (
    PageRepresentation,
    QuestionCandidate,
    PageKind,
    TextBlock
)
from engines.quiz.recognition.models import (
    SmartRecognitionResult,
    ParsedNumericConstraint
)
from engines.quiz.recognition.rule_parser import parse_numeric_instruction
from engines.quiz.recognition.range_resolver import resolve_smart_range
from engines.quiz.provider.mock import MockAIProvider


class TestSmartRecognition(unittest.TestCase):
    """Test suite for Smart Recognition and Dynamic Range Resolver."""

    def _create_mock_document(self, page_count: int = 5, questions_per_page: int = 10) -> list[PageRepresentation]:
        """Creates a list of mock PageRepresentation objects with sequential question candidates."""
        doc_reps: list[PageRepresentation] = []
        curr_q = 1

        for p in range(1, page_count + 1):
            candidates: list[QuestionCandidate] = []
            for _ in range(questions_per_page):
                candidates.append(
                    QuestionCandidate(
                        candidate_number=curr_q,
                        marker_text=f"Câu {curr_q}:",
                        bbox=(50.0, 100.0, 500.0, 150.0),
                        y_pos=100.0,
                        options_detected=["A", "B", "C", "D"]
                    )
                )
                curr_q += 1

            doc_reps.append(
                PageRepresentation(
                    page_index=p - 1,
                    page_number=p,
                    width=595.0,
                    height=842.0,
                    raw_text=f"Trang {p} nội dung đề thi...",
                    character_count=500,
                    page_kind=PageKind.VECTOR,
                    candidates=candidates
                )
            )
        return doc_reps

    def test_parse_numeric_instruction_formats(self):
        """Tests parsing various Vietnamese and English instruction formats."""
        # 1. "Trang 11 từ câu 1 đến 30"
        p1 = parse_numeric_instruction("Trang 11 từ câu 1 đến 30")
        self.assertIsNotNone(p1)
        self.assertEqual(p1.start_page, 11)
        self.assertEqual(p1.start_question, 1)
        self.assertEqual(p1.end_question, 30)
        self.assertEqual(p1.question_count, 30)

        # 2. "Trang 36-38 lấy 25 câu bắt đầu từ câu 1"
        p2 = parse_numeric_instruction("Trang 36-38 lấy 25 câu bắt đầu từ câu 1")
        self.assertIsNotNone(p2)
        self.assertEqual(p2.start_page, 36)
        self.assertEqual(p2.end_page, 38)
        self.assertEqual(p2.question_count, 25)
        self.assertEqual(p2.start_question, 1)

        # 3. "Lấy 20 câu trang 5"
        p3 = parse_numeric_instruction("Lấy 20 câu trang 5")
        self.assertIsNotNone(p3)
        self.assertEqual(p3.start_page, 5)
        self.assertEqual(p3.question_count, 20)

        # 4. "Câu 1 đến 40"
        p4 = parse_numeric_instruction("Câu 1 đến 40")
        self.assertIsNotNone(p4)
        self.assertEqual(p4.start_question, 1)
        self.assertEqual(p4.end_question, 40)
        self.assertEqual(p4.question_count, 40)

        # 5. "Đề 1 từ câu 1 đến 20 trang 3"
        p5 = parse_numeric_instruction("Đề 1 từ câu 1 đến 20 trang 3")
        self.assertIsNotNone(p5)
        self.assertEqual(p5.exam_code, "1")
        self.assertEqual(p5.start_question, 1)
        self.assertEqual(p5.end_question, 20)
        self.assertEqual(p5.start_page, 3)

        # 6. Ambiguous prompt without numbers -> returns None
        p6 = parse_numeric_instruction("Chuyên đề este lipit nâng cao")
        self.assertIsNone(p6)

    def test_deterministic_range_expansion(self):
        """Tests that range resolver expands pages until question count is satisfied without calling AI."""
        doc = self._create_mock_document(page_count=5, questions_per_page=10)

        # Request 25 questions starting from Page 1
        res = resolve_smart_range("Trang 1 lấy 25 câu bắt đầu từ câu 1", doc)

        self.assertEqual(res.start_page, 1)
        # Page 1 has 10, Page 2 has 10, Page 3 has 10 -> total 30 >= 25 -> end_page must be 3
        self.assertEqual(res.end_page, 3)
        self.assertEqual(res.start_question, 1)
        self.assertEqual(res.question_count, 25)
        self.assertEqual(res.question_mode, "auto")
        self.assertEqual(res.confidence, 1.0)

    def test_explicit_page_range(self):
        """Tests explicit start and end pages."""
        doc = self._create_mock_document(page_count=5, questions_per_page=10)

        res = resolve_smart_range("Trang 2 đến 4", doc)
        self.assertEqual(res.start_page, 2)
        self.assertEqual(res.end_page, 4)
        self.assertEqual(res.question_count, 30)  # 10 + 10 + 10 = 30
        self.assertEqual(res.confidence, 1.0)

    def test_cross_page_continuation_expansion(self):
        """Tests that continuation question on page boundary triggers expansion to next page."""
        doc = self._create_mock_document(page_count=3, questions_per_page=10)

        # Alter Page 1 last candidate to only have options A, B (missing C, D)
        doc[0].candidates[-1].options_detected = ["A", "B"]
        # Add continuation options at top of Page 2
        doc[1].blocks = [
            TextBlock(
                block_index=0,
                bbox=(50, 50, 500, 70),
                lines=[],
                text="C. Axit axetic.   D. Etanol."
            )
        ]

        # Request exactly 10 questions starting on Page 1
        res = resolve_smart_range("Trang 1 lấy 10 câu", doc)

        # Because Question 10 continues onto Page 2, end_page must expand to Page 2
        self.assertEqual(res.start_page, 1)
        self.assertEqual(res.end_page, 2)

    def test_ai_fallback_on_ambiguous_instruction(self):
        """Tests that ambiguous instruction delegates to Agnes AI provider."""
        doc = self._create_mock_document(page_count=10, questions_per_page=10)

        mock_ai = MockAIProvider(
            preset_response=SmartRecognitionResult(
                start_page=4,
                end_page=6,
                start_question=31,
                question_count=20,
                question_mode="ai_resolved",
                confidence=0.92,
                warnings=[]
            )
        )

        res = resolve_smart_range("Lấy các câu este lipit ở giữa sách", doc, ai_provider=mock_ai)
        self.assertEqual(res.start_page, 4)
        self.assertEqual(res.end_page, 6)
        self.assertEqual(res.question_count, 20)
        self.assertEqual(res.question_mode, "ai_resolved")
        self.assertEqual(len(mock_ai.call_history), 1)

    def test_traversal_safety_limit(self):
        """Tests hard limit handling when document has fewer questions than requested."""
        doc = self._create_mock_document(page_count=2, questions_per_page=5)  # Total 10 questions

        res = resolve_smart_range("Trang 1 lấy 50 câu", doc)
        self.assertEqual(res.start_page, 1)
        self.assertEqual(res.end_page, 2)
        self.assertEqual(res.question_count, 50)
        self.assertGreater(len(res.warnings), 0)


if __name__ == "__main__":
    unittest.main()
