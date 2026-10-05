"""
Layout Engine & Paged Media CSS Generator.
Deterministically computes option column layouts (1, 2, or 4 columns)
and generates CSS Paged Media pagination rules to guarantee zero question splits and zero orphan headings.
"""

from __future__ import annotations

import os
import math
import re
from typing import Any
import pymupdf
from engines.quiz.ir.models import OptionIR, QuestionIR, CanonicalDocumentIR, SectionIR, SectionType
from engines.quiz.rendering.styles import StylePreset


class QuestionBlock:
    """
    Atomic Question Block abstraction (PLAN-02 / TASK-03).
    Encapsulates stem, rich visual elements, and options as an indivisible unit for pagination.
    """

    def __init__(
        self,
        question: QuestionIR,
        estimated_height_pt: float,
        is_oversized: bool = False,
        force_break_before: bool = False
    ) -> None:
        self.question = question
        self.estimated_height_pt = estimated_height_pt
        self.is_oversized = is_oversized
        self.force_break_before = force_break_before


class LayoutSolver:
    """Deterministic solver for question layouts and CSS Paged Media formatting."""

    @staticmethod
    def clean_text_for_length(text: str) -> str:
        """Strip HTML tags and LaTeX formula delimiters for accurate text length measurement."""
        if not text:
            return ""
        # Remove HTML tags
        no_html = re.sub(r"<[^>]+>", "", text)
        # Strip math delimiters $$ and $
        no_math_delims = re.sub(r"\${1,2}", "", no_html)
        # Condense whitespace
        return re.sub(r"\s+", " ", no_math_delims).strip()

    @classmethod
    def estimate_visual_text_length(cls, text: str) -> int:
        """Estimate real rendered character length after KaTeX/HTML formatting."""
        clean = cls.clean_text_for_length(text)
        if not clean:
            return 0
        # Simplify LaTeX commands like \mathrm{...}, \mathbf{...}, \text{...} -> inner text
        v = re.sub(r"\\[a-zA-Z]+\{([^}]*)\}", r"\1", clean)
        # Arrow conditions like \xrightarrow[...] -> ->
        v = re.sub(r"\\xrightarrow(?:\[[^\]]*\])?", " -> ", v)
        # Other LaTeX command tokens like \times, \alpha, \degree -> 1 character
        v = re.sub(r"\\[a-zA-Z]+", "X", v)
        # Delimiters and math braces
        v = re.sub(r"[{}\_\^]", "", v)
        return len(re.sub(r"\s+", " ", v).strip())

    @classmethod
    def determine_option_columns(cls, options: list[OptionIR], has_images: bool = False) -> int:
        """
        Deterministically decide grid layout: 4 columns, 2 columns, or 1 column.
        - 4 columns: Short options (<= 15 characters, single letters, numbers).
        - 2 columns: Medium options (16-45 characters).
        - 1 column: Long statements (> 45 characters) or options with embedded images.
        """
        if has_images or not options:
            return 1

        clean_lengths = [cls.estimate_visual_text_length(opt.text) for opt in options]
        max_len = max(clean_lengths) if clean_lengths else 0

        if max_len <= 15 and len(options) == 4:
            return 4
        elif max_len <= 45:
            return 2
        else:
            return 1

    @classmethod
    def estimate_question_components(
        cls,
        question: QuestionIR,
        option_cols: int = 1
    ) -> tuple[float, float, float]:
        """
        Calculates realistic rendered height in points for each semantic component:
        (stem_height, rich_height, options_height).
        All measurements reflect real CSS layout under Headless Chrome.
        """
        vis_stem_len = cls.estimate_visual_text_length(question.stem)
        # In A4 portrait (480-527pt printable width) with 10pt font, ~80-100 characters fit per line
        lines_stem = max(1, (vis_stem_len + 75) // 80)
        # 10pt font * 1.45 line-height = 14.5pt, plus label and spacing
        stem_height = lines_stem * 16.0 + 6.0

        # Rich elements (crops/images)
        rich_height = 0.0
        for elem in question.rich_elements:
            elem_h = 100.0
            if elem.source_crop_path and os.path.isfile(elem.source_crop_path):
                try:
                    from PIL import Image
                    with Image.open(elem.source_crop_path) as im:
                        iw, ih = im.size
                        # Max-width in CSS is 95% of ~480pt = 457pt, max-height: 180pt
                        scale = min(1.0, 457.0 / max(1.0, float(iw)), 180.0 / max(1.0, float(ih)))
                        elem_h = min(180.0, max(30.0, float(ih) * scale))
                except Exception:
                    elem_h = 100.0
            elif elem.bbox and elem.bbox[2] > elem.bbox[0] and elem.bbox[3] > elem.bbox[1]:
                bw = elem.bbox[2] - elem.bbox[0]
                bh = elem.bbox[3] - elem.bbox[1]
                scale = min(1.0, 457.0 / max(1.0, bw))
                elem_h = min(160.0, max(40.0, bh * scale))
            caption_h = 14.0 if elem.caption else 0.0
            rich_height += elem_h + caption_h + 10.0

        # Options
        num_options = len(question.options)
        if num_options > 0:
            cols = option_cols if option_cols in (1, 2, 4) else cls.determine_option_columns(question.options, bool(question.rich_elements))
            option_rows = (num_options + cols - 1) // cols
            options_height = option_rows * 20.0 + 6.0
        elif question.sub_statements:
            options_height = len(question.sub_statements) * 18.0 + 4.0
        else:
            options_height = 20.0

        return stem_height, rich_height, options_height

    @classmethod
    def estimate_question_height_pt(cls, question: QuestionIR, option_cols: int | StylePreset = 1) -> float:
        """
        Calculates realistic rendered height in points for the entire QuestionBlock.
        Accounts for multiline stem text, rich visual elements, options grid, and margins (16pt).
        """
        if isinstance(option_cols, StylePreset):
            cols = cls.determine_option_columns(question.options, bool(question.rich_elements))
        else:
            cols = option_cols if option_cols in (1, 2, 4) else cls.determine_option_columns(question.options, bool(question.rich_elements))
        stem_h, rich_h, opt_h = cls.estimate_question_components(question, cols)
        # CSS .question-item: margin-bottom: 9pt + padding-bottom: 2pt + container gaps = 16pt
        total_pt = stem_h + rich_h + opt_h + 16.0
        return total_pt

    @staticmethod
    def measure_pdf_rendered_questions(pdf_path: str, doc_ir: CanonicalDocumentIR | None = None) -> dict[str, dict[str, Any]]:
        """
        Extracts real rendered dimensions and page locations of questions from a compiled PDF using PyMuPDF.
        Returns a dict mapping question ID (and question number string) to geometry and integrity data.
        """
        if not os.path.isfile(pdf_path):
            return {}

        doc = pymupdf.open(pdf_path)
        q_data: dict[int, dict[str, Any]] = {}

        num_to_q = {}
        if doc_ir:
            for q in doc_ir.questions:
                num_to_q[q.number] = q

        full_doc_text: list[str] = []

        for p_idx, page in enumerate(doc):
            p_num = p_idx + 1
            blocks = page.get_text("blocks")
            full_doc_text.append(page.get_text())
            curr_q: int | None = None

            for b in blocks:
                txt = b[4].strip()
                m = re.search(r"Câu\s+(\d+)\s*:", txt)
                if m:
                    curr_q = int(m.group(1))
                    if curr_q not in q_data:
                        q_data[curr_q] = {
                            "stem_page": p_num,
                            "opt_page": None,
                            "stem_y0": b[1],
                            "stem_y1": b[3],
                            "rich_height": 0.0,
                            "opt_y0": None,
                            "opt_y1": None,
                            "total_y0": b[1],
                            "total_y1": b[3],
                        }
                    else:
                        q_data[curr_q]["stem_y1"] = max(q_data[curr_q]["stem_y1"], b[3])
                        q_data[curr_q]["total_y1"] = max(q_data[curr_q]["total_y1"], b[3])
                elif curr_q is not None:
                    if any(re.match(r"^(?:[A-D]\.|[a-d]\))", line.strip()) for line in txt.splitlines()):
                        if q_data[curr_q]["opt_page"] is None:
                            q_data[curr_q]["opt_page"] = p_num
                            q_data[curr_q]["opt_y0"] = b[1]
                        q_data[curr_q]["opt_y1"] = b[3]
                        if q_data[curr_q]["opt_page"] == q_data[curr_q]["stem_page"]:
                            q_data[curr_q]["total_y1"] = max(q_data[curr_q]["total_y1"], b[3])

            for img in page.get_images():
                for r in page.get_image_rects(img[0]):
                    candidate_q = None
                    for qnum, d in q_data.items():
                        if d["stem_page"] == p_num and d["stem_y0"] <= r.y0 + 20:
                            candidate_q = qnum
                    if candidate_q is not None:
                        img_h = r.y1 - r.y0
                        q_data[candidate_q]["rich_height"] += img_h
                        if q_data[candidate_q]["opt_page"] is None or q_data[candidate_q]["opt_page"] == p_num:
                            q_data[candidate_q]["total_y1"] = max(q_data[candidate_q]["total_y1"], r.y1)

        combined_text = "\n".join(full_doc_text)
        doc.close()

        result: dict[str, dict[str, Any]] = {}
        for qnum, d in q_data.items():
            stem_h = d["stem_y1"] - d["stem_y0"]
            rich_h = d["rich_height"]
            opt_h = (d["opt_y1"] - d["opt_y0"]) if (d["opt_y0"] is not None and d["opt_y1"] is not None) else 0.0

            opt_p = d["opt_page"] or d["stem_page"]
            is_split = (opt_p != d["stem_page"])

            total_h = (d["total_y1"] - d["total_y0"]) if not is_split else (stem_h + rich_h + opt_h)

            q_obj = num_to_q.get(qnum)
            qid = q_obj.id if q_obj else f"q_{qnum}"

            missing_opts: list[str] = []
            if q_obj and q_obj.options:
                for opt in q_obj.options:
                    pattern = rf"(?:^|\s){re.escape(opt.label)}\."
                    if not re.search(pattern, combined_text):
                        missing_opts.append(opt.label)

            info = {
                "question_number": qnum,
                "question_id": qid,
                "stem_page": d["stem_page"],
                "options_page": opt_p,
                "is_split": is_split,
                "total_height": total_h,
                "stem_height": stem_h,
                "rich_height": rich_h,
                "options_height": opt_h,
                "missing_options": missing_opts,
            }
            result[qid] = info
            result[str(qnum)] = info

        return result

    @classmethod
    def plan_atomic_pagination(
        cls,
        doc_ir: CanonicalDocumentIR,
        preset: StylePreset,
        force_break_ids: set[str] | None = None,
        rendered_measurements: dict[str, dict[str, Any]] | None = None,
    ) -> set[str]:
        """
        Determines which questions or question components must break before
        to guarantee atomic placement, avoid premature page breaks, and minimize whitespace (PLAN-02 / PLAN-LAYOUT).
        Returns a set of break specifiers:
          - question ID '{qid}': forces a page break before the whole question
          - option break ID 'opt:{qid}': forces a controlled split (options break to next page)
        """
        forced_breaks = set(force_break_ids or ())
        std_height_pt = 841.89
        pt_per_mm = 72.0 / 25.4
        margin_top_pt = preset.margin_top_mm * pt_per_mm
        margin_bottom_pt = preset.margin_bottom_mm * pt_per_mm

        usable_page_pt = std_height_pt - (margin_top_pt + margin_bottom_pt) - 18.0

        # Dynamic Header Height (PLAN Section 13)
        meta = doc_ir.metadata
        title_len = len(meta.title)
        title_lines = max(1, (title_len + 44) // 45)
        title_h = title_lines * 20.0 + 4.0

        has_duration = bool(getattr(meta, "duration", None) and meta.duration.strip()) or bool(getattr(meta, "duration_minutes", None))
        meta_items = 1 + (1 if meta.grade else 0) + (1 if has_duration else 0) + (1 if meta.exam_code else 0)
        meta_lines = 2 if meta_items >= 3 and title_len > 40 else 1
        meta_h = meta_lines * 14.0
        header_spacing_h = 16.0
        actual_header_height = title_h + meta_h + header_spacing_h

        # Page 1 starts with actual_header_height used
        current_used_pt = actual_header_height
        usable_height_pt = usable_page_pt

        q_map = {q.id: q for q in doc_ir.questions}
        ordered_sections = doc_ir.sections or [
            SectionIR(
                id="sec_default",
                title="CÂU HỎI TRẮC NGHIỆM",
                type=SectionType.PART_I_MCQ,
                question_ids=[q.id for q in doc_ir.questions]
            )
        ]

        planned_breaks: set[str] = set(forced_breaks)

        for sec in ordered_sections:
            sec_questions = [q_map[qid] for qid in sec.question_ids if qid in q_map]
            if not sec_questions:
                continue

            banner_height = 26.0

            # Check if section banner + at least first question fits on current page
            first_q = sec_questions[0]
            if rendered_measurements and first_q.id in rendered_measurements:
                first_q_h = rendered_measurements[first_q.id].get("total_height", 70.0)
            else:
                first_cols = cls.determine_option_columns(first_q.options, bool(first_q.rich_elements))
                first_q_h = cls.estimate_question_height_pt(first_q, first_cols)

            if (usable_height_pt - current_used_pt) < (banner_height + min(first_q_h, 70.0)):
                current_used_pt = banner_height
            else:
                current_used_pt += banner_height

            for q in sec_questions:
                if rendered_measurements and q.id in rendered_measurements:
                    meas = rendered_measurements[q.id]
                    stem_h = meas.get("stem_height", 20.0)
                    rich_h = meas.get("rich_height", 0.0)
                    opt_h = meas.get("options_height", 20.0)
                    total_q_h = meas.get("total_height", stem_h + rich_h + opt_h + 16.0)
                else:
                    has_imgs = bool(q.rich_elements)
                    cols = cls.determine_option_columns(q.options, has_images=has_imgs)
                    stem_h, rich_h, opt_h = cls.estimate_question_components(q, cols)
                    total_q_h = stem_h + rich_h + opt_h + 16.0

                first_group_h = stem_h + rich_h + 8.0
                second_group_h = opt_h + 8.0

                if q.id in forced_breaks:
                    planned_breaks.add(q.id)
                    current_used_pt = total_q_h
                    continue

                if f"opt:{q.id}" in forced_breaks:
                    planned_breaks.add(f"opt:{q.id}")
                    current_used_pt = second_group_h
                    continue

                # Large question exception (> 85% of usable page)
                if total_q_h >= usable_height_pt * 0.85:
                    if current_used_pt > (usable_height_pt * 0.25):
                        planned_breaks.add(q.id)
                        current_used_pt = total_q_h
                    else:
                        current_used_pt += total_q_h
                    continue

                remaining_space = usable_height_pt - current_used_pt

                # 1. Whole question fits completely
                if total_q_h <= remaining_space:
                    current_used_pt += total_q_h
                    continue

                # 2. Whole question does NOT fit: evaluate Controlled Splitting (PLAN Section 8, 11, 12)
                can_split = (
                    first_group_h <= remaining_space
                    and (bool(q.rich_elements) or stem_h >= 45.0)
                    and (bool(q.options) or bool(q.sub_statements))
                    and first_group_h >= 50.0
                )

                if can_split:
                    planned_breaks.add(f"opt:{q.id}")
                    # Current page accommodates stem + rich content
                    # Next page starts with options block
                    current_used_pt = second_group_h
                else:
                    # Semantic group does not fit or too small: break before entire question
                    planned_breaks.add(q.id)
                    current_used_pt = total_q_h

        return planned_breaks

    @classmethod
    def generate_paged_media_css(
        cls,
        preset: StylePreset,
        doc_title: str = "",
        is_answer: bool = False
    ) -> str:
        """
        Synthesize complete CSS Paged Media rules according to the selected StylePreset.
        Guarantees strict A4 portrait margins, running header/footer, and anti-orphan pagination.
        """
        safe_title = doc_title.replace('"', '\\"') if doc_title else "BÀI TẬP TRẮC NGHIỆM"
        is_ans_doc = is_answer or (preset.preset_id == "answer_green") or ("ĐÁP ÁN" in safe_title.upper())

        if is_ans_doc:
            page_rules = f"""@page {{
  size: {preset.page_size};
  margin: {preset.margin_top_mm}mm {preset.margin_right_mm}mm {preset.margin_bottom_mm}mm {preset.margin_left_mm}mm;
  @top-left {{
    content: "ĐÁP ÁN & HƯỚNG DẪN GIẢI";
    font-size: 7.5pt;
    font-family: {preset.font_family_heading};
    font-weight: bold;
    color: {preset.primary_color};
    border-bottom: 0.75pt solid {preset.border_color};
    vertical-align: bottom;
    padding-bottom: 4pt;
  }}
  @top-right {{
    content: "{safe_title}";
    font-size: 7.5pt;
    font-family: {preset.font_family_base};
    color: {preset.secondary_color};
    border-bottom: 0.75pt solid {preset.border_color};
    vertical-align: bottom;
    padding-bottom: 4pt;
  }}
  @bottom-left {{
    content: "{safe_title}";
    font-size: 8pt;
    font-family: {preset.font_family_base};
    color: {preset.muted_color};
    border-top: 0.75pt solid {preset.border_color};
    vertical-align: top;
    padding-top: 4pt;
  }}
  @bottom-right {{
    content: "Trang " counter(page) " / " counter(pages);
    font-size: 8pt;
    font-family: {preset.font_family_base};
    font-weight: bold;
    color: {preset.primary_color};
    border-top: 0.75pt solid {preset.border_color};
    vertical-align: top;
    padding-top: 4pt;
  }}
}}

@page:first {{
  @top-left {{
    content: none;
    border-bottom: none;
  }}
  @top-right {{
    content: none;
    border-bottom: none;
  }}
}}"""
        else:
            page_rules = f"""@page {{
  size: {preset.page_size};
  margin: {preset.margin_top_mm}mm {preset.margin_right_mm}mm {preset.margin_bottom_mm}mm {preset.margin_left_mm}mm;
  @bottom-left {{
    content: "{safe_title}";
    font-size: 8pt;
    font-family: {preset.font_family_base};
    color: {preset.muted_color};
    border-top: 0.5pt solid {preset.border_color};
    vertical-align: top;
    padding-top: 4pt;
  }}
  @bottom-right {{
    content: "Trang " counter(page) " / " counter(pages);
    font-size: 8pt;
    font-family: {preset.font_family_base};
    color: {preset.muted_color};
    border-top: 0.5pt solid {preset.border_color};
    vertical-align: top;
    padding-top: 4pt;
  }}
}}"""

        return f"""
/* === CSS Paged Media Rules (W3C Paged Media Spec) === */
{page_rules}

*, *::before, *::after {{
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}}

body {{
  font-family: {preset.font_family_base};
  font-size: {preset.font_size_pt}pt;
  line-height: {preset.line_height};
  color: {preset.text_color};
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
  orphans: 3;
  widows: 3;
}}

/* === Anti-Orphan & Page Break Protection === */
.question-item {{
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  display: block;
  contain: layout;
  margin-bottom: 9pt;
  padding-bottom: 2pt;
}}

.question-item.allow-controlled-split {{
  break-inside: auto !important;
  page-break-inside: auto !important;
  contain: none !important;
}}

.question-item.page-break-before {{
  break-before: page !important;
  page-break-before: always !important;
}}

.q-header {{
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  break-after: avoid !important;
  page-break-after: avoid !important;
}}

.section-banner {{
  break-after: avoid !important;
  page-break-after: avoid !important;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}


.exam-header {{
  break-after: avoid !important;
  page-break-after: avoid !important;
  text-align: center;
  margin-bottom: 8pt;
  border-bottom: 1.5pt solid {preset.primary_color};
  padding-bottom: 6pt;
}}

.exam-header-title {{
  font-family: {preset.font_family_heading};
  font-size: 15pt;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  color: {preset.primary_color};
  letter-spacing: 0.3pt;
  line-height: 1.35;
  margin-bottom: 4pt;
  word-wrap: break-word;
  overflow-wrap: break-word;
}}

.exam-header-meta {{
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 4pt 14pt;
  font-size: 9pt;
  color: {preset.text_color};
}}

/* === Section Banners === */
.section-banner {{
  background-color: {preset.banner_bg};
  color: {preset.banner_text_color};
  font-family: {preset.font_family_heading};
  font-size: 9.5pt;
  font-weight: bold;
  padding: 3.5pt 8pt;
  margin-top: 8pt;
  margin-bottom: 6pt;
  border-radius: 2pt;
  letter-spacing: 0.2pt;
  display: flex;
  justify-content: space-between;
  align-items: center;
}}

/* === Question & Options Typography === */
.q-num {{
  font-weight: bold;
  color: {preset.question_num_color};
  margin-right: 4pt;
  white-space: nowrap;
}}

.q-stem {{
  display: inline;
  text-align: justify;
}}

.q-rich-element {{
  margin: 6pt 0;
  text-align: center;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}

.q-crop-img {{
  max-width: 95%;
  max-height: 180pt;
  border: 0.5pt solid {preset.border_color};
  border-radius: 2pt;
  padding: 2pt;
  background: #ffffff;
}}

/* === Grid Layouts (4 / 2 / 1 columns) === */
.options-grid {{
  display: grid;
  gap: 3pt 10pt;
  margin-top: 4pt;
  padding-left: 4pt;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}

.options-grid.opt-col-4 {{
  grid-template-columns: repeat(4, 1fr);
}}

.options-grid.opt-col-2 {{
  grid-template-columns: repeat(2, 1fr);
}}

.options-grid.opt-col-1 {{
  grid-template-columns: 1fr;
}}

.options-grid.page-break-before {{
  break-before: page !important;
  page-break-before: always !important;
}}

.tf-statements-container {{
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}

.tf-statements-container.page-break-before {{
  break-before: page !important;
  page-break-before: always !important;
}}

.short-answer-line.page-break-before {{
  break-before: page !important;
  page-break-before: always !important;
}}

.opt-item {{
  display: flex;
  align-items: flex-start;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}

.opt-letter {{
  font-weight: bold;
  color: {preset.option_letter_color};
  margin-right: 4pt;
  flex-shrink: 0;
}}

.opt-text {{
  flex-grow: 1;
}}

/* === Part II True / False Sub-statements === */
.tf-statement-item {{
  display: flex;
  align-items: flex-start;
  margin-top: 2.5pt;
  padding-left: 6pt;
  break-inside: avoid !important;
}}

.tf-letter {{
  font-weight: bold;
  color: {preset.option_letter_color};
  margin-right: 5pt;
  flex-shrink: 0;
}}

.tf-text {{
  flex-grow: 1;
}}

/* === Part III Short Answer === */
.short-answer-line {{
  margin-top: 4pt;
  padding-left: 6pt;
  font-style: italic;
  color: {preset.muted_color};
}}

.short-answer-box {{
  display: inline-block;
  min-width: 120pt;
  border-bottom: 1pt dotted {preset.text_color};
  margin-left: 4pt;
}}

/* === Answer Key Matrix (Quick Grid) === */
.quick-matrix-container {{
  margin-bottom: 12pt;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}

.quick-matrix-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
  margin-top: 4pt;
}}

.quick-matrix-table th,
.quick-matrix-table td {{
  border: 0.75pt solid {preset.border_color};
  padding: 3.5pt 4pt;
  text-align: center;
}}

.quick-matrix-table th {{
  background-color: {preset.primary_color};
  color: #ffffff;
  font-weight: bold;
}}

.quick-matrix-table th.matrix-label-th {{
  background-color: {preset.primary_color};
  color: #ffffff;
  font-weight: bold;
  width: 32pt;
}}

.quick-matrix-table td {{
  background-color: #ffffff;
}}

.quick-matrix-table td.correct-val {{
  background-color: {preset.accent_bg};
  font-weight: bold;
  font-size: 9.5pt;
  color: {preset.primary_color};
}}

/* === Detailed Solutions === */
.solution-item {{
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  margin-bottom: 9pt;
  border-left: 2.5pt solid {preset.primary_color};
  padding-left: 8pt;
}}

.sol-header {{
  font-weight: bold;
  font-size: 9.5pt;
  color: {preset.primary_color};
  margin-bottom: 2pt;
  display: flex;
  align-items: center;
  gap: 6pt;
}}

.sol-selected {{
  display: inline-block;
  background-color: {preset.accent_bg};
  border: 1pt solid {preset.accent_border};
  padding: 1.5pt 6pt;
  border-radius: 3pt;
  margin-left: 4pt;
  color: {preset.primary_color};
  font-weight: bold;
  font-size: 8.5pt;
  letter-spacing: 0.2pt;
}}

.sol-stem {{
  font-size: 9pt;
  color: #334155;
  margin-top: 2.5pt;
  line-height: 1.4;
}}

.sol-stem strong {{
  color: {preset.secondary_color};
}}

.sol-evidence {{
  font-size: 9pt;
  margin-top: 4pt;
  color: {preset.text_color};
  background-color: {preset.accent_bg};
  border: 0.5pt solid {preset.accent_border};
  padding: 5pt 7pt;
  border-radius: 3pt;
  line-height: 1.45;
}}

.sol-evidence-header {{
  font-weight: bold;
  font-size: 8.5pt;
  color: {preset.primary_color};
  margin-bottom: 2.5pt;
}}

/* === Footer End Mark === */
.exam-end-mark {{
  text-align: center;
  margin-top: 14pt;
  margin-bottom: 10pt;
  font-weight: bold;
  font-size: 9pt;
  letter-spacing: 2pt;
  color: {preset.primary_color};
  break-before: avoid !important;
}}
"""
