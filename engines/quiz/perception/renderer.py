"""
Selective Page Renderer Module
Renders PDF pages to high-resolution PNG images on-demand for vision QA or OCR pipelines.
"""

import os
from typing import Optional

try:
    import pymupdf as fitz
except ImportError:
    import fitz


def render_page_to_image(
    doc: fitz.Document,
    page_index: int,
    output_dir: str,
    dpi: int = 200,
    prefix: str = "page"
) -> str:
    """
    Renders a single PDF page to a PNG image file at specified DPI.
    Saves to output_dir and returns the absolute file path.
    Only rendered on-demand (Rule 16 & 17: avoid mass rendering).
    """
    if page_index < 0 or page_index >= len(doc):
        raise IndexError(f"Page index {page_index} out of range (0..{len(doc) - 1})")

    os.makedirs(output_dir, exist_ok=True)
    page = doc[page_index]

    # Render pixmap with target DPI (default 200 DPI is optimal for vision/OCR)
    pix = page.get_pixmap(dpi=dpi)
    output_path = os.path.join(output_dir, f"{prefix}_{page_index + 1}.png")
    pix.save(output_path)

    return os.path.abspath(output_path)


def render_page_to_bytes(
    doc: fitz.Document,
    page_index: int,
    dpi: int = 200
) -> bytes:
    """
    Renders a single PDF page directly to PNG bytes in memory.
    Useful for feeding directly into multimodal vision payload without disk I/O.
    """
    if page_index < 0 or page_index >= len(doc):
        raise IndexError(f"Page index {page_index} out of range (0..{len(doc) - 1})")

    page = doc[page_index]
    pix = page.get_pixmap(dpi=dpi)
    return pix.tobytes("png")
