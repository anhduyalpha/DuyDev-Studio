"""
Comprehensive Unit & Regression Tests for PLAN-02: Atomic Question Pagination (TASK-03).
Verifies QuestionBlock atomicity, proactive height-based pagination planning,
PAGED media CSS containment, post-render option integrity verification,
and production failure reproduction.
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    OptionIR,
    QuestionIR,
    RichElementIR,
    RichElementType,
    SectionIR,
    SectionType,
    TFStatementIR,
)
from engines.quiz.qa.geometry_qa import validate_pdf_geometry, verify_option_integrity
from engines.quiz.qa.models import QAIssueType, QASeverity
from engines.quiz.rendering.layout import LayoutSolver, QuestionBlock
from engines.quiz.rendering.styles import BLUE_BLACK_CLASSIC_STYLE, StylePreset
from engines.quiz.rendering.templates import render_worksheet_document


class TestQuestionBlockModel(unittest.TestCase):
    """Test QuestionBlock data structure and calculations."""

    def test_question_block_initialization(self):
        q = QuestionIR(
            id="q_1",
            number=1,
            source_number=1,
            stem="Hợp chất nào sau đây là este?",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="CH3COOH"),
                OptionIR(label="B", text="HCOOCH3"),
                OptionIR(label="C", text="C2H5OH"),
                OptionIR(label="D", text="CH3CHO"),
            ],
        )
        block = QuestionBlock(
            question=q,
            estimated_height_pt=72.0,
            is_oversized=False,
        )
        self.assertEqual(block.estimated_height_pt, 72.0)
        self.assertFalse(block.is_oversized)

    def test_oversized_block_detected(self):
        q = QuestionIR(
            id="q_oversized",
            number=5,
            source_number=5,
            stem="Stem dài với bài tập đồ thị nhiều bước...",
            type=SectionType.PART_I_MCQ,
        )
        block = QuestionBlock(
            question=q,
            estimated_height_pt=720.0,
            is_oversized=True,
        )
        self.assertTrue(block.is_oversized)


class TestLayoutSolverHeightEstimation(unittest.TestCase):
    """Test LayoutSolver height estimation across question types."""

    def setUp(self):
        self.preset = BLUE_BLACK_CLASSIC_STYLE

    def test_short_mcq_height_estimation(self):
        # Short stem, 4 short options (1 row, 4 cols)
        q = QuestionIR(
            id="q_short",
            number=1,
            source_number=1,
            stem="Chất nào sau đây phản ứng với Na sinh ra khí H2?",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="C2H5OH"),
                OptionIR(label="B", text="CH3OCH3"),
                OptionIR(label="C", text="CH3CHO"),
                OptionIR(label="D", text="C6H6"),
            ],
        )
        h = LayoutSolver.estimate_question_height_pt(q, self.preset)
        # Expect ~ 55 - 80 pt
        self.assertGreater(h, 45.0)
        self.assertLess(h, 95.0)

    def test_multiline_stem_mcq_height_estimation(self):
        # Long stem > 200 chars, 2 rows of options
        q = QuestionIR(
            id="q_long",
            number=2,
            source_number=2,
            stem=(
                "Tiến hành thí nghiệm theo các bước sau: Bước 1: Cho vào ống nghiệm 1 ml dung dịch AgNO3 1%. "
                "Bước 2: Thêm từ từ dung dịch NH3 cho đến khi kết tủa tan hết. "
                "Bước 3: Thêm tiếp 1 ml dung dịch glucozơ rồi đun nóng nhẹ ống nghiệm trên ngọn lửa đèn cồn."
            ),
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Sau bước 3 có lớp bạc sáng bám vào thành ống nghiệm."),
                OptionIR(label="B", text="Ở bước 3 glucozơ bị khử thành amoni gluconat."),
                OptionIR(label="C", text="Thí nghiệm này chứng minh glucozơ có nhóm chức anđehit."),
                OptionIR(label="D", text="Có thể thay thế glucozơ bằng saccarozơ."),
            ],
        )
        h = LayoutSolver.estimate_question_height_pt(q, self.preset)
        # Multiline stem + 4 medium options (2 cols, 2 rows) -> higher height
        self.assertGreater(h, 100.0)

    def test_question_with_diagram_crop_height_estimation(self):
        # Question with rich element
        crop_elem = RichElementIR(
            element_id="elem_crop_1",
            type=RichElementType.IMAGE_CROP,
            source_crop_path="crops/test_diagram.png",
        )
        q = QuestionIR(
            id="q_rich",
            number=3,
            source_number=3,
            stem="Hình vẽ sau đây mô tả bộ dụng cụ điều chế khí trong phòng thí nghiệm:",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Khí O2."),
                OptionIR(label="B", text="Khí NH3."),
                OptionIR(label="C", text="Khí Cl2."),
                OptionIR(label="D", text="Khí SO2."),
            ],
            rich_elements=[crop_elem],
        )
        h = LayoutSolver.estimate_question_height_pt(q, self.preset)
        # Should include ~150pt crop + margin + stem + options
        self.assertGreater(h, 200.0)

    def test_part_ii_tf_height_estimation(self):
        # Part II True/False has 4 separate statement blocks
        statements = [
            TFStatementIR(label="a", statement="Chất X là este no, đơn chức, mạch hở."),
            TFStatementIR(label="b", statement="Đốt cháy hoàn toàn 1 mol X thu được 2 mol CO2."),
            TFStatementIR(label="c", statement="X có khả năng tham gia phản ứng tráng bạc."),
            TFStatementIR(label="d", statement="Tên gọi của X là etyl fomat."),
        ]
        q = QuestionIR(
            id="q_tf",
            number=4,
            source_number=4,
            stem="Cho este X có công thức phân tử C3H6O2 tác dụng với dung dịch NaOH.",
            type=SectionType.PART_II_TF,
            sub_statements=statements,
        )
        h = LayoutSolver.estimate_question_height_pt(q, self.preset)
        # Stem + 4 statement rows (~20pt each) + padding -> ~110-150pt
        self.assertGreater(h, 90.0)
        self.assertLess(h, 180.0)


class TestLayoutSolverAtomicPagination(unittest.TestCase):
    """Test proactive atomic pagination planning."""

    def setUp(self):
        self.preset = BLUE_BLACK_CLASSIC_STYLE

    def _create_mock_doc_ir(self, count: int, height_per_q: float = 75.0) -> CanonicalDocumentIR:
        questions = []
        for i in range(1, count + 1):
            questions.append(
                QuestionIR(
                    id=f"q_{i}",
                    number=i,
                    source_number=i,
                    stem=f"Câu hỏi số {i}: Cho kim loại tác dụng với dung dịch axit loãng.",
                    type=SectionType.PART_I_MCQ,
                    options=[
                        OptionIR(label="A", text="10,0 gam"),
                        OptionIR(label="B", text="20,0 gam"),
                        OptionIR(label="C", text="30,0 gam"),
                        OptionIR(label="D", text="40,0 gam"),
                    ],
                )
            )
        sec = SectionIR(
            id="sec_part_i",
            type=SectionType.PART_I_MCQ,
            title="PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN",
            instruction="Thí sinh chọn 1 phương án đúng.",
            question_ids=[q.id for q in questions],
        )
        meta = DocumentMetadataIR(
            title="ĐỀ THI MẪU",
            total_questions=count,
            created_at="2026-10-04T00:00:00Z",
        )
        return CanonicalDocumentIR(metadata=meta, sections=[sec], questions=questions)

    def test_proactive_page_break_inserted_before_overflow(self):
        # 12 questions: usable height ~762pt.
        # Header + student info + section banner ~ 160pt.
        # Remaining for page 1 ~ 600pt.
        # Each question ~ 65-70pt.
        # Page 1 can fit roughly 8-9 questions.
        # Question 9 or 10 must have a proactive break planned.
        doc_ir = self._create_mock_doc_ir(count=14)
        planned_breaks = LayoutSolver.plan_atomic_pagination(doc_ir, self.preset)

        self.assertIsInstance(planned_breaks, set)
        self.assertGreater(len(planned_breaks), 0)
        # Ensure q_1 is NEVER broken (it's the first question)
        self.assertNotIn("q_1", planned_breaks)
        # Ensure a question around index 8..11 has break planned
        has_break = any(f"q_{i}" in planned_breaks for i in range(7, 12))
        self.assertTrue(has_break, f"Expected a page break among questions 7-11, got: {planned_breaks}")

    def test_force_break_ids_honored(self):
        doc_ir = self._create_mock_doc_ir(count=6)
        force_breaks = {"q_3"}
        planned = LayoutSolver.plan_atomic_pagination(doc_ir, self.preset, force_break_ids=force_breaks)
        self.assertIn("q_3", planned)


class TestCSSAndTemplateAtomicRendering(unittest.TestCase):
    """Test CSS containment rules and template HTML output for atomic question units."""

    def test_css_contains_layout_and_break_avoidance(self):
        css = LayoutSolver.generate_paged_media_css(BLUE_BLACK_CLASSIC_STYLE)
        # Must have containment and display: block for question items
        self.assertIn(".question-item", css)
        self.assertIn("contain: layout;", css)
        self.assertIn("display: block;", css)
        self.assertIn("break-inside: avoid", css)

        # Must have page-break-before class definition
        self.assertIn(".question-item.page-break-before", css)
        self.assertIn("break-before: page !important;", css)

        # Options grid must avoid breaking inside
        self.assertIn(".options-grid", css)
        self.assertIn("page-break-inside: avoid !important;", css)

    def test_template_applies_page_break_class_and_style(self):
        q1 = QuestionIR(
            id="q_1",
            number=1,
            source_number=1,
            stem="Nội dung câu 1",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Opt A"),
                OptionIR(label="B", text="Opt B"),
                OptionIR(label="C", text="Opt C"),
                OptionIR(label="D", text="Opt D"),
            ],
        )
        q2 = QuestionIR(
            id="q_2",
            number=2,
            source_number=2,
            stem="Nội dung câu 2",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Opt A"),
                OptionIR(label="B", text="Opt B"),
                OptionIR(label="C", text="Opt C"),
                OptionIR(label="D", text="Opt D"),
            ],
        )
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Test Exam", total_questions=2, created_at="2026-10-04T00:00:00Z"),
            questions=[q1, q2],
        )

        # Force break on q_2
        html_out = render_worksheet_document(doc_ir, preset=BLUE_BLACK_CLASSIC_STYLE, force_break_ids={"q_2"})

        # q_1 should NOT have page-break-before
        self.assertIn('Câu 1:', html_out)
        # q_2 MUST have page-break-before class and style
        self.assertIn('question-item page-break-before', html_out)
        self.assertIn('style="break-before: page; page-break-before: always;"', html_out)


class TestPostRenderOptionIntegrityVerification(unittest.TestCase):
    """Test deterministic option integrity post-render verification."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_opt_integrity_")
        self.q1 = QuestionIR(
            id="q_prod_1",
            number=1,
            source_number=1,
            stem="Chất nào sau đây thuộc loại đisaccarit?",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Glucozơ"),
                OptionIR(label="B", text="Saccarozơ"),
                OptionIR(label="C", text="Fructozơ"),
                OptionIR(label="D", text="Tinh bột"),
            ],
        )
        self.q2 = QuestionIR(
            id="q_prod_2",
            number=2,
            source_number=2,
            stem="Polime nào sau đây được điều chế bằng phản ứng trùng hợp?",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Poli(etylen terephtalat)"),
                OptionIR(label="B", text="Poli(etylen)"),
                OptionIR(label="C", text="Nilon-6,6"),
                OptionIR(label="D", text="Tơ lapsan"),
            ],
        )
        self.doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Test Integrity", total_questions=2, created_at="2026-10-04T00:00:00Z"),
            questions=[self.q1, self.q2],
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_option_integrity_passes_when_all_options_on_same_page(self):
        pdf_path = os.path.join(self.temp_dir, "perfect_options.pdf")
        doc = pymupdf.open()
        p1 = doc.new_page(width=595.28, height=841.89)
        # Insert Câu 1 with A, B, C, D all on page 1
        p1.insert_text((50, 100), "Câu 1: Chất nào sau đây thuộc loại đisaccarit?", fontsize=10)
        p1.insert_text((50, 120), "A. Glucozơ   B. Saccarozơ   C. Fructozơ   D. Tinh bột", fontsize=9)

        # Insert Câu 2 with A, B, C, D also on page 1
        p1.insert_text((50, 180), "Câu 2: Polime nào sau đây được điều chế bằng phản ứng trùng hợp?", fontsize=10)
        p1.insert_text((50, 200), "A. Poli(etylen terephtalat)   B. Poli(etylen)   C. Nilon-6,6   D. Tơ lapsan", fontsize=9)

        doc.save(pdf_path)

        issues = verify_option_integrity(doc, self.doc_ir)
        doc.close()

        critical_issues = [i for i in issues if i.severity == QASeverity.CRITICAL]
        self.assertEqual(len(critical_issues), 0, f"Expected 0 critical issues, got: {critical_issues}")

    def test_reproduce_production_split_option_failure(self):
        """
        REPRODUCES THE EXACT PRODUCTION BUG:
        Câu 1 stem and options A, B, C are placed near the bottom of Page 1.
        Option D is detached and spills over to the top of Page 2 before Câu 2.
        Must be caught by verify_option_integrity as a CRITICAL SPLIT_QUESTION defect!
        """
        pdf_path = os.path.join(self.temp_dir, "production_split_bug.pdf")
        doc = pymupdf.open()

        # Page 1: Stem + A, B, C near the bottom
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 750), "Câu 1: Chất nào sau đây thuộc loại đisaccarit?", fontsize=10)
        p1.insert_text((50, 775), "A. Glucozơ   B. Saccarozơ   C. Fructozơ", fontsize=9)
        # Notice: Option D is MISSING from page 1!

        # Page 2: Option D detached at the very top, followed by Câu 2
        p2 = doc.new_page(width=595.28, height=841.89)
        p2.insert_text((50, 50), "D. Tinh bột", fontsize=9)
        p2.insert_text((50, 100), "Câu 2: Polime nào sau đây được điều chế bằng phản ứng trùng hợp?", fontsize=10)
        p2.insert_text((50, 120), "A. Poli(etylen terephtalat)   B. Poli(etylen)   C. Nilon-6,6   D. Tơ lapsan", fontsize=9)

        doc.save(pdf_path)

        issues = verify_option_integrity(doc, self.doc_ir)
        doc.close()

        # Must flag SPLIT_QUESTION on Question 1 for Option D
        split_issues = [i for i in issues if i.type == QAIssueType.SPLIT_QUESTION]
        self.assertGreater(len(split_issues), 0, "Failed to catch the detached split option D!")
        self.assertEqual(split_issues[0].severity, QASeverity.CRITICAL)
        self.assertIn("Question 1", split_issues[0].description)
        self.assertIn("option 'D'", split_issues[0].description)
        self.assertIn("q_prod_1", split_issues[0].description)

    def test_dropped_missing_option_detected(self):
        """
        Test case where option D is completely dropped/clipped (neither on page 1 nor page 2).
        Must be flagged as CRITICAL CARDINALITY_MISMATCH!
        """
        pdf_path = os.path.join(self.temp_dir, "dropped_option_bug.pdf")
        doc = pymupdf.open()

        # Page 1: Stem + A, B, C (D disappeared)
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 100), "Câu 1: Chất nào sau đây thuộc loại đisaccarit?", fontsize=10)
        p1.insert_text((50, 120), "A. Glucozơ   B. Saccarozơ   C. Fructozơ", fontsize=9)

        doc.save(pdf_path)

        issues = verify_option_integrity(doc, self.doc_ir)
        doc.close()

        cardinality_issues = [i for i in issues if i.type == QAIssueType.CARDINALITY_MISMATCH]
        self.assertGreater(len(cardinality_issues), 0, "Failed to catch dropped option D!")
        self.assertIn("option 'D'", cardinality_issues[0].description)


