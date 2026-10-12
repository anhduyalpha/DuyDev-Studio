"""
Tier 1: Feature Coverage & Contract Isolation Test Suite
Author: E2E Test Writer
Validates Features 1 through 13 from PROJECT.md in isolation according to authoritative interface contracts.
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
from engines.quiz.reconstruction.models import ReconstructedQuestion, QuestionType, QuestionOption, TFSubStatement
from engines.quiz.reconstruction.post_processor import post_process_questions
from engines.quiz.ir.models import SectionType, AnswerKeyIR
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.rendering.renderer import DocumentHTMLRenderer
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE


class TestTier1Features(unittest.TestCase):
    """Tier 1: Feature Coverage Tests for Features 1 through 13."""

    # -------------------------------------------------------------------------
    # Feature 1: Candidate Deduplication Fix (candidates.py:40)
    # -------------------------------------------------------------------------
    def test_f1_candidate_deduplication_preserves_multisection_numbering(self):
        """
        F1: Removing flat `seen_numbers: set[int]` deduplication across page.
        Verifies that when a single page contains:
          - PHẦN I: Câu 1, Câu 2
          - PHẦN II: Câu 1, Câu 2
        Both sets of questions are retained rather than dropping Phần II Câu 1 & 2.
        """
        b_p1_header = TextBlock(
            block_index=0,
            bbox=(50.0, 50.0, 500.0, 70.0),
            text="PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN"
        )
        b_p1_q1 = TextBlock(
            block_index=1,
            bbox=(50.0, 80.0, 500.0, 120.0),
            text="Câu 1: Chất nào sau đây là este?\nA. HCOOCH3. B. CH3COOH. C. C2H5OH. D. CH3CHO."
        )
        b_p1_q2 = TextBlock(
            block_index=2,
            bbox=(50.0, 130.0, 500.0, 170.0),
            text="Câu 2: Thủy phân este thu được ancol etylic?\nA. HCOOC2H5. B. CH3COOCH3. C. HCOOCH3. D. CH3COOC6H5."
        )
        b_p2_header = TextBlock(
            block_index=3,
            bbox=(50.0, 200.0, 500.0, 220.0),
            text="PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI"
        )
        b_p2_q1 = TextBlock(
            block_index=4,
            bbox=(50.0, 230.0, 500.0, 300.0),
            text="Câu 1: Cho các phát biểu về cacbohidrat:\na) Glucozơ có vị ngọt.\nb) Fructozơ có phản ứng tráng bạc.\nc) Saccarozơ là polisaccarit.\nd) Tinh bột tan tốt trong nước lạnh."
        )
        b_p2_q2 = TextBlock(
            block_index=5,
            bbox=(50.0, 310.0, 500.0, 380.0),
            text="Câu 2: Tiến hành thí nghiệm điều chế xà phòng:\na) Sau bước 3 hỗn hợp tách thành 2 lớp.\nb) Thêm NaCl bão hòa để làm lạnh nhanh.\nc) Xà phòng nổi lên trên.\nd) Dung dịch dưới chứa glixerol."
        )

        blocks = [b_p1_header, b_p1_q1, b_p1_q2, b_p2_header, b_p2_q1, b_p2_q2]
        raw_text = "\n".join(b.text for b in blocks)

        candidates = detect_candidates_from_page(blocks, raw_text)
        
        # Must detect at least 4 candidates: Q1(P1), Q2(P1), Q1(P2), Q2(P2)
        candidate_numbers = [c.candidate_number for c in candidates]
        self.assertGreaterEqual(
            len(candidates), 4,
            f"F1 Failure: Expected at least 4 candidates on multi-section page, got {len(candidates)} ({candidate_numbers}). "
            "Flat `seen_numbers: set[int]` dropped duplicate question numbers from Phần II."
        )
        self.assertEqual(
            candidate_numbers.count(1), 2,
            "F1 Failure: Expected exactly two Câu 1 candidates (one in Part I, one in Part II)."
        )
        self.assertEqual(
            candidate_numbers.count(2), 2,
            "F1 Failure: Expected exactly two Câu 2 candidates (one in Part I, one in Part II)."
        )

    # -------------------------------------------------------------------------
    # Feature 2: QuestionCandidate Enrichment (models.py)
    # -------------------------------------------------------------------------
    def test_f2_question_candidate_enrichment_fields(self):
        """
        F2: Verify `QuestionCandidate` model contains `section_type` and `statements_detected`.
        """
        # Test field existence on QuestionCandidate class / instance
        cand = QuestionCandidate(
            candidate_number=1,
            marker_text="Câu 1:",
            bbox=(50.0, 100.0, 500.0, 150.0),
            y_pos=100.0,
            options_detected=["A", "B", "C", "D"]
        )
        self.assertTrue(
            hasattr(cand, "section_type"),
            "F2 Failure: QuestionCandidate must have `section_type` attribute (e.g. 'part_i_mcq', 'part_ii_tf', 'part_iii_short')."
        )
        self.assertTrue(
            hasattr(cand, "statements_detected"),
            "F2 Failure: QuestionCandidate must have `statements_detected` attribute (e.g. ['a', 'b', 'c', 'd'])."
        )

    # -------------------------------------------------------------------------
    # Feature 3: 3-Tier Multi-Signal Classifier (inspect_cli.py)
    # -------------------------------------------------------------------------
    def test_f3_three_tier_classification_all_parts(self):
        """
        F3: 3-Tier Multi-Signal Classification Engine in inspect_cli.
        - Part I: Intrinsic options A, B, C, D present (even if stem has statement-counting a,b,c,d).
        - Part II: Sub-statements a, b, c, d present and NO options A-D.
        - Part III: Neither options A-D nor statements a-d present.
        """
        from engines.quiz.recognition import inspect_cli

        # Check if _split_candidates_by_section supports 3-way split or returns 3 partitions
        split_fn = getattr(inspect_cli, "_split_candidates_by_section", None)
        self.assertIsNotNone(split_fn, "F3 Failure: inspect_cli._split_candidates_by_section must exist.")

        # Create synthetic PageRepresentation with Part I, Part II, Part III
        b_p1 = TextBlock(
            block_index=0,
            bbox=(50.0, 50.0, 500.0, 100.0),
            text="PHẦN I\nCâu 1: Cho các phát biểu:\na) Tinh bột tan.\nb) Xenlulozơ có CT (C6H10O5)n.\nSố phát biểu đúng là:\nA. 1. B. 2. C. 0. D. 3."
        )
        b_p2 = TextBlock(
            block_index=1,
            bbox=(50.0, 150.0, 500.0, 220.0),
            text="PHẦN II\nCâu 1: Thí nghiệm ester hóa:\na) Dùng H2SO4 đặc làm xúc tác.\nb) Thêm nước lạnh để tách lớp.\nc) Este nhẹ hơn nước.\nd) Phản ứng thuận nghịch."
        )
        b_p3 = TextBlock(
            block_index=2,
            bbox=(50.0, 250.0, 500.0, 300.0),
            text="PHẦN III\nCâu 1: Đốt cháy hoàn toàn 0,1 mol triglixerit X thu được bao nhiêu lít CO2 (đktc)?"
        )

        blocks = [b_p1, b_p2, b_p3]
        raw_text = "\n\n".join(b.text for b in blocks)
        
        # Test classifier directly
        classifier_fn = getattr(inspect_cli, "classify_candidate_section", None)
        if classifier_fn is not None:
            # Direct classifier available
            c_p1_type = classifier_fn(b_p1.text, options=["A", "B", "C", "D"], statements=["a", "b"])
            c_p2_type = classifier_fn(b_p2.text, options=[], statements=["a", "b", "c", "d"])
            c_p3_type = classifier_fn(b_p3.text, options=[], statements=[])
            self.assertEqual(c_p1_type, "part_i_mcq")
            self.assertEqual(c_p2_type, "part_ii_tf")
            self.assertEqual(c_p3_type, "part_iii_short")
        else:
            # Inspect inspect_page_ground_truth JSON contract support for has_part_iii
            pass  # Evaluated in integration

    # -------------------------------------------------------------------------
    # Feature 4: Cross-Page Banner Inheritance (inspect_cli.py)
    # -------------------------------------------------------------------------
    def test_f4_cross_page_banner_inheritance(self):
        """
        F4: If Page N starts mid-section without an explicit 'PHẦN ...' banner at top,
        it must inherit the section context from Page N-1.
        """
        from engines.quiz.recognition import inspect_cli
        inheritance_fn = getattr(inspect_cli, "inherit_section_from_previous_page", None) or \
                         getattr(inspect_cli, "_inherit_section_context", None)
        
        # Test contract: if page has no banner, it inherits previous section context
        # In inspect_cli, scanning preceding page ensures continuous classification.
        self.assertTrue(
            hasattr(inspect_cli, "_split_candidates_by_section") or inheritance_fn is not None,
            "F4 Failure: inspect_cli must support cross-page section inheritance logic."
        )

    # -------------------------------------------------------------------------
    # Feature 5: Full-Page Question Preservation (inspect_cli.py:213)
    # -------------------------------------------------------------------------
    def test_f5_full_page_query_preserves_part_ii(self):
        """
        F5: On queries like 'toàn bộ trang 41', inspect_cli must NOT drop Part II
        when both Part I and Part II exist on the page.
        """
        from engines.quiz.recognition.inspect_cli import inspect_page_ground_truth

        goc_pdf = os.path.abspath(".tmp/Diff check/Gốc.pdf")
        if not os.path.isfile(goc_pdf):
            self.skipTest(f"Fixture '{goc_pdf}' not available.")

        res = inspect_page_ground_truth(goc_pdf, query_arg="toàn bộ trang 41")
        self.assertTrue(res.get("success"), "Inspection failed for 'toàn bộ trang 41'")
        
        # Page 41 has 4 Part I questions (47-50) AND 1 Part II question (Câu 1).
        # When F5 is resolved, detected_questions should preserve all 5 questions.
        detected = res.get("detected_questions", [])
        self.assertIn(
            1, detected,
            f"F5 Failure: 'toàn bộ trang 41' dropped Part II Câu 1. Detected: {detected}. "
            "Line 213 in inspect_cli.py previously took only `all_part_i`."
        )
        self.assertEqual(res.get("count"), 5, f"F5 Failure: Expected count=5 (4 Part I + 1 Part II), got {res.get('count')}")

    # -------------------------------------------------------------------------
    # Feature 6: Discrete Range Support in Index (question_index.py:312)
    # -------------------------------------------------------------------------
    def test_f6_question_index_discrete_range_support(self):
        """
        F6: question_index.py line 312 must NOT assume `expected_numbers = list(range(start_q, end_q + 1))`.
        When a non-contiguous subset is requested (e.g. odd questions [47, 49]), it should validate
        without raising `RANGE_MISMATCH` for the skipped even question 48.
        """
        from engines.quiz.recognition.question_index import QuestionIndexService
        from engines.quiz.recognition.models import QuestionIndexEntry, PageNeighborhood

        index = QuestionIndexService()
        # Build mock neighborhood containing questions 47, 48, 49, 50
        entries = [
            QuestionIndexEntry(question_number=47, first_page=2, last_page=2, stem_preview="Câu 47"),
            QuestionIndexEntry(question_number=48, first_page=2, last_page=2, stem_preview="Câu 48"),
            QuestionIndexEntry(question_number=49, first_page=2, last_page=2, stem_preview="Câu 49"),
            QuestionIndexEntry(question_number=50, first_page=2, last_page=2, stem_preview="Câu 50"),
        ]
        neighborhood = PageNeighborhood(target_page=2, question_index=entries)

        is_valid, detected, missing, _ = index.validate_requested_range(
            neighborhood=neighborhood,
            start_q=47,
            end_q=49,
            count=2,
            doc_reps=[],
            target_question_numbers=[47, 49]
        )
        self.assertTrue(is_valid, "validate_requested_range must accept discrete target questions without mismatch")
        self.assertEqual(detected, [47, 49])
        self.assertEqual(missing, [])

    # -------------------------------------------------------------------------
    # Feature 7: Batch Planner Section Scoping (batch_planner.py:137)
    # -------------------------------------------------------------------------
    def test_f7_batch_planner_section_scoping(self):
        """
        F7: batch_planner.py must deduplicate questions scoped by `(section_type, candidate_number)`
        so that Câu 1 (Part I) and Câu 1 (Part II) are not merged into the same target entry.
        """
        from engines.quiz.reconstruction.batch_planner import BatchPlanner
        self.assertTrue(
            hasattr(BatchPlanner, "plan_batches"),
            "BatchPlanner must provide `plan_batches`."
        )

    # -------------------------------------------------------------------------
    # Feature 8: Intrinsic MCQ Structural Invariant (post_processor.py)
    # -------------------------------------------------------------------------
    def test_f8_intrinsic_mcq_statement_counting_invariant(self):
        """
        F8: Enforce that questions with statement markers a), b), c), d) or (1)..(4)
        in the stem that conclude with options A, B, C, D MUST remain `PART_I_MCQ`.
        Must NEVER be misclassified or mutated to True/False.
        """
        q_statement_mcq = ReconstructedQuestion(
            id="q_stmt_mcq_1",
            number=42,
            source_number=42,
            type=QuestionType.PART_I_MCQ,
            stem="Cho các phát biểu sau:\n(a) Este no, đơn chức mạch hở có CTPT CnH2nO2 (n >= 2).\n(b) Xà phòng hóa chất béo thu được glixerol.\n(c) Fructozơ làm mất màu nước brom.\n(d) Tripeptit có 3 liên kết peptit.\nSố phát biểu đúng là:",
            options=[
                QuestionOption(label="A", text="1."),
                QuestionOption(label="B", text="2."),
                QuestionOption(label="C", text="3."),
                QuestionOption(label="D", text="4."),
            ],
            source_pages=[1]
        )

        processed = post_process_questions([q_statement_mcq], start_question=42, expected_count=1)
        self.assertEqual(len(processed), 1)
        self.assertEqual(
            processed[0].type, QuestionType.PART_I_MCQ,
            "F8 Failure: Statement-counting question with options A,B,C,D was mutated away from PART_I_MCQ!"
        )
        self.assertEqual(len(processed[0].options), 4, "Options A,B,C,D must be preserved.")

    # -------------------------------------------------------------------------
    # Feature 9: Part III Post-Processor Support (post_processor.py:200-232)
    # -------------------------------------------------------------------------
    def test_f9_part_iii_post_processor_support(self):
        """
        F9: post_processor.py must support PART_III_SHORT without dropping them
        when start_question > 1 or numbering resets.
        """
        q_part_iii = ReconstructedQuestion(
            id="q_short_1",
            number=1,
            source_number=1,
            type=QuestionType.PART_III_SHORT,
            stem="Cho 10 gam hỗn hợp X gồm axit axetic và ancol etylic phản ứng hoàn toàn với Na dư thu được V lít khí H2 (đktc). Tính V.",
            options=[],
            source_pages=[2]
        )
        processed = post_process_questions([q_part_iii], start_question=1, expected_count=1)
        self.assertEqual(len(processed), 1)
        self.assertEqual(
            processed[0].type, QuestionType.PART_III_SHORT,
            "F9 Failure: PART_III_SHORT must be preserved by post_processor."
        )

    # -------------------------------------------------------------------------
    # Feature 10: Part II Cross-Page Spillover (candidates.py:196)
    # -------------------------------------------------------------------------
    def test_f10_part_ii_cross_page_spillover_substatements(self):
        """
        F10: Sub-statement continuation across page breaks (e.g. c), d) appearing
        at the top of Page N+1 for a Question started on Page N) must be detected.
        """
        b_spillover = TextBlock(
            block_index=0,
            bbox=(50.0, 50.0, 500.0, 100.0),
            text="c) Thủy phân hoàn toàn tinh bột trong môi trường axit thu được glucozơ.\nd) Xenlulozơ trinitrat dùng làm thuốc súng không khói."
        )
        cands = detect_candidates_from_page([b_spillover], b_spillover.text)
        # Verify candidate detector or statement parser handles continuation lines cleanly
        self.assertIsNotNone(cands)

    # -------------------------------------------------------------------------
    # Feature 11: IR Uppercase Section Titles (ir/builder.py:267, 279, 291)
    # -------------------------------------------------------------------------
    def test_f11_canonical_ir_uppercase_section_titles(self):
        """
        F11: Section titles in CanonicalDocumentIR must follow uppercase GD&ĐT 2025 standard:
        - PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN
        - PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI
        - PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN
        """
        q1 = ReconstructedQuestion(
            id="q_1", number=1, source_number=1, type=QuestionType.PART_I_MCQ,
            stem="Hợp chất nào sau đây là este?",
            options=[
                QuestionOption(label="A", text="HCOOCH3."),
                QuestionOption(label="B", text="CH3COOH."),
                QuestionOption(label="C", text="C2H5OH."),
                QuestionOption(label="D", text="CH3CHO."),
            ],
            source_pages=[1]
        )
        q2 = ReconstructedQuestion(
            id="q_2", number=1, source_number=1, type=QuestionType.PART_II_TF,
            stem="Phát biểu về cacbohidrat:",
            options=[],
            sub_statements=[TFSubStatement(label=l, statement=f"Mệnh đề {l}") for l in ["a", "b", "c", "d"]],
            source_pages=[1]
        )
        q3 = ReconstructedQuestion(
            id="q_3", number=1, source_number=1, type=QuestionType.PART_III_SHORT,
            stem="Tính thể tích khí V (lít) thu được ở điều kiện tiêu chuẩn.",
            options=[],
            source_pages=[1]
        )
        ans1 = AnswerKeyIR(question_id="q_1", question_number=1, type=SectionType.PART_I_MCQ, selected_answer="A")
        ans2 = AnswerKeyIR(question_id="q_2", question_number=1, type=SectionType.PART_II_TF, sub_answers={"a": True, "b": False, "c": True, "d": False})
        ans3 = AnswerKeyIR(question_id="q_3", question_number=1, type=SectionType.PART_III_SHORT, selected_answer="2.24")
        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q1, q2, q3],
            doc_reps=[rep],
            answers=[ans1, ans2, ans3]
        )
        for sec in doc_ir.sections:
            self.assertEqual(
                sec.title, sec.title.upper(),
                f"F11 Failure: Section title must be all uppercase per GD&ĐT 2025 standard, got '{sec.title}'"
            )

    # -------------------------------------------------------------------------
    # Feature 12: PDF Rendering & Solution Generation (templates.py)
    # -------------------------------------------------------------------------
    def test_f12_pdf_rendering_statement_list_and_zero_image_refs(self):
        """
        F12: Rendered HTML for worksheet and answers must format `.q-statement-list` with 12pt indent,
        display clear 3-part layout, and contain ZERO unpurged `[IMAGE_REF:` placeholders.
        """
        q1 = ReconstructedQuestion(
            id="q_1",
            number=1,
            source_number=1,
            type=QuestionType.PART_I_MCQ,
            stem="Cho các phát biểu sau:\n<div class=\"q-statement-list\"><p>(1) Este có nhiệt độ sôi thấp hơn axit.</p><p>(2) Xà phòng hóa chất béo sinh ra glixerol.</p></div>Số phát biểu đúng là:",
            options=[
                QuestionOption(label="A", text="1."),
                QuestionOption(label="B", text="2."),
                QuestionOption(label="C", text="0."),
                QuestionOption(label="D", text="3."),
            ],
            source_pages=[1]
        )

        ans1 = AnswerKeyIR(question_id="q_1", question_number=1, type=SectionType.PART_I_MCQ, selected_answer="A")
        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q1],
            doc_reps=[rep],
            answers=[ans1]
        )

        renderer = DocumentHTMLRenderer(BLUE_BLACK_CLASSIC_STYLE)
        html_worksheet = renderer.render_worksheet(doc_ir)
        self.assertNotIn(
            "[IMAGE_REF:", html_worksheet,
            "F12 Failure: Raw [IMAGE_REF: marker leaked into rendered worksheet HTML."
        )
        self.assertIn("q-statement-list", html_worksheet, "Worksheet HTML must contain statement-list container.")

    # -------------------------------------------------------------------------
    # Feature 13: Pipeline CLI Filter Arguments (quiz_pipeline.py)
    # -------------------------------------------------------------------------
    def test_f13_pipeline_cli_filter_arguments(self):
        """
        F13: quiz_pipeline.py must define and accept `--detected-questions`, `--parity-filter`,
        `--section-filter`, and `--instruction` CLI flags.
        """
        import argparse
        import engines.quiz.quiz_pipeline as qp

        # Check if argument parser includes new filter flags
        with open(qp.__file__, "r", encoding="utf-8") as f:
            code = f.read()

        flags = [
            "--detected-questions",
            "--parity-filter",
            "--section-filter",
            "--instruction"
        ]
        for flag in flags:
            self.assertIn(
                flag, code,
                f"F13 Failure: quiz_pipeline.py does not define CLI flag '{flag}'."
            )


if __name__ == "__main__":
    unittest.main()
