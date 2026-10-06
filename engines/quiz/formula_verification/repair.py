"""
Targeted Safe Formula Repair Engine (Section 10).
Repairs only the failing rich formula element in QuestionIR without regenerating
the entire question or reprocessing the entire PDF document.
Follows: formula FAIL -> targeted recovery -> normalize formula -> verify again.
"""

import re
from typing import Optional
from engines.quiz.ir.models import QuestionIR
from engines.quiz.ir.normalizer import normalize_text
from .models import (
    FormulaCanonicalIR,
    FormulaVerificationStatus,
    FormulaVerificationIssue
)
from .semantic_canonical import SemanticFormulaComparator


class TargetedFormulaRepairEngine:
    """Performs bounded targeted repairs on failing formulas in QuestionIR."""

    @classmethod
    def repair_formula_in_question(
        cls,
        question: QuestionIR,
        formula: FormulaCanonicalIR,
        correct_formula: str
    ) -> tuple[bool, QuestionIR, FormulaCanonicalIR, list[FormulaVerificationIssue]]:
        """
        Replaces the flawed formula with the verified correct formula in the question field.
        Re-normalizes and re-verifies against the ground-truth correct formula.
        Returns (is_repaired, updated_question, updated_formula, remaining_issues).
        """
        target_token = formula.render_representation or formula.source_text
        repaired_str = correct_formula.strip()

        # Update field in question
        field = formula.field

        if field == "stem":
            if target_token in question.stem:
                new_stem = question.stem.replace(target_token, repaired_str)
            else:
                new_stem = re.sub(rf"\b{re.escape(target_token)}\b", repaired_str, question.stem)
            question.stem = normalize_text(new_stem)

        elif field.startswith("option_"):
            label = field.replace("option_", "").upper()
            for opt in question.options:
                if opt.label == label:
                    if target_token in opt.text:
                        new_opt = opt.text.replace(target_token, repaired_str)
                    else:
                        new_opt = re.sub(rf"\b{re.escape(target_token)}\b", repaired_str, opt.text)
                    opt.text = normalize_text(new_opt)

        elif field.startswith("sub_statement_"):
            label = field.replace("sub_statement_", "").lower()
            for sub in question.sub_statements:
                if sub.label == label:
                    if target_token in sub.statement:
                        new_sub = sub.statement.replace(target_token, repaired_str)
                    else:
                        new_sub = re.sub(rf"\b{re.escape(target_token)}\b", repaired_str, sub.statement)
                    sub.statement = normalize_text(new_sub)

        # Update formula record
        formula.repaired_text = repaired_str
        formula.render_representation = repaired_str

        # Re-verify candidate against original correct_formula ground truth
        remaining_issues = SemanticFormulaComparator.compare(
            source=repaired_str,
            candidate=formula.render_representation,
            formula_type=formula.type,
            formula_id=formula.formula_id,
            question_id=formula.question_id,
            field=formula.field
        )

        if not remaining_issues:
            formula.verification_status = FormulaVerificationStatus.REPAIRED
            formula.diagnostic_message = f"Đã tự động sửa thành công theo tài liệu gốc: '{target_token}' -> '{repaired_str}'"
            return True, question, formula, []

        return False, question, formula, remaining_issues
