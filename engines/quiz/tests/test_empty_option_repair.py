"""
Unit Tests for Empty Option Auto-Repair Engine (Ticket #09).
Verifies that questions with empty option text (A, B, C, D) or sub-statements
are gracefully repaired with visual attachments or placeholder text without throwing IRValidationError.
"""

import unittest
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionType,
    QuestionIR,
    OptionIR,
    TFStatementIR,
    AnswerKeyIR,
    RichElementIR,
)
from engines.quiz.ir.validator import validate_canonical_document_ir, IRValidationError


class TestEmptyOptionRepair(unittest.TestCase):
    def _create_base_doc(self, question: QuestionIR, answer_type: SectionType = SectionType.PART_I_MCQ) -> CanonicalDocumentIR:
        return CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="ĐỀ KIỂM TRA HÓA HỌC",
                subject="HÓA HỌC",
                total_questions=1,
                created_at="2026-10-11T12:00:00Z",
            ),
            questions=[question],
            answers=[
                AnswerKeyIR(
                    question_id=question.id,
                    question_number=question.number,
                    type=answer_type,
                    selected_answer="A",
                    evidence="Lời giải chi tiết câu 1",
                )
            ],
        )

    def test_empty_option_with_unassigned_crop_attaches_visual_asset(self):
        """
        When Option A has empty text, but question has an unassigned rich element crop,
        validator auto-repairs option A by attaching opt.image_path and setting text.
        """
        crop = RichElementIR(
            element_id="crop_1",
            source_crop_path="/data/crops/figure_a.png",
            caption="Hình A",
            page_number=1,
            bbox=[100.0, 200.0, 300.0, 400.0],
        )
        q = QuestionIR(
            id="q_1",
            number=1,
            source_number=1,
            type=SectionType.PART_I_MCQ,
            stem="Cho đồ thị biểu diễn phản ứng như sau:",
            rich_elements=[crop],
            options=[
                OptionIR(label="A", text=""), # Empty option!
                OptionIR(label="B", text="Đáp án B"),
                OptionIR(label="C", text="Đáp án C"),
                OptionIR(label="D", text="Đáp án D"),
            ],
        )

        doc = self._create_base_doc(q)
        # Must not raise IRValidationError!
        validate_canonical_document_ir(doc)

        opt_a = q.options[0]
        self.assertEqual(opt_a.image_path, "/data/crops/figure_a.png")
        self.assertTrue(bool(opt_a.text and opt_a.text.strip()))

    def test_empty_option_with_stem_diagram_assigns_diagram_placeholder(self):
        """
        When Option B has empty text and question has a diagram in stem (already assigned or general),
        validator auto-repairs option B with safe visual placeholder text.
        """
        crop = RichElementIR(
            element_id="crop_stem",
            source_crop_path="/data/crops/stem_diagram.png",
            caption="Sơ đồ thí nghiệm",
            page_number=1,
            bbox=[100.0, 100.0, 400.0, 300.0],
        )
        q = QuestionIR(
            id="q_2",
            number=1,
            source_number=1,
            type=SectionType.PART_I_MCQ,
            stem="Quan sát sơ đồ thí nghiệm bên dưới:",
            rich_elements=[crop],
            options=[
                OptionIR(label="A", text="Chất khí X", image_path="/data/crops/stem_diagram.png"),
                OptionIR(label="B", text=""), # Empty option with no image!
                OptionIR(label="C", text="Chất lỏng Y"),
                OptionIR(label="D", text="Kết tủa Z"),
            ],
        )

        doc = self._create_base_doc(q)
        validate_canonical_document_ir(doc)

        opt_b = q.options[1]
        self.assertTrue(bool(opt_b.text and opt_b.text.strip()))
        self.assertIn("Xem hình vẽ", opt_b.text)

    def test_empty_option_without_any_visual_assigns_default_placeholder(self):
        """
        When Option C has empty text and no rich elements exist,
        validator auto-repairs option C with safe placeholder text.
        """
        q = QuestionIR(
            id="q_3",
            number=1,
            source_number=1,
            type=SectionType.PART_I_MCQ,
            stem="Nội dung câu hỏi lý thuyết không có hình vẽ:",
            options=[
                OptionIR(label="A", text="Lựa chọn 1"),
                OptionIR(label="B", text="Lựa chọn 2"),
                OptionIR(label="C", text="   "), # Whitespace-only option
                OptionIR(label="D", text="Lựa chọn 4"),
            ],
        )

        doc = self._create_base_doc(q)
        validate_canonical_document_ir(doc)

        opt_c = q.options[2]
        self.assertTrue(bool(opt_c.text and opt_c.text.strip()))
        self.assertIn("Xem hình vẽ", opt_c.text)

    def test_empty_tf_statement_assigns_placeholder(self):
        """
        When a Part II True/False sub-statement has empty text,
        validator auto-repairs the sub-statement with safe placeholder text.
        """
        q = QuestionIR(
            id="q_tf_1",
            number=1,
            source_number=1,
            type=SectionType.PART_II_TF,
            stem="Các mệnh đề sau đây đúng hay sai:",
            sub_statements=[
                TFStatementIR(label="a", statement="Mệnh đề 1"),
                TFStatementIR(label="b", statement=""), # Empty sub-statement
                TFStatementIR(label="c", statement="Mệnh đề 3"),
                TFStatementIR(label="d", statement="Mệnh đề 4"),
            ],
        )

        doc = self._create_base_doc(q, answer_type=SectionType.PART_II_TF)
        validate_canonical_document_ir(doc)

        stmt_b = q.sub_statements[1]
        self.assertTrue(bool(stmt_b.statement and stmt_b.statement.strip()))
        self.assertIn("Xem nội dung đính kèm", stmt_b.statement)


if __name__ == "__main__":
    unittest.main()
