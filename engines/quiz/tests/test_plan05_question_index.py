"""
Unit and Regression Test Suite for PLAN-05: Page Neighborhood Scanner & Question Index.

Verifies:
1. Production bugfix Case A: "Trang 13 câu 30 đến 44" on sample.pdf produces Q30–Q44 (15 questions).
2. Production bugfix Case B: "Trang 13 câu 31 đến 43" on sample.pdf produces Q31–Q43 (13 questions).
3. Case C: Inward continuation at previous-page boundary (Q40 starts on prev page, continues on target).
4. Case D: Outward continuation at next-page boundary (Q44 continues on next page; Q45 on next page does not leak).
5. Case E: Two-column layout reading order (left column then right column).
6. Case F: Rich-content questions (formulas, diagrams, diagrams bbox preservation).
7. Case G: Missing/ambiguous question number triggers RANGE_MISMATCH (hard gate; never partial silent success).
8. Cache test: PageIndex cache retrieval and invalidation.
"""

import os
import unittest
import tempfile
import shutil

from engines.quiz.perception.models import (
    PageRepresentation,
    PageKind,
    TextBlock,
    TextLine,
    QuestionCandidate,
    ExtractedImage,
)
from engines.quiz.perception.extractor import extract_document_representations
from engines.quiz.recognition.models import (
    QuestionSegment,
    QuestionIndexEntry,
    PageIndex,
    PageNeighborhood,
    ExtractionPlan,
)
from engines.quiz.recognition.question_index import QuestionIndexService
from engines.quiz.reconstruction.batch_planner import BatchPlanner
from engines.quiz.reconstruction.post_processor import post_process_questions
from engines.quiz.reconstruction.models import (
    ReconstructedQuestion,
    QuestionOption,
    QuestionType,
    BatchReconstructionResult,
)
from engines.quiz.provider.mock import MockAIProvider
from engines.quiz.orchestrator.pipeline import QuizPipelineOrchestrator
from engines.quiz.orchestrator.state import JobStage
from engines.quiz.common.errors import QuizEngineError, ErrorCode, DiagnosticLayer


