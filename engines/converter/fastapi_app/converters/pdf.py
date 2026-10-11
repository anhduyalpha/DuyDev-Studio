"""
PDF Converter - Enhanced Version 2.0
Converts PDF files to DOCX, TXT, HTML, MD, RTF, and multi-page images (PNG, JPG, WEBP).
Uses pdf2docx and PyMuPDF for fast, high-fidelity conversion.
Multi-page images automatically bundled into ZIP archives.
"""
import os
import asyncio
import zipfile


async def convert_pdf(input_path: str, output_dir: str, target_format: str) -> dict:
    """PDF converter supporting multiple output formats with formatting preservation."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _process_pdf, input_path, output_dir, target_format)


def _process_pdf(input_path: str, output_dir: str, target_format: str) -> dict:
    try:
        filename = os.path.basename(input_path)
        name, _ = os.path.splitext(filename)
        target_fmt = target_format.lower().lstrip('.')
        output_filename = f"{name}.{target_fmt}"
        output_path = os.path.join(output_dir, output_filename)

        if target_fmt in ['docx', 'doc']:
            return _pdf_to_docx(input_path, output_path, output_filename)
        elif target_fmt == 'txt':
            return _pdf_to_txt(input_path, output_path, output_filename)
        elif target_fmt == 'html':
            return _pdf_to_html(input_path, output_path, output_filename, name)
        elif target_fmt == 'md':
            return _pdf_to_md(input_path, output_path, output_filename, name)
        elif target_fmt == 'rtf':
            return _pdf_to_rtf(input_path, output_path, output_filename)
        elif target_fmt in ['png', 'jpg', 'jpeg', 'webp']:
            return _pdf_to_images(input_path, output_dir, target_fmt, name)
        else:
            return {"success": False, "error": f"Định dạng đích không được hỗ trợ cho PDF: {target_fmt}"}

    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi PDF: {str(e)}"}


def _pdf_to_docx(input_path: str, output_path: str, output_filename: str) -> dict:
    """Convert PDF to DOCX with formatting preservation using pdf2docx."""
    try:
        from pdf2docx import Converter

        cv = Converter(input_path)
        cv.convert(output_path, start=0, end=None)
        cv.close()

        if os.path.exists(output_path):
            return {"success": True, "output_path": output_path, "filename": output_filename}
        return {"success": False, "error": "Tệp DOCX không được tạo thành công"}

    except ImportError:
        return _pdf_to_docx_fallback(input_path, output_path, output_filename, "Thư viện pdf2docx chưa cài đặt")
    except Exception as e:
        # Fallback to basic text extraction via PyMuPDF if pdf2docx fails
        return _pdf_to_docx_fallback(input_path, output_path, output_filename, str(e))


def _pdf_to_docx_fallback(input_path: str, output_path: str, output_filename: str, original_error: str) -> dict:
    """Fallback: Basic PDF to DOCX conversion using PyMuPDF + python-docx."""
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
        from docx import Document

        doc = pymupdf.open(input_path)
        text_content = []
        for page in doc:
            t = page.get_text()
            if t.strip():
                text_content.append(t)
        doc.close()

        if not text_content:
            return {"success": False, "error": f"Không thể trích xuất văn bản từ PDF (lỗi gốc: {original_error})"}

        out_doc = Document()
        for page_text in text_content:
            for para in page_text.split('\n'):
                if para.strip():
                    out_doc.add_paragraph(para)
            out_doc.add_page_break()

        out_doc.save(output_path)
        return {
            "success": True,
            "output_path": output_path,
            "filename": output_filename,
            "note": "Đã sử dụng bộ trích xuất văn bản cơ bản (định dạng layout có thể bị giản lược)"
        }
    except Exception as e:
        return {"success": False, "error": f"Lỗi trích xuất DOCX: {str(e)}"}


def _pdf_to_txt(input_path: str, output_path: str, output_filename: str) -> dict:
    """Extract text from PDF using PyMuPDF."""
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
    except ImportError:
        return {"success": False, "error": "Thư viện PyMuPDF chưa được cài đặt. Vui lòng chạy 'pip install PyMuPDF'"}

    try:
        doc = pymupdf.open(input_path)
        text_content = []
        for i, page in enumerate(doc):
            page_text = page.get_text()
            if page_text.strip():
                text_content.append(f"--- Trang {i + 1} ---\n{page_text}\n")
        doc.close()

        if not text_content:
            return {"success": False, "error": "Không thể trích xuất văn bản từ PDF (tài liệu có thể là ảnh quét)"}

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(text_content))

        return {"success": True, "output_path": output_path, "filename": output_filename}
    except Exception as e:
        return {"success": False, "error": f"Lỗi trích xuất văn bản: {str(e)}"}


def _pdf_to_html(input_path: str, output_path: str, output_filename: str, name: str) -> dict:
    """Convert PDF to HTML using PyMuPDF."""
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
    except ImportError:
        return {"success": False, "error": "Thư viện PyMuPDF chưa được cài đặt"}

    try:
        doc = pymupdf.open(input_path)
        html_pages = []
        for i, page in enumerate(doc):
            html_pages.append(f"<section class='pdf-page' style='margin-bottom:2.5rem;'><h3>Trang {i + 1}</h3>\n{page.get_text('html')}</section>")
        doc.close()

        full_html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #1f2937;
        }}
        h1 {{ border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }}
        .pdf-page {{ border-bottom: 1px dashed #d1d5db; padding-bottom: 2rem; }}
    </style>
</head>
<body>
    <h1>{name}</h1>
    {''.join(html_pages)}
</body>
</html>"""

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(full_html)

        return {"success": True, "output_path": output_path, "filename": output_filename}
    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi HTML: {str(e)}"}


