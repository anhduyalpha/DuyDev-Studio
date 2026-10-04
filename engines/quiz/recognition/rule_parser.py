"""
Rule-Based Numeric Constraint Parser
Extracts page numbers, question ranges, and counts from Vietnamese and English user instructions.
Fast Path: Zero AI calls when numeric constraints can be deterministically parsed.
"""

import re
from typing import Optional
from .models import ParsedNumericConstraint


PAGE_RANGE_PATTERN = re.compile(
    r"(?:[Tt]rang|[Pp]age)\s*(\d+)\s*(?:đến|tới|-|\.\.)\s*(?:[Tt]rang|[Pp]age)?\s*(\d+)",
    re.IGNORECASE
)

SINGLE_PAGE_PATTERN = re.compile(
    r"(?:[Tt]rang|[Pp]age)\s*(\d+)",
    re.IGNORECASE
)

QUESTION_RANGE_PATTERN = re.compile(
    r"(?:[Tt]ừ\s*)?(?:[Cc]âu|[Bb]ài|[Qq]uestion)\s*(\d+)\s*(?:đến|tới|-|\.\.)\s*(?:[Cc]âu|[Bb]ài|[Qq]uestion)?\s*(\d+)",
    re.IGNORECASE
)

START_QUESTION_PATTERN = re.compile(
    r"(?:bắt đầu từ|khởi đầu từ|bắt đầu ở|từ)\s*(?:[Cc]âu|[Bb]ài|[Qq]uestion)\s*(\d+)",
    re.IGNORECASE
)

EXPLICIT_COUNT_PATTERN = re.compile(
    r"(?:lấy|chọn|làm|tổng cộng|gồm|ra|tạo)\s*(\d+)\s*(?:câu|bài|questions?)",
    re.IGNORECASE
)

STANDALONE_COUNT_PATTERN = re.compile(
    r"\b(\d+)\s*(?:câu|bài|questions?)\b",
    re.IGNORECASE
)

EXAM_CODE_PATTERN = re.compile(
    r"(?<!chuyên\s)(?<!chủ\s)(?<!vấn\s)\b(?:[Đđ]ề\s*số|[Đđ]ề\s*thi|[Đđ]ề|[Mm]ã\s*đề)\s*([0-9]+|[A-Z][0-9A-Z\-]*)\b"
)


def parse_numeric_instruction(instruction: str) -> Optional[ParsedNumericConstraint]:
    """
    Parses a user instruction string into structured numeric constraints.
    Returns None if the instruction does not contain any recognizable numeric patterns.
    """
    if not instruction or not instruction.strip():
        return None

    text = instruction.strip()

    start_page: Optional[int] = None
    end_page: Optional[int] = None
    start_q: Optional[int] = None
    end_q: Optional[int] = None
    count: Optional[int] = None
    exam_code: Optional[str] = None

    # 1. Parse Exam Code
    exam_match = EXAM_CODE_PATTERN.search(text)
    if exam_match:
        exam_code = exam_match.group(1).strip()

    # 2. Parse Page Range or Single Page
    page_range_match = PAGE_RANGE_PATTERN.search(text)
    if page_range_match:
        start_page = int(page_range_match.group(1))
        end_page = int(page_range_match.group(2))
    else:
        single_page_match = SINGLE_PAGE_PATTERN.search(text)
        if single_page_match:
            start_page = int(single_page_match.group(1))

    # 3. Parse Question Range (e.g. Câu 1 đến 30)
    q_range_match = QUESTION_RANGE_PATTERN.search(text)
    if q_range_match:
        start_q = int(q_range_match.group(1))
        end_q = int(q_range_match.group(2))
        if end_q >= start_q:
            count = end_q - start_q + 1

    # 4. Parse Start Question (e.g. bắt đầu từ câu 10)
    if start_q is None:
        start_q_match = START_QUESTION_PATTERN.search(text)
        if start_q_match:
            start_q = int(start_q_match.group(1))

    # 5. Parse Explicit Question Count (e.g. lấy 25 câu)
    count_match = EXPLICIT_COUNT_PATTERN.search(text)
    if count_match:
        count = int(count_match.group(1))
    elif count is None:
        # Try standalone count pattern (e.g. "20 câu")
        standalone_match = STANDALONE_COUNT_PATTERN.search(text)
        if standalone_match:
            # Check that this number isn't the start_q or start_page
            parsed_val = int(standalone_match.group(1))
            if parsed_val != start_page and parsed_val != start_q:
                count = parsed_val

    # If both start_q and count are present, ensure end_q is set
    if start_q is not None and count is not None and end_q is None:
        end_q = start_q + count - 1

    # If no numbers were extracted at all, return None (triggers AI fallback)
    if start_page is None and end_page is None and start_q is None and count is None and exam_code is None:
        return None

    return ParsedNumericConstraint(
        start_page=start_page,
        end_page=end_page,
        start_question=start_q,
        end_question=end_q,
        question_count=count,
        exam_code=exam_code
    )
