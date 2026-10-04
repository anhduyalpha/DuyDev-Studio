"""
Pydantic v2 Models for Document Quality Assurance (QA) and Diagnostics.
Supports Geometry QA, Semantic QA, Selective Vision QA, and Safe Repair instructions.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class QAIssueType(str, Enum):
    OVERFLOW = "overflow"                 # Content extends into margins or footer zone
    OVERLAP = "overlap"                   # Elements colliding or overlapping
    BAD_SPACING = "bad_spacing"           # Excessive blank space or dense text collision
    BROKEN_FORMULA = "broken_formula"     # Unrendered KaTeX markup or raw delimiters
    BAD_CROP = "bad_crop"                 # Blurry, clipped, or corrupted image crop
    SPLIT_QUESTION = "split_question"     # Question broken across page boundary
    ORPHAN_HEADING = "orphan_heading"     # Section heading at page bottom without questions
    CARDINALITY_MISMATCH = "cardinality_mismatch" # Invalid option or statement count
    ANSWER_MISMATCH = "answer_mismatch"   # Question missing from answer key or 1:1 error
    MISSING_FILE = "missing_file"         # Target PDF missing or empty (< 1024 bytes)
    OTHER = "other"


class QASeverity(str, Enum):
    LOW = "low"         # Minor visual imperfection
    MEDIUM = "medium"   # Noticeable spacing/margin deviation
    HIGH = "high"       # Serious layout defect, split question, or overlapping content
    CRITICAL = "critical" # Compilation failure or missing answers


class QAIssue(BaseModel):
    """Specific defect identified during document QA."""
    page: int = 1                         # 1-based human page number (0 if document-wide)
    type: QAIssueType
    severity: QASeverity
    description: str
    bbox: Optional[tuple[float, float, float, float]] = None


class GeometryQAResult(BaseModel):
    """Results from fast code-based geometric analysis."""
    status: str = "PASS"                  # "PASS" | "WARN" | "FAIL"
    issues: list[QAIssue] = Field(default_factory=list)
    page_count: int = 1
    is_a4_compliant: bool = True

    def is_pass(self) -> bool:
        return self.status in ("PASS", "WARN") and not any(
            issue.severity == QASeverity.CRITICAL for issue in self.issues
        )


class SemanticQAResult(BaseModel):
    """Results from code-based structural and semantic verification."""
    status: str = "PASS"                  # "PASS" | "FAIL"
    issues: list[QAIssue] = Field(default_factory=list)
    total_questions: int = 0
    matched_answers: int = 0
    is_sequence_valid: bool = True

    def is_pass(self) -> bool:
        return self.status == "PASS" and not self.issues


class VisionQAResult(BaseModel):
    """Results from selective visual inspection by Agnes AI."""
    status: str = "PASS"                  # "PASS" | "FAIL"
    issues: list[QAIssue] = Field(default_factory=list)
    inspected_pages: list[int] = Field(default_factory=list)

    def is_pass(self) -> bool:
        return self.status == "PASS" and not any(
            issue.severity in (QASeverity.HIGH, QASeverity.CRITICAL) for issue in self.issues
        )


class OverallQAResult(BaseModel):
    """Aggregated multi-stage QA evaluation."""
    status: str = "PASS"                  # "PASS" | "WARN" | "FAIL"
    geometry: GeometryQAResult
    semantic: SemanticQAResult
    vision: Optional[VisionQAResult] = None
    requires_repair: bool = False
    repair_suggestions: list[str] = Field(default_factory=list)

    def is_pass(self) -> bool:
        return self.status in ("PASS", "WARN")
