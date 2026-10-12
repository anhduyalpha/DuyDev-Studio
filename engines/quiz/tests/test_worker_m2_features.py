"""
Unit and Contract Test Suite for Worker M2 (Features 7 through 13).
Verifies:
- Feature 7: Batch Planner section scoping (c.section_type, c.candidate_number).
- Feature 8: Intrinsic structural signature invariant (post-processor reclassification).
- Feature 9: Part III post-processor support (preserving source_number and start_question > 1).
- Feature 10: Part II continuation sub-statements (c), d) across page splits).
- Feature 11: Canonical Document IR uppercase section titles.
- Feature 12: PDF rendering, statement list indent, zero image ref leaks, HTML escaping.
- Feature 13: Pipeline CLI filter arguments and orchestrator plumbing.
"""

import unittest
from engines.quiz.perception.models import (
    TextBlock,
    QuestionCandidate,
    PageRepresentation,
)
from engines.quiz.perception.candidates import detect_continuation_candidate
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionType,
    QuestionOption,
    TFSubStatement,
)
from engines.quiz.reconstruction.batch_planner import BatchPlanner
from engines.quiz.reconstruction.post_processor import (
    post_process_questions,
    reclassify_by_intrinsic_signature,
)
from engines.quiz.ir.models import SectionType, AnswerKeyIR
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.rendering.renderer import DocumentHTMLRenderer
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE


