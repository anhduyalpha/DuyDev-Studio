import sys
import os
import json
import threading
import time
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath("engines/quiz"))
from quiz_pipeline import (
    _salvage_truncated_json,
    _guess_answer_from_raw,
    _build_phase1_prompt,
    _stem_fingerprint,
    emit_progress,
    call_agnes_api,
    parse_and_standardize_questions,
    DEFAULT_API_KEY
)

def run_stress_tests():
    print("=== TEST SUITE: FORENSIC STRESS TESTING ===")
    
    # 1. DEFAULT_API_KEY security check
    assert DEFAULT_API_KEY == "", f"DEFAULT_API_KEY must be empty string, got: {DEFAULT_API_KEY}"
    print("[PASS] Security: DEFAULT_API_KEY is empty string.")

    # 2. _salvage_truncated_json with quotes, math, chemical formulas
    raw = '''{
      "questions": [
        {
          "number": 1,
          "type": "mcq",
          "question": "Câu 1: Hàm số $y = \\frac{x+1}{x-1}$ có tiệm cận?",
          "options": {"A": "x = 1", "B": "y = 1", "C": "Cả hai", "D": "Không có"},
          "answer": "C"
        },
        {
          "number": 2,
          "type": "mcq",
          "question": "Câu 2: Cho biết \\"chất X\\" tác dụng với $H_2SO_4$?",
          "options": {"A": "Fe", "B": "Cu", "C": "Ag", "D": "Au"},
          "answer": "A"
        },
        {
          "number": 3,
          "type": "mcq",
          "question": "Câu 3: Đang cắt dở
    '''
    res = _salvage_truncated_json(raw)
    assert res is not None, "Failed to salvage valid prefix"
    assert len(res["questions"]) == 2, f"Expected 2 questions, got {len(res['questions'])}"
    assert res["questions"][0]["number"] == 1
    assert res["questions"][1]["number"] == 2
    assert res["questions"][1]["options"]["A"] == "Fe"
    print("[PASS] Salvage: Handled escaped quotes and formulas correctly.")

    # 3. _salvage_truncated_json with markdown code fence
    raw_fenced = """```json
    {
      "questions": [
        {"number": 1, "type": "mcq", "question": "Q1", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
        {"number": 2, "type": "mcq", "question": "Q2...
    ```"""
    res_fenced = _salvage_truncated_json(raw_fenced)
    assert res_fenced is not None
    assert len(res_fenced["questions"]) == 1
    print("[PASS] Salvage: Handled code fences correctly.")

    # 4. _salvage_truncated_json unrecoverable edge cases
    assert _salvage_truncated_json('{"questions": []}') is None
    assert _salvage_truncated_json('{"other": [1, 2, 3]}') is None
    assert _salvage_truncated_json("Plain text with no JSON") is None
    assert _salvage_truncated_json("") is None
    assert _salvage_truncated_json(None) is None
    print("[PASS] Salvage: Unrecoverable JSON returns None gracefully.")

    # 5. _guess_answer_from_raw
    assert _guess_answer_from_raw("Câu 1. Đáp án: B") == "B"
    assert _guess_answer_from_raw("Câu 2. Answer. C") == "C"
    assert _guess_answer_from_raw("Câu 3. Không có đáp án") == "A"
    assert _guess_answer_from_raw(None) == "A"
    print("[PASS] Answer guessing: Correctly extracts keys or falls back to 'A'.")

    # 6. _stem_fingerprint deduplication invariant
    q_a = {"question": "Câu 1. Cho hỗn hợp gồm <b>Fe</b> và Cu..."}
    q_b = {"question": "Câu 15. Cho hỗn hợp gồm Fe và Cu..."}
    q_c = {"question": "Câu 1. Cho hỗn hợp gồm Al và Cu..."}
    assert _stem_fingerprint(q_a) == _stem_fingerprint(q_b), "Stem fingerprints should match after stripping question numbers and HTML tags"
    assert _stem_fingerprint(q_a) != _stem_fingerprint(q_c), "Different question stems should have distinct fingerprints"
    print("[PASS] Deduplication: Fingerprint is immune to question numbering and HTML tags.")

    # 7. Thread safety of emit_progress
    stdout_collector = []
    lock = threading.Lock()
    real_print = print

    # Monkeypatch print temporarily to capture emit_progress output
    def mock_print(*args, **kwargs):
        with lock:
            stdout_collector.append(args[0])

    with patch("builtins.print", side_effect=mock_print):
        threads = []
        for i in range(100):
            t = threading.Thread(target=emit_progress, args=(i, f"Stage {i}"))
            threads.append(t)
        for t in threads:
            t.start()
        for t in threads:
            t.join()

    assert len(stdout_collector) == 100
    for line in stdout_collector:
        parsed = json.loads(line)
        assert "progress" in parsed and "stage" in parsed
    print("[PASS] Thread safety: 100 concurrent emit_progress calls produced 100 uncorrupted JSON lines.")

    # 8. Controlled degradation in parse_and_standardize_questions
    raw_text = "\n\n".join(
        f"Câu {i}: Đề bài câu hỏi số {i}.\nA. 1\nB. 2\nC. 3\nD. 4"
        for i in range(1, 16)
    ) # 15 questions = 3 batches of 5

    call_counter = [0]
    def mock_api_batch(api_key, user_prompt, system_prompt, **kwargs):
        call_counter[0] += 1
        # Batch 2 fails (questions 6-10)
        if '"number": 6,' in user_prompt or '"number": 6}' in user_prompt:
            raise RuntimeError("API timeout on batch 2")
        # Batch 1 (questions 1-5)
        if '"number": 1,' in user_prompt or '"number": 1}' in user_prompt:
            return {"questions": [
                {"number": j, "type": "mcq", "question": f"Q{j}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B", "explanation": "OK"}
                for j in range(1, 6)
            ]}
        # Batch 3 (questions 11-15)
        return {"questions": [
            {"number": j, "type": "mcq", "question": f"Q{j}", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "D", "explanation": "OK"}
            for j in range(11, 16)
        ]}

    with patch("quiz_pipeline.call_agnes_api", side_effect=mock_api_batch):
        questions = parse_and_standardize_questions(
            raw_text=raw_text,
            api_key="mock",
            count=15,
            start_num=1
        )
    print("DEBUG len(questions):", len(questions))
    for q in questions:
        print("DEBUG q:", q["number"], q["question"], q["explanation"])
    assert len(questions) == 15, f"Expected 15 questions, got {len(questions)}"
    # Verify numbers are strictly 1..15
    assert [q["number"] for q in questions] == list(range(1, 16))
    # Batch 1 (1..5) should have explanation "OK"
    for q in questions[0:5]:
        assert q["explanation"] == "OK"
    # Batch 2 (6..10) was degraded: explanation should be empty string
    for q in questions[5:10]:
        assert q["explanation"] == ""
    # Batch 3 (11..15) should have explanation "OK"
    for q in questions[10:15]:
        assert q["explanation"] == "OK"
    print("[PASS] Graceful Degradation: 1 failing batch was recovered from raw text, preserving 15/15 questions.")

    print("\nALL FORENSIC STRESS TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_stress_tests()
