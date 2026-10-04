"""
Validation script for generate_explanations logic
"""
import sys
import os
import json
import re
import unittest
from unittest.mock import patch, MagicMock

# Add engines/quiz to path
sys.path.insert(0, os.path.abspath(r"C:\Users\AnhDuy\Code\Project\DD Studio\engines\quiz"))

from text_utils import strip_section_banner
import quiz_pipeline
from quiz_pipeline import emit_progress, DEFAULT_API_BASE, DEFAULT_MODEL


def _build_phase2_prompt(batch_slice: list[dict]) -> str:
    """Build compact Phase 2 prompt for explanation generation (stem + options + answer)."""
    items = []
    for q in batch_slice:
        opts = q.get("options", {})
        if not isinstance(opts, dict):
            opts = {}
        items.append({
            "number": q.get("number"),
            "question": q.get("question", ""),
            "options": dict(opts),
            "answer": q.get("answer", "")
        })

    prompt = (
        "Với mỗi câu hỏi trắc nghiệm dưới đây (đã biết đáp án đúng), hãy viết lời giải "
        "ngắn gọn, chính xác về mặt khoa học, bằng tiếng Việt, 1-3 câu.\n"
        "Dùng HTML <sub>/<sup> cho công thức hoá học và $...$ cho biểu thức toán.\n"
        'Trả về ĐÚNG JSON: {"explanations": {"<number>": "<lời giải>"}}\n\n'
        "INPUT:\n"
        f"{json.dumps(items, ensure_ascii=False)}"
    )
    return prompt


def _parse_explanations_response(res: dict | None) -> dict[str, str]:
    """
    Safely parse AI response into a mapping of str(question_number) -> explanation text.
    Handles standard {"explanations": {"<num>": "<text>"}}, list representations,
    and number-prefixed keys like "Câu 1".
    """
    parsed_map: dict[str, str] = {}
    if not res or not isinstance(res, dict):
        return parsed_map

    exp_data = None
    if "explanations" in res:
        exp_data = res["explanations"]
    elif "questions" in res and isinstance(res["questions"], list):
        for item in res["questions"]:
            if isinstance(item, dict) and "number" in item:
                num = item.get("number")
                text = item.get("explanation") or item.get("text") or ""
                parsed_map[str(num)] = str(text).strip()
        return parsed_map
    else:
        exp_data = res

    if isinstance(exp_data, dict):
        for k, v in exp_data.items():
            m = re.search(r"\d+", str(k))
            clean_k = m.group(0) if m else str(k).strip()
            if isinstance(v, str):
                parsed_map[clean_k] = v.strip()
            elif isinstance(v, dict):
                text = v.get("explanation") or v.get("text") or v.get("content") or ""
                parsed_map[clean_k] = str(text).strip()
            elif v is not None:
                parsed_map[clean_k] = str(v).strip()
    elif isinstance(exp_data, list):
        for item in exp_data:
            if isinstance(item, dict):
                num = item.get("number")
                text = item.get("explanation") or item.get("text") or item.get("content") or ""
                if num is not None:
                    parsed_map[str(num)] = str(text).strip()

    return parsed_map


