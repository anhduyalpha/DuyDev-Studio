"""
PDF Perception Extractor Module
Extracts geometric layout, text blocks, fonts, bounding boxes, images, and drawings from PDF pages.
Populates PageRepresentation model and executes deterministic classification.
"""

import os
from typing import Optional

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from .models import (
    PageKind,
    TextSpan,
    TextLine,
    TextBlock,
    ExtractedImage,
    PageRepresentation
)
from .classifier import classify_page
from .candidates import detect_candidates_from_page


def extract_page_representation(
    doc: fitz.Document | str,
    page_index: int,
    images_output_dir: Optional[str] = None
) -> PageRepresentation:
    """
    Extracts structured page layout, bounding boxes, images, and question candidates
    for a single PDF page using PyMuPDF.
    """
    if isinstance(doc, str):
        fitz_doc = fitz.open(doc)
        try:
            return extract_page_representation(fitz_doc, page_index, images_output_dir)
        finally:
            fitz_doc.close()

    if page_index < 0 or page_index >= len(doc):
        raise IndexError(f"Page index {page_index} out of range (0..{len(doc) - 1})")

    page = doc[page_index]
    rect = page.rect
    width = float(rect.width)
    height = float(rect.height)
    page_area = max(1.0, width * height)

    raw_text = page.get_text("text")
    clean_chars = "".join(raw_text.split())
    character_count = len(clean_chars)

    # 1. Extract Structured Text Blocks, Lines, and Spans
    text_page_dict = page.get_text("dict")
    raw_blocks = text_page_dict.get("blocks", [])

    blocks: list[TextBlock] = []
    block_idx_counter = 0

    for raw_b in raw_blocks:
        # Type 0 is text block
        if raw_b.get("type", 0) != 0:
            continue

        b_bbox = tuple(float(v) for v in raw_b.get("bbox", (0, 0, 0, 0)))
        lines: list[TextLine] = []

        for raw_line in raw_b.get("lines", []):
            l_bbox = tuple(float(v) for v in raw_line.get("bbox", (0, 0, 0, 0)))
            spans: list[TextSpan] = []

            for raw_span in raw_line.get("spans", []):
                span_text = raw_span.get("text", "")
                s_bbox = tuple(float(v) for v in raw_span.get("bbox", (0, 0, 0, 0)))
                spans.append(
                    TextSpan(
                        text=span_text,
                        bbox=s_bbox,
                        font=str(raw_span.get("font", "")),
                        size=float(raw_span.get("size", 0.0)),
                        flags=int(raw_span.get("flags", 0)),
                        color=int(raw_span.get("color", 0))
                    )
                )

            line_text = "".join(s.text for s in spans)
            lines.append(
                TextLine(
                    bbox=l_bbox,
                    spans=spans,
                    text=line_text
                )
            )

        block_text = "\n".join(l.text for l in lines)
        blocks.append(
            TextBlock(
                block_index=block_idx_counter,
                bbox=b_bbox,
                lines=lines,
                text=block_text
            )
        )
        block_idx_counter += 1

    # 2. Extract Embedded Raster Images
    extracted_images: list[ExtractedImage] = []
    total_image_area = 0.0

    raw_images = page.get_images(full=True)
    seen_xrefs: set[int] = set()

    for img_idx, img_info in enumerate(raw_images):
        xref = img_info[0]
        img_rects = page.get_image_rects(xref)

        # PyMuPDF get_image_rects returns list of Rects where this image is placed
        for rect_idx, r in enumerate(img_rects):
            img_bbox = (float(r.x0), float(r.y0), float(r.x1), float(r.y1))
            img_w = float(r.width)
            img_h = float(r.height)
            img_area = img_w * img_h
            total_image_area += img_area

            storage_path = ""
            if images_output_dir:
                os.makedirs(images_output_dir, exist_ok=True)
                img_filename = f"img_p{page_index + 1}_{xref}_{img_idx}_{rect_idx}.png"
                storage_path = os.path.join(images_output_dir, img_filename)
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n >= 5:  # CMYK or other colorspace to RGB conversion
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    pix.save(storage_path)
                    storage_path = os.path.abspath(storage_path)
                except Exception:
                    storage_path = ""

            extracted_images.append(
                ExtractedImage(
                    image_id=f"img_p{page_index + 1}_{xref}_{img_idx}_{rect_idx}",
                    xref=xref,
                    bbox=img_bbox,
                    width=int(img_info[2]) if len(img_info) > 2 else int(img_w),
                    height=int(img_info[3]) if len(img_info) > 3 else int(img_h),
                    format="png",
                    storage_path=storage_path,
                    is_mask=bool(img_info[1]) if len(img_info) > 1 else False
                )
            )

    # 3. Vector Drawings Count
    drawings = page.get_drawings()
    drawing_count = len(drawings)

    # 4. Image Area Ratio Clamping
    image_area_ratio = min(1.0, total_image_area / page_area)

    # 5. Page Classification (Vector / Mixed / Scanned / Unknown)
    page_kind = classify_page(
        character_count=character_count,
        image_area_ratio=image_area_ratio,
        has_images=len(extracted_images) > 0,
        drawing_count=drawing_count
    )

    # 6. Candidate Detection (Fast Code-First Pass)
    candidates = detect_candidates_from_page(blocks, raw_text)

    return PageRepresentation(
        page_index=page_index,
        page_number=page_index + 1,
        width=width,
        height=height,
        raw_text=raw_text,
        blocks=blocks,
        images=extracted_images,
        drawing_count=drawing_count,
        character_count=character_count,
        image_area_ratio=image_area_ratio,
        page_kind=page_kind,
        candidates=candidates,
        rendered_image_path=None
    )


def extract_document_representations(
    doc: fitz.Document | str,
    page_indices: Optional[list[int]] = None,
    images_output_dir: Optional[str] = None
) -> list[PageRepresentation]:
    """
    Extracts representations for all (or specified) pages of a PDF document.
    """
    if isinstance(doc, str):
        fitz_doc = fitz.open(doc)
        try:
            return extract_document_representations(fitz_doc, page_indices, images_output_dir)
        finally:
            fitz_doc.close()

    total_pages = len(doc)
    indices = page_indices if page_indices is not None else list(range(total_pages))

    representations: list[PageRepresentation] = []
    for idx in indices:
        if 0 <= idx < total_pages:
            rep = extract_page_representation(doc, idx, images_output_dir)
            representations.append(rep)

    return representations
