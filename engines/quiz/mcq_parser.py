"""
Deterministic MCQ pre-parser for Quiz Pipeline v3.0.
Extracts questions (source_number, stem, options, confidence, raw) using regex without calling AI.
"""

import re
try:
    from text_utils import is_section_banner, strip_section_banner, clean_image_markers
except ImportError:
    from engines.quiz.text_utils import is_section_banner, strip_section_banner, clean_image_markers

BOUNDARY = re.compile(r"(?:^|\n)(?=(?:Câu\s*\d+[\.\:\)\s]|\b\d+[\.\:]\s+))", re.IGNORECASE)
NUM = re.compile(r"^\s*(?:Câu\s*)?(\d+)\s*(?:[\.\:\)]|\s+)", re.IGNORECASE)
OPT = re.compile(r"(?:(?<=\s)|^)([A-D])[\.\)\:]\s*")


def parse_mcq_blocks(text: str) -> list[dict]:
    """
    Tách text đã stitch thành danh sách câu hỏi MCQ bằng regex, KHÔNG gọi AI.
    Trả về list theo đúng thứ tự xuất hiện trong tài liệu.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return []

    splits = BOUNDARY.split(text)
    blocks = []
    expected = ["A", "B", "C", "D"]

    for s in splits:
        seg = s.strip()
        if not seg:
            continue
        if not re.match(r"^(?:Câu\s*\d+[\.\:\)\s]|\b\d+[\.\:]\s+)", seg, re.IGNORECASE):
            continue

        num_m = NUM.match(seg)
        if not num_m:
            continue
        source_number = int(num_m.group(1))

        # Collect candidate option markers
        matches = list(OPT.finditer(seg))
        by_letter = {'A': [], 'B': [], 'C': [], 'D': []}
        for m in matches:
            by_letter[m.group(1)].append(m)

        # Find all valid ordered 4-tuples (A < B < C < D) or 2-column vertical (A < C < B < D)
        valid_tuples = []
        if by_letter['A'] and by_letter['B'] and by_letter['C'] and by_letter['D']:
            # 1. Standard horizontal order: A < B < C < D
            for mA in by_letter['A']:
                for mB in by_letter['B']:
                    if mB.start() < mA.end():
                        continue
                    for mC in by_letter['C']:
                        if mC.start() < mB.end():
                            continue
                        for mD in by_letter['D']:
                            if mD.start() < mC.end():
                                continue
                            valid_tuples.append((mA, mB, mC, mD))

            # 2. Two-column vertical order: A < C < B < D
            for mA in by_letter['A']:
                for mC in by_letter['C']:
                    if mC.start() < mA.end():
                        continue
                    for mB in by_letter['B']:
                        if mB.start() < mC.end():
                            continue
                        for mD in by_letter['D']:
                            if mD.start() < mB.end():
                                continue
                            valid_tuples.append((mA, mC, mB, mD))

        if valid_tuples:
            def score_tuple(tup):
                m1, m2, m3, m4 = tup
                # Prefer markers starting on newlines or at line start with indentation
                newline_score = sum(
                    1 for m in tup
                    if m.start() == 0 or seg[m.start() - 1] == '\n' or seg[:m.start()].rpartition('\n')[2].strip() == ''
                )
                # Penalize if option bodies contain newline option delimiters
                slices = [
                    seg[m1.end():m2.start()],
                    seg[m2.end():m3.start()],
                    seg[m3.end():m4.start()],
                    seg[m4.end():]
                ]
                sub_delims = sum(1 for sl in slices if re.search(r'\n\s*[A-D][\.\)\:]', sl))
                is_standard = 1 if [m.group(1) for m in tup] == ["A", "B", "C", "D"] else 0
                return (newline_score, -sub_delims, is_standard, m1.start())

            chosen = list(max(valid_tuples, key=score_tuple))
        else:
            # Fallback to prefix matching for incomplete/malformed options (< 4 options)
            idx = 0
            chosen = []
            for m in matches:
                if idx < 4 and m.group(1) == expected[idx]:
                    chosen.append(m)
                    idx += 1

        # Reject non-MCQ blocks (essay questions, open-ended exercises with no options)
        if len(chosen) < 2:
            continue

        options = {"A": "", "B": "", "C": "", "D": ""}
        stem = seg[:chosen[0].start()]
        for k in range(len(chosen)):
            letter = chosen[k].group(1)
            start = chosen[k].end()
            end = chosen[k + 1].start() if k + 1 < len(chosen) else len(seg)
            opt_val = strip_section_banner(seg[start:end]).strip()
            options[letter] = opt_val

        stem = strip_section_banner(stem).strip()
        clean_stem = re.sub(r"^(?:Câu\s*\d+[\.\:\)\s]*|\b\d+[\.\:]\s*)", "", stem, flags=re.IGNORECASE).strip()

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
            "clean_stem": clean_stem,
            "options": options,
            "confidence": confidence,
            "raw": seg
        })

    return blocks


def count_available_questions(text: str) -> int:
    """Số câu hỏi thật có trong text. Tương đương len(parse_mcq_blocks(text))."""
    return len(parse_mcq_blocks(text))
