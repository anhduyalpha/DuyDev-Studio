"""
Unit Tests for Auto-Expand Subsequent Pages Algorithm & Flexible Publishing (Ticket #01 & #05).
"""

import unittest
from unittest.mock import MagicMock, patch
from engines.quiz.perception.models import (
    PageRepresentation,
    PageKind,
    QuestionCandidate,
    TextBlock,
    TextLine,
)
from engines.quiz.recognition.models import (
    QuestionIndexEntry,
    QuestionSegment,
    PageNeighborhood,
    ExtractionPlan,
)
from engines.quiz.recognition.question_index import QuestionIndexService
from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.provider.mock import MockAIProvider


def _make_mock_page(page_num: int, q_nums: list[int]) -> PageRepresentation:
    candidates = []
    lines = []
    for qn in q_nums:
        cand = QuestionCandidate(
            candidate_number=qn,
            marker_text=f"Câu {qn}:",
            bbox=(50.0, float(100 + qn * 20), 500.0, float(120 + qn * 20)),
            y_pos=float(100 + qn * 20),
            options_detected=["A", "B", "C", "D"],
        )
        candidates.append(cand)
        lines.append(
            TextLine(
                text=f"Câu {qn}. Đây là nội dung câu hỏi số {qn}.\nA. 1\nB. 2\nC. 3\nD. 4",
                bbox=cand.bbox,
            )
        )

    block_text = "\n".join(l.text for l in lines)
    block = TextBlock(
        block_index=0,
        bbox=(50.0, 50.0, 550.0, 800.0),
        text=block_text,
        lines=lines,
    )

    return PageRepresentation(
        page_number=page_num,
        page_index=page_num - 1,
        width=595.0,
        height=842.0,
        character_count=len(block_text),
        page_kind=PageKind.VECTOR,
        raw_text=block_text,
        candidates=candidates,
        blocks=[block],
        images=[],
        tables=[],
    )


class TestAutoExpandPages(unittest.TestCase):
    def setUp(self):
        self.service = QuestionIndexService()

    def test_flexible_publishing_accepts_partial_when_enabled(self):
        """
        Verify that QuestionIndexService.validate_requested_range accepts partial count
        when allow_partial=True and does not throw RANGE_MISMATCH.
        """
        p1 = _make_mock_page(1, list(range(1, 15))) # 14 questions
        doc_reps = [p1]

        neighborhood = self.service.build_multi_page_neighborhood_index(
            target_pages=[1],
            doc_reps=doc_reps,
        )

        # allow_partial=False should fail validation for 20 questions
        valid, detected, missing, entries = self.service.validate_requested_range(
            neighborhood=neighborhood,
            start_q=1,
            end_q=20,
            count=20,
            doc_reps=doc_reps,
            raise_on_mismatch=False,
            allow_partial=False,
        )
        self.assertFalse(valid)
        self.assertEqual(len(detected), 14)
        self.assertEqual(len(missing), 6)

        # allow_partial=True should succeed with partial questions
        valid_part, detected_part, missing_part, entries_part = self.service.validate_requested_range(
            neighborhood=neighborhood,
            start_q=1,
            end_q=20,
            count=20,
            doc_reps=doc_reps,
            raise_on_mismatch=False,
            allow_partial=True,
        )
        self.assertTrue(valid_part)
        self.assertEqual(len(detected_part), 14)
        self.assertEqual(len(missing_part), 6)

    def test_flexible_publishing_preserves_all_detected_questions(self):
        """
        Verify that build_extraction_plan with allow_partial=True preserves ALL
        detected questions across requested range without dropping non-adjacent numbers.
        """
        # Document contains questions [1, 2, 4, 5, 7, 8] (6 questions out of 10)
        p1 = _make_mock_page(1, [1, 2, 4, 5, 7, 8])
        doc_reps = [p1]

        neighborhood = self.service.build_multi_page_neighborhood_index(
            target_pages=[1],
            doc_reps=doc_reps,
        )

        plan = self.service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=1,
            end_q=10,
            count=10,
            doc_reps=doc_reps,
            raise_on_mismatch=False,
            allow_partial=True,
        )

        self.assertTrue(plan.validated)
        self.assertEqual(plan.status, "RANGE_VALID_PARTIAL")
        self.assertEqual(plan.target_question_numbers, [1, 2, 4, 5, 7, 8])
        self.assertEqual(plan.requested_count, 6)

    def test_auto_expand_subsequent_pages_reaches_requested_count(self):
        """
        Mock document with 14 questions on Page 1 and 10 questions on Page 2.
        Request 20 questions starting at Q1 on Page 1:
        Verify expanding to Page 2 reaches all 20 requested questions.
        """
        p1 = _make_mock_page(1, list(range(1, 15)))  # Q1..Q14 (14 questions)
        p2 = _make_mock_page(2, list(range(15, 25))) # Q15..Q24 (10 questions)

        index_service = self.service

        # Step 1: Initial scan on Page 1 only
        neighborhood = index_service.build_multi_page_neighborhood_index(
            target_pages=[1],
            doc_reps=[p1],
        )
        plan1 = index_service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=1,
            end_q=20,
            count=20,
            doc_reps=[p1],
            raise_on_mismatch=False,
            allow_partial=False,
        )
        self.assertFalse(plan1.validated)
        self.assertEqual(len(plan1.target_question_numbers), 14)

        # Step 2: Auto-expand to Page 2
        target_range_pages = [1, 2]
        doc_reps_expanded = [p1, p2]
        neighborhood2 = index_service.build_multi_page_neighborhood_index(
            target_pages=target_range_pages,
            doc_reps=doc_reps_expanded,
        )
        plan2 = index_service.build_extraction_plan(
            neighborhood=neighborhood2,
            start_q=1,
            end_q=20,
            count=20,
            doc_reps=doc_reps_expanded,
            raise_on_mismatch=True,
            allow_partial=False,
        )
        self.assertTrue(plan2.validated)
        self.assertEqual(len(plan2.target_question_numbers), 20)
        self.assertEqual(plan2.target_question_numbers, list(range(1, 21)))


if __name__ == "__main__":
    unittest.main()
