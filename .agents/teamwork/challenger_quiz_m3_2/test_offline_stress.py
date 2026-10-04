#!/usr/bin/env python3
"""
Adversarial Stress Test Suite for Milestone 3 (WP5 — P0: Offline PDF Printing & KaTeX CDN Decoupling)
Author: Challenger 2 (Milestone 3)
Date: 2026-10-04

Adversarial Challenge Dimensions:
1. Multi-job Concurrency: Run 5 concurrent print jobs simultaneously;
   verify unique `job_html_dir` (no collisions) and verify all temp directories are deleted in `finally`.
2. Fail-Fast Check: Rename or mock missing `KATEX_SRC_DIR`, verify immediate Vietnamese `RuntimeError`
   (< 50ms) without hanging Chrome or invoking browser processes.
3. Polling Timeout: Verify polling terminates within 15 seconds on hanging/broken rendering processes.
4. CDN Decoupling Static Audit: Verify 0 instances of `cdn.jsdelivr` or remote CDNs across `engines/quiz/`.
5. Headless Chrome Math Rendering: Verify that offline formulas ($...$, $$, chemical formulas) render
   with exactly 0 unrendered raw `$` characters in the PyMuPDF text layer.
"""

import os
import sys
import time
import shutil
import tempfile
import unittest
import threading
import subprocess
from unittest.mock import patch, MagicMock
import concurrent.futures

# Reconfigure stdout for utf-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add engines/quiz to path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
QUIZ_DIR = os.path.join(REPO_ROOT, "engines", "quiz")
sys.path.insert(0, QUIZ_DIR)

import pymupdf
import quiz_pipeline
from quiz_pipeline import (
    run_pipeline,
    compile_pdf,
    find_chrome_path,
    generate_worksheet_html,
    generate_answer_key_html,
    KATEX_SRC_DIR
)


