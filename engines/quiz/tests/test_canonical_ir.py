"""
Unit Tests for Canonical Document IR & Validation Engine (TASK-07)
Tests CanonicalIRBuilder and strict IRValidator integrity rules:
schema version, 1:1 question-answer mapping, duplicate ID prevention, and option cardinality.
"""

import unittest
from datetime import datetime, timezone

from engines.quiz.perception.models import PageRepresentation, PageKind
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionType,
    QuestionOption,
    TFSubStatement
)
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    PageIR,
    SectionIR,
    SectionType,
    QuestionIR,
    OptionIR,
    TFStatementIR,
    AnswerKeyIR,
    ProvenanceIR,
    SchemaVersion
)
from engines.quiz.ir.validator import (
    IRValidationError,
    validate_canonical_document_ir
)
from engines.quiz.ir.builder import CanonicalIRBuilder


class TestCanonicalIR(unittest.TestCase):
    """Test suite for Canonical Document IR models, builder, and validator."""

    def _create_sample_valid_ir(self) -> CanonicalDocumentIR:
        """Helper creating a minimal valid CanonicalDocumentIR instance."""
        q1 = QuestionIR(
            id="q_p1_num1_abc1",
            number=1,
            source_number=1,
            type=SectionType.PART_I_MCQ,
            stem="Hợp chất nào sau đây là este?",
            options=[
                OptionIR(label="A", text="HCOOCH3", is_correct=True),
                OptionIR(label="B", text="CH3COOH", is_correct=False),
                OptionIR(label="C", text="C2H5OH", is_correct=False),
                OptionIR(label="D", text="CH3CHO", is_correct=False)
            ],
            provenance=ProvenanceIR(source_pages=[1])
        )

        ans1 = AnswerKeyIR(
            question_id="q_p1_num1_abc1",
            question_number=1,
            type=SectionType.PART_I_MCQ,
            selected_answer="A",
            evidence="HCOOCH3 là metyl fomat thuộc loại este.",
            confidence=1.0,
            is_verified=True
        )

        sec1 = SectionIR(
            id="sec_part_i",
            title="PHẦN I. Câu trắc nghiệm nhiều phương án",
            type=SectionType.PART_I_MCQ,
            question_ids=["q_p1_num1_abc1"]
        )

        meta = DocumentMetadataIR(
            title="ĐỀ THI THỬ THPT QUỐC GIA",
            subject="HÓA HỌC",
            total_questions=1,
            created_at=datetime.now(timezone.utc).isoformat()
        )

        return CanonicalDocumentIR(
            schema_version=SchemaVersion.V3_0_0,
            metadata=meta,
            pages=[PageIR(page_number=1, width=595.0, height=842.0, kind="vector")],
            sections=[sec1],
            questions=[q1],
            answers=[ans1]
        )

    def test_valid_canonical_ir_passes_validation(self):
        """Tests that a fully conforming CanonicalDocumentIR passes validation."""
        doc_ir = self._create_sample_valid_ir()
        # Should not raise exception
        validate_canonical_document_ir(doc_ir)
        self.assertEqual(doc_ir.schema_version, SchemaVersion.V3_0_0)
        self.assertEqual(len(doc_ir.questions), 1)

    def test_validator_rejects_duplicate_question_ids(self):
        """Tests that duplicate Question IDs raise IRValidationError."""
        doc_ir = self._create_sample_valid_ir()
        # Clone question 1 to create duplicate
        q_dup = doc_ir.questions[0].model_copy()
        doc_ir.questions.append(q_dup)
        doc_ir.metadata.total_questions = 2

        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("Duplicate question ID", str(ctx.exception))

    def test_validator_enforces_1_to_1_answer_mapping(self):
        """Tests that missing answers or orphaned answers raise IRValidationError."""
        doc_ir = self._create_sample_valid_ir()

        # Case 1: Missing answer for question
        doc_ir.answers.clear()
        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("Missing answers", str(ctx.exception))

        # Case 2: Orphaned answer without question
        doc_ir = self._create_sample_valid_ir()
        doc_ir.answers.append(
            AnswerKeyIR(
                question_id="orphaned_q_id",
                question_number=99,
                type=SectionType.PART_I_MCQ,
                selected_answer="B"
            )
        )
        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("Orphaned answers", str(ctx.exception))

    def test_validator_enforces_option_cardinality(self):
        """Tests that Part I requires 2..4 options and Part II requires 4 sub-statements."""
        # Part I with only 1 option
        doc_ir = self._create_sample_valid_ir()
        doc_ir.questions[0].options = [OptionIR(label="A", text="Only option")]
        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("invalid option cardinality", str(ctx.exception))

        # Part II with 3 sub-statements instead of 4
        doc_ir2 = self._create_sample_valid_ir()
        doc_ir2.questions[0].type = SectionType.PART_II_TF
        doc_ir2.questions[0].sub_statements = [
            TFStatementIR(label="a", statement="Stmt 1"),
            TFStatementIR(label="b", statement="Stmt 2"),
            TFStatementIR(label="c", statement="Stmt 3")
        ]
        doc_ir2.answers[0].type = SectionType.PART_II_TF
        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir2)
        self.assertIn("must have exactly 4 sub-statements", str(ctx.exception))

    def test_validator_checks_confidence_bounds(self):
        """Tests that confidence outside [0.0, 1.0] is rejected."""
        doc_ir = self._create_sample_valid_ir()
        doc_ir.questions[0].confidence = 1.5  # Invalid > 1.0

        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("invalid confidence", str(ctx.exception))

    def test_validator_part_i_answer_label_membership(self):
        """Tests that Part I answer key must match one of the available options."""
        doc_ir = self._create_sample_valid_ir()
        doc_ir.answers[0].selected_answer = "E"  # Options are only A, B, C, D

        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("is not in available options", str(ctx.exception))

    def test_canonical_ir_builder_end_to_end(self):
        """Tests CanonicalIRBuilder assembling raw questions, doc_reps, and answers."""
        recon_q1 = ReconstructedQuestion(
            id="q_p1_c1_x1",
            number=1,
            source_number=1,
            type=QuestionType.PART_I_MCQ,
            stem="Hòa tan 5,4gam Al vào dung dịch HCl  . Khí thoát ra là gì?",
            options=[
                QuestionOption(label="A", text="H2"),
                QuestionOption(label="B", text="Cl2"),
                QuestionOption(label="C", text="O2"),
                QuestionOption(label="D", text="CO2")
            ],
            source_pages=[1]
        )

        ans1 = AnswerKeyIR(
            question_id="q_p1_c1_x1",
            question_number=1,
            type=SectionType.PART_I_MCQ,
            selected_answer="A",
            evidence="Al tác dụng với HCl giải phóng khí H2."
        )

        mock_page = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0,
            page_kind=PageKind.VECTOR, raw_text="Sample text"
        )

        doc_ir = CanonicalIRBuilder.build(
            reconstructed_questions=[recon_q1],
            doc_reps=[mock_page],
            answers=[ans1]
        )

        self.assertEqual(len(doc_ir.questions), 1)
        built_q = doc_ir.questions[0]
        # Verify text was normalized (e.g. 5,4gam -> 5,4 g)
        self.assertIn("5,4 g", built_q.stem)
        # Verify Option A marked as correct
        self.assertTrue(built_q.options[0].is_correct)
        self.assertFalse(built_q.options[1].is_correct)
        # Verify Section created
        self.assertEqual(len(doc_ir.sections), 1)
        self.assertEqual(doc_ir.sections[0].type, SectionType.PART_I_MCQ)


if __name__ == "__main__":
    unittest.main()
