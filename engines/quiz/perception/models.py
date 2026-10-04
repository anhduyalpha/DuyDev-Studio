"""
PDF Perception Models (Pydantic v2)
Defines structured geometry, metadata, and candidate representation for PDF pages.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PageKind(str, Enum):
    VECTOR = "vector"       # Clear text layer / digital vector fonts
    MIXED = "mixed"         # Text layer combined with raster images or vector diagrams
    SCANNED = "scanned"     # Pure scanned document / image with minimal or no text layer
    UNKNOWN = "unknown"     # Unclassified or empty page


class TextSpan(BaseModel):
    text: str
    bbox: tuple[float, float, float, float]  # (x0, y0, x1, y1)
    font: str = ""
    size: float = 0.0
    flags: int = 0
    color: int = 0


class TextLine(BaseModel):
    bbox: tuple[float, float, float, float]
    spans: list[TextSpan] = Field(default_factory=list)
    text: str = ""


class TextBlock(BaseModel):
    block_index: int
    bbox: tuple[float, float, float, float]
    lines: list[TextLine] = Field(default_factory=list)
    text: str = ""


class ExtractedImage(BaseModel):
    image_id: str
    xref: int
    bbox: tuple[float, float, float, float]
    width: int
    height: int
    format: str = "png"
    storage_path: str = ""
    is_mask: bool = False


class QuestionCandidate(BaseModel):
    candidate_number: int
    marker_text: str                          # e.g. "Câu 1:", "Bài 1."
    bbox: tuple[float, float, float, float]
    y_pos: float                              # y0 coordinate for vertical reading order
    options_detected: list[str] = Field(default_factory=list) # e.g. ["A", "B", "C", "D"]


class PageRepresentation(BaseModel):
    page_index: int                           # 0-based index
    page_number: int                          # 1-based human-readable page number
    width: float
    height: float
    raw_text: str = ""
    blocks: list[TextBlock] = Field(default_factory=list)
    images: list[ExtractedImage] = Field(default_factory=list)
    drawing_count: int = 0
    character_count: int = 0
    image_area_ratio: float = 0.0             # Total image area / page area
    page_kind: PageKind = PageKind.UNKNOWN
    candidates: list[QuestionCandidate] = Field(default_factory=list)
    rendered_image_path: Optional[str] = None # On-demand render path
