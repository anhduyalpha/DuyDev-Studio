#!/usr/bin/env python3
"""
markdown_to_docx.py - Production OOXML (.docx) Generator from Markdown
Part of DuyDev Studio Document Engines.
Converts Markdown documents into styled OOXML Word (.docx) files using python-docx.
Supports:
  - Headings 1..6 with proper typographic hierarchy
  - Inline bold, italic, code, links
  - Unordered (bullet) and ordered (numbered) lists
  - Blockquotes with indent and styling
  - Monospace shaded fenced code blocks
  - GFM pipe tables with bold headers and cell shading
  - XML 1.0 control-character sanitization
"""

import sys
import os
import re
import argparse
from pathlib import Path
from typing import List, Tuple, Optional

import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

INVALID_XML_CHARS = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')
INLINE_TOKEN_RE = re.compile(
    r'(\*\*[^*]+?\*\*|__[^_]+?__|\*[^*]+?\*|_[^_]+?_|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))'
)


def sanitize_xml_string(text: str) -> str:
    """Strips control characters that are invalid in XML 1.0."""
    if not text:
        return ""
    return INVALID_XML_CHARS.sub("", text)


def set_cell_shading(cell, color_hex: str = "F1F5F9"):
    """Applies background fill color to a docx table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top: int = 120, bottom: int = 120, left: int = 180, right: int = 180):
    """Sets internal padding (in dxa: 20 dxa = 1 pt) for a cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)


def add_formatted_runs(paragraph, text: str, default_italic: bool = False):
    """Parses inline bold, italic, code, and links, appending runs to paragraph."""
    text = sanitize_xml_string(text)
    if not text:
        return

    tokens = INLINE_TOKEN_RE.split(text)
    for token in tokens:
        if not token:
            continue

        if (token.startswith("**") and token.endswith("**")) or (token.startswith("__") and token.endswith("__")):
            inner = token[2:-2]
            run = paragraph.add_run(inner)
            run.bold = True
            if default_italic:
                run.italic = True
        elif (token.startswith("*") and token.endswith("*")) or (token.startswith("_") and token.endswith("_")):
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.italic = True
        elif token.startswith("`") and token.endswith("`"):
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(79, 70, 229)
        elif token.startswith("[") and "]" in token and "(" in token and token.endswith(")"):
            m = re.match(r'\[([^\]]+)\]\(([^)]+)\)', token)
            if m:
                label, url = m.group(1), m.group(2)
                run = paragraph.add_run(label)
                run.font.color.rgb = RGBColor(37, 99, 235)
                run.underline = True
            else:
                run = paragraph.add_run(token)
                if default_italic:
                    run.italic = True
        else:
            run = paragraph.add_run(token)
            if default_italic:
                run.italic = True


def parse_pipe_table_row(line: str) -> List[str]:
    """Parses a markdown table line into cell contents."""
    content = line.strip()
    if content.startswith("|"):
        content = content[1:]
    if content.endswith("|"):
        content = content[:-1]
    return [c.strip() for c in content.split("|")]


def is_table_separator(cells: List[str]) -> bool:
    """Checks if cells represent a markdown table separator row like | :--- | :---: | ---: |."""
    if not cells:
        return False
    return all(re.match(r"^:?-+:?$", c.strip()) is not None for c in cells if c.strip())


