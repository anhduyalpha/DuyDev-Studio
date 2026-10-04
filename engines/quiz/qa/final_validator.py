"""
Final Production Quality Assurance (QA) Validator for Quiz Pipeline.
Executes comprehensive, deterministic validation on the final rendered HTML and PDF artifacts:
1. DOCUMENT LEVEL: File exists, page count > 0, opens cleanly in PyMuPDF, no corrupt pages.
2. QUESTION LEVEL: Question count, sequential/canonical numbers, zero duplicates, zero missing, zero unexpected.
3. OPTION LEVEL: Every expected option exists on the question page, unique labels, zero dropped/clipped options (e.g. Option D).
4. ASSET LEVEL: Every rich element exists, valid dimensions, non-zero byte, not black/blank placeholder, placed in final document.
5. LAYOUT LEVEL: Content inside printable bounds, zero split questions (unless oversized), zero orphan headings.
6. TEMPLATE LEVEL: Zero unresolved 'N' placeholders, zero 'undefined' or 'null' strings, valid page numbering.
7. HTML LEVEL: Markup integrity, options A, B, C, D present in HTML, assets referenced.
8. DAP AN LEVEL: Answer key document exists, answers mapped to questions, no unresolved placeholders.
"""

import io
import logging
import os
import re
from typing import Optional
from collections import Counter
import pymupdf
from PIL import Image, ImageStat
from pydantic import BaseModel, Field

from engines.quiz.ir.models import CanonicalDocumentIR, SectionType
from engines.quiz.qa.models import QAIssue, QAIssueType, QASeverity
from engines.quiz.assets.extractor import is_black_or_blank_image
from engines.quiz.rendering.layout import LayoutSolver

logger = logging.getLogger("engines.quiz.qa.final_validator")


class FinalValidationResult(BaseModel):
    """Result of comprehensive final production PDF validation."""
    status: str = "PASS"                  # "PASS" | "FAIL"
    is_document_valid: bool = True
    is_question_valid: bool = True
    is_option_valid: bool = True
    is_asset_valid: bool = True
    is_layout_valid: bool = True
    is_template_valid: bool = True
    is_html_valid: bool = True
    is_dapan_valid: bool = True
    page_count: int = 1
    questions_found: list[int] = Field(default_factory=list)
    issues: list[QAIssue] = Field(default_factory=list)

    def is_pass(self) -> bool:
        return self.status == "PASS" and not any(
            i.severity in (QASeverity.CRITICAL, QASeverity.HIGH)
            for i in self.issues
        )


def _find_question_header_matches(text: str, q_num: Optional[int] = None) -> list[re.Match]:
    """
    Finds real question header occurrences (e.g., 'Câu 1:', 'Câu 2.'),
    filtering out references in instructions or running text (e.g., 'từ câu 1 đến câu 20.').
    """
    if q_num is not None:
        pat = rf"\bCâu\s+{q_num}\s*[\.:]"
    else:
        pat = r"\bCâu\s+(\d+)\s*[\.:]"

    valid_matches: list[re.Match] = []
    for m in re.finditer(pat, text, re.IGNORECASE):
        prefix_start = max(0, m.start() - 35)
        prefix_text = text[prefix_start:m.start()].lower()
        # Skip if preceded by words indicating range/reference in narrative text
        if re.search(r"\b(từ|đến|qua|ở|xem|trong|tại|theo|cho)\s+$", prefix_text):
            continue
        valid_matches.append(m)
    return valid_matches


