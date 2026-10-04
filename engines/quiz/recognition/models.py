"""
Smart Recognition Data Models (Pydantic v2)
Models for natural language prompt parsing, range constraints, and resolved page bounds.
"""

from typing import Optional
from pydantic import BaseModel, Field


class ParsedNumericConstraint(BaseModel):
    """Intermediate parsed numeric constraints extracted via deterministic regex."""
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    start_question: Optional[int] = None
    end_question: Optional[int] = None
    question_count: Optional[int] = None
    exam_code: Optional[str] = None


class SmartRecognitionResult(BaseModel):
    """
    Standard output payload for the Smart Recognition & Range Resolver box.
    Directly binds to the frontend UI fields (start page, end page, count, start question).
    """
    start_page: int
    end_page: int
    start_question: int = 1
    question_count: int
    question_mode: str = "auto"       # "auto" | "explicit" | "ai_resolved"
    confidence: float = 1.0           # 1.0 for Fast Path code, 0.85-0.95 for AI fallback
    warnings: list[str] = Field(default_factory=list)
