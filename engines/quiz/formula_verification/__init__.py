"""
Formula Verification Package.
Provides independent mathematical, chemical, and physics formula integrity verification
and targeted safe repairs for the Quiz Processing Pipeline.
"""

from .models import (
    FormulaType,
    FormulaVerificationStatus,
    FormulaIssueType,
    FormulaCanonicalIR,
    FormulaVerificationIssue,
    FormulaGateResult,
    PostRenderVerificationResult,
)
from .semantic_canonical import (
    SemanticFormulaComparator,
    parse_chemical_composition,
    canonicalize_math_expression,
    canonicalize_chemical_reaction,
)
from .detector import FormulaDetector
from .repair import TargetedFormulaRepairEngine
from .gate import FormulaVerificationGate

__all__ = [
    "FormulaType",
    "FormulaVerificationStatus",
    "FormulaIssueType",
    "FormulaCanonicalIR",
    "FormulaVerificationIssue",
    "FormulaGateResult",
    "PostRenderVerificationResult",
    "SemanticFormulaComparator",
    "parse_chemical_composition",
    "canonicalize_math_expression",
    "canonicalize_chemical_reaction",
    "FormulaDetector",
    "TargetedFormulaRepairEngine",
    "FormulaVerificationGate",
]
