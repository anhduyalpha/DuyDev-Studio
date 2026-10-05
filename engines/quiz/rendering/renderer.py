"""
Document HTML Renderer.
Synthesizes CanonicalDocumentIR into deterministic, publication-grade HTML documents
for both Worksheet (DeBai) and Answer Key (DapAn) based on configured StylePreset.
"""

from __future__ import annotations

from engines.quiz.ir.models import CanonicalDocumentIR
from engines.quiz.rendering.styles import StylePreset, style_registry
from engines.quiz.rendering.templates import render_worksheet_document, render_answer_document


class DocumentHTMLRenderer:
    """Orchestrates deterministic rendering of CanonicalDocumentIR to HTML."""

    def __init__(
        self,
        preset: StylePreset | str | None = None,
        answer_preset: StylePreset | str | None = None,
    ) -> None:
        if isinstance(preset, str):
            self.preset = style_registry.get(preset)
        elif isinstance(preset, StylePreset):
            self.preset = preset
        else:
            self.preset = style_registry.get()

        if isinstance(answer_preset, str):
            self.answer_preset = style_registry.get(answer_preset)
        elif isinstance(answer_preset, StylePreset):
            self.answer_preset = answer_preset
        else:
            self.answer_preset = style_registry.get("answer_green")

    def render_worksheet(
        self,
        doc_ir: CanonicalDocumentIR,
        force_break_ids: set[str] | None = None,
        rendered_measurements: dict | None = None,
        katex_css_rel: str = "./katex/katex.min.css",
        katex_js_rel: str = "./katex/katex.min.js",
        katex_auto_render_rel: str = "./katex/contrib/auto-render.min.js",
    ) -> str:
        """Render exam question worksheet HTML."""
        return render_worksheet_document(
            doc_ir=doc_ir,
            preset=self.preset,
            force_break_ids=force_break_ids,
            rendered_measurements=rendered_measurements,
            katex_css_rel=katex_css_rel,
            katex_js_rel=katex_js_rel,
            katex_auto_render_rel=katex_auto_render_rel,
        )

    def render_answer_key(
        self,
        doc_ir: CanonicalDocumentIR,
        preset: StylePreset | str | None = None,
        katex_css_rel: str = "./katex/katex.min.css",
        katex_js_rel: str = "./katex/katex.min.js",
        katex_auto_render_rel: str = "./katex/contrib/auto-render.min.js",
    ) -> str:
        """Render answer matrix and detailed pedagogical solutions HTML."""
        ans_preset = self.answer_preset
        if preset is not None:
            ans_preset = style_registry.get(preset) if isinstance(preset, str) else preset

        return render_answer_document(
            doc_ir=doc_ir,
            preset=ans_preset,
            katex_css_rel=katex_css_rel,
            katex_js_rel=katex_js_rel,
            katex_auto_render_rel=katex_auto_render_rel,
        )
