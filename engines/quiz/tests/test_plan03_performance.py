"""
Unit & Integration Tests for PLAN-03 Performance & Optimization.
Tests adaptive batching, selective vision QA skipping, multi-tier cache hits,
bounded concurrency, and performance metrics tracking.
"""

import os
import shutil
import tempfile
import unittest
import pymupdf

from engines.quiz.reconstruction.batch_planner import BatchPlanner
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionType,
    QuestionOption,
    BatchPayload,
    BatchReconstructionResult,
)
from engines.quiz.perception.models import PageRepresentation, PageKind
from engines.quiz.solver.solver import AnswerSolver
from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem
from engines.quiz.qa.vision_qa import run_selective_vision_qa
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.reconstruction.reconstructor import QuestionReconstructor
from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.tests.golden.fixture_builder import FIXTURE_BUILDERS
from engines.quiz.tests.golden.test_golden_benchmark import _make_mock_responder


class TestPlan03Performance(unittest.TestCase):
    """Test suite for PLAN-03 Pipeline Performance and Optimization."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_p03_")
        os.environ["QUIZ_CACHE_DIR"] = os.path.join(self.temp_dir, "cache")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_adaptive_batch_planner_capacities(self):
        """Verifies BatchPlanner calculates capacities according to PLAN-03 guidelines."""
        # text/vector: 10-15 (default 12)
        self.assertEqual(BatchPlanner.get_batch_capacity("vector_text"), 12)
        self.assertTrue(10 <= BatchPlanner.get_batch_capacity("vector_text") <= 15)

        # formula-heavy: 6-10 (default 8)
        self.assertEqual(BatchPlanner.get_batch_capacity("formula_heavy"), 8)
        self.assertTrue(6 <= BatchPlanner.get_batch_capacity("formula_heavy") <= 10)

        # visual-heavy: 3-6 (default 4)
        self.assertEqual(BatchPlanner.get_batch_capacity("visual_heavy"), 4)
        self.assertTrue(3 <= BatchPlanner.get_batch_capacity("visual_heavy") <= 6)

        # scanned: 2-4 pages (default 2)
        self.assertEqual(BatchPlanner.get_batch_capacity("scanned"), 2)
        self.assertTrue(2 <= BatchPlanner.get_batch_capacity("scanned") <= 4)

        # Custom capacity override
        custom = {"vector_text": 15, "formula_heavy": 10}
        self.assertEqual(BatchPlanner.get_batch_capacity("vector_text", custom), 15)
        self.assertEqual(BatchPlanner.get_batch_capacity("formula_heavy", custom), 10)

    def test_answer_solver_adaptive_batch_sizing(self):
        """Verifies AnswerSolver adaptive batch sizing and chunking."""
        # 1. Plain text questions -> capacity 12
        text_questions = [
            ReconstructedQuestion(
                id=f"q_txt_{i}",
                number=i,
                source_number=i,
                type=QuestionType.PART_I_MCQ,
                stem=f"Câu {i}: Kim loại nào dẫn điện tốt nhất?",
                options=[QuestionOption(label="A", text="Ag"), QuestionOption(label="B", text="Cu")],
                source_pages=[1],
            )
            for i in range(1, 21)  # 20 questions
        ]
        self.assertEqual(AnswerSolver.determine_batch_size(text_questions), 12)

        # 2. Formula-heavy questions -> capacity 8
        formula_questions = [
            ReconstructedQuestion(
                id=f"q_form_{i}",
                number=i,
                source_number=i,
                type=QuestionType.PART_I_MCQ,
                stem=f"Câu {i}: Cho phản ứng Fe + 2HCl -> FeCl2 + H2. Tính mol khí thu được khi dùng \\frac{{m}}{{M}}.",
                options=[QuestionOption(label="A", text="0.1 mol"), QuestionOption(label="B", text="0.2 mol")],
                source_pages=[1],
            )
            for i in range(1, 21)
        ]
        self.assertEqual(AnswerSolver.determine_batch_size(formula_questions), 8)

        # 3. 20 text questions with batch size 12 should partition into exactly 2 batches (12 + 8)
        mock_provider = MockAIProvider(
            preset_response=lambda task, schema: BatchAnswerResult(
                batch_id=task,
                answers=[
                    QuestionAnswerItem(
                        question_id=f"q_txt_{i}",
                        question_number=i,
                        selected_answer="A",
                        evidence="Lý thuyết kim loại dẫn điện",
                    )
                    for i in range(1, 21)
                ],
            )
        )
        solver = AnswerSolver(mock_provider)  # batch_size=None -> adaptive 12
        answers = solver.solve_all(text_questions)
        self.assertEqual(len(answers), 20)
        # Verify exactly 2 AI calls were made (12 + 8 = 20), NOT 3 calls
        self.assertEqual(len(mock_provider.call_history), 2)

    def test_selective_vision_qa_skips_clean_document(self):
        """Verifies Vision QA is completely skipped when Geometry QA passes and no rich elements exist."""
        # Create a sample PDF
        sample_pdf = os.path.join(self.temp_dir, "clean.pdf")
        doc = pymupdf.open()
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 100), "Trang 1: Đề thi sạch không lỗi", fontsize=12)
        doc.save(sample_pdf)
        doc.close()

        mock_provider = MockAIProvider()

        # No flagged pages and no rich element pages
        result = run_selective_vision_qa(
            pdf_path=sample_pdf,
            flagged_pages=[],
            rich_element_pages=[],
            provider=mock_provider,
        )

        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.inspected_pages, [])
        # 0 Vision calls must be made!
        self.assertEqual(len(mock_provider.call_history), 0)

    def test_selective_vision_qa_inspects_only_flagged_or_rich_pages(self):
        """Verifies Vision QA only inspects flagged or rich pages and strictly caps at max_pages."""
        sample_pdf = os.path.join(self.temp_dir, "flagged.pdf")
        doc = pymupdf.open()
        p1 = doc.new_page(width=595.28, height=841.89)
        p1.insert_text((50, 100), "Trang 1", fontsize=12)
        p2 = doc.new_page(width=595.28, height=841.89)
        p2.insert_text((50, 100), "Trang 2", fontsize=12)
        p3 = doc.new_page(width=595.28, height=841.89)
        p3.insert_text((50, 100), "Trang 3", fontsize=12)
        doc.save(sample_pdf)
        doc.close()

        mock_provider = MockAIProvider()

        # Flag page 2 and rich element on page 3, with max_pages=2
        result = run_selective_vision_qa(
            pdf_path=sample_pdf,
            flagged_pages=[2],
            rich_element_pages=[3],
            provider=mock_provider,
            max_pages=2,
        )

        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.inspected_pages, [2, 3])
        self.assertEqual(len(mock_provider.call_history), 2)
        self.assertTrue(all(h["has_image"] for h in mock_provider.call_history))

    def test_multi_tier_cache_hits(self):
        """Verifies repeated requests hit cache and record cache_hits without calling AI provider."""
        questions = [
            ReconstructedQuestion(
                id=f"q_c_{i}",
                number=i,
                source_number=i,
                type=QuestionType.PART_I_MCQ,
                stem=f"Câu {i}: Đốt cháy hoàn toàn ankan thu được CO2 và H2O.",
                options=[QuestionOption(label="A", text="CnH2n+2"), QuestionOption(label="B", text="CnH2n")],
                source_pages=[1],
            )
            for i in range(1, 5)
        ]

        mock_provider = MockAIProvider(
            preset_response=lambda task, schema: BatchAnswerResult(
                batch_id=task,
                answers=[
                    QuestionAnswerItem(
                        question_id=f"q_c_{i}",
                        question_number=i,
                        selected_answer="A",
                        evidence="Công thức ankan",
                    )
                    for i in range(1, 5)
                ],
            ),
            enable_cache=True,
        )

        solver = AnswerSolver(mock_provider, batch_size=4)

        # Call 1: Cache Miss -> 1 AI call made, 0 cache hits
        ans1 = solver.solve_all(questions)
        self.assertEqual(len(ans1), 4)
        self.assertEqual(len(mock_provider.call_history), 1)
        self.assertEqual(mock_provider.tracker.cache_hits, 0)

        # Call 2: Cache Hit -> 0 new AI calls, 1 cache hit recorded!
        ans2 = solver.solve_all(questions)
        self.assertEqual(len(ans2), 4)
        self.assertEqual(len(mock_provider.call_history), 1)  # Still 1, no new call!
        self.assertEqual(mock_provider.tracker.cache_hits, 1)

    def test_pipeline_records_all_six_performance_metrics(self):
        """Verifies orchestrator records ai_calls, vision_calls, batches, retries, cache_hits, pipeline_ms."""
        pdf_target = os.path.join(self.temp_dir, "gf01.pdf")
        fixture_info = FIXTURE_BUILDERS["GF-01-VEC"](pdf_target)
        fixture_path = fixture_info["file_path"]
        output_dir = os.path.join(self.temp_dir, "out_metrics")
        os.makedirs(output_dir, exist_ok=True)

        responder = _make_mock_responder(total_questions=20, start_question=1)
        provider = MockAIProvider(preset_response=responder, enable_cache=True)
        orchestrator = QuizPipelineOrchestrator(provider=provider)

        state = orchestrator.run(
            pdf_path=fixture_path,
            user_instruction="20 câu trắc nghiệm từ trang 1 đến 2",
            output_dir=output_dir,
            prefix="perf_test",
        )

        self.assertEqual(state.current_stage.value, "COMPLETED")
        artifacts = state.artifacts

        # Assert all 6 metrics are present and well-formed
        self.assertIn("ai_calls", artifacts)
        self.assertIn("vision_calls", artifacts)
        self.assertIn("batches", artifacts)
        self.assertIn("retries", artifacts)
        self.assertIn("cache_hits", artifacts)
        self.assertIn("pipeline_ms", artifacts)

        self.assertIsInstance(artifacts["ai_calls"], int)
        self.assertIsInstance(artifacts["vision_calls"], int)
        self.assertIsInstance(artifacts["batches"], int)
        self.assertIsInstance(artifacts["retries"], int)
        self.assertIsInstance(artifacts["cache_hits"], int)
        self.assertIsInstance(artifacts["pipeline_ms"], float)

        # Since GF-01-VEC has 0 geometry issues and 0 rich elements, vision_calls MUST be 0!
        self.assertEqual(artifacts["vision_calls"], 0)
        # AI calls should be 4 (2 recon + 2 solve), down from baseline 6!
        self.assertEqual(artifacts["ai_calls"], 4)


if __name__ == "__main__":
    unittest.main()