def generate_explanations(
    questions: list[dict],
    api_key: str,
    base_url: str = DEFAULT_API_BASE,
    model: str = DEFAULT_MODEL,
    batch_size: int = 5,
    max_workers: int = 4
) -> None:
    """
    Generate detailed explanations for questions in Phase 2, mutating q["explanation"] IN-PLACE.
    Never raises an exception on partial or total failure; failed questions retain explanation = "".
    """
    if not questions:
        return

    # Ensure all questions have an explanation field initialized
    for q in questions:
        if "explanation" not in q or q["explanation"] is None:
            q["explanation"] = ""

    if not api_key:
        emit_progress(80, "Bỏ qua tạo lời giải chi tiết (thiếu API key)...")
        return

    system_prompt = (
        "You are an expert Vietnamese exam editor and master teacher.\n"
        "Your task is to write concise, scientifically accurate explanations in Vietnamese (1-3 sentences) "
        "for the provided multiple-choice questions with known correct answers.\n"
        "Use HTML <sub>/<sup> for chemical formulas and $...$ for mathematical expressions.\n"
        'Return ONLY a valid JSON object matching: {"explanations": {"<number>": "<lời giải>"}}'
    )

    batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]
    total_batches = len(batches)
    if total_batches == 0:
        return

    import concurrent.futures
    concurrency_env = os.environ.get("QUIZ_AI_CONCURRENCY")
    effective_workers = int(concurrency_env) if concurrency_env else max_workers
    actual_workers = min(max(1, effective_workers), total_batches)

    def _run_exp_batch(b_idx: int) -> dict[str, str]:
        b_slice = batches[b_idx]
        user_prompt = _build_phase2_prompt(b_slice)
        res = quiz_pipeline.call_agnes_api(
            api_key, user_prompt, system_prompt,
            base_url=base_url, model=model, timeout=90
        )
        return _parse_explanations_response(res)

    errors: dict[int, Exception] = {}
    start_prog = 72
    max_prog = 80
    prog_range = max_prog - start_prog

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=actual_workers) as ex:
            fut_map = {ex.submit(_run_exp_batch, i): i for i in range(total_batches)}
            done_n = 0
            for fut in concurrent.futures.as_completed(fut_map):
                b_idx = fut_map[fut]
                try:
                    exp_map = fut.result()
                    for q in batches[b_idx]:
                        q_num_str = str(q.get("number"))
                        if q_num_str in exp_map and exp_map[q_num_str]:
                            raw_exp = exp_map[q_num_str]
                            q["explanation"] = strip_section_banner(raw_exp).strip()
                except Exception as e:
                    errors[b_idx] = e
                done_n += 1
                pct = int(start_prog + (done_n / total_batches) * prog_range)
                emit_progress(
                    pct,
                    f"Đang viết lời giải chi tiết {done_n}/{total_batches} gói "
                    f"({min(done_n * batch_size, len(questions))}/{len(questions)} câu)..."
                )
    except Exception:
        emit_progress(80, "Không thể tạo lời giải chi tiết, dùng bảng đáp án rút gọn...")
        return

    if errors:
        if len(errors) == total_batches:
            emit_progress(80, "Không thể tạo lời giải chi tiết, dùng bảng đáp án rút gọn...")
        else:
            emit_progress(80, f"Đã viết xong lời giải, {len(errors)}/{total_batches} gói dùng đáp án rút gọn...")


