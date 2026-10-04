"""
Layout Engine & Paged Media CSS Generator.
Deterministically computes option column layouts (1, 2, or 4 columns)
and generates CSS Paged Media pagination rules to guarantee zero question splits and zero orphan headings.
"""

import re
from engines.quiz.ir.models import OptionIR, QuestionIR
from engines.quiz.rendering.styles import StylePreset


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
    def determine_option_columns(cls, options: list[OptionIR], has_images: bool = False) -> int:
        """
        Deterministically decide grid layout: 4 columns, 2 columns, or 1 column.
        - 4 columns: Short options (<= 15 characters, single letters, numbers).
        - 2 columns: Medium options (16-45 characters).
        - 1 column: Long statements (> 45 characters) or options with embedded images.
        """
        if has_images or not options:
            return 1

        clean_lengths = [len(cls.clean_text_for_length(opt.text)) for opt in options]
        max_len = max(clean_lengths) if clean_lengths else 0

        if max_len <= 15 and len(options) == 4:
            return 4
        elif max_len <= 45:
            return 2
        else:
            return 1

    @classmethod
    def estimate_question_height_pt(cls, question: QuestionIR, option_cols: int) -> float:
        """Approximate rendered height in points for pagination heuristics."""
        clean_stem = cls.clean_text_for_length(question.stem)
        # Roughly 85 characters per line at 10pt on A4
        lines_stem = max(1, len(clean_stem) // 85 + 1)
        stem_height = lines_stem * 14.0

        # Rich elements (crops/images)
        rich_height = sum(130.0 for elem in question.rich_elements)

        # Options
        num_options = len(question.options)
        if num_options > 0 and option_cols > 0:
            option_rows = (num_options + option_cols - 1) // option_cols
            options_height = option_rows * 20.0
        elif question.sub_statements:
            options_height = len(question.sub_statements) * 18.0
        else:
            options_height = 24.0

        # Padding, margin, and question label
        total_pt = stem_height + rich_height + options_height + 24.0
        return total_pt

    @classmethod
    def generate_paged_media_css(cls, preset: StylePreset, doc_title: str = "") -> str:
        """
        Synthesize complete CSS Paged Media rules according to the selected StylePreset.
        Guarantees strict A4 portrait margins, running header/footer, and anti-orphan pagination.
        """
        safe_title = doc_title.replace('"', '\\"') if doc_title else "BÀI TẬP TRẮC NGHIỆM"
        
        return f"""
/* === CSS Paged Media Rules (W3C Paged Media Spec) === */
@page {{
  size: {preset.page_size};
  margin: {preset.margin_top_mm}mm {preset.margin_right_mm}mm {preset.margin_bottom_mm}mm {preset.margin_left_mm}mm;
  @bottom-left {{
    content: "{safe_title}";
    font-size: 8pt;
    font-family: {preset.font_family_base};
    color: {preset.muted_color};
    border-top: 0.5pt solid {preset.border_color};
    padding-top: 4pt;
  }}
  @bottom-right {{
    content: "Trang " counter(page) " / " counter(pages);
    font-size: 8pt;
    font-family: {preset.font_family_base};
    color: {preset.muted_color};
    border-top: 0.5pt solid {preset.border_color};
    padding-top: 4pt;
  }}
}}

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
  margin-bottom: 9pt;
  padding-bottom: 2pt;
}}

.section-banner {{
  break-after: avoid !important;
  page-break-after: avoid !important;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}}

.section-instruction {{
  break-after: avoid !important;
  page-break-after: avoid !important;
}}

.exam-header {{
  break-after: avoid !important;
  page-break-after: avoid !important;
  margin-bottom: 8pt;
  border-bottom: 1.5pt solid {preset.primary_color};
  padding-bottom: 6pt;
}}

.student-info-box {{
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  border: 1pt dashed {preset.border_color};
  background-color: {preset.accent_bg};
  padding: 5pt 10pt;
  margin-bottom: 10pt;
  border-radius: 3pt;
  font-size: 9pt;
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
  margin-bottom: 4pt;
  border-radius: 2pt;
  letter-spacing: 0.2pt;
  display: flex;
  justify-content: space-between;
  align-items: center;
}}

.section-instruction {{
  font-size: 8.5pt;
  font-style: italic;
  color: {preset.muted_color};
  margin-bottom: 7pt;
  padding-left: 2pt;
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
  border: 0.5pt solid {preset.border_color};
  padding: 3pt 4pt;
  text-align: center;
}}

.quick-matrix-table th {{
  background-color: {preset.accent_bg};
  color: {preset.primary_color};
  font-weight: bold;
}}

.quick-matrix-table td.correct-val {{
  font-weight: bold;
  color: {preset.primary_color};
}}

/* === Detailed Solutions === */
.solution-item {{
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  margin-bottom: 9pt;
  border-left: 2pt solid {preset.secondary_color};
  padding-left: 7pt;
}}

.sol-header {{
  font-weight: bold;
  font-size: 9.5pt;
  color: {preset.primary_color};
  margin-bottom: 2pt;
}}

.sol-selected {{
  display: inline-block;
  background-color: {preset.accent_bg};
  border: 0.5pt solid {preset.accent_border};
  padding: 1pt 5pt;
  border-radius: 2pt;
  margin-left: 4pt;
  color: {preset.primary_color};
}}

.sol-evidence {{
  font-size: 9pt;
  margin-top: 3pt;
  color: {preset.text_color};
  background-color: #fafafa;
  padding: 4pt 6pt;
  border-radius: 2pt;
}}

/* === Footer End Mark === */
.exam-end-mark {{
  text-align: center;
  margin-top: 14pt;
  margin-bottom: 10pt;
  font-weight: bold;
  font-size: 9pt;
  letter-spacing: 2pt;
  color: {preset.muted_color};
  break-before: avoid !important;
}}
"""
