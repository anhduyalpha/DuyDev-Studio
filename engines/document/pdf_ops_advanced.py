"""
DD Studio - Advanced PyMuPDF Operations
Rotate, Images-to-PDF, Watermark, Image Extraction, Lock/Unlock
"""

import os
import sys
import json

try:
    import pymupdf as fitz
except ImportError:
    import fitz


def emit_progress(percentage: int, stage: str):
    msg = json.dumps({"progress": percentage, "stage": stage})
    print(msg, flush=True)


def parse_page_range(page_spec: str, total_pages: int):
    selected = []
    for part in page_spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            s, e = part.split("-", 1)
            selected.extend(range(max(1, int(s)) - 1, min(total_pages, int(e))))
        else:
            p = int(part)
            if 1 <= p <= total_pages:
                selected.append(p - 1)
    return sorted(list(set(selected)))


def cmd_rotate(args):
    emit_progress(10, "Opening PDF document for rotation")
    doc = fitz.open(args.input)
    total = len(doc)

    rotations_json = getattr(args, "rotations_json", None)
    if rotations_json:
        try:
            rot_map = json.loads(rotations_json)
        except Exception:
            rot_map = {}
        for idx, (p_str, rot_deg) in enumerate(rot_map.items()):
            p_no = int(p_str)
            if 0 <= p_no < total:
                deg = int(rot_deg) % 360
                page = doc[p_no]
                page.set_rotation((page.rotation + deg) % 360)
            pct = 15 + int((idx + 1) / max(1, len(rot_map)) * 70)
            emit_progress(pct, f"Rotating page {p_no + 1}/{total} by {rot_deg}°")
    else:
        angle = int(args.angle or 90) % 360
        target_pages = parse_page_range(args.pages, total) if args.pages else list(range(total))

        for idx, p_no in enumerate(target_pages):
            pct = 15 + int((idx + 1) / max(1, len(target_pages)) * 70)
            emit_progress(pct, f"Rotating page {p_no + 1}/{total} by {angle}°")
            page = doc[p_no]
            page.set_rotation((page.rotation + angle) % 360)

    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        doc.set_metadata({})

    emit_progress(90, "Writing rotated document to disk")
    doc.save(args.output, garbage=3, deflate=True)
    doc.close()
    emit_progress(100, "PDF rotation completed successfully")


def cmd_images_to_pdf(args):
    emit_progress(10, "Initializing PDF document from images")
    pdf_doc = fitz.open()
    total = len(args.inputs)

    # Standard A4 portrait: 595 x 842 points
    PAGE_W, PAGE_H = 595.0, 842.0
    margin = 20.0
    max_w = PAGE_W - 2.0 * margin
    max_h = PAGE_H - 2.0 * margin

    for idx, img_path in enumerate(args.inputs):
        pct = 15 + int((idx + 1) / total * 70)
        emit_progress(pct, f"Processing image {idx + 1}/{total}: {os.path.basename(img_path)}")

        try:
            img = fitz.open(img_path)
            rect = img[0].rect
            img_w, img_h = rect.width, rect.height
            img.close()
        except Exception:
            img_w, img_h = max_w, max_h

        if img_w <= 0 or img_h <= 0:
            fit_w, fit_h = max_w, max_h
        else:
            scale = min(max_w / img_w, max_h / img_h)
            fit_w = img_w * scale
            fit_h = img_h * scale

        x = (PAGE_W - fit_w) / 2.0
        y = (PAGE_H - fit_h) / 2.0
        target_rect = fitz.Rect(x, y, x + fit_w, y + fit_h)

        page = pdf_doc.new_page(width=PAGE_W, height=PAGE_H)
        page.insert_image(target_rect, filename=img_path)

    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        pdf_doc.set_metadata({})

    emit_progress(90, "Persisting generated PDF document")
    pdf_doc.save(args.output, garbage=4, deflate=True, deflate_images=True)
    pdf_doc.close()
    emit_progress(100, "Images converted to PDF successfully")