def render_code_block(doc: docx.Document, code_lines: List[str]):
    """Renders a fenced code block into a styled shaded single-cell table."""
    code_text = sanitize_xml_string("\n".join(code_lines))
    tbl = doc.add_table(rows=1, cols=1)
    tbl.style = "Table Grid"
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)

    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F8FAFC")
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = Pt(13)

    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(30, 41, 59)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def render_table(doc: docx.Document, header: List[str], rows: List[List[str]]):
    """Renders a GFM table with bold header row and light zebra borders."""
    num_cols = len(header)
    if num_cols == 0:
        return

    table = doc.add_table(rows=1 + len(rows), cols=num_cols)
    table.style = "Table Grid"

    # Header Row
    hdr_cells = table.rows[0].cells
    for i in range(num_cols):
        cell = hdr_cells[i]
        set_cell_shading(cell, "F1F5F9")
        set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        add_formatted_runs(p, header[i] if i < len(header) else "")
        for r in p.runs:
            r.bold = True

    # Data Rows
    for row_idx, row_data in enumerate(rows):
        row_cells = table.rows[1 + row_idx].cells
        for col_idx in range(num_cols):
            cell = row_cells[col_idx]
            if row_idx % 2 == 1:
                set_cell_shading(cell, "FAFAFA")
            set_cell_margins(cell, top=100, bottom=100, left=160, right=160)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            val = row_data[col_idx] if col_idx < len(row_data) else ""
            add_formatted_runs(p, val)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def convert_markdown_to_docx(markdown_content: str, output_path: str, title: Optional[str] = None):
    """Core compiler: parses Markdown and generates styled OOXML .docx document."""
    doc = docx.Document()

    # Document Geometry (1 inch margins, A4 or Letter default)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Optional Document Title Header
    if title and title.strip():
        core_props = doc.core_properties
        core_props.title = title.strip()
        core_props.author = "DuyDev Studio - Document Engine"

    lines = markdown_content.splitlines()
    in_code_block = False
    code_block_lines: List[str] = []

    in_table = False
    table_header: List[str] = []
    table_rows: List[List[str]] = []

    def flush_table():
        nonlocal in_table, table_header, table_rows
        if in_table and table_header:
            render_table(doc, table_header, table_rows)
        in_table = False
        table_header = []
        table_rows = []

    line_idx = 0
    total_lines = len(lines)

    while line_idx < total_lines:
        line = lines[line_idx]

        # 1. Fenced Code Block handling
        if line.strip().startswith("```") or line.strip().startswith("~~~"):
            if in_code_block:
                in_code_block = False
                render_code_block(doc, code_block_lines)
                code_block_lines = []
            else:
                flush_table()
                in_code_block = True
                code_block_lines = []
            line_idx += 1
            continue

        if in_code_block:
            code_block_lines.append(line)
            line_idx += 1
            continue

        # 2. Table handling
        stripped = line.strip()
        if stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2:
            cells = parse_pipe_table_row(stripped)
            if not in_table:
                # Potential start of table: peek next line for separator
                if line_idx + 1 < total_lines:
                    next_stripped = lines[line_idx + 1].strip()
                    if next_stripped.startswith("|") and next_stripped.endswith("|"):
                        next_cells = parse_pipe_table_row(next_stripped)
                        if is_table_separator(next_cells):
                            in_table = True
                            table_header = cells
                            table_rows = []
                            line_idx += 2  # skip separator line
                            continue
            else:
                if is_table_separator(cells):
                    line_idx += 1
                    continue
                table_rows.append(cells)
                line_idx += 1
                continue

        flush_table()

        # 3. Empty lines
        if not stripped:
            line_idx += 1
            continue

        # 4. Headings
        h_match = re.match(r'^(#{1,6})\s+(.*)$', stripped)
        if h_match:
            level = len(h_match.group(1))
            heading_text = h_match.group(2).strip()
            heading_p = doc.add_heading(level=level)
            heading_p.paragraph_format.space_before = Pt(12 if level == 1 else 8)
            heading_p.paragraph_format.space_after = Pt(4)
            add_formatted_runs(heading_p, heading_text)
            line_idx += 1
            continue

        # 5. Blockquotes
        if stripped.startswith(">"):
            quote_text = re.sub(r'^>\s?', '', stripped)
            qp = doc.add_paragraph()
            qp.paragraph_format.left_indent = Inches(0.4)
            qp.paragraph_format.space_before = Pt(4)
            qp.paragraph_format.space_after = Pt(4)
            add_formatted_runs(qp, quote_text, default_italic=True)
            line_idx += 1
            continue

        # 6. Unordered Lists
        bullet_match = re.match(r'^[\*\-]\s+(.*)$', stripped)
        if bullet_match:
            item_text = bullet_match.group(1)
            lp = doc.add_paragraph(style='List Bullet')
            lp.paragraph_format.space_before = Pt(0)
            lp.paragraph_format.space_after = Pt(2)
            add_formatted_runs(lp, item_text)
            line_idx += 1
            continue

        # 7. Ordered Lists
        num_match = re.match(r'^\d+\.\s+(.*)$', stripped)
        if num_match:
            item_text = num_match.group(1)
            np_item = doc.add_paragraph(style='List Number')
            np_item.paragraph_format.space_before = Pt(0)
            np_item.paragraph_format.space_after = Pt(2)
            add_formatted_runs(np_item, item_text)
            line_idx += 1
            continue

        # 8. Standard Paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        add_formatted_runs(p, stripped)
        line_idx += 1

    # Final flush
    if in_code_block:
        render_code_block(doc, code_block_lines)
    flush_table()

    # Ensure output directory exists and save
    out_file = Path(output_path).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_file))


def main():
    parser = argparse.ArgumentParser(description="Convert Markdown to OOXML .docx document")
    parser.add_argument("input", help="Path to input .md file")
    parser.add_argument("output", help="Path to output .docx file")
    parser.add_argument("--title", default=None, help="Document title metadata")

    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        sys.stderr.write(f"Error: input file '{args.input}' does not exist.\n")
        sys.exit(1)

    try:
        content = input_path.read_text(encoding="utf-8")
        convert_markdown_to_docx(content, args.output, title=args.title)
        print(f"Successfully converted '{args.input}' -> '{args.output}'")
        sys.exit(0)
    except Exception as exc:
        sys.stderr.write(f"Conversion failed: {exc}\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
