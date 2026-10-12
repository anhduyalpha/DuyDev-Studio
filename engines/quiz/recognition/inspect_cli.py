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


BANNER_PART_I_PATTERN = re.compile(
    r"(?:PHẦN|Phần)\s*(?:I|1)\b",
    re.IGNORECASE
)
BANNER_PART_II_PATTERN = re.compile(
    r"(?:PHẦN|Phần)\s*(?:II|2)\b",
    re.IGNORECASE
)
BANNER_PART_III_PATTERN = re.compile(
    r"(?:PHẦN|Phần)\s*(?:III|3)\b",
    re.IGNORECASE
)


def _split_candidates_by_section(
    rep: PageRepresentation,
    inherited_section: str = "part_i"
) -> tuple[list[QuestionCandidate], list[QuestionCandidate], list[QuestionCandidate]]:
    """
    Separates detected page candidates into Part I (MCQ), Part II (True/False), and Part III (Short Answer).
    Employs 3-Tier Multi-Signal Classification Engine:
    - Tier 1: Intrinsic Structure (Highest Priority):
        * If >= 2 options A, B, C, D detected -> MUST be PART_I_MCQ (even for statement-counting questions)
        * If sub-statements a-d exist and NO options A-D -> PART_II_TF
        * If neither options A-D nor sub-statements a-d exist -> PART_III_SHORT (or banner/inherited fallback)
    - Tier 2: Banner Detection & Cross-Page Inheritance:
        * Banners for PHẦN I, II, III with y-coordinate tracking
        * Inherited section context from preceding page
    - Tier 3: Numbering Reset Boundaries:
        * When q_num <= prev_q_num or q_num == 1, transitions section boundary.
    """
    if not rep.candidates:
        return [], [], []

    banners: list[tuple[float, str]] = []
    if rep.blocks:
        for b in rep.blocks:
            text = b.text.strip()
            if BANNER_PART_III_PATTERN.search(text):
                banners.append((b.bbox[1], "part_iii"))
            elif BANNER_PART_II_PATTERN.search(text):
                banners.append((b.bbox[1], "part_ii"))
            elif BANNER_PART_I_PATTERN.search(text):
                banners.append((b.bbox[1], "part_i"))
    banners.sort(key=lambda x: x[0])

    def get_banner_sec_for_cand(cand_y: float) -> str:
        if not banners:
            return inherited_section
        sec = inherited_section
        for b_y, b_sec in banners:
            if cand_y >= b_y - 5.0:
                sec = b_sec
            else:
                break
        return sec

    part_i: list[QuestionCandidate] = []
    part_ii: list[QuestionCandidate] = []
    part_iii: list[QuestionCandidate] = []

    current_sec = inherited_section
    prev_q_num: Optional[int] = None

    for c in rep.candidates:
        cand_banner_sec = get_banner_sec_for_cand(c.y_pos)

        # Tier 1 (Intrinsic Structure - Highest Priority)
        if len(c.options_detected) >= 2:
            # MUST be PART_I_MCQ even if sub-statements a-d exist in stem (statement counting)
            final_sec = "part_i"
        elif len(c.options_detected) == 0 and len(c.statements_detected) >= 2:
            # Sub-statements present without options A-D -> PART_II_TF
            final_sec = "part_ii"
        else:
            # Tier 2: Banner context
            if banners:
                final_sec = cand_banner_sec
            else:
                # Tier 3: Numbering Reset Boundaries
                final_sec = current_sec
                if prev_q_num is not None and (c.candidate_number <= prev_q_num or c.candidate_number == 1):
                    if current_sec == "part_i":
                        final_sec = "part_ii"
                    elif current_sec == "part_ii":
                        final_sec = "part_iii"

        current_sec = final_sec
        prev_q_num = c.candidate_number

        if final_sec == "part_i":
            part_i.append(c)
        elif final_sec == "part_ii":
            part_ii.append(c)
        else:
            part_iii.append(c)

    return part_i, part_ii, part_iii