def cmd_watermark(args):
    emit_progress(10, "Opening PDF for watermarking / numbering")
    doc = fitz.open(args.input)
    total = len(doc)
    text = args.text or ""
    pos = (getattr(args, "position", "center") or "center").strip().lower()
    raw_opacity = getattr(args, "opacity", 0.3)
    try:
        opacity = float(raw_opacity if raw_opacity is not None else 0.3)
    except (ValueError, TypeError):
        opacity = 0.3
    opacity = max(0.0, min(1.0, opacity))
    add_numbers = getattr(args, "page_numbers", False)

    for idx, page in enumerate(doc):
        pct = 15 + int((idx + 1) / total * 75)
        emit_progress(pct, f"Watermarking page {idx + 1}/{total}")
        rect = page.rect

        if text:
            shape = page.new_shape()
            if pos == "top":
                font_size = 20
                text_len = fitz.get_text_length(text, fontsize=font_size)
                pt = fitz.Point(max(20.0, (rect.width - text_len) / 2.0), 50.0)
                shape.insert_text(
                    pt,
                    text,
                    fontsize=font_size,
                    color=(0.5, 0.5, 0.5),
                    fill_opacity=opacity,
                    stroke_opacity=opacity,
                )
            elif pos == "bottom":
                font_size = 20
                text_len = fitz.get_text_length(text, fontsize=font_size)
                pt = fitz.Point(max(20.0, (rect.width - text_len) / 2.0), rect.height - 45.0)
                shape.insert_text(
                    pt,
                    text,
                    fontsize=font_size,
                    color=(0.5, 0.5, 0.5),
                    fill_opacity=opacity,
                    stroke_opacity=opacity,
                )
            else:  # diagonal center
                font_size = 36
                text_len = fitz.get_text_length(text, fontsize=font_size)
                center = fitz.Point(rect.width / 2.0, rect.height / 2.0)
                pt = fitz.Point(center.x - text_len / 2.0, center.y)
                shape.insert_text(
                    pt,
                    text,
                    fontsize=font_size,
                    color=(0.5, 0.5, 0.5),
                    morph=(center, fitz.Matrix(45)),
                    fill_opacity=opacity,
                    stroke_opacity=opacity,
                )
            shape.commit()

        if add_numbers:
            shape_num = page.new_shape()
            num_str = f"Trang {idx + 1} / {total}"
            num_len = fitz.get_text_length(num_str, fontsize=10)
            num_pt = fitz.Point(max(20.0, (rect.width - num_len) / 2.0), rect.height - 20.0)
            shape_num.insert_text(
                num_pt,
                num_str,
                fontsize=10,
                color=(0.4, 0.4, 0.4),
                fill_opacity=0.8,
                stroke_opacity=0.8,
            )
            shape_num.commit()

    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        doc.set_metadata({})

    emit_progress(90, "Saving watermarked document")
    doc.save(args.output, garbage=3, deflate=True)
    doc.close()
    emit_progress(100, "Watermark processing completed")


def cmd_extract_images(args):
    emit_progress(10, "Scanning PDF document for embedded images")
    doc = fitz.open(args.input)
    total = len(doc)
    out_dir = args.output_dir
    os.makedirs(out_dir, exist_ok=True)
    extracted_count = 0

    for idx, page in enumerate(doc):
        pct = 15 + int((idx + 1) / total * 70)
        emit_progress(pct, f"Extracting images from page {idx + 1}/{total}")
        img_list = page.get_images(full=True)

        for img_info in img_list:
            xref = img_info[0]
            base_img = doc.extract_image(xref)
            if base_img:
                extracted_count += 1
                img_bytes = base_img["image"]
                img_ext = base_img["ext"]
                out_name = f"image_{extracted_count:03d}.{img_ext}"
                out_path = os.path.join(out_dir, out_name)
                with open(out_path, "wb") as f:
                    f.write(img_bytes)

    doc.close()
    emit_progress(100, f"Extracted {extracted_count} images successfully")


def cmd_lock(args):
    emit_progress(10, "Encrypting PDF with AES-256")
    doc = fitz.open(args.input)
    if getattr(args, "strip_metadata", False):
        emit_progress(30, "Sanitizing metadata headers")
        doc.set_metadata({})
    pw = args.password or "123456"
    doc.save(
        args.output,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        user_pw=pw,
        owner_pw=pw,
        permissions=fitz.PDF_PERM_PRINT | fitz.PDF_PERM_ACCESSIBILITY
    )
    doc.close()
    emit_progress(100, "PDF encryption completed")


def cmd_unlock(args):
    emit_progress(10, "Authenticating and decrypting PDF")
    doc = fitz.open(args.input)
    pw = args.password or ""
    if doc.is_encrypted:
        if not pw:
            raise ValueError("Password required: Tài liệu được mã hóa, cần mật khẩu để mở khóa")
        rc = doc.authenticate(pw)
        if rc == 0:
            raise ValueError("Password incorrect: Mật khẩu không chính xác hoặc không đủ quyền mở khóa")
    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        doc.set_metadata({})
    doc.save(args.output, garbage=3, deflate=True)
    doc.close()
    emit_progress(100, "PDF decryption completed")


