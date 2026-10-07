"""
Unit & Regression Tests for Visual / Image-Based Option Multiple Choice Questions.
Verifies that:
1. CanonicalIRBuilder accurately maps question attachments to OptionIR.image_path.
2. validate_canonical_document_ir permits empty option text if visual assets are attached.
3. validate_canonical_document_ir strictly enforces non-empty text for text-only questions.
4. LayoutSolver forces 1-column layout and allocates realistic height for image options.
5. Worksheet renderer generates proper inline <img class="opt-crop-img"> elements.
"""

import os
import unittest
from datetime import datetime, timezone

from engines.quiz.ir.models import (
    AnswerKeyIR,
    CanonicalDocumentIR,
    DocumentMetadataIR,
    OptionIR,
    ProvenanceIR,
    QuestionIR,
    RichElementIR,
    RichElementType,
    SectionIR,
    SectionType,
    TFStatementIR,
)
from engines.quiz.ir.validator import IRValidationError, validate_canonical_document_ir
from engines.quiz.ir.builder import CanonicalIRBuilder
from engines.quiz.reconstruction.models import QuestionOption, ReconstructedQuestion
from engines.quiz.rendering.layout import LayoutSolver
from engines.quiz.rendering.styles import StylePreset
from engines.quiz.rendering.templates import render_worksheet_document
from engines.quiz.assets.models import AssetRecord, AssetType
from engines.quiz.graph.models import AssociationRole, RichElementAttachment


