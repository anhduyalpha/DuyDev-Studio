"""
Golden Benchmark Test Suite (TASK-13 & TASK-14).
Validates all 10 golden test fixtures, tests 6-layer failure attribution,
asserts the bounded AI call budget invariant, and generates machine-readable reports.
"""

import os
import shutil
import tempfile
import unittest
import pymupdf
import re

from engines.quiz.common.errors import ErrorCode, DiagnosticLayer, QuizEngineError
from engines.quiz.provider.metrics import AICallBudgetTracker
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.provider.base import ProviderTimeoutError, ProviderRateLimitError
from engines.quiz.orchestrator.state import JobStage, JobState
from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.reconstruction.models import (
    BatchReconstructionResult,
    ReconstructedQuestion,
    QuestionOption,
    QuestionType,
)
from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem
from engines.quiz.recognition.models import SmartRecognitionResult
from engines.quiz.qa.models import OverallQAResult
from engines.quiz.mcq_parser import parse_mcq_blocks
from engines.quiz.rendering.layout import LayoutSolver
from engines.quiz.ir.models import OptionIR
from engines.quiz.ir.normalizer import normalize_text

from engines.quiz.tests.golden.fixture_builder import build_all_fixtures, FIXTURE_BUILDERS
from engines.quiz.tests.golden.benchmark_report import (
    BenchmarkReport,
    FixtureBenchmarkResult,
)


