"""
PDF Perception Layer Package
Pure code fast-path for geometry, layout, bounding boxes, images, classification, and candidate heuristics.
"""

from .models import (
    PageKind,
    TextSpan,
    TextLine,
    TextBlock,
    ExtractedImage,
    QuestionCandidate,
    PageRepresentation
)
from .classifier import classify_page
from .candidates import (
    detect_candidates_from_page,
    get_page_question_bounds,
    detect_continuation_candidate,
    get_next_page_index
)
from .extractor import (
    extract_page_representation,
    extract_document_representations
)
from .renderer import (
    render_page_to_image,
    render_page_to_bytes
)

__all__ = [
    "PageKind",
    "TextSpan",
    "TextLine",
    "TextBlock",
    "ExtractedImage",
    "QuestionCandidate",
    "PageRepresentation",
    "classify_page",
    "detect_candidates_from_page",
    "get_page_question_bounds",
    "detect_continuation_candidate",
    "get_next_page_index",
    "extract_page_representation",
    "extract_document_representations",
    "render_page_to_image",
    "render_page_to_bytes"
]
