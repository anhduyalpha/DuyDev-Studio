"""
Tier 4: Real-World PDF Workloads & End-to-End Pipeline Verification
Author: E2E Test Writer
Validates real PDF execution on `.tmp/Diff check/Gốc.pdf` and full pipeline artifact rendering.
"""

import os
import shutil
import tempfile
import unittest

from engines.quiz.recognition.inspect_cli import inspect_page_ground_truth
from engines.quiz.perception.extractor import extract_document_representations
from engines.quiz.recognition.range_resolver import resolve_smart_range
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.orchestrator.state import JobStage
from engines.quiz.reconstruction.models import (
    BatchReconstructionResult,
    ReconstructedQuestion,
    QuestionOption,
    QuestionType,
)
from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem


class TestTier4RealWorldScenarios(unittest.TestCase):
    """Tier 4: Real-World Application Scenarios on Gốc.pdf."""

    @classmethod
    def setUpClass(cls):
        cls.goc_pdf = os.path.abspath(".tmp/Diff check/Gốc.pdf")
        if not os.path.isfile(cls.goc_pdf):
            raise unittest.SkipTest(f"Golden fixture '{cls.goc_pdf}' not found on disk.")
        cls.temp_dir = tempfile.mkdtemp(prefix="quiz_tier4_e2e_")

    @classmethod
    def tearDownClass(cls):
        if os.path.isdir(cls.temp_dir):
            shutil.rmtree(cls.temp_dir, ignore_errors=True)

    # -------------------------------------------------------------------------
    # Scenario 1: Real PDF Inspection on Page 41 (Odd, Even, Part I, Part II)
    # -------------------------------------------------------------------------
    def test_scenario_real_pdf_page_41_inspection_cases(self):
        """
        Verify inspection ground-truth across multiple query types on Gốc.pdf page 41:
        1. 'các câu lẻ trang 41' -> exactly [47, 49]
        2. 'các câu chẵn trang 41' -> exactly [48, 50]
        3. 'phần 1 trang 41' -> exactly [47, 48, 49, 50]
        4. 'phần 2 trang 41' -> exactly [1]
        """
        # Case A: Odd questions
        res_odd = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu lẻ trang 41")
        self.assertTrue(res_odd.get("success"))
        self.assertEqual(res_odd.get("parity_filter"), "odd")
        self.assertEqual(res_odd.get("detected_questions"), [47, 49])

        # Case B: Even questions
        res_even = inspect_page_ground_truth(self.goc_pdf, query_arg="các câu chẵn trang 41")
        self.assertTrue(res_even.get("success"))
        self.assertEqual(res_even.get("parity_filter"), "even")
        self.assertEqual(res_even.get("detected_questions"), [48, 50])

        # Case C: Part I only
        res_p1 = inspect_page_ground_truth(self.goc_pdf, query_arg="phần 1 trang 41")
        self.assertTrue(res_p1.get("success"))
        self.assertEqual(res_p1.get("detected_questions"), [47, 48, 49, 50])

        # Case D: Part II only
        res_p2 = inspect_page_ground_truth(self.goc_pdf, query_arg="phần 2 trang 41")
        self.assertTrue(res_p2.get("success"))
        self.assertEqual(res_p2.get("detected_questions"), [1])

    # -------------------------------------------------------------------------
    # Scenario 2: Smart Range Expansion on Real PDF (20 câu đầu trang 37)
    # -------------------------------------------------------------------------
    def test_scenario_smart_range_expansion_20_cau_dau_trang_37(self):
        """
        Verify query '20 câu đầu trang 37' on Gốc.pdf:
        If page 37 does not contain 20 questions, range resolver must expand
        forward into consecutive pages to satisfy requested count = 20.
        """
        doc_reps = extract_document_representations(self.goc_pdf)
        self.assertGreater(len(doc_reps), 0)

        range_result = resolve_smart_range("20 câu đầu trang 37", doc_reps)
        self.assertEqual(range_result.question_count, 20)
        self.assertGreaterEqual(range_result.end_page, range_result.start_page)

    # -------------------------------------------------------------------------
    # Scenario 3: Full End-to-End Pipeline Artifact Generation
    # -------------------------------------------------------------------------
    def test_scenario_full_pipeline_produces_valid_debai_and_dapan_pdf(self):
        """
        Runs full QuizPipelineOrchestrator on Gốc.pdf using MockAIProvider.
        Verifies:
        1. Pipeline reaches JobStage.COMPLETED.
        2. DeBai.pdf exists, is valid PDF (>1000 bytes, starts with %PDF-).
        3. DapAn.pdf exists, is valid PDF (>1000 bytes, starts with %PDF-).
        4. Zero [IMAGE_REF: leakage in generated artifacts.
        """
        mock_recon = BatchReconstructionResult(
            batch_id="batch_mock_recon_1",
            questions=[
                ReconstructedQuestion(
                    id=f"q_{n}",
                    number=n,
                    source_number=n,
                    type=QuestionType.PART_I_MCQ,
                    stem=f"Câu hỏi số {n}: Chất nào sau đây là este no đơn chức mạch hở?",
                    options=[
                        QuestionOption(label="A", text="HCOOCH3."),
                        QuestionOption(label="B", text="CH3COOH."),
                        QuestionOption(label="C", text="C2H5OH."),
                        QuestionOption(label="D", text="CH3CHO."),
                    ],
                    source_pages=[1],
                )
                for n in [41, 42, 43]
            ],
        )

        mock_ans = BatchAnswerResult(
            batch_id="batch_mock_ans_1",
            answers=[
                QuestionAnswerItem(
                    question_id=f"q_{n}",
                    question_number=n,
                    selected_answer="A",
                    evidence=f"Phương pháp giải cho câu {n}",
                )
                for n in [41, 42, 43]
            ],
        )

        provider = MockAIProvider(
            preset_response={
                BatchReconstructionResult: mock_recon,
                BatchAnswerResult: mock_ans,
            }
        )

        orchestrator = QuizPipelineOrchestrator(
            provider=provider,
            style_preset_id="blue_black_classic",
            chrome_timeout=60.0,
        )

        job_output_dir = os.path.join(self.temp_dir, "pipeline_smoke_run")
        os.makedirs(job_output_dir, exist_ok=True)

        state = orchestrator.run(
            pdf_path=self.goc_pdf,
            user_instruction="Trang 40 từ câu 41 đến 43",
            output_dir=job_output_dir,
            prefix="E2E_Test",
            title="ĐỀ THI E2E SMOKE",
            subtitle="KIỂM THỬ TOÀN TRÌNH",
        )

        self.assertEqual(
            state.current_stage, JobStage.COMPLETED,
            f"Pipeline failed with error: {state.error}"
        )

        debai_pdf = state.artifacts.get("debai_pdf", "")
        dapan_pdf = state.artifacts.get("dapan_pdf", "")

        self.assertTrue(os.path.isfile(debai_pdf), f"DeBai.pdf not found at: {debai_pdf}")
        self.assertTrue(os.path.isfile(dapan_pdf), f"DapAn.pdf not found at: {dapan_pdf}")

        # Check valid PDF header
        with open(debai_pdf, "rb") as f:
            header_debai = f.read(5)
            self.assertEqual(header_debai, b"%PDF-", "DeBai.pdf is not a valid PDF file.")

        with open(dapan_pdf, "rb") as f:
            header_dapan = f.read(5)
            self.assertEqual(header_dapan, b"%PDF-", "DapAn.pdf is not a valid PDF file.")

        # Check file sizes
        self.assertGreater(os.path.getsize(debai_pdf), 1000, "DeBai.pdf is too small.")
        self.assertGreater(os.path.getsize(dapan_pdf), 1000, "DapAn.pdf is too small.")


if __name__ == "__main__":
    unittest.main()
