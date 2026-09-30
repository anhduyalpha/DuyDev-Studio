#!/usr/bin/env python3
"""
DD Studio - PDF Diagnostics Battery (< 220 lines)
Performs 6 quantitative pre-conversion checks using PyMuPDF to extract
document structural characteristics for the AI Decision Router.
"""

import os
import re
from typing import Dict, Any, List

try:
    import pymupdf as fitz
except ImportError:
    import fitz

EXPONENT_RE = re.compile(
    r'\b(10|2)(1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9])\s*(bytes?|B|bit|bits|Hz|kHz|MHz|GHz|s|ms|μs|us|ns)\b',
    re.IGNORECASE
)
QUESTION_RE = re.compile(r'^\s*(\d+\.\d+|\d+\.|[Cc]âu\s+\d+|[Bb]ài\s+\d+)')


def check_question_numbering(doc: fitz.Document) -> Dict[str, Any]:
    """Check 1: Question numbering and indentation alignment without vertical line."""
    total_tokens, x_positions = [], []
    has_vertical_divider = False

    for page in doc[:min(5, len(doc))]:
        for w in page.get_text("words"):
            m = QUESTION_RE.match(w[4])
            if m:
                total_tokens.append(m.group(1))
                x_positions.append(round(w[0], 1))

        for d in page.get_drawings():
            for item in d.get("items", []):
                if item[0] == "l" and abs(item[1].x - item[2].x) < 2 and abs(item[1].y - item[2].y) > 20:
                    if 80 <= item[1].x <= 150:
                        has_vertical_divider = True

    detected = len(total_tokens) >= 3
    has_indent = bool(detected and x_positions and (max(x_positions) - min(x_positions) < 25) and not has_vertical_divider)
    return {
        "detected": detected,
        "count": len(total_tokens),
        "sample": list(dict.fromkeys(total_tokens))[:6],
        "has_indentation": has_indent,
        "has_vertical_divider": has_vertical_divider
    }


def check_table_borders_and_grids(doc: fitz.Document, question_detected: bool = False) -> Dict[str, Any]:
    """Check 2: True lattice grid tables vs stream table risk (isolated/decorative lines)."""
    lattice_cells, decorative_lines = 0, 0

    for page in doc[:min(5, len(doc))]:
        h_lines, v_lines = [], []
        for d in page.get_drawings():
            for item in d.get("items", []):
                if item[0] in ("re", "qu"):
                    r = item[1]
                    if r.height < 3 and r.width > 20:
                        h_lines.append(r.y0)
                    elif r.width < 3 and r.height > 10:
                        v_lines.append(r.x0)
                    elif r.width > 15 and r.height > 10:
                        lattice_cells += 1
                elif item[0] == "l":
                    p1, p2 = item[1], item[2]
                    if abs(p1.y - p2.y) < 2 and abs(p1.x - p2.x) > 20:
                        h_lines.append(p1.y)
                    elif abs(p1.x - p2.x) < 2 and abs(p1.y - p2.y) > 10:
                        v_lines.append(p1.x)

        if len(v_lines) >= 2 and len(h_lines) >= 2:
            lattice_cells += len(v_lines) * len(h_lines) // 4
        else:
            decorative_lines += len(h_lines) + len(v_lines)

    has_true_grid = lattice_cells >= 4
    risk = "CRITICAL" if question_detected else ("MODERATE" if decorative_lines > 5 and not has_true_grid else "LOW")
    return {
        "has_true_grid": has_true_grid,
        "lattice_cell_estimate": lattice_cells,
        "decorative_lines": decorative_lines,
        "stream_table_risk": risk
    }


def check_header_footer_boxes(doc: fitz.Document) -> Dict[str, Any]:
    """Check 3: Detects repetitive 2-column header/footer layouts in margins."""
    has_header, has_footer, sample_header = False, False, ""

    for page in doc[:min(3, len(doc))]:
        h = page.rect.height
        for b in page.get_text("blocks"):
            if len(b) < 5 or not b[4].strip():
                continue
            y0, y1, text = b[1], b[3], b[4].strip()
            if y0 < h * 0.12 and len(text) > 10:
                has_header = True
                if not sample_header:
                    sample_header = " ".join(text.split())[:80]
            elif y1 > h * 0.88 and len(text) < 40:
                has_footer = True

    return {"has_header_box": has_header, "has_footer_box": has_footer, "sample_header": sample_header}


def check_scientific_exponents(doc: fitz.Document) -> Dict[str, Any]:
    """Check 4: Detects collapsed base and exponent strings like 1015 bytes, 250 bytes."""
    matches: List[str] = []
    for page in doc[:min(5, len(doc))]:
        for base, exp, unit in EXPONENT_RE.findall(page.get_text()):
            matches.append(f"{base}{exp} {unit}")
    unique = list(dict.fromkeys(matches))
    return {"detected": len(unique) > 0, "count": len(unique), "matches": unique[:6]}


def check_embedded_media(doc: fitz.Document) -> Dict[str, Any]:
    """Check 5: Counts embedded images and detects table-as-image."""
    total_images, table_as_image = 0, False

    for page in doc[:min(5, len(doc))]:
        images = page.get_images(full=True)
        total_images += len(images)
        for img in images:
            try:
                bbox = page.get_image_bbox(img)
                if bbox.width > page.rect.width * 0.6 and bbox.height > 100:
                    table_as_image = True
            except Exception:
                pass

    return {"image_count": total_images, "has_images": total_images > 0, "table_as_image_detected": table_as_image}


def check_document_architecture(doc: fitz.Document) -> Dict[str, Any]:
    """Check 6: Checks vector text searchability vs scanned document and column flow."""
    page_count = len(doc)
    total_chars, multi_col_votes = 0, 0
    sample_pages = min(3, page_count)

    for page in doc[:sample_pages]:
        total_chars += len(page.get_text().strip())
        mid = page.rect.width / 2.0
        blocks = page.get_text("blocks")
        left_col = [b for b in blocks if len(b) >= 5 and b[2] < mid + 20 and len(b[4].strip()) > 30]
        right_col = [b for b in blocks if len(b) >= 5 and b[0] > mid - 20 and len(b[4].strip()) > 30]
        if len(left_col) >= 2 and len(right_col) >= 2:
            multi_col_votes += 1

    avg_chars = total_chars / max(1, sample_pages)
    return {
        "page_count": page_count,
        "is_searchable": avg_chars > 50,
        "avg_chars_per_page": int(avg_chars),
        "column_flow": "multi_column" if multi_col_votes > sample_pages / 2 else "single_column"
    }


def run_pdf_diagnostics(pdf_path: str) -> Dict[str, Any]:
    """Runs the 6-point diagnostic battery and compiles a compact summary."""
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    try:
        questions = check_question_numbering(doc)
        return {
            "document_summary": check_document_architecture(doc),
            "checks": {
                "question_list": questions,
                "tables_and_grids": check_table_borders_and_grids(doc, question_detected=questions["detected"]),
                "header_footer": check_header_footer_boxes(doc),
                "scientific_exponents": check_scientific_exponents(doc),
                "embedded_media": check_embedded_media(doc)
            }
        }
    finally:
        doc.close()


if __name__ == "__main__":
    import sys, json
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    target = sys.argv[1] if len(sys.argv) > 1 else ""
    if target and os.path.exists(target):
        print(json.dumps(run_pdf_diagnostics(target), indent=2, ensure_ascii=False))
