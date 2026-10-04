"""
Safe Repair Engine.
Translates QA diagnostic feedback into discrete, deterministic styling and layout adjustments.
Strictly code-driven: NEVER allows AI to generate freeform CSS or modify question semantics.
"""

from engines.quiz.ir.models import CanonicalDocumentIR
from engines.quiz.rendering.styles import StylePreset
from engines.quiz.qa.models import (
    OverallQAResult,
    QAIssueType,
    QASeverity,
)


class SafeRepairEngine:
    """Evaluates QA results and applies safe, monotonic parameter adjustments."""

    @classmethod
    def evaluate_and_repair(
        cls,
        doc_ir: CanonicalDocumentIR,
        style_preset: StylePreset,
        qa_result: OverallQAResult,
        current_iteration: int,
        max_iterations: int = 2,
    ) -> tuple[CanonicalDocumentIR, StylePreset, bool]:
        """
        Evaluate QA defects and apply safe configuration modifications.
        Returns: (updated_doc_ir, updated_style_preset, was_repaired: bool)
        """
        if current_iteration >= max_iterations:
            return doc_ir, style_preset, False

        # Gather all issues
        all_issues = list(qa_result.geometry.issues) + list(qa_result.semantic.issues)
        if qa_result.vision:
            all_issues.extend(qa_result.vision.issues)

        # Filter actionable issues
        actionable_issues = [
            i for i in all_issues if i.severity in (QASeverity.MEDIUM, QASeverity.HIGH, QASeverity.CRITICAL)
        ]
        if not actionable_issues:
            return doc_ir, style_preset, False

        issue_types = {i.type for i in actionable_issues}

        # Clone style preset
        modified_preset = style_preset.model_copy()
        repaired = False

        # Action 1: Handle OVERFLOW defects (Reduce margins, font size, and line height)
        if QAIssueType.OVERFLOW in issue_types or QAIssueType.BAD_SPACING in issue_types:
            # Monotonically tighten margins
            modified_preset.margin_top_mm = max(7.0, modified_preset.margin_top_mm - 1.5)
            modified_preset.margin_bottom_mm = max(7.0, modified_preset.margin_bottom_mm - 1.5)
            modified_preset.margin_left_mm = max(8.0, modified_preset.margin_left_mm - 1.5)
            modified_preset.margin_right_mm = max(8.0, modified_preset.margin_right_mm - 1.5)

            # Compact typography slightly
            modified_preset.font_size_pt = max(9.0, modified_preset.font_size_pt - 0.4)
            modified_preset.line_height = max(1.32, modified_preset.line_height - 0.06)
            repaired = True

        # Action 2: Handle SPLIT_QUESTION or ORPHAN_HEADING (Tighten layout spacing)
        if QAIssueType.SPLIT_QUESTION in issue_types or QAIssueType.ORPHAN_HEADING in issue_types:
            # Compact line height and margins
            modified_preset.line_height = max(1.30, modified_preset.line_height - 0.05)
            modified_preset.margin_top_mm = max(7.0, modified_preset.margin_top_mm - 1.0)
            modified_preset.margin_bottom_mm = max(7.0, modified_preset.margin_bottom_mm - 1.0)

            # Suppress student info box if needed on multiple iterations to save vertical space
            if current_iteration >= 1:
                modified_preset.show_student_info = False
            repaired = True

        # Action 3: Handle BAD_CROP (Preserve diagram boundary)
        if QAIssueType.BAD_CROP in issue_types:
            # Layout hints could be refreshed or capped
            repaired = True

        return doc_ir, modified_preset, repaired
