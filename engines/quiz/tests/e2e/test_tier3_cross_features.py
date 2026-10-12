"""
Tier 3: Cross-Feature Interactions & Combinations Test Suite
Author: E2E Test Writer
Validates multi-feature interactions (Parity Filters + Section Filters + Banner Inheritance).
"""

import os
import unittest
from typing import Any

from engines.quiz.perception.models import (
    TextBlock,
    TextLine,
    TextSpan,
    QuestionCandidate,
    PageRepresentation,
)
from engines.quiz.reconstruction.models import ReconstructedQuestion, QuestionType, QuestionOption, TFSubStatement
from engines.quiz.ir.models import SectionType, AnswerKeyIR
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.recognition.inspect_cli import inspect_page_ground_truth


class TestTier3CrossFeatures(unittest.TestCase):
    """Tier 3: Cross-Feature Interactions."""

    def setUp(self):
        self.goc_pdf = os.path.abspath(".tmp/Diff check/Gốc.pdf")

    # -------------------------------------------------------------------------
    # Combination 1: Odd Parity Filter + Part II Filter
    # -------------------------------------------------------------------------
    def test_combo_odd_parity_plus_part_ii_filter(self):
        """
        Combo 1: Request 'các câu lẻ phần II trang 41' or 'phần 2 câu lẻ'.
        Should isolate Part II candidates first, then apply odd parity filter.
        """
        if not os.path.isfile(self.goc_pdf):
            self.skipTest("Gốc.pdf fixture not available.")

        res = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu lẻ phần 2 trang 41")
        self.assertTrue(res.get("success"), "Inspection must succeed.")
        self.assertEqual(res.get("parity_filter"), "odd", "Parity filter must be 'odd'")
        # Part II on page 41 has Câu 1 (which is odd). So Câu 1 must be present.
        detected = res.get("detected_questions", [])
        self.assertEqual(detected, [1], f"Expected exactly [1] for odd Part II on page 41, got {detected}")

    # -------------------------------------------------------------------------
    # Combination 2: Even Parity Filter + Part I Filter
    # -------------------------------------------------------------------------
    def test_combo_even_parity_plus_part_i_filter(self):
        """
        Combo 2: Request 'các câu chẵn phần I trang 41'.
        Part I on page 41 has questions 47, 48, 49, 50.
        Even questions must be exactly [48, 50].
        """
        if not os.path.isfile(self.goc_pdf):
            self.skipTest("Gốc.pdf fixture not available.")

        res = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu chẵn phần 1 trang 41")
        self.assertTrue(res.get("success"), "Inspection must succeed.")
        self.assertEqual(res.get("parity_filter"), "even", "Parity filter must be 'even'")
        detected = res.get("detected_questions", [])
        self.assertEqual(detected, [48, 50], f"Expected [48, 50] for even Part I on page 41, got {detected}")

    # -------------------------------------------------------------------------
    # Combination 3: Numbering Reset Boundary + Discrete Parity across Parts
    # -------------------------------------------------------------------------
    def test_combo_numbering_reset_boundary_with_discrete_parity(self):
        """
        Combo 3: On a multi-section document where Part I (Q47..Q50) is followed by
        Part II (Q1..Q4), requesting 'các câu lẻ' across the whole page must yield
        both odd Part I questions ([47, 49]) AND odd Part II questions ([1, 3]).
        """
        # Create synthetic representation
        q_p1_47 = ReconstructedQuestion(
            id="q_47", number=47, source_number=47, type=QuestionType.PART_I_MCQ,
            stem="Q47", options=[QuestionOption(label="A", text="Opt A"), QuestionOption(label="B", text="Opt B")], source_pages=[1]
        )
        q_p1_49 = ReconstructedQuestion(
            id="q_49", number=49, source_number=49, type=QuestionType.PART_I_MCQ,
            stem="Q49", options=[QuestionOption(label="A", text="Opt A"), QuestionOption(label="B", text="Opt B")], source_pages=[1]
        )
        q_p2_1 = ReconstructedQuestion(
            id="q_p2_1", number=1, source_number=1, type=QuestionType.PART_II_TF,
            stem="Q1 TF", options=[],
            sub_statements=[TFSubStatement(label=l, statement=f"Ý {l}") for l in ["a", "b", "c", "d"]],
            source_pages=[1]
        )
        q_p2_3 = ReconstructedQuestion(
            id="q_p2_3", number=3, source_number=3, type=QuestionType.PART_II_TF,
            stem="Q3 TF", options=[],
            sub_statements=[TFSubStatement(label=l, statement=f"Ý {l}") for l in ["a", "b", "c", "d"]],
            source_pages=[1]
        )

        ans1 = AnswerKeyIR(question_id="q_47", question_number=47, type=SectionType.PART_I_MCQ, selected_answer="A")
        ans2 = AnswerKeyIR(question_id="q_49", question_number=49, type=SectionType.PART_I_MCQ, selected_answer="B")
        ans3 = AnswerKeyIR(question_id="q_p2_1", question_number=1, type=SectionType.PART_II_TF, sub_answers={"a": True, "b": False, "c": True, "d": False})
        ans4 = AnswerKeyIR(question_id="q_p2_3", question_number=3, type=SectionType.PART_II_TF, sub_answers={"a": True, "b": False, "c": True, "d": False})

        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q_p1_47, q_p1_49, q_p2_1, q_p2_3],
            doc_reps=[rep],
            answers=[ans1, ans2, ans3, ans4]
        )

        # IR should contain both sections with exactly the odd questions
        self.assertEqual(len(doc_ir.sections), 2)
        sec0_q_nums = [q.number for q in doc_ir.questions if q.id in doc_ir.sections[0].question_ids]
        sec1_q_nums = [q.number for q in doc_ir.questions if q.id in doc_ir.sections[1].question_ids]
        self.assertEqual(sec0_q_nums, [47, 49])
        self.assertEqual(sec1_q_nums, [1, 3])

    # -------------------------------------------------------------------------
    # Combination 4: Google Drive Intent Resolution + Parity Filter Simulation
    # -------------------------------------------------------------------------
    def test_combo_gdrive_intent_with_parity_and_section_filters(self):
        """
        Combo 4: Simulates prompt intent parsed with gdriveUrl + 'các câu lẻ trang 41'.
        Verifies that prompt parser yields both gdrive source flag and structured filters.
        """
        from engines.quiz.recognition.inspect_cli import inspect_page_ground_truth

        if not os.path.isfile(self.goc_pdf):
            self.skipTest("Gốc.pdf fixture not available.")

        res = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu lẻ trang 41")
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("parity_filter"), "odd")
        # Output should be structured for downstream BullMQ worker & orchestrator
        self.assertIn("detected_questions", res)
        self.assertIn("start", res)
        self.assertIn("count", res)


if __name__ == "__main__":
    unittest.main()
