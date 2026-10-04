"""
Simulation and validation test script for WP4 Overlapped Printing Pipeline.
Tests the exact logic designed for quiz_pipeline.py and test_quiz_pipeline_v2.py.
"""

import os
import sys
import time
import json
import tempfile
import unittest
import concurrent.futures
from unittest.mock import patch, MagicMock

# Ensure engines/quiz is on path
ROOT_DIR = r"C:\Users\AnhDuy\Code\Project\DD Studio"
sys.path.insert(0, os.path.join(ROOT_DIR, "engines", "quiz"))

import quiz_pipeline


def generate_explanations(
    questions: list[dict],
    api_key: str,
    base_url: str = quiz_pipeline.DEFAULT_API_BASE,
    model: str = quiz_pipeline.DEFAULT_MODEL,
    batch_size: int = 5,
    max_workers: int = 4
) -> None:
    """
    Sinh lời giải cho từng câu, mutate IN-PLACE q["explanation"].
    Không raise khi một phần batch lỗi — các câu lỗi giữ explanation = "".
    """
    if not questions or not api_key:
        return

    batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]
    if not batches:
        return

    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to write concise, scientifically accurate step-by-step explanations for multiple-choice questions.\n"
        "Format chemical formulas using HTML <sub> and <sup>, and math with $...$.\n"
        "Return ONLY a valid JSON object: {\"explanations\": {\"<number>\": \"<explanation>\", ...}}"
    )

    def _build_phase2_prompt(batch: list[dict]) -> str:
        items = [
            {
                "number": q.get("number"),
                "question": q.get("question", ""),
                "options": dict(q.get("options", {})),
                "answer": q.get("answer", "")
            }
            for q in batch
        ]
        prompt = (
            "Với mỗi câu hỏi trắc nghiệm dưới đây (đã biết đáp án đúng), hãy viết lời giải "
            "ngắn gọn, chính xác về mặt khoa học, bằng tiếng Việt, 1-3 câu.\n"
            "Dùng HTML <sub>/<sup> cho công thức hoá học và $...$ cho biểu thức toán.\n"
            "Trả về ĐÚNG JSON: {\"explanations\": {\"<number>\": \"<lời giải>\", ...}}\n\n"
            "INPUT:\n"
            f"{json.dumps(items, ensure_ascii=False)}"
        )
        return prompt

    def _run_exp_batch(b_idx: int) -> dict:
        batch = batches[b_idx]
        user_prompt = _build_phase2_prompt(batch)
        res = quiz_pipeline.call_agnes_api(
            api_key, user_prompt, system_prompt,
            base_url=base_url, model=model, timeout=90
        )
        return res

    max_p = int(os.environ.get("QUIZ_AI_CONCURRENCY", str(max_workers)))
    effective_workers = min(max_p, max(1, len(batches)))

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as ex:
            fut_map = {ex.submit(_run_exp_batch, i): i for i in range(len(batches))}
            done_n = 0
            for fut in concurrent.futures.as_completed(fut_map):
                b_idx = fut_map[fut]
                batch = batches[b_idx]
                try:
                    res = fut.result()
                    exps = res.get("explanations", {}) if isinstance(res, dict) else {}
                    if not exps and isinstance(res, dict) and "questions" in res:
                        for item in res["questions"]:
                            if isinstance(item, dict) and "number" in item and "explanation" in item:
                                for q in batch:
                                    if q.get("number") == item["number"]:
                                        raw_e = str(item["explanation"]).strip()
                                        q["explanation"] = quiz_pipeline.strip_section_banner(raw_e)
                    elif isinstance(exps, dict):
                        for q in batch:
                            num = q.get("number")
                            raw_e = exps.get(str(num))
                            if raw_e is None:
                                raw_e = exps.get(num)
                            if raw_e and isinstance(raw_e, str):
                                q["explanation"] = quiz_pipeline.strip_section_banner(raw_e.strip())
                except Exception:
                    # Controlled degradation: batch failure leaves explanation = ""
                    pass
                done_n += 1
                quiz_pipeline.emit_progress(
                    int(72 + (done_n / len(batches)) * (80 - 72)),
                    f"Đang tạo lời giải chi tiết {done_n}/{len(batches)} gói..."
                )
    except Exception:
        pass


