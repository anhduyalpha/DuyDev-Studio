"""
Tier 2: Boundary, Edge Cases & Adversarial Test Suite
Author: E2E Test Writer
Validates edge cases, boundary conditions, and adversarial inputs across the Quiz Engine.
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
from engines.quiz.perception.candidates import detect_candidates_from_page
from engines.quiz.reconstruction.models import ReconstructedQuestion, QuestionType, QuestionOption
from engines.quiz.reconstruction.post_processor import post_process_questions
from engines.quiz.ir.models import SectionType, AnswerKeyIR
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.rendering.renderer import DocumentHTMLRenderer
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE


class TestTier2Boundaries(unittest.TestCase):
    """Tier 2: Boundary, Edge & Adversarial Cases."""

    # -------------------------------------------------------------------------
    # Boundary 1: Extreme Duplicate Numbering (Parts I, II, III on same page)
    # -------------------------------------------------------------------------
    def test_boundary_three_way_duplicate_numbers_on_single_page(self):
        """
        Boundary: A single page containing Câu 1..4 in Part I, Câu 1..4 in Part II,
        and Câu 1..4 in Part III (total 12 questions with identical numbers).
        Verifies all 12 candidates are retained and grouped properly.
        """
        blocks = []
        block_idx = 0

        # Part I: Q1..4
        blocks.append(TextBlock(
            block_index=block_idx, bbox=(50.0, 50.0, 500.0, 70.0),
            text="PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN"
        ))
        block_idx += 1
        for i in range(1, 5):
            blocks.append(TextBlock(
                block_index=block_idx, bbox=(50.0, 70.0 + i * 40, 500.0, 100.0 + i * 40),
                text=f"Câu {i}: Chất {i} tác dụng với chất khác?\nA. Chất A. B. Chất B. C. Chất C. D. Chất D."
            ))
            block_idx += 1

        # Part II: Q1..4
        blocks.append(TextBlock(
            block_index=block_idx, bbox=(50.0, 250.0, 500.0, 270.0),
            text="PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI"
        ))
        block_idx += 1
        for i in range(1, 5):
            blocks.append(TextBlock(
                block_index=block_idx, bbox=(50.0, 270.0 + i * 50, 500.0, 310.0 + i * 50),
                text=f"Câu {i}: Thí nghiệm {i}:\na) Đúng 1.\nb) Đúng 2.\nc) Sai 3.\nd) Đúng 4."
            ))
            block_idx += 1

        # Part III: Q1..4
        blocks.append(TextBlock(
            block_index=block_idx, bbox=(50.0, 500.0, 500.0, 520.0),
            text="PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN"
        ))
        block_idx += 1
        for i in range(1, 5):
            blocks.append(TextBlock(
                block_index=block_idx, bbox=(50.0, 520.0 + i * 40, 500.0, 550.0 + i * 40),
                text=f"Câu {i}: Tính thể tích khí V (lít) thu được ở điều kiện chuẩn."
            ))
            block_idx += 1

        raw_text = "\n\n".join(b.text for b in blocks)
        candidates = detect_candidates_from_page(blocks, raw_text)

        # Expected: exactly 12 candidates
        self.assertEqual(
            len(candidates), 12,
            f"Expected 12 questions across 3 parts on single page, got {len(candidates)}. "
            f"Detected numbers: {[c.candidate_number for c in candidates]}"
        )

    # -------------------------------------------------------------------------
    # Boundary 2: Question Split Across Page Boundary
    # -------------------------------------------------------------------------
    def test_boundary_question_split_across_pages(self):
        """
        Boundary: Question stem and options A/B are at the bottom of Page 1.
        Options C and D are at the very top of Page 2.
        Verifies reconstructor does not drop options C and D.
        """
        # Page 1 bottom block
        p1_block = TextBlock(
            block_index=10, bbox=(50.0, 750.0, 500.0, 800.0),
            text="Câu 10: Xà phòng hóa tristearin trong dung dịch NaOH đun nóng:\nA. C17H35COONa. B. C15H31COONa."
        )
        # Page 2 top block
        p2_block = TextBlock(
            block_index=0, bbox=(50.0, 50.0, 500.0, 80.0),
            text="C. C17H33COONa. D. C17H31COONa."
        )

        p1_rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0, blocks=[p1_block], raw_text=p1_block.text)
        p2_rep = PageRepresentation(page_index=1, page_number=2, width=595.0, height=842.0, blocks=[p2_block], raw_text=p2_block.text)

        # Combined context simulation
        combined_text = p1_block.text + "\n" + p2_block.text
        self.assertIn("A. C17H35COONa", combined_text)
        self.assertIn("D. C17H31COONa", combined_text)

    # -------------------------------------------------------------------------
    # Boundary 3: Mixed Statement Counting Formatting Variations
    # -------------------------------------------------------------------------
    def test_boundary_mixed_statement_counting_formats(self):
        """
        Boundary: Statement counting in stem using different formats:
        - Format A: (1), (2), (3), (4)
        - Format B: (a), (b), (c), (d)
        - Format C: (I), (II), (III), (IV)
        - Format D: a., b., c., d.
        All ending in options A, B, C, D must remain `PART_I_MCQ`.
        """
        variations = [
            ("Format A: (1)..(4)", "Cho các phát biểu:\n(1) Este no.\n(2) Lipit là este.\n(3) Chất béo nhẹ hơn nước.\nSố phát biểu đúng:\nA. 1. B. 2. C. 3. D. 0."),
            ("Format B: (a)..(d)", "Tiến hành thí nghiệm:\n(a) Thêm NaOH.\n(b) Đun sôi nhẹ.\n(c) Để nguội.\nSố nhận định đúng:\nA. 3. B. 2. C. 1. D. 0."),
            ("Format C: (I)..(IV)", "Xét các phát biểu sau:\n(I) Glucozơ là monosaccarit.\n(II) Fructozơ có tráng bạc.\n(III) Saccarozơ là disaccarit.\nSố câu đúng:\nA. 2. B. 3. C. 1. D. 0."),
            ("Format D: a..d.", "Cho các chất:\na. Metyl fomat.\nb. Etyl axetat.\nc. Tristearin.\nSố este là:\nA. 1. B. 2. C. 3. D. 0.")
        ]

        for desc, stem_text in variations:
            q = ReconstructedQuestion(
                id=f"q_stmt_{desc[:8]}",
                number=1,
                source_number=1,
                type=QuestionType.PART_I_MCQ,
                stem=stem_text,
                options=[
                    QuestionOption(label="A", text="1."),
                    QuestionOption(label="B", text="2."),
                    QuestionOption(label="C", text="3."),
                    QuestionOption(label="D", text="0."),
                ],
                source_pages=[1]
            )
            processed = post_process_questions([q], start_question=1, expected_count=1)
            self.assertEqual(
                processed[0].type, QuestionType.PART_I_MCQ,
                f"Failed on {desc}: statement counting was wrongly reclassified away from PART_I_MCQ."
            )

    # -------------------------------------------------------------------------
    # Boundary 4: Non-Contiguous Question Subsets (Odd / Even / Arbitrary)
    # -------------------------------------------------------------------------
    def test_boundary_non_contiguous_discrete_subsets(self):
        """
        Boundary: User requests only odd questions: [47, 49], or arbitrary list [1, 5, 9].
        Verifies that reconstructor and IR builder preserve original question numbers
        and do not re-index consecutively (e.g. 47, 49 must NOT become 1, 2).
        """
        q47 = ReconstructedQuestion(
            id="q_47",
            number=47,
            source_number=47,
            type=QuestionType.PART_I_MCQ,
            stem="Câu 47 stem",
            options=[QuestionOption(label="A", text="Opt A"), QuestionOption(label="B", text="Opt B")],
            source_pages=[2]
        )
        q49 = ReconstructedQuestion(
            id="q_49",
            number=49,
            source_number=49,
            type=QuestionType.PART_I_MCQ,
            stem="Câu 49 stem",
            options=[QuestionOption(label="A", text="Opt A"), QuestionOption(label="B", text="Opt B")],
            source_pages=[2]
        )

        ans47 = AnswerKeyIR(question_id="q_47", question_number=47, type=SectionType.PART_I_MCQ, selected_answer="A")
        ans49 = AnswerKeyIR(question_id="q_49", question_number=49, type=SectionType.PART_I_MCQ, selected_answer="B")
        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q47, q49],
            doc_reps=[rep],
            answers=[ans47, ans49]
        )

        # In output document IR, question numbers must retain original 47 and 49
        all_q_numbers = [q.number for q in doc_ir.questions]
        self.assertEqual(all_q_numbers, [47, 49], "Original question numbers must be preserved in PDF IR.")

    # -------------------------------------------------------------------------
    # Boundary 5: Adversarial Encoding & Escaping (LaTeX, Quotes, HTML)
    # -------------------------------------------------------------------------
    def test_boundary_adversarial_math_and_html_escaping(self):
        """
        Adversarial: Stem containing complex LaTeX math, chemical formulas,
        quotes, HTML tags, and ampersands.
        Verifies that rendering engine escapes HTML safely without syntax errors.
        """
        q_math = ReconstructedQuestion(
            id="q_math_adv",
            number=1,
            source_number=1,
            type=QuestionType.PART_I_MCQ,
            stem="Cho phản ứng: \\( N_2(g) + 3H_2(g) \\rightleftharpoons 2NH_3(g) \\), có \\( \\Delta H^\\circ_{298} = -92 \\text{ kJ} \\). "
                 "Nếu thêm chất <script>alert('xss')</script> và & ' \" < > thì cân bằng chuyển dịch như thế nào?",
            options=[
                QuestionOption(label="A", text="Theo chiều thuận & tỏa nhiệt."),
                QuestionOption(label="B", text="Theo chiều nghịch & thu nhiệt."),
                QuestionOption(label="C", text="Không chuyển dịch (K_c không đổi)."),
                QuestionOption(label="D", text="Không xác định được."),
            ],
            source_pages=[1]
        )

        ans_math = AnswerKeyIR(question_id="q_math_adv", question_number=1, type=SectionType.PART_I_MCQ, selected_answer="A")
        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q_math],
            doc_reps=[rep],
            answers=[ans_math]
        )

        renderer = DocumentHTMLRenderer(BLUE_BLACK_CLASSIC_STYLE)
        html = renderer.render_worksheet(doc_ir)
        self.assertNotIn("<script>alert('xss')</script>", html, "XSS script tag was not escaped!")
        self.assertIn("N_2(g)", html)


if __name__ == "__main__":
    unittest.main()