class TestGenerateExplanations(unittest.TestCase):

    def setUp(self):
        self.sample_questions = [
            {"number": 1, "question": "HCHC X có CTPT C2H6O", "options": {"A": "ancol", "B": "axit", "C": "este", "D": "anđehit"}, "answer": "A", "explanation": ""},
            {"number": 2, "question": "Kim loại nào dẫn điện tốt nhất?", "options": {"A": "Cu", "B": "Ag", "C": "Au", "D": "Al"}, "answer": "B", "explanation": ""},
            {"number": 3, "question": "Chất nào là chất điện ly mạnh?", "options": {"A": "NaCl", "B": "CH3COOH", "C": "H2O", "D": "C2H5OH"}, "answer": "A", "explanation": ""},
        ]

    @patch("quiz_pipeline.call_agnes_api")
    def test_in_place_mutation_success(self, mock_api):
        mock_api.return_value = {
            "explanations": {
                "1": "C2H6O ứng với ancol etylic C2H5OH.",
                "2": "Bạc (Ag) dẫn điện tốt nhất.",
                "3": "NaCl phân li hoàn toàn trong nước."
            }
        }
        qs = [dict(q) for q in self.sample_questions]
        ret = generate_explanations(qs, "dummy_key", batch_size=5)
        self.assertIsNone(ret)
        self.assertEqual(qs[0]["explanation"], "C2H6O ứng với ancol etylic C2H5OH.")
        self.assertEqual(qs[1]["explanation"], "Bạc (Ag) dẫn điện tốt nhất.")
        self.assertEqual(qs[2]["explanation"], "NaCl phân li hoàn toàn trong nước.")

    @patch("quiz_pipeline.call_agnes_api")
    def test_batching_multiple_slices(self, mock_api):
        qs = [
            {"number": i, "question": f"Câu {i}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A", "explanation": ""}
            for i in range(1, 13)
        ]
        def side_effect(key, prompt, system_prompt, **kwargs):
            m = re.findall(r'"number":\s*(\d+)', prompt)
            return {"explanations": {n: f"Giải thích {n}" for n in m}}

        mock_api.side_effect = side_effect
        generate_explanations(qs, "dummy_key", batch_size=5, max_workers=2)
        self.assertEqual(mock_api.call_count, 3) # 5 + 5 + 2
        for q in qs:
            self.assertEqual(q["explanation"], f"Giải thích {q['number']}")

    @patch("quiz_pipeline.call_agnes_api")
    def test_partial_failure_graceful_degradation(self, mock_api):
        qs = [
            {"number": i, "question": f"Câu {i}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A", "explanation": ""}
            for i in range(1, 11)
        ]
        def side_effect(key, prompt, system_prompt, **kwargs):
            if '"number": 1' in prompt:
                return {"explanations": {str(i): f"Giải thích {i}" for i in range(1, 6)}}
            else:
                raise RuntimeError("Agnes API 500 Server Error")

        mock_api.side_effect = side_effect
        # Must not raise
        generate_explanations(qs, "dummy_key", batch_size=5)
        for i in range(5):
            self.assertEqual(qs[i]["explanation"], f"Giải thích {i + 1}")
        for i in range(5, 10):
            self.assertEqual(qs[i]["explanation"], "")

    @patch("quiz_pipeline.call_agnes_api")
    def test_total_failure_graceful_degradation(self, mock_api):
        qs = [dict(q) for q in self.sample_questions]
        mock_api.side_effect = RuntimeError("Network unreachable")
        generate_explanations(qs, "dummy_key", batch_size=5)
        for q in qs:
            self.assertEqual(q["explanation"], "")

    @patch("quiz_pipeline.call_agnes_api")
    def test_flexible_parsing_formats(self, mock_api):
        # Format 1: "Câu 1" keys
        mock_api.return_value = {"explanations": {"Câu 1": "Exp 1", "Câu 2": "Exp 2", "3": "Exp 3"}}
        qs1 = [dict(q) for q in self.sample_questions]
        generate_explanations(qs1, "dummy_key")
        self.assertEqual(qs1[0]["explanation"], "Exp 1")
        self.assertEqual(qs1[1]["explanation"], "Exp 2")
        self.assertEqual(qs1[2]["explanation"], "Exp 3")

        # Format 2: list of dicts
        mock_api.return_value = {"explanations": [{"number": 1, "explanation": "Exp L1"}, {"number": 2, "explanation": "Exp L2"}]}
        qs2 = [dict(q) for q in self.sample_questions]
        generate_explanations(qs2, "dummy_key")
        self.assertEqual(qs2[0]["explanation"], "Exp L1")
        self.assertEqual(qs2[1]["explanation"], "Exp L2")
        self.assertEqual(qs2[2]["explanation"], "")  # q3 missing from response

        # Format 3: root level numeric keys
        mock_api.return_value = {"1": "Root 1", "2": "Root 2", "3": "Root 3"}
        qs3 = [dict(q) for q in self.sample_questions]
        generate_explanations(qs3, "dummy_key")
        self.assertEqual(qs3[0]["explanation"], "Root 1")
        self.assertEqual(qs3[1]["explanation"], "Root 2")
        self.assertEqual(qs3[2]["explanation"], "Root 3")

    @patch("quiz_pipeline.call_agnes_api")
    def test_empty_questions_and_empty_key(self, mock_api):
        empty_qs = []
        generate_explanations(empty_qs, "dummy_key")
        self.assertEqual(mock_api.call_count, 0)

        qs = [dict(q) for q in self.sample_questions]
        generate_explanations(qs, "")
        self.assertEqual(mock_api.call_count, 0)
        self.assertTrue(all(q["explanation"] == "" for q in qs))

    @patch("quiz_pipeline.call_agnes_api")
    def test_compact_prompt_tokens(self, mock_api):
        mock_api.return_value = {"explanations": {"1": "ok"}}
        qs = [{
            "number": 1,
            "question": "Question text",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "answer": "A",
            "image_ref": "fig_p1_1.png",
            "raw": "Câu 1. Raw text...",
            "explanation": ""
        }]
        generate_explanations(qs, "dummy_key")
        user_prompt = mock_api.call_args[0][1]
        self.assertNotIn("fig_p1_1.png", user_prompt)
        self.assertNotIn("Raw text", user_prompt)
        self.assertIn("Question text", user_prompt)
        self.assertIn("A", user_prompt)


    @patch("quiz_pipeline.call_agnes_api")
    def test_non_unit_start_number(self, mock_api):
        mock_api.return_value = {
            "explanations": {
                "Câu 18": "Exp 18",
                "19": "Exp 19",
                "20": "Exp 20"
            }
        }
        qs = [
            {"number": 18, "question": "Q18", "options": {"A": "1"}, "answer": "A", "explanation": ""},
            {"number": 19, "question": "Q19", "options": {"A": "1"}, "answer": "A", "explanation": ""},
            {"number": 20, "question": "Q20", "options": {"A": "1"}, "answer": "A", "explanation": ""},
        ]
        generate_explanations(qs, "dummy_key")
        self.assertEqual(qs[0]["explanation"], "Exp 18")
        self.assertEqual(qs[1]["explanation"], "Exp 19")
        self.assertEqual(qs[2]["explanation"], "Exp 20")


if __name__ == "__main__":
    unittest.main()

