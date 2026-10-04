"""
Rich Element Manager & High-Resolution Source Cropper
Extracts and crops diagrams, figures, and tables directly from the original PDF pages at 250 DPI.
Implements the "Source Crop First" mandate, preserving geometric provenance over AI hallucinations.
"""

import os
from typing import Optional

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from engines.quiz.perception.models import ExtractedImage
from .models import RichElementIR, RichElementType


def crop_pdf_region(
    doc: fitz.Document,
    page_number: int,
    bbox: tuple[float, float, float, float],
    output_dir: str,
    dpi: int = 250,
    padding: float = 4.0,
    filename_prefix: str = "crop"
) -> str:
    """
    Crops a rectangular bounding box from the given PDF page at 250 DPI.
    Saves to output_dir and returns the absolute path to the PNG image.
    Clamps coordinates safely to prevent out-of-bounds rendering crashes.
    """
    page_idx = page_number - 1
    if page_idx < 0 or page_idx >= len(doc):
        raise IndexError(f"Page number {page_number} is out of document range (1..{len(doc)})")

    page = doc[page_idx]
    page_w = page.rect.width
    page_h = page.rect.height

    # Apply padding and clamp safely to page limits
    x0 = max(0.0, bbox[0] - padding)
    y0 = max(0.0, bbox[1] - padding)
    x1 = min(page_w, bbox[2] + padding)
    y1 = min(page_h, bbox[3] + padding)

    # Verify rectangle is non-degenerate
    if x1 <= x0 or y1 <= y0:
        # Fallback to a minimal 50x50 crop around (x0, y0)
        x1 = min(page_w, x0 + 50.0)
        y1 = min(page_h, y0 + 50.0)

    clip_rect = fitz.Rect(x0, y0, x1, y1)
    os.makedirs(output_dir, exist_ok=True)

    pix = page.get_pixmap(clip=clip_rect, dpi=dpi)
    crop_filename = f"{filename_prefix}_p{page_number}_{int(x0)}_{int(y0)}.png"
    crop_path = os.path.join(output_dir, crop_filename)
    pix.save(crop_path)

    return os.path.abspath(crop_path)


def find_matching_images_for_question(
    question_bbox: tuple[float, float, float, float],
    page_images: list[ExtractedImage],
    vertical_distance_threshold: float = 120.0
) -> list[ExtractedImage]:
    """
    Identifies raster images located within or immediately adjacent to a question's bounding box.
    """
    matched: list[ExtractedImage] = []
    q_x0, q_y0, q_x1, q_y1 = question_bbox

    for img in page_images:
        i_x0, i_y0, i_x1, i_y1 = img.bbox

        # 1. Geometrically inside the question vertical range
        if q_y0 <= i_y0 <= q_y1 or q_y0 <= i_y1 <= q_y1:
            matched.append(img)
            continue

        # 2. Immediately below the question stem within threshold
        if 0 <= (i_y0 - q_y1) <= vertical_distance_threshold:
            # Check horizontal overlap
            if not (i_x1 < q_x0 or i_x0 > q_x1):
                matched.append(img)

    return matched


def extract_rich_elements_for_question(
    doc: fitz.Document,
    question_id: str,
    page_number: int,
    bboxes: list[tuple[float, float, float, float]],
    output_dir: str,
    dpi: int = 250
) -> list[RichElementIR]:
    """
    Extracts high-resolution crops for all visual bounding boxes associated with a question.
    """
    elements: list[RichElementIR] = []

    for idx, box in enumerate(bboxes):
        crop_path = crop_pdf_region(
            doc=doc,
            page_number=page_number,
            bbox=box,
            output_dir=output_dir,
            dpi=dpi,
            filename_prefix=f"crop_{question_id}_{idx}"
        )

        elements.append(
            RichElementIR(
                element_id=f"elem_{question_id}_crop{idx}",
                type=RichElementType.IMAGE_CROP,
                source_crop_path=crop_path,
                bbox=box,
                page_number=page_number
            )
        )

    return elements
