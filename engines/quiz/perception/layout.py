"""
Page Layout and Content Role Detection Module.
Detects page layout roles: CONTENT_PAGE, COVER_PAGE, TOC_PAGE, ANSWER_KEY_PAGE, EMPTY_PAGE.
Helps Auto-Expand Page algorithm skip non-content pages intelligently.
"""

from typing import Tuple, Optional
import re

from engines.quiz.perception.models import PageRepresentation, PageKind


COVER_PATTERNS = [
    re.compile(r"bộ\s+giáo\s+dục\s+và\s+đào\s+tạo", re.IGNORECASE),
    re.compile(r"sở\s+giáo\s+dục\s+và\s+đào\s+tạo", re.IGNORECASE),
    re.compile(r"trường\s+thpt", re.IGNORECASE),
    re.compile(r"đề\s+thi\s+chính\s+thức", re.IGNORECASE),
    re.compile(r"kỳ\s+thi\s+tốt\s+nghiệp", re.IGNORECASE),
    re.compile(r"nhà\s+xuất\s+bản", re.IGNORECASE),
]

TOC_PATTERNS = [
    re.compile(r"mục\s+lục", re.IGNORECASE),
    re.compile(r"table\s+of\s+contents", re.IGNORECASE),
    re.compile(r"danh\s+mục", re.IGNORECASE),
]

ANSWER_KEY_PATTERNS = [
    re.compile(r"bảng\s+đáp\s+án", re.IGNORECASE),
    re.compile(r"đáp\s+án\s+chi\s+tiết", re.IGNORECASE),
    re.compile(r"hướng\s+dẫn\s+giải", re.IGNORECASE),
    re.compile(r"phiếu\s+trả\s+lời", re.IGNORECASE),
]


def detect_page_question_density(page_rep: PageRepresentation) -> int:
    """Returns the count of question candidates found on this page."""
    return len(page_rep.candidates) if page_rep.candidates else 0


def is_non_content_page(page_rep: PageRepresentation) -> Tuple[bool, str]:
    """
    Evaluates whether a page is non-content (cover, table of contents, or blank).
    Returns (is_non_content, reason).
    """
    raw_text = page_rep.raw_text.strip()
    char_count = page_rep.character_count or len(raw_text)
    candidate_count = detect_page_question_density(page_rep)

    # 1. Blank or very low text without candidates
    if char_count < 30 and candidate_count == 0:
        return True, "Trang trống hoặc không chứa văn bản"

    # 2. Table of contents check
    for p in TOC_PATTERNS:
        if p.search(raw_text) and candidate_count == 0:
            return True, "Trang mục lục (Table of Contents)"

    # 3. Answer sheet or solution key check (if user requested questions, answer sheets are non-question)
    for p in ANSWER_KEY_PATTERNS:
        if p.search(raw_text) and candidate_count == 0:
            return True, "Bảng đáp án / Hướng dẫn giải"

    # 4. Cover page (only if page index is 0 or 1 and no question candidates)
    if page_rep.page_index <= 1 and candidate_count == 0:
        for p in COVER_PATTERNS:
            if p.search(raw_text):
                return True, "Trang bìa tài liệu"

    return False, "Trang nội dung câu hỏi"
