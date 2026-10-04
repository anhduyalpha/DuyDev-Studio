"""
Question Candidate & Page Range Heuristics
Deterministic extraction of question candidates, option markers, and page continuation detection.
"""

import re
from typing import Optional
from .models import TextBlock, QuestionCandidate, PageRepresentation


QUESTION_PATTERN = re.compile(
    r"(?:^|\n)\s*(?:Câu|Bài|Question|CÂU|BÀI)\s*(\d+)[\s\.\:\)]",
    re.IGNORECASE | re.MULTILINE
)

# Standalone numbered item e.g. "1. " or "1) " at line start
STANDALONE_NUM_PATTERN = re.compile(
    r"(?:^|\n)\s*(\d+)[\.\)]\s+",
    re.MULTILINE
)

OPTION_PATTERN = re.compile(
    r"(?:^|\s|\n)([A-D])[\.\)]\s+",
    re.MULTILINE
)

SECTION_HEADER_PATTERN = re.compile(
    r"(?:^|\n)\s*(?:PHẦN|Phần|Chuyên đề|BÀI TẬP|ĐỀ THI|MÃ ĐỀ)\s*(?:[IVXLCDM]+|\d+)?[:\s\.\-]",
    re.IGNORECASE | re.MULTILINE
)


def detect_candidates_from_page(blocks: list[TextBlock], raw_text: str = "") -> list[QuestionCandidate]:
    """
    Detect question candidates from structured text blocks.
    Identifies question markers, their bounding boxes, and initial option letters.
    Supports multiple questions per block and raw_text fallback.
    """
    candidates: list[QuestionCandidate] = []
    seen_numbers: set[int] = set()

    for block in blocks:
        block_text = block.text.strip()
        if not block_text:
            continue

        # Find all question markers in this block
        matches = list(QUESTION_PATTERN.finditer(block_text))
        if not matches:
            matches = list(STANDALONE_NUM_PATTERN.finditer(block_text))

        for i, match in enumerate(matches):
            try:
                q_num = int(match.group(1))
            except (ValueError, IndexError):
                continue

            if q_num in seen_numbers:
                continue

            # Determine slice belonging to this question within the block
            start_pos = match.start()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(block_text)
            q_slice = block_text[start_pos:end_pos]

            # Detect options contained within this slice
            detected_opts = list(set(OPTION_PATTERN.findall(q_slice)))
            detected_opts.sort()

            # Find matching line for more accurate bbox if possible
            cand_bbox = block.bbox
            cand_y = block.bbox[1]

            marker_str = match.group(0).strip()
            for line in block.lines:
                if marker_str in line.text or f"Câu {q_num}" in line.text or f"{q_num}." in line.text:
                    cand_bbox = line.bbox
                    cand_y = line.bbox[1]
                    break

            candidates.append(
                QuestionCandidate(
                    candidate_number=q_num,
                    marker_text=marker_str,
                    bbox=cand_bbox,
                    y_pos=cand_y,
                    options_detected=detected_opts
                )
            )
            seen_numbers.add(q_num)

    # Fallback to scanning raw_text if provided to catch candidates missed by block boundaries
    if raw_text and raw_text.strip():
        for match in QUESTION_PATTERN.finditer(raw_text):
            try:
                q_num = int(match.group(1))
            except (ValueError, IndexError):
                continue
            if q_num not in seen_numbers:
                marker_str = match.group(0).strip()
                candidates.append(
                    QuestionCandidate(
                        candidate_number=q_num,
                        marker_text=marker_str,
                        bbox=(50.0, 100.0, 500.0, 120.0),
                        y_pos=100.0,
                        options_detected=[]
                    )
                )
                seen_numbers.add(q_num)

    # Sort candidates top-to-bottom by vertical coordinate (y_pos)
    candidates.sort(key=lambda c: (c.y_pos, c.candidate_number))
    return candidates


def get_page_question_bounds(page_rep: PageRepresentation) -> tuple[Optional[int], Optional[int]]:
    """
    Returns the first and last candidate question numbers detected on the page.
    Returns (None, None) if no candidates found.
    """
    if not page_rep.candidates:
        return None, None

    numbers = [c.candidate_number for c in page_rep.candidates]
    return min(numbers), max(numbers)


def detect_continuation_candidate(prev_page: PageRepresentation, curr_page: PageRepresentation) -> bool:
    """
    Detects if the last candidate on prev_page continues onto curr_page.
    Heuristics:
    1. prev_page has candidates and the last candidate has fewer than 4 options (e.g. only A, B or A, B, C).
    2. curr_page has text before any new question marker containing continuation options (e.g. 'C.' or 'D.').
    3. curr_page has text but zero new candidates: continuation page.
    """
    if not prev_page.candidates:
        return False

    last_cand = prev_page.candidates[-1]
    last_opts = set(last_cand.options_detected)

    # If last question already has all 4 standard options A, B, C, D, it's likely complete
    if len(last_opts) >= 4 and {"A", "B", "C", "D"}.issubset(last_opts):
        return False

    if not curr_page.blocks and not curr_page.raw_text:
        return False

    # Find where the first new question candidate begins on curr_page (if any)
    first_cand_y = curr_page.candidates[0].y_pos if curr_page.candidates else float("inf")

    # Collect all text on curr_page appearing before the first new question
    leading_text_parts: list[str] = []
    for b in curr_page.blocks:
        if b.bbox[1] < first_cand_y:
            leading_text_parts.append(b.text)
        else:
            break

    leading_text = "\n".join(leading_text_parts).strip()
    if not leading_text and curr_page.raw_text:
        # If block bboxes weren't cleanly separated, take first 500 chars of raw_text
        leading_text = curr_page.raw_text[:500]

    # Search for continuation options in the leading text
    found_leading_opts = set(OPTION_PATTERN.findall(leading_text))
    expected_continuations = {"B", "C", "D"} - last_opts
    if found_leading_opts.intersection(expected_continuations):
        return True

    # If curr_page has no candidates in the first 30% of height and has text, likely continuation stem/options
    if curr_page.candidates:
        first_curr_cand = curr_page.candidates[0]
        if first_curr_cand.y_pos > (curr_page.height * 0.25):
            return True
    else:
        # curr_page has text but zero new candidates: likely continuation page
        if curr_page.character_count > 40:
            return True

    return False


def get_next_page_index(curr_idx: int, total_pages: int) -> Optional[int]:
    """
    Returns the next page index if valid, otherwise None.
    """
    if curr_idx + 1 < total_pages:
        return curr_idx + 1
    return None
