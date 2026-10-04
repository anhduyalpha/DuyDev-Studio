# Technical Analysis: WP2 (P0) Duplicate Question Bugfix & Sequential Numbering

- **Target File**: `engines/quiz/quiz_pipeline.py` (lines 1036–1158, 1905–1912)
- **Test File**: `engines/quiz/test_quiz_pipeline_v2.py`
- **Specification**: `docs/QUIZ_PIPELINE_UPGRADE_PLAN.md` (§2.3 P0-1, §WP2)
- **Author**: Explorer 2 (Duplicate Bugfix Specialist)
- **Status**: Analysis Complete / Ready for Implementation

---

## 1. Executive Summary

In Quiz Pipeline v2.0, when a user requests more questions (`count`) than are actually present in the source document (`available`), the pipeline produces duplicate questions with disjointed numbers.
For example, given a PDF page containing 10 MCQ questions with a user request of `count = 20`:
- **Observed Behavior**: The pipeline produces 18 questions, where questions 13–20 are duplicate copies of questions 1–8 with identical stems and options, but different numbers.
- **Root Cause**: Batch scheduling calculates iterations from `count` rather than `min(count, available)`, while window chunking produces fewer windows than batches. When index exceeds the window array, line 1102 falls back to `raw_text`, sending the entire original document back to Agnes AI with a prompt to extract and number from 13 to 20.
- **Impact**: P0 release blocker. Causes corrupted student worksheets/exams, generates invalid answer keys, wastes API quota, and increases latency by 2x.

This analysis provides the complete architectural roadmap and precise code diffs for the **7 mandatory modifications** to resolve the duplicate bug, enforce sequential numbering, guarantee zero AI API calls when 0 questions exist, and preserve asset mapping integrity.

---

## 2. Root Cause Anatomy & Execution Trace

### 2.1 The Vulnerable Code (`quiz_pipeline.py:1077–1158`)

```python
# Lines 1077-1087: Batches calculated strictly from requested count
BATCH_SIZE = 12
batches = []
curr_start = start_num
remaining = count                      # <--- ERROR 1: Does not know real question count
while remaining > 0:
    b_count = min(remaining, BATCH_SIZE)
    b_end = curr_start + b_count - 1
    batches.append((curr_start, b_end, b_count))
    curr_start += b_count
    remaining -= b_count

# Line 1096: Window chunking slices text into windows
windows = chunk_questions_sliding_window(raw_text, target_count=count, window_size=BATCH_SIZE)

for b_idx, (b_start, b_end, b_count) in enumerate(batches):
    ...
    # Line 1102: Fallback when b_idx >= len(windows)
    w_text = windows[b_idx][2] if b_idx < len(windows) else raw_text   # <--- ERROR 2: Fallback to raw_text
    user_prompt = (
        f"Extract up to {b_count} questions from the following text. "
        f"Extract them sequentially in order of appearance and assign sequential numbers from {b_start} to {b_end}:\n\n{w_text}"
    )
    ...
    # Lines 1145-1149: Normalized questions appended without stem dedup or clamping
    for idx, q in enumerate(batch_qs):
        target_num = b_start + idx
        norm_q = normalize_question(q, fallback_num=target_num)       # <--- ERROR 3: Trusts AI numbers
        all_questions.append(norm_q)
```

### 2.2 Trace of the Bug Execution

Given `raw_text` with 10 questions (`Câu 1` to `Câu 10`), requested `count = 20`, `start_num = 1`:

1. **Batch Calculation**:
   - `count = 20`, `BATCH_SIZE = 12`.
   - Iteration 1: `b_count = 12`, `b_start = 1`, `b_end = 12`.
   - Iteration 2: `b_count = 8`, `b_start = 13`, `b_end = 20`.
   - Result: `batches = [(1, 12, 12), (13, 20, 8)]`, `len(batches) = 2`.

2. **Chunking Behavior (`chunk_questions_sliding_window`)**:
   - It identifies 10 segments in `raw_text`.
   - Line 948: `if len(segments) <= window_size:` (`10 <= 12` is `True`).
   - Line 950: returns `[(1, 10, clean_full)]`.
   - Result: `windows` has only 1 element! `len(windows) == 1`.

