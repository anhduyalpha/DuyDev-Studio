"""
DOCX & Text Document Converter - Enhanced Version 2.0
Converts DOCX, MD, HTML, TXT, RTF between PDF, DOCX, TXT, HTML, MD formats.
Preserves formatting and Unicode Vietnamese characters.
"""
import os
import re
import asyncio
import subprocess
import shutil


async def convert_docx(input_path: str, output_dir: str, target_format: str) -> dict:
    """DOCX converter supporting PDF, TXT, HTML, MD outputs."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _process_docx, input_path, output_dir, target_format)


async def convert_text_doc(input_path: str, output_dir: str, target_format: str) -> dict:
    """Universal text & non-tabular document converter (MD, TXT, HTML, RTF)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _process_text_doc, input_path, output_dir, target_format)


def _process_docx(input_path: str, output_dir: str, target_format: str) -> dict:
    try:
        filename = os.path.basename(input_path)
        name, _ = os.path.splitext(filename)
        target_fmt = target_format.lower().lstrip('.')
        output_filename = f"{name}.{target_fmt}"
        output_path = os.path.join(output_dir, output_filename)

        if target_fmt == 'pdf':
            return _docx_to_pdf(input_path, output_path, output_filename)
        elif target_fmt == 'txt':
            return _docx_to_txt(input_path, output_path, output_filename)
        elif target_fmt == 'html':
            return _docx_to_html(input_path, output_path, output_filename, name)
        elif target_fmt == 'md':
            return _docx_to_md(input_path, output_path, output_filename, name)
        else:
            return {"success": False, "error": f"Định dạng đích không được hỗ trợ cho DOCX: {target_fmt}"}

    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi DOCX: {str(e)}"}


def _docx_to_pdf(input_path: str, output_path: str, output_filename: str) -> dict:
    """Convert DOCX to PDF using docx2pdf (requires Word) or LibreOffice."""
    # Method 1: Try docx2pdf (Windows + Microsoft Word)
    try:
        from docx2pdf import convert
        convert(input_path, output_path)
        if os.path.exists(output_path):
            return {"success": True, "output_path": output_path, "filename": output_filename}
    except Exception as e:
        print(f"[DOCX→PDF] docx2pdf failed: {e}")

    # Method 2: Try LibreOffice
    try:
        libreoffice_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            "/usr/bin/soffice",
            "/usr/bin/libreoffice",
            "/usr/local/bin/soffice",
            "soffice",
            "libreoffice",
            "/Applications/LibreOffice.app/Contents/MacOS/soffice"
        ]

        soffice_path = None
        for p in libreoffice_paths:
            if os.path.exists(p):
                soffice_path = p
                break
            resolved = shutil.which(p)
            if resolved and os.path.exists(resolved):
                soffice_path = resolved
                break

        if soffice_path:
            output_dir = os.path.dirname(output_path)
            subprocess.run([
                soffice_path,
                "--headless",
                "--convert-to", "pdf",
                "--outdir", output_dir,
                input_path
            ], capture_output=True, text=True, timeout=120)

            expected_output = os.path.join(output_dir, os.path.splitext(os.path.basename(input_path))[0] + ".pdf")
            if os.path.exists(expected_output):
                if expected_output != output_path:
                    shutil.move(expected_output, output_path)
                return {"success": True, "output_path": output_path, "filename": output_filename}
    except Exception as e:
        print(f"[DOCX→PDF] LibreOffice failed: {e}")

    return {
        "success": False,
        "error": "Chuyển đổi DOCX sang PDF yêu cầu LibreOffice hoặc Microsoft Word trên máy chủ."
    }


def _docx_to_txt(input_path: str, output_path: str, output_filename: str) -> dict:
    """Extract text from DOCX."""
    try:
        from docx import Document
    except ImportError:
        return {"success": False, "error": "Thư viện python-docx chưa được cài đặt. Vui lòng chạy 'pip install python-docx'"}

    doc = Document(input_path)
    text_content = []

    for para in doc.paragraphs:
        text_content.append(para.text)

    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text for cell in row.cells]
            text_content.append("\t".join(row_text))

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(text_content))

    return {"success": True, "output_path": output_path, "filename": output_filename}


def _docx_to_html(input_path: str, output_path: str, output_filename: str, name: str) -> dict:
    """Convert DOCX to HTML with clean typography."""
    try:
        from docx import Document
    except ImportError:
        return {"success": False, "error": "Thư viện python-docx chưa được cài đặt. Vui lòng chạy 'pip install python-docx'"}

    doc = Document(input_path)
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #1f2937;
        }}
        h1 {{ font-size: 2em; margin-top: 1em; }}
        h2 {{ font-size: 1.5em; margin-top: 0.8em; }}
        h3 {{ font-size: 1.2em; margin-top: 0.6em; }}
        p {{ margin: 1em 0; }}
        table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f3f4f6; }}
    </style>