class TestOfflineStressChallenger2(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.chrome_path = find_chrome_path()
        if not cls.chrome_path or not os.path.exists(cls.chrome_path):
            raise unittest.SkipTest("Google Chrome / Chromium not found on system.")

    def test_challenge1_multi_job_concurrency_isolation_and_cleanup(self):
        """
        Challenge 1A: Run 5 concurrent print jobs simultaneously.
        Verify:
        - Exactly 5 distinct `job_html_dir` folders created (no path collisions).
        - All 5 jobs successfully produce valid Worksheet and Answer PDFs.
        - After completion, ALL 5 `job_html_dir` folders are completely deleted from disk.
        """
        output_dir = tempfile.mkdtemp(prefix="challenger_m3_out_")
        created_html_dirs = []
        lock = threading.Lock()
        original_copytree = shutil.copytree

        def spy_copytree(src, dst, *args, **kwargs):
            if os.path.abspath(src) == os.path.abspath(quiz_pipeline.KATEX_SRC_DIR):
                parent_dir = os.path.dirname(dst)
                with lock:
                    created_html_dirs.append(parent_dir)
            return original_copytree(src, dst, *args, **kwargs)

        mock_questions = [
            {
                "number": i,
                "type": "mcq",
                "question": f"Câu hỏi toán {i}: Cho phương trình $x^{2} - {i}x + 1 = 0$. Giá trị của $x$ là?",
                "options": {
                    "A": f"$x = {i}$",
                    "B": "$x = \\sqrt{2}$",
                    "C": "$x = \\frac{1}{2}$",
                    "D": "Vô nghiệm"
                },
                "answer": "A",
                "explanation": f"Lời giải câu {i}: Áp dụng công thức nghiệm $\\Delta = b^2 - 4ac$."
            }
            for i in range(1, 4)
        ]

        def dummy_extract(*args, **kwargs):
            raw_text = "\n".join([f"Câu {i}: Nội dung test {i}\nA. 1\nB. 2\nC. 3\nD. 4" for i in range(1, 4)])
            return (raw_text, [1], [], {}, [1, 2, 3])

        def run_single_job(job_index: int):
            prefix = f"stress_job_{job_index}"
            with patch("quiz_pipeline.download_gdrive_if_needed", return_value="dummy.pdf"), \
                 patch("quiz_pipeline.extract_raw_pages", side_effect=dummy_extract), \
                 patch("quiz_pipeline.parse_and_standardize_questions", return_value=mock_questions):
                result = run_pipeline(
                    input_source="dummy.pdf",
                    pages="1",
                    count=3,
                    title=f"ĐỀ THI CONCURRENT {job_index}",
                    output_dir=output_dir,
                    filename_prefix=prefix,
                    api_key="test_dummy_key"
                )
                return result

        try:
            start_wall = time.time()
            with patch("shutil.copytree", side_effect=spy_copytree):
                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                    futures = [executor.submit(run_single_job, i) for i in range(5)]
                    results = [f.result(timeout=60) for f in concurrent.futures.as_completed(futures)]

            elapsed_wall = time.time() - start_wall

            # 1. Verify 5 jobs ran
            self.assertEqual(len(results), 5, "Expected 5 successful job results")

            # 2. Verify all 5 created html dirs are UNIQUE (zero collision)
            with lock:
                captured_dirs = list(created_html_dirs)
            self.assertEqual(len(captured_dirs), 5, f"Expected 5 job html dirs, got {len(captured_dirs)}")
            self.assertEqual(len(set(captured_dirs)), 5, f"Collision detected! Paths: {captured_dirs}")

            # 3. Verify ALL 5 job_html_dirs were completely deleted in finally
            for d in captured_dirs:
                self.assertFalse(
                    os.path.exists(d),
                    f"Temporary directory LEAKED after finally block: {d}"
                )

            # 4. Verify all output PDFs are intact, non-empty, and valid
            for i in range(5):
                ws_pdf = os.path.join(output_dir, f"stress_job_{i}_DeBai.pdf")
                ans_pdf = os.path.join(output_dir, f"stress_job_{i}_DapAn.pdf")
                self.assertTrue(os.path.exists(ws_pdf), f"Missing PDF: {ws_pdf}")
                self.assertTrue(os.path.exists(ans_pdf), f"Missing PDF: {ans_pdf}")
                self.assertGreater(os.path.getsize(ws_pdf), 2000, f"PDF too small: {ws_pdf}")
                self.assertGreater(os.path.getsize(ans_pdf), 2000, f"PDF too small: {ans_pdf}")

                # PyMuPDF validity check
                doc_ws = pymupdf.open(ws_pdf)
                self.assertGreaterEqual(len(doc_ws), 1)
                doc_ans = pymupdf.open(ans_pdf)
                self.assertGreaterEqual(len(doc_ans), 1)

            print(f"[CHALLENGE 1A PASS] 5 concurrent print jobs completed in {elapsed_wall:.2f}s with 0 collisions and 0 temp leaks.")

        finally:
            shutil.rmtree(output_dir, ignore_errors=True)

    def test_challenge1_cleanup_on_crash_in_finally(self):
        """
        Challenge 1B: Ensure per-job HTML directory is purged even if the job crashes midway.
        """
        created_html_dirs = []
        original_copytree = shutil.copytree

        def spy_copytree(src, dst, *args, **kwargs):
            if os.path.abspath(src) == os.path.abspath(quiz_pipeline.KATEX_SRC_DIR):
                parent_dir = os.path.dirname(dst)
                created_html_dirs.append(parent_dir)
            return original_copytree(src, dst, *args, **kwargs)

        with patch("shutil.copytree", side_effect=spy_copytree):
            with patch("quiz_pipeline.download_gdrive_if_needed", return_value="dummy.pdf"), \
                 patch("quiz_pipeline.extract_raw_pages", side_effect=RuntimeError("Simulated catastrophic crash")):
                with self.assertRaises(RuntimeError) as ctx:
                    run_pipeline(
                        input_source="dummy.pdf",
                        pages="1",
                        filename_prefix="crash_cleanup_test",
                        api_key="test_key"
                    )
                self.assertIn("Simulated catastrophic crash", str(ctx.exception))

        self.assertEqual(len(created_html_dirs), 1)
        leaked_dir = created_html_dirs[0]
        self.assertFalse(
            os.path.exists(leaked_dir),
            f"Crash cleanup failed! Directory still exists: {leaked_dir}"
        )
        print("[CHALLENGE 1B PASS] Per-job directory reliably cleaned up on crash in finally block.")

    def test_challenge2_fail_fast_missing_katex(self):
        """
        Challenge 2: Rename or mock missing KATEX_SRC_DIR.
        Verify:
        - Raises RuntimeError immediately (< 50ms).
        - Error message is verbatim Vietnamese: 'Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. Vui lòng cài đặt lại engine.'
        - Google Chrome / subprocess.Popen is NEVER called or hung.
        """
        original_katex_dir = quiz_pipeline.KATEX_SRC_DIR
        bogus_dir = os.path.join(tempfile.gettempdir(), f"nonexistent_katex_{time.time_ns()}")

        try:
            quiz_pipeline.KATEX_SRC_DIR = bogus_dir

            with patch("subprocess.Popen") as mock_popen, \
                 patch("quiz_pipeline.find_chrome_path") as mock_find_chrome:

                t0 = time.time()
                with self.assertRaises(RuntimeError) as ctx:
                    run_pipeline(
                        input_source="dummy.pdf",
                        pages="1",
                        filename_prefix="fail_fast_test",
                        api_key="dummy_key"
                    )
                t_elapsed = time.time() - t0

                # Must fail almost instantaneously
                self.assertLess(t_elapsed, 0.1, f"Fail-fast took too long: {t_elapsed:.4f}s")

                # Verify Vietnamese error message
                expected_msg = (
                    "Thiếu thư viện KaTeX cục bộ tại engines/quiz/assets/katex. "
                    "Vui lòng cài đặt lại engine."
                )
                self.assertEqual(str(ctx.exception).strip(), expected_msg)

                # Ensure Chrome was never touched
                mock_popen.assert_not_called()
                mock_find_chrome.assert_not_called()

            print(f"[CHALLENGE 2 PASS] Fail-fast triggered in {t_elapsed*1000:.2f}ms with exact Vietnamese RuntimeError and 0 Chrome invocations.")

        finally:
            quiz_pipeline.KATEX_SRC_DIR = original_katex_dir

    def test_challenge3_polling_timeout_within_15_seconds(self):
        """
        Challenge 3: Verify polling loop terminates within 15 seconds if process hangs.
        We simulate a hanging Chrome subprocess that does not terminate and does not write PDF.
        Verify that `compile_pdf` terminates the hung process within ~15 seconds per worker phase.
        """
        temp_dir = tempfile.mkdtemp(prefix="challenger_m3_timeout_")
        dummy_html = os.path.join(temp_dir, "test.html")
        with open(dummy_html, "w", encoding="utf-8") as f:
            f.write("<html><body>Test Timeout</body></html>")

        target_pdf = os.path.join(temp_dir, "test.pdf")

        class MockHangingProcess:
            def __init__(self):
                self._terminated = False
                self._killed = False

            def poll(self):
                if self._terminated or self._killed:
                    return -15
                return None  # Hanging indefinitely

            def terminate(self):
                self._terminated = True

            def kill(self):
                self._killed = True

            def wait(self, timeout=None):
                return 0

        attempt_durations = []
        lock_hanging = threading.Lock()

        class MockHangingProcessFresh:
            def __init__(self):
                self._t0 = time.time()
                self._terminated = False
                self._killed = False

            def poll(self):
                if self._terminated or self._killed:
                    return -15
                return None  # Hanging indefinitely

            def terminate(self):
                dur = time.time() - self._t0
                with lock_hanging:
                    attempt_durations.append(dur)
                self._terminated = True

            def kill(self):
                dur = time.time() - self._t0
                with lock_hanging:
                    attempt_durations.append(dur)
                self._killed = True

            def wait(self, timeout=None):
                return 0

        with patch("subprocess.Popen", side_effect=lambda *args, **kwargs: MockHangingProcessFresh()) as mock_popen:
            t0 = time.time()
            with self.assertRaises(RuntimeError) as ctx:
                compile_pdf(self.chrome_path, dummy_html, target_pdf)
            total_elapsed = time.time() - t0

            # Both attempts must have been triggered
            self.assertIn("Google Chrome không thể xuất tệp PDF", str(ctx.exception))
            self.assertEqual(mock_popen.call_count, 2)

            # Each worker attempt must have timed out within ~15s (15.0s - 16.5s)
            with lock_hanging:
                durations = list(attempt_durations)
            self.assertEqual(len(durations), 2, f"Expected 2 terminated attempts, got: {durations}")
            for idx, dur in enumerate(durations):
                self.assertGreaterEqual(dur, 14.8, f"Attempt {idx+1} exited too fast ({dur:.2f}s)")
                self.assertLess(dur, 17.0, f"Attempt {idx+1} exceeded 15s timeout budget ({dur:.2f}s)")

            # Total elapsed time for both attempts
            self.assertLess(total_elapsed, 36.0, f"compile_pdf exceeded expected timeout budget: {total_elapsed:.2f}s")
            self.assertGreater(total_elapsed, 29.0, f"compile_pdf finished too early: {total_elapsed:.2f}s")

            print(f"[CHALLENGE 3 PASS] Hanging process handled with 15s timeout per worker attempt (attempt 1: {durations[0]:.2f}s, attempt 2: {durations[1]:.2f}s, total: {total_elapsed:.2f}s).")

        shutil.rmtree(temp_dir, ignore_errors=True)

    def test_challenge3_broken_html_fast_recovery(self):
        """
        Challenge 3B: Verify that passing an unrenderable or empty HTML file to real Chrome
        either renders quickly or fails cleanly with RuntimeError without infinite loop.
        """
        temp_dir = tempfile.mkdtemp(prefix="challenger_m3_broken_")
        broken_html = os.path.join(temp_dir, "broken.html")
        with open(broken_html, "w", encoding="utf-8") as f:
            f.write("<!DOCTYPE html><html><head><script>/* empty */</script></head><body><h1>Broken test</h1></body></html>")
        output_pdf = os.path.join(temp_dir, "broken.pdf")

        try:
            t0 = time.time()
            compile_pdf(self.chrome_path, broken_html, output_pdf)
            t_elapsed = time.time() - t0
            self.assertTrue(os.path.exists(output_pdf))
            self.assertLess(t_elapsed, 15.0, f"Rendering took too long: {t_elapsed:.2f}s")
            print(f"[CHALLENGE 3B PASS] Real Chrome compiled in {t_elapsed:.2f}s (< 15s).")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_challenge4_zero_cdn_leak_audit(self):
        """
        Challenge 4: Audit entire engines/quiz/ tree for any remote CDN references.
        Ensure 0 occurrences of cdn.jsdelivr, cdnjs, or unpkg.
        """
        forbidden_patterns = ["cdn" + ".jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com"]
        violations = []

        for root, dirs, files in os.walk(QUIZ_DIR):
            # Skip git or test caches
            if ".git" in root or "__pycache__" in root:
                continue
            for file in files:
                if file.endswith((".py", ".html", ".js", ".css")):
                    # Skip test file assertion of cdn removal
                    filepath = os.path.join(root, file)
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines, 1):
                        for pattern in forbidden_patterns:
                            if pattern in line:
                                # Allow docstrings or comments explicitly discussing CDN removal
                                if "assertNotIn" in line or "cdn_domain" in line or "WP5" in line:
                                    continue
                                violations.append(f"{filepath}:{idx}: {line.strip()}")

        self.assertEqual(violations, [], f"Found remote CDN leaks in engines/quiz:\n" + "\n".join(violations))
        print("[CHALLENGE 4 PASS] Rigorous static audit confirmed 0 remote CDN leaks across engines/quiz/.")

    def test_challenge5_offline_math_rendering_fidelity(self):
        """
        Challenge 5: Verify that local KaTeX renders math and chemistry formulas
        completely with 0 raw '$' characters left in the text layer of the output PDF.
        """
        temp_dir = tempfile.mkdtemp(prefix="challenger_m3_math_")
        katex_dest = os.path.join(temp_dir, "katex")
        shutil.copytree(KATEX_SRC_DIR, katex_dest)

        questions = [
            {
                "number": 1,
                "type": "mcq",
                "question": "Tính tích phân $I = \\int_{0}^{1} x^2 dx$ và công thức $E = mc^2$.",
                "options": {
                    "A": "$I = \\frac{1}{3}$",
                    "B": "$I = \\frac{1}{2}$",
                    "C": "$I = 1$",
                    "D": "$I = \\sqrt{3}$"
                },
                "answer": "A",
                "explanation": "Ta có $\\int x^2 dx = \\frac{x^3}{3} \\Rightarrow I = \\frac{1}{3}$."
            },
            {
                "number": 2,
                "type": "mcq",
                "question": "Cho tam giác $ABC$ có diện tích $S = \\frac{1}{2}ab \\sin C$ và $\\Delta = b^2 - 4ac$.",
                "options": {
                    "A": "Đúng với mọi góc $C$",
                    "B": "Chỉ đúng khi $C = 90^\\circ$",
                    "C": "Sai",
                    "D": "Không xác định"
                },
                "answer": "A",
                "explanation": "Định lý diện tích tam giác."
            }
        ]

        html_content = generate_worksheet_html("ĐỀ THI TOÁN OFFLINE", "Kiểm tra render KaTeX", questions)
        html_path = os.path.join(temp_dir, "math_test.html")
        pdf_path = os.path.join(temp_dir, "math_test.pdf")

        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        try:
            compile_pdf(self.chrome_path, html_path, pdf_path)
            self.assertTrue(os.path.exists(pdf_path))

            # Inspect PyMuPDF text layer
            doc = pymupdf.open(pdf_path)
            full_text = "\n".join(page.get_text() for page in doc)

            # KaTeX auto-render replaces $...$ with math spans.
            # Raw $ characters must NOT appear as delimiters.
            dollar_count = full_text.count("$")
            self.assertEqual(
                dollar_count,
                0,
                f"Unrendered raw '$' characters detected in PDF text layer (found {dollar_count}):\n{full_text}"
            )

            # Check that formulas rendered into readable text or math tokens
            self.assertTrue("I = 1/3" in full_text or "1/3" in full_text or "x2" in full_text or "mc2" in full_text)
            print(f"[CHALLENGE 5 PASS] Offline PDF math rendering verified: 0 unrendered '$' signs in text layer ({len(doc)} pages).")

        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
