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
    """
    candidates: list[QuestionCandidate] = []
    seen_numbers: set[int] = set()

    for block in blocks:
        block_text = block.text.strip()
        if not block_text:
            continue

        # Check for Question marker
        match = QUESTION_PATTERN.search(block_text)
        if not match:
            # Fallback to standalone number pattern at line start
            match = STANDALONE_NUM_PATTERN.search(block_text)

        if match:
            try:
                q_num = int(match.group(1))
            except (ValueError, IndexError):
                continue

            if q_num in seen_numbers:
                continue

            # Detect options contained within this block or subsequent text
            detected_opts = list(set(OPTION_PATTERN.findall(block_text)))
            detected_opts.sort()

            # Find matching line for more accurate bbox if possible
            cand_bbox = block.bbox
            cand_y = block.bbox[1]

            for line in block.lines:
                if match.group(0).strip() in line.text:
                    cand_bbox = line.bbox
                    cand_y = line.bbox[1]
                    break

            candidates.append(
                QuestionCandidate(
                    candidate_number=q_num,
                    marker_text=match.group(0).strip(),
                    bbox=cand_bbox,
                    y_pos=cand_y,
                    options_detected=detected_opts
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
    1. prev_page has candidates and the last candidate has fewer than 4 options (e.g. only A, B).
    2. curr_page has text at the top before any new question marker, or curr_page starts with
       continuation options like 'C.' or 'D.'.
    """
    if not prev_page.candidates:
        return False

    last_cand = prev_page.candidates[-1]
    last_opts = set(last_cand.options_detected)

    # If last question already has all 4 standard options A, B, C, D, it's likely complete
    if len(last_opts) >= 4 and {"A", "B", "C", "D"}.issubset(last_opts):
        return False

    # Check top text or first block of curr_page
    if not curr_page.blocks:
        return False

    first_block = curr_page.blocks[0]
    first_block_text = first_block.text.strip()

    # If curr_page begins directly with an option (e.g. 'C.' or 'D.')
    curr_opts = OPTION_PATTERN.findall(first_block_text)
    if curr_opts:
        first_opt = curr_opts[0]
        if first_opt in ("B", "C", "D") and first_opt not in last_opts:
            return True

    # If curr_page has no candidates in the first 25% of the page height, it may be trailing stem/options
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