def _build_and_compile_worksheet(title, subtitle, questions, html_path, chrome, pdf_path):
    worksheet_html = quiz_pipeline.generate_worksheet_html(title, subtitle, questions)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(worksheet_html)
    quiz_pipeline.compile_pdf(chrome, html_path, pdf_path)


def _build_and_compile_answer(title, subtitle, questions, html_path, chrome, pdf_path):
    answer_html = quiz_pipeline.generate_answer_key_html(title, subtitle, questions)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(answer_html)
    quiz_pipeline.compile_pdf(chrome, html_path, pdf_path)


def simulated_run_pipeline(
    questions: list[dict],
    output_dir: str,
    clean_prefix: str = "test",
    title: str = "ĐỀ THI",
    subtitle: str = "",
    key: str = "test_key",
    base_url: str = quiz_pipeline.DEFAULT_API_BASE,
    model: str = quiz_pipeline.DEFAULT_MODEL,
    skip_exp: bool = False
):
    ws_html_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.html")
    ans_html_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.html")
    chrome = "mock-chrome"
    ws_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DeBai.pdf")
    ans_pdf_path = os.path.join(output_dir, f"{clean_prefix}_DapAn.pdf")

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_ws = executor.submit(
            _build_and_compile_worksheet,
            title, subtitle, questions, ws_html_path, chrome, ws_pdf_path
        )

        if not skip_exp and os.environ.get("QUIZ_SKIP_EXPLANATION") != "1":
            try:
                generate_explanations(questions, key, base_url=base_url, model=model)
            except Exception:
                pass

        f_ans = executor.submit(
            _build_and_compile_answer,
            title, subtitle, questions, ans_html_path, chrome, ans_pdf_path
        )

        curr_p = 82
        elapsed = 0
        while not (f_ws.done() and f_ans.done()):
            time.sleep(0.2)
            elapsed += 0.2
            if curr_p < 93 and int(elapsed * 5) % 5 == 0:
                curr_p += 1
            quiz_pipeline.emit_progress(curr_p, f"Đang xuất tệp PDF Đề bài và Đáp án qua Chrome ({int(elapsed)}s)...")

        f_ws.result()
        f_ans.result()

    return {
        "success": True,
        "worksheet_pdf": ws_pdf_path,
        "answer_pdf": ans_pdf_path,
        "questions": questions
    }