3. **Batch Loop Execution**:
   - **Iteration 0 (`b_idx = 0`)**:
     - `b_idx < len(windows)` is `0 < 1` (`True`).
     - `w_text = windows[0][2]` (contains questions 1..10).
     - AI extracts 10 questions and numbers them 1..10.
     - `all_questions` contains 10 items (questions 1..10).
   - **Iteration 1 (`b_idx = 1`)**:
     - `b_idx < len(windows)` is `1 < 1` (`False`).
     - Line 1102 executes fallback: `w_text = raw_text`!
     - `user_prompt` asks AI: *"Extract up to 8 questions ... assign sequential numbers from 13 to 20:\n\n{raw_text}"*.
     - AI reads `raw_text` from the beginning, re-extracts questions 1..8, and numbers them 13..20.
     - `batch_qs` has 8 questions.
     - Line 1139: `if not batch_qs:` is False because AI returned 8 items.
     - `normalize_question` sees `q["number"]` is integer 13..20, so it preserves them.
     - `all_questions` appends these 8 items.

4. **Outcome**:
   - `all_questions` has 10 + 8 = **18 questions**.
   - Questions 13–20 are identical duplicates of questions 1–8.
   - User receives an erroneous quiz with 18 questions and duplicate content.

5. **The Zero-Question Flaw**:
   - If `raw_text` has 0 questions, `chunk_questions_sliding_window` returns `[(1, count, raw_text)]`.
   - `parse_and_standardize_questions` invokes Agnes AI, wasting an API call and waiting for timeout/response before line 1143 raises `RuntimeError`.

---

## 3. The 7 Required Code Modifications (§WP2 Specification)

### (1) Immediate Count Check & Clamping
Before generating prompts or starting threads, determine actual questions present in `raw_text`:
```python
if parsed_blocks is None:
    parsed_blocks = parse_mcq_blocks(raw_text)
available = len(parsed_blocks)
if available == 0:
    desc = pages_desc or "trang đã chọn"
    raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
effective_count = min(count, available)
```
- **Vietnamese Error Message**: Exact phrase `f"Không có câu hỏi trong {desc}, vui lòng chọn lại."` is mandatory because `server/src/workers/quiz.worker.ts:77-87` pattern-matches this exact string to report user errors without alerting.
- **Fail Fast**: 0 API calls made when no MCQ questions exist in the input text.

### (2) Compute `remaining` and `batches` from `effective_count`
```python
BATCH_SIZE = 5  # Standardized to 5 questions per micro-batch
batches = []
curr_start = start_num
remaining = effective_count  # Was: remaining = count
while remaining > 0:
    b_count = min(remaining, BATCH_SIZE)
    b_end = curr_start + b_count - 1
    batches.append((curr_start, b_end, b_count))
    curr_start += b_count
    remaining -= b_count
```
- When 10 questions exist and user requests 20, `effective_count = 10`.
- For `BATCH_SIZE = 5`, `batches = [(1, 5, 5), (6, 10, 5)]` (exactly 2 batches of 5).
- Never generates batches beyond available questions.

### (3) Slice Windows Directly from `parsed_blocks`
Eliminate reliance on `chunk_questions_sliding_window` inside `parse_and_standardize_questions`:
```python
windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]
```
- Each window `windows[b_idx]` contains the exact slice of parsed MCQ dicts.
- Sliced raw text is constructed cleanly:
```python
w_blocks = windows[b_idx]
w_text = "\n\n".join(
    b["raw"].strip() if isinstance(b, dict) and "raw" in b else str(b).strip()
    for b in w_blocks
)
```

### (4) Drop Fallback `else raw_text` Completely & Assert 1-to-1 Alignment
```python
assert len(windows) == len(batches), "windows và batches phải khớp 1-1"
w_blocks = windows[b_idx]
```
- By mathematical invariant, both `batches` and `windows` are partitioned from `effective_count` with step `BATCH_SIZE`.
- Lengths are strictly equal (`ceil(effective_count / BATCH_SIZE)`).
- Fallback `else raw_text` is deleted entirely. No batch can ever receive the full document as fallback.

### (5) Dedup Question Stem by SHA1 Fingerprint
Defensive deduplication across all extracted batches:
```python
def _stem_fingerprint(q: dict) -> str:
    plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
    # Strip optional leading 'Câu X:' or 'X.' to normalize across numbering changes
    plain = re.sub(r"^\s*(?:câu\s*\d+[\.\:\s]*|\d+[\.\:]\s*)", "", plain, flags=re.IGNORECASE)
    plain = re.sub(r"\s+", "", plain).lower()
    return hashlib.sha1(plain.encode("utf-8")).hexdigest()

seen_stems = set()
deduped = []
for q in all_questions:
    fp = _stem_fingerprint(q)
    if fp in seen_stems:
        continue
    seen_stems.add(fp)
    deduped.append(q)
all_questions = deduped
```
- Normalizes chemical formatting (e.g., `C<sub>2</sub>H<sub>5</sub>OH` vs `C2H5OH`).
- Strips leading "Câu X:" prefixes in case AI prepended numbers in stems.
- Collapses all whitespace and lower-cases before SHA1 hashing.
- Discards duplicate stems while preserving first occurrence.

