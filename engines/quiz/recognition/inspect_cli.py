"""
Ground-Truth Page Inspector CLI
Performs fast deterministic candidate extraction and natural language query interpretation
directly on a PDF document using PyMuPDF and perception heuristics.
Execution time < 30ms (zero AI calls).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.perception.extractor import extract_page_representation
from engines.quiz.perception.models import PageRepresentation, QuestionCandidate


def _find_physical_page_index(doc: fitz.Document, printed_page_num: int) -> int:
    """
    Finds the 0-based physical page index matching the requested printed page number.
    Checks running header/footer or direct page index fallback.
    """
    total_pages = len(doc)
    # Check 1: direct index page_num - 1
    direct_idx = printed_page_num - 1
    if 0 <= direct_idx < total_pages:
        page = doc[direct_idx]
        text = page.get_text("text")
        pat = re.compile(rf"\b(?:Trang|Page)(?:\s*số|\s*:|\s*-)?\s*{printed_page_num}\b", re.IGNORECASE)
        if pat.search(text[:300]) or pat.search(text[-300:]):
            return direct_idx

    # Check 2: scan first and last 300 characters of each page for header/footer page marker
    pat = re.compile(rf"\b(?:Trang|Page)(?:\s*số|\s*:|\s*-)?\s*{printed_page_num}\b", re.IGNORECASE)
    for idx in range(total_pages):
        page = doc[idx]
        text = page.get_text("text")
        if pat.search(text[:300]) or pat.search(text[-300:]):
            return idx

    # Fallback to direct index clamped
    return max(0, min(direct_idx, total_pages - 1))


def _split_candidates_by_section(rep: PageRepresentation) -> tuple[list[QuestionCandidate], list[QuestionCandidate]]:
    """
    Separates detected page candidates into Part I (MCQ) and Part II (True/False).
    Identifies 'PHẦN II' banner y-position or question number reset boundaries.
    """
    if not rep.candidates:
        return [], []

    raw_text = rep.raw_text or ""
    has_part_ii_text = bool(re.search(
        r"(?:PHẦN|Phần)\s*(?:II|2)[\s\.\:\-]*(?:Câu\s*trắc\s*nghiệm\s*đúng\s*sai|Đúng\s*sai)?",
        raw_text,
        re.IGNORECASE
    ))

    # Find y-position of PHẦN II if present in blocks
    phan_ii_y = None
    if has_part_ii_text and rep.blocks:
        pat_banner = re.compile(r"(?:PHẦN|Phần)\s*(?:II|2)\b", re.IGNORECASE)
        for b in rep.blocks:
            if pat_banner.search(b.text):
                phan_ii_y = b.bbox[1]
                break

    part_i: list[QuestionCandidate] = []
    part_ii: list[QuestionCandidate] = []

    if phan_ii_y is not None:
        for c in rep.candidates:
            if c.y_pos < phan_ii_y:
                part_i.append(c)
            else:
                part_ii.append(c)
    else:
        # Check if question numbers reset (e.g. [47, 48, 49, 50, 1])
        reset_idx = -1
        for i in range(1, len(rep.candidates)):
            if rep.candidates[i].candidate_number < rep.candidates[i - 1].candidate_number:
                reset_idx = i
                break

        if reset_idx != -1:
            part_i = rep.candidates[:reset_idx]
            part_ii = rep.candidates[reset_idx:]
        else:
            part_i = list(rep.candidates)

    return part_i, part_ii


def inspect_page_ground_truth(
    pdf_path: str,
    pages_arg: str = "",
    query_arg: str = ""
) -> dict:
    """
    Core inspection function. Inspects real questions on the specified page(s)
    and applies natural language query rules.
    """
    if not os.path.isfile(pdf_path):
        return {
            "success": False,
            "error": f"Tệp PDF không tồn tại: {pdf_path}"
        }

    query = (query_arg or "").strip()
    pages_input = (pages_arg or "").strip()

    # 1. Parse page number(s) from pages_arg or query
    start_printed_p: int | None = None
    end_printed_p: int | None = None

    if pages_input:
        m_range = re.match(r"^(\d+)\s*[-–—]\s*(\d+)$", pages_input)
        if m_range:
            start_printed_p = int(m_range.group(1))
            end_printed_p = int(m_range.group(2))
        else:
            m_single = re.match(r"^(\d+)$", pages_input)
            if m_single:
                start_printed_p = int(m_single.group(1))
                end_printed_p = start_printed_p

    if start_printed_p is None and query:
        # Look for page mentions in query
        m_query_range = re.search(
            r"(?:(?:trang|page|p\.?)(?:\s*số|\s*:)?)\s*(\d+)\s*(?:đến|tới|[-–—]|->)\s*(\d+)",
            query,
            re.IGNORECASE
        )
        if m_query_range:
            start_printed_p = int(m_query_range.group(1))
            end_printed_p = int(m_query_range.group(2))
        else:
            m_query_single = re.search(
                r"(?:(?:ở|tại|từ|toàn\s*bộ|cả|trọn\s*vẹn)?\s*(?:trang|page|p\.?)(?:\s*số|\s*:)?)\s*(\d+)",
                query,
                re.IGNORECASE
            )
            if m_query_single:
                start_printed_p = int(m_query_single.group(1))
                end_printed_p = start_printed_p

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        return {
            "success": False,
            "error": "Tệp PDF không chứa trang nào."
        }

    if start_printed_p is None:
        start_printed_p = 1
        end_printed_p = min(total_pages, 3)

    if end_printed_p is None:
        end_printed_p = start_printed_p

    # Resolve physical page indices
    start_phys_idx = _find_physical_page_index(doc, start_printed_p)
    end_phys_idx = _find_physical_page_index(doc, end_printed_p)
    if start_phys_idx > end_phys_idx:
        start_phys_idx, end_phys_idx = end_phys_idx, start_phys_idx

    # Extract representations across target page range
    page_reps: list[PageRepresentation] = []
    for p_idx in range(start_phys_idx, end_phys_idx + 1):
        rep = extract_page_representation(doc, p_idx)
        page_reps.append(rep)
    doc.close()

    # Aggregate candidates and section division
    all_part_i: list[QuestionCandidate] = []
    all_part_ii: list[QuestionCandidate] = []

    for rep in page_reps:
        p_i, p_ii = _split_candidates_by_section(rep)
        all_part_i.extend(p_i)
        all_part_ii.extend(p_ii)

    has_part_i = len(all_part_i) > 0
    has_part_ii = len(all_part_ii) > 0
    part_ii_start = all_part_ii[0].candidate_number if all_part_ii else None

    # Determine base candidate set according to query section preference
    q_lower = query.lower()
    is_part_ii_only = bool(re.search(r"(?:chỉ\s*lấy\s*phần\s*đúng\s*sai|phần\s*(?:ii|2)|trắc\s*nghiệm\s*đúng\s*sai)", q_lower))
    is_part_i_only = bool(re.search(r"(?:chỉ\s*lấy\s*phần\s*trắc\s*nghiệm|phần\s*(?:i|1)|4\s*lựa\s*chọn|nhiều\s*phương\s*án)", q_lower))

    if is_part_ii_only and all_part_ii:
        active_cands = list(all_part_ii)
    elif is_part_i_only and all_part_i:
        active_cands = list(all_part_i)
    else:
        # Default: if Part I exists, prioritize Part I for start and count
        active_cands = list(all_part_i) if all_part_i else list(all_part_ii)

    if not active_cands:
        # Fallback to all detected candidates if any
        all_cands = [c for r in page_reps for c in r.candidates]
        active_cands = all_cands

    # Apply Parity Filter (câu lẻ / câu chẵn)
    parity_filter = "all"
    if re.search(r"\b(?:các\s*câu\s*lẻ|câu\s*lẻ|lẻ)\b", q_lower):
        active_cands = [c for c in active_cands if c.candidate_number % 2 != 0]
        parity_filter = "odd"
    elif re.search(r"\b(?:các\s*câu\s*chẵn|câu\s*chẵn|chẵn)\b", q_lower):
        active_cands = [c for c in active_cands if c.candidate_number % 2 == 0]
        parity_filter = "even"

    # Apply Explicit Question Range Filter (từ câu X đến câu Y)
    m_q_range = re.search(
        r"(?:từ\s*)?câu\s*(\d+)\s*(?:đến|tới|[-–—]|->|\.\.)\s*(?:câu\s*)?(\d+)",
        query,
        re.IGNORECASE
    )
    if m_q_range:
        q_min = int(m_q_range.group(1))
        q_max = int(m_q_range.group(2))
        if q_min > q_max:
            q_min, q_max = q_max, q_min
        active_cands = [c for c in active_cands if q_min <= c.candidate_number <= q_max]
    else:
        m_from_end = re.search(r"(?:từ\s*)?câu\s*(\d+)\s*(?:đến\s*hết|trở\s*đi)", query, re.IGNORECASE)
        if m_from_end:
            q_min = int(m_from_end.group(1))
            active_cands = [c for c in active_cands if c.candidate_number >= q_min]

    # Apply Head / Tail / Limit Filter
    m_head = re.search(r"(\d+)\s*câu\s*đầu", query, re.IGNORECASE)
    m_tail = re.search(r"(\d+)\s*câu\s*cuối", query, re.IGNORECASE)
    m_take = re.search(r"(?:lấy|chọn|làm|tạo)\s*(\d+)\s*câu", query, re.IGNORECASE)

    if m_head:
        n = int(m_head.group(1))
        active_cands = active_cands[:n]
    elif m_tail:
        n = int(m_tail.group(1))
        active_cands = active_cands[-n:]
    elif m_take and not m_q_range:
        n = int(m_take.group(1))
        active_cands = active_cands[:n]

    # Compute Final Ground-Truth Numbers
    detected_numbers = [c.candidate_number for c in active_cands]
    # Remove duplicates while preserving order
    unique_numbers: list[int] = []
    for num in detected_numbers:
        if num not in unique_numbers:
            unique_numbers.append(num)

    if unique_numbers:
        start_num = unique_numbers[0]
        end_num = unique_numbers[-1]
        count_num = len(unique_numbers)
    else:
        # Fallback if no questions detected on page
        start_num = 1
        end_num = 1
        count_num = 1

    # Format pages string
    if start_printed_p == end_printed_p:
        pages_str = str(start_printed_p)
    else:
        pages_str = f"{start_printed_p}-{end_printed_p}"

    # Extract Exam Code / Prefix and Title
    m_exam = re.search(
        r"(?<!chuyên\s)(?<!chủ\s)\b(?:[Đđ]ề\s*số|[Đđ]ề\s*thi|[Đđ]ề|[Mm]ã\s*đề)\s*([0-9]+|[A-Z][0-9A-Z\-]*)\b",
        query,
        re.IGNORECASE
    )
    if m_exam:
        clean_code = m_exam.group(1).strip()
        prefix = f"De_So_{clean_code}"
        title = f"ĐỀ SỐ {clean_code} - TRANG {pages_str}"
    else:
        prefix = f"Trang_{pages_str.replace('-', '_')}"
        title = f"BÀI TẬP TRẮC NGHIỆM TRANG {pages_str}"

    return {
        "success": True,
        "pages": pages_str,
        "start": start_num,
        "end": end_num,
        "count": count_num,
        "detected_questions": unique_numbers,
        "parity_filter": parity_filter,
        "has_part_i": has_part_i,
        "has_part_ii": has_part_ii,
        "part_ii_start": part_ii_start,
        "title": title,
        "prefix": prefix,
        "source": "inspect"
    }


def main():
    parser = argparse.ArgumentParser(description="Ground-Truth Page Inspector CLI for Quiz Generator")
    parser.add_argument("pdf_path", help="Path to input PDF file")
    parser.add_argument("--pages", "-p", default="", help="Page range (e.g. 41, 37-39)")
    parser.add_argument("--query", "-q", default="", help="Natural language prompt/instruction")

    args = parser.parse_args()

    result = inspect_page_ground_truth(
        pdf_path=args.pdf_path,
        pages_arg=args.pages,
        query_arg=args.query
    )

    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
