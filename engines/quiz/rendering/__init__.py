"""
Quiz Rendering Package.
Exposes style presets, deterministic layout solver, HTML renderer, and PDF compilers.
"""

from engines.quiz.rendering.styles import (
    StylePreset,
    StyleRegistry,
    BLUE_BLACK_CLASSIC_STYLE,
    ANSWER_GREEN_STYLE,
    style_registry,
)
from engines.quiz.rendering.layout import LayoutSolver
from engines.quiz.rendering.templates import (
    render_worksheet_document,
    render_answer_document,
)
from engines.quiz.rendering.renderer import DocumentHTMLRenderer
from engines.quiz.rendering.compiler import (
    PDFCompiler,
    find_chrome_path,
    compile_html_to_pdf,
    sanitize_filename_prefix,
)

__all__ = [
    "StylePreset",
    "StyleRegistry",
    "BLUE_BLACK_CLASSIC_STYLE",
    "ANSWER_GREEN_STYLE",
    "style_registry",
    "LayoutSolver",
    "render_worksheet_document",
    "render_answer_document",
    "DocumentHTMLRenderer",
    "PDFCompiler",
    "find_chrome_path",
    "compile_html_to_pdf",
    "sanitize_filename_prefix",
]
