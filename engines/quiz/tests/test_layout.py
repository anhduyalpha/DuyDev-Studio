"""
Unit Tests for Layout Solver and Paged Media CSS Generator (TASK-09).
"""

import unittest
from engines.quiz.ir.models import OptionIR, QuestionIR, RichElementIR
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE
from engines.quiz.rendering.layout import LayoutSolver


class TestLayoutSolver(unittest.TestCase):
    def test_clean_text_for_length(self):
        # Strips HTML tags and LaTeX formula delimiters
        raw = "<span>$H_2SO_4$</span> và $2 \\times 10^3$"
        cleaned = LayoutSolver.clean_text_for_length(raw)
        self.assertEqual(cleaned, "H_2SO_4 và 2 \\times 10^3")

    def test_determine_option_columns_4_cols(self):
        # Short options <= 15 chars
        opts = [
            OptionIR(label="A", text="12"),
            OptionIR(label="B", text="24"),
            OptionIR(label="C", text="36"),
            OptionIR(label="D", text="48"),
        ]
        cols = LayoutSolver.determine_option_columns(opts)
        self.assertEqual(cols, 4)

    def test_determine_option_columns_2_cols(self):
        # Medium options between 16 and 45 chars
        opts = [
            OptionIR(label="A", text="Dung dịch phenolphtalein không đổi màu"),
            OptionIR(label="B", text="Xuất hiện kết tủa trắng"),
            OptionIR(label="C", text="Có bọt khí không màu thoát ra"),
            OptionIR(label="D", text="Dung dịch chuyển sang màu xanh lam"),
        ]
        cols = LayoutSolver.determine_option_columns(opts)
        self.assertEqual(cols, 2)

    def test_determine_option_columns_1_col(self):
        # Long options > 45 chars
        opts = [
            OptionIR(label="A", text="Đây là một phát biểu rất dài vượt quá 45 ký tự nhằm giải thích chi tiết hiện tượng thí nghiệm phản ứng este hóa"),
            OptionIR(label="B", text="Phát biểu ngắn hơn một chút"),
            OptionIR(label="C", text="Phát biểu khác"),
            OptionIR(label="D", text="Phát biểu cuối cùng"),
        ]
        cols = LayoutSolver.determine_option_columns(opts)
        self.assertEqual(cols, 1)

    def test_determine_option_columns_with_images_forces_1_col(self):
        # When an option has images or has_images is True, must force 1 column
        opts = [
            OptionIR(label="A", text="12"),
            OptionIR(label="B", text="24"),
            OptionIR(label="C", text="36"),
            OptionIR(label="D", text="48"),
        ]
        cols = LayoutSolver.determine_option_columns(opts, has_images=True)
        self.assertEqual(cols, 1)

    def test_estimate_question_height(self):
        q = QuestionIR(
            id="q_test_1",
            number=1,
            source_number=1,
            stem="Cho 10 gam hỗn hợp kim loại tác dụng với axit $H_2SO_4$ loãng thu được dung dịch X và khí Y.",
            options=[
                OptionIR(label="A", text="10"),
                OptionIR(label="B", text="20"),
                OptionIR(label="C", text="30"),
                OptionIR(label="D", text="40"),
            ],
            rich_elements=[RichElementIR(element_id="elem_1", source_crop_path="dummy.png")],
        )
        h = LayoutSolver.estimate_question_height_pt(q, option_cols=4)
        # Should account for stem, rich element (130pt), options, padding
        self.assertGreater(h, 150.0)

    def test_generate_paged_media_css(self):
        css = LayoutSolver.generate_paged_media_css(BLUE_BLACK_CLASSIC_STYLE, "ĐỀ KIỂM TRA HÓA HỌC")
        # Verify essential W3C Paged Media rules
        self.assertIn("@page", css)
        self.assertIn("size: A4 portrait;", css)
        self.assertIn("break-inside: avoid !important;", css)
        self.assertIn("break-after: avoid !important;", css)
        self.assertIn("opt-col-4", css)
        self.assertIn("opt-col-2", css)
        self.assertIn("opt-col-1", css)
        self.assertIn("ĐỀ KIỂM TRA HÓA HỌC", css)

        # Header title and metadata rules
        self.assertIn(".exam-header-title", css)
        self.assertIn("font-size: 15pt;", css)
        self.assertIn("text-align: center;", css)
        self.assertIn(".exam-header-meta", css)

        # Obsolete purged rules must be absent
        self.assertNotIn(".student-info-box", css)
        self.assertNotIn(".section-instruction", css)

    def test_plan_atomic_pagination_independent_of_student_info_preset(self):
        from engines.quiz.ir.models import CanonicalDocumentIR, DocumentMetadataIR, SectionIR, SectionType
        q_list = [
            QuestionIR(
                id=f"q_{i}",
                number=i,
                source_number=i,
                stem=f"Câu hỏi số {i} nội dung tiêu chuẩn.",
                type=SectionType.PART_I_MCQ,
                options=[
                    OptionIR(label="A", text="Phương án A"),
                    OptionIR(label="B", text="Phương án B"),
                    OptionIR(label="C", text="Phương án C"),
                    OptionIR(label="D", text="Phương án D"),
                ],
            )
            for i in range(1, 15)
        ]
        sec = SectionIR(
            id="sec_1",
            title="PHẦN I",
            type=SectionType.PART_I_MCQ,
            question_ids=[q.id for q in q_list],
        )
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="KIỂM TRA", total_questions=14, created_at="2026-10-04T00:00:00Z"),
            sections=[sec],
            questions=q_list,
        )

        preset_false = BLUE_BLACK_CLASSIC_STYLE.model_copy(update={"show_student_info": False})
        preset_true = BLUE_BLACK_CLASSIC_STYLE.model_copy(update={"show_student_info": True})

        breaks_false = LayoutSolver.plan_atomic_pagination(doc_ir, preset_false)
        breaks_true = LayoutSolver.plan_atomic_pagination(doc_ir, preset_true)

        # Because student info box is completely removed from the DOM,
        # pagination breaks must be identical regardless of show_student_info flag.
        self.assertEqual(breaks_false, breaks_true)


if __name__ == "__main__":
    unittest.main()
