"""
Automatic Question and Option Repair Module (Ticket #09).
Recovers and repairs empty options (A, B, C, D) and true/false sub-statements by:
1. Scanning unassigned visual elements / crops in the question.
2. Checking table or diagram data in question.
3. Supplying a safe descriptive placeholder ("[Xem hình vẽ/đồ thị đính kèm trong đề]")
   and logging a warning rather than crashing the pipeline.
"""

import logging
from typing import Optional
from engines.quiz.ir.models import QuestionIR, OptionIR, TFStatementIR

logger = logging.getLogger("engines.quiz.ir.repair")


def repair_empty_option(q: QuestionIR, opt: OptionIR) -> None:
    """
    Auto-repairs an empty option within a QuestionIR to prevent IRValidationError.
    """
    if opt.text and opt.text.strip():
        return

    # Step 1: Check if an image/visual asset is already linked to this option
    if opt.image_path and opt.image_path.strip():
        return

    # Step 2: Check unassigned rich elements in this question
    assigned_images = {o.image_path for o in q.options if getattr(o, "image_path", None)}
    unassigned_crops = [
        elem for elem in q.rich_elements
        if elem.source_crop_path and elem.source_crop_path not in assigned_images
    ]

    matched_crop = None
    for crop in unassigned_crops:
        caption = (crop.caption or "").upper()
        if opt.label.upper() in caption or f"HÌNH {opt.label.upper()}" in caption:
            matched_crop = crop
            break

    if not matched_crop and unassigned_crops:
        matched_crop = unassigned_crops[0]

    if matched_crop:
        opt.image_path = matched_crop.source_crop_path
        opt.text = f"[Hình {opt.label}]"
        logger.warning(
            f"Auto-repaired Question {q.id} (Câu {q.number}) Option {opt.label}: "
            f"attached visual asset '{matched_crop.source_crop_path}'"
        )
        q.warnings.append(f"Auto-repaired empty option {opt.label} with visual asset")
        return

    # Step 3: Check if question has any rich element (diagram/figure in question stem)
    if q.rich_elements:
        opt.text = "[Xem hình vẽ/đồ thị đính kèm trong đề]"
        logger.warning(
            f"Auto-repaired Question {q.id} (Câu {q.number}) Option {opt.label}: "
            f"assigned visual placeholder text based on question diagram"
        )
        q.warnings.append(f"Auto-repaired empty option {opt.label} with diagram placeholder text")
        return

    # Step 4: Default safe placeholder
    opt.text = "[Xem hình vẽ/đồ thị đính kèm trong đề]"
    logger.warning(
        f"Auto-repaired Question {q.id} (Câu {q.number}) Option {opt.label}: "
        f"assigned default safe placeholder text"
    )
    q.warnings.append(f"Auto-repaired empty option {opt.label} with default placeholder text")


def repair_empty_tf_statement(q: QuestionIR, stmt: TFStatementIR) -> None:
    """
    Auto-repairs an empty true/false statement within a QuestionIR.
    """
    if stmt.statement and stmt.statement.strip():
        return

    stmt.statement = "[Xem nội dung đính kèm trong đề]"
    logger.warning(
        f"Auto-repaired Question {q.id} (Câu {q.number}) Sub-statement {stmt.label}: "
        f"assigned default placeholder text"
    )
    q.warnings.append(f"Auto-repaired empty sub-statement {stmt.label}")
