"""
Smart Recognition Package
Fast path parsing and dynamic page range resolution for examination documents.
"""

from .models import SmartRecognitionResult, ParsedNumericConstraint
from .rule_parser import parse_numeric_instruction
from .range_resolver import resolve_smart_range

__all__ = [
    "SmartRecognitionResult",
    "ParsedNumericConstraint",
    "parse_numeric_instruction",
    "resolve_smart_range"
]
