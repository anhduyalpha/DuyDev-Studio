"""
Fast Deterministic Geometry QA for Generated PDFs.
Verifies page dimensions (A4 portrait compliance), margin clearance, content bounds,
question split avoidance, orphan heading prevention, and blank page elimination using PyMuPDF.
"""

import os
import re
from typing import Optional
import pymupdf

from engines.quiz.ir.models import CanonicalDocumentIR, SectionType
from engines.quiz.rendering.layout import LayoutSolver
from engines.quiz.qa.models import (
    GeometryQAResult,
    QAIssue,
    QAIssueType,
    QASeverity,
)


def verify_option_integrity(
    doc: pymupdf.Document,
    doc_ir: CanonicalDocumentIR,
    content_bottom_limit: float = 813.5,
) -> list[QAIssue]:
    """
    Deterministically verifies that all options (A, B, C, D) for every multiple-choice
    or True/False question are present in the rendered PDF text layer and located
    on the same page as their question stem (preventing detached/split options across page breaks).
    """
    issues: list[QAIssue] = []
    page_count = doc.page_count
    if page_count < 1 or not doc_ir.questions:
        return issues

    page_texts: list[str] = [doc[p].get_text() for p in range(page_count)]

    for q in doc_ir.questions:
        if q.type not in (SectionType.PART_I_MCQ, SectionType.PART_II_TF):
            continue

        expected_labels = (
            [opt.label for opt in q.options]
            if q.type == SectionType.PART_I_MCQ
            else [stmt.label for stmt in q.sub_statements]
        )
        if not expected_labels:
            continue

        # Check if question is oversized (e.g. exceeds 85% of usable A4 height)
        est_height = LayoutSolver.estimate_question_height_pt(q)
        is_oversized = est_height > 650.0

        # Find question on pages: pattern Câu <number> followed by . or :
        q_num_pattern = re.compile(rf"\bCâu\s+{q.number}\s*[\.:]", re.IGNORECASE)
        stem_page_idx = -1
        stem_pos = -1

        for p_idx in range(page_count):
            m = q_num_pattern.search(page_texts[p_idx])
            if m:
                stem_page_idx = p_idx
                stem_pos = m.start()
                break

        if stem_page_idx == -1:
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.CARDINALITY_MISMATCH,
                    severity=QASeverity.CRITICAL,
                    description=f"Option integrity: Question {q.number} (qid={q.id}) stem not found in PDF text layer.",
                )
            )
            continue

        q_page_num = stem_page_idx + 1

        # Determine boundaries of question q on stem_page_idx
        next_q_num = q.number + 1
        next_q_pattern = re.compile(rf"\bCâu\s+{next_q_num}\s*[\.:]", re.IGNORECASE)
        m_next = next_q_pattern.search(page_texts[stem_page_idx], pos=stem_pos)

        if m_next:
            q_slice = page_texts[stem_page_idx][stem_pos:m_next.start()]
        else:
            q_slice = page_texts[stem_page_idx][stem_pos:]

        # Check each expected option label in q_slice
        for label in expected_labels:
            if q.type == SectionType.PART_I_MCQ:
                label_pat = re.compile(rf"(?:^|\s|\n){re.escape(label)}\.", re.IGNORECASE)
            else:
                label_pat = re.compile(rf"(?:^|\s|\n){re.escape(label)}\)", re.IGNORECASE)

            if label_pat.search(q_slice):
                # Option found on the stem page!
                continue

            # Option NOT found on stem page! Check if it spilled to next page
            spilled_to_next = False
            if stem_page_idx + 1 < page_count:
                next_page_text = page_texts[stem_page_idx + 1]
                m_next_on_next = next_q_pattern.search(next_page_text)
                next_page_slice = (
                    next_page_text[:m_next_on_next.start()]
                    if m_next_on_next
                    else next_page_text
                )
                if label_pat.search(next_page_slice):
                    spilled_to_next = True

            if spilled_to_next:
                if is_oversized:
                    # Oversized questions spanning pages are expected under oversized policy
                    issues.append(
                        QAIssue(
                            page=q_page_num,
                            type=QAIssueType.SPLIT_QUESTION,
                            severity=QASeverity.LOW,
                            description=(
                                f"Oversized Question {q.number} (qid={q.id}, ~{est_height:.0f}pt) "
                                f"flows across pages: option '{label}' rendered on page {q_page_num + 1}."
                            ),
                        )
                    )
                else:
                    # Normal questions MUST NOT split options across page boundaries
                    issues.append(
                        QAIssue(
                            page=q_page_num,
                            type=QAIssueType.SPLIT_QUESTION,
                            severity=QASeverity.CRITICAL,
                            description=(
                                f"Atomic pagination defect: Question {q.number} (qid={q.id}) options split across pages! "
                                f"Stem is on page {q_page_num}, but option '{label}' spilled to page {q_page_num + 1}."
                            ),
                        )
                    )
            else:
                # Option is completely missing / dropped!
                issues.append(
                    QAIssue(
                        page=q_page_num,
                        type=QAIssueType.CARDINALITY_MISMATCH,
                        severity=QASeverity.CRITICAL,
                        description=(
                            f"Option integrity defect: Question {q.number} (qid={q.id}) option '{label}' "
                            f"was dropped or clipped outside page bounds."
                        ),
                    )
                )

    return issues