def cmd_organize(args):
    emit_progress(10, "Opening PDF document for page organization")
    doc = fitz.open(args.input)
    total = len(doc)

    pages_input = getattr(args, "pages", None) or getattr(args, "order", None)
    if pages_input:
        if isinstance(pages_input, str) and pages_input.strip().startswith("["):
            try:
                target_pages = json.loads(pages_input)
            except Exception:
                target_pages = list(range(total))
        elif isinstance(pages_input, str):
            target_pages = [int(p.strip()) - 1 for p in pages_input.split(",") if p.strip()]
        else:
            target_pages = list(pages_input)
    else:
        target_pages = list(range(total))

    valid_pages = [int(p) for p in target_pages if 0 <= int(p) < total]
    if not valid_pages:
        raise ValueError("Danh sách trang không hợp lệ hoặc rỗng")

    # Apply rotations to original page indices before selecting/reordering
    rotations_json = getattr(args, "rotations", None) or getattr(args, "rotations_json", None)
    if rotations_json:
        try:
            rot_map = json.loads(rotations_json) if isinstance(rotations_json, str) else rotations_json
        except Exception:
            rot_map = {}
        for idx_str, rot_deg in rot_map.items():
            try:
                page_idx = int(idx_str)
                if 0 <= page_idx < total:
                    deg = int(rot_deg) % 360
                    doc[page_idx].set_rotation((doc[page_idx].rotation + deg) % 360)
            except Exception:
                pass

    emit_progress(30, f"Selecting and reordering {len(valid_pages)} pages")
    doc.select(valid_pages)

    if getattr(args, "strip_metadata", False):
        emit_progress(85, "Sanitizing metadata headers")
        doc.set_metadata({})

    emit_progress(90, "Writing organized document to disk")
    doc.save(args.output, garbage=3, deflate=True)
    doc.close()
    emit_progress(100, f"PDF page organization completed ({len(valid_pages)} pages)")


def cmd_pdf_to_docx(args):
    emit_progress(10, "Initializing PDF to DOCX converter engine")
    try:
        from pdf2docx import Converter
    except ImportError:
        raise ImportError("Thư viện pdf2docx chưa được cài đặt trong môi trường Python")

    input_path = args.input
    output_path = args.output
    pages_spec = getattr(args, "pages", None)

    start_page = 0
    end_page = None

    if pages_spec and str(pages_spec).strip():
        spec = str(pages_spec).strip()
        if "-" in spec:
            parts = spec.split("-", 1)
            start_page = max(0, int(parts[0].strip()) - 1)
            end_page = int(parts[1].strip())
        elif ":" in spec:
            parts = spec.split(":", 1)
            start_page = max(0, int(parts[0].strip()))
            end_page = int(parts[1].strip()) if parts[1].strip() else None

    curr_dir = os.path.dirname(os.path.abspath(__file__))
    if curr_dir not in sys.path:
        sys.path.insert(0, curr_dir)

    # Step 1: Structural diagnostics battery
    emit_progress(20, "Running structural diagnostic battery (PyMuPDF)")
    diagnostics = None
    try:
        from pdf_diagnostics import run_pdf_diagnostics
        diagnostics = run_pdf_diagnostics(input_path)
    except Exception as e:
        emit_progress(22, f"Diagnostic notice: {e}")

    # Step 2: AI Decision Router layout strategy
    emit_progress(35, "Consulting AI Decision Router for layout strategy")
    parse_stream_table = getattr(args, "stream_table", False)
    parse_lattice_table = True
    sanitizer_rules = {
        "unpack_collapsed_list_tables": True,
        "normalize_question_paragraphs": True,
        "clean_header_footer_tables": True,
        "restore_scientific_exponents": True,
        "preserve_true_grid_tables": True
    }

    try:
        from ai_layout_advisor import analyze_pdf_layout_strategy
        strategy = analyze_pdf_layout_strategy(input_path, diagnostics=diagnostics)
        if not getattr(args, "force_stream_table", False):
            parse_stream_table = strategy.get("parse_stream_table", False)
        parse_lattice_table = strategy.get("parse_lattice_table", True)
        sanitizer_rules = strategy.get("sanitizer_rules", sanitizer_rules)
        doc_type = strategy.get("document_type", "document")
        emit_progress(45, f"Optimized strategy: {doc_type}")
    except Exception:
        parse_stream_table = False
        emit_progress(45, "Using standard safe layout strategy")

    # Step 3: Raw DOCX generation via pdf2docx
    temp_raw_path = f"{output_path}.raw.tmp.docx"
    emit_progress(55, "Parsing layout and extracting tables & typography")
    try:
        cv = Converter(input_path)
        emit_progress(70, "Generating editable Word document (.docx)")
        cv.convert(
            temp_raw_path,
            start=start_page,
            end=end_page,
            parse_stream_table=parse_stream_table,
            parse_lattice_table=parse_lattice_table
        )
        cv.close()

        # Step 4: Post-conversion DOCX structural sanitizer
        emit_progress(85, "Sanitizing document structure and restoring exponents")
        try:
            from docx_structural_sanitizer import sanitize_docx
            sanitize_docx(temp_raw_path, output_path, sanitizer_rules)
        except Exception as san_err:
            if os.path.exists(temp_raw_path):
                import shutil
                shutil.copyfile(temp_raw_path, output_path)
    finally:
        if os.path.exists(temp_raw_path):
            try:
                os.remove(temp_raw_path)
            except Exception:
                pass

    emit_progress(100, "PDF to Word conversion completed successfully")