class TestWP4Simulation(unittest.TestCase):

    def test_worksheet_compile_overlaps_explanation_phase(self):
        """Test 1: Worksheet compile sleeps 5s, explanation sleeps 5s, total elapsed < 7s."""
        questions = [{
            "number": 1,
            "type": "mcq",
            "question": "Câu 1. Nguyên tố nào sau đây là kim loại kiềm?",
            "options": {"A": "Na", "B": "Mg", "C": "Al", "D": "Fe"},
            "answer": "A",
            "explanation": "",
            "image_ref": None
        }]

        def fake_compile(chrome, html_path, pdf_path):
            if "DeBai" in html_path:
                time.sleep(5.0)
            with open(pdf_path, "wb") as f:
                f.write(b"%PDF-1.4 mock")

        def fake_call_api(*args, **kwargs):
            time.sleep(5.0)
            return {"explanations": {"1": "Na thuộc nhóm IA trong bảng tuần hoàn."}}

        with patch("quiz_pipeline.compile_pdf", side_effect=fake_compile):
            with patch("quiz_pipeline.call_agnes_api", side_effect=fake_call_api):
                with tempfile.TemporaryDirectory() as tmp_dir:
                    t0 = time.time()
                    res = simulated_run_pipeline(questions, tmp_dir, clean_prefix="sim1")
                    elapsed = time.time() - t0

        self.assertTrue(res["success"])
        self.assertLess(elapsed, 7.0, f"Elapsed {elapsed:.2f}s should be < 7.0s due to concurrent overlap")
        self.assertGreaterEqual(elapsed, 4.8, f"Elapsed {elapsed:.2f}s should be >= 4.8s")

    def test_explanation_failure_does_not_fail_job(self):
        """Test 2: Complete phase 2 failure leaves explanations empty and succeeds."""
        questions = [{
            "number": 1,
            "type": "mcq",
            "question": "Câu 1. Nguyên tố nào sau đây là kim loại kiềm?",
            "options": {"A": "Na", "B": "Mg", "C": "Al", "D": "Fe"},
            "answer": "A",
            "explanation": "",
            "image_ref": None
        }]

        def fake_compile(chrome, html_path, pdf_path):
            with open(pdf_path, "wb") as f:
                f.write(b"%PDF-1.4 mock")

        with patch("quiz_pipeline.compile_pdf", side_effect=fake_compile):
            with patch("quiz_pipeline.call_agnes_api", side_effect=RuntimeError("AI API down")):
                with tempfile.TemporaryDirectory() as tmp_dir:
                    res = simulated_run_pipeline(questions, tmp_dir, clean_prefix="sim2")
                    self.assertTrue(res["success"])
                    self.assertTrue(os.path.exists(res["worksheet_pdf"]))
                    self.assertTrue(os.path.exists(res["answer_pdf"]))
                    self.assertEqual(res["questions"][0]["explanation"], "")

    def test_skip_explanation_env_flag(self):
        """Test 3: QUIZ_SKIP_EXPLANATION=1 skips Phase 2, 0 API calls."""
        questions = [{
            "number": 1,
            "type": "mcq",
            "question": "Câu 1. Kim loại?",
            "options": {"A": "Na", "B": "C", "C": "O", "D": "N"},
            "answer": "A",
            "explanation": "",
            "image_ref": None
        }]

        def fake_compile(chrome, html_path, pdf_path):
            with open(pdf_path, "wb") as f:
                f.write(b"%PDF-1.4 mock")

        with patch("quiz_pipeline.compile_pdf", side_effect=fake_compile):
            with patch("quiz_pipeline.call_agnes_api") as mock_api:
                with patch.dict(os.environ, {"QUIZ_SKIP_EXPLANATION": "1"}):
                    with tempfile.TemporaryDirectory() as tmp_dir:
                        res = simulated_run_pipeline(questions, tmp_dir, clean_prefix="sim3")

        self.assertTrue(res["success"])
        mock_api.assert_not_called()

    def test_answer_key_contains_explanations_when_phase2_succeeds(self):
        """Test 4: Answer key HTML contains generated explanation."""
        questions = [{
            "number": 1,
            "type": "mcq",
            "question": "Câu 1. Kim loại kiềm nào sau đây có tính khử mạnh nhất?",
            "options": {"A": "Li", "B": "Na", "C": "K", "D": "Cs"},
            "answer": "D",
            "explanation": "",
            "image_ref": None
        }]

        captured_html = {}

        def spy_compile(chrome, html_path, pdf_path):
            if "DapAn" in html_path:
                with open(html_path, "r", encoding="utf-8") as f:
                    captured_html["answer"] = f.read()
            with open(pdf_path, "wb") as f:
                f.write(b"%PDF-1.4 mock")

        explanation_text = "Cs có bán kính nguyên tử lớn nhất nên dễ nhường electron nhất."

        def fake_call_api(*args, **kwargs):
            return {"explanations": {"1": explanation_text}}

        with patch("quiz_pipeline.compile_pdf", side_effect=spy_compile):
            with patch("quiz_pipeline.call_agnes_api", side_effect=fake_call_api):
                with tempfile.TemporaryDirectory() as tmp_dir:
                    res = simulated_run_pipeline(questions, tmp_dir, clean_prefix="sim4")

        self.assertTrue(res["success"])
        self.assertIn("answer", captured_html)
        self.assertIn(explanation_text, captured_html["answer"])
        self.assertIn("<b>Hướng dẫn giải:</b>", captured_html["answer"])


if __name__ == "__main__":
    unittest.main()