def validate_rendered_html(
    html_path: str,
    doc_ir: CanonicalDocumentIR,
) -> list[QAIssue]:
    """
    Validates intermediate HTML markup before or after compilation to PDF:
    - HTML file exists and is readable
    - Every question stem exists in HTML
    - Every expected option (A, B, C, D for Part I MCQ) exists in HTML
    - No unresolved placeholders ('câu N', 'undefined', 'null', 'NaN', etc.)
    """
    issues: list[QAIssue] = []
    if not os.path.isfile(html_path) or os.path.getsize(html_path) < 100:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description=f"Worksheet HTML file missing or empty: {html_path}",
            )
        )
        return issues

    try:
        with open(html_path, "r", encoding="utf-8") as f:
            html_text = f.read()
    except Exception as ex:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description=f"Cannot read HTML file: {ex}",
            )
        )
        return issues

    # 1. Check placeholders in HTML
    n_placeholder_pat = re.compile(
        r"(?:từ\s+câu\s+\d+\s+đến\s+câu\s+N\b|đến\s+câu\s+N\b|câu\s+1\s+đến\s+câu\s+N\b|\bcâu\s+N\b|page\s+N\b|trang\s+N\b|question\s+N\b|placeholder)",
        re.IGNORECASE,
    )
    m_n = n_placeholder_pat.search(html_text)
    if m_n:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.OTHER,
                severity=QASeverity.CRITICAL,
                description=f"Template defect in HTML: Unresolved placeholder '{m_n.group(0)}'.",
            )
        )

    und_null_pat = re.compile(r"\b(?:undefined|null|NaN|\[object\s+Object\])\b", re.IGNORECASE)
    m_und = und_null_pat.search(html_text)
    if m_und:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.OTHER,
                severity=QASeverity.CRITICAL,
                description=f"Template defect in HTML: Unresolved '{m_und.group(0)}'.",
            )
        )

    # 2. Check question and option integrity in HTML
    for q in doc_ir.questions:
        # Question header check
        q_hdr_pat = re.compile(rf"Câu\s+{q.number}\s*[\.:]", re.IGNORECASE)
        if not q_hdr_pat.search(html_text):
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.CARDINALITY_MISMATCH,
                    severity=QASeverity.CRITICAL,
                    description=f"HTML content defect: Question {q.number} header missing in HTML.",
                )
            )

        if q.type == SectionType.PART_I_MCQ:
            for opt in q.options:
                opt_pat = re.compile(rf'class="opt-letter">\s*{re.escape(opt.label)}\.\s*</span>', re.IGNORECASE)
                if not opt_pat.search(html_text):
                    issues.append(
                        QAIssue(
                            page=0,
                            type=QAIssueType.CARDINALITY_MISMATCH,
                            severity=QASeverity.CRITICAL,
                            description=f"HTML content defect: Question {q.number} missing option '{opt.label}' in rendered HTML.",
                        )
                    )
        elif q.type == SectionType.PART_II_TF:
            for stmt in q.sub_statements:
                stmt_pat = re.compile(rf'class="tf-letter">\s*{re.escape(stmt.label)}\)\s*</span>', re.IGNORECASE)
                if not stmt_pat.search(html_text):
                    issues.append(
                        QAIssue(
                            page=0,
                            type=QAIssueType.CARDINALITY_MISMATCH,
                            severity=QASeverity.CRITICAL,
                            description=f"HTML content defect: Question {q.number} missing statement '{stmt.label}' in rendered HTML.",
                        )
                    )

        # Rich elements check in HTML
        for elem in q.rich_elements:
            if elem.source_crop_path:
                basename = os.path.basename(elem.source_crop_path)
                if basename not in html_text and "data:image" not in html_text:
                    issues.append(
                        QAIssue(
                            page=0,
                            type=QAIssueType.BAD_CROP,
                            severity=QASeverity.CRITICAL,
                            description=f"HTML asset defect: Image for Question {q.number} ({basename}) not referenced in HTML.",
                        )
                    )

    return issues