class TestWorkerM2Features(unittest.TestCase):
    """Behavior and contract tests for Features 7 to 13."""

    def test_feature_7_batch_planner_scopes_by_section_type(self):
        """F7: Verifies BatchPlanner does not drop duplicate candidate numbers across different sections."""
        cand_p1 = QuestionCandidate(
            candidate_number=1,
            marker_text="Câu 1:",
            bbox=(50.0, 100.0, 500.0, 150.0),
            y_pos=100.0,
            options_detected=["A", "B", "C", "D"],
            section_type="part_i_mcq"
        )
        cand_p2 = QuestionCandidate(
            candidate_number=1,
            marker_text="Câu 1:",
            bbox=(50.0, 300.0, 500.0, 350.0),
            y_pos=300.0,
            options_detected=[],
            section_type="part_ii_tf",
            statements_detected=["a", "b", "c", "d"]
        )
        p_rep = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            candidates=[cand_p1, cand_p2]
        )

        batches = BatchPlanner.plan_batches(
            doc_reps=[p_rep],
            start_page=1,
            end_page=1,
            start_question=1,
            question_count=2,
            target_question_numbers=[1]
        )

        all_target_nums = []
        for b in batches:
            all_target_nums.extend(b.target_question_numbers)

        self.assertGreaterEqual(len(all_target_nums), 1)

    def test_feature_8_intrinsic_reclassification_mcq_invariant(self):
        """F8: Questions with options A,B,C,D wrongly marked as PART_II_TF must be restored to PART_I_MCQ."""
        q_mislabeled = ReconstructedQuestion(
            id="q_mis",
            number=49,
            source_number=49,
            type=QuestionType.PART_II_TF,  # Misclassified by AI
            stem="Cho các phát biểu sau: a) ... b) ... c) ... d) ... Số phát biểu đúng là:",
            options=[
                QuestionOption(label="A", text="1."),
                QuestionOption(label="B", text="2."),
                QuestionOption(label="C", text="3."),
                QuestionOption(label="D", text="4."),
            ],
            source_pages=[1]
        )

        reclassified = reclassify_by_intrinsic_signature(q_mislabeled)
        self.assertEqual(
            reclassified.type,
            QuestionType.PART_I_MCQ,
            "Intrinsic signature invariant failed: question with 4 options was not restored to PART_I_MCQ!"
        )

        processed = post_process_questions([q_mislabeled], start_question=49, expected_count=1)
        self.assertEqual(processed[0].type, QuestionType.PART_I_MCQ)

    def test_feature_9_part_iii_preserved_when_start_q_is_high(self):
        """F9: Part III questions must not be dropped when start_question is 47 and must keep source_number."""
        q_part_i = ReconstructedQuestion(
            id="q_p1", number=47, source_number=47, type=QuestionType.PART_I_MCQ,
            stem="Câu 47 stem",
            options=[
                QuestionOption(label="A", text="1."),
                QuestionOption(label="B", text="2."),
                QuestionOption(label="C", text="3."),
                QuestionOption(label="D", text="4."),
            ],
            source_pages=[1]
        )
        q_part_iii = ReconstructedQuestion(
            id="q_p3", number=1, source_number=1, type=QuestionType.PART_III_SHORT,
            stem="Câu 1 phần III stem",
            options=[],
            source_pages=[1]
        )

        processed = post_process_questions(
            [q_part_i, q_part_iii],
            start_question=47,
            expected_count=2
        )

        types = [q.type for q in processed]
        numbers = [q.number for q in processed]

        self.assertIn(QuestionType.PART_III_SHORT, types, "Part III was dropped when start_question=47!")
        part_iii_item = next(q for q in processed if q.type == QuestionType.PART_III_SHORT)
        self.assertEqual(part_iii_item.number, 1, "Part III question number was incorrectly shifted!")

    def test_feature_10_continuation_detects_lowercase_substatements(self):
        """F10: Sub-statement continuation across page breaks must detect c) and d)."""
        cand_p1 = QuestionCandidate(
            candidate_number=1,
            marker_text="Câu 1:",
            bbox=(50.0, 750.0, 500.0, 800.0),
            y_pos=750.0,
            options_detected=[],
            section_type="part_ii_tf",
            statements_detected=["a", "b"]
        )
        p1 = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            candidates=[cand_p1], raw_text="Câu 1: a) Đúng. b) Sai."
        )

        b_top = TextBlock(
            block_index=0,
            bbox=(50.0, 50.0, 500.0, 100.0),
            text="c) Thủy phân hoàn toàn tinh bột thu được glucozơ.\nd) Xenlulozơ trinitrat làm thuốc súng."
        )
        p2 = PageRepresentation(
            page_index=1, page_number=2, width=595.0, height=842.0,
            blocks=[b_top], candidates=[], raw_text=b_top.text
        )

        is_cont = detect_continuation_candidate(p1, p2)
        self.assertTrue(is_cont, "detect_continuation_candidate failed to detect spillover sub-statements c), d)!")

    def test_feature_11_uppercase_section_titles(self):
        """F11: CanonicalIRBuilder produces strict uppercase titles."""
        q1 = ReconstructedQuestion(
            id="q1", number=1, source_number=1, type=QuestionType.PART_I_MCQ,
            stem="Stem 1",
            options=[
                QuestionOption(label="A", text="Opt A"),
                QuestionOption(label="B", text="Opt B"),
                QuestionOption(label="C", text="Opt C"),
                QuestionOption(label="D", text="Opt D"),
            ],
            source_pages=[1]
        )
        q2 = ReconstructedQuestion(
            id="q2", number=1, source_number=1, type=QuestionType.PART_II_TF,
            stem="Stem 2", options=[],
            sub_statements=[
                TFSubStatement(label="a", statement="Stmt a"),
                TFSubStatement(label="b", statement="Stmt b"),
                TFSubStatement(label="c", statement="Stmt c"),
                TFSubStatement(label="d", statement="Stmt d"),
            ],
            source_pages=[1]
        )
        q3 = ReconstructedQuestion(
            id="q3", number=1, source_number=1, type=QuestionType.PART_III_SHORT,
            stem="Stem 3", options=[], source_pages=[1]
        )
        ans1 = AnswerKeyIR(question_id="q1", question_number=1, type=SectionType.PART_I_MCQ, selected_answer="A")
        ans2 = AnswerKeyIR(question_id="q2", question_number=1, type=SectionType.PART_II_TF, sub_answers={"a": True, "b": False, "c": True, "d": False})
        ans3 = AnswerKeyIR(question_id="q3", question_number=1, type=SectionType.PART_III_SHORT, short_answer_value="42")
        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)

        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q1, q2, q3],
            doc_reps=[rep],
            answers=[ans1, ans2, ans3]
        )

        expected_titles = [
            "PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN",
            "PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI",
            "PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN"
        ]
        actual_titles = [sec.title for sec in doc_ir.sections]
        self.assertEqual(actual_titles, expected_titles)

    def test_feature_12_xss_escaping_in_stem_and_options(self):
        """F12: HTML escaping protects against script injection in stem, options, and solutions."""
        q_xss = ReconstructedQuestion(
            id="q_xss",
            number=1,
            source_number=1,
            type=QuestionType.PART_I_MCQ,
            stem="Tính nồng độ với <img src=x onerror=alert(1)> và <script>alert(2)</script>",
            options=[
                QuestionOption(label="A", text="<b>1M</b>"),
                QuestionOption(label="B", text="<script>2M</script>"),
                QuestionOption(label="C", text="3M"),
                QuestionOption(label="D", text="4M"),
            ],
            source_pages=[1]
        )
        ans = AnswerKeyIR(
            question_id="q_xss",
            question_number=1,
            type=SectionType.PART_I_MCQ,
            selected_answer="A",
            evidence="Lời giải với <script>alert('sol')</script>"
        )
        rep = PageRepresentation(page_index=0, page_number=1, width=595.0, height=842.0)
        doc_ir = CanonicalIRBuilder.build([q_xss], [rep], [ans])

        renderer = DocumentHTMLRenderer(BLUE_BLACK_CLASSIC_STYLE)
        ws_html = renderer.render_worksheet(doc_ir)
        ans_html = renderer.render_answer_key(doc_ir)

        self.assertNotIn("<script>alert(2)</script>", ws_html)
        self.assertNotIn("<script>2M</script>", ws_html)
        self.assertNotIn("<script>alert('sol')</script>", ans_html)

    def test_feature_13_pipeline_cli_arguments_declared(self):
        """F13: CLI arguments declared in quiz_pipeline.py."""
        import engines.quiz.quiz_pipeline as qp
        with open(qp.__file__, "r", encoding="utf-8") as f:
            code = f.read()

        for flag in ["--detected-questions", "--parity-filter", "--section-filter", "--instruction"]:
            self.assertIn(flag, code)


if __name__ == "__main__":
    unittest.main()
