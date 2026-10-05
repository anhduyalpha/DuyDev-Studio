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


class QuestionSegment(BaseModel):
    """Spatial and textual bounding segment of a question on a specific physical page."""
    physical_page: int
    bbox: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0) # (x0, y0, x1, y1)
    text_start: Optional[int] = None
    text_end: Optional[int] = None
    role: str = "body" # "marker" | "body" | "options" | "continuation"

    @property
    def physicalPage(self) -> int:
        return self.physical_page


class QuestionIndexEntry(BaseModel):
    """
    Question Index Item recording provenance, cross-page segments, and confidence.
    Enforces multi-page questions across document neighborhoods.
    """
    question_number: int
    segments: list[QuestionSegment] = Field(default_factory=list)
    first_page: int
    last_page: int
    detection_method: str = "pdf-text" # "pdf-text" | "layout-analysis" | "vision" | "hybrid"
    confidence: float = 1.0
    options_detected: list[str] = Field(default_factory=list)
    has_complete_options: bool = False
    stem_preview: str = ""

    @property
    def questionNumber(self) -> int:
        return self.question_number

    @property
    def firstPage(self) -> int:
        return self.first_page

    @property
    def lastPage(self) -> int:
        return self.last_page

    @property
    def detectionMethod(self) -> str:
        return self.detection_method


class PageIndex(BaseModel):
    """Full-page question inventory for a single physical page."""
    physical_page: int
    printed_page: Optional[int] = None
    questions: list[QuestionIndexEntry] = Field(default_factory=list)
    confidence: float = 1.0
    status: str = "complete" # "complete" | "partial" | "ambiguous" | "failed"
    columns_detected: int = 1
    is_scanned: bool = False

    @property
    def physicalPage(self) -> int:
        return self.physical_page

    @property
    def printedPage(self) -> Optional[int]:
        return self.printed_page


class PageNeighborhood(BaseModel):
    """Neighborhood scanning context around target physical page(s)."""
    target_page: int
    previous_page: Optional[int] = None
    next_page: Optional[int] = None
    page_roles: dict[int, str] = Field(default_factory=dict) # page -> "target" | "continuation" | "context"
    question_index: list[QuestionIndexEntry] = Field(default_factory=list)
    status: str = "complete" # "complete" | "partial" | "ambiguous" | "failed"
    confidence: float = 1.0


class ExtractionPlan(BaseModel):
    """
    Validated extraction plan produced by PLAN-05 to feed PLAN-04.
    Guarantees target questions are verified and isolates context pages.
    """
    requested_start_question: int
    requested_end_question: int
    requested_count: int
    target_pages: list[int] = Field(default_factory=list)
    continuation_pages: list[int] = Field(default_factory=list)
    context_pages: list[int] = Field(default_factory=list)
    target_question_numbers: list[int] = Field(default_factory=list)
    validated: bool = True
    status: str = "RANGE_VALID" # "RANGE_VALID" | "RANGE_MISMATCH" | "RECOVERED"
    warning_messages: list[str] = Field(default_factory=list)

