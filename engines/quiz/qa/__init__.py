"""
Quiz QA Package.
Exposes Geometry QA, Semantic QA, Selective Vision QA, Safe Repair Engine, and QA Data Models.
"""

from engines.quiz.qa.models import (
    QAIssueType,
    QASeverity,
    QAIssue,
    GeometryQAResult,
    SemanticQAResult,
    VisionQAResult,
    OverallQAResult,
)
from engines.quiz.qa.geometry_qa import validate_pdf_geometry
from engines.quiz.qa.semantic_qa import validate_semantic_integrity
from engines.quiz.qa.vision_qa import run_selective_vision_qa
from engines.quiz.qa.repair import SafeRepairEngine

__all__ = [
    "QAIssueType",
    "QASeverity",
    "QAIssue",
    "GeometryQAResult",
    "SemanticQAResult",
    "VisionQAResult",
    "OverallQAResult",
    "validate_pdf_geometry",
    "validate_semantic_integrity",
    "run_selective_vision_qa",
    "SafeRepairEngine",
]
