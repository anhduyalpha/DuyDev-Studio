"""
Unit and regression tests for Answer PDF Full Green Theme.
Verifies that:
1. DapAn (Answer Key & Solutions) uses Full Green visual tokens (#047857, #059669, #ecfdf5, #6ee7b7).
2. DeBai (Question Worksheet) preserves its classic Blue/Black visual tokens (#1e3a8a).
3. Visual identities are strictly segregated and running headers reflect answer identity.
"""

from __future__ import annotations

import unittest
from engines.quiz.ir.models import (
    CanonicalDocumentIR,
    DocumentMetadataIR,
    QuestionIR,
    OptionIR,
    AnswerKeyIR,
    SectionType,
)
from engines.quiz.rendering.styles import (
    ANSWER_GREEN_STYLE,
    BLUE_BLACK_CLASSIC_STYLE,
    style_registry,
)
from engines.quiz.rendering.renderer import DocumentHTMLRenderer


class TestAnswerGreenTheme(unittest.TestCase):
    def setUp(self):
        self.doc_ir = CanonicalDocumentIR(
            metadata=DocumentMetadataIR(
                title="BÀI TẬP TRẮC NGHIỆM TRANG 39",
                subject="Hóa học",
                grade="12",
                total_questions=3,
                created_at="2026-10-05T00:00:00Z",
            ),
            questions=[
                QuestionIR(
                    id="q_35",
                    number=35,
                    source_number=35,
                    type=SectionType.PART_I_MCQ,
                    stem="Chất nào sau đây tác dụng với dung dịch $NaOH$?",
                    options=[
                        OptionIR(label="A", text="$CH_3COOH$"),
                        OptionIR(label="B", text="$C_2H_5OH$"),
                        OptionIR(label="C", text="$CH_4$"),
                        OptionIR(label="D", text="$C_6H_6$"),
                    ],
                ),
            ],
            answers=[
                AnswerKeyIR(
                    question_id="q_35",
                    question_number=35,
                    type=SectionType.PART_I_MCQ,
                    selected_answer="A",
                    evidence="Axit axetic tác dụng với kiềm tạo muối và nước.",
                ),
            ],
        )

    def test_style_registry_has_answer_green(self):
        preset = style_registry.get("answer_green")
        self.assertIsNotNone(preset)
        self.assertEqual(preset.preset_id, "answer_green")
        self.assertEqual(preset.primary_color, "#047857")
        self.assertEqual(preset.secondary_color, "#059669")
        self.assertEqual(preset.accent_bg, "#ecfdf5")
        self.assertEqual(preset.accent_border, "#6ee7b7")

    def test_renderer_default_presets_are_segregated(self):
        renderer = DocumentHTMLRenderer()
        # DeBai defaults to classic blue
        self.assertEqual(renderer.preset.preset_id, "blue_black_classic")
        self.assertEqual(renderer.preset.primary_color, "#1e3a8a")
        # DapAn defaults to answer green
        self.assertEqual(renderer.answer_preset.preset_id, "answer_green")
        self.assertEqual(renderer.answer_preset.primary_color, "#047857")

    def test_answer_html_full_green_visual_tokens(self):
        renderer = DocumentHTMLRenderer()
        dapan_html = renderer.render_answer_key(self.doc_ir)

        # 1. Main Title
        self.assertIn("ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI CHI TIẾT", dapan_html)
        self.assertIn("font-size: 15pt", dapan_html)
        self.assertIn("BÀI TẬP TRẮC NGHIỆM TRANG 39", dapan_html)

        # 2. Metadata Badge
        self.assertIn("ĐÁP ÁN CHÍNH THỨC", dapan_html)
        self.assertIn("background-color: #ecfdf5", dapan_html)

        # 3. Section Banners
        self.assertIn("I. BẢNG ĐÁP ÁN NHANH", dapan_html)
        self.assertIn("II. HƯỚNG DẪN GIẢI CHI TIẾT", dapan_html)

        # 4. Quick Matrix & Solutions CSS tokens
        self.assertIn("#047857", dapan_html)  # Primary emerald green
        self.assertIn("#ecfdf5", dapan_html)  # Light mint green
        self.assertIn("#6ee7b7", dapan_html)  # Emerald border

        # 5. High-contrast body text
        self.assertIn("color: #0f172a", dapan_html)  # Slate-900 body
        self.assertIn("color: #334155", dapan_html)  # Slate-700 sol-stem

        # 6. Paged Media running header & suppression
        self.assertIn("content: \"ĐÁP ÁN & HƯỚNG DẪN GIẢI\"", dapan_html)
        self.assertIn("@page:first", dapan_html)
        self.assertIn("content: none", dapan_html)

        # 7. No blue tokens in answer html
        self.assertNotIn("#1e3a8a", dapan_html)
        self.assertNotIn("#1d4ed8", dapan_html)

    def test_debai_html_preserves_blue_black_identity(self):
        renderer = DocumentHTMLRenderer()
        debai_html = renderer.render_worksheet(self.doc_ir)

        # DeBai retains classic blue theme
        self.assertIn("#1e3a8a", debai_html)
        self.assertIn("BÀI TẬP TRẮC NGHIỆM TRANG 39", debai_html)

        # DeBai must NOT contain answer green tokens or answer banners
        self.assertNotIn("ĐÁP ÁN VÀ HƯỚNG DẪN GIẢI", debai_html)
        self.assertNotIn("ĐÁP ÁN CHÍNH THỨC", debai_html)
        self.assertNotIn("#047857", debai_html)
        self.assertNotIn("#ecfdf5", debai_html)


if __name__ == "__main__":
    unittest.main()
