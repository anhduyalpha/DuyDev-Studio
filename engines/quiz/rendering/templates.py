"""
HTML Document Templates for Quiz Worksheet (DeBai) and Answer Key (DapAn).
Produces deterministic, valid, production-grade HTML5 markup with embedded KaTeX equations,
W3C Paged Media styling, and zero arbitrary AI generation.
"""

from __future__ import annotations

import html
import os
import re
from typing import Any
from engines.quiz.ir.models import CanonicalDocumentIR, SectionType, QuestionIR, AnswerKeyIR
from engines.quiz.rendering.styles import StylePreset, style_registry
from engines.quiz.rendering.layout import LayoutSolver


def _normalize_img_src(path: str) -> str:
    """Normalize filesystem path to renderer-safe base64 data URL or compliant file URL for Chrome headless."""
    if not path:
        return ""
    if path.startswith("data:") or path.startswith("http"):
        return path

    fs_path = path
    if fs_path.startswith("file:///"):
        fs_path = fs_path[8:]
    elif fs_path.startswith("file://"):
        fs_path = fs_path[7:]

    # Priority 1: Self-contained base64 data URL (immune to Chrome sandbox, file:// blocks, and path spaces)
    if os.path.isfile(fs_path):
        try:
            import base64
            with open(fs_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            ext = os.path.splitext(fs_path)[1].lower().lstrip(".")
            mime = "image/png" if ext == "png" else ("image/jpeg" if ext in ("jpg", "jpeg") else "image/png")
            return f"data:{mime};base64,{b64}"
        except Exception:
            pass

    # Priority 2: Safely escaped file:// URL
    if os.path.isabs(path):
        from urllib.parse import quote
        normalized = path.replace(os.sep, "/")
        drive, rest = os.path.splitdrive(normalized)
        quoted_rest = quote(rest)
        return f"file:///{drive}{quoted_rest}" if drive else f"file://{quoted_rest}"
    return path


def _render_quick_answer_matrix(doc_ir: CanonicalDocumentIR, preset: StylePreset | None = None) -> str:
    """Generate compact tabular matrix for rapid grading and student self-check."""
    active_preset = preset or style_registry.get("answer_green")
    part1_answers = [a for a in doc_ir.answers if a.type == SectionType.PART_I_MCQ]
    part2_answers = [a for a in doc_ir.answers if a.type == SectionType.PART_II_TF]
    part3_answers = [a for a in doc_ir.answers if a.type == SectionType.PART_III_SHORT]

    matrix_blocks: list[str] = []

    # Part I Quick Matrix (Chunks of up to 10 questions per table)
    if part1_answers:
        part1_tables: list[str] = []
        chunk_size = 10
        for i in range(0, len(part1_answers), chunk_size):
            chunk = part1_answers[i : i + chunk_size]
            th_cells = "".join(f"<th>{a.question_number}</th>" for a in chunk)
            td_cells = "".join(f'<td class="correct-val">{html.escape(a.selected_answer or "-")}</td>' for a in chunk)

            part1_tables.append(
                f"""
        <table class="quick-matrix-table">
          <thead>
            <tr><th class="matrix-label-th">Câu</th>{th_cells}</tr>
          </thead>
          <tbody>
            <tr><th class="matrix-label-th">Đ/A</th>{td_cells}</tr>
          </tbody>
        </table>"""
            )

        matrix_blocks.append(
            f"""
      <div style="margin-bottom: 8pt;">
        <div style="font-weight: bold; font-size: 9pt; color: {active_preset.primary_color}; margin-bottom: 2pt;">
          1. Bảng đáp án trắc nghiệm Phần I
        </div>
        {"".join(part1_tables)}
      </div>"""
        )

    # Part II True/False Matrix
    if part2_answers:
        rows: list[str] = []
        for a in part2_answers:
            if a.sub_answers:
                items = []
                for label in ["a", "b", "c", "d"]:
                    val = a.sub_answers.get(label)
                    val_str = "Đ" if val is True else ("S" if val is False else "-")
                    items.append(f"<strong>{label}</strong>: {val_str}")
                formatted = " &nbsp;|&nbsp; ".join(items)
            else:
                formatted = html.escape(a.selected_answer or "-")
            rows.append(
                f"""<tr><th class="matrix-label-th" style="width: 60pt;">Câu {a.question_number}</th><td style="text-align: left; padding-left: 10pt;">{formatted}</td></tr>"""
            )

        matrix_blocks.append(
            f"""
      <div style="margin-bottom: 8pt;">
        <div style="font-weight: bold; font-size: 9pt; color: {active_preset.primary_color}; margin-bottom: 2pt;">
          2. Bảng đáp án Đúng / Sai Phần II
        </div>
        <table class="quick-matrix-table" style="max-width: 400pt;">
          <tbody>{"".join(rows)}</tbody>
        </table>
      </div>"""
        )

    # Part III Short Answers
    if part3_answers:
        rows = []
        for a in part3_answers:
            val = a.short_answer_value or a.selected_answer or "-"
            rows.append(f"""<tr><th class="matrix-label-th" style="width: 60pt;">Câu {a.question_number}</th><td class="correct-val" style="text-align: left; padding-left: 10pt;">{html.escape(val)}</td></tr>""")

        matrix_blocks.append(
            f"""
      <div style="margin-bottom: 8pt;">
        <div style="font-weight: bold; font-size: 9pt; color: {active_preset.primary_color}; margin-bottom: 2pt;">
          3. Bảng đáp án Điền ngắn Phần III
        </div>
        <table class="quick-matrix-table" style="max-width: 300pt;">
          <tbody>{"".join(rows)}</tbody>
        </table>
      </div>"""
        )

    return f"""
  <div class="quick-matrix-container">
    <div class="section-banner">I. BẢNG ĐÁP ÁN NHANH</div>
    {"".join(matrix_blocks)}
  </div>"""


def render_worksheet_document(
    doc_ir: CanonicalDocumentIR,
    preset: StylePreset,
    katex_css_rel: str = "./katex/katex.min.css",
    katex_js_rel: str = "./katex/katex.min.js",
    katex_auto_render_rel: str = "./katex/contrib/auto-render.min.js",
    force_break_ids: set[str] | None = None,
    rendered_measurements: dict[str, dict[str, Any]] | None = None,
) -> str:
    """Generate self-contained HTML worksheet document for `{prefix}_DeBai.pdf`."""
    meta = doc_ir.metadata
    css_content = LayoutSolver.generate_paged_media_css(preset, meta.title)

    # Compute proactive atomic pagination plan (PLAN-02 / TASK-03)
    if force_break_ids is not None and rendered_measurements is None:
        planned_breaks = set(force_break_ids)
    else:
        planned_breaks = LayoutSolver.plan_atomic_pagination(
            doc_ir=doc_ir,
            preset=preset,
            force_break_ids=force_break_ids,
            rendered_measurements=rendered_measurements,
        )

    # Header block
    # Optional Exam Duration (PLAN Section 3)
    formatted_duration = ""
    if getattr(meta, "duration", None) and meta.duration.strip():
        raw_dur = meta.duration.strip()
        formatted_duration = f"{raw_dur} phút" if raw_dur.isdigit() else raw_dur
    elif getattr(meta, "duration_minutes", None):
        formatted_duration = f"{meta.duration_minutes} phút"

    meta_items: list[str] = []
    if meta.subject:
        subj_str = f"Môn học: <strong>{html.escape(meta.subject)}</strong>"
        if meta.grade:
            subj_str += f" - Lớp {html.escape(str(meta.grade))}"
        meta_items.append(f"<span>{subj_str}</span>")
    elif meta.grade:
        meta_items.append(f"<span>Lớp: <strong>{html.escape(str(meta.grade))}</strong></span>")

    if meta.exam_code:
        meta_items.append(f"<span><strong>Mã đề: {html.escape(meta.exam_code)}</strong></span>")

    if formatted_duration:
        meta_items.append(f"<span>Thời gian làm bài: {html.escape(formatted_duration)}</span>")

    meta_line_html = ""
    if meta_items:
        meta_line_html = f"""
    <div class="exam-header-meta" style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 4pt 14pt; font-size: 9pt; color: {preset.text_color};">
      {" ".join(meta_items)}
    </div>"""

    header_html = f"""
  <header class="exam-header" style="text-align: center;">
    <div class="exam-header-title" style="font-family: {preset.font_family_heading}; font-size: 15pt; font-weight: bold; text-transform: uppercase; text-align: center; color: {preset.primary_color}; letter-spacing: 0.3pt; line-height: 1.35; margin-bottom: 4pt; word-wrap: break-word; overflow-wrap: break-word;">
      {html.escape(meta.title)}
    </div>{meta_line_html}
  </header>"""

    # Group questions by section
    sections_html: list[str] = []
    
    # If sections are explicitly provided in IR
    if doc_ir.sections:
        q_map = {q.id: q for q in doc_ir.questions}
        for sec in doc_ir.sections:
            sec_questions = [q_map[qid] for qid in sec.question_ids if qid in q_map]
            if not sec_questions:
                continue

            sec_banner = f"""
    <div class="section-banner">
      <span>{html.escape(sec.title)}</span>
      <span style="font-size: 10.0pt; font-weight: normal; opacity: 0.95;">({len(sec_questions)} câu)</span>
    </div>"""

            rendered_q_items: list[str] = []
            for q in sec_questions:
                break_before = (q.id in planned_breaks)
                split_options = (f"opt:{q.id}" in planned_breaks)
                rendered_q_items.append(_render_single_question(q, break_before=break_before, split_options=split_options))

            sections_html.append(f"""
  <section class="exam-section">
    {sec_banner}
    {"".join(rendered_q_items)}
  </section>""")
    else:
        # Fallback if no explicit sections defined: render all questions directly
        rendered_q_items = [
            _render_single_question(
                q,
                break_before=(q.id in planned_breaks),
                split_options=(f"opt:{q.id}" in planned_breaks)
            )
            for q in doc_ir.questions
        ]
        sections_html.append(f"""
  <section class="exam-section">
    <div class="section-banner">CÂU HỎI TRẮC NGHIỆM ({len(doc_ir.questions)} CÂU)</div>
    {"".join(rendered_q_items)}
  </section>""")

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>{html.escape(meta.title)}</title>
  <link rel="stylesheet" href="{katex_css_rel}">
  <style>
{css_content}
  </style>
</head>
<body>
  {header_html}
  {"".join(sections_html)}
  <div class="exam-end-mark">--- HẾT ---</div>

  <script src="{katex_js_rel}"></script>
  <script src="{katex_auto_render_rel}"></script>
  <script>
    function renderMathSafely() {{
      if (typeof renderMathInElement === "function") {{
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: "$$", right: "$$", display: true}},
            {{left: "$", right: "$", display: false}},
            {{left: "\\\\(", right: "\\\\)", display: false}},
            {{left: "\\\\[", right: "\\\\]", display: true}}
          ],
          throwOnError: false,
          ignoredClasses: ["katex-ignore"]
        }});
      }}
    }}
    document.addEventListener("DOMContentLoaded", renderMathSafely);
    renderMathSafely();
  </script>
