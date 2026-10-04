"""
Golden Regression Benchmark Test Suite: Reference Case 35..46.
Enforces the 8 invariant layers on the 12-question production reference test case:
- Questions 35 to 46 (Total 12 questions)
- Canonical number mapping: { source_question_number: 35, output_question_number: 35 }
- Question 41: Rich visual formula of Linoleic acid preserved, placed, and not black/blank in rendered PDF
- Question 46: Preserved options A, B, C, D (retaining Option D before '--- HẾT ---')
- Section header instruction dynamically displays "từ câu 35 đến câu 46"
- Intermediate HTML markup contains all options A, B, C, D and zero placeholders
- validate_final_pdf returns is_pass() == True
- Negative validation cases: catches missing Option D, black images, split questions, and placeholders
"""

import io
import os
import shutil
import tempfile
import unittest
import pymupdf
from PIL import Image, ImageStat

from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.orchestrator.state import JobStage
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.recognition.models import SmartRecognitionResult
from engines.quiz.reconstruction.models import (
    BatchReconstructionResult,
    ReconstructedQuestion,
    QuestionOption,
    QuestionType,
)
from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem
from engines.quiz.qa.models import OverallQAResult, QAIssueType
from engines.quiz.qa.final_validator import validate_final_pdf, validate_rendered_html
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    SectionIR,
    SectionType,
    QuestionIR,
    OptionIR,
    RichElementIR,
    AnswerKeyIR,
    PageIR,
    ProvenanceIR,
)
from engines.quiz.ir.validator import IRValidationError, validate_canonical_document_ir
from engines.quiz.assets.extractor import is_black_or_blank_image
from engines.quiz.tests.golden.fixture_builder import build_gf11_regression_linoleic


def _make_regression_mock_responder():
    """Generates mock responses simulating AI provider for Questions 35..46."""
    def responder(task_name: str, schema: type):
        if schema is SmartRecognitionResult:
            return SmartRecognitionResult(
                start_page=1,
                end_page=2,
                start_question=35,
                question_count=12,
                question_mode="custom",
                confidence=1.0,
            )

        if schema is BatchReconstructionResult:
            questions = []
            for i in range(35, 47):
                if i == 41:
                    stem = f"Câu {i}: Cho công thức cấu tạo của axit linoleic như hình vẽ bên. Công thức phân tử của axit linoleic là gì?"
                    options = [
                        QuestionOption(label="A", text="C18H32O2"),
                        QuestionOption(label="B", text="C18H34O2"),
                        QuestionOption(label="C", text="C18H30O2"),
                        QuestionOption(label="D", text="C16H32O2"),
                    ]
                elif i == 46:
                    stem = f"Câu {i}: Dung dịch chất nào sau đây làm quỳ tím chuyển sang màu đỏ?"
                    options = [
                        QuestionOption(label="A", text="C2H5OH"),
                        QuestionOption(label="B", text="CH3OCH3"),
                        QuestionOption(label="C", text="CH3CHO"),
                        QuestionOption(label="D", text="CH3COOH"),
                    ]
                else:
                    stem = f"Câu {i}: Hợp chất nào sau đây là este no, đơn chức, mạch hở?"
                    options = [
                        QuestionOption(label="A", text="CH3COOCH3"),
                        QuestionOption(label="B", text="C6H5COOCH3"),
                        QuestionOption(label="C", text="CH2=CHCOOCH3"),
                        QuestionOption(label="D", text="CH3COOH"),
                    ]
                questions.append(
                    ReconstructedQuestion(
                        id=f"q_{i}",
                        number=i,
                        source_number=i,
                        type=QuestionType.PART_I_MCQ,
                        stem=stem,
                        options=options,
                        source_pages=[1 if i <= 38 else 2],
                    )
                )
            return BatchReconstructionResult(
                batch_id=f"batch_recon_{task_name}",
                questions=questions,
            )

        if schema is BatchAnswerResult:
            answers = []
            for i in range(35, 47):
                answers.append(
                    QuestionAnswerItem(
                        question_id=f"q_{i}",
                        question_number=i,
                        selected_answer="A" if i != 46 else "D",
                        evidence=f"CH3COOH là axit axetic làm quỳ tím hóa đỏ (câu {i}).",
                    )
                )
            return BatchAnswerResult(
                batch_id=f"batch_ans_{task_name}",
                answers=answers,
            )

        if schema is OverallQAResult:
            return OverallQAResult(
                passed=True,
                page_count=2,
                split_questions_count=0,
                score=1.0,
            )

        return None
    return responder