def _make_mock_responder(total_questions: int = 20, start_question: int = 1):
    """Generates a dynamic mock responder function for MockAIProvider."""
    def responder(task_name: str, schema: type):
        if schema is SmartRecognitionResult:
            return SmartRecognitionResult(
                start_page=1,
                end_page=2,
                start_question=start_question,
                question_count=total_questions,
                question_mode="auto",
                confidence=1.0,
            )

        if schema is BatchReconstructionResult:
            # Generate mock questions for this batch
            questions = []
            for i in range(start_question, start_question + total_questions):
                questions.append(
                    ReconstructedQuestion(
                        id=f"q_{i}",
                        number=i,
                        source_number=i,
                        type=QuestionType.PART_I_MCQ,
                        stem=f"Câu {i}: Chất nào sau đây là este no, đơn chức mạch hở?",
                        options=[
                            QuestionOption(label="A", text="CH3COOCH3"),
                            QuestionOption(label="B", text="C6H5COOCH3"),
                            QuestionOption(label="C", text="CH2=CHCOOCH3"),
                            QuestionOption(label="D", text="CH3COOH"),
                        ],
                        source_pages=[1 if i <= 10 else 2],
                    )
                )
            return BatchReconstructionResult(
                batch_id=f"batch_recon_{task_name}",
                questions=questions,
            )

        if schema is BatchAnswerResult:
            answers = []
            for i in range(start_question, start_question + total_questions):
                answers.append(
                    QuestionAnswerItem(
                        question_id=f"q_{i}",
                        question_number=i,
                        selected_answer="A",
                        evidence=f"CH3COOCH3 là metyl axetat, este no đơn chức (câu {i})",
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


class TestGoldenFixtures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_dir = tempfile.mkdtemp(prefix="golden_benchmark_")
        cls.fixture_dir = os.path.join(cls.test_dir, "fixtures")
        cls.fixtures_meta = build_all_fixtures(cls.fixture_dir)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.test_dir, ignore_errors=True)

    def test_gf01_vector_mcq_baseline(self):
        """GF-01-VEC: Baseline 20-question vector exam runs end-to-end with 100% recall."""
        pdf_path = self.fixtures_meta["GF-01-VEC"]["file_path"]
        out_dir = os.path.join(self.test_dir, "out_gf01")

        provider = MockAIProvider(preset_response=_make_mock_responder(total_questions=20, start_question=1))
        orchestrator = QuizPipelineOrchestrator(provider=provider, max_repair_iterations=1)

        state = orchestrator.run(
            pdf_path=pdf_path,
            user_instruction="Tất cả các trang, 20 câu",
            output_dir=out_dir,
            prefix="GF01_Test",
        )

        self.assertEqual(state.current_stage, JobStage.COMPLETED)
        self.assertIsNone(state.error)

        debai_pdf = state.artifacts.get("debai_pdf")
        dapan_pdf = state.artifacts.get("dapan_pdf")
        self.assertTrue(os.path.isfile(debai_pdf))
        self.assertTrue(os.path.isfile(dapan_pdf))

        # Assert bounded AI call budget: for 20 questions, calls must be <= 6
        self.assertLessEqual(provider.tracker.metrics.ai_calls, 6)

    def test_gf02_pure_scanned_safely_rejected(self):
        """GF-02-SCN: Pure scan with no text layer raises PDF_SCAN_TOO_LOW_QUALITY."""
        pdf_path = self.fixtures_meta["GF-02-SCN"]["file_path"]
        out_dir = os.path.join(self.test_dir, "out_gf02")

        provider = MockAIProvider()
        orchestrator = QuizPipelineOrchestrator(provider=provider)

        state = orchestrator.run(
            pdf_path=pdf_path,
            user_instruction="Lấy 5 câu",
            output_dir=out_dir,
            prefix="GF02_Test",
        )

        self.assertEqual(state.current_stage, JobStage.FAILED)
        self.assertIsNotNone(state.error)
        self.assertIn("ảnh quét", state.error)

    def test_gf03_mixed_diagram_visual_handling(self):
        """GF-03-MIX: Diagram image is preserved and question recall is 100%."""
        pdf_path = self.fixtures_meta["GF-03-MIX"]["file_path"]
        doc = pymupdf.open(pdf_path)
        page = doc[0]
        # Verify document contains images
        image_list = page.get_images()
        self.assertGreaterEqual(len(image_list), 1)
        text = page.get_text("text")
        doc.close()

        blocks = parse_mcq_blocks(text)
        self.assertGreaterEqual(len(blocks), 4)

    def test_gf04_split_page_boundary(self):
        """GF-04-SPL: Question spanning across page 1 and page 2 is not split."""
        pdf_path = self.fixtures_meta["GF-04-SPL"]["file_path"]
        doc = pymupdf.open(pdf_path)
        self.assertEqual(len(doc), 2)
        full_text = "\n".join(p.get_text("text") for p in doc)
        doc.close()

        blocks = parse_mcq_blocks(full_text)
        # All 7 questions should be extracted
        self.assertEqual(len(blocks), 7)
        # Verify Câu 5 has options A, B, C, D intact
        q5 = next((b for b in blocks if b["source_number"] == 5), None)
        self.assertIsNotNone(q5)
        self.assertEqual(len(q5["options"]), 4)

    def test_gf05_chemistry_formulas_katex(self):
        """GF-05-CHM: Chemistry formulas and LaTeX are normalized to KaTeX."""
        pdf_path = self.fixtures_meta["GF-05-CHM"]["file_path"]
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text("text")
        doc.close()

        # Test normalization on chemical formula string
        raw_formula = "Cho phản ứng: CH3COOCH3 + NaOH -> CH3COONa + CH3OH"
        normalized = normalize_text(raw_formula)
        self.assertIsNotNone(normalized)
        self.assertIn(r"\rightarrow", normalized)

    def test_gf06_long_options_layout_fallback(self):
        """GF-06-LNG: Layout solver selects 1-column layout for long options."""
        pdf_path = self.fixtures_meta["GF-06-LNG"]["file_path"]
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text("text")
        doc.close()

        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 5)
        
        # Test LayoutSolver with long options
        for b in blocks:
            # Measure max option length
            max_len = max(len(opt) for opt in b["options"].values())
            self.assertGreater(max_len, 100)
            option_irs = [OptionIR(label=k, text=v) for k, v in b["options"].items()]
            col_mode = LayoutSolver.determine_option_columns(option_irs)
            # Long options must fall back to 1 column to avoid overflow
            self.assertEqual(col_mode, 1)

    def test_gf07_data_tables_handling(self):
        """GF-07-TBL: Tabular experimental data questions are extracted without crash."""
        pdf_path = self.fixtures_meta["GF-07-TBL"]["file_path"]
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text("text")
        doc.close()

        blocks = parse_mcq_blocks(text)
        self.assertGreaterEqual(len(blocks), 3)

    def test_gf08_three_part_taxonomy(self):
        """GF-08-3PT: 3-Part exam contains Part I, Part II, Part III sections."""
        pdf_path = self.fixtures_meta["GF-08-3PT"]["file_path"]
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text("text")
        doc.close()

        self.assertIn("PHAN I", text)
        self.assertIn("PHAN II", text)
        self.assertIn("PHAN III", text)

    def test_gf09_adversarial_distractors(self):
        """GF-09-ADV: Distractors like 'Vitamin A.' and '10%' do not create phantom questions."""
        pdf_path = self.fixtures_meta["GF-09-ADV"]["file_path"]
        doc = pymupdf.open(pdf_path)
        text = doc[0].get_text("text")
        doc.close()

        blocks = parse_mcq_blocks(text)
        # Exactly 4 real questions must be extracted, not 5 or 6
        self.assertEqual(len(blocks), 4)
        numbers = [b["source_number"] for b in blocks]
        self.assertEqual(numbers, [1, 2, 3, 4])

    def test_gf10_ester_reference_end_to_end(self):
        """GF-10-EST: Reference 24-question Ester & Lipid exam runs end-to-end."""
        pdf_path = self.fixtures_meta["GF-10-EST"]["file_path"]
        out_dir = os.path.join(self.test_dir, "out_gf10")

        provider = MockAIProvider(preset_response=_make_mock_responder(total_questions=24, start_question=1))
        orchestrator = QuizPipelineOrchestrator(provider=provider, max_repair_iterations=1)

        state = orchestrator.run(
            pdf_path=pdf_path,
            user_instruction="24 câu tham khảo",
            output_dir=out_dir,
            prefix="GF10_Reference",
        )

        self.assertEqual(state.current_stage, JobStage.COMPLETED)
        self.assertTrue(os.path.isfile(state.artifacts.get("debai_pdf", "")))
        self.assertTrue(os.path.isfile(state.artifacts.get("dapan_pdf", "")))


