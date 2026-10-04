"""
Page Classifier Module
Deterministic classification of PDF pages into VECTOR, MIXED, SCANNED, or UNKNOWN.
"""

from .models import PageKind


def classify_page(
    character_count: int,
    image_area_ratio: float,
    has_images: bool,
    drawing_count: int
) -> PageKind:
    """
    Classify a PDF page based on text density and image coverage.
    Follows Rule 21: SCANNED pages are labeled for vision/OCR fallback, never rejected.
    """
    # 1. Scanned Detection: low text character density with heavy raster image coverage
    if character_count < 60 and image_area_ratio > 0.55:
        return PageKind.SCANNED

    # 2. Vector Detection: rich digital text with negligible image coverage
    if character_count >= 100 and image_area_ratio < 0.15 and not has_images:
        return PageKind.VECTOR

    # 3. Mixed Detection: digital text coexists with diagrams, figures, or vector drawings
    if character_count >= 60 and (has_images or drawing_count > 0 or image_area_ratio >= 0.15):
        return PageKind.MIXED

    # 4. Fallback: low text and low image (e.g. cover page, blank page)
    if character_count < 30 and image_area_ratio < 0.1 and drawing_count == 0:
        return PageKind.UNKNOWN

    return PageKind.MIXED if (has_images or drawing_count > 0) else PageKind.VECTOR