def _pdf_to_md(input_path: str, output_path: str, output_filename: str, name: str) -> dict:
    """Convert PDF to Markdown using PyMuPDF."""
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
    except ImportError:
        return {"success": False, "error": "Thư viện PyMuPDF chưa được cài đặt"}

    try:
        doc = pymupdf.open(input_path)
        md_content = [f"# {name}\n"]
        for i, page in enumerate(doc):
            t = page.get_text()
            if t.strip():
                md_content.append(f"## Trang {i + 1}\n\n{t}\n")
        doc.close()

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(md_content))

        return {"success": True, "output_path": output_path, "filename": output_filename}
    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi Markdown: {str(e)}"}


def _pdf_to_rtf(input_path: str, output_path: str, output_filename: str) -> dict:
    """Convert PDF to RTF using PyMuPDF."""
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
    except ImportError:
        return {"success": False, "error": "Thư viện PyMuPDF chưa được cài đặt"}

    try:
        doc = pymupdf.open(input_path)
        rtf_content = "{\\rtf1\\ansi\\deff0\n"
        for page in doc:
            for para in page.get_text().split('\n'):
                if para.strip():
                    escaped = para.encode('unicode_escape').decode('ascii')
                    rtf_content += f"\\par {escaped}\n"
        doc.close()
        rtf_content += "}"

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(rtf_content)

        return {"success": True, "output_path": output_path, "filename": output_filename}
    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi RTF: {str(e)}"}


def _pdf_to_images(input_path: str, output_dir: str, target_format: str, name: str) -> dict:
    """Convert PDF pages to images using PyMuPDF. Auto-bundles multi-page into ZIP archive."""
    try:
        try:
            import pymupdf
        except ImportError:
            import fitz as pymupdf
    except ImportError:
        return {"success": False, "error": "Thư viện PyMuPDF chưa được cài đặt. Vui lòng chạy 'pip install PyMuPDF'"}

    try:
        pdf_doc = pymupdf.open(input_path)
        total_pages = len(pdf_doc)
        if total_pages == 0:
            pdf_doc.close()
            return {"success": False, "error": "Tài liệu PDF không có trang nào"}

        target_fmt = target_format.lower().lstrip('.')
        output_files = []

        for page_num in range(total_pages):
            page = pdf_doc[page_num]
            # 2x zoom for sharp 144 DPI resolution
            mat = pymupdf.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)

            img_filename = f"{name}_trang_{page_num + 1:02d}.{target_fmt}"
            img_path = os.path.join(output_dir, img_filename)

            if target_fmt in ['jpg', 'jpeg']:
                pix.save(img_path, output="jpeg", jpg_quality=95)
            elif target_fmt == 'webp':
                from PIL import Image
                mode = "RGB" if pix.n < 4 else "RGBA"
                pil_img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
                pil_img.save(img_path, 'WEBP', quality=95)
            else:
                pix.save(img_path)

            output_files.append(img_filename)

        pdf_doc.close()

        if not output_files:
            return {"success": False, "error": "Không thể kết xuất trang PDF thành ảnh"}

        # Single page: return image directly
        if len(output_files) == 1:
            single_path = os.path.join(output_dir, output_files[0])
            return {
                "success": True,
                "output_path": single_path,
                "filename": output_files[0],
                "all_files": output_files
            }

        # Multi-page (>= 2): automatically bundle all page images into ZIP
        zip_filename = f"{name}_{target_fmt}.zip"
        zip_path = os.path.join(output_dir, zip_filename)
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            for f in output_files:
                f_path = os.path.join(output_dir, f)
                zf.write(f_path, arcname=f)

        return {
            "success": True,
            "output_path": zip_path,
            "filename": zip_filename,
            "all_files": output_files,
            "is_zip": True,
            "note": f"Đã xuất toàn bộ {len(output_files)} trang và đóng gói vào tệp zip"
        }

    except Exception as e:
        return {"success": False, "error": f"Lỗi kết xuất ảnh từ PDF: {str(e)}"}