class TestImageOptions(unittest.TestCase):

    def _create_minimal_doc_ir(self, questions: list[QuestionIR]) -> CanonicalDocumentIR:
        sec = SectionIR(
            id="sec_part_i",
            title="PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN",
            type=SectionType.PART_I_MCQ,
            question_ids=[q.id for q in questions]
        )
        meta = DocumentMetadataIR(
            title="ĐỀ KIỂM TRA HÓA HỌC",
            subject="HÓA HỌC",
            total_questions=len(questions),
            created_at=datetime.now(timezone.utc).isoformat()
        )
        answers = [
            AnswerKeyIR(
                question_id=q.id,
                question_number=q.number,
                type=q.type,
                selected_answer="A",
                sub_answers={"a": True, "b": False, "c": True, "d": False} if q.type == SectionType.PART_II_TF else None,
            )
            for q in questions
        ]
        return CanonicalDocumentIR(
            metadata=meta,
            sections=[sec],
            questions=questions,
            answers=answers
        )

    def test_validation_passes_when_options_have_image_path(self):
        """Options with empty text MUST pass validation when image_path is present."""
        q = QuestionIR(
            id="q_chem_visual_opts",
            number=1,
            source_number=7,
            type=SectionType.PART_I_MCQ,
            stem="Chất nào sau đây thuộc loại acid béo omega-3?",
            options=[
                OptionIR(label="A", text="", image_path="/path/to/crop_a.png"),
                OptionIR(label="B", text="", image_path="/path/to/crop_b.png"),
                OptionIR(label="C", text="", image_path="/path/to/crop_c.png"),
                OptionIR(label="D", text="", image_path="/path/to/crop_d.png"),
            ],
            provenance=ProvenanceIR(source_pages=[37])
        )
        doc_ir = self._create_minimal_doc_ir([q])
        # Should not raise IRValidationError
        validate_canonical_document_ir(doc_ir)

    def test_validation_passes_when_question_has_rich_elements(self):
        """Options with empty text pass validation when question has rich elements."""
        rich_elem = RichElementIR(
            element_id="elem_q1_img",
            type=RichElementType.IMAGE_CROP,
            source_crop_path="/path/to/figure.png",
            bbox=(100.0, 200.0, 400.0, 350.0),
            page_number=37
        )
        q = QuestionIR(
            id="q_stem_has_rich",
            number=1,
            source_number=7,
            type=SectionType.PART_I_MCQ,
            stem="Cho đồ thị/hình bên dưới. Phương án nào đúng?",
            options=[
                OptionIR(label="A", text=""),
                OptionIR(label="B", text=""),
                OptionIR(label="C", text=""),
                OptionIR(label="D", text=""),
            ],
            rich_elements=[rich_elem],
            provenance=ProvenanceIR(source_pages=[37])
        )
        doc_ir = self._create_minimal_doc_ir([q])
        validate_canonical_document_ir(doc_ir)

    def test_validation_strictly_rejects_text_only_question_with_empty_option(self):
        """Text-only questions with NO images must strictly raise IRValidationError when option text is empty."""
        q = QuestionIR(
            id="q_text_only_empty_opt",
            number=1,
            source_number=1,
            type=SectionType.PART_I_MCQ,
            stem="Công thức hóa học của nước là:",
            options=[
                OptionIR(label="A", text=""),  # Empty text, no image
                OptionIR(label="B", text="H2O"),
                OptionIR(label="C", text="CO2"),
                OptionIR(label="D", text="NaCl"),
            ],
            provenance=ProvenanceIR(source_pages=[1])
        )
        doc_ir = self._create_minimal_doc_ir([q])
        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("has empty text for option 'A'", str(ctx.exception))

    def test_validation_tf_statements_with_rich_elements(self):
        """Part II TF statements with empty text pass validation only if visual elements are present."""
        rich_elem = RichElementIR(
            element_id="elem_tf_img",
            type=RichElementType.IMAGE_CROP,
            source_crop_path="/path/to/chart.png",
            bbox=(50.0, 100.0, 300.0, 250.0),
            page_number=1
        )
        q_pass = QuestionIR(
            id="q_tf_visual",
            number=1,
            source_number=1,
            type=SectionType.PART_II_TF,
            stem="Dựa vào biểu đồ hình bên:",
            sub_statements=[
                TFStatementIR(label="a", statement=""),
                TFStatementIR(label="b", statement="Nhiệt độ tăng"),
                TFStatementIR(label="c", statement="Áp suất giảm"),
                TFStatementIR(label="d", statement="Cân bằng chuyển dịch"),
            ],
            rich_elements=[rich_elem],
            provenance=ProvenanceIR(source_pages=[1])
        )
        doc_ir = self._create_minimal_doc_ir([q_pass])
        validate_canonical_document_ir(doc_ir)

        # Without rich element, it must fail
        q_fail = QuestionIR(
            id="q_tf_no_visual",
            number=1,
            source_number=1,
            type=SectionType.PART_II_TF,
            stem="Cho các phát biểu sau:",
            sub_statements=[
                TFStatementIR(label="a", statement=""),
                TFStatementIR(label="b", statement="Phát biểu b"),
                TFStatementIR(label="c", statement="Phát biểu c"),
                TFStatementIR(label="d", statement="Phát biểu d"),
            ],
            provenance=ProvenanceIR(source_pages=[1])
        )
        doc_ir_fail = self._create_minimal_doc_ir([q_fail])
        with self.assertRaises(IRValidationError):
            validate_canonical_document_ir(doc_ir_fail)

    def test_canonical_ir_builder_pairs_attachments_to_image_options(self):
        """CanonicalIRBuilder must detect 4 attachments matching 4 options and pair them in reading order."""
        q_rec = ReconstructedQuestion(
            id="q_p37_num7_builder_test",
            number=1,
            source_number=7,
            stem="Chất nào sau đây thuộc loại acid béo omega-3?",
            options=[
                QuestionOption(label="A", text="."),
                QuestionOption(label="B", text="."),
                QuestionOption(label="C", text="..."),
                QuestionOption(label="D", text=""),
            ],
            source_pages=[37],
            bboxes=[(72.0, 260.0, 580.0, 420.0)]
        )

        # 4 attachments ordered vertically
        att_a = RichElementAttachment(
            asset_id="asset_a",
            role=AssociationRole.QUESTION_FIGURE,
            asset_record=AssetRecord(
                asset_id="asset_a",
                source_page=37,
                bbox=(131.0, 277.0, 471.0, 299.0),
                type=AssetType.RASTER,
                path="/tmp/fake_crop_a.png",
                sha256="dummy_sha_a",
                width=340.0,
                height=22.0
            ),
            owner_question_id=q_rec.id
        )
        att_b = RichElementAttachment(
            asset_id="asset_b",
            role=AssociationRole.QUESTION_FIGURE,
            asset_record=AssetRecord(
                asset_id="asset_b",
                source_page=37,
                bbox=(132.0, 303.0, 575.0, 323.0),
                type=AssetType.RASTER,
                path="/tmp/fake_crop_b.png",
                sha256="dummy_sha_b",
                width=443.0,
                height=20.0
            ),
            owner_question_id=q_rec.id
        )
        att_c = RichElementAttachment(
            asset_id="asset_c",
            role=AssociationRole.QUESTION_FIGURE,
            asset_record=AssetRecord(
                asset_id="asset_c",
                source_page=37,
                bbox=(131.0, 343.0, 553.0, 365.0),
                type=AssetType.RASTER,
                path="/tmp/fake_crop_c.png",
                sha256="dummy_sha_c",
                width=422.0,
                height=22.0
            ),
            owner_question_id=q_rec.id
        )
        att_d = RichElementAttachment(
            asset_id="asset_d",
            role=AssociationRole.QUESTION_FIGURE,
            asset_record=AssetRecord(
                asset_id="asset_d",
                source_page=37,
                bbox=(117.0, 385.0, 573.0, 405.0),
                type=AssetType.RASTER,
                path="/tmp/fake_crop_d.png",
                sha256="dummy_sha_d",
                width=456.0,
                height=20.0
            ),
            owner_question_id=q_rec.id
        )

        attachments_map = {
            q_rec.id: [att_c, att_a, att_d, att_b]  # Shuffled order
        }

        meta = DocumentMetadataIR(
            title="ĐỀ THI HÓA",
            subject="HÓA HỌC",
            total_questions=1,
            created_at=datetime.now(timezone.utc).isoformat()
        )

        ans = AnswerKeyIR(
            question_id=q_rec.id,
            question_number=q_rec.number,
            type=SectionType.PART_I_MCQ,
            selected_answer="A"
        )

        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[q_rec],
            doc_reps=[],
            answers=[ans],
            metadata=meta,
            rich_element_attachments=attachments_map
        )

        built_q = doc_ir.questions[0]
        # Verify 4 options have correct image paths in reading order
        self.assertEqual(built_q.options[0].label, "A")
        self.assertEqual(built_q.options[0].image_path, "/tmp/fake_crop_a.png")
        self.assertEqual(built_q.options[0].text, "")  # Cleaned stray dot

        self.assertEqual(built_q.options[1].label, "B")
        self.assertEqual(built_q.options[1].image_path, "/tmp/fake_crop_b.png")
        self.assertEqual(built_q.options[1].text, "")

        self.assertEqual(built_q.options[2].label, "C")
        self.assertEqual(built_q.options[2].image_path, "/tmp/fake_crop_c.png")
        self.assertEqual(built_q.options[2].text, "")

        self.assertEqual(built_q.options[3].label, "D")
        self.assertEqual(built_q.options[3].image_path, "/tmp/fake_crop_d.png")
        self.assertEqual(built_q.options[3].text, "")

        # Verify rich_elements is empty (assets were consumed by options, not duplicated under stem)
        self.assertEqual(len(built_q.rich_elements), 0)

        # Verify layout hint is 1 column
        self.assertEqual(built_q.layout_hints.columns, 1)

    def test_layout_solver_and_rendering(self):
        """Layout solver forces 1 column for image options and HTML contains opt-crop-img."""
        # Create temporary dummy image file so os.path.isfile returns True
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
            dummy_img_path = tf.name

        try:
            q = QuestionIR(
                id="q_render_test",
                number=7,
                source_number=7,
                type=SectionType.PART_I_MCQ,
                stem="Chất nào sau đây thuộc loại acid béo omega-3?",
                options=[
                    OptionIR(label="A", text="", image_path=dummy_img_path),
                    OptionIR(label="B", text="", image_path=dummy_img_path),
                    OptionIR(label="C", text="", image_path=dummy_img_path),
                    OptionIR(label="D", text="", image_path=dummy_img_path),
                ],
                provenance=ProvenanceIR(source_pages=[37])
            )

            # Test LayoutSolver
            cols = LayoutSolver.determine_option_columns(q.options, has_images=False)
            self.assertEqual(cols, 1)

            stem_h, rich_h, opt_h = LayoutSolver.estimate_question_components(q, option_cols=cols)
            # 4 rows * 42pt + 6pt = 174pt
            self.assertGreater(opt_h, 150.0)

            # Test HTML template rendering
            doc_ir = self._create_minimal_doc_ir([q])
            preset = StylePreset()
            html_out = render_worksheet_document(doc_ir, preset)

            self.assertIn('class="opt-crop-img"', html_out)
            self.assertIn('class="options-grid opt-col-1"', html_out)
            self.assertIn("Câu 7:", html_out)
            self.assertIn("A.", html_out)
            self.assertIn("B.", html_out)
            self.assertIn("C.", html_out)
            self.assertIn("D.", html_out)
        finally:
            if os.path.isfile(dummy_img_path):
                os.unlink(dummy_img_path)


if __name__ == "__main__":
    unittest.main()