### (6) Clamp `all_questions` to `effective_count`
```python
all_questions = all_questions[:effective_count]
```
- Guarantees that even if an AI batch returns extra questions (e.g. requested 5, returned 6), the final list never exceeds `effective_count`.

### (7) Enforce Sequential Numbering
```python
for i, q in enumerate(all_questions):
    q["number"] = start_num + i
```
- Never trust numbers returned by the AI (which may be erratic, e.g. `[5, 99, 2]` or out of order).
- Numbers are strictly monotonically increasing: `start_num, start_num + 1, ..., start_num + N - 1`.

---

## 4. Asset Mapping Synchronization in `run_pipeline`

### 4.1 The Image Mapping Challenge
In `engines/quiz/quiz_pipeline.py:537-546`, `link_assets_to_questions` maps images to questions via:
```python
# 2. Sequential Index Mapping: question at index k was source_nums[k] in the source PDF!
for idx, q in enumerate(questions):
    if not q.get("image_data") and idx < len(source_nums):
        orig_q_num = source_nums[idx]
        for a_id, mapped_num in asset_map.items():
            if mapped_num == orig_q_num and a_id in assets_by_id and a_id not in assigned_assets:
                q["image_ref"] = f"{a_id}.png"
                q["image_data"] = assets_by_id[a_id].get("data_uri")
                assigned_assets.add(a_id)
                break
```
- `asset_map` is keyed by original question numbers in the source PDF (e.g. diagram on page 2 belongs to original `Câu 14`).
- If a user extracts pages 2-3 and sets `start_num = 1`, question 1 is actually question 14 from the PDF.
- If `source_nums` passed to `link_assets_to_questions` contains re-indexed numbers `[1, 2, 3]`, the diagram for question 14 will NOT match!

### 4.2 Solution: Pass Original Numbers from Pre-Parser
In `run_pipeline`:
```python
emit_progress(45, f"Đang chuẩn hóa câu hỏi đa định dạng GDPT 2018 ({count} câu)...")
parsed_blocks = parse_mcq_blocks(raw_text)

questions = parse_and_standardize_questions(
    raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model, pages_desc=pages_desc,
    parsed_blocks=parsed_blocks
)

effective_count = len(questions)
source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]

# Link visual assets to questions using original source numbers
link_assets_to_questions(questions, extracted_assets, asset_map, source_nums_for_assets)
```
- Parsing `parse_mcq_blocks` once in `run_pipeline` and passing `parsed_blocks` down avoids duplicate parsing.
- Passing `source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]` guarantees that `link_assets_to_questions` receives the true original PDF question numbers, preserving visual diagrams with 100% precision.

---

## 5. Preservation of `chunk_questions_sliding_window`

`chunk_questions_sliding_window` is called directly by two existing unit tests in `engines/quiz/test_quiz_pipeline_v2.py`:
1. Line 131: `test_sliding_window_chunking`
2. Line 420: `test_chunk_questions_sliding_window_strips_trailing_section_banner`

**Mandatory Rule**: The function signature and implementation of `chunk_questions_sliding_window` in `quiz_pipeline.py:923-964` must remain completely intact. We only remove calls to it within `parse_and_standardize_questions`.
This guarantees zero regressions across the 22 existing tests.

---

## 6. Unit Test Suite Design (`test_quiz_pipeline_v2.py`)

Three new unit tests will be appended at the end of `TestQuizPipelineV2` in `engines/quiz/test_quiz_pipeline_v2.py`:

```python
    @patch("quiz_pipeline.call_agnes_api")
    def test_no_duplicate_questions_when_count_exceeds_available(self, mock_api):
        """WP2: Verify clamping to available count and absence of duplicate questions."""
        raw_text = "\n\n".join(
            f"Câu {i}: Nội dung câu hỏi số {i} về hóa học hữu cơ.\n"
            f"A. Đáp án A của câu {i}\n"
            f"B. Đáp án B của câu {i}\n"
            f"C. Đáp án C của câu {i}\n"
            f"D. Đáp án D của câu {i}"
            for i in range(1, 11)
        )

        def side_effect(api_key, user_prompt, system_prompt, **kwargs):
            if "from 1 to 5" in user_prompt or "up to 5" in user_prompt:
                qs = [
                    {
                        "number": i,
                        "type": "mcq",
                        "question": f"Nội dung câu hỏi số {i} về hóa học hữu cơ.",
                        "options": {"A": f"A{i}", "B": f"B{i}", "C": f"C{i}", "D": f"D{i}"},
                        "answer": "A",
                        "explanation": f"Giải thích {i}"
                    }
                    for i in range(1, 6)
                ]
                return {"questions": qs}
            else:
                qs = [
                    {
                        "number": i,
                        "type": "mcq",
                        "question": f"Nội dung câu hỏi số {i} về hóa học hữu cơ.",
                        "options": {"A": f"A{i}", "B": f"B{i}", "C": f"C{i}", "D": f"D{i}"},
                        "answer": "B",
                        "explanation": f"Giải thích {i}"
                    }
                    for i in range(6, 11)
                ]
                return {"questions": qs}

        mock_api.side_effect = side_effect

        result = parse_and_standardize_questions(
            raw_text=raw_text,
            api_key="mock_key",
            count=20,
            start_num=1
        )

        self.assertEqual(len(result), 10)
        self.assertEqual([q["number"] for q in result], list(range(1, 11)))
        stems = [q["question"] for q in result]
        self.assertEqual(len(stems), len(set(stems)))
        self.assertEqual(mock_api.call_count, 2)

    @patch("quiz_pipeline.call_agnes_api")
    def test_sequential_numbering_overrides_ai_numbers(self, mock_api):
        """WP2: Verify that random/erratic AI numbers are strictly overridden by sequential numbers."""
        raw_text = (
            "Câu 1: Nội dung câu 1.\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 2: Nội dung câu 2.\nA. 1\nB. 2\nC. 3\nD. 4\n\n"
            "Câu 3: Nội dung câu 3.\nA. 1\nB. 2\nC. 3\nD. 4"
        )
        mock_api.return_value = {
            "questions": [
                {"number": 5, "type": "mcq", "question": "Nội dung câu 1.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"},
                {"number": 99, "type": "mcq", "question": "Nội dung câu 2.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "B"},
                {"number": 2, "type": "mcq", "question": "Nội dung câu 3.", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "C"}
            ]
        }

        # Case 1: start_num = 1
        res1 = parse_and_standardize_questions(raw_text=raw_text, api_key="mock_key", count=3, start_num=1)
        self.assertEqual([q["number"] for q in res1], [1, 2, 3])

        # Case 2: start_num = 18
        res18 = parse_and_standardize_questions(raw_text=raw_text, api_key="mock_key", count=3, start_num=18)
        self.assertEqual([q["number"] for q in res18], [18, 19, 20])

    @patch("quiz_pipeline.call_agnes_api")
    def test_zero_questions_raises_before_any_api_call(self, mock_api):
        """WP2: Verify fast-fail with Vietnamese RuntimeError and 0 API calls when text has no questions."""
        raw_text = "Lời mở đầu tài liệu. Giới thiệu tổng quan và mục lục, hoàn toàn không có câu trắc nghiệm."

        with self.assertRaises(RuntimeError) as ctx:
            parse_and_standardize_questions(
                raw_text=raw_text,
                api_key="mock_key",
                count=10,
                start_num=1,
                pages_desc="Trang 1-2"
            )

        self.assertIn("Không có câu hỏi trong Trang 1-2, vui lòng chọn lại.", str(ctx.exception))
        self.assertEqual(mock_api.call_count, 0)
```

---

## 7. Concrete Implementation Diff for Implementer

### Diff for `engines/quiz/quiz_pipeline.py`