class TestPlan05QuestionIndex(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sample_pdf_path = os.path.abspath(".tmp/sample.pdf")
        if os.path.isfile(cls.sample_pdf_path):
            cls.doc_reps = extract_document_representations(cls.sample_pdf_path)
        else:
            cls.doc_reps = []
        cls.index_service = QuestionIndexService()

    # =========================================================================
    # Test 1: Production Regression Case A ("Trang 13 câu 30 đến 44")
    # =========================================================================

    def test_production_regression_page_13_q30_q44(self):
        """
        Production Regression Case A:
        'Trang 13 câu 30 đến 44' on sample.pdf must produce exactly Q30–Q44 (15 questions).
        Verifies full-page question inventory, range validation, and batch planning.
        """
        if not self.doc_reps or len(self.doc_reps) < 13:
            self.skipTest("sample.pdf fixture not available")

        # 1. Build Neighborhood Index around page 13
        neighborhood = self.index_service.build_neighborhood_index(
            target_physical_page=13,
            doc_reps=self.doc_reps
        )
        self.assertEqual(neighborhood.target_page, 13)
        self.assertEqual(neighborhood.previous_page, 12)
        self.assertEqual(neighborhood.next_page, 14)

        # 2. Build Extraction Plan for Q30..Q44
        plan = self.index_service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=30,
            end_q=44,
            count=15,
            doc_reps=self.doc_reps,
            raise_on_mismatch=True
        )
        self.assertTrue(plan.validated, "Extraction plan must be validated")
        self.assertEqual(plan.status, "RANGE_VALID")
        expected_nums = list(range(30, 45))
        self.assertEqual(plan.target_question_numbers, expected_nums)
        self.assertEqual(len(plan.target_question_numbers), 15)

        # 3. Plan Batches with target_question_numbers
        p13_reps = [self.doc_reps[12]] # 0-indexed 12 is page 13
        batches = BatchPlanner.plan_batches(
            doc_reps=p13_reps,
            start_page=13,
            end_page=13,
            start_question=30,
            question_count=15,
            target_question_numbers=plan.target_question_numbers
        )
        all_batch_cands = []
        for b in batches:
            all_batch_cands.extend(b.target_question_numbers)
        self.assertEqual(sorted(all_batch_cands), expected_nums, "Batches must cover all 15 questions 30..44")

        # 4. Post-processing restricts strictly to Q30..Q44
        mock_raw = [
            ReconstructedQuestion(
                id=f"q_{n}",
                number=n,
                source_number=n,
                type=QuestionType.PART_I_MCQ,
                stem=f"Ester {n} có đặc điểm gì?",
                options=[QuestionOption(label=l, text=f"Đáp án {l}") for l in ["A", "B", "C", "D"]],
                source_pages=[13]
            )
            for n in range(30, 45)
        ]
        # Include an extra Q45 to ensure context isolation
        mock_raw.append(
            ReconstructedQuestion(
                id="q_45",
                number=45,
                source_number=45,
                type=QuestionType.PART_I_MCQ,
                stem="Ester 45 ngoại lai",
                options=[QuestionOption(label=l, text=f"Đáp án {l}") for l in ["A", "B", "C", "D"]],
                source_pages=[14]
            )
        )
        cleaned = post_process_questions(
            mock_raw,
            start_question=30,
            expected_count=15,
            target_question_numbers=plan.target_question_numbers
        )
        self.assertEqual(len(cleaned), 15, "Output must contain exactly 15 questions")
        self.assertEqual([q.number for q in cleaned], expected_nums)

    # =========================================================================
    # Test 2: Production Regression Case B ("Trang 13 câu 31 đến 43")
    # =========================================================================

    def test_production_regression_page_13_q31_q43(self):
        """
        Production Regression Case B:
        'Trang 13 câu 31 đến 43' on sample.pdf must produce exactly Q31–Q43 (13 questions).
        """
        if not self.doc_reps or len(self.doc_reps) < 13:
            self.skipTest("sample.pdf fixture not available")

        neighborhood = self.index_service.build_neighborhood_index(
            target_physical_page=13,
            doc_reps=self.doc_reps
        )

        plan = self.index_service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=31,
            end_q=43,
            count=13,
            doc_reps=self.doc_reps,
            raise_on_mismatch=True
        )
        self.assertTrue(plan.validated)
        expected_nums = list(range(31, 44))
        self.assertEqual(plan.target_question_numbers, expected_nums)
        self.assertEqual(len(plan.target_question_numbers), 13)

        # Post-processing verify Q30 and Q44 are NOT included
        mock_raw = [
            ReconstructedQuestion(
                id=f"q_{n}",
                number=n,
                source_number=n,
                type=QuestionType.PART_I_MCQ,
                stem=f"Ester {n} phản ứng",
                options=[QuestionOption(label=l, text=f"Đáp án {l}") for l in ["A", "B", "C", "D"]],
                source_pages=[13]
            )
            for n in range(30, 45) # Q30 to Q44
        ]
        cleaned = post_process_questions(
            mock_raw,
            start_question=31,
            expected_count=13,
            target_question_numbers=plan.target_question_numbers
        )
        self.assertEqual(len(cleaned), 13)
        self.assertEqual([q.number for q in cleaned], expected_nums)
        self.assertNotIn(30, [q.number for q in cleaned])
        self.assertNotIn(44, [q.number for q in cleaned])

    # =========================================================================
    # Test 3: Case C — Question at Previous-Page Boundary (Inward Continuation)
    # =========================================================================

    def test_case_c_previous_page_continuation(self):
        """
        Case C: Q40 starts at the bottom of Page 1 and continues onto Page 2.
        Request Q40–Q41 must return both Q40 and Q41 with Page 1 as continuation,
        without leaking Q38..Q39 from Page 1 into final output.
        """
        p1 = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            character_count=500,
            raw_text="Câu 39: Test 39\nA. 1 B. 2 C. 3 D. 4\nCâu 40: Stem bắt đầu trang 1\nA. Opt A\nB. Opt B",
            candidates=[
                QuestionCandidate(candidate_number=39, marker_text="Câu 39:", bbox=(50, 100, 500, 200), y_pos=100.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=40, marker_text="Câu 40:", bbox=(50, 700, 500, 800), y_pos=700.0, options_detected=["A", "B"]), # Incomplete options
            ]
        )
        p2 = PageRepresentation(
            page_index=1,
            page_number=2,
            width=595.0,
            height=842.0,
            character_count=400,
            raw_text="C. Opt C\nD. Opt D\nCâu 41: Test 41\nA. 1 B. 2 C. 3 D. 4",
            candidates=[
                QuestionCandidate(candidate_number=41, marker_text="Câu 41:", bbox=(50, 150, 500, 250), y_pos=150.0, options_detected=["A", "B", "C", "D"]),
            ]
        )
        doc = [p1, p2]

        neighborhood = self.index_service.build_neighborhood_index(
            target_physical_page=2,
            doc_reps=doc
        )
        self.assertIn(1, neighborhood.page_roles)
        self.assertEqual(neighborhood.page_roles[1], "continuation", "Page 1 must be marked as continuation for Q40")

        # Q40 in question_index must span pages 1 and 2
        q40 = next((q for q in neighborhood.question_index if q.question_number == 40), None)
        self.assertIsNotNone(q40)
        self.assertEqual(q40.first_page, 1)
        self.assertEqual(q40.last_page, 2)

        # Plan for Q40..Q41
        plan = self.index_service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=40,
            end_q=41,
            count=2,
            doc_reps=doc,
            raise_on_mismatch=True
        )
        self.assertTrue(plan.validated)
        self.assertEqual(plan.target_question_numbers, [40, 41])
        self.assertIn(1, plan.continuation_pages, "Page 1 must be in continuation pages for Q40")

        # Post-processor test: Q39 on Page 1 must not leak into Q40..Q41
        mock_raw = [
            ReconstructedQuestion(
                id="q_39", number=39, source_number=39, type=QuestionType.PART_I_MCQ, stem="Q39",
                options=[QuestionOption(label=l, text="T") for l in ["A", "B", "C", "D"]], source_pages=[1]
            ),
            ReconstructedQuestion(
                id="q_40", number=40, source_number=40, type=QuestionType.PART_I_MCQ, stem="Q40 stitched",
                options=[QuestionOption(label=l, text="T") for l in ["A", "B", "C", "D"]], source_pages=[1, 2]
            ),
            ReconstructedQuestion(
                id="q_41", number=41, source_number=41, type=QuestionType.PART_I_MCQ, stem="Q41",
                options=[QuestionOption(label=l, text="T") for l in ["A", "B", "C", "D"]], source_pages=[2]
            ),
        ]
        cleaned = post_process_questions(
            mock_raw,
            start_question=40,
            expected_count=2,
            target_question_numbers=plan.target_question_numbers
        )
        self.assertEqual([q.number for q in cleaned], [40, 41])
        self.assertNotIn(39, [q.number for q in cleaned], "Q39 must NOT leak into final output")

    # =========================================================================
    # Test 4: Case D — Question at Next-Page Boundary (Outward Continuation)
    # =========================================================================

    def test_case_d_next_page_continuation(self):
        """
        Case D: Q44 begins on Page 2 and continues onto Page 3 with Option D.
        Page 3 also contains Q45.
        Request Q44 must produce Q44 with Page 3 continuation, but Q45 must NOT leak.
        """
        p2 = PageRepresentation(
            page_index=1,
            page_number=2,
            width=595.0,
            height=842.0,
            character_count=400,
            raw_text="Câu 44: Stem trên trang 2\nA. Opt A\nB. Opt B\nC. Opt C",
            candidates=[
                QuestionCandidate(candidate_number=44, marker_text="Câu 44:", bbox=(50, 700, 500, 800), y_pos=700.0, options_detected=["A", "B", "C"])
            ]
        )
        p3 = PageRepresentation(
            page_index=2,
            page_number=3,
            width=595.0,
            height=842.0,
            character_count=400,
            raw_text="D. Opt D hoàn chỉnh\nCâu 45: Câu mới trên trang 3\nA. 1 B. 2 C. 3 D. 4",
            candidates=[
                QuestionCandidate(candidate_number=45, marker_text="Câu 45:", bbox=(50, 200, 500, 300), y_pos=200.0, options_detected=["A", "B", "C", "D"])
            ]
        )
        doc = [p2, p3]

        neighborhood = self.index_service.build_neighborhood_index(
            target_physical_page=2,
            doc_reps=doc
        )
        self.assertEqual(neighborhood.page_roles[3], "continuation", "Page 3 must be marked as continuation for Q44")

        plan = self.index_service.build_extraction_plan(
            neighborhood=neighborhood,
            start_q=44,
            end_q=44,
            count=1,
            doc_reps=doc,
            raise_on_mismatch=True
        )
        self.assertTrue(plan.validated)
        self.assertEqual(plan.target_question_numbers, [44])
        self.assertIn(3, plan.continuation_pages)

        # Verify Q45 is strictly blocked from leaking
        mock_raw = [
            ReconstructedQuestion(
                id="q_44", number=44, source_number=44, type=QuestionType.PART_I_MCQ, stem="Q44",
                options=[QuestionOption(label=l, text="T") for l in ["A", "B", "C", "D"]], source_pages=[2, 3]
            ),
            ReconstructedQuestion(
                id="q_45", number=45, source_number=45, type=QuestionType.PART_I_MCQ, stem="Q45 ngoại lai",
                options=[QuestionOption(label=l, text="T") for l in ["A", "B", "C", "D"]], source_pages=[3]
            )
        ]
        cleaned = post_process_questions(
            mock_raw,
            start_question=44,
            expected_count=1,
            target_question_numbers=plan.target_question_numbers
        )
        self.assertEqual([q.number for q in cleaned], [44])
        self.assertNotIn(45, [q.number for q in cleaned], "Q45 from next page context must NOT leak")

    # =========================================================================
    # Test 5: Case E — Two-Column Layout Reading Order
    # =========================================================================

    def test_case_e_two_column_layout_reading_order(self):
        """
        Case E: Page with 2 columns.
        Left column (x0=50..250): Q1 (y=100), Q2 (y=300), Q3 (y=500).
        Right column (x0=320..520): Q4 (y=105), Q5 (y=305), Q6 (y=505).
        Reading order must be Q1, Q2, Q3, Q4, Q5, Q6 (NOT interleaved Q1, Q4, Q2, Q5...).
        """
        blocks = [
            # Left column blocks
            TextBlock(block_index=0, bbox=(50, 100, 280, 250), lines=[], text="Câu 1: Cột trái 1\nA. 1 B. 2 C. 3 D. 4"),
            TextBlock(block_index=1, bbox=(50, 300, 280, 450), lines=[], text="Câu 2: Cột trái 2\nA. 1 B. 2 C. 3 D. 4"),
            TextBlock(block_index=2, bbox=(50, 500, 280, 650), lines=[], text="Câu 3: Cột trái 3\nA. 1 B. 2 C. 3 D. 4"),
            # Right column blocks
            TextBlock(block_index=3, bbox=(320, 105, 550, 255), lines=[], text="Câu 4: Cột phải 4\nA. 1 B. 2 C. 3 D. 4"),
            TextBlock(block_index=4, bbox=(320, 305, 550, 455), lines=[], text="Câu 5: Cột phải 5\nA. 1 B. 2 C. 3 D. 4"),
            TextBlock(block_index=5, bbox=(320, 505, 550, 655), lines=[], text="Câu 6: Cột phải 6\nA. 1 B. 2 C. 3 D. 4"),
        ]
        candidates = [
            QuestionCandidate(candidate_number=1, marker_text="Câu 1:", bbox=(50, 100, 250, 120), y_pos=100.0, options_detected=["A", "B", "C", "D"]),
            QuestionCandidate(candidate_number=2, marker_text="Câu 2:", bbox=(50, 300, 250, 320), y_pos=300.0, options_detected=["A", "B", "C", "D"]),
            QuestionCandidate(candidate_number=3, marker_text="Câu 3:", bbox=(50, 500, 250, 520), y_pos=500.0, options_detected=["A", "B", "C", "D"]),
            QuestionCandidate(candidate_number=4, marker_text="Câu 4:", bbox=(320, 105, 520, 125), y_pos=105.0, options_detected=["A", "B", "C", "D"]),
            QuestionCandidate(candidate_number=5, marker_text="Câu 5:", bbox=(320, 305, 520, 325), y_pos=305.0, options_detected=["A", "B", "C", "D"]),
            QuestionCandidate(candidate_number=6, marker_text="Câu 6:", bbox=(320, 505, 520, 525), y_pos=505.0, options_detected=["A", "B", "C", "D"]),
        ]
        page = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            character_count=600,
            blocks=blocks,
            candidates=candidates,
        )

        p_idx = self.index_service.build_page_index(page)
        self.assertEqual(p_idx.columns_detected, 2, "Must detect 2 columns")
        extracted_nums = [q.question_number for q in p_idx.questions]
        self.assertEqual(extracted_nums, [1, 2, 3, 4, 5, 6], "Must order left column first then right column")

    # =========================================================================
    # Test 6: Case F — Rich Content Question Indexing
    # =========================================================================

    def test_case_f_rich_content_question_indexing(self):
        """
        Case F: Questions with images/diagrams and formulas.
        Verifies question segments and spatial bounding boxes are preserved without corruption.
        """
        page = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            character_count=300,
            images=[
                ExtractedImage(
                    image_id="img_diagram_1",
                    xref=42,
                    bbox=(100.0, 200.0, 300.0, 350.0),
                    width=200,
                    height=150
                )
            ],
            drawing_count=3,
            candidates=[
                QuestionCandidate(
                    candidate_number=10,
                    marker_text="Câu 10:",
                    bbox=(50.0, 150.0, 500.0, 400.0),
                    y_pos=150.0,
                    options_detected=["A", "B", "C", "D"]
                )
            ]
        )
        p_idx = self.index_service.build_page_index(page)
        self.assertEqual(len(p_idx.questions), 1)
        q = p_idx.questions[0]
        self.assertEqual(q.question_number, 10)
        self.assertEqual(len(q.segments), 1)
        self.assertEqual(q.segments[0].bbox, (50.0, 150.0, 500.0, 400.0))

    # =========================================================================
    # Test 7: Case G — Missing/Ambiguous Question Number triggers RANGE_MISMATCH
    # =========================================================================

    def test_case_g_range_mismatch_hard_gate(self):
        """
        Case G: User requests Q30..Q44 (15 questions), but document only contains Q41..Q44.
        Hard gate must reject with RANGE_MISMATCH and NEVER silently produce partial result.
        """
        page = PageRepresentation(
            page_index=0,
            page_number=1,
            width=595.0,
            height=842.0,
            character_count=200,
            raw_text="Câu 41: Test\nCâu 42: Test\nCâu 43: Test\nCâu 44: Test",
            candidates=[
                QuestionCandidate(candidate_number=41, marker_text="Câu 41:", bbox=(50, 100, 500, 150), y_pos=100.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=42, marker_text="Câu 42:", bbox=(50, 200, 500, 250), y_pos=200.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=43, marker_text="Câu 43:", bbox=(50, 300, 500, 350), y_pos=300.0, options_detected=["A", "B", "C", "D"]),
                QuestionCandidate(candidate_number=44, marker_text="Câu 44:", bbox=(50, 400, 500, 450), y_pos=400.0, options_detected=["A", "B", "C", "D"]),
            ]
        )
        neighborhood = self.index_service.build_neighborhood_index(
            target_physical_page=1,
            doc_reps=[page]
        )

        # 1. Non-raising mode returns False
        valid, detected, missing, _ = self.index_service.validate_requested_range(
            neighborhood=neighborhood,
            start_q=30,
            end_q=44,
            count=15,
            doc_reps=[page],
            raise_on_mismatch=False
        )
        self.assertFalse(valid, "Must not validate partial range")
        self.assertEqual(len(missing), 11, "Must list 11 missing questions (Q30..Q40)")
        self.assertEqual(detected, [41, 42, 43, 44])

        # 2. Raising mode must raise QuizEngineError with ErrorCode.RANGE_MISMATCH
        with self.assertRaises(QuizEngineError) as ctx:
            self.index_service.build_extraction_plan(
                neighborhood=neighborhood,
                start_q=30,
                end_q=44,
                count=15,
                doc_reps=[page],
                raise_on_mismatch=True
            )
        self.assertEqual(ctx.exception.code, ErrorCode.RANGE_MISMATCH)
        self.assertIn("RANGE_MISMATCH", str(ctx.exception))

    # =========================================================================
    # Test 8: End-to-End Orchestrator Execution on Page 13 of sample.pdf
    # =========================================================================

    def test_orchestrator_end_to_end_sample_pdf_page_13(self):
        """
        Executes QuizPipelineOrchestrator end-to-end on sample.pdf with:
        instruction = "Trang 13 câu 30 đến 44".
        Verifies:
        - Job completes successfully.
        - Exactly 15 questions extracted (30..44).
        - DeBai and DapAn PDF artifacts exist and are non-empty.
        """
        if not os.path.isfile(self.sample_pdf_path):
            self.skipTest("sample.pdf fixture not available")

        # Mock responder generating questions 30..44
        def mock_responder(task_name: str, schema: type):
            if schema is BatchReconstructionResult:
                # Extract batch_id
                batch_qs = []
                # Provide questions matching task if available
                for q_i in range(30, 45):
                    batch_qs.append(
                        ReconstructedQuestion(
                            id=f"q_{q_i}",
                            number=q_i,
                            source_number=q_i,
                            type=QuestionType.PART_I_MCQ,
                            stem=f"Ester {q_i} có công thức phân tử là gì?",
                            options=[
                                QuestionOption(label="A", text="C2H4O2"),
                                QuestionOption(label="B", text="C3H6O2"),
                                QuestionOption(label="C", text="C4H8O2"),
                                QuestionOption(label="D", text="C5H10O2"),
                            ],
                            source_pages=[13]
                        )
                    )
                return BatchReconstructionResult(batch_id=task_name, questions=batch_qs)

            if schema.__name__ == "BatchAnswerResult":
                from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem
                ans_items = [
                    QuestionAnswerItem(
                        question_id=f"q_p13_num{q_i}",
                        question_number=q_i,
                        selected_key="A",
                        explanation=f"Giải thích chi tiết cho câu {q_i}."
                    )
                    for q_i in range(30, 45)
                ]
                return BatchAnswerResult(batch_id=task_name, answers=ans_items)

            # Default empty / fallback
            return schema()

        mock_provider = MockAIProvider(preset_response=mock_responder)
        temp_out = tempfile.mkdtemp(prefix="test_plan05_orch_")

        try:
            orchestrator = QuizPipelineOrchestrator(
                provider=mock_provider,
                max_repair_iterations=0
            )

            state = orchestrator.run(
                pdf_path=self.sample_pdf_path,
                user_instruction="Trang 13 câu 30 đến 44",
                output_dir=temp_out,
                prefix="REG_PLAN05_Q30_44",
                title="BÀI TẬP TRẮC NGHIỆM TRANG 13"
            )

            self.assertEqual(state.current_stage, JobStage.COMPLETED)
            doc_ir = state.artifacts.get("doc_ir")
            if hasattr(doc_ir, "questions"):
                questions = doc_ir.questions
                q_numbers = [q.number for q in questions]
            else:
                questions = doc_ir.get("questions", [])
                q_numbers = [q.get("number") for q in questions]


            self.assertEqual(len(questions), 15, f"Must extract 15 questions, got {len(questions)}")
            self.assertEqual(q_numbers, list(range(30, 45)), "Question numbers must be exactly 30..44")

            # Verify PDF files generated
            debai_pdf = state.artifacts.get("debai_pdf")
            dapan_pdf = state.artifacts.get("dapan_pdf")
            self.assertTrue(os.path.isfile(debai_pdf), "DeBai PDF must exist")
            self.assertTrue(os.path.isfile(dapan_pdf), "DapAn PDF must exist")
            self.assertGreater(os.path.getsize(debai_pdf), 1000, "DeBai PDF must be non-empty")
            self.assertGreater(os.path.getsize(dapan_pdf), 1000, "DapAn PDF must be non-empty")

        finally:
            shutil.rmtree(temp_out, ignore_errors=True)

    def test_orchestrator_end_to_end_sample_pdf_page_13_q31_q43(self):
        """
        Executes QuizPipelineOrchestrator end-to-end on sample.pdf with:
        instruction = "Trang 13 câu 31 đến 43".
        Verifies:
        - Job completes successfully.
        - Exactly 13 questions extracted (31..43).
        - Q30 and Q44 are NOT in the output.
        - DeBai and DapAn PDF artifacts exist and are non-empty.
        """
        if not os.path.isfile(self.sample_pdf_path):
            self.skipTest("sample.pdf fixture not available")

        def mock_responder(task_name: str, schema: type):
            if schema is BatchReconstructionResult:
                batch_qs = []
                for q_i in range(31, 44):
                    batch_qs.append(
                        ReconstructedQuestion(
                            id=f"q_{q_i}",
                            number=q_i,
                            source_number=q_i,
                            type=QuestionType.PART_I_MCQ,
                            stem=f"Ester {q_i} có công thức cấu tạo tương ứng?",
                            options=[
                                QuestionOption(label="A", text="CH3COOCH3"),
                                QuestionOption(label="B", text="HCOOC2H5"),
                                QuestionOption(label="C", text="CH3COOC2H5"),
                                QuestionOption(label="D", text="C2H5COOCH3"),
                            ],
                            source_pages=[13]
                        )
                    )
                return BatchReconstructionResult(batch_id=task_name, questions=batch_qs)

            if schema.__name__ == "BatchAnswerResult":
                from engines.quiz.solver.models import BatchAnswerResult, QuestionAnswerItem
                ans_items = [
                    QuestionAnswerItem(
                        question_id=f"q_p13_num{q_i}",
                        question_number=q_i,
                        selected_key="B",
                        explanation=f"Giải thích chi tiết cho câu {q_i}."
                    )
                    for q_i in range(31, 44)
                ]
                return BatchAnswerResult(batch_id=task_name, answers=ans_items)

            return schema()

        mock_provider = MockAIProvider(preset_response=mock_responder)
        temp_out = tempfile.mkdtemp(prefix="test_plan05_orch_31_43_")

        try:
            orchestrator = QuizPipelineOrchestrator(
                provider=mock_provider,
                max_repair_iterations=0
            )

            state = orchestrator.run(
                pdf_path=self.sample_pdf_path,
                user_instruction="Trang 13 câu 31 đến 43",
                output_dir=temp_out,
                prefix="REG_PLAN05_Q31_43",
                title="BÀI TẬP TRẮC NGHIỆM TRANG 13"
            )

            self.assertEqual(state.current_stage, JobStage.COMPLETED)
            doc_ir = state.artifacts.get("doc_ir")
            if hasattr(doc_ir, "questions"):
                questions = doc_ir.questions
                q_numbers = [q.number for q in questions]
            else:
                questions = doc_ir.get("questions", [])
                q_numbers = [q.get("number") for q in questions]

            self.assertEqual(len(questions), 13, f"Must extract 13 questions, got {len(questions)}")
            self.assertEqual(q_numbers, list(range(31, 44)), "Question numbers must be exactly 31..43")
            self.assertNotIn(30, q_numbers)
            self.assertNotIn(44, q_numbers)

            debai_pdf = state.artifacts.get("debai_pdf")
            dapan_pdf = state.artifacts.get("dapan_pdf")
            self.assertTrue(os.path.isfile(debai_pdf), "DeBai PDF must exist")
            self.assertTrue(os.path.isfile(dapan_pdf), "DapAn PDF must exist")
            self.assertGreater(os.path.getsize(debai_pdf), 1000)
            self.assertGreater(os.path.getsize(dapan_pdf), 1000)

        finally:
            shutil.rmtree(temp_out, ignore_errors=True)

    def test_case_d_next_page_missing_question_recovery(self):
        """
        Verifies that missing question recovery checks next_page within neighborhood
        when the requested range spans into the next page.
        """
        p2 = PageRepresentation(
            page_index=1, page_number=2, width=595.0, height=842.0, character_count=400,
            raw_text="Câu 44: Stem trên trang 2\nA. Opt A\nB. Opt B\nC. Opt C",
            candidates=[QuestionCandidate(candidate_number=44, marker_text="Câu 44:", bbox=(50, 700, 500, 800), y_pos=700.0, options_detected=["A", "B", "C"])]
        )
        p3 = PageRepresentation(
            page_index=2, page_number=3, width=595.0, height=842.0, character_count=400,
            raw_text="D. Opt D hoàn chỉnh\nCâu 45: Câu mới trên trang 3\nA. 1 B. 2 C. 3 D. 4",
            candidates=[QuestionCandidate(candidate_number=45, marker_text="Câu 45:", bbox=(50, 200, 500, 300), y_pos=200.0, options_detected=["A", "B", "C", "D"])]
        )
        doc = [p2, p3]
        nb = self.index_service.build_neighborhood_index(target_physical_page=2, doc_reps=doc)
        valid, detected, missing, entries = self.index_service.validate_requested_range(
            nb, start_q=44, end_q=45, count=2, doc_reps=doc, raise_on_mismatch=False
        )
        self.assertTrue(valid, "Recovery must find Q45 on next_page")
        self.assertEqual(detected, [44, 45])
        self.assertEqual(missing, [])

    def test_case_empty_target_pages_neighborhood(self):
        """Verifies empty target_pages is handled gracefully without crashing."""
        nb = self.index_service.build_multi_page_neighborhood_index([], [])
        self.assertEqual(nb.status, "empty")
        self.assertEqual(nb.question_index, [])

    def test_case_non_standard_marker_recovery(self):
        """Verifies that non-standard markers ('Bài', standalone numbers) are recovered."""
        p1 = PageRepresentation(
            page_index=0, page_number=1, width=595.0, height=842.0, character_count=300,
            raw_text="Bài 15: Cho kim loại phản ứng với axit\nA. 1 B. 2 C. 3 D. 4",
            candidates=[]
        )
        doc = [p1]
        nb = self.index_service.build_neighborhood_index(target_physical_page=1, doc_reps=doc)
        valid, detected, missing, entries = self.index_service.validate_requested_range(
            nb, start_q=15, end_q=15, count=1, doc_reps=doc, raise_on_mismatch=False
        )
        self.assertTrue(valid)
        self.assertEqual(detected, [15])
        self.assertEqual(entries[0].question_number, 15)

    def test_post_processor_1_based_renumbered_fallback(self):
        """Verifies post_processor handles 1-based questions returned by AI when requested is 30..32."""
        raw_qs = [
            ReconstructedQuestion(
                id=f"q_{idx}", number=idx, source_number=idx, type=QuestionType.PART_I_MCQ,
                stem=f"Câu hỏi số {idx}",
                options=[QuestionOption(label=lbl, text=f"Đáp án {lbl}") for lbl in ["A", "B", "C", "D"]],
                source_pages=[13]
            )
            for idx in [1, 2, 3] # AI renumbered 1..3
        ]
        cleaned = post_process_questions(
            raw_qs, start_question=30, expected_count=3, target_question_numbers=[30, 31, 32]
        )
        self.assertEqual(len(cleaned), 3)
        self.assertEqual([q.number for q in cleaned], [30, 31, 32])


if __name__ == "__main__":
    unittest.main()