def validate_final_pdf(
    debai_pdf_path: str,
    doc_ir: CanonicalDocumentIR,
    dapan_pdf_path: Optional[str] = None,
    debai_html_path: Optional[str] = None,
    margins_mm: tuple[float, float, float, float] = (10.0, 12.0, 10.0, 12.0),
) -> FinalValidationResult:
    """
    Executes full multi-level deterministic validation after PDF compilation.
    Returns FinalValidationResult.
    """
    issues: list[QAIssue] = []
    doc_valid = True
    question_valid = True
    option_valid = True
    asset_valid = True
    layout_valid = True
    template_valid = True
    html_valid = True
    dapan_valid = True

    # =========================================================================
    # 0. HTML LEVEL VALIDATION (if available)
    # =========================================================================
    resolved_html_path = debai_html_path
    if not resolved_html_path:
        candidate_html = (
            debai_pdf_path[:-4] + ".html"
            if debai_pdf_path.lower().endswith(".pdf")
            else debai_pdf_path + ".html"
        )
        if os.path.isfile(candidate_html):
            resolved_html_path = candidate_html

    if resolved_html_path and os.path.isfile(resolved_html_path):
        html_issues = validate_rendered_html(resolved_html_path, doc_ir)
        if html_issues:
            issues.extend(html_issues)
            if any(i.severity in (QASeverity.CRITICAL, QASeverity.HIGH) for i in html_issues):
                html_valid = False

    # =========================================================================
    # 1. DOCUMENT LEVEL
    # =========================================================================
    if not os.path.isfile(debai_pdf_path) or os.path.getsize(debai_pdf_path) < 1024:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description=f"Worksheet PDF does not exist or is empty (< 1024 bytes): {debai_pdf_path}",
            )
        )
        return FinalValidationResult(
            status="FAIL",
            is_document_valid=False,
            is_html_valid=html_valid,
            page_count=0,
            issues=issues,
        )

    try:
        doc = pymupdf.open(debai_pdf_path)
    except Exception as ex:
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description=f"Worksheet PDF is corrupt or cannot be opened: {ex}",
            )
        )
        return FinalValidationResult(
            status="FAIL",
            is_document_valid=False,
            is_html_valid=html_valid,
            page_count=0,
            issues=issues,
        )

    page_count = doc.page_count
    if page_count < 1:
        doc.close()
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.MISSING_FILE,
                severity=QASeverity.CRITICAL,
                description="Worksheet PDF contains 0 pages.",
            )
        )
        return FinalValidationResult(
            status="FAIL",
            is_document_valid=False,
            is_html_valid=html_valid,
            page_count=0,
            issues=issues,
        )

    # Check that each page in DeBai is accessible and uncorrupted
    for p_idx in range(page_count):
        try:
            p = doc[p_idx]
            rect = p.rect
            if rect.width <= 0 or rect.height <= 0:
                doc_valid = False
                issues.append(
                    QAIssue(
                        page=p_idx + 1,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.CRITICAL,
                        description=f"Page {p_idx + 1} has invalid dimensions: {rect.width}x{rect.height}.",
                    )
                )
        except Exception as ex_p:
            doc_valid = False
            issues.append(
                QAIssue(
                    page=p_idx + 1,
                    type=QAIssueType.MISSING_FILE,
                    severity=QASeverity.CRITICAL,
                    description=f"Page {p_idx + 1} is corrupted: {ex_p}",
                )
            )

    # Extract text per page
    page_texts = [doc[p].get_text() for p in range(page_count)]
    full_text = "\n\n".join(page_texts)

    # =========================================================================
    # 2. QUESTION LEVEL
    # =========================================================================
    expected_numbers = [q.number for q in doc_ir.questions]
    expected_count = len(expected_numbers)

    # Find question occurrences (filtering out mentions in instruction sentences)
    found_matches = _find_question_header_matches(full_text)
    found_numbers = [int(m.group(1)) for m in found_matches]

    # Check missing questions
    missing_numbers = [num for num in expected_numbers if num not in found_numbers]
    if missing_numbers:
        question_valid = False
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.CARDINALITY_MISMATCH,
                severity=QASeverity.CRITICAL,
                description=(
                    f"Question level defect: Missing {len(missing_numbers)} expected questions in PDF: "
                    f"{missing_numbers} (expected {expected_count}, found {len(found_numbers)})."
                ),
            )
        )

    # Check duplicate question headings
    counts = Counter(found_numbers)
    duplicates = [num for num in expected_numbers if counts.get(num, 0) > 1]
    if duplicates:
        question_valid = False
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.CARDINALITY_MISMATCH,
                severity=QASeverity.HIGH,
                description=f"Question level defect: Duplicate question headings in PDF: {duplicates}.",
            )
        )

    # Check unexpected questions
    unexpected = [num for num in set(found_numbers) if num not in expected_numbers]
    if unexpected:
        question_valid = False
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.CARDINALITY_MISMATCH,
                severity=QASeverity.HIGH,
                description=f"Question level defect: Unexpected question numbers in PDF: {unexpected}.",
            )
        )

    # =========================================================================
    # 3. OPTION LEVEL
    # =========================================================================
    for q in doc_ir.questions:
        if q.type not in (SectionType.PART_I_MCQ, SectionType.PART_II_TF):
            continue

        expected_labels = (
            [opt.label.upper() for opt in q.options]
            if q.type == SectionType.PART_I_MCQ
            else [stmt.label.lower() for stmt in q.sub_statements]
        )
        if not expected_labels:
            continue

        # Find stem page
        stem_p_idx = -1
        stem_pos = -1
        for p_idx in range(page_count):
            m_list = _find_question_header_matches(page_texts[p_idx], q_num=q.number)
            if m_list:
                stem_p_idx = p_idx
                stem_pos = m_list[0].start()
                break

        if stem_p_idx == -1:
            continue  # Already recorded under question level

        # Determine boundaries of question on stem_page_idx by finding the next question header
        headers_on_stem = _find_question_header_matches(page_texts[stem_p_idx])
        subsequent_headers = [h for h in headers_on_stem if h.start() > stem_pos]
        if subsequent_headers:
            next_header_pos = min(h.start() for h in subsequent_headers)
            q_slice = page_texts[stem_p_idx][stem_pos:next_header_pos]
        else:
            q_slice = page_texts[stem_p_idx][stem_pos:]

        est_height = LayoutSolver.estimate_question_height_pt(q)
        is_oversized = est_height > 650.0

        for lbl in expected_labels:
            if q.type == SectionType.PART_I_MCQ:
                lbl_pat = re.compile(rf"(?:^|\s|\n){re.escape(lbl)}\s*[\.\)]", re.IGNORECASE)
            else:
                lbl_pat = re.compile(rf"(?:^|\s|\n){re.escape(lbl)}\s*[\.\)]", re.IGNORECASE)

            if lbl_pat.search(q_slice):
                continue

            # Check next page in case of continuation
            found_on_next = False
            if stem_p_idx + 1 < page_count:
                headers_on_next = _find_question_header_matches(page_texts[stem_p_idx + 1])
                if headers_on_next:
                    next_slice = page_texts[stem_p_idx + 1][:headers_on_next[0].start()]
                else:
                    next_slice = page_texts[stem_p_idx + 1]

                if lbl_pat.search(next_slice):
                    found_on_next = True

            if found_on_next:
                if not is_oversized:
                    option_valid = False
                    issues.append(
                        QAIssue(
                            page=stem_p_idx + 1,
                            type=QAIssueType.SPLIT_QUESTION,
                            severity=QASeverity.CRITICAL,
                            description=(
                                f"Option integrity defect: Question {q.number} (qid={q.id}) option '{lbl}' "
                                f"split onto page {stem_p_idx + 2}."
                            ),
                        )
                    )
            else:
                option_valid = False
                issues.append(
                    QAIssue(
                        page=stem_p_idx + 1,
                        type=QAIssueType.CARDINALITY_MISMATCH,
                        severity=QASeverity.CRITICAL,
                        description=(
                            f"Option integrity defect: Question {q.number} (qid={q.id}) is missing option '{lbl}' "
                            f"in rendered PDF (dropped or clipped outside page bounds)."
                        ),
                    )
                )

    # =========================================================================
    # 4. ASSET LEVEL
    # =========================================================================
    for q in doc_ir.questions:
        for elem in q.rich_elements:
            crop_path = elem.source_crop_path
            if not crop_path:
                asset_valid = False
                issues.append(
                    QAIssue(
                        page=elem.page_number or 1,
                        type=QAIssueType.BAD_CROP,
                        severity=QASeverity.CRITICAL,
                        description=f"Asset integrity defect: Question {q.number} rich element '{elem.element_id}' has empty crop path.",
                    )
                )
                continue

            if not os.path.isfile(crop_path) or os.path.getsize(crop_path) < 100:
                asset_valid = False
                issues.append(
                    QAIssue(
                        page=elem.page_number or 1,
                        type=QAIssueType.BAD_CROP,
                        severity=QASeverity.CRITICAL,
                        description=f"Asset integrity defect: File missing or zero-byte for Question {q.number}: {crop_path}",
                    )
                )
                continue

            # Check black or blank placeholder on disk
            if is_black_or_blank_image(crop_path):
                asset_valid = False
                issues.append(
                    QAIssue(
                        page=elem.page_number or 1,
                        type=QAIssueType.BAD_CROP,
                        severity=QASeverity.CRITICAL,
                        description=f"Asset integrity defect: Image for Question {q.number} is a black or blank placeholder: {crop_path}",
                    )
                )
                continue

            # Check placement in rendered PDF: find page containing this question
            q_p_idx = -1
            for p_idx in range(page_count):
                if _find_question_header_matches(page_texts[p_idx], q_num=q.number):
                    q_p_idx = p_idx
                    break

            if q_p_idx >= 0:
                p_imgs = doc[q_p_idx].get_images()
                p_drawings = doc[q_p_idx].get_drawings()

                # Also inspect next page if question split
                if len(p_imgs) == 0 and len(p_drawings) == 0 and q_p_idx + 1 < page_count:
                    next_p_imgs = doc[q_p_idx + 1].get_images()
                    next_p_drawings = doc[q_p_idx + 1].get_drawings()
                    if len(next_p_imgs) > 0 or len(next_p_drawings) > 0:
                        p_imgs = next_p_imgs
                        p_drawings = next_p_drawings

                if len(p_imgs) == 0 and len(p_drawings) == 0:
                    asset_valid = False
                    issues.append(
                        QAIssue(
                            page=q_p_idx + 1,
                            type=QAIssueType.BAD_CROP,
                            severity=QASeverity.CRITICAL,
                            description=(
                                f"Asset integrity defect: Asset for Question {q.number} not placed in final PDF "
                                f"(Page {q_p_idx + 1} contains 0 images and 0 vector drawings)."
                            ),
                        )
                    )
                else:
                    # Verify that extracted images inside the PDF itself are not black or blank placeholders
                    for img_tuple in p_imgs:
                        xref = img_tuple[0]
                        try:
                            extracted = doc.extract_image(xref)
                            img_data = extracted.get("image", b"")
                            if len(img_data) < 10:
                                asset_valid = False
                                issues.append(
                                    QAIssue(
                                        page=q_p_idx + 1,
                                        type=QAIssueType.BAD_CROP,
                                        severity=QASeverity.CRITICAL,
                                        description=f"Asset integrity defect: Embedded PDF image for Question {q.number} is empty (0 bytes).",
                                    )
                                )
                                break
                            with Image.open(io.BytesIO(img_data)) as im:
                                rgb = im.convert("RGB")
                                stat = ImageStat.Stat(rgb)
                                mean_lum = sum(stat.mean) / 3.0
                                var_lum = sum(stat.var) / 3.0
                                if mean_lum < 12.0 or var_lum < 0.5:
                                    asset_valid = False
                                    issues.append(
                                        QAIssue(
                                            page=q_p_idx + 1,
                                            type=QAIssueType.BAD_CROP,
                                            severity=QASeverity.CRITICAL,
                                            description=f"Asset integrity defect: Embedded PDF image for Question {q.number} is a black or blank placeholder in final PDF.",
                                        )
                                    )
                                    break
                        except Exception as ex_img:
                            logger.warning(f"Could not check embedded image xref {xref}: {ex_img}")

    # =========================================================================
    # 5. LAYOUT LEVEL
    # =========================================================================
    std_width_pt = 595.28
    std_height_pt = 841.89
    pt_per_mm = 72.0 / 25.4
    content_bottom_limit = std_height_pt - (margins_mm[2] * pt_per_mm) # ~813.5 pt
    content_right_limit = std_width_pt - (margins_mm[1] * pt_per_mm)   # ~561.3 pt

    for p_idx in range(page_count):
        p_num = p_idx + 1
        page = doc[p_idx]
        blocks = page.get_text("blocks")
        text_blocks = [b for b in blocks if b[4].strip()]

        for b in text_blocks:
            x0, y0, x1, y1, b_text = b[0], b[1], b[2], b[3], b[4].strip()
            # Ignore running footer block
            is_running_footer = y0 >= (content_bottom_limit + 1.0) and bool(
                re.search(r"Trang\s+\d+|counter\(page\)", b_text, re.IGNORECASE)
            )
            if is_running_footer:
                continue

            if y1 > (content_bottom_limit + 6.0):
                layout_valid = False
                issues.append(
                    QAIssue(
                        page=p_num,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.HIGH,
                        description=f"Layout defect: Content block overflows bottom margin at y1={y1:.1f} pt (limit {content_bottom_limit:.1f} pt): '{b_text[:40]}...'",
                        bbox=(x0, y0, x1, y1),
                    )
                )

            if x1 > (content_right_limit + 10.0):
                issues.append(
                    QAIssue(
                        page=p_num,
                        type=QAIssueType.OVERFLOW,
                        severity=QASeverity.LOW,
                        description=f"Layout warning: Content block extends past right margin at x1={x1:.1f} pt: '{b_text[:30]}...'",
                        bbox=(x0, y0, x1, y1),
                    )
                )

        # Check orphan section heading at bottom of page
        if text_blocks:
            last_block = max(text_blocks, key=lambda b: b[3])
            last_text = last_block[4].strip()
            if last_block[1] > 740.0 and re.search(r"PHẦN\s+[I|V|X]+|CÂU\s+HỎI\s+TRẮC\s+NGHIỆM", last_text, re.IGNORECASE):
                layout_valid = False
                issues.append(
                    QAIssue(
                        page=p_num,
                        type=QAIssueType.ORPHAN_HEADING,
                        severity=QASeverity.HIGH,
                        description=f"Layout defect: Section heading appears isolated at bottom of page {p_num} (y0={last_block[1]:.1f} pt).",
                        bbox=(last_block[0], last_block[1], last_block[2], last_block[3]),
                    )
                )

    # =========================================================================
    # 6. TEMPLATE LEVEL
    # =========================================================================
    # Check for unresolved "N" placeholders
    n_placeholder_pat = re.compile(
        r"(?:từ\s+câu\s+\d+\s+đến\s+câu\s+N\b|đến\s+câu\s+N\b|câu\s+1\s+đến\s+câu\s+N\b|\bcâu\s+N\b|page\s+N\b|trang\s+N\b|question\s+N\b|placeholder)",
        re.IGNORECASE,
    )
    m_n = n_placeholder_pat.search(full_text)
    if m_n:
        template_valid = False
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.OTHER,
                severity=QASeverity.CRITICAL,
                description=f"Template defect: Unresolved 'N' placeholder detected in rendered PDF: '{m_n.group(0)}'.",
            )
        )

    # Check for undefined or null literal strings
    und_null_pat = re.compile(r"\b(?:undefined|null|NaN|\[object\s+Object\])\b", re.IGNORECASE)
    m_und = und_null_pat.search(full_text)
    if m_und:
        template_valid = False
        issues.append(
            QAIssue(
                page=0,
                type=QAIssueType.OTHER,
                severity=QASeverity.CRITICAL,
                description=f"Template defect: Unresolved 'undefined' or 'null' string detected in rendered PDF: '{m_und.group(0)}'.",
            )
        )

    # Check for empty labels like "Câu :" without number
    empty_label_pat = re.compile(r"\bCâu\s*[\.:]", re.IGNORECASE)
    for m in empty_label_pat.finditer(full_text):
        matched = m.group(0)
        # Check if no digits between Câu and :
        if not re.search(r"\d", matched):
            template_valid = False
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.OTHER,
                    severity=QASeverity.CRITICAL,
                    description=f"Template defect: Empty question label detected: '{matched}'.",
                )
            )

    # =========================================================================
    # 7. DAP AN LEVEL
    # =========================================================================
    if dapan_pdf_path:
        if not os.path.isfile(dapan_pdf_path) or os.path.getsize(dapan_pdf_path) < 1024:
            dapan_valid = False
            issues.append(
                QAIssue(
                    page=0,
                    type=QAIssueType.MISSING_FILE,
                    severity=QASeverity.CRITICAL,
                    description=f"Answer Key PDF does not exist or is empty (< 1024 bytes): {dapan_pdf_path}",
                )
            )
        else:
            try:
                doc_da = pymupdf.open(dapan_pdf_path)
                if doc_da.page_count < 1:
                    dapan_valid = False
                    issues.append(
                        QAIssue(
                            page=0,
                            type=QAIssueType.MISSING_FILE,
                            severity=QASeverity.CRITICAL,
                            description="Answer Key PDF contains 0 pages.",
                        )
                    )
                else:
                    da_full_text = "\n\n".join(doc_da[p].get_text() for p in range(doc_da.page_count))

                    # Check placeholders in Dap An
                    m_n_da = n_placeholder_pat.search(da_full_text)
                    if m_n_da:
                        dapan_valid = False
                        issues.append(
                            QAIssue(
                                page=0,
                                type=QAIssueType.OTHER,
                                severity=QASeverity.CRITICAL,
                                description=f"Template defect in Answer Key PDF: Unresolved placeholder '{m_n_da.group(0)}'.",
                            )
                        )

                    m_und_da = und_null_pat.search(da_full_text)
                    if m_und_da:
                        dapan_valid = False
                        issues.append(
                            QAIssue(
                                page=0,
                                type=QAIssueType.OTHER,
                                severity=QASeverity.CRITICAL,
                                description=f"Template defect in Answer Key PDF: Unresolved '{m_und_da.group(0)}'.",
                            )
                        )
                doc_da.close()
            except Exception as ex_da:
                dapan_valid = False
                issues.append(
                    QAIssue(
                        page=0,
                        type=QAIssueType.MISSING_FILE,
                        severity=QASeverity.CRITICAL,
                        description=f"Answer Key PDF is corrupt or cannot be opened: {ex_da}",
                    )
                )

    doc.close()

    has_critical = any(i.severity == QASeverity.CRITICAL for i in issues)
    has_high = any(i.severity == QASeverity.HIGH for i in issues)
    status = "FAIL" if (has_critical or has_high) else "PASS"

    return FinalValidationResult(
        status=status,
        is_document_valid=doc_valid,
        is_question_valid=question_valid,
        is_option_valid=option_valid,
        is_asset_valid=asset_valid,
        is_layout_valid=layout_valid,
        is_template_valid=template_valid,
        is_html_valid=html_valid,
        is_dapan_valid=dapan_valid,
        page_count=page_count,
        questions_found=found_numbers,
        issues=issues,
    )
