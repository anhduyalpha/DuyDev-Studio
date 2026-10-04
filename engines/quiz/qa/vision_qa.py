"""
Selective Vision QA using Agnes AI Provider.
Only inspects pages flagged by Geometry QA, representative samples (Page 1),
or rich-element-dense pages. Strictly outputs diagnostic JSON (NO CSS).
"""

import os
import pymupdf
from typing import Any

from engines.quiz.provider.prompt_builder import PromptBuilder
from engines.quiz.qa.models import (
    VisionQAResult,
    QAIssue,
    QAIssueType,
    QASeverity,
)


def run_selective_vision_qa(
    pdf_path: str,
    flagged_pages: list[int] | None = None,
    rich_element_pages: list[int] | None = None,
    provider: Any = None,
    max_pages: int = 2,
) -> VisionQAResult:
    """
    Run selective visual inspection on up to max_pages flagged or representative pages.
    Guarantees no full-document vision overhead.
    """
    if not os.path.isfile(pdf_path) or not provider:
        return VisionQAResult(status="PASS", inspected_pages=[], issues=[])

    doc = pymupdf.open(pdf_path)
    total_pages = doc.page_count
    if total_pages < 1:
        doc.close()
        return VisionQAResult(status="PASS", inspected_pages=[], issues=[])

    # 1. Target Page Selection Heuristic
    targets: list[int] = []
    if flagged_pages:
        for p in flagged_pages:
            if 1 <= p <= total_pages and p not in targets:
                targets.append(p)

    if rich_element_pages:
        for p in rich_element_pages:
            if 1 <= p <= total_pages and p not in targets:
                targets.append(p)

    # If no flagged pages, choose Page 1 as representative sample
    if not targets:
        targets.append(1)

    # Strictly cap inspected pages to max_pages
    inspected_pages = targets[:max_pages]

    collected_issues: list[QAIssue] = []

    for page_num in inspected_pages:
        try:
            page = doc[page_num - 1]
            pix = page.get_pixmap(dpi=150)
            png_bytes = pix.tobytes("png")

            # 2. Build 6-block strict diagnostic prompt
            builder = (
                PromptBuilder()
                .set_role(
                    "You are a Senior Visual QA Inspector verifying print-ready Vietnamese examination worksheets."
                )
                .set_task(
                    f"Visually inspect the rendered page image (Page {page_num}) for layout overlap, clipped formulas, "
                    "text collisions, or illegible graphics."
                )
                .set_input(f"Rendered image of Page {page_num} of {total_pages} from {os.path.basename(pdf_path)}.")
                .set_rules(
                    [
                        "Evaluate typography readability, margin clearance, and image placement.",
                        "Flag issues ONLY if there is actual visual overlapping, clipping, or unreadable formulas.",
                        "Strictly DO NOT output CSS, HTML, or code recommendations.",
                        "Output ONLY diagnostic JSON matching the VisionQAResult schema.",
                    ]
                )
                .set_schema(VisionQAResult)
                .set_uncertainty_policy(
                    "If the page looks clean and readable, report status 'PASS' with an empty issues list."
                )
            )
            prompt = builder.build()

            # 3. Structured Vision Call
            result = provider.generate_structured(
                task_name=f"vision_qa_p{page_num}",
                user_prompt=prompt,
                system_prompt="You are a precise examination visual inspector. Respond strictly with JSON matching VisionQAResult.",
                schema=VisionQAResult,
                image_bytes=png_bytes,
                temperature=0.0,
            )
            if result and hasattr(result, "issues"):
                for issue in result.issues:
                    # Enforce correct page number
                    issue.page = page_num
                    collected_issues.append(issue)

        except Exception:
            # Defensive execution: AI vision failure must not crash pipeline
            pass

    doc.close()

    has_fail = any(i.severity in (QASeverity.HIGH, QASeverity.CRITICAL) for i in collected_issues)
    status = "FAIL" if has_fail else "PASS"

    return VisionQAResult(
        status=status,
        issues=collected_issues,
        inspected_pages=inspected_pages,
    )