def parse_requested_pages(pages_input: str, query: str) -> list[int]:
    """
    Parses printed page numbers from explicit pages argument or natural language query.
    Supports:
      - comma-separated: '15,16', '15, 16', '15, 16, 17', '15, 18'
      - hyphen/dash ranges: '15-16', '15–16', '15—16', '15 - 16'
      - words: '15 đến 16', '15 tới 16', '15 và 16', '15 với 16', '15 & 16'
      - single: '15', '41'
    """
    raw = ""
    if pages_input:
        raw = pages_input.strip()
    elif query:
        pat = re.search(
            r"(?:(?:ở|tại|từ|toàn\s*bộ|cả|trọn\s*vẹn)?\s*\b(?:trang|page|p\b\.?)(?:\s*số|\s*:)?)\s*([^.;?!]+)",
            query,
            re.IGNORECASE
        )
        if pat:
            raw = pat.group(1).strip()
            stop_match = re.search(r"\b(?:từ\s*(?:câu|bài|q|\d)|câu|lấy|chọn|bắt\s*đầu|phần|đề|chủ\s*đề|tạo|làm|gồm|nhặt|trích)\b", raw, re.IGNORECASE)
            if stop_match:
                raw = raw[:stop_match.start()].strip()
            raw = re.sub(r"\b(?:trang|page|p\b\.?)(?:\s*số)?\b", "", raw, flags=re.IGNORECASE).strip()

    if not raw:
        return []

    pages: list[int] = []
    normalized = re.sub(r"\s*(?:và|với|&)\s*", ",", raw, flags=re.IGNORECASE)
    parts = [p.strip() for p in normalized.split(",") if p.strip()]
    for part in parts:
        range_match = re.search(r"^(\d+)\s*(?:đến|tới|[-–—]|->)\s*(\d+)$", part, re.IGNORECASE)
        if range_match:
            s, e = int(range_match.group(1)), int(range_match.group(2))
            if s <= e:
                pages.extend(range(s, e + 1))
            else:
                pages.extend(range(e, s + 1))
        else:
            single = re.search(r"^(\d+)$", part)
            if single:
                pages.append(int(single.group(1)))

    return sorted(list(dict.fromkeys(pages)))


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
    requested_pages = parse_requested_pages(pages_input, query)
    is_explicit_page_bounded = bool(requested_pages)

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        return {
            "success": False,
            "error": "Tệp PDF không chứa trang nào."
        }

    if not requested_pages:
        requested_pages = [1, 2, 3] if total_pages >= 3 else list(range(1, total_pages + 1))

    # Resolve physical page indices (preserving sorted unique indices)
    phys_indices: list[int] = []
    for p_num in requested_pages:
        idx = _find_physical_page_index(doc, p_num)
        if idx not in phys_indices:
            phys_indices.append(idx)
    phys_indices.sort()

    start_phys_idx = phys_indices[0] if phys_indices else 0

    # Cross-page inheritance: detect section context from preceding page if starting mid-section
    inherited_section = "part_i"
    if start_phys_idx > 0:
        first_page_has_top_banner = False
        p0 = doc[start_phys_idx]
        p0_text = p0.get_text("text")
        if (
            BANNER_PART_I_PATTERN.search(p0_text[:400])
            or BANNER_PART_II_PATTERN.search(p0_text[:400])
            or BANNER_PART_III_PATTERN.search(p0_text[:400])
        ):
            first_page_has_top_banner = True

        if not first_page_has_top_banner:
            # Scan backward through preceding pages to locate the active section
            for back_idx in range(start_phys_idx - 1, max(-1, start_phys_idx - 10), -1):
                prev_p = doc[back_idx]
                prev_text = prev_p.get_text("text")
                m_iii = list(BANNER_PART_III_PATTERN.finditer(prev_text))
                m_ii = list(BANNER_PART_II_PATTERN.finditer(prev_text))
                m_i = list(BANNER_PART_I_PATTERN.finditer(prev_text))

                found_banner = False
                last_pos = -1
                if m_iii and m_iii[-1].start() > last_pos:
                    last_pos = m_iii[-1].start()
                    inherited_section = "part_iii"
                    found_banner = True
                if m_ii and m_ii[-1].start() > last_pos:
                    last_pos = m_ii[-1].start()
                    inherited_section = "part_ii"
                    found_banner = True
                if m_i and m_i[-1].start() > last_pos:
                    last_pos = m_i[-1].start()
                    inherited_section = "part_i"
                    found_banner = True
                if found_banner:
                    break

    # Extract representations across target page range
    page_reps: list[PageRepresentation] = []
    for p_idx in phys_indices:
        rep = extract_page_representation(doc, p_idx)
        page_reps.append(rep)
    doc.close()

    # Aggregate candidates and section division
    all_part_i: list[QuestionCandidate] = []
    all_part_ii: list[QuestionCandidate] = []
    all_part_iii: list[QuestionCandidate] = []

    curr_inherited = inherited_section
    for rep in page_reps:
        p_i, p_ii, p_iii = _split_candidates_by_section(rep, inherited_section=curr_inherited)
        all_part_i.extend(p_i)
        all_part_ii.extend(p_ii)
        all_part_iii.extend(p_iii)
        if p_iii:
            curr_inherited = "part_iii"
        elif p_ii:
            curr_inherited = "part_ii"
        elif p_i:
            curr_inherited = "part_i"

    has_part_i = len(all_part_i) > 0
    has_part_ii = len(all_part_ii) > 0
    has_part_iii = len(all_part_iii) > 0
    part_i_count = len(all_part_i)
    part_ii_start = all_part_ii[0].candidate_number if all_part_ii else None
    part_ii_count = len(all_part_ii)
    part_iii_start = all_part_iii[0].candidate_number if all_part_iii else None
    part_iii_count = len(all_part_iii)

    # Determine base candidate set according to query section preference
    q_lower = query.lower()
    is_part_iii_only = bool(re.search(
        r"(?:chỉ\s*lấy\s*phần\s*trả\s*lời\s*ngắn|phần\s*(?:iii|3)|trả\s*lời\s*ngắn|điền\s*đáp\s*số)",
        q_lower
    ))
    is_part_ii_only = bool(re.search(
        r"(?:chỉ\s*lấy\s*phần\s*đúng\s*sai|phần\s*(?:ii|2)|trắc\s*nghiệm\s*đúng\s*sai)",
        q_lower
    ))
    is_part_i_only = bool(re.search(
        r"(?:chỉ\s*lấy\s*phần\s*trắc\s*nghiệm|phần\s*(?:i|1)|4\s*lựa\s*chọn|nhiều\s*phương\s*án)",
        q_lower
    ))

    if is_part_iii_only:
        section_filter = "part_iii"
        active_cands = list(all_part_iii)
    elif is_part_ii_only:
        section_filter = "part_ii"
        active_cands = list(all_part_ii)
    elif is_part_i_only:
        section_filter = "part_i"
        active_cands = list(all_part_i)
    else:
        section_filter = "all"
        is_parity_query = bool(re.search(
            r"\b(?:các\s*câu\s*lẻ|câu\s*lẻ|lẻ|các\s*câu\s*chẵn|câu\s*chẵn|chẵn)\b",
            q_lower
        ))
        if is_parity_query and all_part_i:
            active_cands = list(all_part_i)
        else:
            # Whole page or all sections: combine all detected parts!
            active_cands = list(all_part_i) + list(all_part_ii) + list(all_part_iii)

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
        m_single_q = re.search(
            r"(?:(?:chỉ\s*(?:lấy|làm)?\s*|duy\s*nhất\s*|đúng\s*)câu\s*(\d+)|\bcâu\s*(\d+)\s+(?:trang|ở|tại))",
            query,
            re.IGNORECASE
        )
        if m_from_end:
            q_min = int(m_from_end.group(1))
            active_cands = [c for c in active_cands if c.candidate_number >= q_min]
        elif m_single_q:
            q_target = int(m_single_q.group(1) or m_single_q.group(2))
            matching = [c for c in active_cands if c.candidate_number == q_target]
            if matching:
                active_cands = matching

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

    if parity_filter != "all":
        start_num = unique_numbers[0] if unique_numbers else 1
        end_num = unique_numbers[-1] if unique_numbers else 1
    elif all_part_i and (section_filter == "all" or section_filter == "part_i"):
        start_num = all_part_i[0].candidate_number
        end_num = all_part_i[-1].candidate_number
    elif unique_numbers:
        start_num = unique_numbers[0]
        end_num = unique_numbers[-1]
    else:
        # Fallback if no questions detected on page
        start_num = 1
        end_num = 1

    count_num = len(unique_numbers) if unique_numbers else 1

    # Format pages string
    if not requested_pages:
        pages_str = "1"
    elif len(requested_pages) == 1:
        pages_str = str(requested_pages[0])
    else:
        is_continuous = all(requested_pages[i] == requested_pages[i-1] + 1 for i in range(1, len(requested_pages)))
        if is_continuous:
            pages_str = f"{requested_pages[0]}-{requested_pages[-1]}"
        else:
            pages_str = ", ".join(str(p) for p in requested_pages)

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
        safe_pages = pages_str.replace(", ", "_").replace(",", "_").replace("-", "_")
        prefix = f"Trang_{safe_pages}"
        title = f"BÀI TẬP TRẮC NGHIỆM TRANG {pages_str}"

    return {
        "success": True,
        "pages": pages_str,
        "start": start_num,
        "end": end_num,
        "count": count_num,
        "detected_questions": unique_numbers,
        "is_page_bounded": is_explicit_page_bounded,
        "parity_filter": parity_filter,
        "section_filter": section_filter,
        "has_part_i": has_part_i,
        "has_part_ii": has_part_ii,
        "has_part_iii": has_part_iii,
        "part_i_count": part_i_count,
        "part_ii_start": part_ii_start,
        "part_ii_count": part_ii_count,
        "part_iii_start": part_iii_start,
        "part_iii_count": part_iii_count,
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
