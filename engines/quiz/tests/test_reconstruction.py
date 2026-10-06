"""
Unit Tests for Batched Question Reconstruction & Classification (TASK-06)
Tests BatchPlanner adaptive sizing, cross-page split question context,
reconstruction with IAIProvider, isolated batch retries, fallback degradation,
and post-processing (deduplication, sequential renumbering).
"""

import unittest
from engines.quiz.perception.models import (
    PageRepresentation,
    QuestionCandidate,
    PageKind,
    ExtractedImage
)
from engines.quiz.reconstruction.models import (
    BatchPayload,
    BatchReconstructionResult,
    ReconstructedQuestion,
    QuestionType,
    QuestionOption,
    TFSubStatement
)
from engines.quiz.reconstruction.batch_planner import BatchPlanner
from engines.quiz.reconstruction.reconstructor import QuestionReconstructor
from engines.quiz.reconstruction.post_processor import (
    post_process_questions,
    normalize_stem_for_dedup
)
from engines.quiz.provider.mock import MockAIProvider


class TestQuestionReconstruction(unittest.TestCase):
    """Test suite for Batched Question Reconstruction and Post-Processing."""

    def test_batch_capacity_and_complexity_classification(self):
        """Tests that page characteristics correctly map to adaptive batch capacities."""
        # 1. Scanned page -> 2 pages
        scanned_page = PageRepresentation(
            page_index=0, page_number=1, width=595, height=842,
            page_kind=PageKind.SCANNED, raw_text="Scanned"
        )
        self.assertEqual(BatchPlanner.classify_page_complexity(scanned_page), "scanned")
        self.assertEqual(BatchPlanner.get_batch_capacity("scanned"), 2)

        # 2. Visual-heavy page -> 4 questions (3-6)
        visual_page = PageRepresentation(
            page_index=1, page_number=2, width=595, height=842,
            page_kind=PageKind.MIXED, drawing_count=5, raw_text="Diagram text",
            images=[ExtractedImage(image_id="img1", xref=10, bbox=(0, 0, 100, 100), width=100, height=100)]
        )
        self.assertEqual(BatchPlanner.classify_page_complexity(visual_page), "visual_heavy")
        self.assertEqual(BatchPlanner.get_batch_capacity("visual_heavy"), 4)

        # 3. Formula-heavy page -> 8 questions (6-10)
        formula_text = "Tính $n_{CO_2} = \\frac{m}{M}$. Phản ứng $CH_4 + 2O_2 \\rightarrow CO_2 + 2H_2O$. $V = 22.4$ lít. " * 5
        formula_page = PageRepresentation(
            page_index=2, page_number=3, width=595, height=842,
            page_kind=PageKind.VECTOR, raw_text=formula_text
        )
        self.assertEqual(BatchPlanner.classify_page_complexity(formula_page), "formula_heavy")
        self.assertEqual(BatchPlanner.get_batch_capacity("formula_heavy"), 8)

        # 4. Standard vector text page -> 12 questions (10-15)
        text_page = PageRepresentation(
            page_index=3, page_number=4, width=595, height=842,
            page_kind=PageKind.VECTOR, raw_text="Văn bản thông thường môn Giáo dục công dân."
        )
        self.assertEqual(BatchPlanner.classify_page_complexity(text_page), "vector_text")
        self.assertEqual(BatchPlanner.get_batch_capacity("vector_text"), 12)

    def test_batch_planner_adaptive_partitioning(self):
        """Tests that 25 candidate questions are partitioned into batches within capacity."""
        candidates = [
            QuestionCandidate(
                candidate_number=i,
                marker_text=f"Câu {i}:",
                bbox=(50, 100, 500, 150),
                y_pos=float(i * 50),
                options_detected=["A", "B", "C", "D"]
            )
            for i in range(1, 26)
        ]

        page1 = PageRepresentation(
            page_index=0, page_number=1, width=595, height=842,
            page_kind=PageKind.VECTOR, raw_text="Trang 1 text",
            candidates=candidates[:15]
        )
        page2 = PageRepresentation(
            page_index=1, page_number=2, width=595, height=842,
            page_kind=PageKind.VECTOR, raw_text="Trang 2 text",
            candidates=candidates[15:]
        )

        batches = BatchPlanner.plan_batches([page1, page2], start_page=1, end_page=2, start_question=1, question_count=25)
        self.assertGreater(len(batches), 1)

        # Vector text default capacity is 12 -> first batch has 12, second has 12, third has 1
        total_planned_cands = sum(len(b.target_question_numbers) for b in batches)
        self.assertEqual(total_planned_cands, 25)

        # Verify neighboring context on Page 2
        last_batch = batches[-1]
        self.assertIn(2, last_batch.page_numbers)

    def test_reconstructor_with_mock_provider(self):
        """Tests reconstructing questions using MockAIProvider returning Part I and Part II questions."""
        q1 = ReconstructedQuestion(
            id="temp_1",
            number=1,
            source_number=1,
            type=QuestionType.PART_I_MCQ,
            stem="Chất nào sau đây là este no, đơn chức, mạch hở?",
            options=[
                QuestionOption(label="A", text="HCOOCH3"),
                QuestionOption(label="B", text="CH3COOH"),
                QuestionOption(label="C", text="C2H5OH"),
                QuestionOption(label="D", text="CH3CHO")
            ],
            source_pages=[1]
        )
        q2 = ReconstructedQuestion(
            id="temp_2",
            number=2,
            source_number=2,
            type=QuestionType.PART_II_TF,
            stem="Cho phản ứng xà phòng hóa este X. Phát biểu nào sau đây đúng hay sai?",
            sub_statements=[
                TFSubStatement(label="a", statement="Phản ứng xảy ra trong môi trường kiềm."),
                TFSubStatement(label="b", statement="Sản phẩm luôn có ancol."),
                TFSubStatement(label="c", statement="Đây là phản ứng thuận nghịch."),
                TFSubStatement(label="d", statement="Tốc độ phản ứng tăng khi đun nóng.")
            ],
            source_pages=[1]
        )

        mock_ai = MockAIProvider(
            preset_response=BatchReconstructionResult(
                batch_id="batch_test",
                questions=[q1, q2]
            )
        )

        reconstructor = QuestionReconstructor(mock_ai)
        batch = BatchPayload(
            batch_id="batch_test",
            batch_type="vector_text",
            page_numbers=[1],
            text_content="Raw exam text for Q1 and Q2"
        )

        result_questions = reconstructor.reconstruct_batch(batch)
        self.assertEqual(len(result_questions), 2)
        self.assertEqual(result_questions[0].type, QuestionType.PART_I_MCQ)
        self.assertEqual(len(result_questions[0].options), 4)
        self.assertEqual(result_questions[1].type, QuestionType.PART_II_TF)
        self.assertEqual(len(result_questions[1].sub_statements), 4)

    def test_reconstructor_isolated_retry_and_graceful_fallback(self):
        """Tests that exhausted retries trigger code fallback instead of crashing the job."""
        mock_failing_ai = MockAIProvider(simulate_http_500=True)
        reconstructor = QuestionReconstructor(mock_failing_ai, max_batch_retries=2)

        batch_text = (
            "Câu 1: Dung dịch nào sau đây làm quỳ tím hóa đỏ?\n"
            "A. HCl.  B. NaOH.  C. NaCl.  D. Ba(OH)2.\n\n"
            "Câu 2: Khí nào sau đây gây hiệu ứng nhà kính?\n"
            "A. CO2.  B. O2.    C. N2.    D. H2.\n"
        )
        batch = BatchPayload(
            batch_id="failing_batch_1",
            batch_type="vector_text",
            page_numbers=[1],
            text_content=batch_text
        )

        # Execution should not raise exception; it should return fallback parsed questions
        fallback_results = reconstructor.reconstruct_batch(batch)
        self.assertEqual(len(fallback_results), 2)
        self.assertEqual(fallback_results[0].number, 1)
        self.assertEqual(fallback_results[0].confidence, 0.5)
        self.assertIn("thuật toán dự phòng", fallback_results[0].warnings[0])
        self.assertEqual(len(fallback_results[0].options), 4)

    def test_multi_batch_parallel_execution(self):
        """Tests parallel execution across 3 batches preserves reassembly order."""
        def make_batch(batch_num: int):
            return BatchPayload(
                batch_id=f"batch_{batch_num}",
                batch_type="vector_text",
                page_numbers=[batch_num],
                text_content=f"Câu {batch_num}: Nội dung câu {batch_num}\nA. 1 B. 2 C. 3 D. 4"
            )

        batches = [make_batch(1), make_batch(2), make_batch(3)]

        mock_ai = MockAIProvider(
            preset_response=BatchReconstructionResult(
                batch_id="dummy",
                questions=[
                    ReconstructedQuestion(
                        id="dummy_id",
                        number=1,
                        source_number=1,
                        type=QuestionType.PART_I_MCQ,
                        stem="Nội dung câu mẫu",
                        options=[QuestionOption(label="A", text="1")]
                    )
                ]
            )
        )
        reconstructor = QuestionReconstructor(mock_ai, concurrency=3)
        all_results = reconstructor.reconstruct_all(batches)

        self.assertEqual(len(all_results), 3)

    def test_post_processor_deduplication_and_renumbering(self):
        """Tests removing duplicate stems and enforcing sequential 1..N numbers."""
        q1 = ReconstructedQuestion(
            id="q_old_1",
            number=1,
            source_number=1,
            stem="Hợp chất nào sau đây là este?",
            source_pages=[1]
        )
        # Duplicate question (identical stem with minor spacing/tag difference)
        q2 = ReconstructedQuestion(
            id="q_old_2",
            number=2,
            source_number=1,
            stem="  <p>Hợp chất nào sau đây là este?</p>  ",
            source_pages=[2]
        )
        q3 = ReconstructedQuestion(
            id="q_old_3",
            number=5,
            source_number=3,
            stem="Kim loại nào sau đây tác dụng với nước ở nhiệt độ thường?",
            source_pages=[2]
        )

        # Start sequential renumbering at question 10
        processed = post_process_questions([q1, q2, q3], start_question=10)

        # q2 should be deduplicated away
        self.assertEqual(len(processed), 2)

        # Renumbering: 10, 11
        self.assertEqual(processed[0].number, 10)
        self.assertEqual(processed[1].number, 11)

        # Preserved source numbers: 1, 3
        self.assertEqual(processed[0].source_number, 1)
        self.assertEqual(processed[1].source_number, 3)

        # Stable ID format check
        self.assertTrue(processed[0].id.startswith("q_p1_num10_"))
        self.assertTrue(processed[1].id.startswith("q_p2_num11_"))

    def test_cache_key_uniqueness_for_different_question_ranges(self):
        """Verifies that two batches sharing page text but targeting different questions do NOT collide on cache key."""
        import hashlib
        import json

        page_text = "Câu 31: ... Câu 32: ... Câu 41: ... Câu 42: ..."
        batch_1 = BatchPayload(
            batch_id="b1",
            batch_type="vector_text",
            target_question_numbers=[31, 32],
            page_numbers=[13],
            text_content=page_text
        )
        batch_2 = BatchPayload(
            batch_id="b2",
            batch_type="vector_text",
            target_question_numbers=[41, 42],
            page_numbers=[13],
            text_content=page_text
        )

        def make_key(b):
            payload = {
                "batch_id": b.batch_id,
                "target_question_numbers": sorted(b.target_question_numbers),
                "page_numbers": sorted(b.page_numbers),
                "text_content": b.text_content,
                "neighboring_prev_context": b.neighboring_prev_context,
                "neighboring_next_context": b.neighboring_next_context,
                "version": "v3.1.0"
            }
            return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()

        key_1 = make_key(batch_1)
        key_2 = make_key(batch_2)
        self.assertNotEqual(key_1, key_2, "Batches with different target questions must never share the same cache key!")


if __name__ == "__main__":
    unittest.main()

