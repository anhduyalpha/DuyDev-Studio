#!/usr/bin/env python3
"""
ADVERSARIAL STRESS TEST SUITE: Quiz Pipeline v3.0 Milestone 2 (WP3 & WP8)
Challenger 1 Empirical Verification Suite.

Tests:
1. High-concurrency emit_progress: 100 concurrent threads emitting simultaneously with barrier release.
2. Truncated JSON salvage: extreme truncations (escaped quotes, mid-key, trailing commas,
   deeply nested braces, character-by-character slicing fuzzing, markdown fences, unrecoverable cases).
3. Out-of-order execution, random jitter, and race conditions in parse_and_standardize_questions.
"""

import concurrent.futures
import io
import json
import os
import random
import re
import sys
import threading
import time
import shutil
import tempfile
import unittest
from unittest.mock import patch, MagicMock

# Add paths for direct and package-level imports
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_CURRENT_DIR, "../.."))
if _CURRENT_DIR not in sys.path:
    sys.path.insert(0, _CURRENT_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

# Import modules under test
from quiz_pipeline import (
    emit_progress,
    _salvage_truncated_json,
    call_agnes_api,
    parse_and_standardize_questions,
    DEFAULT_API_BASE,
    DEFAULT_MODEL
)
from mcq_parser import parse_mcq_blocks



class TestAdversarialEmitProgress(unittest.TestCase):
    """Adversarial stress-testing of emit_progress thread safety."""

    def test_high_concurrency_100_threads_simultaneous_barrier(self):
        """
        Challenge 1: 100 concurrent threads release at the exact same instant
        via threading.Barrier, each emitting progress.
        Verify:
        - Exactly 100 lines on stdout.
        - Every single line is 100% valid parseable JSON.
        - Zero interleaving, line breakage, or corrupted tokens.
        """
        num_threads = 100
        barrier = threading.Barrier(num_threads)
        captured_lines = []
        lock = threading.Lock()

        # Capture stdout cleanly
        old_stdout = sys.stdout
        string_buf = io.StringIO()
        try:
            sys.stdout = string_buf

            def worker(thread_id: int):
                barrier.wait()  # Synchronize threads to release simultaneously
                emit_progress(thread_id % 100, f"Thread {thread_id} active")

            threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=10.0)

            output = string_buf.getvalue()
        finally:
            sys.stdout = old_stdout

        lines = [line.strip() for line in output.strip().splitlines() if line.strip()]
        self.assertEqual(len(lines), num_threads, f"Expected {num_threads} lines, got {len(lines)}")

        seen_stages = set()
        for idx, line in enumerate(lines):
            try:
                data = json.loads(line)
            except Exception as e:
                self.fail(f"Line {idx} failed to parse as valid JSON: {line!r}. Error: {e}")

            self.assertIn("progress", data)
            self.assertIn("stage", data)
            self.assertIsInstance(data["progress"], int)
            self.assertIsInstance(data["stage"], str)
            seen_stages.add(data["stage"])

        self.assertEqual(len(seen_stages), num_threads, "All 100 threads emitted distinct stages without collision.")

    def test_high_volume_500_emissions_multi_threaded(self):
        """Stress-test 50 threads each performing 10 rapid emissions (500 total)."""
        num_threads = 50
        emissions_per_thread = 10
        total_expected = num_threads * emissions_per_thread

        old_stdout = sys.stdout
        string_buf = io.StringIO()
        try:
            sys.stdout = string_buf

            def worker(tid: int):
                for step in range(emissions_per_thread):
                    pct = int((step / emissions_per_thread) * 100)
                    emit_progress(pct, f"Thread {tid} step {step} - complex chars: \"quotes\" & $x^2$")

            threads = [threading.Thread(target=worker, args=(i,)) for i in range(num_threads)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=15.0)

            output = string_buf.getvalue()
        finally:
            sys.stdout = old_stdout

        lines = [line.strip() for line in output.strip().splitlines() if line.strip()]
        self.assertEqual(len(lines), total_expected, f"Expected {total_expected} lines, got {len(lines)}")

        for idx, line in enumerate(lines):
            try:
                data = json.loads(line)
            except Exception as e:
                self.fail(f"Line {idx} corrupt: {line!r}. Error: {e}")
            self.assertIn("quotes", data["stage"])
            self.assertIn("$x^2$", data["stage"])