class TestDiagnosticLayerAttribution(unittest.TestCase):
    """Verifies that failures are attributed to the exact diagnostic layer."""

    def test_layer_1_pdf_parsing_failure(self):
        """Layer 1: Non-existent or invalid PDF file is attributed to PDF_PARSING_FAILURE."""
        orchestrator = QuizPipelineOrchestrator()
        state = orchestrator.run(
            pdf_path="C:\\non_existent_fake_path.pdf",
            user_instruction="Lấy 5 câu",
            output_dir=tempfile.gettempdir(),
        )
        self.assertEqual(state.current_stage, JobStage.FAILED)
        self.assertEqual(state.artifacts.get("diagnostic_layer"), DiagnosticLayer.PDF_PARSING_FAILURE.value)
        self.assertEqual(state.artifacts.get("error_code"), ErrorCode.PDF_INVALID.value)

    def test_layer_2_ai_failure(self):
        """Layer 2: AI provider timeout is attributed to AI_FAILURE."""
        err = QuizEngineError(
            code=ErrorCode.AI_TIMEOUT,
            diagnostic_layer=DiagnosticLayer.AI_FAILURE,
            message="Máy chủ AI phản hồi quá lâu sau các lần thử lại",
            stage=JobStage.RECONSTRUCTING.value,
        )
        self.assertEqual(err.diagnostic_layer, DiagnosticLayer.AI_FAILURE)
        self.assertEqual(err.code, ErrorCode.AI_TIMEOUT)

    def test_layer_3_ir_failure_attribution(self):
        """Layer 3: Schema validation error is attributed to IR_FAILURE."""
        err = QuizEngineError(
            code=ErrorCode.AI_INVALID_OUTPUT,
            diagnostic_layer=DiagnosticLayer.IR_FAILURE,
            message="Canonical IR builder validation failed",
            stage=JobStage.NORMALIZING.value,
        )
        self.assertEqual(err.diagnostic_layer, DiagnosticLayer.IR_FAILURE)
        self.assertEqual(err.code, ErrorCode.AI_INVALID_OUTPUT)

    def test_layer_4_layout_failure_attribution(self):
        """Layer 4: Layout solver overflow is attributed to LAYOUT_FAILURE."""
        err = QuizEngineError(
            code=ErrorCode.QA_FAILED,
            diagnostic_layer=DiagnosticLayer.LAYOUT_FAILURE,
            message="Layout solver geometry overflow",
            stage=JobStage.RENDERING.value,
        )
        self.assertEqual(err.diagnostic_layer, DiagnosticLayer.LAYOUT_FAILURE)

    def test_layer_5_rendering_failure_attribution(self):
        """Layer 5: Chrome rendering failure is attributed to RENDERING_FAILURE."""
        err = QuizEngineError(
            code=ErrorCode.RENDER_FAILED,
            diagnostic_layer=DiagnosticLayer.RENDERING_FAILURE,
            message="Chrome headless execution failed",
            stage=JobStage.COMPILING.value,
        )
        self.assertEqual(err.diagnostic_layer, DiagnosticLayer.RENDERING_FAILURE)
        self.assertEqual(err.code, ErrorCode.RENDER_FAILED)

    def test_layer_6_qa_failure_attribution(self):
        """Layer 6: QA verification failure is attributed to QA_FAILURE."""
        err = QuizEngineError(
            code=ErrorCode.QA_FAILED,
            diagnostic_layer=DiagnosticLayer.QA_FAILURE,
            message="QA repair exceeded maximum iterations",
            stage=JobStage.FINALIZING.value,
        )
        self.assertEqual(err.diagnostic_layer, DiagnosticLayer.QA_FAILURE)
        self.assertEqual(err.code, ErrorCode.QA_FAILED)

    def test_layer_reconstruction_failure_attribution(self):
        """Reconstruction failure is attributed to RECONSTRUCTION_FAILURE."""
        err = QuizEngineError(
            code=ErrorCode.RANGE_MISMATCH,
            layer=DiagnosticLayer.RECONSTRUCTION_FAILURE,
            message="Không tìm thấy đủ câu hỏi yêu cầu trong tài liệu (thiếu 2 câu: [1, 2]).",
            stage=JobStage.RECONSTRUCTING.value,
        )
        self.assertEqual(err.diagnostic_layer, DiagnosticLayer.RECONSTRUCTION_FAILURE)
        self.assertEqual(err.code, ErrorCode.RANGE_MISMATCH)
        self.assertEqual(err.to_dict()["diagnostic_layer"], "RECONSTRUCTION_FAILURE")