class TestGoldenRegression35To46(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_dir = tempfile.mkdtemp(prefix="golden_regression_35_46_")
        cls.fixture_pdf = os.path.join(cls.test_dir, "gf11_regression.pdf")
        cls.meta = build_gf11_regression_linoleic(cls.fixture_pdf)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.test_dir, ignore_errors=True)

    def test_fixture_integrity(self):
        """Verifies synthetic reference PDF has 2 pages and contains Linoleic image."""
        doc = pymupdf.open(self.fixture_pdf)
        self.assertEqual(len(doc), 2)
        p1_text = doc[0].get_text()
        p2_text = doc[1].get_text()
        self.assertIn("Câu 31", p1_text)
        self.assertIn("Câu 38", p1_text)
        self.assertIn("Câu 39", p2_text)
        self.assertIn("Câu 41", p2_text)
        self.assertIn("Câu 46", p2_text)
        # Check end mark presence in raw fixture text
        self.assertTrue(
            any(m in p2_text for m in ("--- HẾT ---", "--- HÊT ---", "--- HT ---", "--- HET ---")),
            f"End marker not found in fixture page 2 text: {p2_text[-50:]}",
        )

        # Page 2 must have an embedded image for Linoleic acid
        images_p2 = doc[1].get_images()
        self.assertGreaterEqual(len(images_p2), 1)
        doc.close()

    def test_end_to_end_pipeline_reference_case_35_to_46(self):
        """
        Executes QuizPipelineOrchestrator end-to-end on GF-11-REG fixture
        with user instruction 'Từ câu 35 lấy 12 câu'.
        Asserts all invariant layers.
        """
        out_dir = os.path.join(self.test_dir, "pipeline_out")
        provider = MockAIProvider(preset_response=_make_regression_mock_responder())
        orchestrator = QuizPipelineOrchestrator(provider=provider, max_repair_iterations=1)

        state = orchestrator.run(
            pdf_path=self.fixture_pdf,
            user_instruction="Từ câu 35 lấy 12 câu",
            output_dir=out_dir,
            prefix="REG_35_46",
        )

        # 1. Pipeline Completion Invariant
        self.assertEqual(state.current_stage, JobStage.COMPLETED)
        self.assertIsNone(state.error)

        debai_pdf = state.artifacts.get("debai_pdf")
        dapan_pdf = state.artifacts.get("dapan_pdf")
        debai_html = state.artifacts.get("debai_html")
        dapan_html = state.artifacts.get("dapan_html")
        self.assertTrue(os.path.isfile(debai_pdf), f"Missing DeBai PDF: {debai_pdf}")
        self.assertTrue(os.path.isfile(dapan_pdf), f"Missing DapAn PDF: {dapan_pdf}")
        self.assertTrue(os.path.isfile(debai_html), f"Missing DeBai HTML: {debai_html}")
        self.assertTrue(os.path.isfile(dapan_html), f"Missing DapAn HTML: {dapan_html}")
        self.assertGreater(os.path.getsize(debai_pdf), 1024)
        self.assertGreater(os.path.getsize(dapan_pdf), 1024)

        # 2. Inspect DeBai PDF Text and Structure
        debai_doc = pymupdf.open(debai_pdf)
        self.assertGreaterEqual(len(debai_doc), 1)
        full_text = "\n\n".join(p.get_text() for p in debai_doc)

        # 3. Question Count and Numbering Invariant (Exactly 35..46)
        for q_num in range(35, 47):
            self.assertIn(f"Câu {q_num}:", full_text, f"Missing Question {q_num} header in output PDF")
        # Ensure questions outside range are NOT present
        self.assertNotIn("Câu 31:", full_text)
        self.assertNotIn("Câu 34:", full_text)
        self.assertNotIn("Câu 47:", full_text)

        # 4. Dynamic Section Header Instruction Invariant
        self.assertIn(
            "từ câu 35 đến câu 46",
            full_text,
            "Header instruction must dynamically reflect bounds 'từ câu 35 đến câu 46'",
        )
        self.assertNotIn("đến câu N", full_text, "Found unresolved 'N' placeholder in header")
        self.assertNotIn("câu 1 đến câu 12", full_text, "Header should not falsely state 'từ câu 1 đến câu 12'")

        # 5. Question 41 Rich Visual Asset Invariant (PDF and Rendered Page)
        q41_page_idx = -1
        for p_idx, page in enumerate(debai_doc):
            if "Câu 41:" in page.get_text():
                q41_page_idx = p_idx
                break
        self.assertGreaterEqual(q41_page_idx, 0, "Question 41 not found on any page of DeBai PDF")

        # Verify image exists directly inside the compiled PDF page
        q41_page = debai_doc[q41_page_idx]
        q41_page_imgs = q41_page.get_images()
        self.assertGreaterEqual(len(q41_page_imgs), 1, "Question 41 page in final PDF must contain embedded image")

        # Verify extracted PDF image bytes: valid, non-zero, not black/blank
        xref = q41_page_imgs[0][0]
        extracted_dict = debai_doc.extract_image(xref)
        self.assertGreater(len(extracted_dict["image"]), 100)
        self.assertGreater(extracted_dict["width"], 20)
        self.assertGreater(extracted_dict["height"], 20)

        with Image.open(io.BytesIO(extracted_dict["image"])) as im:
            rgb = im.convert("RGB")
            stat = ImageStat.Stat(rgb)
            mean_lum = sum(stat.mean) / 3.0
            var_lum = sum(stat.var) / 3.0
            self.assertGreater(mean_lum, 15.0, "Rendered PDF image must not be solid black")
            self.assertGreater(var_lum, 1.0, "Rendered PDF image must contain visual variance (line art)")

        debai_doc.close()

        # 6. Question 46 Option D Invariant
        self.assertIn("D. CH3COOH", full_text, "Question 46 must retain Option D before end of document")

        # 7. DapAn PDF Matrix and Pedagogical Solutions Invariant
        dapan_doc = pymupdf.open(dapan_pdf)
        dapan_text = "\n\n".join(p.get_text() for p in dapan_doc)
        dapan_doc.close()
        for q_num in range(35, 47):
            self.assertIn(str(q_num), dapan_text, f"Question {q_num} missing from answer key document")

        # 8. Canonical 1:1 IR Mapping Invariant
        doc_ir = state.artifacts.get("doc_ir")
        self.assertIsNotNone(doc_ir)
        self.assertEqual(len(doc_ir.questions), 12)
        for idx, q in enumerate(doc_ir.questions):
            expected_q_num = 35 + idx
            self.assertEqual(q.number, expected_q_num)
            self.assertEqual(q.source_number, expected_q_num)
            canonical_mapping = {
                "source_question_number": q.source_question_number or q.source_number,
                "output_question_number": q.output_question_number or q.number,
            }
            self.assertEqual(canonical_mapping["source_question_number"], expected_q_num)
            self.assertEqual(canonical_mapping["output_question_number"], expected_q_num)

        # 9. Intermediate HTML Validation Layer Invariant
        html_issues = validate_rendered_html(debai_html, doc_ir)
        self.assertEqual(html_issues, [], f"Worksheet HTML validation failed: {html_issues}")

        # 10. Question 41 IR Rich Elements
        q41 = next(q for q in doc_ir.questions if q.number == 41)
        self.assertGreaterEqual(len(q41.rich_elements), 1, "Question 41 must have rich element in IR")
        self.assertTrue(os.path.isfile(q41.rich_elements[0].source_crop_path))
        self.assertFalse(is_black_or_blank_image(q41.rich_elements[0].source_crop_path))

        # 11. Question 46 IR Options
        q46 = next(q for q in doc_ir.questions if q.number == 46)
        self.assertEqual(len(q46.options), 4)
        opt_d = next(opt for opt in q46.options if opt.label == "D")
        self.assertEqual(opt_d.text, "CH3COOH")

        # 12. Visual Pixmap Rendering Invariant (No visual corruption or crash)
        debai_doc = pymupdf.open(debai_pdf)
        for p in debai_doc:
            pix = p.get_pixmap(dpi=150)
            self.assertGreater(pix.width, 100)
            self.assertGreater(pix.height, 100)
        debai_doc.close()

        # 13. Deterministic 8-Level QA Gate Invariant
        val_result = validate_final_pdf(debai_pdf, doc_ir=doc_ir, dapan_pdf_path=dapan_pdf)
        self.assertTrue(val_result.is_pass(), f"Final QA validation failed with issues: {val_result.issues}")
        self.assertTrue(val_result.is_document_valid)
        self.assertTrue(val_result.is_question_valid)
        self.assertTrue(val_result.is_option_valid)
        self.assertTrue(val_result.is_asset_valid)
        self.assertTrue(val_result.is_layout_valid)
        self.assertTrue(val_result.is_template_valid)
        self.assertTrue(val_result.is_html_valid)
        self.assertTrue(val_result.is_dapan_valid)

    def test_validation_rejects_missing_option_d_in_ir(self):
        """Verifies that validate_canonical_document_ir strictly rejects any question missing Option D."""
        q = QuestionIR(
            id="q_test_missing_d",
            number=46,
            source_number=46,
            type=SectionType.PART_I_MCQ,
            stem="Dung dịch chất nào làm quỳ tím chuyển màu đỏ?",
            options=[
                OptionIR(label="A", text="C2H5OH"),
                OptionIR(label="B", text="CH3OCH3"),
                OptionIR(label="C", text="CH3CHO"),
            ],
            provenance=ProvenanceIR(source_pages=[1]),
        )
        sec = SectionIR(
            id="sec_test",
            title="PHẦN I",
            type=SectionType.PART_I_MCQ,
            question_ids=["q_test_missing_d"],
        )
        ans = AnswerKeyIR(
            question_id="q_test_missing_d",
            question_number=46,
            type=SectionType.PART_I_MCQ,
            selected_answer="A",
            evidence="Giải thích.",
        )
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Test", total_questions=1, created_at="2026-10-04T12:00:00Z"),
            pages=[PageIR(page_number=1, width=595.0, height=842.0)],
            sections=[sec],
            questions=[q],
            answers=[ans],
        )

        with self.assertRaises(IRValidationError) as ctx:
            validate_canonical_document_ir(doc_ir)
        self.assertIn("missing option", str(ctx.exception).lower())

    def test_validation_rejects_unresolved_placeholder_in_pdf(self):
        """Verifies that validate_final_pdf detects unresolved 'N' placeholders in PDF text."""
        test_pdf = os.path.join(self.test_dir, "test_placeholder.pdf")
        doc = pymupdf.open()
        p = doc.new_page(width=595.28, height=841.89)
        p.insert_text((50, 50), "PHẦN I. Thí sinh trả lời từ câu 1 đến câu N.")
        p.insert_text((50, 80), "Câu 35: Este nào sau đây no?")
        p.insert_text((50, 100), "A. CH3COOCH3   B. C2H5OH   C. CH3CHO   D. CH3COOH")
        doc.save(test_pdf)
        doc.close()

        q = QuestionIR(
            id="q_35",
            number=35,
            source_number=35,
            type=SectionType.PART_I_MCQ,
            stem="Este nào sau đây no?",
            options=[
                OptionIR(label="A", text="CH3COOCH3"),
                OptionIR(label="B", text="C2H5OH"),
                OptionIR(label="C", text="CH3CHO"),
                OptionIR(label="D", text="CH3COOH"),
            ],
            source_question_number=35,
            output_question_number=35,
        )
        sec = SectionIR(id="sec_1", title="PHẦN I", type=SectionType.PART_I_MCQ, question_ids=["q_35"])
        ans = AnswerKeyIR(question_id="q_35", question_number=35, selected_answer="A")
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Test", total_questions=1, created_at="2026-10-04T12:00:00Z"),
            pages=[PageIR(page_number=1, width=595.28, height=841.89)],
            sections=[sec],
            questions=[q],
            answers=[ans],
        )

        res = validate_final_pdf(test_pdf, doc_ir=doc_ir)
        self.assertFalse(res.is_pass())
        self.assertFalse(res.is_template_valid)
        self.assertTrue(any("placeholder" in i.description.lower() for i in res.issues))

    def test_validation_handles_split_question_without_crashing(self):
        """
        Verifies that when a question has an option on the next page,
        validate_final_pdf correctly identifies SPLIT_QUESTION without NameError.
        """
        test_pdf = os.path.join(self.test_dir, "test_split.pdf")
        doc = pymupdf.open()
        # Page 1: Stem and Options A, B, C
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 50), "Câu 35: Este nào sau đây no, đơn chức, mạch hở?")
        p1.insert_text((50, 80), "A. CH3COOCH3")
        p1.insert_text((50, 100), "B. C6H5COOCH3")
        p1.insert_text((50, 120), "C. CH2=CHCOOCH3")
        # Page 2: Option D
        p2 = doc.new_page(width=595.28, height=841.89)
        p2.insert_text((50, 50), "D. CH3COOH")
        doc.save(test_pdf)
        doc.close()

        q = QuestionIR(
            id="q_35",
            number=35,
            source_number=35,
            type=SectionType.PART_I_MCQ,
            stem="Este nào sau đây no, đơn chức, mạch hở?",
            options=[
                OptionIR(label="A", text="CH3COOCH3"),
                OptionIR(label="B", text="C6H5COOCH3"),
                OptionIR(label="C", text="CH2=CHCOOCH3"),
                OptionIR(label="D", text="CH3COOH"),
            ],
            source_question_number=35,
            output_question_number=35,
        )
        sec = SectionIR(id="sec_1", title="PHẦN I", type=SectionType.PART_I_MCQ, question_ids=["q_35"])
        ans = AnswerKeyIR(question_id="q_35", question_number=35, selected_answer="A")
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Test", total_questions=1, created_at="2026-10-04T12:00:00Z"),
            pages=[
                PageIR(page_number=1, width=595.28, height=841.89),
                PageIR(page_number=2, width=595.28, height=841.89),
            ],
            sections=[sec],
            questions=[q],
            answers=[ans],
        )

        res = validate_final_pdf(test_pdf, doc_ir=doc_ir)
        # Should detect SPLIT_QUESTION cleanly without throwing NameError
        split_issues = [i for i in res.issues if i.type == QAIssueType.SPLIT_QUESTION]
        self.assertGreaterEqual(len(split_issues), 1)
        self.assertIn("split onto page 2", split_issues[0].description)

    def test_html_validation_detects_missing_option_and_placeholder(self):
        """Verifies validate_rendered_html catches missing option and unresolved placeholders."""
        html_file = os.path.join(self.test_dir, "test_invalid.html")
        # HTML missing option D and containing placeholder 'đến câu N'
        with open(html_file, "w", encoding="utf-8") as f:
            f.write("""<!DOCTYPE html>
            <html><body>
            <div class="section-instruction">Thí sinh trả lời đến câu N.</div>
            <div class="q-header"><span class="q-number">Câu 35:</span></div>
            <div class="opt-item"><span class="opt-letter">A.</span> Ancol</div>
            <div class="opt-item"><span class="opt-letter">B.</span> Este</div>
            <div class="opt-item"><span class="opt-letter">C.</span> Axit</div>
            </body></html>""")

        q = QuestionIR(
            id="q_35",
            number=35,
            source_number=35,
            type=SectionType.PART_I_MCQ,
            stem="Hợp chất nào?",
            options=[
                OptionIR(label="A", text="Ancol"),
                OptionIR(label="B", text="Este"),
                OptionIR(label="C", text="Axit"),
                OptionIR(label="D", text="Andehit"),
            ],
            source_question_number=35,
            output_question_number=35,
        )
        sec = SectionIR(id="sec_1", title="PHẦN I", type=SectionType.PART_I_MCQ, question_ids=["q_35"])
        ans = AnswerKeyIR(question_id="q_35", question_number=35, selected_answer="A")
        doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(title="Test", total_questions=1, created_at="2026-10-04T12:00:00Z"),
            pages=[PageIR(page_number=1, width=595.28, height=841.89)],
            sections=[sec],
            questions=[q],
            answers=[ans],
        )

        issues = validate_rendered_html(html_file, doc_ir)
        self.assertGreaterEqual(len(issues), 2)
        desc_list = [i.description for i in issues]
        self.assertTrue(any("missing option 'D'" in d for d in desc_list))
        self.assertTrue(any("placeholder" in d.lower() for d in desc_list))


if __name__ == "__main__":
    unittest.main()