</head>
<body>
"""

    for para in doc.paragraphs:
        if para.text.strip():
            style_name = para.style.name if para.style else ""
            if "Heading 1" in style_name:
                html_content += f"    <h1>{para.text}</h1>\n"
            elif "Heading 2" in style_name:
                html_content += f"    <h2>{para.text}</h2>\n"
            elif "Heading 3" in style_name:
                html_content += f"    <h3>{para.text}</h3>\n"
            else:
                html_content += f"    <p>{para.text}</p>\n"

    for table in doc.tables:
        html_content += "    <table>\n"
        for i, row in enumerate(table.rows):
            html_content += "        <tr>\n"
            tag = "th" if i == 0 else "td"
            for cell in row.cells:
                html_content += f"            <{tag}>{cell.text}</{tag}>\n"
            html_content += "        </tr>\n"
        html_content += "    </table>\n"

    html_content += "</body>\n</html>"

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    return {"success": True, "output_path": output_path, "filename": output_filename}


def _docx_to_md(input_path: str, output_path: str, output_filename: str, name: str) -> dict:
    """Convert DOCX to Markdown."""
    try:
        from docx import Document
    except ImportError:
        return {"success": False, "error": "Thư viện python-docx chưa được cài đặt. Vui lòng chạy 'pip install python-docx'"}

    doc = Document(input_path)
    md_content = f"# {name}\n\n"

    for para in doc.paragraphs:
        if para.text.strip():
            style_name = para.style.name if para.style else ""
            if "Heading 1" in style_name:
                md_content += f"# {para.text}\n\n"
            elif "Heading 2" in style_name:
                md_content += f"## {para.text}\n\n"
            elif "Heading 3" in style_name:
                md_content += f"### {para.text}\n\n"
            else:
                md_content += f"{para.text}\n\n"

    for table in doc.tables:
        if table.rows:
            header = [cell.text for cell in table.rows[0].cells]
            md_content += "| " + " | ".join(header) + " |\n"
            md_content += "| " + " | ".join(["---"] * len(header)) + " |\n"

            for row in table.rows[1:]:
                cells = [cell.text for cell in row.cells]
                md_content += "| " + " | ".join(cells) + " |\n"
            md_content += "\n"

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(md_content)

    return {"success": True, "output_path": output_path, "filename": output_filename}


def _process_text_doc(input_path: str, output_dir: str, target_format: str) -> dict:
    """Handles text/markdown/html/rtf conversions without Pandas."""
    try:
        filename = os.path.basename(input_path)
        name, ext = os.path.splitext(filename)
        src_ext = ext.lower().lstrip('.')
        tgt_fmt = target_format.lower().lstrip('.')
        output_filename = f"{name}.{tgt_fmt}"
        output_path = os.path.join(output_dir, output_filename)

        with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
            raw_text = f.read()

        # Destination 1: DOCX
        if tgt_fmt in ['docx', 'doc']:
            try:
                from docx import Document
            except ImportError:
                return {"success": False, "error": "Thư viện python-docx chưa được cài đặt"}

            doc = Document()
            if src_ext in ['md', 'markdown']:
                for line in raw_text.splitlines():
                    trimmed = line.strip()
                    if trimmed.startswith('### '):
                        doc.add_heading(trimmed[4:], level=3)
                    elif trimmed.startswith('## '):
                        doc.add_heading(trimmed[3:], level=2)
                    elif trimmed.startswith('# '):
                        doc.add_heading(trimmed[2:], level=1)
                    elif trimmed:
                        doc.add_paragraph(line)
            elif src_ext in ['html', 'htm']:
                # Clean html tags for docx paragraphs
                clean_lines = re.sub(r'<[^>]+>', ' ', raw_text).splitlines()
                for line in clean_lines:
                    if line.strip():
                        doc.add_paragraph(line.strip())
            else:
                for line in raw_text.splitlines():
                    if line.strip():
                        doc.add_paragraph(line)

            doc.save(output_path)
            return {"success": True, "output_path": output_path, "filename": output_filename}

        # Destination 2: PDF
        elif tgt_fmt == 'pdf':
            # Try LibreOffice first
            try:
                libreoffice_paths = [
                    r"C:\Program Files\LibreOffice\program\soffice.exe",
                    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
                    "soffice", "/usr/bin/soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"
                ]
                soffice_path = next((p for p in libreoffice_paths if os.path.exists(p) or shutil.which(p)), None)
                if soffice_path:
                    out_dir = os.path.dirname(output_path)
                    subprocess.run([
                        soffice_path, "--headless", "--convert-to", "pdf", "--outdir", out_dir, input_path
                    ], capture_output=True, text=True, timeout=120)
                    expected = os.path.join(out_dir, f"{name}.pdf")
                    if os.path.exists(expected):
                        if expected != output_path:
                            shutil.move(expected, output_path)
                        return {"success": True, "output_path": output_path, "filename": output_filename}
            except Exception:
                pass

            # Fallback to PyMuPDF pagination
            try:
                try:
                    import pymupdf
                except ImportError:
                    import fitz as pymupdf

                pdf_doc = pymupdf.open()
                lines = raw_text.splitlines()
                lines_per_page = 48

                font_candidates = [
                    r"C:\Windows\Fonts\arial.ttf",
                    r"C:\Windows\Fonts\segoeui.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
                    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
                ]
                unicode_font = next((p for p in font_candidates if os.path.exists(p)), None)

                for p_idx in range(0, max(1, len(lines)), lines_per_page):
                    page_chunk = lines[p_idx:p_idx + lines_per_page]
                    page = pdf_doc.new_page(width=595.0, height=842.0)  # A4
                    rect = pymupdf.Rect(45, 50, 550, 792)
                    text_block = "\n".join(page_chunk)
                    if unicode_font:
                        page.insert_font(fontname="F0", fontfile=unicode_font)
                        page.insert_textbox(rect, text_block, fontsize=10.5, fontname="F0")
                    else:
                        page.insert_textbox(rect, text_block, fontsize=10.5, fontname="helv")

                pdf_doc.save(output_path)
                pdf_doc.close()
                return {"success": True, "output_path": output_path, "filename": output_filename}
            except Exception as pe:
                return {"success": False, "error": f"Lỗi tạo tệp PDF từ văn bản: {str(pe)}"}

        # Destination 3: HTML
        elif tgt_fmt in ['html', 'htm']:
            if src_ext in ['md', 'markdown']:
                html_body = raw_text
                html_body = re.sub(r'^### (.*)$', r'<h3>\1</h3>', html_body, flags=re.MULTILINE)
                html_body = re.sub(r'^## (.*)$', r'<h2>\1</h2>', html_body, flags=re.MULTILINE)
                html_body = re.sub(r'^# (.*)$', r'<h1>\1</h1>', html_body, flags=re.MULTILINE)
                html_body = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html_body)
                html_body = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html_body)
                html_body = html_body.replace('\n\n', '</p><p>')
                full_html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{name}</title><style>body{{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:1rem;line-height:1.6;}}</style></head><body><h1>{name}</h1><p>{html_body}</p></body></html>"
            elif src_ext in ['txt', 'rtf']:
                full_html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{name}</title></head><body><pre style='white-space:pre-wrap;font-family:sans-serif;'>{raw_text}</pre></body></html>"
            else:
                full_html = raw_text

            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(full_html)
            return {"success": True, "output_path": output_path, "filename": output_filename}

        # Destination 4: TXT
        elif tgt_fmt == 'txt':
            if src_ext in ['html', 'htm']:
                clean = re.sub(r'<[^>]+>', ' ', raw_text)
                txt_content = re.sub(r'\s+', ' ', clean).strip()
            elif src_ext in ['md', 'markdown']:
                txt_content = re.sub(r'#+\s', '', raw_text)
                txt_content = re.sub(r'[*_`]', '', txt_content)
            else:
                txt_content = raw_text

            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(txt_content)
            return {"success": True, "output_path": output_path, "filename": output_filename}

        # Destination 5: MD
        elif tgt_fmt in ['md', 'markdown']:
            if src_ext in ['html', 'htm']:
                md_content = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1\n\n', raw_text, flags=re.IGNORECASE)
                md_content = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1\n\n', md_content, flags=re.IGNORECASE)
                md_content = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1\n\n', md_content, flags=re.IGNORECASE)
                md_content = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', md_content, flags=re.IGNORECASE)
                md_content = re.sub(r'<[^>]+>', ' ', md_content).strip()
            else:
                md_content = f"# {name}\n\n{raw_text}"

            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            return {"success": True, "output_path": output_path, "filename": output_filename}

        else:
            return {"success": False, "error": f"Định dạng đích không được hỗ trợ: {tgt_fmt}"}

    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi văn bản: {str(e)}"}
