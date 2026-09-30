#!/usr/bin/env python3
"""
DD Studio - Polyglot Document & PDF Engine
High-performance document processing via PyMuPDF (fitz)
"""

import sys
import os
import argparse

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

sys.path.append(os.path.dirname(__file__))
from pdf_ops_basic import (
    cmd_compress, cmd_merge, cmd_split, cmd_extract_text, cmd_convert
)
from pdf_ops_advanced import (
    cmd_rotate, cmd_images_to_pdf, cmd_watermark,
    cmd_extract_images, cmd_lock, cmd_unlock,
    cmd_organize, cmd_pdf_to_docx
)


def main():
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument("--strip-metadata", action="store_true", help="Strip document metadata")

    parser = argparse.ArgumentParser(description="DD Studio PyMuPDF Document Engine")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # Compress
    p_comp = subparsers.add_parser("compress", parents=[common_parser])
    p_comp.add_argument("--input", required=True, help="Path to input PDF")
    p_comp.add_argument("--output", required=True, help="Path to output PDF")
    p_comp.add_argument("--dpi", type=int, default=150, help="Target DPI")
    p_comp.add_argument("--level", default="medium", help="Compression level")

    # Merge
    p_merge = subparsers.add_parser("merge", parents=[common_parser])
    p_merge.add_argument("--inputs", nargs="+", required=True, help="List of PDF paths to merge")
    p_merge.add_argument("--output", required=True, help="Path to output merged PDF")

    # Split
    p_split = subparsers.add_parser("split", parents=[common_parser])
    p_split.add_argument("--input", required=True, help="Path to input PDF")
    p_split.add_argument("--output", required=True, help="Path to output PDF")
    p_split.add_argument("--pages", default=None, help="Page range (e.g. 1-3,5)")

    # Extract text
    p_txt = subparsers.add_parser("extract-text", parents=[common_parser])
    p_txt.add_argument("--input", required=True, help="Path to input PDF")
    p_txt.add_argument("--output", default=None, help="Path to output TXT")
    p_txt.add_argument("--lang", default="vie+eng", help="Document language hint")

    # Convert
    p_conv = subparsers.add_parser("convert", parents=[common_parser])
    p_conv.add_argument("--input", required=True, help="Path to input file")
    p_conv.add_argument("--output", required=True, help="Path to output file")
    p_conv.add_argument("--format", default="txt", help="Target format (txt, png, docx)")

    # Rotate
    p_rot = subparsers.add_parser("rotate", parents=[common_parser])
    p_rot.add_argument("--input", required=True, help="Path to input PDF")
    p_rot.add_argument("--output", required=True, help="Path to output PDF")
    p_rot.add_argument("--angle", type=int, default=90, help="Rotation angle in degrees")
    p_rot.add_argument("--pages", default=None, help="Page range to rotate")
    p_rot.add_argument("--rotations-json", default=None, help="JSON dictionary of page_index: angle")

    # Images to PDF
    p_img = subparsers.add_parser("images-to-pdf", parents=[common_parser])
    p_img.add_argument("--inputs", nargs="+", required=True, help="List of image paths")
    p_img.add_argument("--output", required=True, help="Path to output PDF")

    # Watermark
    p_wm = subparsers.add_parser("watermark", parents=[common_parser])
    p_wm.add_argument("--input", required=True, help="Path to input PDF")
    p_wm.add_argument("--output", required=True, help="Path to output PDF")
    p_wm.add_argument("--text", default="", help="Watermark text")
    p_wm.add_argument("--position", default="center", choices=["center", "top", "bottom"], help="Watermark position")
    p_wm.add_argument("--opacity", type=float, default=0.3, help="Watermark opacity (0.0 to 1.0)")
    p_wm.add_argument("--page-numbers", action="store_true", help="Add page numbering")

    # Extract images
    p_ext = subparsers.add_parser("extract-images", parents=[common_parser])
    p_ext.add_argument("--input", required=True, help="Path to input PDF")
    p_ext.add_argument("--output-dir", required=True, help="Output directory for images")

    # Lock / Unlock
    p_lck = subparsers.add_parser("lock", parents=[common_parser])
    p_lck.add_argument("--input", required=True, help="Path to input PDF")
    p_lck.add_argument("--output", required=True, help="Path to output PDF")
    p_lck.add_argument("--password", required=True, help="Password to encrypt")

    p_unl = subparsers.add_parser("unlock", parents=[common_parser])
    p_unl.add_argument("--input", required=True, help="Path to input PDF")
    p_unl.add_argument("--output", required=True, help="Path to output PDF")
    p_unl.add_argument("--password", default="", help="Password to decrypt")

    # Organize
    p_org = subparsers.add_parser("organize", parents=[common_parser])
    p_org.add_argument("--input", required=True, help="Path to input PDF")
    p_org.add_argument("--output", required=True, help="Path to output PDF")
    p_org.add_argument("--pages", default=None, help="Ordered page indices or JSON array")
    p_org.add_argument("--rotations", default=None, help="JSON dictionary of page_index: angle")

    # PDF to DOCX
    p_docx = subparsers.add_parser("pdf-to-docx", parents=[common_parser])
    p_docx.add_argument("--input", required=True, help="Path to input PDF")
    p_docx.add_argument("--output", required=True, help="Path to output DOCX")
    p_docx.add_argument("--pages", default=None, help="Page range (e.g. 1-10)")
    p_docx.add_argument("--stream-table", action="store_true", default=False, help="Enable stream table parsing")
    p_docx.add_argument("--force-stream-table", action="store_true", default=False, help="Force enable stream table parsing overriding AI recommendation")

    try:
        args = parser.parse_args()
        first_input = getattr(args, "input", None) or (args.inputs[0] if getattr(args, "inputs", None) else "")
        if not os.path.exists(first_input):
            sys.stderr.write(f"Error: Input file not found: {first_input}\n")
            sys.exit(1)

        handlers = {
            "compress": cmd_compress,
            "merge": cmd_merge,
            "split": cmd_split,
            "extract-text": cmd_extract_text,
            "convert": cmd_convert,
            "rotate": cmd_rotate,
            "images-to-pdf": cmd_images_to_pdf,
            "watermark": cmd_watermark,
            "extract-images": cmd_extract_images,
            "lock": cmd_lock,
            "unlock": cmd_unlock,
            "organize": cmd_organize,
            "pdf-to-docx": cmd_pdf_to_docx
        }
        handlers[args.subcommand](args)
    except Exception as exc:
        err_msg = str(exc)
        exc_type = type(exc).__name__
        sys.stderr.write(f"PDF Engine Error ({exc_type}): {err_msg}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