</body>
</html>"""


def _render_single_question(q: QuestionIR, break_before: bool = False, split_options: bool = False) -> str:
    """Render a single QuestionIR item with stem, crop images, and options."""
    break_class = " page-break-before" if break_before else ""
    split_class = " allow-controlled-split" if split_options else ""
    break_style = ' style="break-before: page; page-break-before: always;"' if break_before else ""

    opt_break_class = " page-break-before" if split_options else ""
    opt_break_style = ' style="break-before: page; page-break-before: always;"' if split_options else ""

    # Rich elements (crops)
    rich_html_items: list[str] = []
    for elem in q.rich_elements:
        if elem.source_crop_path:
            src_val = _normalize_img_src(elem.source_crop_path)
            caption_html = f'<div style="font-size: 8pt; color: #64748b; margin-top: 2pt;">{html.escape(elem.caption)}</div>' if elem.caption else ""
            rich_html_items.append(
                f"""
      <div class="q-rich-element">
        <img src="{html.escape(src_val)}" class="q-crop-img" alt="Hình minh họa Câu {q.number}" />
        {caption_html}
      </div>"""
            )
    rich_html = "".join(rich_html_items)

    # Option / statement layout
    if q.type == SectionType.PART_II_TF:
        # Part II True / False statements
        tf_items: list[str] = []
        for stmt in q.sub_statements:
            tf_items.append(
                f"""
      <div class="tf-statement-item">
        <span class="tf-letter">{html.escape(stmt.label)})</span>
        <span class="tf-text">{stmt.statement}</span>
      </div>"""
            )
        options_html = f"""
      <div class="tf-statements-container{opt_break_class}"{opt_break_style}>
        {"".join(tf_items)}
      </div>"""

    elif q.type == SectionType.PART_III_SHORT:
        # Part III Short answer blank
        options_html = f"""
      <div class="short-answer-line{opt_break_class}"{opt_break_style}>
        Trả lời: <span class="short-answer-box"></span>
      </div>"""

    else:
        # Standard Part I MCQ (4 choices)
        has_imgs = bool(q.rich_elements) or any(bool(getattr(opt, "image_path", None)) for opt in q.options)
        cols = LayoutSolver.determine_option_columns(q.options, has_images=has_imgs)
        opt_items: list[str] = []
        for opt in q.options:
            opt_img_html = ""
            if getattr(opt, "image_path", None) and os.path.isfile(opt.image_path):
                src_val = _normalize_img_src(opt.image_path)
                opt_img_html = f'<img src="{html.escape(src_val)}" class="opt-crop-img" alt="Phương án {html.escape(opt.label)}" />'

            opt_text_content = opt.text or ""
            separator = " " if (opt_img_html and opt_text_content.strip()) else ""
            opt_items.append(
                f"""
      <div class="opt-item">
        <span class="opt-letter">{html.escape(opt.label)}.</span>
        <span class="opt-text">{opt_img_html}{separator}{opt_text_content}</span>
      </div>"""
            )
        options_html = f"""
      <div class="options-grid opt-col-{cols}{opt_break_class}"{opt_break_style}>
        {"".join(opt_items)}
      </div>"""

    return f"""
    <article class="question-item{break_class}{split_class}"{break_style}>
      <div class="q-header">
        <span class="q-num">Câu {q.number}:</span>
        <span class="q-stem">{q.stem}</span>
      </div>
      {rich_html}
      {options_html}
    </article>"""


def render_answer_document(
    doc_ir: CanonicalDocumentIR,
    preset: StylePreset,
    katex_css_rel: str = "./katex/katex.min.css",
    katex_js_rel: str = "./katex/katex.min.js",
    katex_auto_render_rel: str = "./katex/contrib/auto-render.min.js",
) -> str:
    """Generate self-contained HTML answer key and solution document for `{prefix}_DapAn.pdf`."""
    meta = doc_ir.metadata
    css_content = LayoutSolver.generate_paged_media_css(preset, f"{meta.title} - ĐÁP ÁN", is_answer=True)

    ans_meta_items: list[str] = [
        f'<span style="background-color: {preset.accent_bg}; border: 0.5pt solid {preset.accent_border}; color: {preset.primary_color}; padding: 1.5pt 6pt; border-radius: 3pt; font-weight: bold;">ĐÁP ÁN CHÍNH THỨC</span>'
    ]
    if meta.subject:
        ans_meta_items.append(f'<span>Môn học: <strong style="color: {preset.text_color};">{html.escape(meta.subject)}</strong></span>')
    if meta.total_questions:
        ans_meta_items.append(f'<span>Số lượng: <strong style="color: {preset.text_color};">{meta.total_questions} câu</strong></span>')
    if meta.created_at:
        ans_meta_items.append(f'<span>Ngày lập: <strong style="color: {preset.text_color};">{html.escape(meta.created_at[:10])}</strong></span>')

    header_html = f"""
  <header class="exam-header" style="text-align: center;">
    <div style="font-family: {preset.font_family_heading}; font-weight: bold; font-size: 15pt; text-transform: uppercase; color: {preset.primary_color}; letter-spacing: 0.3pt; line-height: 1.35; margin-bottom: 4pt; word-wrap: break-word; overflow-wrap: break-word;">
      ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT
    </div>
    <div style="font-size: 10pt; font-weight: 600; color: {preset.secondary_color}; margin-top: 2pt; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.2pt;">
      {html.escape(meta.title)}
    </div>
    <div class="exam-header-meta" style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 4pt 12pt; font-size: 8.5pt; color: {preset.muted_color};">
      {" ".join(ans_meta_items)}
    </div>
  </header>"""

    # 1. Quick Answer Matrix
    matrix_html = _render_quick_answer_matrix(doc_ir, preset)

    # 2. Detailed Pedagogical Solutions
    ans_map: dict[str, AnswerKeyIR] = {a.question_id: a for a in doc_ir.answers}
    solution_items: list[str] = []

    for q in doc_ir.questions:
        ans = ans_map.get(q.id)
        if not ans:
            continue

        # Format selected answer badge
        if ans.type == SectionType.PART_II_TF and ans.sub_answers:
            sub_strs = [f"{lbl}-{('Đ' if v else 'S')}" for lbl, v in ans.sub_answers.items()]
            badge_text = ", ".join(sub_strs)
        elif ans.type == SectionType.PART_III_SHORT:
            badge_text = ans.short_answer_value or ans.selected_answer or "Đáp án điền"
        else:
            badge_text = f"Đáp án {ans.selected_answer}"

        # Crops in solution (if relevant)
        crop_html_items: list[str] = []
        for elem in q.rich_elements:
            if elem.source_crop_path:
                src_val = _normalize_img_src(elem.source_crop_path)
                crop_html_items.append(
                    f'<div style="margin: 4pt 0;"><img src="{html.escape(src_val)}" class="q-crop-img" style="max-height: 120pt;" alt="Hình Câu {q.number}" /></div>'
                )
        crops_html = "".join(crop_html_items)

        evidence_content = ans.evidence.strip() if ans.evidence else "Không có hướng dẫn giải."

        solution_items.append(
            f"""
    <article class="solution-item">
      <div class="sol-header">
        <span>Câu {q.number}:</span>
        <span class="sol-selected">{html.escape(badge_text)}</span>
      </div>
      <div class="sol-stem">
        <strong>Đề bài:</strong> {q.stem}
      </div>
      {crops_html}
      <div class="sol-evidence">
        <div class="sol-evidence-header">
          Phương pháp giải & Hướng dẫn:
        </div>
        <div>{evidence_content}</div>
      </div>
    </article>"""
        )

    solutions_html = f"""
  <div class="detailed-solutions-container">
    <div class="section-banner">II. HƯỚNG DẪN GIẢI CHI TIẾT</div>
    {"".join(solution_items)}
  </div>"""

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>{html.escape(meta.title)} - ĐÁP ÁN VÀ LỜI GIẢI</title>
  <link rel="stylesheet" href="{katex_css_rel}">
  <style>
{css_content}
  </style>
</head>
<body>
  {header_html}
  {matrix_html}
  {solutions_html}
  <div class="exam-end-mark">--- HẾT ---</div>

  <script src="{katex_js_rel}"></script>
  <script src="{katex_auto_render_rel}"></script>
  <script>
    function renderMathSafely() {{
      if (typeof renderMathInElement === "function") {{
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: "$$", right: "$$", display: true}},
            {{left: "$", right: "$", display: false}},
            {{left: "\\\\(", right: "\\\\)", display: false}},
            {{left: "\\\\[", right: "\\\\]", display: true}}
          ],
          throwOnError: false,
          ignoredClasses: ["katex-ignore"]
        }});
      }}
    }}
    document.addEventListener("DOMContentLoaded", renderMathSafely);
    renderMathSafely();
  </script>
</body>
</html>"""
