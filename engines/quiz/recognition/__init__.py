"""
Smart Recognition Package
Fast path parsing and dynamic page range resolution for examination documents.
"""

from .models import (
    SmartRecognitionResult,
    ParsedNumericConstraint,
    QuestionSegment,
    QuestionIndexEntry,
    PageIndex,
    PageNeighborhood,
    ExtractionPlan,
)
from .rule_parser import parse_numeric_instruction
from .range_resolver import resolve_smart_range
from .question_index import QuestionIndexService

__all__ = [
    "SmartRecognitionResult",
    "ParsedNumericConstraint",
    "QuestionSegment",
    "QuestionIndexEntry",
    "PageIndex",
    "PageNeighborhood",
    "ExtractionPlan",
    "QuestionIndexService",
    "parse_numeric_instruction",
    "resolve_smart_range",
]