def validate_pdf_geometry(
    pdf_path: str,
    margins_mm: tuple[float, float, float, float] = (10.0, 12.0, 10.0, 12.0),
    doc_ir: Optional[CanonicalDocumentIR] = None,
) -> GeometryQAResult:
    """
    Deterministically inspect PDF geometry and layout integrity.
    margins_mm: (top, right, bottom, left) in millimeters.
    """
    if not os.path.isfile(pdf_path) or os.path.getsize(pdf_path) < 100:
        return GeometryQAResult(
            status="FAIL",
            is_a4_compliant=False,
            page_count=0,
            issues=[
                QAIssue(
                    page=0,
                    type=QAIssueType.MISSING_FILE,
                    severity=QASeverity.CRITICAL,
                    description=f"PDF file is missing or corrupted: {pdf_path}",
                )
            ],
        )

    issues: list[QAIssue] = []
    doc = pymupdf.open(pdf_path)
    page_count = doc.page_count

    if page_count < 1:
        doc.close()
        return GeometryQAResult(
            status="FAIL",
            is_a4_compliant=False,
            page_count=0,
            issues=[
                QAIssue(
                    page=0,
                    type=QAIssueType.MISSING_FILE,
                    severity=QASeverity.CRITICAL,
                    description="PDF contains 0 pages.",
                )
            ],
        )

    # Standard A4: 595.28 x 841.89 points
    std_width_pt = 595.28
    std_height_pt = 841.89
    pt_per_mm = 72.0 / 25.4

    margin_top_pt = margins_mm[0] * pt_per_mm
    margin_right_pt = margins_mm[1] * pt_per_mm
    margin_bottom_pt = margins_mm[2] * pt_per_mm
    margin_left_pt = margins_mm[3] * pt_per_mm

    # Content boundaries
    content_bottom_limit = std_height_pt - margin_bottom_pt  # ~ 813.5 pt
    content_right_limit = std_width_pt - margin_right_pt     # ~ 561.3 pt

    a4_compliant = True

    for p_idx in range(page_count):
        page_num = p_idx + 1
        page = doc[p_idx]
        rect = page.rect

        # 1. Page Size Check (tolerance +- 6 pt)
        if abs(rect.width - std_width_pt) > 6.0 or abs(rect.height - std_height_pt) > 6.0:
            a4_compliant = False
            issues.append(
                QAIssue(
                    page=page_num,
                    type=QAIssueType.OVERFLOW,
                    severity=QASeverity.HIGH,
                    description=f"Non-standard A4 dimensions on page {page_num}: {rect.width:.1f} x {rect.height:.1f} pt (expected 595.3 x 841.9 pt)",
                    bbox=(0, 0, rect.width, rect.height),
                )
            )

        blocks = page.get_text("blocks")
        text_blocks = [b for b in blocks if b[4].strip()]

        # 2. Margin Clearance & Content Bounds
        for b in text_blocks:
            x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], b[4].strip()

            # Ignore running footer block (usually at y0 >= 815 pt)
            is_running_footer = y0 >= (content_bottom_limit + 1.0) and bool(
                re.search(r"Trang\s+\d+|counter\(page\)", text, re.IGNORECASE)
            )
            if is_running_footer:
                continue

            # Bottom overflow past bottom margin
            if y1 > (content_bottom_limit + 6.0):
                issues.append(
                    QAIssue(
                        page=page_num,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.MEDIUM,
                        description=f"Content block overflows bottom margin at y1={y1:.1f} pt (limit: {content_bottom_limit:.1f} pt): '{text[:40]}...'",
                        bbox=(x0, y0, x1, y1),
                    )
                )

            # Right margin overflow
            if x1 > (content_right_limit + 10.0):
                issues.append(
                    QAIssue(
                        page=page_num,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.LOW,
                        description=f"Content block overflows right margin at x1={x1:.1f} pt: '{text[:30]}...'",
                        bbox=(x0, y0, x1, y1),
                    )
                )

        # 3. Orphan Heading Check: Section banner on the last line of the page
        if text_blocks:
            last_block = max(text_blocks, key=lambda b: b[3])
            last_text = last_block[4].strip()
            if last_block[1] > 740.0:
                is_heading = bool(
                    re.search(r"PHẦN\s+[I|V|X]+|CÂU\s+HỎI\s+TRẮC\s+NGHIỆM", last_text, re.IGNORECASE)
                )
                if is_heading:
                    issues.append(
                        QAIssue(
                            page=page_num,
                            type=QAIssueType.ORPHAN_HEADING,
                            severity=QASeverity.HIGH,
                            description=f"Section heading appears isolated at bottom of page {page_num} at y0={last_block[1]:.1f} pt without following questions.",
                            bbox=(last_block[0], last_block[1], last_block[2], last_block[3]),
                        )
                    )

        # 4. Split Question Check: Question stem at very bottom with options on next page
        if p_idx < page_count - 1 and text_blocks:
            last_q_block = None
            for b in reversed(text_blocks):
                if re.search(r"\bCâu\s+\d+[\.\:]", b[4], re.IGNORECASE):
                    last_q_block = b
                    break

            if last_q_block and (last_q_block[3] > 760.0 or last_q_block[1] > 740.0):
                # Check if next page starts immediately with options
                next_page_blocks = doc[p_idx + 1].get_text("blocks")
                next_text_blocks = [b for b in next_page_blocks if b[4].strip()]
                if next_text_blocks:
                    first_text = next_text_blocks[0][4].strip()
                    if re.match(r"^[A-D]\.|\b[a-d]\)", first_text):
                        issues.append(
                            QAIssue(
                                page=page_num,
                                type=QAIssueType.SPLIT_QUESTION,
                                severity=QASeverity.HIGH,
                                description=f"Question starting at page {page_num} (y0={last_q_block[1]:.1f} pt) appears split with options spilling to page {page_num + 1}.",
                                bbox=(last_q_block[0], last_q_block[1], last_q_block[2], last_q_block[3]),
                            )
                        )

    # 5. Trailing Blank Page Check
    if page_count > 1:
        last_page = doc[page_count - 1]
        last_text_full = last_page.get_text().strip()
        # Filter out footer page counters
        clean_last_text = re.sub(r"Trang\s+\d+\s*/\s*\d+|--- HẾT ---", "", last_text_full).strip()
        if len(clean_last_text) < 30:
            issues.append(
                QAIssue(
                    page=page_count,
                    type=QAIssueType.BAD_SPACING,
                    severity=QASeverity.MEDIUM,
                    description=f"Final page {page_count} has excessive whitespace or is nearly empty ({len(clean_last_text)} non-footer characters).",
                )
            )

    # 6. Option Integrity Check (if doc_ir provided)
    if doc_ir:
        option_issues = verify_option_integrity(doc, doc_ir, content_bottom_limit=content_bottom_limit)
        issues.extend(option_issues)

    doc.close()

    # Determine aggregate status
    has_critical = any(i.severity == QASeverity.CRITICAL for i in issues)
    has_high = any(i.severity == QASeverity.HIGH for i in issues)
    has_medium = any(i.severity == QASeverity.MEDIUM for i in issues)

    if has_critical or has_high:
        status = "FAIL"
    elif has_medium or issues:
        status = "WARN"
    else:
        status = "PASS"

    return GeometryQAResult(
        status=status,
        issues=issues,
        page_count=page_count,
        is_a4_compliant=a4_compliant,
    )
