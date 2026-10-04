"""
HTML Document Templates for Quiz Worksheet (DeBai) and Answer Key (DapAn).
Produces deterministic, valid, production-grade HTML5 markup with embedded KaTeX equations,
W3C Paged Media styling, and zero arbitrary AI generation.
"""

import html
import os
from engines.quiz.ir.models import CanonicalDocumentIR, SectionType, QuestionIR, AnswerKeyIR
from engines.quiz.rendering.styles import StylePreset
from engines.quiz.rendering.layout import LayoutSolver


def _normalize_img_src(path: str) -> str:
    """Normalize filesystem path to compliant file URL for Chrome headless."""
    if not path:
        return ""
    if path.startswith("file://") or path.startswith("data:") or path.startswith("http"):
        return path
    if os.path.isabs(path):
        normalized = path.replace(os.sep, "/")
        return f"file:///{normalized}" if not normalized.startswith("/") else f"file://{normalized}"
    return path


def _render_quick_answer_matrix(doc_ir: CanonicalDocumentIR) -> str:
    """Generate compact tabular matrix for rapid grading and student self-check."""
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
            <tr><th>Câu</th>{th_cells}</tr>
          </thead>
          <tbody>
            <tr><th>Đ/A</th>{td_cells}</tr>
          </tbody>
        </table>"""
            )

        matrix_blocks.append(
            f"""
      <div style="margin-bottom: 8pt;">
        <div style="font-weight: bold; font-size: 9pt; color: #1e3a8a; margin-bottom: 2pt;">
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
                f"""<tr><th style="width: 60pt;">Câu {a.question_number}</th><td style="text-align: left; padding-left: 10pt;">{formatted}</td></tr>"""
            )

        matrix_blocks.append(
            f"""
      <div style="margin-bottom: 8pt;">
        <div style="font-weight: bold; font-size: 9pt; color: #1e3a8a; margin-bottom: 2pt;">
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
            rows.append(f"""<tr><th style="width: 60pt;">Câu {a.question_number}</th><td class="correct-val" style="text-align: left; padding-left: 10pt;">{html.escape(val)}</td></tr>""")

        matrix_blocks.append(
            f"""
      <div style="margin-bottom: 8pt;">
        <div style="font-weight: bold; font-size: 9pt; color: #1e3a8a; margin-bottom: 2pt;">
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
) -> str:
    """Generate self-contained HTML worksheet document for `{prefix}_DeBai.pdf`."""
    meta = doc_ir.metadata
    css_content = LayoutSolver.generate_paged_media_css(preset, meta.title)

    # Compute proactive atomic pagination plan (PLAN-02 / TASK-03)
    planned_breaks = LayoutSolver.plan_atomic_pagination(
        doc_ir=doc_ir,
        preset=preset,
        force_break_ids=force_break_ids
    )

    # Header block
    grade_str = f" - Lớp {meta.grade}" if meta.grade else ""
    exam_code_str = f'<div style="font-weight: bold;">Mã đề: {meta.exam_code}</div>' if meta.exam_code else ""
    duration_str = f"{meta.duration_minutes} phút" if meta.duration_minutes else "45-50 phút"

    header_html = f"""
  <header class="exam-header">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-weight: bold; font-size: 11.5pt; text-transform: uppercase; color: {preset.primary_color};">
          {html.escape(meta.title)}
        </div>
        <div style="font-size: 9.5pt; color: {preset.text_color}; margin-top: 2pt;">
          Môn học: <strong>{html.escape(meta.subject)}</strong>{html.escape(grade_str)}
        </div>
      </div>
      <div style="text-align: right; font-size: 8.5pt; color: {preset.muted_color};">
        {exam_code_str}
        <div>Thời gian làm bài: {duration_str}</div>
        <div>Tổng số câu hỏi: {meta.total_questions} câu</div>
      </div>
    </div>
  </header>"""

    student_box_html = ""
    if preset.show_student_info:
        student_box_html = """
  <div class="student-info-box">
    <div style="display: flex; justify-content: space-between;">
      <span>Họ và tên thí sinh: ............................................................................</span>
      <span>Lớp: .................... Số báo danh: ....................</span>
    </div>
  </div>"""

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
      <span style="font-size: 8.5pt; font-weight: normal;">({len(sec_questions)} câu)</span>
    </div>"""

            inst_html = f'<div class="section-instruction">{html.escape(sec.instruction)}</div>' if sec.instruction else ""

            rendered_q_items: list[str] = []
            for q in sec_questions:
                break_before = (q.id in planned_breaks)
                rendered_q_items.append(_render_single_question(q, break_before=break_before))

            sections_html.append(f"""
  <section class="exam-section">
    {sec_banner}
    {inst_html}
    {"".join(rendered_q_items)}
  </section>""")
    else:
        # Fallback if no explicit sections defined: render all questions directly
        rendered_q_items = [
            _render_single_question(q, break_before=(q.id in planned_breaks))
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
  {student_box_html}
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


def _render_single_question(q: QuestionIR, break_before: bool = False) -> str:
    """Render a single QuestionIR item with stem, crop images, and options."""
    break_class = " page-break-before" if break_before else ""
    break_style = ' style="break-before: page; page-break-before: always;"' if break_before else ""

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
        options_html = "".join(tf_items)

    elif q.type == SectionType.PART_III_SHORT:
        # Part III Short answer blank
        options_html = """
      <div class="short-answer-line">
        Trả lời: <span class="short-answer-box"></span>
      </div>"""

    else:
        # Standard Part I MCQ (4 choices)
        has_imgs = bool(q.rich_elements)
        cols = LayoutSolver.determine_option_columns(q.options, has_images=has_imgs)
        opt_items: list[str] = []
        for opt in q.options:
            opt_items.append(
                f"""
      <div class="opt-item">
        <span class="opt-letter">{html.escape(opt.label)}.</span>
        <span class="opt-text">{opt.text}</span>
      </div>"""
            )
        options_html = f"""
      <div class="options-grid opt-col-{cols}">
        {"".join(opt_items)}
      </div>"""

    return f"""
    <article class="question-item{break_class}"{break_style}>
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
    css_content = LayoutSolver.generate_paged_media_css(preset, f"{meta.title} - ĐÁP ÁN")

    header_html = f"""
  <header class="exam-header" style="text-align: center;">
    <div style="font-weight: bold; font-size: 13pt; text-transform: uppercase; color: {preset.primary_color};">
      ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT
    </div>
    <div style="font-size: 9.5pt; color: {preset.text_color}; margin-top: 3pt;">
      {html.escape(meta.title)} &nbsp;|&nbsp; Môn: <strong>{html.escape(meta.subject)}</strong>
    </div>
    <div style="font-size: 8.5pt; color: {preset.muted_color}; margin-top: 2pt;">
      Tổng số: {meta.total_questions} câu &nbsp;|&nbsp; Ngày biên soạn: {meta.created_at[:10]}
    </div>
  </header>"""

    # 1. Quick Answer Matrix
    matrix_html = _render_quick_answer_matrix(doc_ir)

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
      <div style="font-size: 9pt; color: #475569; margin-top: 2pt;">
        <strong>Đề bài:</strong> {q.stem}
      </div>
      {crops_html}
      <div class="sol-evidence">
        <div style="font-weight: bold; font-size: 8.5pt; color: {preset.primary_color}; margin-bottom: 2pt;">
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