class TestAdversarialTruncatedJsonSalvage(unittest.TestCase):
    """Adversarial stress-testing of _salvage_truncated_json under crazy edge cases."""

    def test_truncation_mid_string_with_escaped_quotes(self):
        """Test salvage when truncated inside a string with escaped quotes."""
        raw = (
            '{\n'
            '  "questions": [\n'
            '    {\n'
            '      "number": 1,\n'
            '      "question": "Cho chất \\"X\\" tác dụng với \\"Y\\"",\n'
            '      "options": {"A": "1", "B": "2", "C": "3", "D": "4"},\n'
            '      "answer": "A"\n'
            '    },\n'
            '    {\n'
            '      "number": 2,\n'
            '      "question": "Tính giá trị của biểu thức \\"A + B\\" khi \\"C\\\\'
        )
        salvaged = _salvage_truncated_json(raw)
        self.assertIsNotNone(salvaged)
        self.assertEqual(len(salvaged["questions"]), 1)
        q1 = salvaged["questions"][0]
        self.assertEqual(q1["number"], 1)
        self.assertIn('"X"', q1["question"])

    def test_truncation_inside_option_keys(self):
        """Test salvage when cut off mid-way through an option key."""
        raw = (
            '{"questions": [\n'
            '  {"number": 1, "question": "Q1", "options": {"A": "one", "B": "two", "C": "three", "D": "four"}, "answer": "B"},\n'
            '  {"number": 2, "question": "Q2", "options": {"A": "first", "B'
        )
        salvaged = _salvage_truncated_json(raw)
        self.assertIsNotNone(salvaged)
        self.assertEqual(len(salvaged["questions"]), 1)
        self.assertEqual(salvaged["questions"][0]["number"], 1)

    def test_truncation_right_after_trailing_comma(self):
        """Test salvage when cut immediately after a comma or with trailing whitespace."""
        raw = (
            '{"questions": [\n'
            '  {"number": 1, "question": "Q1", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},\n'
            '  {"number": 2, "question": "Q2", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"},\n'
            '  \n\t  '
        )
        salvaged = _salvage_truncated_json(raw)
        self.assertIsNotNone(salvaged)
        self.assertEqual(len(salvaged["questions"]), 2)
        self.assertEqual(salvaged["questions"][0]["number"], 1)
        self.assertEqual(salvaged["questions"][1]["number"], 2)

    def test_deeply_nested_braces_in_stem_and_options(self):
        """Test salvage when stems and options contain mathematical set notation and nested braces."""
        raw = (
            '{\n'
            '  "questions": [\n'
            '    {\n'
            '      "number": 1,\n'
            '      "question": "Cho tập hợp $S = \\\\{x \\\\in \\\\mathbb{R} \\\\mid \\\\{y \\\\mid y > 0\\\\}\\\\}$",\n'
            '      "options": {"A": "$\\\\{1, \\\\{2, 3\\\\}\\\\}$", "B": "$\\\\{4\\\\}$", "C": "$\\\\emptyset$", "D": "$\\\\mathbb{R}$"},\n'
            '      "answer": "A"\n'
            '    },\n'
            '    {\n'
            '      "number": 2,\n'
            '      "question": "Hàm số f(x) = { 1 nếu x > 0, 0 nếu x = 0 }'
        )
        salvaged = _salvage_truncated_json(raw)
        self.assertIsNotNone(salvaged)
        self.assertEqual(len(salvaged["questions"]), 1)
        q1 = salvaged["questions"][0]
        self.assertIn("y > 0", q1["question"])
        self.assertIn("1,", q1["options"]["A"])

    def test_unclosed_markdown_fence(self):
        """Test salvage when LLM started with ```json fence but was cut off before closing fence."""
        raw = (
            '```json\n'
            '{\n'
            '  "questions": [\n'
            '    {"number": 1, "question": "Fence Q1", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "C"},\n'
            '    {"number": 2, "question": "Fence Q2", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "D"},\n'
            '    {"number": 3, "question": "Unfinished...'
        )
        salvaged = _salvage_truncated_json(raw)
        self.assertIsNotNone(salvaged)
        self.assertEqual(len(salvaged["questions"]), 2)
        self.assertEqual(salvaged["questions"][0]["number"], 1)
        self.assertEqual(salvaged["questions"][1]["number"], 2)

    def test_character_by_character_fuzzing(self):
        """
        Adversarial fuzzer: Take a complete 4-question JSON and truncate at every
        single character from len(text) down to 0.
        Verify:
        - NEVER crashes or raises an exception.
        - Either returns None (when 0 complete objects exist) or a valid dict.
        - When a dict is returned, data['questions'] has 1 to 4 valid question objects.
        """
        complete_json = json.dumps({
            "questions": [
                {"number": 1, "question": "Stem 1 with \"quotes\"", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                {"number": 2, "question": "Stem 2 with $x^2 + y^2 = 1$", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "answer": "B"},
                {"number": 3, "question": "Stem 3 with \\frac{a}{b}", "options": {"A": "x", "B": "y", "C": "z", "D": "w"}, "answer": "C"},
                {"number": 4, "question": "Stem 4 with [IMAGE_REF: fig.png]", "options": {"A": "m", "B": "n", "C": "p", "D": "q"}, "answer": "D"}
            ]
        }, indent=2, ensure_ascii=False)

        salvaged_count_history = []
        for cut_idx in range(len(complete_json), 0, -1):
            sub = complete_json[:cut_idx]
            try:
                result = _salvage_truncated_json(sub)
            except Exception as exc:
                self.fail(f"Crash in _salvage_truncated_json at cut_idx={cut_idx}: {exc}\nSubstring: {sub!r}")

            if result is not None:
                self.assertIsInstance(result, dict)
                self.assertIn("questions", result)
                self.assertIsInstance(result["questions"], list)
                self.assertGreater(len(result["questions"]), 0)
                self.assertLessEqual(len(result["questions"]), 4)
                salvaged_count_history.append(len(result["questions"]))

        # Verify that all question counts 4, 3, 2, 1 were successfully salvaged at various cut points
        self.assertIn(4, salvaged_count_history)
        self.assertIn(3, salvaged_count_history)
        self.assertIn(2, salvaged_count_history)
        self.assertIn(1, salvaged_count_history)

    def test_unrecoverable_pathological_inputs(self):
        """Verify that truly unrecoverable inputs gracefully return None."""
        unrecoverable = [
            "",
            "   \n\t  ",
            "not a json at all",
            "```json\n```",
            '{"status": "ok"}',
            '{"questions": []}',
            '{"questions": "not a list"}',
            '{"questions": [{"number": 1',  # cut mid-first object
            '{"questions": [{"number": 1, "question": "incomplete"',
            None,
            12345,
            {"already": "dict"}
        ]
        for item in unrecoverable:
            res = _salvage_truncated_json(item)
            self.assertIsNone(res, f"Expected None for unrecoverable input: {item!r}, got: {res}")


class TestAdversarialBatchConcurrencyAndRaces(unittest.TestCase):
    """Adversarial stress-testing of parse_and_standardize_questions concurrency & order invariants."""

    def setUp(self):
        self._test_cache_dir = tempfile.mkdtemp(prefix="quiz_adv_cache_")
        self._orig_cache_dir = os.environ.get("QUIZ_CACHE_DIR")
        os.environ["QUIZ_CACHE_DIR"] = self._test_cache_dir
        self.sample_text = "\n\n".join([
            f"Câu {i}: Nội dung câu hỏi số {i} về hoá học hữu cơ và phản ứng este hoá?\n"
            f"A. Đáp án A của câu {i}\nB. Đáp án B của câu {i}\nC. Đáp án C của câu {i}\nD. Đáp án D của câu {i}"
            for i in range(1, 26)  # 25 questions
        ])

    def tearDown(self):
        if self._orig_cache_dir is not None:
            os.environ["QUIZ_CACHE_DIR"] = self._orig_cache_dir
        else:
            os.environ.pop("QUIZ_CACHE_DIR", None)
        shutil.rmtree(self._test_cache_dir, ignore_errors=True)

    def test_out_of_order_completions_with_random_latencies(self):
        """
        Challenge 3A: 5 batches (25 questions total) complete in wildly random order.
        Batch 4 finishes first, Batch 0 finishes last.
        Verify:
        - Output is strictly monotonic 1..25 in original sequence.
        - Stems match their exact respective questions (Question 1 stem at index 0, Question 25 at index 24).
        - 0 duplications, 0 drops.
        """
        parsed_blocks = parse_mcq_blocks(self.sample_text)
        self.assertEqual(len(parsed_blocks), 25)

        def mock_call(api_key, user_prompt, system_prompt, **kwargs):
            # Parse which batch this was from user_prompt
            m = re.search(r'"number":\s*(\d+)', user_prompt)
            start_num = int(m.group(1)) if m else 1
            batch_idx = (start_num - 1) // 5

            # Randomize sleep to force out-of-order execution
            latencies = [0.15, 0.08, 0.01, 0.12, 0.02]  # batch 2 finishes first, then 4, 1, 3, 0
            time.sleep(latencies[batch_idx % len(latencies)])

            # Return questions for this batch
            return {
                "questions": [
                    {
                        "number": start_num + j,
                        "question": f"AI normalized Câu {start_num + j} stem",
                        "options": {"A": "Opt A", "B": "Opt B", "C": "Opt C", "D": "Opt D"},
                        "answer": "A",
                        "explanation": f"Giải thích cho câu {start_num + j}"
                    }
                    for j in range(5)
                ]
            }

        with patch("quiz_pipeline.call_agnes_api", side_effect=mock_call):
            with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "5"}):
                result = parse_and_standardize_questions(
                    raw_text=self.sample_text,
                    api_key="test_key",
                    count=25,
                    start_num=1,
                    parsed_blocks=parsed_blocks
                )

        self.assertEqual(len(result), 25)
        for i, q in enumerate(result):
            expected_num = 1 + i
            self.assertEqual(q["number"], expected_num, f"Question at index {i} has wrong number {q['number']}")
            self.assertEqual(q["question"], f"AI normalized Câu {expected_num} stem")

    def test_partial_batch_failures_race_and_degradation(self):
        """
        Challenge 3B: Mixed execution:
        - Batch 0: succeeds slowly (0.1s)
        - Batch 1: fails immediately with HTTP 500
        - Batch 2: succeeds fast (0.02s)
        - Batch 3: fails with timeout error
        - Batch 4: succeeds medium (0.05s)
        Verify:
        - Pipeline DOES NOT crash.
        - Exactly 25 questions returned, numbered 1..25.
        - Batches 0, 2, 4 have AI normalized content and explanations.
        - Batches 1 and 3 are degraded to pre-parser raw blocks with explanation == "".
        """
        parsed_blocks = parse_mcq_blocks(self.sample_text)

        def mock_call(api_key, user_prompt, system_prompt, **kwargs):
            m = re.search(r'"number":\s*(\d+)', user_prompt)
            start_num = int(m.group(1)) if m else 1
            b_idx = (start_num - 1) // 5

            if b_idx == 1:
                time.sleep(0.01)
                raise RuntimeError("Agnes AI API error (HTTP 500): Internal Server Error")
            elif b_idx == 3:
                time.sleep(0.04)
                raise TimeoutError("Connection timed out after 90s")
            elif b_idx == 0:
                time.sleep(0.1)
            elif b_idx == 2:
                time.sleep(0.02)
            else:
                time.sleep(0.05)

            return {
                "questions": [
                    {
                        "number": start_num + j,
                        "question": f"AI normalized Câu {start_num + j}",
                        "options": {"A": "A", "B": "B", "C": "C", "D": "D"},
                        "answer": "B",
                        "explanation": f"Lời giải câu {start_num + j}"
                    }
                    for j in range(5)
                ]
            }

        with patch("quiz_pipeline.call_agnes_api", side_effect=mock_call):
            with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "5"}):
                result = parse_and_standardize_questions(
                    raw_text=self.sample_text,
                    api_key="test_key",
                    count=25,
                    start_num=1,
                    parsed_blocks=parsed_blocks
                )

        self.assertEqual(len(result), 25)
        self.assertEqual([q["number"] for q in result], list(range(1, 26)))

        # Verify Batches 0, 2, 4 have AI content
        for q in result[0:5] + result[10:15] + result[20:25]:
            self.assertTrue(q["question"].startswith("AI normalized"))
            self.assertNotEqual(q["explanation"], "")

        # Verify Batches 1 and 3 (indices 5-9 and 15-19) are degraded fallbacks
        for q in result[5:10] + result[15:20]:
            self.assertFalse(q["question"].startswith("AI normalized"))
            self.assertEqual(q["explanation"], "")

    def test_high_concurrency_stress_50_questions_10_batches(self):
        """
        Challenge 3C: High concurrency stress: 50 questions (10 batches of 5),
        QUIZ_AI_CONCURRENCY=8, random latencies between 0.01s and 0.08s.
        Verify zero race conditions under 8 worker threads.
        """
        big_text = "\n\n".join([
            f"Câu {i}: Đề bài câu {i} với công thức hoá học C2H5OH và phản ứng đốt cháy?\n"
            f"A. 1\nB. 2\nC. 3\nD. 4"
            for i in range(1, 51)  # 50 questions
        ])
        parsed_blocks = parse_mcq_blocks(big_text)
        self.assertEqual(len(parsed_blocks), 50)

        def mock_call(api_key, user_prompt, system_prompt, **kwargs):
            m = re.search(r'"number":\s*(\d+)', user_prompt)
            start_num = int(m.group(1)) if m else 1
            time.sleep(random.uniform(0.01, 0.06))
            return {
                "questions": [
                    {
                        "number": start_num + j,
                        "question": f"High concurrency Q{start_num + j}",
                        "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
                        "answer": "C"
                    }
                    for j in range(5)
                ]
            }

        with patch("quiz_pipeline.call_agnes_api", side_effect=mock_call):
            with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "8"}):
                result = parse_and_standardize_questions(
                    raw_text=big_text,
                    api_key="test_key",
                    count=50,
                    start_num=101,  # Offset start number
                    parsed_blocks=parsed_blocks
                )

        self.assertEqual(len(result), 50)
        self.assertEqual([q["number"] for q in result], list(range(101, 151)))

    def test_out_of_order_dedup_preserves_first_encountered_in_batch_sequence(self):
        """
        Challenge 3D: Out-of-order completion with duplicate stems across batches.
        Batch 1 completes FIRST with a stem duplicate of Batch 0.
        Verify that deduplication preserves the canonical batch sequence (Batch 0 first),
        and questions are correctly renumbered 1..N.
        """
        parsed_blocks = parse_mcq_blocks(self.sample_text)

        def mock_call(api_key, user_prompt, system_prompt, **kwargs):
            m = re.search(r'"number":\s*(\d+)', user_prompt)
            start_num = int(m.group(1)) if m else 1
            b_idx = (start_num - 1) // 5

            if b_idx == 1:
                time.sleep(0.01)  # Finishes first
                return {
                    "questions": [
                        # Question 6 is a duplicate of Question 1 from Batch 0
                        {"number": 6, "question": "Nội dung câu hỏi số 1 về hoá học hữu cơ và phản ứng este hoá?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                        {"number": 7, "question": "Unique stem 7", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"},
                        {"number": 8, "question": "Unique stem 8", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "C"},
                        {"number": 9, "question": "Unique stem 9", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "D"},
                        {"number": 10, "question": "Unique stem 10", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                    ]
                }
            else:
                time.sleep(0.08)  # Batch 0 finishes later
                return {
                    "questions": [
                        {"number": 1, "question": "Nội dung câu hỏi số 1 về hoá học hữu cơ và phản ứng este hoá?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                        {"number": 2, "question": "Unique stem 2", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"},
                        {"number": 3, "question": "Unique stem 3", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "C"},
                        {"number": 4, "question": "Unique stem 4", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "D"},
                        {"number": 5, "question": "Unique stem 5", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                    ]
                }

        with patch("quiz_pipeline.call_agnes_api", side_effect=mock_call):
            with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "2"}):
                result = parse_and_standardize_questions(
                    raw_text=self.sample_text,
                    api_key="test_key",
                    count=10,
                    start_num=1,
                    parsed_blocks=parsed_blocks[:10]
                )

        # 1 duplicate was removed -> 9 questions remain
        self.assertEqual(len(result), 9)
        self.assertEqual([q["number"] for q in result], list(range(1, 10)))
        # Verify no duplicate stems exist
        stems = [q["question"] for q in result]
        self.assertEqual(len(stems), len(set(stems)))

    def test_concurrency_one_deterministic_sequential(self):
        """Challenge 3E: When QUIZ_AI_CONCURRENCY=1, execution is strictly sequential and fully correct."""
        parsed_blocks = parse_mcq_blocks(self.sample_text)

        call_order = []

        def mock_call(api_key, user_prompt, system_prompt, **kwargs):
            m = re.search(r'"number":\s*(\d+)', user_prompt)
            start_num = int(m.group(1)) if m else 1
            call_order.append(start_num)
            return {
                "questions": [
                    {"number": start_num + j, "question": f"Seq Q{start_num + j}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}
                    for j in range(5)
                ]
            }

        with patch("quiz_pipeline.call_agnes_api", side_effect=mock_call):
            with patch.dict(os.environ, {"QUIZ_AI_CONCURRENCY": "1"}):
                result = parse_and_standardize_questions(
                    raw_text=self.sample_text,
                    api_key="test_key",
                    count=15,
                    start_num=1,
                    parsed_blocks=parsed_blocks[:15]
                )

        self.assertEqual(len(result), 15)
        self.assertEqual([q["number"] for q in result], list(range(1, 16)))
        self.assertEqual(call_order, [1, 6, 11])


if __name__ == "__main__":
    unittest.main()

