"""
DD Studio - Basic PyMuPDF Operations
Compress, Merge, Split, Extract Text, Convert
"""

import os
import sys
import json

try:
    import pymupdf as fitz
except ImportError:
    import fitz

from pdf_ops_advanced import emit_progress, parse_page_range


def cmd_compress(args):
    emit_progress(10, "Opening PDF document")
    doc = fitz.open(args.input)
    total = len(doc)
    level = (getattr(args, "level", "medium") or "medium").strip().lower()

    if getattr(args, "strip_metadata", False):
        emit_progress(30, "Sanitizing metadata headers")
        doc.set_metadata({})

    for idx, _ in enumerate(doc):
        pct = 30 + int((idx + 1) / total * 50)
        emit_progress(pct, f"Optimizing stream objects on page {idx + 1}/{total}")

    emit_progress(85, "Writing compressed PDF stream to disk")
    if level == "high":
        doc.save(
            args.output,
            garbage=4,
            deflate=True,
            clean=True,
            deflate_images=True,
            deflate_fonts=True,
            linear=False
        )
    elif level == "low":
        doc.save(
            args.output,
            garbage=3,
            deflate=True
        )
    else:  # medium / default
        doc.save(
            args.output,
            garbage=4,
            deflate=True,
            clean=True,
            deflate_images=True,
            deflate_fonts=True
        )
    doc.close()
    emit_progress(100, "PDF compression completed successfully")


def cmd_merge(args):
    emit_progress(10, "Initializing merged PDF container")
    merged_doc = fitz.open()
    total_inputs = len(args.inputs)

    for idx, inp_file in enumerate(args.inputs):
        pct = 15 + int((idx + 1) / total_inputs * 70)
        emit_progress(pct, f"Merging file {idx + 1}/{total_inputs}: {os.path.basename(inp_file)}")
        sub_doc = fitz.open(inp_file)
        merged_doc.insert_pdf(sub_doc)
        sub_doc.close()

    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        merged_doc.set_metadata({})

    emit_progress(90, "Writing merged artifact to disk")
    merged_doc.save(args.output, garbage=3, deflate=True)
    merged_doc.close()
    emit_progress(100, "PDF merge completed successfully")


def cmd_split(args):
    emit_progress(10, "Reading document structure")
    doc = fitz.open(args.input)
    total = len(doc)

    if args.pages:
        page_indices = parse_page_range(args.pages, total)
    else:
        page_indices = [0] if total > 0 else []

    if len(page_indices) == 0:
        doc.close()
        raise ValueError("Không có trang hợp lệ trong dải trang đã chọn")

    split_doc = fitz.open()
    for idx, p_idx in enumerate(page_indices):
        pct = 20 + int((idx + 1) / max(1, len(page_indices)) * 65)
        emit_progress(pct, f"Extracting page {p_idx + 1} ({idx + 1}/{len(page_indices)})")
        split_doc.insert_pdf(doc, from_page=p_idx, to_page=p_idx)

    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        split_doc.set_metadata({})

    emit_progress(90, "Persisting split document")
    split_doc.save(args.output, garbage=3, deflate=True)
    split_doc.close()
    doc.close()
    emit_progress(100, "PDF split completed successfully")


def cmd_extract_text(args):
    emit_progress(10, "Parsing document text layout")
    doc = fitz.open(args.input)
    total = len(doc)
    all_text = []

    for idx, page in enumerate(doc):
        pct = 15 + int((idx + 1) / total * 75)
        emit_progress(pct, f"Extracting text from page {idx + 1}/{total}")
        all_text.append(f"--- PAGE {idx + 1} ---\n" + page.get_text())

    full_output = "\n".join(all_text)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(full_output)
    else:
        sys.stdout.write(full_output)

    doc.close()
    emit_progress(100, "Text extraction completed successfully")


def cmd_convert(args):
    fmt = (args.format or "txt").lower()
    emit_progress(10, f"Preparing conversion to {fmt.upper()}")
    doc = fitz.open(args.input)

    if fmt == "txt":
        args.output = args.output or f"{args.input}.txt"
        cmd_extract_text(args)
    elif fmt in ("png", "jpg", "jpeg"):
        emit_progress(30, "Rasterizing first page thumbnail")
        page = doc[0]
        pix = page.get_pixmap(dpi=150)
        pix.save(args.output)
        emit_progress(100, "Image conversion completed")
    elif fmt == "docx":
        emit_progress(30, "Extracting text into DOCX document")
        try:
            from docx import Document
            docx_doc = Document()
            for idx, page in enumerate(doc):
                emit_progress(35 + int((idx + 1) / len(doc) * 50), f"Converting page {idx + 1}")
                docx_doc.add_heading(f"Page {idx + 1}", level=2)
                docx_doc.add_paragraph(page.get_text())
            docx_doc.save(args.output)
            emit_progress(100, "DOCX conversion completed")
        except ImportError:
            text = "\n".join([p.get_text() for p in doc])
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(text)
            emit_progress(100, "DOCX fallback text conversion completed")
    else:
        doc.save(args.output, garbage=3, deflate=True)
        emit_progress(100, "Conversion completed")
    doc.close()