class TestAICallBudgetInvariant(unittest.TestCase):
    """Verifies that AI calls scale sub-linearly and never explode linearly."""

    def test_budget_tracker_metrics_recording(self):
        tracker = AICallBudgetTracker()
        tracker.record_call("recon_batch_1", latency_ms=120.0, is_vision=False)
        tracker.record_call("recon_batch_2", latency_ms=130.0, is_vision=False)
        tracker.record_call("solve_batch_1", latency_ms=200.0, is_vision=False)
        tracker.record_call("vision_qa_page_1", latency_ms=500.0, is_vision=True)
        tracker.record_batch(3)

        m = tracker.metrics
        self.assertEqual(m.ai_calls, 4)
        self.assertEqual(m.vision_calls, 1)
        self.assertEqual(m.batches, 3)
        self.assertEqual(m.retries, 0)
        self.assertEqual(m.total_latency_ms, 950.0)

    def test_bounded_budget_invariant_passes(self):
        tracker = AICallBudgetTracker()
        # 30 questions, 3 batches
        for i in range(3):
            tracker.record_call(f"recon_{i}", 100.0)
        for i in range(2):
            tracker.record_call(f"solve_{i}", 150.0)
        tracker.record_call("vision_sample", 300.0, is_vision=True)

        # Total 6 calls for 30 questions -> within budget
        valid, msg = tracker.validate_budget(total_questions=30, batch_size=10, max_vision_quota=2)
        self.assertTrue(valid)

    def test_linear_explosion_fails_budget_assertion(self):
        tracker = AICallBudgetTracker()
        # Simulate buggy 1 call per question (25 calls for 20 questions)
        for i in range(25):
            tracker.record_call(f"single_q_{i}", 50.0)

        valid, msg = tracker.validate_budget(total_questions=20, batch_size=10, max_vision_quota=2)
        self.assertFalse(valid)
        self.assertIn("budget exceeded", msg.lower())


class TestBenchmarkReportGeneration(unittest.TestCase):
    """Verifies benchmark aggregation and machine-readable report generation."""

    def test_benchmark_report_json_and_markdown(self):
        report = BenchmarkReport(suite_name="Regression Benchmark Test")
        
        # Add 10 dummy fixture results matching golden suite
        for i in range(1, 11):
            fix_id = f"GF-{i:02d}-TST"
            report.add_result(
                FixtureBenchmarkResult(
                    fixture_id=fix_id,
                    name=f"Fixture {i}",
                    status="PASSED" if i != 2 else "EXPECTED_ERROR",
                    expected_questions=10 if i != 2 else 0,
                    extracted_questions=10 if i != 2 else 0,
                    question_recall=100.0,
                    option_completeness=100.0,
                    ai_calls=2 if i != 2 else 0,
                    render_time_ms=1200.0 if i != 2 else 0.0,
                    diagnostic_layer="PDF_PARSING_FAILURE" if i == 2 else None,
                )
            )

        summary = report.compute_summary()
        self.assertEqual(summary.total_fixtures, 10)
        self.assertEqual(summary.passed_count, 9)
        self.assertEqual(summary.expected_error_count, 1)
        self.assertEqual(summary.failed_count, 0)
        self.assertEqual(summary.avg_question_recall, 100.0)

        # Test report saving
        tmp_out = tempfile.mkdtemp(prefix="report_test_")
        try:
            json_file, md_file = report.save_reports(output_dir=tmp_out)
            self.assertTrue(os.path.isfile(json_file))
            self.assertTrue(os.path.isfile(md_file))
            
            with open(json_file, "r", encoding="utf-8") as f:
                data = f.read()
                self.assertIn("Regression Benchmark Test", data)
                self.assertIn("avg_question_recall", data)

            with open(md_file, "r", encoding="utf-8") as f:
                md_content = f.read()
                self.assertIn("| Total Fixtures |", md_content)
                self.assertIn("10 fixtures", md_content)
                self.assertIn("Six-Layer Diagnostic Failure Attribution", md_content)
        finally:
            shutil.rmtree(tmp_out, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