```diff
--- a/engines/quiz/quiz_pipeline.py
+++ b/engines/quiz/quiz_pipeline.py
@@ -22,6 +22,7 @@
 import uuid
 import base64
 import concurrent.futures
+import hashlib
 import pymupdf
+from mcq_parser import parse_mcq_blocks
 
@@ -1035,6 +1036,13 @@
 
+def _stem_fingerprint(q: dict) -> str:
+    plain = re.sub(r"<[^>]+>", "", str(q.get("question", "")))
+    plain = re.sub(r"^\s*(?:câu\s*\d+[\.\:\s]*|\d+[\.\:]\s*)", "", plain, flags=re.IGNORECASE)
+    plain = re.sub(r"\s+", "", plain).lower()
+    return hashlib.sha1(plain.encode("utf-8")).hexdigest()
+
 def parse_and_standardize_questions(
     raw_text: str,
     api_key: str,
     count: int = 20,
     start_num: int = 1,
     base_url: str = DEFAULT_API_BASE,
     model: str = DEFAULT_MODEL,
-    pages_desc: str = ""
+    pages_desc: str = "",
+    parsed_blocks: list[dict] | None = None
 ) -> list[dict]:
     ...
     system_prompt = ( ... )
 
-    BATCH_SIZE = 12
+    # (1) Chốt số câu thật ngay đầu hàm, trước khi gọi AI
+    if parsed_blocks is None:
+        parsed_blocks = parse_mcq_blocks(raw_text)
+    available = len(parsed_blocks)
+    if available == 0:
+        desc = pages_desc or "trang đã chọn"
+        raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
+    effective_count = min(count, available)
+
+    # (2) Tính batches từ effective_count với BATCH_SIZE = 5
+    BATCH_SIZE = 5
     batches = []
     curr_start = start_num
-    remaining = count
+    remaining = effective_count
     while remaining > 0:
         b_count = min(remaining, BATCH_SIZE)
         b_end = curr_start + b_count - 1
         batches.append((curr_start, b_end, b_count))
         curr_start += b_count
         remaining -= b_count
 
     total_batches = len(batches)
     all_questions = []
 
     start_progress = 45
     max_ai_progress = 72
     prog_step = (max_ai_progress - start_progress) / max(1, total_batches)
 
-    # Use sliding window chunking to slice context
-    windows = chunk_questions_sliding_window(raw_text, target_count=count, window_size=BATCH_SIZE)
+    # (3) Slicing windows trực tiếp từ parsed_blocks
+    windows = [parsed_blocks[i:i + BATCH_SIZE] for i in range(0, effective_count, BATCH_SIZE)]
+
+    # (4) Bắt buộc 1-1, bỏ hoàn toàn fallback else raw_text
+    assert len(windows) == len(batches), "windows và batches phải khớp 1-1"
 
     for b_idx, (b_start, b_end, b_count) in enumerate(batches):
         batch_prog_base = int(start_progress + b_idx * prog_step)
         
-        # Pick corresponding window text or full text
-        w_text = windows[b_idx][2] if b_idx < len(windows) else raw_text
+        w_blocks = windows[b_idx]
+        w_text = "\n\n".join(
+            b["raw"].strip() if isinstance(b, dict) and "raw" in b else str(b).strip()
+            for b in w_blocks
+        )
         user_prompt = (
             f"Extract up to {b_count} questions from the following text. "
             f"Extract them sequentially in order of appearance and assign sequential numbers from {b_start} to {b_end}:\n\n{w_text}"
         )
         ...
         emit_progress(
             int(start_progress + (b_idx + 1) * prog_step),
-            f"Đã chuẩn hóa xong {batch_label} ({len(all_questions)}/{count} câu)..."
+            f"Đã chuẩn hóa xong {batch_label} ({len(all_questions)}/{effective_count} câu)..."
         )
 
+    # (5) Dedup theo SHA1 fingerprint của question stem
+    seen_stems = set()
+    deduped = []
+    for q in all_questions:
+        fp = _stem_fingerprint(q)
+        if fp in seen_stems:
+            continue
+        seen_stems.add(fp)
+        deduped.append(q)
+    all_questions = deduped
+
+    # (6) Clamp về effective_count
+    all_questions = all_questions[:effective_count]
+
+    # (7) Cưỡng chế đánh số tuần tự bắt đầu từ start_num
+    for i, q in enumerate(all_questions):
+        q["number"] = start_num + i
+
     if not all_questions:
-        raise RuntimeError("Không có câu hỏi trong trang, vui lòng chọn lại.")
+        desc = pages_desc or "trang đã chọn"
+        raise RuntimeError(f"Không có câu hỏi trong {desc}, vui lòng chọn lại.")
 
     return all_questions
@@ -1904,7 +1970,12 @@
         emit_progress(45, f"Đang chuẩn hóa câu hỏi đa định dạng GDPT 2018 ({count} câu)...")
+        parsed_blocks = parse_mcq_blocks(raw_text)
         questions = parse_and_standardize_questions(
-            raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model, pages_desc=pages_desc
+            raw_text, key, count=count, start_num=start_q, base_url=base_url, model=model, pages_desc=pages_desc,
+            parsed_blocks=parsed_blocks
         )
 
+        effective_count = len(questions)
+        source_nums_for_assets = [b["source_number"] for b in parsed_blocks][:effective_count]
+
         # Link visual assets to questions using AI match, layout spatial map, and fallbacks
-        link_assets_to_questions(questions, extracted_assets, asset_map, source_q_nums)
+        link_assets_to_questions(questions, extracted_assets, asset_map, source_nums_for_assets)
```
