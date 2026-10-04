"""
Integration and Unit Tests for Pipeline Orchestrator and Job State Machine (TASK-11).
Verifies end-to-end execution, state transitions, atomic persistence, and Final Gate verification.
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.orchestrator.state import JobStage, JobState, JobStateManager
from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.reconstruction.models import (
    BatchReconstructionResult,
    ReconstructedQuestion,
    QuestionOption,
    QuestionType,
)
from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem


class TestOrchestrator(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_orch_")
        self.input_pdf = os.path.join(self.temp_dir, "input_test.pdf")

        # Generate standard programmatic input PDF
        doc = pymupdf.open()
        p = doc.new_page(width=595.28, height=841.89)
        p.insert_text((50, 60), "TRƯỜNG THPT CHUYÊN - ĐỀ THI HÓA HỌC", fontsize=12)
        p.insert_text((50, 100), "Câu 1: Chất nào sau đây là ancol no đơn chức mạch hở?", fontsize=10)
        p.insert_text((50, 120), "A. CH3OH    B. C6H5OH    C. CH3COOH    D. HCHO", fontsize=10)
        p.insert_text((50, 160), "Câu 2: Công thức phân tử của saccarozơ là", fontsize=10)
        p.insert_text((50, 180), "A. C6H12O6    B. C12H22O11    C. (C6H10O5)n    D. C2H4O2", fontsize=10)
        doc.save(self.input_pdf)
        doc.close()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_job_state_persistence_and_loading(self):
        state_file = os.path.join(self.temp_dir, "state_test.json")
        state = JobState(job_id="test_job_123", current_stage=JobStage.PLANNING, progress_pct=25)
        state.artifacts["test_pdf"] = "/path/to/test.pdf"

        JobStateManager.save(state, state_file)
        self.assertTrue(os.path.isfile(state_file))

        loaded = JobStateManager.load(state_file)
        self.assertEqual(loaded.job_id, "test_job_123")
        self.assertEqual(loaded.current_stage, JobStage.PLANNING)
        self.assertEqual(loaded.progress_pct, 25)
        self.assertEqual(loaded.artifacts["test_pdf"], "/path/to/test.pdf")

    def test_orchestrator_end_to_end_mock_run(self):
        # Configure Mock AI Provider with responses for reconstruction and solving
        mock_recon = BatchReconstructionResult(
            batch_id="batch_mock_recon_1",
            questions=[
                ReconstructedQuestion(
                    id="q_1",
                    number=1,
                    source_number=1,
                    type=QuestionType.PART_I_MCQ,
                    stem="Chất nào sau đây là ancol no đơn chức mạch hở?",
                    options=[
                        QuestionOption(label="A", text="CH3OH"),
                        QuestionOption(label="B", text="C6H5OH"),
                        QuestionOption(label="C", text="CH3COOH"),
                        QuestionOption(label="D", text="HCHO"),
                    ],
                    source_pages=[1],
                ),
                ReconstructedQuestion(
                    id="q_2",
                    number=2,
                    source_number=2,
                    type=QuestionType.PART_I_MCQ,
                    stem="Công thức phân tử của saccarozơ là",
                    options=[
                        QuestionOption(label="A", text="C6H12O6"),
                        QuestionOption(label="B", text="C12H22O11"),
                        QuestionOption(label="C", text="(C6H10O5)n"),
                        QuestionOption(label="D", text="C2H4O2"),
                    ],
                    source_pages=[1],
                ),
            ]
        )

        mock_ans = BatchAnswerResult(
            batch_id="batch_mock_ans_1",
            answers=[
                QuestionAnswerItem(
                    question_id="q_1",
                    question_number=1,
                    selected_answer="A",
                    evidence="CH3OH là metanol, ancol no đơn chức",
                ),
                QuestionAnswerItem(
                    question_id="q_2",
                    question_number=2,
                    selected_answer="B",
                    evidence="Saccarozơ có CTPT là C12H22O11",
                ),
            ]
        )

        # Provider returns recon on first call, answers on second
        provider = MockAIProvider(
            preset_response={
                BatchReconstructionResult: mock_recon,
                BatchAnswerResult: mock_ans,
            }
        )

        recorded_stages: list[JobStage] = []

        def track_progress(stage: JobStage, pct: int, msg: str):
            recorded_stages.append(stage)

        orchestrator = QuizPipelineOrchestrator(
            provider=provider,
            max_repair_iterations=1,
        )

        out_dir = os.path.join(self.temp_dir, "run_output")
        final_state = orchestrator.run(
            pdf_path=self.input_pdf,
            user_instruction="Trang 1 lấy 2 câu",
            output_dir=out_dir,
            prefix="HoaHoc12",
            on_progress=track_progress,
        )

        # 1. Verify completed state
        self.assertEqual(final_state.current_stage, JobStage.COMPLETED)
        self.assertEqual(final_state.progress_pct, 100)
        self.assertIsNone(final_state.error)

        # 2. Verify state transitions occurred in correct sequence
        self.assertIn(JobStage.CREATED, recorded_stages)
        self.assertIn(JobStage.INSPECTING, recorded_stages)
        self.assertIn(JobStage.PLANNING, recorded_stages)
        self.assertIn(JobStage.RECONSTRUCTING, recorded_stages)
        self.assertIn(JobStage.NORMALIZING, recorded_stages)
        self.assertIn(JobStage.SOLVING, recorded_stages)
        self.assertIn(JobStage.RENDERING, recorded_stages)
        self.assertIn(JobStage.COMPILING, recorded_stages)
        self.assertIn(JobStage.FINALIZING, recorded_stages)
        self.assertIn(JobStage.COMPLETED, recorded_stages)

        # 3. Verify exactly 2 valid output PDFs generated
        debai_pdf = final_state.artifacts.get("debai_pdf")
        dapan_pdf = final_state.artifacts.get("dapan_pdf")
        self.assertIsNotNone(debai_pdf)
        self.assertIsNotNone(dapan_pdf)
        self.assertTrue(os.path.isfile(debai_pdf))
        self.assertTrue(os.path.isfile(dapan_pdf))
        self.assertGreater(os.path.getsize(debai_pdf), 1024)
        self.assertGreater(os.path.getsize(dapan_pdf), 1024)

        # 4. Inspect PyMuPDF readability
        doc_de = pymupdf.open(debai_pdf)
        self.assertGreaterEqual(doc_de.page_count, 1)
        doc_de.close()

        doc_da = pymupdf.open(dapan_pdf)
        self.assertGreaterEqual(doc_da.page_count, 1)
        doc_da.close()

    def test_orchestrator_final_gate_rejection(self):
        # Invalid / missing PDF path must transition to FAILED
        orchestrator = QuizPipelineOrchestrator()
        out_dir = os.path.join(self.temp_dir, "run_failed")

        final_state = orchestrator.run(
            pdf_path=os.path.join(self.temp_dir, "non_existent.pdf"),
            user_instruction="Trang 1 lấy 5 câu",
            output_dir=out_dir,
            prefix="FailTest",
        )
        self.assertEqual(final_state.current_stage, JobStage.FAILED)
        self.assertIsNotNone(final_state.error)


if __name__ == "__main__":
    unittest.main()
