# -*- coding: utf-8 -*-
"""
Empirical Adversarial Stress Harness for Quiz Pipeline v3.0 (Milestone 1 / WP2).
Authored by Challenger 2 (critic, specialist).

Tests:
1. SHA1 Dedup with HTML tag variations, prefix variations, whitespace, and case variations.
2. Chaotic and out-of-order AI question numbering (overwritten by monotonic sequence).
3. Clamping when requested count > available questions.
4. Offset start_num sequential numbering.
5. Zero questions fast-fail with 0 AI API calls.
6. Visual asset mapping integrity under renumbering and spatial matching.
7. Extreme adversarial AI payloads (excess questions, malformed schemas).
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from quiz_pipeline import (
    parse_and_standardize_questions,
    link_assets_to_questions,
    _stem_fingerprint,
    normalize_question
)
from mcq_parser import parse_mcq_blocks


class TestAdversarialQuizWP2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_cache_disabled = os.environ.get("QUIZ_CACHE_DISABLED")
        os.environ["QUIZ_CACHE_DISABLED"] = "1"

    @classmethod
    def tearDownClass(cls):
        if cls._orig_cache_disabled is not None:
            os.environ["QUIZ_CACHE_DISABLED"] = cls._orig_cache_disabled
        else:
            os.environ.pop("QUIZ_CACHE_DISABLED", None)

    # =========================================================================
    # CATEGORY 1: SHA1 Dedup & Stem Normalization
    # =========================================================================

    def test_dedup_html_chemistry_tags(self):
        """Verify that CH<sub>4</sub> and CH4 produce identical SHA1 fingerprints."""
        q1 = {"question": "Khí CH<sub>4</sub> có tác dụng gì trong công nghiệp?"}
        q2 = {"question": "Khí CH4 có tác dụng gì trong công nghiệp?"}
        self.assertEqual(_stem_fingerprint(q1), _stem_fingerprint(q2))

    def test_dedup_complex_nested_html_tags(self):
        """Verify complex nested HTML tags are stripped before hashing."""
        q1 = {"question": "<p>Ion <span class='chem'>Fe<sup>3+</sup></span> tác dụng với <b>NaOH</b></p>"}
        q2 = {"question": "Ion Fe3+ tác dụng với NaOH"}
        self.assertEqual(_stem_fingerprint(q1), _stem_fingerprint(q2))

    def test_dedup_numbering_prefixes_stripped(self):
        """Verify prefixes like 'Câu 1:', '1.', 'Câu 10.' are stripped to prevent duplicates."""
        q1 = {"question": "Câu 1: Chất nào sau đây là ancol no, đơn chức?"}
        q2 = {"question": "1. Chất nào sau đây là ancol no, đơn chức?"}
        q3 = {"question": "Chất nào sau đây là ancol no, đơn chức?"}
        self.assertEqual(_stem_fingerprint(q1), _stem_fingerprint(q2))
        self.assertEqual(_stem_fingerprint(q2), _stem_fingerprint(q3))

    def test_dedup_whitespace_and_newlines(self):
        """Verify irregular whitespace and newlines are normalized."""
        q1 = {"question": "Kim loại   Fe  tác dụng với\n dung dịch   HCl"}
        q2 = {"question": "Kim loại Fe tác dụng với dung dịch HCl"}
        self.assertEqual(_stem_fingerprint(q1), _stem_fingerprint(q2))

    def test_dedup_case_insensitive(self):
        """Verify stem fingerprints are case-insensitive."""
        q1 = {"question": "CHO CÁC CHẤT SAU ĐÂY..."}
        q2 = {"question": "Cho các chất sau đây..."}
        self.assertEqual(_stem_fingerprint(q1), _stem_fingerprint(q2))

    def test_dedup_distinct_stems_not_colliding(self):
        """Verify different chemical compounds (ankan vs anken) have different fingerprints."""
        q1 = {"question": "Chất nào sau đây là ankan?"}
        q2 = {"question": "Chất nào sau đây là anken?"}
        self.assertNotEqual(_stem_fingerprint(q1), _stem_fingerprint(q2))

    @patch("quiz_pipeline.call_agnes_api")
    def test_dedup_across_batches_in_pipeline(self, mock_api):
        """Adversarial AI returns a duplicate in batch 2 with differing HTML tags."""
        raw_text = (
            "Câu 1. Khí CH4 là gì?\nA. Ankan\nB. Anken\nC. Ankin\nD. Aren\n\n"
            "Câu 2. Khí C2H4 là gì?\nA. Anken\nB. Ankan\nC. Ankin\nD. Aren\n\n"
            "Câu 3. Khí C2H2 là gì?\nA. Ankin\nB. Anken\nC. Ankan\nD. Aren\n\n"
            "Câu 4. Khí C6H6 là gì?\nA. Aren\nB. Ankan\nC. Anken\nD. Ankin\n\n"
            "Câu 5. Khí C3H8 là gì?\nA. Ankan\nB. Anken\nC. Ankin\nD. Aren\n\n"
            "Câu 6. Khí C4H10 là gì?\nA. Ankan\nB. Anken\nC. Ankin\nD. Aren\n\n"
        )
        # Batch 1 (5 questions): returns Q1..Q5
        # Batch 2 (1 question): adversarial AI repeats Q1 with CH<sub>4</sub>
        mock_api.side_effect = [
            {
                "questions": [
                    {"number": 1, "question": "Khí CH4 là gì?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                    {"number": 2, "question": "Khí C2H4 là gì?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                    {"number": 3, "question": "Khí C2H2 là gì?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                    {"number": 4, "question": "Khí C6H6 là gì?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                    {"number": 5, "question": "Khí C3H8 là gì?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                ]
            },
            {
                "questions": [
                    {"number": 6, "question": "Khí CH<sub>4</sub> là gì?", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                ]
            }
        ]

        result = parse_and_standardize_questions(raw_text, "fake-key", count=6, start_num=1)
        # The duplicate in batch 2 should be deduped out, leaving 5 questions
        self.assertEqual(len(result), 5)
        # Numbers must still be 1..5 sequentially
        self.assertEqual([q["number"] for q in result], [1, 2, 3, 4, 5])
        # Stem must only appear once
        stems = [q["question"] for q in result]
        self.assertEqual(len(set(stems)), 5)

    # =========================================================================
    # CATEGORY 2: Chaotic / Out-of-Order Numbering Overwrite
    # =========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    def test_chaotic_ai_numbers_overwritten(self, mock_api):
        """Verify adversarial numbers [999, -5, 'abc', None, 42] are strictly overwritten."""
        raw_text = (
            "Câu 1. A\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 2. B\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 3. C\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 4. D\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 5. E\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
        )
        mock_api.return_value = {
            "questions": [
                {"number": 999, "question": "Stem 1", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                {"number": -5, "question": "Stem 2", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "B"},
                {"number": "abc", "question": "Stem 3", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "C"},
                {"number": None, "question": "Stem 4", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "D"},
                {"number": 42, "question": "Stem 5", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
            ]
        }

        result = parse_and_standardize_questions(raw_text, "fake-key", count=5, start_num=10)
        self.assertEqual(len(result), 5)
        self.assertEqual([q["number"] for q in result], [10, 11, 12, 13, 14])

    @patch("quiz_pipeline.call_agnes_api")
    def test_reverse_ai_numbers_overwritten(self, mock_api):
        """Verify reverse order [5, 4, 3, 2, 1] is renumbered monotonically."""
        raw_text = (
            "Câu 1. A\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 2. B\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 3. C\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
        )
        mock_api.return_value = {
            "questions": [
                {"number": 3, "question": "Stem 1", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "A"},
                {"number": 2, "question": "Stem 2", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "B"},
                {"number": 1, "question": "Stem 3", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "C"},
            ]
        }
        result = parse_and_standardize_questions(raw_text, "fake-key", count=3, start_num=1)
        self.assertEqual([q["number"] for q in result], [1, 2, 3])

    # =========================================================================
    # CATEGORY 3: Requested Count > Available Questions Clamping
    # =========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    def test_count_100_on_3_questions(self, mock_api):
        """Requested count=100 on input text with only 3 questions -> returns strictly 3."""
        raw_text = (
            "Câu 1. Question one?\nA. A\nB. B\nC. C\nD. D\n\n"
            "Câu 2. Question two?\nA. A\nB. B\nC. C\nD. D\n\n"
            "Câu 3. Question three?\nA. A\nB. B\nC. C\nD. D\n\n"
        )
        mock_api.return_value = {
            "questions": [
                {"number": 1, "question": "Question one?", "options": {"A": "A", "B": "B", "C": "C", "D": "D"}, "answer": "A"},
                {"number": 2, "question": "Question two?", "options": {"A": "A", "B": "B", "C": "C", "D": "D"}, "answer": "B"},
                {"number": 3, "question": "Question three?", "options": {"A": "A", "B": "B", "C": "C", "D": "D"}, "answer": "C"},
            ]
        }
        result = parse_and_standardize_questions(raw_text, "fake-key", count=100, start_num=1)
        self.assertEqual(len(result), 3)
        self.assertEqual([q["number"] for q in result], [1, 2, 3])
        # Only 1 API call because effective_count=3 <= BATCH_SIZE(5)
        self.assertEqual(mock_api.call_count, 1)

    # =========================================================================
    # CATEGORY 4: Offset Start Number (start_num)
    # =========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    def test_offset_start_num_50_with_7_questions(self, mock_api):
        """Requested start_num=50 with 7 questions -> numbered 50..56."""
        raw_text = "\n\n".join(
            f"Câu {i}. Nội dung câu {i}\nA. 1\nB. 2\nC. 3\nD. 4" for i in range(1, 8)
        )
        mock_api.side_effect = [
            {
                "questions": [
                    {"number": 50 + j, "question": f"Nội dung câu {j+1}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                    for j in range(5)
                ]
            },
            {
                "questions": [
                    {"number": 55 + j, "question": f"Nội dung câu {5+j+1}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                    for j in range(2)
                ]
            }
        ]

        result = parse_and_standardize_questions(raw_text, "fake-key", count=10, start_num=50)
        self.assertEqual(len(result), 7)
        self.assertEqual([q["number"] for q in result], [50, 51, 52, 53, 54, 55, 56])
        self.assertEqual(mock_api.call_count, 2)

    # =========================================================================
    # CATEGORY 5: Fast-Fail on Zero Questions
    # =========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    def test_zero_questions_fast_fail_zero_api_calls(self, mock_api):
        """Input with 0 questions must fast-fail before any mock API call."""
        raw_text = "SỞ GIÁO DỤC VÀ ĐÀO TẠO HÀ NỘI\nĐỀ THI KHẢO SÁT CHẤT LƯỢNG HỌC KÌ II\nNĂM HỌC 2025-2026\n"
        with self.assertRaises(RuntimeError) as ctx:
            parse_and_standardize_questions(raw_text, "fake-key", count=20, start_num=1, pages_desc="Trang 1")

        self.assertIn("Không có câu hỏi trong Trang 1, vui lòng chọn lại.", str(ctx.exception))
        self.assertEqual(mock_api.call_count, 0)

    @patch("quiz_pipeline.call_agnes_api")
    def test_empty_string_fast_fail(self, mock_api):
        """Empty string input must fast-fail with 0 API calls."""
        with self.assertRaises(RuntimeError) as ctx:
            parse_and_standardize_questions("", "fake-key", count=20, start_num=1)
        self.assertIn("Không có câu hỏi trong trang đã chọn, vui lòng chọn lại.", str(ctx.exception))
        self.assertEqual(mock_api.call_count, 0)

    # =========================================================================
    # CATEGORY 6: Visual Asset Mapping Integrity Under Renumbering
    # =========================================================================

    def test_asset_mapping_with_source_number_renumbering(self):
        """
        Verify that link_assets_to_questions correctly maps assets based on
        source_nums even when questions have been sequentially renumbered.
        """
        # Questions in source PDF were originally Câu 15, 16, 17
        # In asset_map: fig_p2_1 was attached to source question 16
        asset_map = {"fig_p2_1": 16}
        assets = [
            {"id": "fig_p2_1", "name": "fig_p2_1.png", "data_uri": "data:image/png;base64,AAA"}
        ]
        # After parse_and_standardize_questions, questions are renumbered to 1, 2, 3
        questions = [
            {"number": 1, "question": "Question A", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}},
            {"number": 2, "question": "Question B", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}},
            {"number": 3, "question": "Question C", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}},
        ]
        # source_nums passed from parsed_blocks
        source_nums = [15, 16, 17]

        link_assets_to_questions(questions, assets, asset_map, source_nums)

        # Question at index 1 (new number=2, was source 16) must receive the asset
        self.assertIsNone(questions[0].get("image_ref"))
        self.assertIsNone(questions[0].get("image_data"))

        self.assertEqual(questions[1]["image_ref"], "fig_p2_1.png")
        self.assertEqual(questions[1]["image_data"], "data:image/png;base64,AAA")

        self.assertIsNone(questions[2].get("image_ref"))
        self.assertIsNone(questions[2].get("image_data"))

    def test_asset_mapping_multiple_assets_preserved_accurately(self):
        """Verify multiple assets mapped across different source numbers."""
        asset_map = {"fig_p1_1": 10, "fig_p1_2": 12, "fig_p2_1": 15}
        assets = [
            {"id": "fig_p1_1", "data_uri": "data:1"},
            {"id": "fig_p1_2", "data_uri": "data:2"},
            {"id": "fig_p2_1", "data_uri": "data:3"},
        ]
        questions = [
            {"number": 1, "question": "Q1", "options": {}}, # source 10 -> fig_p1_1
            {"number": 2, "question": "Q2", "options": {}}, # source 11 -> None
            {"number": 3, "question": "Q3", "options": {}}, # source 12 -> fig_p1_2
            {"number": 4, "question": "Q4", "options": {}}, # source 13 -> None
            {"number": 5, "question": "Q5", "options": {}}, # source 14 -> None
            {"number": 6, "question": "Q6", "options": {}}, # source 15 -> fig_p2_1
        ]
        source_nums = [10, 11, 12, 13, 14, 15]

        link_assets_to_questions(questions, assets, asset_map, source_nums)

        self.assertEqual(questions[0]["image_ref"], "fig_p1_1.png")
        self.assertIsNone(questions[1].get("image_ref"))
        self.assertEqual(questions[2]["image_ref"], "fig_p1_2.png")
        self.assertIsNone(questions[3].get("image_ref"))
        self.assertIsNone(questions[4].get("image_ref"))
        self.assertEqual(questions[5]["image_ref"], "fig_p2_1.png")

    def test_asset_mapping_direct_ai_match(self):
        """Direct AI image_ref match takes precedence and resolves data_uri."""
        assets = [
            {"id": "fig_p1_1", "name": "fig_p1_1.png", "data_uri": "data:image/png;base64,BBB"}
        ]
        questions = [
            {"number": 1, "image_ref": "fig_p1_1", "question": "Xem hình...", "options": {}},
        ]
        link_assets_to_questions(questions, assets, {}, [1])
        self.assertEqual(questions[0]["image_ref"], "fig_p1_1.png")
        self.assertEqual(questions[0]["image_data"], "data:image/png;base64,BBB")

    def test_asset_mapping_text_marker_fallback(self):
        """Text marker [IMAGE_REF: fig_p5_2] inside question is mapped and stripped."""
        assets = [
            {"id": "fig_p5_2", "name": "fig_p5_2.png", "data_uri": "data:image/png;base64,CCC"}
        ]
        questions = [
            {"number": 1, "question": "Cho đồ thị [IMAGE_REF: fig_p5_2] sau đây:", "options": {}},
        ]
        link_assets_to_questions(questions, assets, {}, [1])
        self.assertEqual(questions[0]["image_ref"], "fig_p5_2.png")
        self.assertEqual(questions[0]["image_data"], "data:image/png;base64,CCC")
        # Ensure marker is purged from question text
        self.assertNotIn("[IMAGE_REF:", questions[0]["question"])

    def test_asset_mapping_banner_is_ignored_by_spatial_map(self):
        """Banner assets (is_banner: True) are ignored by spatial and index mapping."""
        assets = [
            {"id": "banner_1", "is_banner": True, "data_uri": "data:image/png;base64,BANNER"}
        ]
        questions = [
            {"number": 1, "question": "Nội dung câu hỏi lý thuyết:", "options": {}},
        ]
        # Even if asset_map attempts to map banner_1 to question 1
        link_assets_to_questions(questions, assets, {"banner_1": 1}, [1])
        self.assertIsNone(questions[0].get("image_ref"))
        self.assertIsNone(questions[0].get("image_data"))

    # =========================================================================
    # CATEGORY 7: Adversarial AI Payloads (Clamping & Malformed Schemas)
    # =========================================================================

    @patch("quiz_pipeline.call_agnes_api")
    def test_ai_returns_more_questions_than_requested(self, mock_api):
        """AI returning 7 questions when batch was for 3 -> clamped to effective_count."""
        raw_text = (
            "Câu 1. A\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 2. B\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 3. C\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
        )
        # AI returns 7 questions instead of 3
        mock_api.return_value = {
            "questions": [
                {"number": i, "question": f"Question {i}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                for i in range(1, 8)
            ]
        }
        result = parse_and_standardize_questions(raw_text, "fake-key", count=3, start_num=1)
        self.assertEqual(len(result), 3)
        self.assertEqual([q["number"] for q in result], [1, 2, 3])

    def test_normalize_question_defensive_against_malformed_ai_payload(self):
        """normalize_question handles completely empty / corrupted dicts gracefully."""
        # Non-dict input
        q1 = normalize_question("not-a-dict", fallback_num=5)
        self.assertEqual(q1["number"], 5)
        self.assertEqual(q1["type"], "mcq")

        # Missing options, None values -> sets 4 default option keys A, B, C, D
        q2 = normalize_question({"number": "invalid", "question": None, "options": None}, fallback_num=7)
        self.assertEqual(q2["number"], 7)
        self.assertEqual(q2["question"], "None")
        self.assertEqual(q2["options"], {"A": "", "B": "", "C": "", "D": ""})


if __name__ == "__main__":
    unittest.main()