class TestValidatePdfGeometryIntegration(unittest.TestCase):
    """Test validate_pdf_geometry with doc_ir option integrity integration."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_val_geom_")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_validate_pdf_geometry_with_doc_ir_flags_split(self):
        pdf_path = os.path.join(self.temp_dir, "geom_split.pdf")
        doc = pymupdf.open()
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 750), "Câu 1: Tính chất hóa học đặc trưng của este là gì?", fontsize=10)
        p1.insert_text((50, 770), "A. Phản ứng tráng bạc.   B. Phản ứng khử.   C. Phản ứng oxi hóa.", fontsize=9)

        p2 = doc.new_page(width=595.28, height=841.89)
        p2.insert_text((50, 50), "D. Phản ứng thủy phân.", fontsize=9)
        doc.save(pdf_path)
        doc.close()

        q1 = QuestionIR(
            id="q_este_1",
            number=1,
            source_number=1,
            stem="Tính chất hóa học đặc trưng của este là gì?",
            type=SectionType.PART_I_MCQ,
            options=[
                OptionIR(label="A", text="Phản ứng tráng bạc."),
                OptionIR(label="B", text="Phản ứng khử."),
                OptionIR(label="C", text="Phản ứng oxi hóa."),
                OptionIR(label="D", text="Phản ứng thủy phân."),
            ],
        )
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Este Exam", total_questions=1, created_at="2026-10-04T00:00:00Z"),
            questions=[q1],
        )

        res = validate_pdf_geometry(pdf_path, doc_ir=doc_ir)
        self.assertEqual(res.status, "FAIL")
        self.assertFalse(res.is_pass())
        split_issues = [i for i in res.issues if i.type == QAIssueType.SPLIT_QUESTION]
        self.assertGreater(len(split_issues), 0)


if __name__ == "__main__":
    unittest.main()
