"""
Formula Verification Data Models.
Defines strongly-typed canonical representations, verification issues,
status enums, and gate evaluation schemas for rich formula components.
"""

from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


class FormulaType(str, Enum):
    """Classification of formulas and equations."""
    CHEMISTRY = "chemical_formula"
    MATHEMATICS = "math"
    PHYSICS = "physics_equation"
    GENERAL = "general_formula"


class FormulaVerificationStatus(str, Enum):
    """Lifecycle status of formula verification."""
    PENDING = "PENDING"
    PASS = "PASS"
    FAIL = "FAIL"
    CONFLICT = "FORMULA_SOURCE_CONFLICT"
    REPAIRED = "REPAIRED"
    SKIPPED = "SKIPPED"


class FormulaIssueType(str, Enum):
    """Taxonomy of detected formula discrepancies."""
    CHARACTER_MISMATCH = "character_mismatch"
    TOKEN_MISMATCH = "token_mismatch"
    SUBSCRIPT_LOST = "subscript_lost"
    SUPERSCRIPT_LOST = "superscript_lost"
    SYMBOL_MISMATCH = "symbol_mismatch"
    OPERATOR_MISMATCH = "operator_mismatch"
    NUMERIC_MISMATCH = "numeric_mismatch"
    BRACKET_MISMATCH = "bracket_mismatch"
    UNIT_LOST = "unit_lost"
    EQUATION_STRUCTURE_MISMATCH = "equation_structure_mismatch"
    ELEMENT_COUNT_MISMATCH = "element_count_mismatch"
    FORMULA_SOURCE_CONFLICT = "formula_source_conflict"
    UNRENDERED_MARKUP = "unrendered_markup"


class FormulaCanonicalIR(BaseModel):
    """
    Canonical semantic representation for a detected formula or equation.
    Strictly preserves formula ownership linked 1:1 to its parent QuestionIR.
    """
    formula_id: str
    question_id: str
    field: str = "stem"  # "stem", "option_A", "option_B", "sub_statement_a", etc.
    type: FormulaType = FormulaType.CHEMISTRY
    source_text: str
    canonical: str
    render_representation: str
    tokens: list[str] = Field(default_factory=list)
    source_page: int = 1
    source_bbox: Optional[tuple[float, float, float, float]] = None
    source_object_id: Optional[str] = None
    confidence: float = 1.0
    verification_status: FormulaVerificationStatus = FormulaVerificationStatus.PENDING
    diagnostic_message: Optional[str] = None
    repaired_text: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class FormulaVerificationIssue(BaseModel):
    """Detailed record of a failed formula check."""
    formula_id: str
    question_id: str
    field: str
    issue_type: FormulaIssueType
    expected: str
    actual: str
    severity: str = "high"  # "critical" | "high" | "medium" | "low"
    description: str
    source_crop_path: Optional[str] = None


class PostRenderVerificationResult(BaseModel):
    """Spot-check results of rendered PDF artifact."""
    status: str = "PASS"  # "PASS" | "WARN" | "FAIL"
    inspected_pages: list[int] = Field(default_factory=list)
    verified_formulas_count: int = 0
    issues: list[FormulaVerificationIssue] = Field(default_factory=list)

    def is_pass(self) -> bool:
        return self.status in ("PASS", "WARN") and not any(
            i.severity == "critical" for i in self.issues
        )


class FormulaGateResult(BaseModel):
    """Overall outcome of the Formula Verification Gate."""
    status: str = "PASS"  # "PASS" | "FAIL" | "REPAIRED"
    verified_count: int = 0
    passed_count: int = 0
    failed_count: int = 0
    repaired_count: int = 0
    conflict_count: int = 0
    issues: list[FormulaVerificationIssue] = Field(default_factory=list)
    formulas: list[FormulaCanonicalIR] = Field(default_factory=list)
    post_render_result: Optional[PostRenderVerificationResult] = None

    def is_pass(self) -> bool:
        return self.status in ("PASS", "REPAIRED") and not any(
            i.severity == "critical" for i in self.issues
        )

    def summary(self) -> str:
        return (
            f"Formula Gate Status: {self.status} (Verified: {self.verified_count}, "
            f"Passed: {self.passed_count}, Repaired: {self.repaired_count}, "
            f"Failed: {self.failed_count}, Conflicts: {self.conflict_count})"
        )

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump()
