import re
import sys
import os

# Add engines/quiz to sys.path
sys.path.insert(0, r"C:\Users\AnhDuy\Code\Project\DD Studio\engines\quiz")
from text_utils_prototype import is_section_banner, strip_section_banner, clean_image_markers

BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*[\.\:\)]", re.IGNORECASE)
OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")

def parse_mcq_blocks(text: str) -> list[dict]:
    if not text or not isinstance(text, str) or not text.strip():
        return []

    splits = BOUNDARY.split(text)
    blocks = []
    expected = ["A", "B", "C", "D"]

    for s in splits:
        seg = s.strip()
        if not seg:
            continue
        if not re.match(r"^(?:Câu\s*\d+[\.\:\s]|\b\d+[\.\:]\s+)", seg, re.IGNORECASE):
            continue

        num_m = NUM.match(seg)
        if not num_m:
            continue
        source_number = int(num_m.group(1))

        idx = 0
        chosen = []
        for m in OPT.finditer(seg):
            if idx < 4 and m.group(1) == expected[idx]:
                chosen.append(m)
                idx += 1

        options = {"A": "", "B": "", "C": "", "D": ""}
        if chosen:
            stem = seg[:chosen[0].start()]
            for k in range(len(chosen)):
                letter = chosen[k].group(1)
                start = chosen[k].end()
                end = chosen[k + 1].start() if k + 1 < len(chosen) else len(seg)
                opt_val = strip_section_banner(seg[start:end]).strip()
                options[letter] = opt_val
        else:
            stem = seg

        stem = strip_section_banner(stem).strip()

        # Confidence:
        # "high" iff len(chosen) == 4, all options A, B, C, D non-empty, and stem non-empty
        is_high = (
            len(chosen) == 4
            and all(bool(options[k]) for k in ["A", "B", "C", "D"])
            and bool(stem)
        )
        confidence = "high" if is_high else "low"

        blocks.append({
            "source_number": source_number,
            "stem": stem,
            "options": options,
            "confidence": confidence,
            "raw": seg
        })

    return blocks

def count_available_questions(text: str) -> int:
    return len(parse_mcq_blocks(text))
